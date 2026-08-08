from django.db import models
from django.conf import settings


class GuideFolder(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, related_name='children', null=True, blank=True)
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name='guide_folders', null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='created_guide_folders', null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'guide_folder'
        ordering = ['name']
        unique_together = ('name', 'parent', 'organization')

    def __str__(self):
        return self.name


class GuideDocument(models.Model):
    DOCUMENT_TYPES = [
        ('sop', 'SOP'),
        ('tutorial', 'Tutorial'),
        ('qap', 'QAP'),
        ('drawing', 'Drawing'),
        ('report', 'Report'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    folder = models.ForeignKey(GuideFolder, on_delete=models.CASCADE, related_name='documents', null=True, blank=True)
    organization = models.ForeignKey('user.Organization', on_delete=models.CASCADE, related_name='guide_documents', null=True, blank=True)
    file = models.FileField(upload_to='guide_documents/')
    file_type = models.CharField(max_length=50, blank=True, null=True)
    file_size = models.BigIntegerField(default=0)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES, default='other')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='uploaded_guides', null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Restriction flags
    allow_download = models.BooleanField(default=True)
    allow_print = models.BooleanField(default=True)
    allow_screenshot = models.BooleanField(default=True)

    class Meta:
        db_table = 'guide_document'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def file_extension(self):
        if not self.file.name:
            return ''
        return self.file.name.rsplit('.', 1)[-1].lower() if '.' in self.file.name else ''


class GuideShare(models.Model):
    SHARE_TYPES = [
        ('user', 'User'),
        ('group', 'Group'),
    ]

    folder = models.ForeignKey(GuideFolder, on_delete=models.CASCADE, related_name='shares', null=True, blank=True)
    document = models.ForeignKey(GuideDocument, on_delete=models.CASCADE, related_name='shares', null=True, blank=True)
    shared_with_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_guide_shares', null=True, blank=True)
    shared_with_group = models.ForeignKey('user.Groups', on_delete=models.CASCADE, related_name='received_guide_shares', null=True, blank=True)
    share_type = models.CharField(max_length=10, choices=SHARE_TYPES, default='user')
    shared_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='shared_guides', null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'guide_share'
        ordering = ['-created_at']

    def __str__(self):
        target = self.shared_with_user or self.shared_with_group
        return f"Shared with {target}"
