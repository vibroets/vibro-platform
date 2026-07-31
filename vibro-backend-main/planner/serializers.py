from rest_framework import serializers
from .models import PlannerAssignment, PlannerSubmission, PlannerAssignType, PlannerFolder, CollaborativeSubmission, GroupDelegation
from form.models import Form, CustomUser, Groups, AuditGroup
from task.models import Task


class PlannerAssignmentSerializer(serializers.ModelSerializer):
    order_type = serializers.CharField(source='planner_name', read_only=True)

    class Meta:
        model = PlannerAssignment
        fields = [
            'id', 'order_id', 'assign_type', 'planner_name', 'order_type', 'location',
            'form', 'user', 'group', 'leader',
            'planner_shared_on', 'start_date', 'end_date', 'description',
            'is_completed', 'completed_on', 'completed_by', 'organization', 'created_by',
            'repeat_enabled', 'repeat_interval_days', 'early_notification_days',
            'parent_planner', 'repeat_generation_date', 'folder',
            'collaborative_enabled', 'team_leader'
        ]
        read_only_fields = ['order_id', 'planner_shared_on', 'is_completed', 'completed_on', 'completed_by', 'repeat_generation_date']


class GroupDelegationSerializer(serializers.ModelSerializer):
    audit_group_name = serializers.CharField(source='audit_group.name', read_only=True)
    assigned_user_ids = serializers.SerializerMethodField()
    assigned_user_names = serializers.SerializerMethodField()
    submitted_by_name = serializers.CharField(source='submitted_by.username', read_only=True, default=None)
    answered_count = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()

    class Meta:
        model = GroupDelegation
        fields = [
            'id', 'collaborative_submission', 'audit_group', 'audit_group_name', 'group_order',
            'assigned_users', 'assigned_user_ids', 'assigned_user_names',
            'assigned_by', 'assigned_on', 'status', 'display_status',
            'submitted_by', 'submitted_by_name', 'submitted_on', 'reviewed_on', 'rejection_comment',
            'assigned_question_uuids', 'organization',
            'answered_count', 'total_questions'
        ]
        read_only_fields = ['assigned_on', 'submitted_on', 'reviewed_on', 'organization']

    def get_assigned_user_ids(self, obj):
        return list(obj.assigned_users.values_list('id', flat=True))

    def get_assigned_user_names(self, obj):
        return list(obj.assigned_users.values_list('username', flat=True))

    def _get_main_question_ids(self, obj):
        """Return IDs of main audit questions for this group.
        Only 'audit' type questions with no parent are counted as real questions.
        Companion fields (upload_image, short_answer, dropdown) are excluded."""
        from form.models import Question
        if not obj.audit_group:
            return []
        return list(Question.objects.filter(
            form=obj.collaborative_submission.planner_assignment.form,
            audit_group=obj.audit_group,
            parent_question__isnull=True,
            question_type='audit'
        ).values_list('id', flat=True))

    def get_total_questions(self, obj):
        return len(self._get_main_question_ids(obj))

    def get_answered_count(self, obj):
        from form.models import Answer
        form_submission = obj.collaborative_submission.form_submission
        if not form_submission:
            return 0
        question_ids = self._get_main_question_ids(obj)
        if not question_ids:
            return 0
        return Answer.objects.filter(
            submission=form_submission,
            question_id__in=question_ids,
            organization=obj.organization
        ).count()

    def get_display_status(self, obj):
        """Returns a user-friendly status that accounts for in-progress answering."""
        if obj.status in ['submitted', 'reviewed', 'rejected', 'unassigned']:
            return obj.status
        # status is 'assigned' or 'in_progress' — check answers
        answered = self.get_answered_count(obj)
        total = self.get_total_questions(obj)
        if total > 0 and answered >= total:
            # All questions answered but not yet submitted
            return 'in_progress'
        if answered > 0:
            return 'in_progress'
        return obj.status


class CollaborativeSubmissionSerializer(serializers.ModelSerializer):
    group_delegations = GroupDelegationSerializer(many=True, read_only=True)
    team_leader_name = serializers.CharField(source='team_leader.username', read_only=True)
    planner_name = serializers.CharField(source='planner_assignment.planner_name', read_only=True)
    form_title = serializers.SerializerMethodField()
    form_id = serializers.SerializerMethodField()
    completed_groups = serializers.SerializerMethodField()
    total_groups = serializers.SerializerMethodField()
    completion_percentage = serializers.SerializerMethodField()

    class Meta:
        model = CollaborativeSubmission
        fields = [
            'id', 'planner_assignment', 'form_submission', 'team_leader', 'team_leader_name',
            'planner_name', 'form_title', 'form_id', 'status', 'created_on', 'started_on', 'completed_on',
            'group_delegations', 'organization', 'participant_users', 'participant_groups',
            'completed_groups', 'total_groups', 'completion_percentage'
        ]
        read_only_fields = ['created_on', 'started_on', 'completed_on', 'organization']

    def get_form_title(self, obj):
        if obj.planner_assignment and obj.planner_assignment.form:
            return obj.planner_assignment.form.title
        return None

    def get_form_id(self, obj):
        if obj.planner_assignment and obj.planner_assignment.form:
            return obj.planner_assignment.form.id
        return None

    def get_completed_groups(self, obj):
        return obj.group_delegations.filter(
            status__in=['submitted', 'reviewed']
        ).count()

    def get_total_groups(self, obj):
        return obj.group_delegations.count()

    def get_completion_percentage(self, obj):
        total = obj.group_delegations.count()
        if total == 0:
            return 0
        completed = obj.group_delegations.filter(
            status__in=['submitted', 'reviewed']
        ).count()
        return round((completed / total) * 100)

    def validate(self, data):
        assign_type = data.get('assign_type')
        
        # Ensure at least one assignee is provided based on assign_type
        if assign_type == PlannerAssignType.USER and not data.get('user'):
            raise serializers.ValidationError("User must be provided for user assignment type")
        elif assign_type == PlannerAssignType.GROUP and not data.get('group'):
            raise serializers.ValidationError("Group must be provided for group assignment type")
        elif assign_type == PlannerAssignType.LOCATION_LEADER and not data.get('leader'):
            raise serializers.ValidationError("Leader must be provided for leader assignment type")
        
        return data


class PlannerSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerSubmission
        fields = [
            'id', 'planner_assignment', 'form_submission', 'submitted_on',
            'submitted_by', 'followup_tasks_created'
        ]
        read_only_fields = ['submitted_on', 'followup_tasks_created']


class PlannerBulkUploadSerializer(serializers.Serializer):
    """
    Serializer for planner bulk upload from frontend.
    Similar to task bulk upload but creates PlannerAssignment instead of Task.
    """
    order_type = serializers.CharField(max_length=255, required=False, allow_blank=True)
    planner_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True, help_text="Location name or ID")
    form = serializers.CharField(help_text="Form title or URL")
    start_date = serializers.CharField(help_text="Start date in ISO format or YYYY-MM-DD HH:MM")
    end_date = serializers.CharField(help_text="End date in ISO format or YYYY-MM-DD HH:MM")
    description = serializers.CharField(required=False, allow_blank=True)
    share_with_users = serializers.CharField(required=False, allow_blank=True, help_text="Comma-separated user IDs")
    share_with_groups = serializers.CharField(required=False, allow_blank=True, help_text="Comma-separated group IDs")
    share_with_locations = serializers.CharField(required=False, allow_blank=True, help_text="Comma-separated location IDs")


class PlannerShareSerializer(serializers.Serializer):
    """
    Serializer for sharing planner to users/groups/leaders/locations.
    """
    planner_assignment_id = serializers.IntegerField()
    users = serializers.ListField(child=serializers.IntegerField(), required=False, default=[])
    groups = serializers.ListField(child=serializers.IntegerField(), required=False, default=[])
    leaders = serializers.ListField(child=serializers.IntegerField(), required=False, default=[])
    locations = serializers.ListField(child=serializers.IntegerField(), required=False, default=[])
