from rest_framework import serializers
from .models import Announcement, AnnouncementShareInfo, AnnouncementCategory
from user.models import CustomUser, Groups, Organization
import json


class AnnouncementCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementCategory
        fields = ['id', 'name', 'organization', 'created_by', 'created_on', 'is_active']
        read_only_fields = ['id', 'organization', 'created_by', 'created_on']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            validated_data['organization'] = request.user.organization
        return super().create(validated_data)


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name = serializers.SerializerMethodField(read_only=True)
    organization_name = serializers.CharField(source='organization.organization_name', read_only=True)
    count_of_likes = serializers.SerializerMethodField(read_only=True)
    count_of_views = serializers.SerializerMethodField(read_only=True)
    count_of_acknowledge = serializers.SerializerMethodField(read_only=True)
    current_user_liked = serializers.SerializerMethodField(read_only=True)
    current_user_acknowledged = serializers.SerializerMethodField(read_only=True)
    current_user_share_status = serializers.SerializerMethodField(read_only=True)
    liked = serializers.SerializerMethodField(read_only=True)
    acknowledged = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'announcement_category', 'announcement_start_date', 'announcement_end_date',
            'pin_as_important', 'request_acknowledge', 'prevent_download', 'announcement_content',
            'announcement_tags', 'announcement_attachments', 'announcement_fullscreen', 'organization', 'organization_name',
            'created_by', 'created_by_name', 'created_on', 'updated_by', 'updated_by_name', 'updated_on',
            'count_of_likes', 'count_of_views', 'count_of_acknowledge',
            'current_user_liked', 'current_user_acknowledged', 'current_user_share_status',
            'liked', 'acknowledged'
        ]
        read_only_fields = ['id', 'organization', 'created_by', 'created_on', 'updated_by', 'updated_on']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip() or obj.updated_by.username
        return None

    def get_count_of_likes(self, obj):
        return AnnouncementShareInfo.objects.filter(announcement=obj, liked=True).count()

    def get_count_of_views(self, obj):
        return AnnouncementShareInfo.objects.filter(announcement=obj, viewed_timestamp__isnull=False).count()

    def get_count_of_acknowledge(self, obj):
        return AnnouncementShareInfo.objects.filter(announcement=obj, acknowledged=True).count()

    def _get_user_shares(self, obj):
        request = self.context.get('request')
        if not request or not getattr(request, 'user', None) or request.user.is_anonymous:
            return AnnouncementShareInfo.objects.none()
        return AnnouncementShareInfo.objects.filter(announcement=obj, sent_to_user=request.user)

    def get_current_user_liked(self, obj):
        return self._get_user_shares(obj).filter(liked=True).exists()

    def get_current_user_acknowledged(self, obj):
        return self._get_user_shares(obj).filter(acknowledged=True).exists()

    def get_current_user_share_status(self, obj):
        latest_share = self._get_user_shares(obj).order_by('-id').first()
        return latest_share.share_status if latest_share else None

    # Backward-compatible aliases for mobile clients expecting generic keys.
    def get_liked(self, obj):
        return self.get_current_user_liked(obj)

    def get_acknowledged(self, obj):
        return self.get_current_user_acknowledged(obj)

    def get_announcement_attachments(self, obj):
        """Return announcement_attachments with URLs for mobile compatibility"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Announcement ID: {obj.id}")
        logger.info(f"Raw announcement_attachments: {obj.announcement_attachments}")
        logger.info(f"Raw announcement_attachments_urls: {obj.announcement_attachments_urls}")
        
        # Get metadata (names, sizes)
        metadata_list = []
        if obj.announcement_attachments:
            try:
                metadata_list = json.loads(obj.announcement_attachments)
            except (json.JSONDecodeError, TypeError):
                metadata_list = []

        # Get URLs
        urls_list = []
        if obj.announcement_attachments_urls:
            try:
                urls_list = json.loads(obj.announcement_attachments_urls)
            except (json.JSONDecodeError, TypeError):
                urls_list = []

        # Combine metadata with URLs
        combined_attachments = []
        for i, metadata in enumerate(metadata_list):
            attachment_data = dict(metadata)  # Copy metadata
            if i < len(urls_list):
                attachment_data['url'] = urls_list[i]
            combined_attachments.append(attachment_data)

        logger.info(f"Returning combined attachments: {combined_attachments}")
        return json.dumps(combined_attachments)

    def validate(self, attrs):
        start_date = attrs.get('announcement_start_date')
        end_date = attrs.get('announcement_end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("End date may be same as the start date but should not be before the start date.")

        return attrs


class AnnouncementShareInfoSerializer(serializers.ModelSerializer):
    sent_to_user_name = serializers.SerializerMethodField(read_only=True)
    sent_to_user_designation = serializers.SerializerMethodField(read_only=True)
    sent_to_user_location = serializers.SerializerMethodField(read_only=True)
    user_group_name = serializers.SerializerMethodField(read_only=True)
    sent_to_group_name = serializers.SerializerMethodField(read_only=True)
    announcement_title = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AnnouncementShareInfo
        fields = [
            'id', 'announcement', 'announcement_title', 'sent_to_user', 'sent_to_user_name', 'sent_to_user_designation', 'sent_to_user_location', 'user_group_name', 'sent_to_group', 'sent_to_group_name',
            'share_status', 'sent_timestamp', 'acknowledged', 'acknowledged_timestamp', 'viewed_timestamp', 'liked'
        ]
        read_only_fields = ['id', 'sent_timestamp']

    def get_sent_to_user_name(self, obj):
        if obj.sent_to_user:
            return f"{obj.sent_to_user.first_name} {obj.sent_to_user.last_name}".strip() or obj.sent_to_user.username
        return None

    def get_sent_to_user_designation(self, obj):
        if obj.sent_to_user and hasattr(obj.sent_to_user, 'designation') and obj.sent_to_user.designation:
            # Handle if designation is a ForeignKey/model
            if hasattr(obj.sent_to_user.designation, 'name'):
                return obj.sent_to_user.designation.name
            else:
                return str(obj.sent_to_user.designation)
        return None

    def get_sent_to_user_location(self, obj):
        if obj.sent_to_user and hasattr(obj.sent_to_user, 'location') and obj.sent_to_user.location:
            # Handle if location is a ForeignKey/model
            if hasattr(obj.sent_to_user.location, 'name'):
                return obj.sent_to_user.location.name
            else:
                return str(obj.sent_to_user.location)
        return None

    def get_user_group_name(self, obj):
        if obj.sent_to_user:
            # First, check if user is in one of the selected groups for this announcement
            selected_groups = self.context.get('selected_groups', {})
            for group_id, group in selected_groups.items():
                if obj.sent_to_user in group.members.all():
                    return group.name
            # Fallback to any group the user belongs to
            first_group = obj.sent_to_user.user_groups.first()
            if first_group:
                return first_group.name
        return None

    def get_sent_to_group_name(self, obj):
        if obj.sent_to_group:
            return obj.sent_to_group.name
        return None

    def get_announcement_title(self, obj):
        if obj.announcement:
            return obj.announcement.title
        return None


class AnnouncementShareInfoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementShareInfo
        fields = [
            'id', 'announcement', 'sent_to_user', 'sent_to_group', 'share_status', 'sent_timestamp', 'acknowledged', 'viewed_timestamp', 'liked'
        ]
        read_only_fields = ['id', 'sent_timestamp']

class AnnouncementCreateSerializer(serializers.ModelSerializer):
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
        help_text="Upload multiple files (PDF, Excel, DOC, etc.)"
    )
    announcement_content = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'announcement_category', 'announcement_start_date', 'announcement_end_date',
            'pin_as_important', 'request_acknowledge', 'prevent_download', 'announcement_content',
            'announcement_tags', 'announcement_attachments', 'announcement_fullscreen', 'attachments'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        # Remove attachments field before creating model instance
        validated_data.pop('attachments', None)
        return super().create(validated_data)

    def validate(self, attrs):
        start_date = attrs.get('announcement_start_date')
        end_date = attrs.get('announcement_end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("End date may be same as the start date but should not be before the start date.")

        return attrs

class AnnouncementUpdateSerializer(serializers.ModelSerializer):
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
        help_text="Upload multiple files (PDF, Excel, DOC, etc.)"
    )
    announcement_content = serializers.CharField(required=False, allow_blank=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name = serializers.SerializerMethodField(read_only=True)
    organization_name = serializers.CharField(source='organization.organization_name', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'announcement_category', 'announcement_start_date', 'announcement_end_date',
            'pin_as_important', 'request_acknowledge', 'prevent_download', 'announcement_content',
            'announcement_tags', 'announcement_attachments', 'announcement_fullscreen', 'attachments', 'organization', 'organization_name',
            'created_by', 'created_by_name', 'created_on', 'updated_by', 'updated_by_name', 'updated_on'
        ]
        read_only_fields = ['id', 'organization', 'created_by', 'created_on', 'updated_by', 'updated_on']

    def update(self, instance, validated_data):
        # Remove attachments field before updating model instance
        validated_data.pop('attachments', None)
        return super().update(instance, validated_data)

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip() or obj.updated_by.username
        return None

    def validate(self, attrs):
        start_date = attrs.get('announcement_start_date')
        end_date = attrs.get('announcement_end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("End date may be same as the start date but should not be before the start date.")

        return attrs
