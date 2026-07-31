from django.db import models
from user.models import CustomUser
from form.models import AuditInfo
import uuid

class Draft(models.Model):
    # store client-provided draft identifier (integer). Keep existing DB primary key `id`.
    # Use BigIntegerField to accommodate large numeric keys from clients.
    draft_id = models.BigIntegerField(null=True, unique=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    form_id = models.IntegerField()
    s3_key = models.CharField(max_length=255)
    s3_url = models.URLField(max_length=500)
    timestamp = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.JSONField(default=dict, blank=True)

    # New fields for audit data
    form_overall_status = models.CharField(max_length=50, null=True, blank=True)
    form_overall_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    form_critical_failed = models.IntegerField(default=0, null=True, blank=True)
    groups_status = models.CharField(max_length=50, null=True, blank=True)
    group_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    group_percentage = models.CharField(max_length=50, null=True, blank=True)
    group_critical_failed = models.IntegerField(default=0, null=True, blank=True)
    audit_group = models.ForeignKey(AuditInfo, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        # unique_together = ('user', 'form_id')  # one draft per form per user
        unique_together = ('user', 'draft_id')  # draft_id should be unique per user, not globally
