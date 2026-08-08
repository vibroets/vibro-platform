from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.postgres.fields import ArrayField
from django.contrib.auth import get_user_model  # Add this import
import json
import uuid
from .constants import  RULE_BASED_GROUP_FIELDS, RULE_BASED_GROUP_OPERATORS, RULE_BASED_GROUP_CONDITION_TYPES, GROUP_TYPES
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core import validators

class Departments(models.Model):
    organization = models.ForeignKey('organization', on_delete=models.CASCADE, related_name='departments', null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name

class Designations(models.Model):
    organization = models.ForeignKey('organization', on_delete=models.CASCADE, related_name='designations', null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name

class Locations(models.Model):
    organization = models.ForeignKey('organization', on_delete=models.CASCADE, related_name='locations', null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name

class Divisions(models.Model):
    organization = models.ForeignKey('organization', on_delete=models.CASCADE, related_name='divisions', null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name

class SubDivisions(models.Model):
    organization = models.ForeignKey('organization', on_delete=models.CASCADE, related_name='subdivisions', null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name

class Role(models.Model):
    ROLE_CHOICES = [
        ('super_admin', 'Super Admin'),
        ('admin', 'Admin'),
        ('end_user', 'End User'),
        ('location_leader', 'Location Leader'),
    ]
    name = models.CharField(max_length=50, unique=True, choices=ROLE_CHOICES, default='end_user')
    description = models.CharField(max_length=255, blank=True)
    
    def __str__(self):
        return f"{self.get_name_display()} - {self.description}"
    
class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    employee_id = models.CharField(max_length=50, unique=True, blank=True, null=True)

    # New fields from frontend form
    phone = models.CharField(max_length=20, blank=True, null=True, unique=True)
    country_code = models.CharField(max_length=10, blank=True, null=True)
    dashboard_access = models.BooleanField(default=False)
    mobile_supervisor = models.BooleanField(default=False)
    disable = models.BooleanField(default=False)
    designation = models.ForeignKey('Designations', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    location = models.ForeignKey('Locations', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    division = models.ForeignKey('Divisions', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    subdivision = models.ForeignKey('SubDivisions', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    department = models.ForeignKey('Departments', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    role = models.ForeignKey('Role', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    organization = models.ForeignKey('Organization', on_delete=models.PROTECT, related_name='users', blank=True, null=True)
    is_deleted = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    last_deleted_date = models.DateTimeField(blank=True, null=True)
    last_archived_date = models.DateTimeField(blank=True, null=True)
    
    deletedBy = models.ForeignKey('self', on_delete=models.SET_NULL, related_name='deleted_users', blank=True, null=True)
    archivedBy = models.ForeignKey('self', on_delete=models.SET_NULL, related_name='archived_users', blank=True, null=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.username
    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        unique_together = ('id', 'email', 'organization')
    
    # To update last_deleted_date  last_archived_date based on archive and delete
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

class ModulePermisions(models.Model):
    MODULE_CHOICES=[
        ('dashboard', "Dashboard"),
        ('announcements', "Announcements"),
        ('forms','Forms'),
        ('tasks','Tasks'),
        ('polls','Polls'),
        ('learning_training','Learning & Training'),
        ('planner','Planner'),
        ('attendance','Attendance'),
        ('guides','Guides'),
        ('administration','Administration'),
    ]
    ACCESS_CHOICES=[
        ('no_access','No Access'),
        ('full_access','Full Access'),
        ('view_only','View Only Access'),
    ]
    user = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='permission_user', null=True, blank=True)
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='module_permissions', null=True, blank=True)
    module = models.CharField( max_length=20, choices=MODULE_CHOICES, default='dashboard')
    access = models.CharField( max_length=20, choices=ACCESS_CHOICES, default='no_access')
    created_timestamp = models.DateTimeField(auto_now_add=True)

    @property
    def admin_count(self):
        return self.admins.count()
    
    def clean(self):
        # Prevent both user and organization from being set simultaneously
        if self.user and self.organization:
            raise ValidationError("A permission cannot be assigned to both a user and an organization.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    class Meta:
        unique_together = [
            ('user', 'module', 'organization'),
            ('organization', 'module', 'user'),
        ]
        verbose_name = "Module Permission"
        verbose_name_plural = "Module Permissions"

    def __str__(self):
        owner = self.organization.organization_name if self.organization else (self.user.email if self.user else 'Global')
        return f"{owner} - {self.module} - {self.access}"
    
class OTP(models.Model):
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "otp"

    def __str__(self):
        return f"OTP for {self.email}"
    
CustomUser = get_user_model()

class Groups(models.Model):
    MATCH_TYPE_CHOICES = (
        (RULE_BASED_GROUP_CONDITION_TYPES.AND, 'Match All Conditions'),
        (RULE_BASED_GROUP_CONDITION_TYPES.OR, 'Match Any Conditions'),
    )

    TYPE_CHOICES = (
        (GROUP_TYPES.NORMAL, 'Normal'),
        (GROUP_TYPES.RULEBASED, 'RuleBased'),
    )

    name = models.CharField(max_length=255)
    description = models.TextField(max_length=500, blank=True, null=True)
    allow_chat = models.BooleanField(default=False)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Normal')
    members = models.ManyToManyField(CustomUser, related_name='user_groups', blank=True)
    match_type = models.CharField(max_length=10, choices=MATCH_TYPE_CHOICES, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='groups', blank=True, null=True)
    is_deleted = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    last_deleted_date = models.DateTimeField(blank=True, null=True)
    last_archived_date = models.DateTimeField(blank=True, null=True)
    
    deletedBy = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, related_name='deleted_groups', blank=True, null=True)
    archivedBy = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, related_name='archived_groups', blank=True, null=True)
    
    class Meta:
        unique_together = ('name', 'organization')

    def __str__(self):
        return self.name

    # To update last_deleted_date  last_archived_date based on archive and delete
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
        
class GroupsConditions(models.Model):

    OPERATOR_CHOICES = (
        (RULE_BASED_GROUP_OPERATORS.EQUALS, 'Equals'),
        (RULE_BASED_GROUP_OPERATORS.NOT_EQUAL, 'Not Equals'),
        (RULE_BASED_GROUP_OPERATORS.CONTAINS, 'Contains'),
        (RULE_BASED_GROUP_OPERATORS.STARTS_WITH, 'Starts With'),
        (RULE_BASED_GROUP_OPERATORS.ENDS_WITH, 'Ends With'),
        (RULE_BASED_GROUP_OPERATORS.IS_ONE_OF, 'Is One Of'),
    )
    
    FIELD_CHOICES =(
        (RULE_BASED_GROUP_FIELDS.DEPARTMENT, 'Department'),
        (RULE_BASED_GROUP_FIELDS.LOCATION, 'Location'),
        (RULE_BASED_GROUP_FIELDS.DESIGNATION, 'Designation'),
        (RULE_BASED_GROUP_FIELDS.DIVISION, 'Division'),
        (RULE_BASED_GROUP_FIELDS.SUBDIVISION, 'Subdivision'),
    )
    
    group = models.ForeignKey(Groups, on_delete=models.CASCADE, related_name='conditions')
    field = models.CharField(max_length=50, choices=FIELD_CHOICES)
    operator = models.CharField(max_length=20, choices=OPERATOR_CHOICES)
    value = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.group.name} - {self.field} {self.operator} {self.value}"
    
    class Meta:
        unique_together = ('group', 'field', 'operator', 'value')

class Organization(models.Model): 
    STATUS_CHOICES=[('Active', 'Active'), ('Inactive', 'Inactive')]
    
    id = models.AutoField(primary_key=True)
    organization_name = models.CharField(max_length=255, unique=True,blank=True,null=True)
    organization_description = models.TextField(blank=True, null=True)
    created_date = models.DateField(auto_now_add=True)
    organization_status = models.CharField( max_length=20, choices=STATUS_CHOICES, default='Active')
    created_timestamp = models.DateTimeField(auto_now_add=True)

    is_deleted = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    last_deleted_date = models.DateTimeField(blank=True, null=True)
    last_archived_date = models.DateTimeField(blank=True, null=True)
    
    deletedBy = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, related_name='deleted_organization', blank=True, null=True)
    archivedBy = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, related_name='archived_organization', blank=True, null=True)
    is_draft = models.BooleanField(default=False)

    # To update last_deleted_date  last_archived_date based on archive and delete
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
        
    def __str__(self):
        return self.organization_name

    @property
    def admin_count(self):
        return self.admins.count()

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"

class OrganizationAdmin(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='admins')
    admin_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='admin_organizations')
    assigned_timestamp = models.DateTimeField(auto_now_add=True)

    # dashboard_access = models.BooleanField(default=False)

    class Meta:
        unique_together = ('organization', 'admin_user')
        verbose_name = "Organization Admin"
        verbose_name_plural = "Organization Admins"

    def __str__(self):
        org_name = self.organization.organization_name if self.organization else "No Organization"
        return f"{self.admin_user.email} - {org_name}"
    

# Modified LocationLeader Model
class LocationLeader(models.Model):
    user = models.OneToOneField('CustomUser', on_delete=models.CASCADE, related_name='location_leadership')
    organization = models.ForeignKey('Organization', on_delete=models.PROTECT, related_name='leaders', blank=True, null=True)
    password = models.IntegerField(null=True, blank=True)  # Changed to IntegerField, nullable
    promoted_at = models.DateTimeField(auto_now_add=True)
    promoted_by = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='promoted_leaders')
    is_default = models.BooleanField(default=False)  # True if password is set (default leader), False for normal leaders without password

    class Meta:
        verbose_name = "Location Leader"
        verbose_name_plural = "Location Leaders"

    def __str__(self):
        return f"{self.user.first_name or ''} {self.user.last_name or ''} - Leader for {self.user.location.name if self.user.location else 'No Location'}"
