from rest_framework import serializers
from .models import GuideFolder, GuideDocument, GuideShare


class GuideFolderSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    has_documents = serializers.SerializerMethodField()

    class Meta:
        model = GuideFolder
        fields = ['id', 'name', 'parent', 'organization', 'created_by', 'created_at', 'updated_at', 'children', 'document_count', 'has_documents']
        read_only_fields = ['id', 'created_by', 'organization', 'created_at', 'updated_at', 'children', 'document_count', 'has_documents']

    def get_children(self, obj):
        children = obj.children.all().order_by('name')
        return GuideFolderSerializer(children, many=True).data

    def get_document_count(self, obj):
        return obj.documents.count()

    def get_has_documents(self, obj):
        return obj.documents.exists()


class GuideFolderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (no recursive children)"""
    document_count = serializers.SerializerMethodField()
    has_children = serializers.SerializerMethodField()

    class Meta:
        model = GuideFolder
        fields = ['id', 'name', 'parent', 'document_count', 'has_children', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_document_count(self, obj):
        return obj.documents.count()

    def get_has_children(self, obj):
        return obj.children.exists()


class GuideDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    folder_name = serializers.SerializerMethodField()

    class Meta:
        model = GuideDocument
        fields = ['id', 'title', 'description', 'folder', 'folder_name', 'file', 'file_url', 'file_type', 'file_size', 'document_type', 'uploaded_by', 'uploaded_by_name', 'allow_download', 'allow_print', 'allow_screenshot', 'created_at', 'updated_at']
        read_only_fields = ['id', 'file_url', 'file_type', 'file_size', 'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None

    def get_file_url(self, obj):
        if obj.file and obj.file.name:
            request = self.context.get('request')
            url = obj.file.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_folder_name(self, obj):
        if obj.folder:
            return obj.folder.name
        return None


class GuideShareSerializer(serializers.ModelSerializer):
    shared_with_user_name = serializers.SerializerMethodField()
    shared_with_group_name = serializers.SerializerMethodField()
    shared_by_name = serializers.SerializerMethodField()
    document_title = serializers.SerializerMethodField()
    folder_name = serializers.SerializerMethodField()

    class Meta:
        model = GuideShare
        fields = ['id', 'folder', 'document', 'shared_with_user', 'shared_with_user_name', 'shared_with_group', 'shared_with_group_name', 'share_type', 'shared_by', 'shared_by_name', 'document_title', 'folder_name', 'created_at']
        read_only_fields = ['id', 'shared_by', 'shared_by_name', 'created_at']

    def get_shared_with_user_name(self, obj):
        if obj.shared_with_user:
            return f"{obj.shared_with_user.first_name} {obj.shared_with_user.last_name}".strip() or obj.shared_with_user.username
        return None

    def get_shared_with_group_name(self, obj):
        if obj.shared_with_group:
            return obj.shared_with_group.name
        return None

    def get_shared_by_name(self, obj):
        if obj.shared_by:
            return f"{obj.shared_by.first_name} {obj.shared_by.last_name}".strip() or obj.shared_by.username
        return None

    def get_document_title(self, obj):
        if obj.document:
            return obj.document.title
        return None

    def get_folder_name(self, obj):
        if obj.folder:
            return obj.folder.name
        return None
