from rest_framework.viewsets import ModelViewSet, GenericViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.http import HttpResponse
from django.db.models import Q
from .models import Announcement, AnnouncementShareInfo, AnnouncementCategory
from .serializers import AnnouncementSerializer, AnnouncementCreateSerializer, AnnouncementUpdateSerializer, AnnouncementShareInfoSerializer, AnnouncementShareInfoCreateSerializer, AnnouncementCategorySerializer
from vibro.views import userContextAPIView
from vibro.permissions import IsAdmin, IsEndUserOrAdmin
from vibro.utils import UtilsFunctions
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.conf import settings
import json
from datetime import datetime


class AnnouncementCategoryViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AnnouncementCategorySerializer
    queryset = AnnouncementCategory.objects.all()

    def get_queryset(self):
        return AnnouncementCategory.objects.filter(
            organization=self.request.user.organization,
            is_active=True
        ).order_by('name')


class AnnouncementViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Announcement.objects.all()

    def _is_global_announcement_viewer(self):
        user = self.request.user
        role_name = getattr(getattr(user, 'role', None), 'name', None)
        return role_name == 'admin'

    def get_queryset(self):
        queryset = Announcement.objects.filter(
            organization=self.request.user.organization
        ).select_related('organization', 'created_by', 'updated_by')

        # Only return currently active announcements when requested (e.g. mobile feed).
        active_only = self.request.query_params.get('active') in ('true', '1')
        if active_only:
            today = timezone.now().date()
            queryset = queryset.filter(
                announcement_start_date__date__lte=today,
                announcement_end_date__date__gte=today
            )

        # Admins should continue to see the full organization feed.
        # Regular users should only see announcements that were actually
        # shared with them (or that they created themselves).
        if self._is_global_announcement_viewer():
            return queryset

        visible_announcement_ids = AnnouncementShareInfo.objects.filter(
            Q(sent_to_user=self.request.user) |
            Q(sent_to_group__members=self.request.user)
        ).values_list('announcement_id', flat=True).distinct()

        queryset = queryset.filter(
            Q(id__in=visible_announcement_ids) |
            Q(created_by=self.request.user)
        )
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return AnnouncementCreateSerializer
        elif self.action == 'update' or self.action == 'partial_update':
            return AnnouncementUpdateSerializer
        return AnnouncementSerializer

    def create(self, request, *args, **kwargs):
        UF = UtilsFunctions()
        attachments = request.FILES.getlist('attachments', [])
        uploaded_urls = []

        # Handle file uploads - use local storage for development
        import os
        from django.conf import settings
        
        # Create upload directory if it doesn't exist
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'announcements', str(request.user.organization.id))
        os.makedirs(upload_dir, exist_ok=True)

        for attachment in attachments:
            if hasattr(attachment, 'name'):  # It's a file object
                file_name = attachment.name
                timestamp = datetime.now().strftime("%d%m%y_%H%M%S")
                local_file_name = f"{timestamp}_{file_name}"
                local_file_path = os.path.join(upload_dir, local_file_name)

                # Save file locally
                with open(local_file_path, 'wb+') as destination:
                    for chunk in attachment.chunks():
                        destination.write(chunk)

                # Create URL for local file
                file_url = f"{settings.MEDIA_URL}announcements/{request.user.organization.id}/{local_file_name}"
                
                uploaded_urls.append({
                    'name': file_name,
                    'url': file_url,
                    'size': attachment.size if hasattr(attachment, 'size') else None
                })

        # Store URLs as JSON in announcement_attachments_urls field and metadata in announcement_attachments
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if uploaded_urls:
            # Store URLs in separate field
            urls_only = [item['url'] for item in uploaded_urls]
            serializer.validated_data['announcement_attachments_urls'] = json.dumps(urls_only)

            # Store metadata (name, size) in attachments field
            metadata_only = [{'name': item['name'], 'size': item['size']} for item in uploaded_urls]
            serializer.validated_data['announcement_attachments'] = json.dumps(metadata_only)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        import os
        from django.conf import settings

        attachments = request.FILES.getlist('attachments', [])
        uploaded_urls = []

        # Handle file uploads - use local storage
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'announcements', str(request.user.organization.id))
        os.makedirs(upload_dir, exist_ok=True)

        for attachment in attachments:
            if hasattr(attachment, 'name'):  # It's a file object
                file_name = attachment.name
                timestamp = datetime.now().strftime("%d%m%y_%H%M%S")
                local_file_name = f"{timestamp}_{file_name}"
                local_file_path = os.path.join(upload_dir, local_file_name)

                # Save file locally
                with open(local_file_path, 'wb+') as destination:
                    for chunk in attachment.chunks():
                        destination.write(chunk)

                # Create URL for local file
                file_url = f"{settings.MEDIA_URL}announcements/{request.user.organization.id}/{local_file_name}"
                
                uploaded_urls.append({
                    'name': file_name,
                    'url': file_url,
                    'size': attachment.size if hasattr(attachment, 'size') else None
                })

        # Handle deleted attachments from frontend
        if hasattr(request.data, 'getlist'):
            deleted_attachments = request.data.getlist('deleted_attachments', [])
        else:
            deleted_attachments = request.data.get('deleted_attachments', [])
        print(f"DEBUG: Processing {len(deleted_attachments)} deleted attachments: {deleted_attachments}")

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        # Get current attachments data
        current_metadata = []
        current_urls = []

        if instance.announcement_attachments:
            try:
                current_metadata = json.loads(instance.announcement_attachments)
            except (json.JSONDecodeError, TypeError):
                current_metadata = []

        if instance.announcement_attachments_urls:
            try:
                current_urls = json.loads(instance.announcement_attachments_urls)
            except (json.JSONDecodeError, TypeError):
                current_urls = []

        # Process deletions - remove files from local storage and arrays
        for filename_to_delete in deleted_attachments:
            # Find the file in current metadata
            file_index = None
            for i, metadata in enumerate(current_metadata):
                if metadata.get('name') == filename_to_delete:
                    file_index = i
                    break

            if file_index is not None:
                # Delete from local storage if URL exists
                if file_index < len(current_urls):
                    file_url = current_urls[file_index]
                    try:
                        # Extract file path from URL
                        from urllib.parse import urlparse, unquote
                        parsed_url = urlparse(file_url)
                        # URL format: /media/announcements/{org_id}/{filename}
                        relative_path = parsed_url.path.lstrip('/')
                        local_file_path = os.path.join(settings.MEDIA_ROOT, relative_path.replace('media/', '', 1))
                        
                        # Delete from local storage
                        if os.path.exists(local_file_path):
                            os.remove(local_file_path)
                            print(f"DEBUG: Deleted file from local storage: {local_file_path}")
                    except Exception as e:
                        # Log error but continue with database cleanup
                        print(f"Error deleting file from local storage: {e}")

                # Remove from arrays
                current_metadata.pop(file_index)
                current_urls.pop(file_index)
                print(f"DEBUG: Removed {filename_to_delete} from metadata arrays")

        # Add new attachments to existing ones
        if uploaded_urls:
            new_metadata = [{'name': item['name'], 'size': item['size']} for item in uploaded_urls]
            current_metadata.extend(new_metadata)

            new_urls = [item['url'] for item in uploaded_urls]
            current_urls.extend(new_urls)

            print(f"DEBUG: Added {len(uploaded_urls)} new attachments")

        # Update the validated data with final attachment info
        if current_metadata:
            serializer.validated_data['announcement_attachments'] = json.dumps(current_metadata)
            serializer.validated_data['announcement_attachments_urls'] = json.dumps(current_urls)
        else:
            # No attachments left
            serializer.validated_data['announcement_attachments'] = None
            serializer.validated_data['announcement_attachments_urls'] = None

        print(f"DEBUG: Final attachment count: {len(current_metadata)}")

        self.perform_update(serializer)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
            updated_on=timezone.now()
        )

    @action(detail=False, methods=['post'])
    def bulk_share(self, request):
        """Bulk share multiple announcements to users/groups"""
        announcements_ids = request.data.get('announcements', [])
        users = request.data.get('users', [])
        groups = request.data.get('groups', [])
        share_status = request.data.get('share_status', 'sent')

        if not announcements_ids:
            return Response({'error': 'At least one announcement must be provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if not users and not groups:
            return Response({'error': 'At least one user or group must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from user.models import CustomUser, Groups
        total_created_shares = []
        share_summaries = []

        # Get announcements in one query
        announcements = Announcement.objects.filter(
            id__in=announcements_ids,
            organization=self.request.user.organization
        )
        announcement_dict = {ann.id: ann for ann in announcements}

        for ann_id in announcements_ids:
            if ann_id not in announcement_dict:
                continue  # Skip if invalid or not owned

            announcement = announcement_dict[ann_id]
            created_shares_for_ann = []

            # Collect all users that are in the selected groups
            users_in_selected_groups = set()
            group_objs = {}
            for group_id in groups:
                group = get_object_or_404(Groups, id=group_id, organization=request.user.organization)
                group_objs[group_id] = group
                for user in group.members.all():
                    users_in_selected_groups.add(user.id)

            # Share with groups: create entries for each user in group
            for group_id in groups:
                group = group_objs[group_id]
                for user in group.members.all():
                    existing = AnnouncementShareInfo.objects.filter(
                        announcement=announcement,
                        sent_to_user=user,
                        sent_to_group=group
                    ).exists()
                    if not existing:
                        share = AnnouncementShareInfo.objects.create(
                            announcement=announcement,
                            sent_to_user=user,
                            sent_to_group=group,
                            share_status=share_status
                        )
                        created_shares_for_ann.append(share)

            # Share with individual users
            for user_id in users:
                user = get_object_or_404(CustomUser, id=user_id, organization=request.user.organization)
                existing = AnnouncementShareInfo.objects.filter(
                    announcement=announcement,
                    sent_to_user=user
                ).exists()
                if not existing:
                    share = AnnouncementShareInfo.objects.create(
                        announcement=announcement,
                        sent_to_user=user,
                        share_status=share_status
                    )
                    created_shares_for_ann.append(share)

            total_created_shares.extend(created_shares_for_ann)
            share_summaries.append({
                'announcement_id': ann_id,
                'announcement_title': announcement.title,
                'shared_with': len(created_shares_for_ann),
                'created_shares': AnnouncementShareInfoSerializer(created_shares_for_ann, many=True, context={'selected_groups': group_objs}).data
            })

        response_data = {
            'message': f'Bulk shared {len(announcements_ids)} announcements with {len(total_created_shares)} recipients successfully.',
            'share_summaries': share_summaries
        }

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        """Share announcement with users/groups"""
        announcement = self.get_object()

        users = request.data.get('users', [])
        groups = request.data.get('groups', [])
        share_status = request.data.get('share_status', 'sent')

        if not users and not groups:
            return Response({'error': 'At least one user or group must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from user.models import CustomUser, Groups
        created_shares = []

        # Share with individual users
        for user_id in users:
            user = get_object_or_404(CustomUser, id=user_id, organization=request.user.organization)

            # Check if already shared
            existing = AnnouncementShareInfo.objects.filter(
                announcement=announcement,
                sent_to_user=user
            ).exists()

            if not existing:
                share = AnnouncementShareInfo.objects.create(
                    announcement=announcement,
                    sent_to_user=user,
                    share_status=share_status
                )
                created_shares.append(share)

        # Share with groups
        for group_id in groups:
            group = get_object_or_404(Groups, id=group_id, organization=request.user.organization)

            # Check if group already shared
            existing = AnnouncementShareInfo.objects.filter(
                announcement=announcement,
                sent_to_group=group
            ).exists()

            if not existing:
                share = AnnouncementShareInfo.objects.create(
                    announcement=announcement,
                    sent_to_group=group,
                    share_status=share_status
                )
                created_shares.append(share)

                # Create individual shares for group members
                for user in group.members.all():
                    user_existing = AnnouncementShareInfo.objects.filter(
                        announcement=announcement,
                        sent_to_user=user
                    ).exists()
                    if not user_existing:
                        user_share = AnnouncementShareInfo.objects.create(
                            announcement=announcement,
                            sent_to_user=user,
                            share_status=share_status
                        )
                        created_shares.append(user_share)

        response_data = {
            'message': f'Announcement shared with {len(created_shares)} recipient(s) successfully.',
            'created_shares': AnnouncementShareInfoSerializer(created_shares, many=True).data
        }

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def shares(self, request, pk=None):
        """Get all shares for an announcement"""
        announcement = self.get_object()
        shares = AnnouncementShareInfo.objects.filter(announcement=announcement).select_related('sent_to_user', 'sent_to_group')
        serializer = AnnouncementShareInfoSerializer(shares, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def status_viewed(self, request, pk=None):
        """Mark announcement as viewed for the current user"""
        announcement = self.get_object()
        share = get_object_or_404(AnnouncementShareInfo, announcement=announcement, sent_to_user=request.user)

        share.share_status = 'viewed'
        share.viewed_timestamp = timezone.now()
        share.save()

        return Response({'message': 'Announcement marked as viewed.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def status_acknowledged(self, request, pk=None):
        """Mark announcement as acknowledged for the current user"""
        announcement = self.get_object()
        share = get_object_or_404(AnnouncementShareInfo, announcement=announcement, sent_to_user=request.user)

        if not announcement.request_acknowledge:
            return Response({'error': 'Acknowledgment not required for this announcement.'}, status=status.HTTP_400_BAD_REQUEST)

        share.share_status = 'acknowledged'
        share.acknowledged = True
        share.acknowledged_timestamp = timezone.now()
        share.save()

        return Response({'message': 'Announcement acknowledged.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def status_notified(self, request, pk=None):
        """Mark announcement as notified for the current user"""
        announcement = self.get_object()
        share = get_object_or_404(AnnouncementShareInfo, announcement=announcement, sent_to_user=request.user)

        share.share_status = 'notified'
        share.save()

        return Response({'message': 'Announcement marked as notified.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def liked(self, request, pk=None):
        """Update like status for the announcement by the current user"""
        announcement = self.get_object()
        share = get_object_or_404(AnnouncementShareInfo, announcement=announcement, sent_to_user=request.user)

        liked_status = request.data.get('liked', False)
        share.liked = liked_status
        if liked_status:
            share.share_status = 'liked'
        share.save()

        return Response({'message': 'Like status updated.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'])
    def delete_attachment(self, request, pk=None):
        """Delete a specific attachment from an announcement"""
        announcement = self.get_object()
        import os
        from django.conf import settings

        # Check permissions - only creator or admin can delete attachments
        if announcement.created_by != request.user and not request.user.is_staff and not request.user.groups.filter(name='Admin').exists():
            return Response({'error': 'Only the announcement creator or admin can delete attachments.'}, status=status.HTTP_403_FORBIDDEN)

        filename = request.data.get('filename')
        if not filename:
            return Response({'error': 'filename is required in request body.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse current attachments metadata
        if not announcement.announcement_attachments:
            return Response({'error': 'No attachments found for this announcement.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            attachments_metadata = json.loads(announcement.announcement_attachments)
        except (json.JSONDecodeError, TypeError):
            return Response({'error': 'Invalid attachment metadata.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Parse current URLs
        if not announcement.announcement_attachments_urls:
            return Response({'error': 'Attachment URLs not available.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            attachment_urls = json.loads(announcement.announcement_attachments_urls)
        except (json.JSONDecodeError, TypeError):
            return Response({'error': 'Invalid attachment URLs data.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Find the attachment index by filename
        file_index = None
        for i, attachment in enumerate(attachments_metadata):
            if attachment.get('name') == filename:
                file_index = i
                break

        if file_index is None:
            return Response({'error': 'Attachment not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Delete file from local storage
        if file_index < len(attachment_urls):
            file_url = attachment_urls[file_index]
            try:
                # Extract file path from URL
                from urllib.parse import urlparse, unquote
                parsed_url = urlparse(file_url)
                # URL format: /media/announcements/{org_id}/{filename}
                relative_path = parsed_url.path.lstrip('/')
                local_file_path = os.path.join(settings.MEDIA_ROOT, relative_path.replace('media/', '', 1))

                # Delete from local storage
                if os.path.exists(local_file_path):
                    os.remove(local_file_path)
                    print(f"DEBUG: Deleted file from local storage: {local_file_path}")
            except Exception as e:
                # Log error but continue with database cleanup
                print(f"Error deleting file from local storage: {e}")

        # Remove from metadata arrays
        attachments_metadata.pop(file_index)
        attachment_urls.pop(file_index)

        # Update announcement with new metadata
        announcement.announcement_attachments = json.dumps(attachments_metadata) if attachments_metadata else None
        announcement.announcement_attachments_urls = json.dumps(attachment_urls) if attachment_urls else None
        announcement.updated_by = request.user
        announcement.updated_on = timezone.now()
        announcement.save()

        return Response({
            'message': f'Attachment "{filename}" deleted successfully.',
            'remaining_attachments': len(attachments_metadata)
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def download_attachment(self, request, pk=None):
        """Download a specific attachment file from an announcement"""
        announcement = self.get_object()
        import os
        from django.conf import settings

        # Get filename from query parameters
        filename = request.query_params.get('filename')
        if not filename:
            return Response({'error': 'filename parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse attachments metadata to find the file index
        if not announcement.announcement_attachments:
            return Response({'error': 'No attachments found for this announcement.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            attachments_metadata = json.loads(announcement.announcement_attachments)
        except (json.JSONDecodeError, TypeError):
            return Response({'error': 'Invalid attachment metadata.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Find the attachment index by filename
        file_index = None
        for i, attachment in enumerate(attachments_metadata):
            if attachment.get('name') == filename:
                file_index = i
                break

        if file_index is None:
            return Response({'error': 'Attachment not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Get the URL from the URLs field
        if not announcement.announcement_attachments_urls:
            return Response({'error': 'Attachment URLs not available.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            attachment_urls = json.loads(announcement.announcement_attachments_urls)
        except (json.JSONDecodeError, TypeError):
            return Response({'error': 'Invalid attachment URLs data.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if file_index >= len(attachment_urls):
            return Response({'error': 'URL data mismatch.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        file_url = attachment_urls[file_index]
        if not file_url:
            return Response({'error': 'File URL not available.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Fetch file from local storage
        try:
            # Extract file path from URL
            from urllib.parse import urlparse, unquote
            parsed_url = urlparse(file_url)
            # URL format: /media/announcements/{org_id}/{filename}
            relative_path = parsed_url.path.lstrip('/')
            local_file_path = os.path.join(settings.MEDIA_ROOT, relative_path.replace('media/', '', 1))

            # Read file from local storage
            if not os.path.exists(local_file_path):
                return Response({'error': 'File not found in storage.'}, status=status.HTTP_404_NOT_FOUND)

            with open(local_file_path, 'rb') as f:
                file_content = f.read()

            # Determine content type based on file extension
            content_type = 'application/octet-stream'
            if filename.lower().endswith('.pdf'):
                content_type = 'application/pdf'
            elif filename.lower().endswith(('.doc', '.docx')):
                content_type = 'application/msword'
            elif filename.lower().endswith(('.xls', '.xlsx')):
                content_type = 'application/vnd.ms-excel'

            response = HttpResponse(file_content, content_type=content_type)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = len(file_content)

            return response

        except Exception as e:
            return Response({'error': f'Error retrieving file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def count(self, request):
        """Get total count of announcements for the user's organization"""
        queryset = self.get_queryset()
        total_count = queryset.count()
        today = timezone.now().date()
        today_count = queryset.filter(created_on__date=today).count()
        return Response({'count': total_count, 'today_count': today_count}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Bulk delete announcements"""
        ids = request.data.get('ids', [])
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'A non-empty list of ids must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Filter announcements to those in the user's organization and matching ids
        announcements = self.get_queryset().filter(id__in=ids)
        deleted_count = announcements.count()
        announcements.delete()

        return Response({
            'message': f'Successfully deleted {deleted_count} announcement(s).'
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def announcement_share_info(request, pk):
    """Get share info for an announcement"""
    try:
        announcement = Announcement.objects.get(
            id=pk,
            organization=request.user.organization
        )
        share_info = AnnouncementShareInfo.objects.filter(announcement=announcement)
        serializer = AnnouncementShareInfoSerializer(share_info, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Announcement.DoesNotExist:
        return Response({'error': 'Announcement not found'}, status=status.HTTP_404_NOT_FOUND)
