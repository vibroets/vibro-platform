from rest_framework import serializers
from .models import Draft

class DraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Draft
        fields = [
            'draft_id', 'user', 'form_id', 's3_key', 's3_url', 'timestamp', 'metadata',
            'form_overall_status', 'form_overall_score', 'form_critical_failed',
            'groups_status', 'group_score', 'group_percentage', 'group_critical_failed',
            'audit_group'
        ]
        # allow client to provide `draft_id`; keep `user` and S3 fields read-only
        read_only_fields = ['user', 's3_key', 's3_url', 'timestamp']


class DraftListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Draft
        fields = [
            'draft_id', 'form_id', 'user', 'timestamp', 'metadata',
            'form_overall_status', 'form_overall_score', 'form_critical_failed',
            'groups_status', 'group_score', 'group_percentage', 'group_critical_failed',
            'audit_group'
        ]
