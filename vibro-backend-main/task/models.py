from django.db import models
from django.utils import timezone
from user.models import CustomUser, Groups, Organization
from form.models import Form, Question, FormSubmision
from vibro.models import BaseModel

class TaskStatus(models.TextChoices):
    NOT_STARTED = 'not_started', 'Not Started'
    NOT_ASSIGNED = 'not_assigned', 'Not Assigned'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'

class Task(models.Model):
    task_name = models.TextField()
    description = models.TextField(null=True, blank=True)
    reopened_remarks = models.TextField(null=True, blank=True)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, db_column='form_id', null=True, blank=True, help_text="Main form ID (null for follow-up tasks)")
    # Follow-up task specific columns
    followup_task_form_id = models.ForeignKey(Form, on_delete=models.CASCADE, db_column='followup_task_form_id', null=True, blank=True, related_name='followup_task_forms', help_text="Follow-up task assigned form ID")
    follow_task_sub_question = models.ForeignKey(Question, on_delete=models.CASCADE, db_column='follow_task_sub_question_id', null=True, blank=True, related_name='followup_sub_questions', help_text="Sub-question that triggered the follow-up task")
    form_submission = models.ForeignKey(FormSubmision, on_delete=models.SET_NULL, db_column='form_submission_id', null=True, blank=True, related_name='tasks', help_text="The form submission that triggered this followup task")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column='organization_id')
    status = models.CharField(max_length=255, default='not_assigned')
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='task_created_by')
    created_on = models.DateTimeField(default=timezone.now)
    updated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='task_updated_by')
    updated_on = models.DateTimeField(null=True, blank=True)
    is_bulk_imported = models.BooleanField(default=False, db_index=True, help_text="True if task was created via bulk import, False if from normal app flow")

    class Meta:
        db_table = 'task_details'

class TaskAssignee(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, db_column='task_id', related_name='assignees')
    assigned_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True, db_column='assigned_user_id', related_name='task_assigned_users')
    assigned_group = models.ForeignKey(Groups, on_delete=models.CASCADE, null=True, blank=True, db_column='assigned_group_id', related_name='task_assigned_groups')
    assigned_leader = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True, db_column='assigned_leader_id', related_name='task_assigned_leaders', help_text="Location leader assigned to the task")
    assigned_date_time = models.DateTimeField()

    class Meta:
        db_table = 'task_assignees'

class TaskTracking(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, db_column='task_id', related_name='tracking_records')
    assignee_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, db_column='assignee_user_id', related_name='task_tracking_users')
    assignee_group = models.ForeignKey(Groups, on_delete=models.CASCADE, null=True, blank=True, db_column='assignee_group_id', related_name='task_tracking_groups')
    status = models.CharField(max_length=255, null=True, blank=True)
    actual_start_date = models.DateTimeField(null=True, blank=True)
    actual_end_date = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'task_tracking'

class TaskAuditLog(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='audit_logs')
    task_action = models.CharField(max_length=255)
    action_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_task_actions')
    action_to = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_task_actions')
    action_date_time = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'task_audit_log'