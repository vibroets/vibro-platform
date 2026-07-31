from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from vibro.user_context import get_current_user
from user.models import Organization

CustomUser = get_user_model()

class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey( CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="%(class)s_created")
    updated_by = models.ForeignKey( CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="%(class)s_updated")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="%(class)s_organization")

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        user = get_current_user()
        if not self.pk:
            if user:
                self.created_by = self.created_by or user
                if not self.organization_id:
                    self.organization = getattr(user, 'organization', None)
                    
        else:
            self.updated_at = timezone.now()
            if user:
                self.updated_by = user
        super().save(*args, **kwargs)