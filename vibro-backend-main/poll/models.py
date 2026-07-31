from django.db import models
from django.utils import timezone
from user.models import CustomUser, Groups, Organization


class Poll(models.Model):
    CATEGORY_CHOICES = [
        ("Employee Engagement", "Employee Engagement"),
        ("Operations", "Operations"),
        ("HR", "HR"),
        ("Safety", "Safety"),
        ("Training", "Training"),
        ("Events", "Events"),
        ("General", "General"),
    ]

    POLL_TYPE_CHOICES = [
        ("Single Choice", "Single Choice"),
        ("Multiple Choice", "Multiple Choice"),
        ("Rating Scale (1-5)", "Rating Scale (1-5)"),
        ("Yes/No", "Yes/No"),
        ("Open Text", "Open Text"),
        ("Emoji Reaction", "Emoji Reaction"),
    ]

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, choices=CATEGORY_CHOICES, default="General")
    poll_type = models.CharField(max_length=50, choices=POLL_TYPE_CHOICES, default="Single Choice")
    thumbnail = models.TextField(blank=True, null=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    anonymous = models.BooleanField(default=False)
    allow_multiple_responses = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column='organization_id')
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='polls_created')
    created_on = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'poll_details'
        ordering = ['-created_on']

    def __str__(self):
        return self.title


class PollQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ("multiple-choice", "Single Choice"),
        ("checkbox", "Multiple Choice"),
        ("rating", "Rating Scale (1-5)"),
        ("yes-no", "Yes/No"),
        ("text", "Open Text"),
        ("emoji", "Emoji Reaction"),
    ]

    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=50, choices=QUESTION_TYPE_CHOICES, default="multiple-choice")
    options = models.JSONField(default=list, blank=True)
    required = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'poll_questions'
        ordering = ['order']

    def __str__(self):
        return f"{self.poll.title} - Q{self.order}"


class PollShare(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='shares')
    sent_to_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='poll_shares_received')
    sent_to_group = models.ForeignKey(Groups, on_delete=models.CASCADE, null=True, blank=True, related_name='poll_shares_group')
    sent_to_location = models.ForeignKey('user.Locations', on_delete=models.CASCADE, null=True, blank=True, related_name='poll_shares_location')
    share_status = models.CharField(max_length=50, default='sent', choices=[('sent', 'Sent'), ('viewed', 'Viewed'), ('submitted', 'Submitted')])
    sent_timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'poll_shares'

    def __str__(self):
        return f"Poll {self.poll_id} -> {self.sent_to_user or self.sent_to_group or self.sent_to_location}"


class PollResponse(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='responses')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='poll_responses')
    question = models.ForeignKey(PollQuestion, on_delete=models.CASCADE, related_name='responses')
    answer_text = models.TextField(blank=True, null=True)
    answer_value = models.IntegerField(blank=True, null=True)
    answer_options = models.JSONField(default=list, blank=True)
    submitted_on = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'poll_responses'
        ordering = ['-submitted_on']

    def __str__(self):
        return f"Response by {self.user_id} on {self.poll_id}"
