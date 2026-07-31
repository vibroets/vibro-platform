from django.db import models
from django.utils import timezone
from user.models import CustomUser, Groups, Organization

class AnnouncementCategory(models.Model):
    name = models.CharField(max_length=250, unique=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column='organization_id')
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='category_created_by')
    created_on = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'announcement_category'
        verbose_name_plural = 'Announcement Categories'

    def __str__(self):
        return self.name


class Announcement(models.Model):
    title = models.TextField()
    announcement_category = models.CharField(max_length=250)
    announcement_start_date = models.DateTimeField()
    announcement_end_date = models.DateTimeField()
    pin_as_important = models.BooleanField(default=False)
    request_acknowledge = models.BooleanField(default=False)
    prevent_download = models.BooleanField(default=False)
    announcement_content = models.TextField()
    announcement_tags = models.TextField(blank=True, null=True)
    announcement_attachments = models.TextField(blank=True, null=True)
    announcement_attachments_urls = models.TextField(blank=True, null=True)
    announcement_fullscreen = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column='organization_id')
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='announcement_created_by')
    created_on = models.DateTimeField(default=timezone.now)
    updated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='announcement_updated_by')
    updated_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'announcement_details'


class AnnouncementShareInfo(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, db_column='announcement_id')
    sent_to_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True, db_column='announcement_sent_to_users', related_name='announcement_shares_user')
    sent_to_group = models.ForeignKey(Groups, on_delete=models.CASCADE, null=True, blank=True, db_column='announcement_sent_to_groups', related_name='announcement_shares_group')
    share_status = models.CharField(max_length=300, default='sent', choices=[('sent', 'Sent'), ('viewed', 'Viewed'), ('acknowledged', 'Acknowledged'), ('notified', 'Notified'), ('liked', 'Liked')], db_column='announcement_share_status')
    sent_timestamp = models.DateTimeField(default=timezone.now, db_column='announcement_sent_timestamp')
    acknowledged = models.BooleanField(default=False, db_column='announcement_acknowledged')
    acknowledged_timestamp = models.DateTimeField(null=True, blank=True, db_column='announcement_acknowledged_timestamp')
    viewed_timestamp = models.DateTimeField(null=True, blank=True, db_column='announcement_viewed_timestamp')
    liked = models.BooleanField(default=False, db_column='announcement_liked')

    class Meta:
        db_table = 'announcement_share_info'
