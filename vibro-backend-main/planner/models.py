from django.db import models
from django.utils import timezone
from form.models import Form, CustomUser, Groups
from task.models import Task
from user.models import Locations


class PlannerFolder(models.Model):
    """
    Custom folders for organizing planners in the Planner Summary (web admin)
    and Mobile Planner New tab.
    """
    name = models.CharField(max_length=255, help_text="Folder name")
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name="planner_folders")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_planner_folders")
    created_on = models.DateTimeField(auto_now_add=True)
    color = models.CharField(max_length=7, default='#6366F1', help_text="Hex color for folder badge")
    order = models.IntegerField(default=0, help_text="Display order for folder (lower = higher up)")

    class Meta:
        ordering = ['order', 'name']
        unique_together = ['name', 'organization']
        indexes = [
            models.Index(fields=['organization']),
        ]

    def __str__(self):
        return f"{self.name} ({self.organization})"


class PlannerAssignType(models.TextChoices):
    USER = 'user', 'User'
    GROUP = 'group', 'Group'
    LOCATION_LEADER = 'leader', 'Location Leader'


class PlannerAssignment(models.Model):
    """
    Model to track planner assignments to users/groups/leaders.
    This is separate from Task model to distinguish planners from tasks.
    """
    order_id = models.CharField(
        max_length=11,
        null=True,
        blank=True,
        db_index=True,
        help_text="Auto-generated Order ID (e.g., VB000000001)"
    )
    assign_type = models.CharField(max_length=30, choices=PlannerAssignType.choices)
    planner_name = models.CharField(max_length=255, help_text="Name of the planner from bulk upload / Order Type")
    location = models.ForeignKey(
        Locations,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planner_assignments",
        help_text="Location associated with this planner order"
    )
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="planner_assignments")
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="planner_assignments")
    group = models.ForeignKey(Groups, on_delete=models.SET_NULL, null=True, blank=True, related_name="planner_assignments")
    leader = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="leader_planner_assignments")
    planner_shared_on = models.DateTimeField(default=timezone.now)
    start_date = models.DateTimeField(help_text="Start date for the planner")
    end_date = models.DateTimeField(help_text="End date for the planner")
    description = models.TextField(null=True, blank=True, help_text="Description of the planner")
    is_completed = models.BooleanField(default=False, help_text="Whether the user has completed this planner")
    completed_on = models.DateTimeField(null=True, blank=True, help_text="When the planner was completed")
    completed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="completed_planners")
    non_completion_reason = models.TextField(null=True, blank=True, help_text="Reason provided when the planner is not completed by the due date")
    reason_status = models.CharField(max_length=20, default='pending', help_text="Status of the non-completion reason: pending, approved, or rejected")
    rejection_reason = models.TextField(null=True, blank=True, help_text="Admin's feedback when rejecting the non-completion reason, sent back to user for a new reason")
    rejection_questions = models.JSONField(default=list, blank=True, help_text="List of questions created by admin when rejecting, for user to answer")
    rejection_answers = models.JSONField(default=list, blank=True, help_text="User's answers to the rejection questions")
    extended_due_date = models.DateTimeField(null=True, blank=True, help_text="Extended due date set by admin after reviewing non-completion reason")
    extension_note = models.TextField(null=True, blank=True, help_text="Note from admin to user when extending the due date")
    extended_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="extended_planners")
    extended_on = models.DateTimeField(null=True, blank=True, help_text="When the due date was extended")
    started_on = models.DateTimeField(null=True, blank=True, help_text="When the user started the planner")
    started_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="started_planners")
    # Repeat planner fields
    repeat_enabled = models.BooleanField(default=False, help_text="Whether this planner should auto-repeat")
    repeat_interval_days = models.PositiveIntegerField(default=0, help_text="Interval in days before creating the next repeated planner (e.g., 50, 100)")
    early_notification_days = models.PositiveIntegerField(default=0, help_text="Days before start_date to show the planner to users on mobile (e.g., 3)")
    parent_planner = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name="repeated_instances", help_text="Original planner this was repeated from")
    repeat_generation_date = models.DateTimeField(null=True, blank=True, help_text="When the next repeated instance should be generated")
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name="planner_assignments")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_planner_assignments")
    folder = models.ForeignKey(PlannerFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name="planners", help_text="Folder this planner belongs to")
    # Collaborative audit delegation fields
    collaborative_enabled = models.BooleanField(default=False, help_text="Whether this planner supports collaborative group delegation (audit forms via planner only)")
    team_leader = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="team_leader_planners", help_text="The user who can delegate audit groups to team members")

    def __str__(self):
        assignee = self.user or self.group or self.leader or "Unassigned"
        return f"{self.assign_type} - Planner: {self.planner_name} -> Assigned to: {assignee}"

    def save(self, *args, **kwargs):
        if not self.order_id:
            self.order_id = self.generate_order_id()
        super().save(*args, **kwargs)

    @staticmethod
    def generate_order_id():
        prefix = "VB"
        existing_ids = PlannerAssignment.objects.filter(
            order_id__startswith="VB"
        ).values_list("order_id", flat=True)
        max_num = 0
        for order_id in existing_ids:
            if len(order_id) == 11:
                try:
                    num = int(order_id[2:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    continue
        return f"{prefix}{max_num + 1:09d}"

    class Meta:
        indexes = [
            models.Index(fields=['order_id']),
            models.Index(fields=['form']),
            models.Index(fields=['user']),
            models.Index(fields=['group']),
            models.Index(fields=['leader']),
            models.Index(fields=['organization']),
            models.Index(fields=['is_completed']),
        ]


class PlannerSubmission(models.Model):
    """
    Model to track planner submissions (when a user completes a planner).
    This will trigger the creation of follow-up tasks.
    """
    planner_assignment = models.ForeignKey(PlannerAssignment, on_delete=models.CASCADE, related_name="submissions")
    form_submission = models.ForeignKey('form.FormSubmision', on_delete=models.CASCADE, related_name="planner_submissions")
    submitted_on = models.DateTimeField(auto_now_add=True)
    submitted_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="planner_submissions")
    followup_tasks_created = models.BooleanField(default=False, help_text="Whether follow-up tasks have been created from this submission")

    def __str__(self):
        return f"PlannerSubmission - Planner: {self.planner_assignment.planner_name} by {self.submitted_by}"

    class Meta:
        indexes = [
            models.Index(fields=['planner_assignment']),
            models.Index(fields=['form_submission']),
            models.Index(fields=['submitted_by']),
            models.Index(fields=['followup_tasks_created']),
        ]


class PlannerReasonHistory(models.Model):
    """
    Tracks the full history of non-completion reason approval flow.
    Each record represents one cycle: user submits reason -> admin approves or rejects.
    """
    ACTION_SUBMITTED = 'submitted'
    ACTION_REJECTED = 'rejected'
    ACTION_APPROVED = 'approved'
    ACTION_CHOICES = [
        (ACTION_SUBMITTED, 'Submitted'),
        (ACTION_REJECTED, 'Rejected'),
        (ACTION_APPROVED, 'Approved'),
    ]

    planner = models.ForeignKey(PlannerAssignment, on_delete=models.CASCADE, related_name="reason_history")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, help_text="What happened in this cycle")
    non_completion_reason = models.TextField(null=True, blank=True, help_text="User's reason at this point")
    rejection_reason = models.TextField(null=True, blank=True, help_text="Admin's rejection feedback")
    rejection_questions = models.JSONField(default=list, blank=True, help_text="Questions admin asked")
    rejection_answers = models.JSONField(default=list, blank=True, help_text="User's answers to questions")
    extended_due_date = models.DateTimeField(null=True, blank=True, help_text="Extended due date if approved")
    extension_note = models.TextField(null=True, blank=True, help_text="Admin's note if approved")
    acted_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="planner_reason_actions")
    acted_on = models.DateTimeField(default=timezone.now)
    cycle_number = models.IntegerField(default=1, help_text="Which cycle of submit->review this represents")

    def __str__(self):
        return f"PlannerReasonHistory - Planner #{self.planner.id} - Cycle {self.cycle_number} - {self.action}"

    class Meta:
        ordering = ['acted_on']
        indexes = [
            models.Index(fields=['planner']),
            models.Index(fields=['action']),
        ]


class CollaborativeSubmissionStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    IN_PROGRESS = 'in_progress', 'In Progress'
    READY_FOR_REVIEW = 'ready_for_review', 'Ready for Review'
    COMPLETED = 'completed', 'Completed'


class CollaborativeSubmission(models.Model):
    """
    Tracks a collaborative audit submission where a Team Leader delegates
    audit groups to multiple team members. One submission, multiple fillers.
    Only used for audit forms assigned via planner with collaborative_enabled=True.
    """
    planner_assignment = models.ForeignKey(PlannerAssignment, on_delete=models.CASCADE, related_name="collaborative_submissions")
    form_submission = models.ForeignKey('form.FormSubmision', on_delete=models.CASCADE, related_name="collaborative_submissions", null=True, blank=True, help_text="The shared FormSubmision that all group answers attach to")
    team_leader = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="led_collaborative_submissions", help_text="The user assigned as Team Leader who delegates groups")
    status = models.CharField(max_length=30, choices=CollaborativeSubmissionStatus.choices, default=CollaborativeSubmissionStatus.DRAFT, help_text="Current lifecycle status of the collaborative submission")
    created_on = models.DateTimeField(auto_now_add=True)
    started_on = models.DateTimeField(null=True, blank=True, help_text="When the Team Leader started delegation")
    completed_on = models.DateTimeField(null=True, blank=True, help_text="When the Team Leader signed off")
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name="collaborative_submissions")
    participant_users = models.JSONField(default=list, blank=True, help_text="List of user IDs selected as participants during planner creation")
    participant_groups = models.JSONField(default=list, blank=True, help_text="List of group IDs selected as participants during planner creation")

    class Meta:
        indexes = [
            models.Index(fields=['planner_assignment']),
            models.Index(fields=['form_submission']),
            models.Index(fields=['team_leader']),
            models.Index(fields=['status']),
            models.Index(fields=['organization']),
        ]

    def __str__(self):
        return f"CollaborativeSubmission #{self.id} - Planner {self.planner_assignment_id} - {self.status}"


class GroupDelegationStatus(models.TextChoices):
    UNASSIGNED = 'unassigned', 'Unassigned'
    ASSIGNED = 'assigned', 'Assigned'
    IN_PROGRESS = 'in_progress', 'In Progress'
    SUBMITTED = 'submitted', 'Submitted'
    REVIEWED = 'reviewed', 'Reviewed'
    REJECTED = 'rejected', 'Rejected'


class GroupDelegation(models.Model):
    """
    Tracks which audit group is assigned to which user within a collaborative submission.
    Supports both group-level assignment (one user per group) and question-level split
    (multiple users per group, each filling different questions).
    """
    collaborative_submission = models.ForeignKey(CollaborativeSubmission, on_delete=models.CASCADE, related_name="group_delegations")
    audit_group = models.ForeignKey('form.AuditGroup', on_delete=models.CASCADE, related_name="delegations", null=True, blank=True, help_text="The audit group being delegated")
    group_order = models.PositiveIntegerField(default=1, help_text="Order of the group within the form")
    assigned_users = models.ManyToManyField(CustomUser, related_name="assigned_group_delegations", help_text="Users assigned to fill this group")
    assigned_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="delegated_groups", help_text="Team Leader who made the assignment")
    assigned_on = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=30, choices=GroupDelegationStatus.choices, default=GroupDelegationStatus.UNASSIGNED)
    submitted_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="submitted_group_delegations", help_text="User who submitted this group's answers")
    submitted_on = models.DateTimeField(null=True, blank=True)
    reviewed_on = models.DateTimeField(null=True, blank=True, help_text="When Team Leader approved this group")
    rejection_comment = models.TextField(null=True, blank=True, help_text="Team Leader's comment when rejecting a group")
    assigned_question_uuids = models.JSONField(default=list, blank=True, help_text="List of question UUIDs assigned to a specific user (for question-level split). Empty means all questions in the group.")
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name="group_delegations")

    class Meta:
        unique_together = ['collaborative_submission', 'audit_group']
        indexes = [
            models.Index(fields=['collaborative_submission']),
            models.Index(fields=['audit_group']),
            models.Index(fields=['status']),
            models.Index(fields=['organization']),
        ]

    def __str__(self):
        group_name = self.audit_group.name if self.audit_group else "Unknown"
        return f"GroupDelegation - {group_name} - {self.status}"
