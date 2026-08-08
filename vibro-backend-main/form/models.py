from django.db import models
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from user.models import CustomUser, Groups, Divisions, Locations, Organization
from vibro.models import BaseModel
from django.utils.translation import gettext_lazy as _

# Choises
class FormType(models.TextChoices):
    STANDARD = 'standard', 'Standard'
    LOCATION = 'location', 'Location'
    AUDIT = 'audit', 'Audit'

    
class FormAssignType(models.TextChoices):
    USER = 'user', 'User'
    GROUP = 'group', 'Group'
    LOCATION_LEADER = 'leader', 'Location Leader'


class QuestionType(models.TextChoices):
    AUDIT = 'audit', 'Audit'
    TABLE = 'table', 'Table'
    LOCATION = 'location', 'Location'
    DIVISION = 'division', 'Division'
    SUB_DIVISION = 'sub_division', 'Sub Division'
    TITLE_AND_DESCRIPTION = 'title_and_description', 'Title and Description'
    SHORT_ANSWER = 'short_answer', 'Short Answer'
    LONG_ANSWER = 'long_answer', 'Long Answer'
    MULTIPLE_CHOICE = 'multiple_choice', 'Multiple Choice'
    CHECKBOXES = 'checkboxes', 'Checkboxes'
    DROPDOWN = 'dropdown', 'Dropdown'
    LINEAR_SCALE = 'linear_scale', 'Linear Scale'
    DATETIME = 'datetime', 'Datetime'
    DATE = 'date', 'Date'
    TIME = 'time', 'Time'
    SIGNATURE = 'signature', 'Signature'
    UPLOAD_IMAGE = 'upload_image', 'Upload Image'
    UPLOAD_VIDEO = 'upload_video', 'Upload Video'
    UPLOAD_FILE = 'upload_file', 'Upload File'
    QR_CODE = 'qr_code', 'QR Code'
    FORMULA = 'formula', 'Formula'
    USER = 'user', 'User'


class StageAccessType(models.TextChoices):
    USER = 'user', 'Specific User'
    GROUP = 'group', 'Specific Group'
    PREVIOUS_STAGE = 'previous_stage', 'Previous Stage'
    ORGANIZATION = 'organization', 'Anyone in the Organization'



class Folder(BaseModel):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subfolders', db_column='parentid')

    class Meta:
        unique_together = ('name', 'organization', 'parent')



class Form(BaseModel):
    form_type = models.CharField(max_length=20, choices=FormType.choices)
    title = models.CharField(max_length=255)
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL)
    prefix = models.CharField(max_length=255, null=True, blank=True)
    GPS = models.BooleanField(default=False)
    trigger_email_notifications = models.BooleanField(default=False)
    share_response = models.BooleanField(default=False)
    allow_editing = models.BooleanField(default=False)
    can_edit_previous_state = models.BooleanField(default=False)
    auto_share_response = models.BooleanField(default=False)
    pass_percentage = models.BigIntegerField(null=True, blank=True)
    max_score = models.BigIntegerField(null=True, blank=True)
    form_admin = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="form_admin")

    is_deleted = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    is_disabled = models.BooleanField(default=False)
    last_deleted_date = models.DateTimeField(blank=True, null=True)
    last_archived_date = models.DateTimeField(blank=True, null=True)
    deletedBy = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, related_name='deleted_form', blank=True, null=True)
    archivedBy = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, related_name='archived_form', blank=True, null=True)
    
    class Meta:
        db_table = 'form_master'
        # unique_together = ('form_type', 'title', 'organization')
        
    def save(self, *args, **kwargs):
        if self.is_archived and not self.last_archived_date:
            self.last_archived_date = timezone.now()
        elif not self.is_archived:
            self.last_archived_date = None
        
        if self.is_deleted and not self.last_deleted_date:
            self.last_deleted_date = timezone.now()
        elif not self.is_deleted:
            self.last_deleted_date = None
        super().save(*args, **kwargs)
      
        
class Stage(BaseModel):
    name = models.CharField(max_length=255)
    stage_uuid = models.CharField(max_length=255)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="stages")
    order = models.PositiveIntegerField(default=1)
    is_completed = models.BooleanField(default=False, null=False)
        
    class Meta:
        ordering = ['order']
        unique_together = ('form', 'stage_uuid', 'name', 'organization')
        indexes = [models.Index(fields=['form'])]


class StageAccess(models.Model):
    access_type = models.CharField(max_length=255, choices=StageAccessType.choices)
    allow_stage = models.CharField(max_length=255, null=True, blank=True)
    allow_user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL)
    allow_group = models.ForeignKey(Groups, null=True, blank=True, on_delete=models.SET_NULL)
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name="access_parent_stage", null=True, blank=True)
    form = models.ForeignKey(Form, on_delete=models.CASCADE)
    stage_approvals = models.BooleanField(default=False)
    
    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(access_type=StageAccessType.USER, allow_user__isnull=False) |
                    models.Q(access_type=StageAccessType.GROUP, allow_group__isnull=False) |
                    models.Q(access_type=StageAccessType.PREVIOUS_STAGE, allow_stage__isnull=False) |
                    models.Q(access_type=StageAccessType.ORGANIZATION, allow_user__isnull=True, allow_group__isnull=True, allow_stage__isnull=True)
                ),
                name="valid_access_rule_type"
            )
        ]

    def __str__(self):
        return f"{self.access_type} access for form {self.form.title}"


class AuditInfo(BaseModel):
    name = models.CharField(max_length=255)
    form = models.OneToOneField(Form, on_delete=models.CASCADE, related_name="audit_info")
    group_uuid = models.CharField(max_length=255)
    
    class Meta:
        unique_together = ('form', 'name')


class AuditGroup(BaseModel):
    name = models.CharField(max_length=255)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="audit_group")
    order = models.PositiveIntegerField(default=1)
    group_uuid = models.CharField(max_length=255)
    class Meta:
        unique_together = ('form', 'name')
        ordering = ['order']
 
    
class Question(BaseModel):
    QUESTION_SUB_TYPE_CHOICES = [('text', 'Text'), ('number', 'Number')]
    form = models.ForeignKey(Form, on_delete=models.CASCADE)
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='questions', null=True, blank=True)
    audit_info = models.ForeignKey(AuditInfo, on_delete=models.CASCADE, null=True, blank=True, related_name="questions")
    audit_group = models.ForeignKey(AuditGroup, on_delete=models.CASCADE, null=True, blank=True, related_name="questions")
    question_uuid = models.CharField(max_length=255, default='default_uuid')
    question = models.TextField();
    description = models.TextField(null=True, blank=True)
    critical = models.BooleanField(default=False)
    formula = models.CharField(max_length=255, null=True, blank=True)
    question_type = models.CharField(max_length=30, choices=QuestionType.choices)
    question_sub_type = models.CharField(max_length=255, choices=QUESTION_SUB_TYPE_CHOICES, null=True, blank=True)
    question_hint = models.TextField(null=True, blank=True)
    parent_question = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='child_questions')
    order = models.PositiveIntegerField(default=1)
    is_required = models.BooleanField(default=False)
    require_live = models.BooleanField(default=False)
    number_of_file_allowed = models.BigIntegerField(null=True, blank=True)
    min_value = models.BigIntegerField(null=True, blank=True)
    max_value = models.BigIntegerField(null=True, blank=True)
    max_score =  models.BigIntegerField(null=True, blank=True)
    is_logic_question = models.BooleanField(default=False)
    is_task_close_question = models.BooleanField(default=False)
    is_audit_info_question = models.BooleanField(default=False)
    is_other = models.BooleanField(default=False)
    reference_images = models.JSONField(null=True, blank=True, default=list)
    reference_videos = models.JSONField(null=True, blank=True, default=list)
    
    class Meta:
        ordering = ['order']
        unique_together = ('form', 'stage', 'question_uuid', 'question_type', 'organization')
        indexes = [
            models.Index(fields=['form']),
            models.Index(fields=['stage']),
            models.Index(fields=['parent_question']),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return self.question

    
class Option(BaseModel):
    option = models.CharField(max_length=255)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    score = models.PositiveIntegerField(null=True, blank=True, default=0)
    failed = models.BooleanField(default=False)
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE,  null=True, blank=True, related_name='options',)
    audit_info = models.ForeignKey(AuditInfo, on_delete=models.CASCADE, null=True, blank=True, related_name='options')
    audit_group = models.ForeignKey(AuditGroup, on_delete=models.CASCADE, null=True, blank=True, related_name="options")
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name='options')
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']
        unique_together = ('question', 'option')
        indexes = [
            models.Index(fields=['form']),
            models.Index(fields=['stage']),
            models.Index(fields=['question']),
        ]

    def clean(self):
        if self.question.question_type not in [QuestionType.DROPDOWN, QuestionType.AUDIT, QuestionType.CHECKBOXES, QuestionType.MULTIPLE_CHOICE, QuestionType.LINEAR_SCALE]:
            raise ValidationError("Options can only be added to Dropdown, Checkbox, Multiple Choice, Linear Scale a questions.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.option

# class ComparisonChoices(models.TextChoices):
#     EQUALS = "equals", "Equals"
#     GREATER_THAN = "greater_than", "Greater Than"
#     LESS_THAN = "less_than", "Less Than"
#     GREATER_THAN_OR_EQUAL = "greater_than_or_equal", "Greater Than or Equal"
#     LESS_THAN_OR_EQUAL = "less_than_or_equal", "Less Than or Equal"

class Logic(BaseModel):
    LOGIC_TYPE_CHOICES = [('is', 'IS'), ('is_not', 'IS NOT')]
    COMPARISON_CHOICES = [
    ('equals', 'Equals'),
    ('greater_than', 'Greater Than'),
    ('less_than', 'Less Than'),
    ('greaterthan_or_equalto', 'Greater Than or Equal To'),
    ('lessthan_or_equalto', 'Less Than or Equal To'),
    ]

    logic_type = models.CharField(max_length=255, choices=LOGIC_TYPE_CHOICES)
    comparison = models.CharField(
        max_length=50,
        choices=COMPARISON_CHOICES,
        null=True,
        blank=True
    )
    logic_value = models.CharField(max_length=255)
    notification = models.BooleanField(default=False)
    user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL)
    group = models.ForeignKey(Groups, null=True, blank=True, on_delete=models.SET_NULL)
    email = models.CharField(max_length=255, null=True, blank=True)
    order = models.PositiveIntegerField(default=1)
    form = models.ForeignKey(Form, on_delete=models.CASCADE)
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, null=True, blank=True,)
    audit_info = models.ForeignKey(AuditInfo, on_delete=models.CASCADE, null=True, blank=True, )
    audit_group = models.ForeignKey(AuditGroup, on_delete=models.CASCADE, null=True, blank=True,)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="logic_parent_question")
    logic_questions = models.ManyToManyField(Question, related_name='logic_child_questions')
    
    class Meta:
        ordering = ['order']
        unique_together = ('form', 'stage', 'audit_info', 'audit_group', 'logic_type', 'logic_value')
        indexes = [
            models.Index(fields=['form']),
            models.Index(fields=['stage']),
            models.Index(fields=['question']),
        ]   


class LogicFollowUp(models.Model):
    ASSIGN_TO_CHOICES = [('form_submitter', 'Form Submiiter'), ('user', 'User'), ('group', 'Group'), ('leader', 'Location Leader')]
    logic = models.ForeignKey(Logic, on_delete=models.CASCADE, related_name="follow_ups")
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    deadline = models.BigIntegerField()
    assign_form = models.ForeignKey(Form, null=True, blank=True, on_delete=models.SET_NULL, related_name="assign_form")
    assign_to = models.CharField(max_length=255, choices=ASSIGN_TO_CHOICES)
    user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL)
    group = models.ForeignKey(Groups, null=True, blank=True, on_delete=models.SET_NULL)
    leader = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="logic_followup_leader")
    # JSON fields to store multiple user IDs and group IDs from assignUsers/assignGroups/assignLeaders
    assign_user_ids = models.JSONField(default=list, blank=True, help_text="List of user IDs from assignUsers")
    assign_group_ids = models.JSONField(default=list, blank=True, help_text="List of group IDs from assignGroups")
    assign_leader_ids = models.JSONField(default=list, blank=True, help_text="List of leader user IDs from assignLeaders")
    followup_toggle = models.BooleanField(default=False, help_text="Toggle to enable/disable followup for this logic")
    form = models.ForeignKey(Form, on_delete=models.CASCADE)
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE,  null=True, blank=True,)
    audit_info = models.ForeignKey(AuditInfo, on_delete=models.CASCADE, null=True, blank=True,)
    audit_group = models.ForeignKey(AuditGroup, on_delete=models.CASCADE, null=True, blank=True,)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="follow_up_parent_question")
    task_close_questions = models.ManyToManyField(Question, related_name='follow_up_task_close_child_questions')

    def __str__(self):
        return f"Follow-up: {self.title} (Form: {self.form.title})"
    
    class Meta:
        indexes = [
            models.Index(fields=['form']),
            models.Index(fields=['stage']),
            models.Index(fields=['question']),
        ]


class FormAssignment(models.Model):
    assign_type = models.CharField(max_length=30, choices=FormAssignType.choices)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="assignee")
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="user_assigned_forms")
    group = models.ForeignKey(Groups, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_forms")
    leader = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="leader_assigned_forms")
    form_shared_on = models.DateTimeField(default=timezone.now)

    def __str__(self):
        assignee = self.user or self.group or self.leader or "Unassigned"
        return f"{self.assign_type} - Form: {self.form.title} -> Assigned to: {assignee}"
    

class FormSubmision(models.Model):
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="submissions")
    submission_initiated_stage = models.ForeignKey(Stage, on_delete=models.CASCADE, null=True, blank=True, related_name="submissions")
    submission_initiated_on = models.DateTimeField(auto_now_add=True)
    submission_initiated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="submissions")
    is_completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="completed_submissions")
    completed_on = models.DateTimeField(null=True, blank=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="submissions")
    is_bulk_imported = models.BooleanField(default=False, help_text="True if this submission was created via the bulk import responses feature")
    
    def __str__(self):
        return f"Submission by {self.submission_initiated_by.username} for {self.form.title} on {self.submission_initiated_on} for stage {self.submission_initiated_stage.name if self.submission_initiated_stage else 'N/A'}"


class Answer(models.Model):
    Form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="answers")
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, null=True, blank=True, related_name="answers")
    # group = models.ForeignKey(AuditGroup, on_delete=models.CASCADE, null=True, blank=True, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    question_type = models.CharField(max_length=30, choices=QuestionType.choices)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="answers", null=True, blank=True)
    division = models.ForeignKey(Divisions, on_delete=models.SET_NULL, null=True, blank=True, related_name="answers_division")
    sub_division = models.ForeignKey(Divisions, on_delete=models.SET_NULL, null=True, blank=True, related_name="answers_subdivision")
    location=models.ForeignKey(Locations, on_delete=models.SET_NULL, null=True, blank=True, related_name="answers")
    answer = models.TextField()
    submitted_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="submitted_answers")
    submitted_on = models.DateTimeField(auto_now_add=True)
    submission = models.ForeignKey(FormSubmision, on_delete=models.CASCADE, related_name="answers")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="answers")
    other_text = models.TextField(null=True, blank=True)
    remarks = models.CharField(max_length=255, null=True, blank=True)
    approved_stages = models.BooleanField(default=False)

    def __str__(self):
        if self.other_text:
            return f"Answer for {self.question.question}: {self.answer} (Other: {self.other_text})"
        return f"Answer for {self.question.question}: {self.answer}"
    
    
class StageAssignment(models.Model):
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="stage_assignments")
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name="stage_assignments")
    stage_order = models.PositiveIntegerField(default=1)
    assignment_uuid = models.CharField(max_length=255)
    is_assignment_fullfilled = models.BooleanField(default=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="stage_assignments")
    assigned_on = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_stages_to_another_user")
    form_submission = models.ForeignKey(FormSubmision, on_delete=models.CASCADE, related_name="stage_assignments", null=True, blank=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="stage_assignments")
    # Add task field to link stage assignments to their originating tasks for todo workflows
    task = models.ForeignKey('task.Task', on_delete=models.CASCADE, null=True, blank=True, related_name="stage_assignments")

    def __str__(self):
        return f"{self.assignment_uuid} - Stage: {self.stage.name} -> Assigned to: {self.user.id}"
    
    
class GroupAssignment(models.Model):
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="group_assignment")
    group = models.ForeignKey(AuditGroup, on_delete=models.CASCADE, related_name="group_assignment")
    group_order = models.PositiveIntegerField(default=1)
    assignment_uuid = models.CharField(max_length=255)
    is_assignment_fullfilled = models.BooleanField(default=False)    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="group_assignment")
    assigned_on = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_groups_to_another_user")
    form_submission = models.ForeignKey(FormSubmision, on_delete=models.CASCADE, related_name="group_assignment", null=True, blank=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="group_assignment")
    
    def __str__(self):
        return f"{self.assign_type} - Stage: {self.stage.name} -> Assigned to: {self.user.id}"


class StageSubmissionHistory(models.Model):
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name="stage_submissions_history")
    stage_order = models.PositiveIntegerField(default=1)
    form_submission = models.ForeignKey(FormSubmision, on_delete=models.CASCADE, related_name="stage_submissions_history")
    stage_assignment_uuid = models.CharField(max_length=255)
    completed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="completed_stage_submissions")
    completed_on = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="stage_submissions_history")
    edited_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="edited_stage_submissions")
    edited_on = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Stage Submission for {self.stage.name} by {self.submission_initiated_by.username} on {self.submission_initiated_on}"
    
    
class AuditFormSubmissionHistory(models.Model):
    form_submission = models.ForeignKey(FormSubmision, on_delete=models.CASCADE, related_name="group_submissions_history")
    group_assignment_uuid = models.CharField(max_length=255)
    completed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="completed_group_submissions")
    completed_on = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="group_submissions_history")
    
    # Audit form score calculation fields
    form_overall_status = models.CharField(max_length=50, null=True, blank=True, help_text="Overall status: PASS/FAIL")
    form_overall_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Overall score percentage")
    form_critical_failed = models.IntegerField(default=0, help_text="Number of critical items failed")
    groups_status = models.CharField(max_length=50, null=True, blank=True, help_text="Group status: passed/failed")
    group_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Group score percentage")
    group_percentage = models.CharField(max_length=50, null=True, blank=True, help_text="Group percentage")
    group_critical_failed = models.IntegerField(default=0, help_text="Number of critical items failed for the group")
    form_id = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="audit_submission_histories", null=True, blank=True, help_text="Reference to the form")
    group_id = models.ForeignKey(AuditGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_submission_histories", help_text="Reference to the audit group")
    
    class Meta:
        db_table = 'form_auditformsubmissionhistory'
        indexes = [
            models.Index(fields=['form_submission']),
            models.Index(fields=['form_id']),
            models.Index(fields=['group_id']),
            models.Index(fields=['organization']),
        ]
    
    def __str__(self):
        form_title = self.form_submission.form.title if self.form_submission and self.form_submission.form else "Unknown Form"
        user_name = self.completed_by.username if self.completed_by else "Unknown User"
        return f"Audit Submission for {form_title} by {user_name} on {self.completed_on}"

class FormResponseShare(BaseModel):
    form_submission = models.ForeignKey(FormSubmision, on_delete=models.CASCADE, related_name='shares')
    shared_to_user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='shared_responses')
    shared_to_group = models.ForeignKey(Groups, null=True, blank=True, on_delete=models.SET_NULL, related_name='shared_responses_groups')
    shared_to_leader = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='shared_responses_leaders')  # For location leaders
    shared_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='shares_made')
    shared_on = models.DateTimeField(auto_now_add=True)
    share_type = models.CharField(max_length=20, choices=[('user', 'User'), ('group', 'Group'), ('location_leader', 'Location Leader')])

class FormAutoShareConfig(models.Model):
    form = models.OneToOneField(Form, on_delete=models.CASCADE, related_name='auto_share_config')
    users = models.ManyToManyField(CustomUser, blank=True, related_name='auto_shared_forms')
    groups = models.ManyToManyField(Groups, blank=True, related_name='auto_shared_forms')
    location_leaders = models.ManyToManyField(CustomUser, blank=True, related_name='auto_shared_leader_forms')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)

    class Meta:
        db_table = 'form_auto_share_config'

class FollowUpTaskStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    REOPENED = 'reopened', 'Reopened'
    EXPIRED = 'expired', 'Expired'


class FollowUpTask(BaseModel):
    # Title and description removed - now stored in task_details table
    deadline_days = models.IntegerField(default=7)
    deadline_at = models.DateTimeField(null=True, blank=True)  # Calculated deadline timestamp
    # Link to task_details table for task module integration
    task_details = models.ForeignKey('task.Task', on_delete=models.CASCADE, related_name='followup_task', null=True, blank=True, help_text="Corresponding entry in task_details table")
    # Source form (main form that has the logic)
    main_form_submission = models.ForeignKey('FormSubmision',on_delete=models.CASCADE,related_name='followup_tasks',null=True,blank=True,help_text="The main form submission that triggered this follow-up")
    main_form_stage = models.ForeignKey('Stage',on_delete=models.CASCADE,related_name='triggered_followups',null=True,blank=True,help_text="Stage that triggered this follow-up")
    main_form_question = models.ForeignKey('Question',on_delete=models.CASCADE,related_name='triggered_followups', null=True,blank=True,help_text="Question that triggered this follow-up")
    logic = models.ForeignKey('Logic',on_delete=models.CASCADE,related_name='followup_tasks',null=True,blank=True,help_text="Logic that triggered this follow-up")
    # Assigned form (the follow-up form to be filled)
    assigned_form = models.ForeignKey('Form',on_delete=models.CASCADE,related_name='followup_assigned_tasks',null=True,blank=True,help_text="The form that needs to be filled as follow-up")
    # Assignment - users/groups/location leaders that can access this follow-up
    assigned_users = models.ManyToManyField('user.CustomUser',blank=True,related_name='assigned_followup_tasks',help_text="Users assigned to complete this follow-up")
    assigned_groups = models.ManyToManyField('user.Groups',blank=True,related_name='group_assigned_followup_tasks',help_text="Groups assigned to complete this follow-up")
    assigned_location_leaders = models.ManyToManyField('user.CustomUser',blank=True,related_name='leader_assigned_followup_tasks',help_text="Location leaders assigned to complete this follow-up")
    status = models.CharField( max_length=20,choices=FollowUpTaskStatus.choices,default=FollowUpTaskStatus.PENDING)
    # Who started this task (locks it for other assignees)
    started_by = models.ForeignKey('user.CustomUser',null=True,blank=True,on_delete=models.SET_NULL,related_name='started_followup_tasks',help_text="User who started working on this follow-up task")
    started_at = models.DateTimeField(null=True, blank=True)
    # Completion details
    completed_by = models.ForeignKey('user.CustomUser',null=True, blank=True,on_delete=models.SET_NULL,related_name='completed_followup_tasks',help_text="User who completed this follow-up task")
    completed_at = models.DateTimeField(null=True, blank=True)
    followup_submission = models.ForeignKey('FormSubmision',null=True, blank=True,on_delete=models.SET_NULL,related_name='followup_source_task',help_text="The submission created for this follow-up form")
    # Task close questions (for reopening)
    task_close_questions = models.ManyToManyField('Question',related_name='followup_task_close_questions',blank=True, help_text="Questions to ask when reopening the task")
    # Reopening tracking
    reopened_by = models.ForeignKey('user.CustomUser',null=True,blank=True,on_delete=models.SET_NULL,related_name='reopened_followup_tasks',help_text="User who last reopened this follow-up task")
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopened_remarks = models.TextField(null=True, blank=True)
    # Nested follow-ups - link to parent follow-up if this is a sub-followup
    parent_followup = models.ForeignKey('self',null=True,blank=True,on_delete=models.CASCADE,related_name='nested_followups',help_text="Parent follow-up task if this is a nested follow-up")    


    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['deadline_at']),
            models.Index(fields=['main_form_submission']),
        ]

    def is_expired(self):
        """Check if task is past its deadline"""
        if not self.deadline_at:
            return False
        return timezone.now() > self.deadline_at

    def get_assigned_users_list(self):
        """Get all users assigned to this task (from users, groups, and location leaders)"""
        users = list(self.assigned_users.all())

        for group in self.assigned_groups.all():
            users.extend(group.members.all())
        
        # Add location leaders
        users.extend(self.assigned_location_leaders.all())

        # Remove duplicates while preserving order
        seen = set()
        unique_users = []
        for user in users:
            if user.id not in seen:
                seen.add(user.id)
                unique_users.append(user)

        return unique_users

    def start_task(self, user):
        """Start the task by the given user, locking it for others"""
        if self.status != FollowUpTaskStatus.PENDING:
            raise ValidationError("Task is not in pending status")

        if user not in self.get_assigned_users_list():
            raise ValidationError("User not assigned to this task")

        # Lock the task for this user
        self.started_by = user
        self.started_at = timezone.now()
        self.status = FollowUpTaskStatus.IN_PROGRESS
        self.save()

        return self

    def complete_task(self, user, followup_submission=None):
        """Complete the task"""
        if self.started_by != user:
            raise ValidationError("Only the user who started the task can complete it")

        self.completed_by = user
        self.completed_at = timezone.now()
        self.followup_submission = followup_submission
        self.status = FollowUpTaskStatus.COMPLETED
        self.save()

        return self

    def reopen_task(self, user, remarks=None):
        """Reopen the task, making it available to all assignees again"""
        self.status = FollowUpTaskStatus.REOPENED
        self.started_by = None  # Remove lock
        self.started_at = None
        self.reopened_by = user
        self.reopened_at = timezone.now()
        self.reopened_remarks = remarks
        self.save()

        return self

    def clean(self):
        # Validate that all related objects belong to the same organization
        if self.organization_id:
            if self.main_form_submission.organization_id != self.organization_id:
                raise ValidationError("Main form submission must belong to the same organization")
            if self.assigned_form.organization_id != self.organization_id:
                raise ValidationError("Assigned form must belong to the same organization")
            if self.logic and self.logic.organization_id != self.organization_id:


                raise ValidationError("Logic must belong to the same organization")


class FollowUpTaskResponse(models.Model):
    """Model to track responses to follow-up tasks - stores actual form submission data"""
    task = models.ForeignKey('FollowUpTask',on_delete=models.CASCADE,related_name='responses')
    form_submission = models.ForeignKey('FormSubmision',on_delete=models.CASCADE,related_name='followup_task_responses',null=True,blank=True,help_text="The actual form submission for this follow-up task")
    response_data = models.JSONField(help_text="Response data for the task (answers summary)")
    submitted_by = models.ForeignKey('user.CustomUser',on_delete=models.CASCADE,related_name='followup_responses')
    submitted_at = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey('user.Organization',on_delete=models.CASCADE,related_name='followup_task_responses')

    def __str__(self):
        return f"Response to followup task {self.task.id} by {self.submitted_by.username}"


class TaskCloseQuestion(models.Model):
    """Model to track which questions are assigned to which followup tasks for task close functionality"""
    task = models.ForeignKey('task.Task', on_delete=models.CASCADE, related_name='task_close_questions_link', help_text="The follow-up task this question is assigned to")
    question = models.ForeignKey('Question', on_delete=models.CASCADE, related_name='task_close_assignments', help_text="The task close question")
    created_by = models.ForeignKey('user.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_task_close_assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name='task_close_assignments')

    class Meta:
        unique_together = [('task', 'question')]  # One assignment per question per task
        indexes = [
            models.Index(fields=['task', 'question']),
        ]
        db_table = 'form_taskclosequestion'

    def __str__(self):
        return f"Task close question {self.question.id} assigned to followup task {self.task.id}"


class FollowUpTaskCloseQuestionResponse(models.Model):
    """Model to store answers for task close questions separately - for identification and tracking"""
    task = models.ForeignKey('FollowUpTask',on_delete=models.CASCADE,related_name='task_close_question_responses',help_text="The follow-up task this response belongs to")
    question = models.ForeignKey('Question',on_delete=models.CASCADE,related_name='task_close_responses',help_text="The task close question")
    answer = models.TextField(help_text="Answer to the task close question")
    answer_data = models.JSONField(null=True,blank=True,help_text="Additional answer data (for file uploads, etc.)")
    submitted_by = models.ForeignKey('user.CustomUser',on_delete=models.CASCADE,related_name='task_close_question_responses')
    submitted_at = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey('user.Organization',on_delete=models.CASCADE,related_name='task_close_question_responses')

    class Meta:
        unique_together = [('task', 'question')]  # One answer per question per task
        indexes = [
            models.Index(fields=['task', 'question']),
        ]
        db_table = 'form_followuptaskclosequestionresponse'

    def __str__(self):
        return f"Task close answer for task {self.task.id}, question {self.question.id}"

class FormPayloadFiles(models.Model):
    class Status(models.TextChoices):
        SUCCESS = 'success', _('Success')
        FAILED = 'failed', _('Failed')
        INPROGRESS = 'in_progress', _('In Progress')
    class Method(models.TextChoices):
        POST = 'post', _('POST')
        PUT = 'put', _('PUT')
        DUPLICATE = 'duplicate', _('DUPLICATE')

    form = models.ForeignKey(
        Form, on_delete=models.CASCADE, related_name='payload_files', null=True, blank=True
    )
    title = models.CharField(max_length=255, null=True, blank=True)
    form_type= models.CharField(max_length=255, null=True, blank=True)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='payload_files'
    )
    form_admin = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_payload_files'
    )

    file_path = models.CharField(max_length=1024)
    uploaded_on = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        blank=True,
        null=True
    )
    error_message = models.TextField(blank=True, null=True)
    method = models.CharField(
        max_length=30,
        choices=Method.choices,
        blank=True,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"File for Form ID {self.form.id} | Status: {self.status}"
