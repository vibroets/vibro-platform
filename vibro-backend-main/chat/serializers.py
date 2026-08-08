from rest_framework import serializers
from .models import ChatGroup, ChatMessage, GroupRequest, MessageReadStatus
from django.contrib.auth import get_user_model

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = UserBriefSerializer(read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'group', 'sender', 'message_type', 'content',
            'attachment', 'attachment_url', 'attachment_name',
            'duration', 'created_at'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'attachment_url']

    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url
        return None


class ChatGroupSerializer(serializers.ModelSerializer):
    members = UserBriefSerializer(many=True, read_only=True)
    created_by = UserBriefSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatGroup
        fields = [
            'id', 'name', 'description', 'organization',
            'created_by', 'members', 'is_active',
            'created_at', 'updated_at', 'last_message', 'unread_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        last = obj.messages.order_by('-created_at').first()
        if last:
            return ChatMessageSerializer(last, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.exclude(
                read_statuses__user=request.user
            ).exclude(sender=request.user).count()
        return 0


class GroupRequestSerializer(serializers.ModelSerializer):
    requested_by = UserBriefSerializer(read_only=True)
    proposed_members = UserBriefSerializer(many=True, read_only=True)
    reviewed_by = UserBriefSerializer(read_only=True)
    created_chat_group = ChatGroupSerializer(read_only=True)

    class Meta:
        model = GroupRequest
        fields = [
            'id', 'topic', 'description', 'requested_by',
            'proposed_members', 'organization', 'status',
            'reviewed_by', 'reviewed_at', 'created_chat_group',
            'created_at'
        ]
        read_only_fields = [
            'id', 'requested_by', 'status', 'reviewed_by',
            'reviewed_at', 'created_chat_group', 'created_at'
        ]
