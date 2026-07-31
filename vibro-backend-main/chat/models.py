from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class ChatGroup(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(
        'user.Organization',
        on_delete=models.CASCADE,
        related_name='chat_groups',
        null=True, blank=True
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='created_chat_groups',
        null=True
    )
    members = models.ManyToManyField(
        User,
        related_name='chat_groups',
        blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name


class GroupRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    topic = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='group_requests'
    )
    proposed_members = models.ManyToManyField(
        User,
        related_name='proposed_group_requests',
        blank=True
    )
    organization = models.ForeignKey(
        'user.Organization',
        on_delete=models.CASCADE,
        related_name='group_requests',
        null=True, blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='reviewed_group_requests',
        null=True, blank=True
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_chat_group = models.ForeignKey(
        ChatGroup,
        on_delete=models.SET_NULL,
        related_name='source_request',
        null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.topic} - {self.requested_by.username} ({self.status})"


class ChatMessage(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('voice', 'Voice'),
        ('file', 'File'),
        ('image', 'Image'),
        ('video', 'Video'),
        ('system', 'System'),
    ]

    group = models.ForeignKey(
        ChatGroup,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='chat_messages'
    )
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPES,
        default='text'
    )
    content = models.TextField(blank=True, null=True)
    attachment = models.FileField(upload_to='chat_attachments/', blank=True, null=True)
    attachment_name = models.CharField(max_length=255, blank=True, null=True)
    duration = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content or self.attachment_name or ''} [{self.message_type}]"


class MessageReadStatus(models.Model):
    message = models.ForeignKey(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name='read_statuses'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='read_messages'
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')
