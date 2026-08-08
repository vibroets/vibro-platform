from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import GuideFolder, GuideDocument, GuideShare
from .serializers import (
    GuideFolderSerializer,
    GuideFolderListSerializer,
    GuideDocumentSerializer,
    GuideShareSerializer,
)
from vibro.permissions import IsAdminOrSuperAdmin

User = get_user_model()


class GuideFolderViewSet(viewsets.ModelViewSet):
    serializer_class = GuideFolderListSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        return GuideFolder.objects.filter(organization=user.organization).order_by('name')

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return GuideFolderSerializer
        return GuideFolderListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, organization=self.request.user.organization)

    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        folder = get_object_or_404(GuideFolder, id=pk, organization=request.user.organization)
        documents = folder.documents.all()
        serializer = GuideDocumentSerializer(documents, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Get full folder tree"""
        folders = GuideFolder.objects.filter(
            organization=request.user.organization,
            parent__isnull=True
        ).order_by('name')
        serializer = GuideFolderSerializer(folders, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def root(self, request):
        """Get root-level folders only"""
        folders = GuideFolder.objects.filter(
            organization=request.user.organization,
            parent__isnull=True
        ).order_by('name')
        serializer = GuideFolderListSerializer(folders, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get children of a specific folder"""
        folder = get_object_or_404(GuideFolder, id=pk, organization=request.user.organization)
        children = folder.children.all().order_by('name')
        serializer = GuideFolderListSerializer(children, many=True, context={'request': request})
        return Response(serializer.data)


class GuideDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = GuideDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        return GuideDocument.objects.filter(organization=user.organization).order_by('-created_at')

    def perform_create(self, serializer):
        file = serializer.validated_data.get('file')
        file_type = ''
        file_size = 0
        if file:
            file_size = file.size
            if hasattr(file, 'name') and '.' in file.name:
                file_type = file.name.rsplit('.', 1)[-1].lower()
        serializer.save(
            uploaded_by=self.request.user,
            organization=self.request.user.organization,
            file_type=file_type,
            file_size=file_size,
        )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Serve file for download (checks allow_download restriction)"""
        doc = get_object_or_404(GuideDocument, id=pk, organization=request.user.organization)
        if not doc.allow_download:
            return Response(
                {'error': 'Download is restricted for this document'},
                status=status.HTTP_403_FORBIDDEN
            )
        if not doc.file or not doc.file.name:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        from django.http import FileResponse
        response = FileResponse(doc.file.open('rb'))
        response['Content-Disposition'] = f'attachment; filename="{doc.title}.{doc.file_extension}"'
        response['Content-Length'] = doc.file_size
        return response

    @action(detail=True, methods=['get'])
    def view(self, request, pk=None):
        """Serve file inline for viewing (always allowed if user has access)"""
        doc = get_object_or_404(GuideDocument, id=pk, organization=request.user.organization)
        if not doc.file or not doc.file.name:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        from django.http import FileResponse
        response = FileResponse(doc.file.open('rb'))
        response['Content-Disposition'] = f'inline; filename="{doc.title}.{doc.file_extension}"'
        response['Content-Length'] = doc.file_size
        # Add headers to discourage screenshots/printing
        if not doc.allow_print:
            response['X-Print-Disabled'] = '1'
        if not doc.allow_screenshot:
            response['X-Screenshot-Disabled'] = '1'
        return response

    @action(detail=True, methods=['patch'])
    def restrictions(self, request, pk=None):
        """Update download/print/screenshot restrictions"""
        doc = get_object_or_404(GuideDocument, id=pk, organization=request.user.organization)
        doc.allow_download = request.data.get('allow_download', doc.allow_download)
        doc.allow_print = request.data.get('allow_print', doc.allow_print)
        doc.allow_screenshot = request.data.get('allow_screenshot', doc.allow_screenshot)
        doc.save()
        serializer = GuideDocumentSerializer(doc, context={'request': request})
        return Response(serializer.data)


class GuideShareViewSet(viewsets.ModelViewSet):
    serializer_class = GuideShareSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        # Admin/SuperAdmin see all shares in their org
        # Regular users see only shares shared with them
        user_groups = user.user_groups.all() if hasattr(user, 'user_groups') else []
        queryset = GuideShare.objects.filter(
            Q(shared_with_user=user) |
            Q(shared_with_group__in=user_groups)
        ).distinct().order_by('-created_at')

        if user.role and user.role.name in ['super_admin', 'admin']:
            # Admins see all shares in their org
            org_shares = GuideShare.objects.filter(
                Q(folder__organization=user.organization) |
                Q(document__organization=user.organization)
            ).distinct().order_by('-created_at')
            return org_shares
        return queryset

    def perform_create(self, serializer):
        share_type = serializer.validated_data.get('share_type', 'user')
        if share_type == 'user' and serializer.validated_data.get('shared_with_user'):
            user_id = serializer.validated_data['shared_with_user'].id
            try:
                user = User.objects.get(id=user_id, organization=self.request.user.organization)
            except User.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'error': 'User not found in your organization'})
        serializer.save(shared_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_share(self, request):
        """Share a folder or document with multiple users/groups at once"""
        folder_id = request.data.get('folder_id')
        document_id = request.data.get('document_id')
        user_ids = request.data.get('user_ids', [])
        group_ids = request.data.get('group_ids', [])

        folder = None
        document = None
        if folder_id:
            folder = get_object_or_404(GuideFolder, id=folder_id, organization=request.user.organization)
        if document_id:
            document = get_object_or_404(GuideDocument, id=document_id, organization=request.user.organization)

        created = []
        for uid in user_ids:
            try:
                target_user = User.objects.get(id=uid, organization=request.user.organization)
                share, created_flag = GuideShare.objects.get_or_create(
                    folder=folder,
                    document=document,
                    shared_with_user=target_user,
                    share_type='user',
                    defaults={'shared_by': request.user}
                )
                if created_flag:
                    created.append(GuideShareSerializer(share).data)
            except User.DoesNotExist:
                pass

        from user.models import Groups
        for gid in group_ids:
            try:
                group = Groups.objects.get(id=gid, organization=request.user.organization, is_deleted=False)
                share, created_flag = GuideShare.objects.get_or_create(
                    folder=folder,
                    document=document,
                    shared_with_group=group,
                    share_type='group',
                    defaults={'shared_by': request.user}
                )
                if created_flag:
                    created.append(GuideShareSerializer(share).data)
            except Groups.DoesNotExist:
                pass

        return Response({'created': created, 'count': len(created)}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def my_guides(self, request):
        """Get all folders and documents shared with the current user"""
        user = request.user
        user_groups = []
        if hasattr(user, 'user_groups'):
            user_groups = user.user_groups.all()

        shares = GuideShare.objects.filter(
            Q(shared_with_user=user) |
            Q(shared_with_group__in=user_groups)
        ).distinct()

        folder_ids = set()
        document_ids = set()
        for share in shares:
            if share.folder_id:
                folder_ids.add(share.folder_id)
            if share.document_id:
                document_ids.add(share.document_id)

        # Also include documents inside shared folders
        shared_folders = GuideFolder.objects.filter(id__in=folder_ids)
        for folder in shared_folders:
            # Get all descendant folder ids
            descendant_ids = self._get_descendant_folder_ids(folder)
            folder_ids.update(descendant_ids)
            for fid in descendant_ids:
                docs = GuideDocument.objects.filter(folder_id=fid)
                document_ids.update(docs.values_list('id', flat=True))
            # Documents directly in this folder
            document_ids.update(folder.documents.values_list('id', flat=True))

        folders = GuideFolder.objects.filter(id__in=folder_ids).order_by('name')
        documents = GuideDocument.objects.filter(id__in=document_ids).order_by('-created_at')

        return Response({
            'folders': GuideFolderListSerializer(folders, many=True).data,
            'documents': GuideDocumentSerializer(documents, many=True, context={'request': request}).data,
        })

    def _get_descendant_folder_ids(self, folder):
        """Recursively get all descendant folder IDs"""
        ids = set()
        for child in folder.children.all():
            ids.add(child.id)
            ids.update(self._get_descendant_folder_ids(child))
        return ids

    def destroy(self, request, *args, **kwargs):
        """Only the sharer or admin can unshare"""
        instance = self.get_object()
        user = request.user
        if instance.shared_by_id != user.id:
            if not (user.role and user.role.name in ['super_admin', 'admin']):
                return Response(
                    {'error': 'You can only remove shares you created'},
                    status=status.HTTP_403_FORBIDDEN
                )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
