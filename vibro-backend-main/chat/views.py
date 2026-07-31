from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.shortcuts import get_object_or_404
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import ChatGroup, ChatMessage, GroupRequest, MessageReadStatus
from .serializers import (
    ChatGroupSerializer, ChatMessageSerializer,
    GroupRequestSerializer, UserBriefSerializer
)
from user.models import Groups

User = get_user_model()


class ChatGroupViewSet(viewsets.ModelViewSet):
    serializer_class = ChatGroupSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        return ChatGroup.objects.filter(
            members=user,
            is_active=True
        ).distinct().order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        group = get_object_or_404(ChatGroup, id=pk, members=request.user)
        messages = group.messages.order_by('created_at')
        serializer = ChatMessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        group = get_object_or_404(ChatGroup, id=pk, members=request.user)
        msg_type = request.data.get('message_type', 'text')
        content = request.data.get('content', '')
        attachment = request.data.get('attachment', None)
        attachment_name = request.data.get('attachment_name', None)
        duration = request.data.get('duration', None)

        msg = ChatMessage.objects.create(
            group=group,
            sender=request.user,
            message_type=msg_type,
            content=content,
            attachment=attachment if attachment else None,
            attachment_name=attachment_name,
            duration=duration,
        )
        serializer = ChatMessageSerializer(msg, context={'request': request})
        msg_data = serializer.data

        # Broadcast to channel layer for real-time delivery
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{group.id}',
            {
                'type': 'chat_message',
                'message': msg_data,
                'group_id': group.id,
                'group_name': group.name,
            }
        )

        return Response(msg_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        group = get_object_or_404(ChatGroup, id=pk, members=request.user)
        unread = group.messages.exclude(
            read_statuses__user=request.user
        ).exclude(sender=request.user)
        for msg in unread:
            MessageReadStatus.objects.get_or_create(
                message=msg, user=request.user
            )
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def add_members(self, request, pk=None):
        group = get_object_or_404(ChatGroup, id=pk)
        member_ids = request.data.get('member_ids', [])
        users = User.objects.filter(id__in=member_ids, organization=request.user.organization)
        group.members.add(*users)
        return Response({'status': 'ok', 'added': len(users)})

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        group = get_object_or_404(ChatGroup, id=pk)
        member_id = request.data.get('member_id')
        group.members.remove(member_id)
        return Response({'status': 'ok'})


class GroupRequestViewSet(viewsets.ModelViewSet):
    serializer_class = GroupRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = GroupRequest.objects.all()
        if user.role and user.role.name in ('super_admin', 'admin'):
            return qs.filter(organization=user.organization).order_by('-created_at')
        return qs.filter(requested_by=user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data['requested_by'] = request.user.id
        data['organization'] = request.user.organization_id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        group_request = serializer.save(requested_by=request.user, organization=request.user.organization)

        member_ids = request.data.get('proposed_member_ids', [])
        group_ids = request.data.get('group_ids', [])
        if member_ids:
            users = User.objects.filter(id__in=member_ids, organization=request.user.organization)
            group_request.proposed_members.set(users)
        if group_ids:
            org_groups = Groups.objects.filter(id__in=group_ids, organization=request.user.organization, is_deleted=False, is_archived=False)
            for g in org_groups:
                group_request.proposed_members.add(*g.members.all())

        return Response(
            GroupRequestSerializer(group_request).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        user = request.user
        if not (user.role and user.role.name in ('super_admin', 'admin')):
            return Response(
                {'error': 'Only admins can approve requests'},
                status=status.HTTP_403_FORBIDDEN
            )

        group_request = get_object_or_404(GroupRequest, id=pk)
        if group_request.status != 'pending':
            return Response(
                {'error': 'Request already processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        group_request.status = 'approved'
        group_request.reviewed_by = user
        group_request.reviewed_at = timezone.now()
        group_request.save()

        chat_group = ChatGroup.objects.create(
            name=group_request.topic,
            description=group_request.description,
            organization=group_request.organization,
            created_by=user,
        )
        chat_group.members.set(group_request.proposed_members.all())
        chat_group.members.add(user, group_request.requested_by)

        ChatMessage.objects.create(
            group=chat_group,
            sender=user,
            message_type='system',
            content=f'Group "{chat_group.name}" created. All members can now chat.',
        )

        group_request.created_chat_group = chat_group
        group_request.save()

        return Response({
            'status': 'approved',
            'chat_group': ChatGroupSerializer(chat_group, context={'request': request}).data
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        user = request.user
        if not (user.role and user.role.name in ('super_admin', 'admin')):
            return Response(
                {'error': 'Only admins can reject requests'},
                status=status.HTTP_403_FORBIDDEN
            )

        group_request = get_object_or_404(GroupRequest, id=pk)
        group_request.status = 'rejected'
        group_request.reviewed_by = user
        group_request.reviewed_at = timezone.now()
        group_request.save()

        return Response({'status': 'rejected'})


class OrganizationUsersView(generics.ListAPIView):
    serializer_class = UserBriefSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return User.objects.filter(
            organization=user.organization,
            is_active=True,
            is_deleted=False
        ).exclude(id=user.id).order_by('first_name', 'username')


class OrganizationGroupsView(generics.ListAPIView):
    """List all active groups in the user's organization."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        user = request.user
        groups = Groups.objects.filter(
            organization=user.organization,
            is_deleted=False,
            is_archived=False
        ).values('id', 'name', 'description').order_by('name')
        return Response(list(groups))


class CreateChatGroupView(generics.CreateAPIView):
    """Admin-only: create a chat group directly with selected users and groups."""
    serializer_class = ChatGroupSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        user = request.user
        if not (user.role and user.role.name in ('super_admin', 'admin')):
            return Response(
                {'error': 'Only admins can create chat groups directly'},
                status=status.HTTP_403_FORBIDDEN
            )

        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Name is required'}, status=status.HTTP_400_BAD_REQUEST)

        description = request.data.get('description', '')
        member_ids = request.data.get('member_ids', [])
        group_ids = request.data.get('group_ids', [])

        chat_group = ChatGroup.objects.create(
            name=name,
            description=description,
            organization=user.organization,
            created_by=user,
        )

        # Add individual users
        if member_ids:
            users = User.objects.filter(id__in=member_ids, organization=user.organization, is_active=True, is_deleted=False)
            chat_group.members.add(*users)

        # Expand groups to their members
        if group_ids:
            org_groups = Groups.objects.filter(id__in=group_ids, organization=user.organization, is_deleted=False, is_archived=False)
            for g in org_groups:
                chat_group.members.add(*g.members.all())

        # Add the creator
        chat_group.members.add(user)

        ChatMessage.objects.create(
            group=chat_group,
            sender=user,
            message_type='system',
            content=f'Group "{chat_group.name}" created.',
        )

        return Response(
            ChatGroupSerializer(chat_group, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
