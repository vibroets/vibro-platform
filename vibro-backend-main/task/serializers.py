from rest_framework import serializers
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from .models import Task, TaskAssignee, TaskTracking, TaskStatus, TaskAuditLog
from user.models import CustomUser, Groups
from form.models import Form, LogicFollowUp, Answer, QuestionType, FormSubmision, Question
from vibro.permissions import IsAdmin, IsEndUserOrAdmin
from django.shortcuts import get_object_or_404
from form.models import Stage, StageAssignment
import uuid
import logging

logger = logging.getLogger(__name__)
import datetime


class ISTDateTimeField(serializers.DateTimeField):
    """Custom DateTimeField that displays dates in IST timezone"""

    def enforce_timezone(self, value):
        """Override to prevent automatic UTC conversion"""
        ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        if value.tzinfo is None:
            # If naive datetime, assume it's in IST
            return value.replace(tzinfo=ist_tz)
        else:
            # Convert to IST
            return value.astimezone(ist_tz)

    def to_representation(self, value):
        if value is None:
            return None

        # Apply IST timezone conversion
        value = self.enforce_timezone(value)

        # Format as ISO string without converting to UTC
        if hasattr(value, 'isoformat'):
            return value.isoformat()
        return str(value)

class TaskAssigneeSerializer(serializers.ModelSerializer):
    assigned_user_name = serializers.SerializerMethodField(read_only=True)
    assigned_group_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TaskAssignee
        fields = [
            'id', 'task', 'assigned_user', 'assigned_group', 'assigned_date_time',
            'assigned_user_name', 'assigned_group_name'
        ]
        read_only_fields = ['id', 'assigned_date_time']

    def validate(self, attrs):
        task = attrs.get('task')
        assigned_user = attrs.get('assigned_user')
        assigned_group = attrs.get('assigned_group')

        if not assigned_user and not assigned_group:
            raise serializers.ValidationError("Either assigned_user or assigned_group must be provided.")

        if assigned_user and assigned_group:
            raise serializers.ValidationError("Cannot assign both user and group in single assignee record.")

        # Check if task exists and belongs to user's organization
        if task:
            request = self.context.get('request')
            if request and request.user:
                if task.organization != request.user.organization:
                    raise serializers.ValidationError("Task does not belong to your organization.")

        return attrs

    def create(self, validated_data):
        validated_data['assigned_date_time'] = timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        old_assigned_user = instance.assigned_user
        old_assigned_group = instance.assigned_group

        new_assigned_user = validated_data.get('assigned_user', instance.assigned_user)
        new_assigned_group = validated_data.get('assigned_group', instance.assigned_group)

        instance = super().update(instance, validated_data)

        # Check if assignee was changed
        if (old_assigned_user != new_assigned_user) or (old_assigned_group != new_assigned_group):
            # Create audit log for reassignment
            action_to = None
            if new_assigned_user:
                action_to = new_assigned_user
            # Note: For groups, we could set to group admin or something, but for now only track user reassignments

            TaskAuditLog.objects.create(
                task=instance.task,
                task_action='reassigned',
                action_by=self.context.get('request').user if self.context.get('request') else None,
                action_to=action_to
            )

        return instance

    def get_assigned_user_name(self, obj):
        if obj.assigned_user:
            return f"{obj.assigned_user.first_name} {obj.assigned_user.last_name}".strip() or obj.assigned_user.username
        return None

    def get_assigned_group_name(self, obj):
        if obj.assigned_group:
            return obj.assigned_group.name
        return None

class TaskTrackingSerializer(serializers.ModelSerializer):
    assignee_user_name = serializers.SerializerMethodField(read_only=True)
    assignee_group_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TaskTracking
        fields = [
            'id', 'task', 'assignee_user', 'assignee_group', 'status', 'actual_start_date',
            'actual_end_date', 'comments', 'assignee_user_name', 'assignee_group_name'
        ]
        read_only_fields = ['id']

    def get_assignee_user_name(self, obj):
        return f"{obj.assignee_user.first_name} {obj.assignee_user.last_name}".strip() or obj.assignee_user.username

    def get_assignee_group_name(self, obj):
        if obj.assignee_group:
            return obj.assignee_group.name
        return None

class TaskSerializer(serializers.ModelSerializer):
    assignees = TaskAssigneeSerializer(many=True, read_only=True)
    tracking_records = TaskTrackingSerializer(many=True, read_only=True)
    form_title = serializers.CharField(source='form.title', read_only=True)
    form_prefix = serializers.SerializerMethodField()
    assigned_form_id = serializers.SerializerMethodField()  # For followup tasks - the form to fill
    followup_task_form_id = serializers.SerializerMethodField()  # For followup tasks - the follow-up form
    created_by_name = serializers.SerializerMethodField(read_only=True)
    organization_name = serializers.CharField(source='organization.organization_name', read_only=True)
    assignee_names = serializers.SerializerMethodField()
    main_form_submission_id = serializers.SerializerMethodField()
    main_form_location = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    planner_id = serializers.SerializerMethodField()
    planner_name = serializers.SerializerMethodField()
    planner_folder_name = serializers.SerializerMethodField()
    planner_folder_color = serializers.SerializerMethodField()
    task_age_days = serializers.SerializerMethodField()
    is_auto_closed = serializers.SerializerMethodField()
    is_bulk_imported = serializers.BooleanField(read_only=True)
    start_date = ISTDateTimeField(read_only=True)
    end_date = ISTDateTimeField(read_only=True)
    created_on = ISTDateTimeField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'task_name', 'description', 'reopened_remarks', 'form', 'form_title', 'form_prefix', 'assigned_form_id', 'followup_task_form_id', 'status',
            'start_date', 'end_date', 'created_on',
            'created_by', 'created_by_name', 'organization', 'organization_name',
            'assignees', 'tracking_records', 'assignee_names',
            'main_form_submission_id', 'main_form_location',
            'source', 'planner_id', 'planner_name', 'planner_folder_name', 'planner_folder_color', 'task_age_days', 'is_auto_closed', 'is_bulk_imported'
        ]
        read_only_fields = ['id', 'created_by', 'organization']

    def get_is_auto_closed(self, obj):
        return TaskAuditLog.objects.filter(
            task=obj,
            task_action='Auto_Closed_Related_Task'
        ).exists()

    def get_form_prefix(self, obj):
        """Get prefix from the main form that originated this task."""
        # For regular tasks, the main form is obj.form
        if obj.form and obj.form.prefix:
            return obj.form.prefix
        # For follow-up tasks, the main form is obj.followup_task_form_id
        if obj.followup_task_form_id and obj.followup_task_form_id.prefix:
            return obj.followup_task_form_id.prefix
        return ''

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_assignee_names(self, obj):
        # For followup tasks, return the original assignment list (stable after start_followup deletes TaskAssignee rows)
        if obj.followup_task_form_id_id or obj.follow_task_sub_question_id:
            assignees = []
            seen = set()

            followup_task = obj.followup_task.first() if hasattr(obj, 'followup_task') else None
            if followup_task:
                users = list(followup_task.assigned_users.all()) + list(followup_task.assigned_location_leaders.all())
                groups = list(followup_task.assigned_groups.all())
            else:
                logic_followup = None
                if obj.followup_task_form_id_id and obj.follow_task_sub_question_id:
                    logic_followup = LogicFollowUp.objects.filter(
                        followup_toggle=True,
                        question_id=obj.follow_task_sub_question_id
                    ).filter(
                        Q(form_id=obj.followup_task_form_id_id) |
                        Q(audit_group__form_id=obj.followup_task_form_id_id)
                    ).first()

                users = []
                groups = []
                if logic_followup:
                    user_ids = set(logic_followup.assign_user_ids or [])
                    group_ids = set(logic_followup.assign_group_ids or [])
                    leader_ids = set(logic_followup.assign_leader_ids or [])

                    if logic_followup.user_id:
                        user_ids.add(logic_followup.user_id)
                    if logic_followup.group_id:
                        group_ids.add(logic_followup.group_id)
                    if logic_followup.leader_id:
                        leader_ids.add(logic_followup.leader_id)

                    users = list(CustomUser.objects.filter(id__in=user_ids, organization=obj.organization))
                    users += list(CustomUser.objects.filter(id__in=leader_ids, organization=obj.organization))
                    groups = list(Groups.objects.filter(id__in=group_ids, organization=obj.organization))

            for user in users:
                key = ("user", user.id)
                if key in seen:
                    continue
                seen.add(key)
                name = f"{user.first_name} {user.last_name}".strip() or user.username
                assignees.append({"type": "user", "id": user.id, "name": name})

            for group in groups:
                key = ("group", group.id)
                if key in seen:
                    continue
                seen.add(key)
                assignees.append({"type": "group", "id": group.id, "name": group.name})

            return assignees

        assignees = []
        assignee_qs = obj.assignees.select_related('assigned_user', 'assigned_group')
        for assignee in assignee_qs:
            if assignee.assigned_user:
                name = f"{assignee.assigned_user.first_name} {assignee.assigned_user.last_name}".strip() or assignee.assigned_user.username
                assignees.append({"type": "user", "id": assignee.assigned_user.id, "name": name})
            elif assignee.assigned_group:
                assignees.append({"type": "group", "id": assignee.assigned_group.id, "name": assignee.assigned_group.name})
        return assignees

    def get_main_form_submission_id(self, obj):
        submission = self._get_main_form_submission(obj)
        return submission.id if submission else None

    def get_main_form_location(self, obj):
        submission = self._get_main_form_submission(obj)
        if not submission or not submission.form:
            return None

        # Only show location if the main form actually has a Location question configured
        if not Question.objects.filter(form=submission.form, question_type=QuestionType.LOCATION).exists():
            return None

        location_answer = Answer.objects.filter(
            submission=submission,
            question_type=QuestionType.LOCATION
        ).select_related('location').order_by('-submitted_on').first()

        if not location_answer:
            return None
        if location_answer.location:
            return location_answer.location.name
        if location_answer.answer:
            return location_answer.answer
        if location_answer.other_text:
            return location_answer.other_text
        return None

    def _get_main_form_submission(self, obj):
        if not obj.followup_task_form_id_id:
            return None

        # Use direct FK if available (set during bulk import)
        if hasattr(obj, 'form_submission_id') and obj.form_submission_id:
            return obj.form_submission

        # Fallback for legacy tasks: find by audit log + submission date
        log = TaskAuditLog.objects.filter(
            task=obj,
            task_action__iexact='Followup_Created'
        ).order_by('action_date_time').first()

        if not log or not log.action_by_id:
            return None

        qs = FormSubmision.objects.filter(
            form_id=obj.followup_task_form_id_id,
            submission_initiated_by_id=log.action_by_id,
            organization=obj.organization
        )

        if log.action_date_time:
            candidate = qs.filter(submission_initiated_on__lte=log.action_date_time).order_by('-submission_initiated_on').first()
            return candidate or qs.order_by('-submission_initiated_on').first()

        return qs.order_by('-submission_initiated_on').first()

    def get_remaining_stages(self, obj):
        try:
            from form.models import Stage, StageSubmissionHistory

            # Get all stages for the form, ordered by order
            stages = Stage.objects.filter(form=obj.form, form__organization=obj.organization).order_by('order')

            # Get completed stage orders for this user for this form
            completed_stages = StageSubmissionHistory.objects.filter(
                form_submission__form=obj.form,
                completed_by=self.context['request'].user,
                organization=obj.organization
            ).values_list('stage__order', flat=True).distinct()

            # Remaining stages are those with order > max completed or all if none completed
            if completed_stages:
                max_completed = max(completed_stages)
                remaining = stages.filter(order__gt=max_completed)
            else:
                remaining = stages.all()

            # Return list of remaining stage names or ids
            return [{'id': stage.id, 'name': stage.name, 'order': stage.order} for stage in remaining]
        except Exception as e:
            # Return empty list on any error to prevent API failures
            return []

    def get_has_started(self, obj):
        # Check if user has started working on this specific task
        # by checking if there are any tracking records for this user and task
        return obj.tracking_records.filter(
            assignee_user=self.context['request'].user
        ).exists()

    def get_assigned_form_id(self, obj):
        """
        Return follow-up / assigned form ID safely
        For tasks with assigned form (obj.form), return obj.form.id
        For followup tasks without assigned form, return followup_task_form_id.id
        """
        if obj.form:
            return obj.form.id
        elif obj.followup_task_form_id:
            return obj.followup_task_form_id.id
        return None

    def get_followup_task_form_id(self, obj):
        """
        Return the follow-up task form ID
        This is the form assigned specifically for follow-up task completion
        """
        if obj.followup_task_form_id:
            return obj.followup_task_form_id.id
        return None

    def _get_planner_assignment(self, obj):
        """
        Trace back from Task to PlannerAssignment via PlannerSubmission.
        Chain: Task → followup_task_form_id → FormSubmission → PlannerSubmission → PlannerAssignment
        """
        if not (obj.followup_task_form_id_id or obj.follow_task_sub_question_id):
            return None
        main_sub = self._get_main_form_submission(obj)
        if not main_sub:
            return None
        from planner.models import PlannerSubmission
        ps = PlannerSubmission.objects.filter(
            form_submission=main_sub,
            planner_assignment__organization=obj.organization
        ).select_related('planner_assignment', 'planner_assignment__folder').first()
        if ps:
            return ps.planner_assignment
        return None

    def get_source(self, obj):
        """Determine if the task came from a planner, a form follow-up, or was manually created."""
        if obj.followup_task_form_id_id or obj.follow_task_sub_question_id:
            pa = self._get_planner_assignment(obj)
            if pa:
                return 'planner'
            return 'form_followup'
        if obj.form_id:
            return 'form'
        return 'manual'

    def get_planner_id(self, obj):
        """Return the planner assignment order ID if this task originated from a planner."""
        pa = self._get_planner_assignment(obj)
        if pa:
            return pa.order_id or str(pa.id)
        return None

    def get_planner_name(self, obj):
        """Return the planner name if this task originated from a planner."""
        pa = self._get_planner_assignment(obj)
        if pa:
            return pa.planner_name
        return None

    def get_planner_folder_name(self, obj):
        """Return the planner folder name if this task originated from a planner."""
        pa = self._get_planner_assignment(obj)
        if pa and pa.folder:
            return pa.folder.name
        return None

    def get_planner_folder_color(self, obj):
        """Return the planner folder color if this task originated from a planner."""
        pa = self._get_planner_assignment(obj)
        if pa and pa.folder:
            return pa.folder.color
        return None

    def get_task_age_days(self, obj):
        """Return the age of the task in days from creation date."""
        if not obj.created_on:
            return None
        delta = timezone.now() - obj.created_on
        return delta.days

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError("End date must be after start date.")

        # Check if form belongs to user's organization
        form = attrs.get('form')
        if form and hasattr(self.context.get('request'), 'user'):
            if form.organization != self.context['request'].user.organization:
                raise serializers.ValidationError("Form does not belong to your organization.")

        return attrs

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)

        # Create audit log for general task updates
        request = self.context.get('request')
        if request and request.user:
            # Note: Due date extension logging is now handled only in the dedicated extend_due_date endpoint
            # All general updates (including end_date changes) log as "updated"
            TaskAuditLog.objects.create(
                task=instance,
                task_action='updated',
                action_by=request.user
            )

        return instance

class TaskCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating tasks with assignees"""
    task_id = serializers.ReadOnlyField(source='id')
    assignees = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    assigned_form_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    followup_task_form_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Task
        fields = [
            'task_id', 'task_name', 'description', 'form', 'start_date', 'end_date', 'assignees', 'assigned_form_id', 'followup_task_form_id'
        ]
        read_only_fields = ['task_id']
    
    # def validate(self, attrs):
    #     """Ensure form is provided for regular tasks (not follow-up tasks)"""
    #     # For regular task creation, form is required
    #     # Follow-up tasks are created separately and will have form=None, followup_task_form_id populated
    #     if not attrs.get('form') and not attrs.get('followup_task_form_id'):
    #         raise serializers.ValidationError("Either 'form' (for regular tasks) or 'followup_task_form_id' (for follow-up tasks) must be provided.")
        
    #     # Regular tasks should have form, not followup_task_form_id
    #     if attrs.get('form') and attrs.get('followup_task_form_id'):
    #         raise serializers.ValidationError("Cannot set both 'form' and 'followup_task_form_id'. Use 'form' for regular tasks.")
        
    #     return attrs

    def validate_assignees(self, assignees):
        """Validate that assignees belong to the same organization"""
        request = self.context.get('request')
        if not request or not request.user:
            return assignees

        organization = request.user.organization

        for assignee_data in assignees:
            user_id = assignee_data.get('user_id')
            group_id = assignee_data.get('group_id')

            if user_id and group_id:
                raise serializers.ValidationError("Cannot assign both user and group in single assignee record.")

            if not user_id and not group_id:
                raise serializers.ValidationError("Either user_id or group_id must be provided.")

            if user_id:
                try:
                    user = CustomUser.objects.get(id=user_id, organization=organization)
                except CustomUser.DoesNotExist:
                    raise serializers.ValidationError(f"User with id {user_id} not found in your organization.")

            if group_id:
                try:
                    group = Groups.objects.get(id=group_id, organization=organization)
                except Groups.DoesNotExist:
                    raise serializers.ValidationError(f"Group with id {group_id} not found in your organization.")

        return assignees

    @transaction.atomic
    def create(self, validated_data):

        assignees_data = validated_data.pop('assignees', [])
        assigned_form_id = validated_data.pop('assigned_form_id', None)
        followup_task_form_id = validated_data.pop('followup_task_form_id', None)
        request = self.context.get('request')

        # Handle followup_task_form_id: if provided directly, use it
        if followup_task_form_id is not None:
            try:
                followup_form = Form.objects.get(
                    id=followup_task_form_id,
                    organization=request.user.organization,
                    is_deleted=False,
                    is_archived=False
                )
                validated_data['followup_task_form_id'] = followup_form
            except Form.DoesNotExist:
                raise serializers.ValidationError(f"Followup form with id {followup_task_form_id} not found.")

        # Handle assigned_form_id: if provided (for backward compatibility), store in followup_task_form_id
        elif assigned_form_id is not None:
            try:
                assigned_form = Form.objects.get(
                    id=assigned_form_id,
                    organization=request.user.organization,
                    is_deleted=False,
                    is_archived=False
                )
                validated_data['followup_task_form_id'] = assigned_form
                # Remove form field if assigned_form_id is used
                validated_data.pop('form', None)
            except Form.DoesNotExist:
                raise serializers.ValidationError(f"Form with id {assigned_form_id} not found.")

        # Create the task
        task = Task.objects.create(**validated_data)

        # Create audit log
        TaskAuditLog.objects.create(task=task, task_action='created', action_by=request.user)

        # Create assignees
        for assignee_data in assignees_data:
            user_id = assignee_data.get('user_id')
            group_id = assignee_data.get('group_id')

            TaskAssignee.objects.create(
                task=task,
                assigned_user=user_id if user_id else None,
                assigned_group=group_id if group_id else None,
                assigned_date_time=timezone.now()
            )

        # Create stage assignments for ALL remaining stages of todo forms
        # This ensures users can see all pending stages immediately after task assignment
        try:
            # Get all stages for the form (remaining stages)
            all_stages = Stage.objects.filter(
                form=task.form,
                form__is_deleted=False,
                form__is_archived=False,
                form__organization=task.organization
            ).order_by('order')

            if all_stages.exists():
                print(f"Creating stage assignments for task {task.id}, all stages: {all_stages.count()} stages")

                # Create stage assignments for all task assignees and all remaining stages
                for assignee_data in assignees_data:
                    user_id = assignee_data.get('user_id')
                    group_id = assignee_data.get('group_id')

                    if user_id:
                        # Create stage assignments for all stages for individual user
                        for stage in all_stages:
                            StageAssignment.objects.create(
                                form=task.form,
                                stage=stage,
                                stage_order=stage.order,
                                user=user_id,
                                assignment_uuid=str(uuid.uuid4()),
                                organization=task.organization,
                                assigned_by=request.user,
                                assigned_on=timezone.now(),
                                task=task,  # Link to the originating task
                            )
                            print(f"Created stage assignment for user {user_id} on stage {stage.id} (order {stage.order})")

                    elif group_id:
                        # For group assignments, create stage assignments for all group members and all stages
                        group = Groups.objects.get(id=group_id, organization=task.organization)
                        for member in group.members.filter(organization=task.organization):
                            for stage in all_stages:
                                StageAssignment.objects.create(
                                    form=task.form,
                                    stage=stage,
                                    stage_order=stage.order,
                                    user=member,
                                    assignment_uuid=str(uuid.uuid4()),
                                    organization=task.organization,
                                    assigned_by=request.user,
                                    assigned_on=timezone.now(),
                                )
                                print(f"Created stage assignment for group member {member.id} on stage {stage.id} (order {stage.order})")

        except Exception as e:
            # Log error but don't fail task creation
            print(f"Error creating stage assignments for task {task.id}: {str(e)}")
            logger.error(f"Error creating stage assignments for task {task.id}: {str(e)}")

        return task

class TaskShareSerializer(serializers.Serializer):
    """Serializer for sharing tasks with users/groups"""
    users = serializers.ListField(child=serializers.IntegerField(), required=False)
    groups = serializers.ListField(child=serializers.IntegerField(), required=False)
    send_email = serializers.BooleanField(default=False)

    def validate(self, attrs):
        users = attrs.get('users', [])
        groups = attrs.get('groups', [])

        if not users and not groups:
            raise serializers.ValidationError("At least one user or group must be provided.")

        # Check if users and groups belong to the organization
        request = self.context.get('request')
        if request and request.user:
            organization = request.user.organization

            for user_id in users:
                if not CustomUser.objects.filter(id=user_id, organization=organization).exists():
                    raise serializers.ValidationError(f"User {user_id} not found in your organization.")

            for group_id in groups:
                if not Groups.objects.filter(id=group_id, organization=organization).exists():
                    raise serializers.ValidationError(f"Group {group_id} not found in your organization.")

        return attrs

class TaskUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating task status and tracking"""

    class Meta:
        model = Task
        fields = ['status', 'start_date', 'end_date']
        read_only_fields = ['start_date', 'end_date']  # Only allow status updates through this serializer

class TaskTrackingCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating task tracking records"""

    class Meta:
        model = TaskTracking
        fields = [
            'task', 'assignee_user', 'assignee_group', 'status',
            'actual_start_date', 'actual_end_date', 'comments'
        ]

    def validate(self, attrs):
        task = attrs.get('task')
        assignee_user = attrs.get('assignee_user')
        assignee_group = attrs.get('assignee_group')
        
        # Get request user from context to check group assignments
        request = self.context.get('request')
        user = request.user if request else None

        # Check if the user is actually assigned to this task
        if assignee_user:
            # Check direct assignment
            user_assigned = TaskAssignee.objects.filter(
                task=task,
                assigned_user=assignee_user
            ).exists()
            
            # If not directly assigned, check if user is assigned through a group
            if not user_assigned and user and assignee_user.id == user.id:
                group_assigned = TaskAssignee.objects.filter(
                    task=task,
                    assigned_group__members=user
                ).exists()
                if not group_assigned:
                    raise serializers.ValidationError("User is not assigned to this task.")
            elif not user_assigned:
                raise serializers.ValidationError("User is not assigned to this task.")

        if assignee_group:
            if not TaskAssignee.objects.filter(
                task=task,
                assigned_group=assignee_group
            ).exists():
                raise serializers.ValidationError("Group is not assigned to this task.")

        # Validate dates
        actual_start_date = attrs.get('actual_start_date')
        actual_end_date = attrs.get('actual_end_date')

        if actual_start_date and actual_end_date and actual_start_date >= actual_end_date:
            raise serializers.ValidationError("Actual end date must be after actual start date.")

        return attrs

    def create(self, validated_data):
        # Set status on tracking record based on what's being tracked
        actual_end_date = validated_data.get('actual_end_date')
        actual_start_date = validated_data.get('actual_start_date')
        
        # Get request user from context to handle group assignments
        request = self.context.get('request')
        user = request.user if request else None
        
        # If assignee_group is not provided but user is assigned through group, set it
        task = validated_data.get('task')
        assignee_user = validated_data.get('assignee_user')
        assignee_group = validated_data.get('assignee_group')
        
        if task and user and assignee_user and assignee_user.id == user.id and not assignee_group:
            # Check if user is assigned through a group
            group_assignee = TaskAssignee.objects.filter(
                task=task,
                assigned_group__members=user
            ).first()
            if group_assignee:
                validated_data['assignee_group'] = group_assignee.assigned_group

        if actual_end_date:
            validated_data['status'] = 'completed'
        elif actual_start_date:
            validated_data['status'] = 'in_progress'

        instance = super().create(validated_data)

        # Update task status based on tracking
        task = validated_data.get('task')

        if task and actual_end_date:
            old_status = task.status
            task.status = 'completed'
            task.save()
            # Add audit log for task completion if status changed
            if old_status != 'completed':
                request = self.context.get('request')
                if request and request.user:
                    TaskAuditLog.objects.create(
                        task=task,
                        task_action='Completed',
                        action_by=request.user,
                        action_to=None
                    )
        elif task and actual_start_date:
            task.status = 'in_progress'
            task.save()

        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)

        # Update task status if end_date was added
        if 'actual_end_date' in validated_data and validated_data.get('actual_end_date'):
            instance.task.status = 'completed'
            instance.task.save()

        return instance

class TaskAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for viewing task audit logs"""
    action_by_name = serializers.SerializerMethodField()
    action_to_name = serializers.SerializerMethodField()
    task_name = serializers.CharField(source='task.task_name', read_only=True)
    form_name = serializers.CharField(source='task.form.title', read_only=True)

    class Meta:
        model = TaskAuditLog
        fields = [
            'id', 'task', 'task_name', 'form_name', 'task_action', 'action_by', 'action_by_name',
            'action_to', 'action_to_name', 'action_date_time'
        ]
        read_only_fields = ['id']

    def get_action_by_name(self, obj):
        if obj.action_by:
            return f"{obj.action_by.first_name} {obj.action_by.last_name}".strip() or obj.action_by.username
        return None

    def get_action_to_name(self, obj):
        if obj.action_to:
            return f"{obj.action_to.first_name} {obj.action_to.last_name}".strip() or obj.action_to.username
        return None

class TaskListSerializer(serializers.ModelSerializer):
    """Optimized serializer for listing tasks"""
    form_title = serializers.CharField(source='form.title', read_only=True)
    form_prefix = serializers.SerializerMethodField()
    form_type = serializers.SerializerMethodField()
    has_location_question = serializers.SerializerMethodField()
    form = serializers.PrimaryKeyRelatedField(read_only=True)
    assigned_form_id = serializers.SerializerMethodField()  # For followup tasks - the form to fill
    assigned_form_title = serializers.SerializerMethodField()
    assigned_form_type = serializers.SerializerMethodField()
    followup_task_form_id = serializers.SerializerMethodField()  # For followup tasks - the follow-up form
    followup_form_title = serializers.SerializerMethodField()
    followup_form_type = serializers.SerializerMethodField()
    assignee_count = serializers.SerializerMethodField()
    assignee_names = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    remaining_stages = serializers.SerializerMethodField()
    has_started = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    planner_id = serializers.SerializerMethodField()
    planner_name = serializers.SerializerMethodField()
    task_age_days = serializers.SerializerMethodField()
    main_form_location = serializers.SerializerMethodField()
    parent_question = serializers.SerializerMethodField()
    submission_id = serializers.SerializerMethodField()
    is_auto_closed = serializers.SerializerMethodField()
    is_bulk_imported = serializers.BooleanField(read_only=True)
    start_date = ISTDateTimeField(read_only=True)
    end_date = ISTDateTimeField(read_only=True)
    created_on = ISTDateTimeField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'task_name', 'reopened_remarks', 'form','form_title', 'form_prefix', 'form_type', 'has_location_question', 'assigned_form_id', 'assigned_form_title', 'assigned_form_type', 'followup_task_form_id', 'followup_form_title', 'followup_form_type', 'status',
            'start_date', 'end_date', 'created_on',
            'assignee_count', 'assignee_names', 'created_by_name', 'remaining_stages', 'has_started',
            'source', 'planner_id', 'planner_name', 'task_age_days', 'main_form_location',
            'parent_question', 'submission_id', 'is_auto_closed', 'is_bulk_imported'
        ]
    
    def get_form_prefix(self, obj):
        """Get prefix from the main form that originated this task."""
        if obj.form and obj.form.prefix:
            return obj.form.prefix
        if obj.followup_task_form_id and obj.followup_task_form_id.prefix:
            return obj.followup_task_form_id.prefix
        return ''

    def get_parent_question(self, obj):
        """Get the parent form question that triggered this follow-up task."""
        if obj.follow_task_sub_question:
            return obj.follow_task_sub_question.question
        return None

    def get_form_type(self, obj):
        if obj.form:
            return obj.form.form_type or ''
        if obj.followup_task_form_id:
            return obj.followup_task_form_id.form_type or ''
        return ''

    def _form_has_location_question(self, form):
        if not form:
            return False
        location_form_ids = self.context.get('location_form_ids')
        if location_form_ids is not None:
            return form.id in location_form_ids
        from form.models import Question
        return Question.objects.filter(form=form, question_type='location').exists()

    def get_has_location_question(self, obj):
        if obj.form and self._form_has_location_question(obj.form):
            return True
        if obj.followup_task_form_id and self._form_has_location_question(obj.followup_task_form_id):
            return True
        return False

    def get_assigned_form_title(self, obj):
        if obj.form:
            return obj.form.title or ''
        return ''

    def get_assigned_form_type(self, obj):
        if obj.form:
            return obj.form.form_type or ''
        return ''

    def get_followup_form_title(self, obj):
        if obj.followup_task_form_id:
            return obj.followup_task_form_id.title or ''
        return ''

    def get_followup_form_type(self, obj):
        if obj.followup_task_form_id:
            return obj.followup_task_form_id.form_type or ''
        return ''

    def get_assigned_form_id(self, obj):
        """Return the assigned form ID for followup tasks (the form user needs to fill)"""
        # For tasks with assigned form (obj.form), return obj.form.id
        # For followup tasks without assigned form, return followup_task_form_id.id
        if obj.form:
            return obj.form.id
        elif obj.followup_task_form_id:
            return obj.followup_task_form_id.id
        return None
    
    def get_followup_task_form_id(self, obj):
        """Return the follow-up task form ID"""
        if obj.followup_task_form_id:
            return obj.followup_task_form_id.id
        return None

    def _get_main_form_submission(self, obj):
        if not obj.followup_task_form_id_id:
            return None

        # Use direct FK if available (set during bulk import)
        if hasattr(obj, 'form_submission_id') and obj.form_submission_id:
            return obj.form_submission

        # Fallback for legacy tasks: find by audit log + submission date
        log = TaskAuditLog.objects.filter(
            task=obj,
            task_action__iexact='Followup_Created'
        ).order_by('action_date_time').first()
        if not log or not log.action_by_id:
            return None
        qs = FormSubmision.objects.filter(
            form_id=obj.followup_task_form_id_id,
            submission_initiated_by_id=log.action_by_id,
            organization=obj.organization
        )
        if log.action_date_time:
            candidate = qs.filter(submission_initiated_on__lte=log.action_date_time).order_by('-submission_initiated_on').first()
            return candidate or qs.order_by('-submission_initiated_on').first()
        return qs.order_by('-submission_initiated_on').first()

    def get_submission_id(self, obj):
        """Return the form submission ID that triggered this task (shown in web form responses table)."""
        submission = self._get_main_form_submission(obj)
        return submission.id if submission else None

    def _get_root_planner(self, obj):
        """Resolve the root planner assignment for a task via its main form submission."""
        if not (obj.followup_task_form_id_id or obj.follow_task_sub_question_id):
            return None
        main_sub = self._get_main_form_submission(obj)
        if not main_sub:
            return None
        from planner.models import PlannerAssignment, PlannerSubmission
        ps = PlannerSubmission.objects.filter(
            form_submission=main_sub
        ).select_related('planner_assignment').first()
        if ps and ps.planner_assignment:
            return ps.planner_assignment
        root_time = main_sub.completed_on or main_sub.submission_initiated_on
        candidates_qs = PlannerAssignment.objects.filter(
            form_id=obj.followup_task_form_id_id,
            organization=obj.organization,
            is_completed=True,
            completed_by_id=main_sub.submission_initiated_by_id,
            completed_on__isnull=False
        ).exclude(order_id__isnull=True)
        if not root_time:
            return candidates_qs.order_by('-completed_on').first()
        candidates = list(candidates_qs)
        if not candidates:
            return None
        best = min(candidates, key=lambda pa: abs((pa.completed_on - root_time).total_seconds()))
        if abs((best.completed_on - root_time).total_seconds()) <= 60:
            return best
        return None

    def get_source(self, obj):
        if obj.followup_task_form_id_id or obj.follow_task_sub_question_id:
            pa = self._get_root_planner(obj)
            if pa:
                return 'planner'
            return 'form_followup'
        if obj.form_id:
            return 'form'
        return 'manual'

    def get_planner_id(self, obj):
        pa = self._get_root_planner(obj)
        if pa:
            return pa.order_id or str(pa.id)
        return None

    def get_planner_name(self, obj):
        pa = self._get_root_planner(obj)
        if pa:
            return pa.planner_name
        return None

    def get_task_age_days(self, obj):
        if not obj.created_on:
            return None
        delta = timezone.now() - obj.created_on
        return delta.days

    def get_main_form_location(self, obj):
        # For followup tasks, get location from the main form submission
        submission = self._get_main_form_submission(obj)
        if submission:
            return self._extract_location_from_submission(submission)

        # For regular form tasks (source='form'), try to get location from
        # the task's own form submissions
        if obj.form_id:
            latest_submission = FormSubmision.objects.filter(
                form_id=obj.form_id,
                organization=obj.organization
            ).order_by('-submission_initiated_on').first()
            if latest_submission:
                return self._extract_location_from_submission(latest_submission)

        return None

    def _extract_location_from_submission(self, submission):
        if not submission or not submission.form:
            return None
        if not Question.objects.filter(form=submission.form, question_type=QuestionType.LOCATION).exists():
            return None
        location_answer = Answer.objects.filter(
            submission=submission,
            question_type=QuestionType.LOCATION
        ).select_related('location').order_by('-submitted_on').first()
        if not location_answer:
            return None
        if location_answer.location:
            return location_answer.location.name
        if location_answer.answer:
            return location_answer.answer
        if location_answer.other_text:
            return location_answer.other_text
        return None

    def get_is_auto_closed(self, obj):
        return TaskAuditLog.objects.filter(
            task=obj,
            task_action='Auto_Closed_Related_Task'
        ).exists()

    def get_assignee_count(self, obj):
        return obj.assignees.count()

    def get_assignee_names(self, obj):
        # For followup tasks, return the original assignment list (stable after start_followup deletes TaskAssignee rows)
        if obj.followup_task_form_id_id or obj.follow_task_sub_question_id:
            assignees = []
            seen = set()

            followup_task = obj.followup_task.first() if hasattr(obj, 'followup_task') else None
            if followup_task:
                users = list(followup_task.assigned_users.all()) + list(followup_task.assigned_location_leaders.all())
                groups = list(followup_task.assigned_groups.all())
            else:
                logic_followup = None
                if obj.followup_task_form_id_id and obj.follow_task_sub_question_id:
                    logic_followup = LogicFollowUp.objects.filter(
                        followup_toggle=True,
                        question_id=obj.follow_task_sub_question_id
                    ).filter(
                        Q(form_id=obj.followup_task_form_id_id) |
                        Q(audit_group__form_id=obj.followup_task_form_id_id)
                    ).first()

                users = []
                groups = []
                if logic_followup:
                    user_ids = set(logic_followup.assign_user_ids or [])
                    group_ids = set(logic_followup.assign_group_ids or [])
                    leader_ids = set(logic_followup.assign_leader_ids or [])

                    if logic_followup.user_id:
                        user_ids.add(logic_followup.user_id)
                    if logic_followup.group_id:
                        group_ids.add(logic_followup.group_id)
                    if logic_followup.leader_id:
                        leader_ids.add(logic_followup.leader_id)

                    users = list(CustomUser.objects.filter(id__in=user_ids, organization=obj.organization))
                    users += list(CustomUser.objects.filter(id__in=leader_ids, organization=obj.organization))
                    groups = list(Groups.objects.filter(id__in=group_ids, organization=obj.organization))

            for user in users:
                key = ("user", user.id)
                if key in seen:
                    continue
                seen.add(key)
                name = f"{user.first_name} {user.last_name}".strip() or user.username
                assignees.append({"type": "user", "id": user.id, "name": name})

            for group in groups:
                key = ("group", group.id)
                if key in seen:
                    continue
                seen.add(key)
                assignees.append({"type": "group", "id": group.id, "name": group.name})

            return assignees

        assignees = []
        assignee_qs = obj.assignees.select_related('assigned_user', 'assigned_group')
        for assignee in assignee_qs:
            if assignee.assigned_user:
                name = f"{assignee.assigned_user.first_name} {assignee.assigned_user.last_name}".strip() or assignee.assigned_user.username
                assignees.append({"type": "user", "id": assignee.assigned_user.id, "name": name})
            elif assignee.assigned_group:
                assignees.append({"type": "group", "id": assignee.assigned_group.id, "name": assignee.assigned_group.name})
        return assignees

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_remaining_stages(self, obj):
        from form.models import Stage, StageSubmissionHistory, StageAssignment

        # Get all stages for the form, ordered by order
        stages = Stage.objects.filter(form=obj.form, form__organization=obj.organization).order_by('order')

        # If form has only 1 stage, don't show remaining stages (single stage form)
        if stages.count() <= 1:
            return []

        # Check if this task has stage assignments (todo workflow)
        stage_assignments = StageAssignment.objects.filter(
            task=obj,
            user=self.context['request'].user
        )

        if stage_assignments.exists():
            # For todo workflows, use stage assignment completion status
            completed_stages = stage_assignments.filter(
                is_assignment_fullfilled=True
            ).values_list('stage_order', flat=True)

            # Remaining stages are those with order > max completed or all if none completed
            if completed_stages:
                max_completed = max(completed_stages)
                remaining = stages.filter(order__gt=max_completed)
            else:
                remaining = stages.all()
        else:
            # Use existing logic for regular forms
            completed_stages = StageSubmissionHistory.objects.filter(
                form_submission__form=obj.form,
                completed_by=self.context['request'].user,
                organization=obj.organization
            ).values_list('stage__order', flat=True).distinct()

            # Remaining stages are those with order > max completed or all if none completed
            if completed_stages:
                max_completed = max(completed_stages)
                remaining = stages.filter(order__gt=max_completed)
            else:
                remaining = stages.all()

        # Return list of remaining stage names or ids
        return [{'id': stage.id, 'name': stage.name, 'order': stage.order} for stage in remaining]

    def get_has_started(self, obj):
        # Check if user has started working on this specific task
        # by checking if there are any tracking records for this user and task
        return obj.tracking_records.filter(
            assignee_user=self.context['request'].user
        ).exists()
