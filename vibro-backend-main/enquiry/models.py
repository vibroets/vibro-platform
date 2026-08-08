from django.db import models


class Enquiry(models.Model):
    name = models.CharField(max_length=255)
    organization_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    message = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_contacted = models.BooleanField(default=False)

    class Meta:
        db_table = 'enquiry'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.name} - {self.organization_name}"
