from django.db import models
from django.utils import timezone
from user.models import CustomUser, Groups, Organization, LocationLeader
import os, uuid
from datetime import date


def video_file_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f"lt_videos/{uuid.uuid4().hex}{ext}"


def training_file_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f"lt_training_items/{uuid.uuid4().hex}{ext}"

class LearningCourse(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("draft", "Draft"),
        ("archived", "Archived"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    video_url = models.URLField(help_text="Final playable URL (e.g. Cinema8 or YouTube)")
    duration = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. '10 mins'")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="learning_courses")
    
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="learning_courses_created")
    created_on = models.DateTimeField(default=timezone.now)
    updated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="learning_courses_updated")
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "learning_course"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class LearningCourseAssignment(models.Model):
    COMPLETION_STATUS_CHOICES = [
        ("assigned", "Assigned"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("overdue", "Overdue"), # Added useful status
    ]

    course = models.ForeignKey(LearningCourse, on_delete=models.CASCADE, related_name="assignments")
    
    # Target Audience
    assigned_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name="learning_course_assignments")
    assigned_group = models.ForeignKey(Groups, on_delete=models.CASCADE, null=True, blank=True, related_name="learning_course_assignments")
    assigned_location_leader = models.ForeignKey(LocationLeader, on_delete=models.CASCADE, null=True, blank=True, related_name="learning_course_assignments")
    
    # --- NEW FIELDS (Replicating Task Logic) ---
    start_date = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    # -------------------------------------------
    
    assigned_on = models.DateTimeField(default=timezone.now)
    
    # Tracking
    completion_status = models.CharField(max_length=20, choices=COMPLETION_STATUS_CHOICES, default="assigned")
    completed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="learning_courses_completed")
    completed_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "learning_course_assignment"
        verbose_name = "Learning Course Assignment"
        verbose_name_plural = "Learning Course Assignments"
        # Optional: Prevent assigning same course to same user multiple times?
        # unique_together = ('course', 'assigned_user')

    def __str__(self):
        target = (self.assigned_user or self.assigned_group or (self.assigned_location_leader.user if self.assigned_location_leader else None))
        return f"{self.course.title} -> {target}"


class Quiz(models.Model):
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    questions = models.JSONField(default=list)
    questions_per_user = models.IntegerField(default=15)
    time_limit = models.IntegerField(default=30, help_text="Minutes")
    pass_percentage = models.FloatField(default=70)
    certificate_enabled = models.BooleanField(default=True)
    certificate_validity_value = models.IntegerField(default=1)
    certificate_validity_unit = models.CharField(max_length=20, default='year')
    access_mode = models.CharField(max_length=20, default='permanent')
    reassign_on_fail = models.BooleanField(default=False)
    reschedule_days = models.IntegerField(default=7)
    allow_skip_questions = models.BooleanField(default=False)
    selected_users = models.JSONField(default=list, blank=True)
    selected_groups = models.JSONField(default=list, blank=True)
    selected_locations = models.JSONField(default=list, blank=True)
    is_draft = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="quizzes")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="quizzes_created")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_quiz"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class VideoContent(models.Model):
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    video_source = models.CharField(max_length=20, default='url', help_text='url or upload')
    video_file = models.FileField(upload_to=video_file_upload_path, blank=True, null=True)
    duration = models.CharField(max_length=50, blank=True, null=True)
    questions = models.JSONField(default=list, blank=True)
    questions_per_user = models.IntegerField(default=15)
    time_limit = models.IntegerField(default=30, help_text="Minutes")
    pass_percentage = models.FloatField(default=70)
    allow_skip_questions = models.BooleanField(default=False)
    certificate_enabled = models.BooleanField(default=False)
    certificate_validity_value = models.IntegerField(default=1)
    certificate_validity_unit = models.CharField(max_length=20, default='year')
    access_mode = models.CharField(max_length=20, default='permanent')
    reassign_on_fail = models.BooleanField(default=False)
    reschedule_days = models.IntegerField(default=7)
    selected_users = models.JSONField(default=list, blank=True)
    selected_groups = models.JSONField(default=list, blank=True)
    selected_locations = models.JSONField(default=list, blank=True)
    is_draft = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="video_contents")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="videos_created")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_video"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class TrainingItem(models.Model):
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    content_url = models.URLField(blank=True, null=True)
    asset_type = models.CharField(max_length=20, default='document', help_text='document, video, image')
    source_type = models.CharField(max_length=20, default='url', help_text='url or upload')
    file_url = models.URLField(blank=True, null=True)
    file = models.FileField(upload_to=training_file_upload_path, blank=True, null=True)
    allow_download = models.BooleanField(default=False)
    allow_print = models.BooleanField(default=False)
    allow_share = models.BooleanField(default=False)
    follow_up_type = models.CharField(max_length=20, blank=True, null=True, help_text='quiz, video, training')
    follow_up_id = models.CharField(max_length=100, blank=True, null=True)
    questions = models.JSONField(default=list, blank=True)
    questions_per_user = models.IntegerField(default=15)
    time_limit = models.IntegerField(default=30, help_text="Minutes")
    pass_percentage = models.FloatField(default=70)
    allow_skip_questions = models.BooleanField(default=False)
    certificate_enabled = models.BooleanField(default=False)
    certificate_validity_value = models.IntegerField(default=1)
    certificate_validity_unit = models.CharField(max_length=20, default='year')
    access_mode = models.CharField(max_length=20, default='permanent')
    reassign_on_fail = models.BooleanField(default=False)
    reschedule_days = models.IntegerField(default=7)
    selected_users = models.JSONField(default=list, blank=True)
    selected_groups = models.JSONField(default=list, blank=True)
    selected_locations = models.JSONField(default=list, blank=True)
    is_draft = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="training_items")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="training_items_created")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_training_item"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class TrainingSchedule(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    title = models.CharField(max_length=500)
    code = models.CharField(max_length=100, blank=True, null=True)
    category = models.CharField(max_length=255, blank=True, null=True)
    training_type = models.CharField(max_length=20, default='classroom', help_text='classroom, online, hybrid, on-the-job')
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    time_zone = models.CharField(max_length=50, default='UTC')
    grace_time = models.IntegerField(default=15, help_text="Minutes")
    recurring = models.BooleanField(default=False)
    repeat_pattern = models.CharField(max_length=20, default='none')
    venue_name = models.CharField(max_length=255, blank=True, null=True)
    venue_id = models.CharField(max_length=100, blank=True, null=True)
    venue_type = models.CharField(max_length=30, blank=True, null=True)
    trainer_name = models.CharField(max_length=255, blank=True, null=True)
    trainer_id = models.CharField(max_length=100, blank=True, null=True)
    trainer_type = models.CharField(max_length=20, blank=True, null=True)
    department = models.CharField(max_length=255, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    capacity = models.IntegerField(default=20)
    objectives = models.TextField(blank=True, null=True)
    learning_outcomes = models.TextField(blank=True, null=True)
    duration = models.CharField(max_length=50, blank=True, null=True)
    sessions = models.IntegerField(default=1)
    lt_content_ids = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    approval_type = models.CharField(max_length=20, default='none', help_text="none, single-stage, multi-stage")
    approval_chain = models.JSONField(default=list, blank=True, help_text="List of {level, approver_id, approver_name}")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="training_schedules")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="trainings_created")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_training_schedule"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class Trainer(models.Model):
    TYPE_CHOICES = [
        ("internal", "Internal"),
        ("external", "External"),
        ("co-trainer", "Co-Trainer"),
        ("guest-speaker", "Guest Speaker"),
    ]

    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="internal")
    department = models.CharField(max_length=255, blank=True, null=True)
    expertise = models.TextField(blank=True, null=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    availability = models.JSONField(default=dict)
    bio = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="trainers")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_trainer"
        ordering = ["-created_on"]

    def __str__(self):
        return self.name


class Venue(models.Model):
    TYPE_CHOICES = [
        ("training-room", "Training Room"),
        ("meeting-hall", "Meeting Hall"),
        ("conference-room", "Conference Room"),
        ("virtual", "Virtual"),
    ]

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="training-room")
    location = models.CharField(max_length=255, blank=True, null=True)
    building = models.CharField(max_length=255, blank=True, null=True)
    floor = models.CharField(max_length=50, blank=True, null=True)
    capacity = models.IntegerField(default=20)
    equipment = models.JSONField(default=list)
    amenities = models.JSONField(default=list)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    available = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="venues")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_venue"
        ordering = ["-created_on"]

    def __str__(self):
        return self.name


class Enrollment(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("enrolled", "Enrolled"),
        ("completed", "Completed"),
    ]
    TYPE_CHOICES = [
        ("self", "Self"),
        ("manager", "Manager"),
        ("bulk", "Bulk"),
        ("department", "Department"),
    ]

    content_type = models.CharField(max_length=20, help_text="quiz, video, training")
    content_id = models.CharField(max_length=100)
    content_title = models.CharField(max_length=500, blank=True, null=True)
    enrollment_title = models.CharField(max_length=500, blank=True, null=True)
    participant = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="enrollments")
    enrollment_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="self")
    nominator = models.CharField(max_length=255, blank=True, null=True)
    justification = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    enrollment_date = models.DateField(default=date.today)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    notification_lead_value = models.IntegerField(default=0, help_text="How long before training to notify user")
    notification_lead_unit = models.CharField(max_length=10, default='days', help_text="days, hours, weeks, months")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="enrollments")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_enrollment"
        ordering = ["-created_on"]

    def __str__(self):
        return f"{self.content_title} -> {self.participant}"


class ApprovalRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    TYPE_CHOICES = [
        ("training-request", "Training Request"),
        ("budget-request", "Budget Request"),
        ("participant-request", "Participant Request"),
    ]

    title = models.CharField(max_length=500)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="training-request")
    requested_by = models.CharField(max_length=255)
    department = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    current_level = models.CharField(max_length=50, default="manager")
    approval_levels = models.JSONField(default=list)
    approval_chain = models.JSONField(default=list, blank=True, help_text="List of {level, approver_id, approver_name}")
    training_id = models.CharField(max_length=100, blank=True, null=True)
    training_title = models.CharField(max_length=500, blank=True, null=True)
    expected_outcome = models.TextField(blank=True, null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    justification = models.TextField(blank=True, null=True)
    approval_history = models.JSONField(default=list)
    approved_by = models.CharField(max_length=255, blank=True, null=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.CharField(max_length=255, blank=True, null=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="approval_requests")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_approval_request"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class NotificationTemplate(models.Model):
    TYPE_CHOICES = [
        ("training-created", "Training Created"),
        ("training-modified", "Training Modified"),
        ("training-cancelled", "Training Cancelled"),
        ("training-reminder", "Training Reminder"),
        ("venue-changed", "Venue Changed"),
        ("trainer-changed", "Trainer Changed"),
        ("enrollment-approved", "Enrollment Approved"),
        ("enrollment-rejected", "Enrollment Rejected"),
        ("enrollment-request", "Enrollment Request"),
        ("quiz-assigned", "Quiz Assigned"),
        ("quiz-completed", "Quiz Completed"),
        ("quiz-failed", "Quiz Failed"),
        ("certificate-issued", "Certificate Issued"),
        ("video-assigned", "Video Assigned"),
        ("video-completed", "Video Completed"),
        ("training-completed", "Training Completed"),
        ("approval-request", "Approval Request"),
        ("approval-approved", "Approval Approved"),
        ("approval-rejected", "Approval Rejected"),
    ]
    TRIGGER_CHOICES = [
        ("immediate", "Immediate"),
        ("30-days", "30 Days Before"),
        ("15-days", "15 Days Before"),
        ("7-days", "7 Days Before"),
        ("3-days", "3 Days Before"),
        ("1-day", "1 Day Before"),
        ("1-hour", "1 Hour Before"),
        ("15-minutes", "15 Minutes Before"),
        ("on-completion", "On Completion"),
        ("on-failure", "On Failure"),
    ]

    title = models.CharField(max_length=255)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="training-created")
    trigger = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default="immediate")
    channels = models.JSONField(default=list)
    template = models.TextField(blank=True, null=True)
    enabled = models.BooleanField(default=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="notification_templates")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_notification_template"
        ordering = ["-created_on"]

    def __str__(self):
        return self.title


class TrainingAttendance(models.Model):
    STATUS_CHOICES = [
        ("present", "Present"),
        ("absent", "Absent"),
        ("late", "Late"),
        ("pending", "Pending"),
    ]

    training_id = models.CharField(max_length=100)
    training_title = models.CharField(max_length=500, blank=True, null=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="training_attendances")
    user_name = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_in_method = models.CharField(max_length=50, blank=True, null=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    check_out_method = models.CharField(max_length=50, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="training_attendances")
    created_on = models.DateTimeField(default=timezone.now)
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lt_training_attendance"
        ordering = ["-created_on"]

    def __str__(self):
        return f"{self.training_title} - {self.user_name}"


class QuizResult(models.Model):
    content_type = models.CharField(max_length=20, help_text="quiz, video, training")
    content_id = models.IntegerField()
    content_title = models.CharField(max_length=500, blank=True, null=True)
    schedule_id = models.IntegerField(null=True, blank=True, help_text="TrainingSchedule id if this result was taken as part of a training schedule")
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="quiz_results")
    user_name = models.CharField(max_length=255, blank=True, null=True)
    score = models.FloatField(default=0)
    correct_answers = models.IntegerField(default=0)
    total_questions = models.IntegerField(default=0)
    time_taken = models.IntegerField(default=0, help_text="Seconds")
    answers = models.JSONField(default=list, blank=True)
    questions = models.JSONField(default=list, blank=True)
    pass_percentage = models.FloatField(default=70)
    status = models.CharField(max_length=20, default='pending', help_text="passed, failed, pending")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="quiz_results")
    completed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "lt_quiz_result"
        ordering = ["-completed_at"]

    def __str__(self):
        return f"{self.content_title} - {self.user_name} - {self.score}%"


class Certificate(models.Model):
    certificate_number = models.CharField(max_length=100, unique=True)
    result = models.OneToOneField(QuizResult, on_delete=models.CASCADE, related_name="certificate")
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="certificates")
    user_name = models.CharField(max_length=255, blank=True, null=True)
    user_department = models.CharField(max_length=255, blank=True, null=True)
    quiz_id = models.IntegerField()
    quiz_title = models.CharField(max_length=500, blank=True, null=True)
    training_type = models.CharField(max_length=50, blank=True, null=True)
    score = models.FloatField(default=0)
    pass_percentage = models.FloatField(default=70)
    issued_at = models.DateTimeField()
    expires_at = models.DateTimeField(null=True, blank=True)
    validity_value = models.IntegerField(default=1)
    validity_unit = models.CharField(max_length=20, default="years")
    status = models.CharField(max_length=20, default="active")
    organization_name = models.CharField(max_length=255, default="VIBRO Learning, Training & Development")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="certificates", null=True, blank=True)

    class Meta:
        db_table = "lt_certificate"
        ordering = ["-issued_at"]

    def __str__(self):
        return f"{self.certificate_number} - {self.user_name}"


class LTDraft(models.Model):
    draft_type = models.CharField(max_length=20, help_text="quiz, video, training")
    title = models.CharField(max_length=500, default="(Untitled)")
    description = models.TextField(blank=True, null=True)
    payload = models.JSONField(default=dict)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="lt_drafts")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="lt_drafts")
    saved_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "lt_draft"
        ordering = ["-saved_at"]

    def __str__(self):
        return f"{self.draft_type}: {self.title}"


class NotificationLog(models.Model):
    NOTIF_TYPES = [
        ("training-created", "Training Created"),
        ("training-modified", "Training Modified"),
        ("training-cancelled", "Training Cancelled"),
        ("training-reminder", "Training Reminder"),
        ("training-completed", "Training Completed"),
        ("venue-changed", "Venue Changed"),
        ("trainer-changed", "Trainer Changed"),
        ("enrollment-approved", "Enrollment Approved"),
        ("enrollment-rejected", "Enrollment Rejected"),
        ("enrollment-request", "Enrollment Request"),
        ("quiz-assigned", "Quiz Assigned"),
        ("quiz-completed", "Quiz Completed"),
        ("quiz-failed", "Quiz Failed"),
        ("certificate-issued", "Certificate Issued"),
        ("video-assigned", "Video Assigned"),
        ("video-completed", "Video Completed"),
        ("approval-request", "Approval Request"),
        ("approval-approved", "Approval Approved"),
        ("approval-rejected", "Approval Rejected"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="lt_notifications")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="lt_notifications")
    notif_type = models.CharField(max_length=30, choices=NOTIF_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, null=True)
    content_type = models.CharField(max_length=20, blank=True, null=True, help_text="quiz, video, training-schedule")
    content_id = models.CharField(max_length=50, blank=True, null=True)
    content_title = models.CharField(max_length=500, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "lt_notification_log"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notif_type} - {self.title} - {self.user.username}"