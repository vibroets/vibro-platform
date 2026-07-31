from rest_framework import serializers
from .models import (CustomUser, 
        Role, 
        Groups, 
        OrganizationAdmin, 
        Organization, 
        ModulePermisions, 
        Departments, 
        Designations, 
        Locations, 
        Divisions, 
        GroupsConditions,
        SubDivisions,
        LocationLeader
)
from .constants import USER_ROLES, APP_MODULES, GROUP_TYPES, RULE_BASED_GROUP_FIELDS, RULE_BASED_GROUP_OPERATORS, RULE_BASED_GROUP_CONDITION_TYPES
from django.db.models import Q
import logging
logger = logging.getLogger(__name__)
import logging
logger = logging.getLogger(__name__)
from django.db import transaction
from django.core.exceptions import ValidationError

USER_ROLES = {
    'END_USER': 'end_user',
    'LOCATION_LEADER': 'location_leader',
    'ADMIN': 'admin',
    'SUPER_ADMIN': 'super_admin'
}

class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        # Check if the email exists in the CustomUser table
        if not CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("Invalid user email. Please contact the admin to register.")
        return value
    

# class VerifyOTPSerializer(serializers.Serializer):
#     email = serializers.EmailField()
#     otp = serializers.CharField(max_length=6)

#     def validate_email(self, value):
#         # Ensure the email exists in the CustomUser table
#         if not CustomUser.objects.filter(email=value).exists():
#             raise serializers.ValidationError("Invalid user email. Please contact the admin to register.")
#         return value

class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)  # Optional for backward compatibility
    identifier = serializers.CharField(max_length=254, required=False)  # Optional for phone
    otp = serializers.CharField(max_length=15, required=True)  # Flexible for OTP or password

    def validate(self, data):
        # Ensure at least one identifier field is provided
        if not data.get('email') and not data.get('identifier'):
            raise serializers.ValidationError("Either email or identifier is required.")
        if data.get('email') and data.get('identifier'):
            raise serializers.ValidationError("Provide only one of email or identifier, not both.")

        # Validate the chosen identifier
        identifier = data.get('identifier') or data.get('email')
        if '@' in identifier:
            # Email validation
            if not CustomUser.objects.filter(email=identifier).exists():
                raise serializers.ValidationError("Invalid user email. Please contact the admin to register.")
        else:
            # Phone validation for location leader
            if not CustomUser.objects.filter(phone=identifier).exists():
                raise serializers.ValidationError("Invalid mobile number. Please ensure the number is registered.")
            if not LocationLeader.objects.filter(user__phone=identifier).exists():
                raise serializers.ValidationError("No location leader associated with this mobile number.")

        # Validate OTP/password length
        otp = data.get('otp')
        if len(otp) < 6 or len(otp) > 15:
            raise serializers.ValidationError("OTP or password must be between 6 and 15 characters.")
        
        # Store the effective identifier in validated_data
        data['identifier'] = identifier
        return data

class DepartmentsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    organization_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Departments
        fields = ['id', 'name', 'description', 'organization_id']
        read_only_fields = ['id']    
    
    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Department name cannot be empty.")
        organization_id = self.initial_data.get('organization_id')
        if organization_id:
            if Departments.objects.filter(name=value, organization_id=organization_id).exists():
                raise serializers.ValidationError("Department with this name already exists in this organization.")
        return value

class DesignationsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    organization_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Designations
        fields = ['id', 'name', 'description', 'organization_id']
        read_only_fields = ['id']
    
    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Designation name cannot be empty.")
        organization_id = self.initial_data.get('organization_id')
        if organization_id:
            if Designations.objects.filter(name=value, organization_id=organization_id).exists():
                raise serializers.ValidationError("Designation with this name already exists in this organization.")
        return value
    
class LocationsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    organization_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Locations
        fields = ['id', 'name', 'description', 'organization_id']
        read_only_fields = ['id']


    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Location name cannot be empty.")
        organization_id = self.initial_data.get('organization_id')
        if organization_id:
            if Locations.objects.filter(name=value, organization_id=organization_id).exists():
                raise serializers.ValidationError("Location with this name already exists in this organization.")
        return value
    
class DivisionsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)
    organization_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    class Meta:
        model = Divisions
        fields = ['id', 'name', 'description', 'organization_id']    

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Division name cannot be empty.")
        organization_id = self.initial_data.get('organization_id')
        if organization_id:
            if Divisions.objects.filter(name=value, organization_id=organization_id).exists():
                raise serializers.ValidationError("Division with this name already exists in this organization.")
        return value

class SubDivisionsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    organization_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = SubDivisions
        fields = ['id', 'name', 'description', 'organization_id']
        read_only_fields = ['id']
    
    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("SubDivision name cannot be empty.")
        organization_id = self.initial_data.get('organization_id')
        if organization_id:
            if SubDivisions.objects.filter(name=value, organization_id=organization_id).exists():
                raise serializers.ValidationError("SubDivision with this name already exists in this organization.")
        return value
   

class RoleSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    class Meta:
        model = Role
        fields = ['id', 'name', 'description']
        read_only_fields = ['id', 'name']
    
    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Role name cannot be empty.")
        if Role.objects.filter(name=value).exists():
            raise serializers.ValidationError("Role with this name already exists.")
        return value

class ModulePermisionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModulePermisions
        fields = ['module', 'access']

class MinifiedUserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField( read_only=True)
    username = serializers.CharField( read_only=True)
    fullname = serializers.SerializerMethodField()

    def get_fullname(self, user):
        first = user.first_name or ""
        last = user.last_name or ""
        return f"{first.strip()} {last.strip()}".strip()
    
    class Meta:
        model = CustomUser
        fields = ['id', 'fullname', 'email', 'username']

class UsersListSerializer(serializers.ModelSerializer):
    division = serializers.CharField(required=False, allow_null=True)
    subdivision = serializers.CharField(required=False, allow_null=True)
    designation = serializers.CharField(required=False, allow_null=True)
    location = serializers.CharField(required=False, allow_null=True)
    department = serializers.CharField(required=False, allow_null=True)
    status = serializers.SerializerMethodField()
    disable = serializers.BooleanField(required=False, default=False)
    dashboard_access = serializers.BooleanField(required=False, default=False)
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all(), required=False, allow_null=True)
    organization_name = serializers.CharField(source='organization.organization_name', read_only=True)
    department_details = DepartmentsSerializer(source='department', read_only=True)
    location_details = LocationsSerializer(source='location', read_only=True)
    designation_details = DesignationsSerializer(source='designation', read_only=True)
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(),required=False,allow_null=True)
    role_details = RoleSerializer(source='role', read_only=True)
    class Meta:
        model = CustomUser
        fields = [
            'id', 'employee_id', 'email', 'username', 'first_name', 'last_name', 'phone', 'country_code',
            'designation', 'location', 'division', 'subdivision', 'department_details','location_details','designation_details',
            'department', 'status', 'organization', 'dashboard_access','role', 'role_details',
            'mobile_supervisor','disable',
            'organization_name'
        ]
    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"

    def get_organization_name(self, obj):
        return obj.organization.organization_name if obj.organization else None


class UserSerializer(serializers.ModelSerializer):
    division = serializers.CharField(required=False, allow_null=True)
    subdivision = serializers.CharField(required=False, allow_null=True)
    designation = serializers.CharField(required=False, allow_null=True)
    location = serializers.CharField(required=False, allow_null=True)
    department = serializers.CharField(required=False, allow_null=True)
    status = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    is_superadmin = serializers.SerializerMethodField()
    disable = serializers.BooleanField(required=False, default=False)
    module_access_list = ModulePermisionsSerializer(many=True, write_only=True, required=False)
    module_access = ModulePermisionsSerializer(source='permission_user', many=True, read_only=True)
    dashboard_access = serializers.BooleanField(required=False, default=False)
    department_details = DepartmentsSerializer(source='department', read_only=True)
    location_details = LocationsSerializer(source='location', read_only=True)
    designation_details = DesignationsSerializer(source='designation', read_only=True)
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        required=False,
        allow_null=True
    )
    role_details = RoleSerializer(source='role', read_only=True)
    organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.all(),
        required=False,
        allow_null=True
    )
    organization_name = serializers.SerializerMethodField()

    def get_organization_name(self, obj):
        return obj.organization.organization_name if obj.organization else None


    class Meta:
        model = CustomUser
        fields = [
            'id', 'employee_id', 'email', 'username', 'first_name', 'last_name', 'phone', 'country_code',
            'designation', 'designation_details', 'location', 'location_details', 'division', 'subdivision',
            'department', 'department_details', 'status', 'organization', 'role', 'role_details', 'dashboard_access',
            'module_access_list', 'module_access', 'mobile_supervisor', 'is_active', 'is_admin', 'is_superadmin','disable',
            'organization_name'
        ]
        read_only_fields = ['id', 'is_admin', 'is_superadmin']

    def get_is_admin(self, obj):
        return obj.role.name.lower() == 'admin' if obj.role else False

    def get_is_superadmin(self, obj):
        return obj.role.name.lower() == 'superadmin' if obj.role else False

    def validate_division(self, value):
        if not value:
            return None
        if str(value).isdigit():
            try:
                return Divisions.objects.get(pk=int(value))
            except Divisions.DoesNotExist:
                raise serializers.ValidationError(f"Invalid division ID: {value}")
        division_obj = Divisions.objects.filter(name__iexact=value.strip()).first()
        if division_obj:
            return division_obj
        return Divisions.objects.create(name=value.strip(), description=value.strip().title())

    def validate_subdivision(self, value):
        if not value:
            return None
        if str(value).isdigit():
            try:
                return SubDivisions.objects.get(pk=int(value))
            except SubDivisions.DoesNotExist:
                raise serializers.ValidationError(f"Invalid subdivision ID: {value}")
        subdivision_obj = SubDivisions.objects.filter(name__iexact=value.strip()).first()
        if subdivision_obj:
            return subdivision_obj
        return SubDivisions.objects.create(name=value.strip(), description=value.strip().title())

    def validate_designation(self, value):
        if not value:
            return None
        if str(value).isdigit():
            try:
                return Designations.objects.get(pk=int(value))
            except Designations.DoesNotExist:
                raise serializers.ValidationError(f"Invalid designation ID: {value}")
        designation_obj = Designations.objects.filter(name__iexact=value.strip()).first()
        if designation_obj:
            return designation_obj
        return Designations.objects.create(name=value.strip(), description=value.strip().title())

    def validate_location(self, value):
        if not value:
            return None
        if str(value).isdigit():
            try:
                return Locations.objects.get(pk=int(value))
            except Locations.DoesNotExist:
                raise serializers.ValidationError(f"Invalid location ID: {value}")
        location_obj = Locations.objects.filter(name__iexact=value.strip()).first()
        if location_obj:
            return location_obj
        return Locations.objects.create(name=value.strip(), description=value.strip().title())

    def validate_department(self, value):
        if not value:
            return None
        if str(value).isdigit():
            try:
                return Departments.objects.get(pk=int(value))
            except Departments.DoesNotExist:
                raise serializers.ValidationError(f"Invalid department ID: {value}")
        department_obj = Departments.objects.filter(name__iexact=value.strip()).first()
        if department_obj:
            return department_obj
        return Departments.objects.create(name=value.strip(), description=value.strip().title())

    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"

    def get_dashboard_access(self, obj):
        perms = obj.permission_user.all() if hasattr(obj, 'permission_user') else []
        for perm in perms:
            if perm.module == 'dashboard' and perm.access != 'no_access':
                return True
        return False

    def validate_email(self, value):
        if not value:
            return value
        if self.instance and self.instance.email == value:
            return value
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value
    
    def validate_phone(self, value):
        if value and CustomUser.objects.filter(phone=value).exclude(id=self.instance.id if self.instance else None).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return value

    def create(self, validated_data):
        module_access_list = validated_data.pop('module_access_list', [])

        # Set default role if not provided
        role = validated_data.get('role')
        if role is None:
            try:
                validated_data['role'], _ = Role.objects.get_or_create(name=USER_ROLES.END_USER)
            except Role.DoesNotExist:
                raise serializers.ValidationError({"role": "Default role 'end_user' does not exist."})

        try:
            with transaction.atomic():
                user = super().create(validated_data)

                # Handle organization-specific copies of foreign key fields
                user_organization = user.organization
                if user_organization:
                    # Check and create organization-specific copies if needed
                    for field_name, model_class in [
                        ('department', Departments),
                        ('designation', Designations),
                        ('division', Divisions),
                        ('subdivision', SubDivisions),
                        ('location', Locations)
                    ]:
                        field_value = getattr(user, field_name)
                        if field_value and field_value.organization != user_organization:
                            # This is an entry from another organization, check if organization-specific copy exists
                            org_specific_obj = model_class.objects.filter(
                                name__iexact=field_value.name,
                                organization=user_organization
                            ).first()

                            if not org_specific_obj:
                                # Create organization-specific copy if it doesn't exist
                                org_specific_obj = model_class.objects.create(
                                    name=field_value.name,
                                    description=field_value.description,
                                    organization=user_organization
                                )

                            # Use the organization-specific entry
                            setattr(user, field_name, org_specific_obj)

                    # Save the user with updated foreign keys
                    user.save()

                # Create module permissions
                for item in module_access_list:
                    ModulePermisions.objects.create(
                        user=user,
                        module=item["module"],
                        access=item["access"]
                    )

                if user.role.name == 'admin':
                    OrganizationAdmin.objects.create(organization=user.organization, admin_user=user)

            return user

        except ValidationError as e:
            raise serializers.ValidationError({"module_permissions": e.messages})

    def update(self, instance, validated_data):
        module_access_list = validated_data.pop('module_access_list', [])
        original_role = instance.role

        # ✅ Promotion logic (missing earlier)
        if module_access_list:
            should_promote = any(item.get("access") != "no_access" for item in module_access_list)
            if should_promote:
                try:
                    admin_role = Role.objects.get(name='admin')
                    validated_data['role'] = admin_role
                except Role.DoesNotExist:
                    raise serializers.ValidationError("Admin role does not exist.")


        # Update fields directly from validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # # If dashboard access is disabled, demote to end user
        # is_dashboard_disabled = ('dashboard_access' in validated_data and not validated_data['dashboard_access'])
        # if is_dashboard_disabled:
        #     try:
        #         end_user_role = Role.objects.get(name='end_user')
        #         instance.role = end_user_role
                
        #         # Remove all existing module permissions only when demoted
        #         ModulePermisions.objects.filter(user=instance).delete()

        #     except Role.DoesNotExist:
        #         raise serializers.ValidationError(f"Role 'end_user' does not exist.")
        # If dashboard access is disabled, demote to end user
        is_dashboard_disabled = (
            'dashboard_access' in validated_data 
            and not validated_data['dashboard_access']
        )

        if is_dashboard_disabled:
            # 🚫 Do NOT demote location leader
            if instance.role and instance.role.name == 'location_leader':
                pass  # keep role as-is
            else:
                try:
                    end_user_role = Role.objects.get(name='end_user')
                    instance.role = end_user_role

                    # Remove all existing module permissions only when demoted
                    ModulePermisions.objects.filter(user=instance).delete()

                except Role.DoesNotExist:
                    raise serializers.ValidationError("Role 'end_user' does not exist.")


        instance.save()

        # Update module permissions if provided and not demoted
        if module_access_list and not is_dashboard_disabled:
            ModulePermisions.objects.filter(user=instance).delete()
            for item in module_access_list:
                ModulePermisions.objects.create(
                    user=instance,
                    module=item["module"],
                    access=item["access"]
                )
        new_role = instance.role
        if new_role != original_role:
            if new_role.name == 'admin':
                OrganizationAdmin.objects.get_or_create(organization=instance.organization, admin_user=instance)
            elif original_role.name == 'admin':
                OrganizationAdmin.objects.filter(organization=instance.organization, admin_user=instance).delete()

        return instance

    def validate_role(self, value):
        if value is None and self.initial_data.get('role') is not None:
            raise serializers.ValidationError("Role cannot be null if provided.")
        return value

    def validate_module_access_list(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("module_access_list must be a list.")
        modules_provided = {item.get("module") for item in value}
        missing_modules = set(APP_MODULES.ALL) - modules_provided
        if missing_modules:
            raise serializers.ValidationError(
                f"The following modules are missing in module_access_list: {', '.join(missing_modules)}"
            )
        return value

    def validate(self, attrs):
        dashboard_access = attrs.get("dashboard_access", False)
        module_access_list = self.initial_data.get("module_access_list")
        if dashboard_access:
            if not module_access_list:
                raise serializers.ValidationError({"module_access_list": "This field is required when dashboard_access is true."})
            self.validate_module_access_list(module_access_list)
        return attrs
class BulkUserSerializer(serializers.Serializer):
    firstName = serializers.CharField(required=True, source='first_name')
    lastName = serializers.CharField(required=True, source='last_name')
    countryCode = serializers.CharField(required=True, source='country_code')
    phone = serializers.CharField(required=True)
    designation = serializers.IntegerField(required=False, allow_null=True)
    division = serializers.IntegerField(required=False, allow_null=True)
    subdivision = serializers.IntegerField(required=False, allow_null=True)
    location = serializers.IntegerField(required=False, allow_null=True)
    department = serializers.IntegerField(required=False, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    dashboardAccess = serializers.BooleanField(required=True, source='dashboard_access')
    mobileSupervisor = serializers.BooleanField(required=True, source='mobile_supervisor')
    rowIndex = serializers.IntegerField(source='row_index', required=False)
    role = serializers.IntegerField(required=False, allow_null=True)

    def validate_designation(self, value):
        if value and isinstance(value, str):
            try:
                return Designations.objects.get(name__iexact=value).pk
            except Designations.DoesNotExist:
                raise serializers.ValidationError(f"Invalid designation name: {value}")
        elif value and isinstance(value, int):
            try:
                return Designations.objects.get(pk=value).pk
            except Designations.DoesNotExist:
                raise serializers.ValidationError(f"Invalid designation ID: {value}")
        return None

    def validate_division(self, value):
        if not value:
            return None
        # Try to get by ID if value is digit
        if str(value).isdigit():
            try:
                return Divisions.objects.get(pk=int(value)).pk
            except Divisions.DoesNotExist:
                raise serializers.ValidationError(f"Invalid division ID: {value}")
        # Try to get by name (case-insensitive)
        division_obj = Divisions.objects.filter(name__iexact=value.strip()).first()
        if division_obj:
            return division_obj.pk
        # If not found, create new division
        division_obj = Divisions.objects.create(name=value.strip(), description=value.strip().title())
        return division_obj.pk
    
    def validate_subdivision(self, value):
        if not value:
            return None
        # Try to get by ID if value is digit
        if str(value).isdigit():
            try:
                return SubDivisions.objects.get(pk=int(value)).pk
            except SubDivisions.DoesNotExist:
                raise serializers.ValidationError(f"Invalid subdivision ID: {value}")
        # Try to get by name (case-insensitive)
        subdivision_obj = SubDivisions.objects.filter(name__iexact=value.strip()).first()
        if subdivision_obj:
            return subdivision_obj.pk
        # If not found, create new subdivision
        subdivision_obj = SubDivisions.objects.create(name=value.strip(), description=value.strip().title())
        return subdivision_obj.pk


    def validate_location(self, value):
        if value:
            try:
                return Locations.objects.get(pk=value)
            except Locations.DoesNotExist:
                raise serializers.ValidationError(f"Invalid location ID: {value}")
        return None

    def validate_department(self, value):
        if value:
            try:
                return Departments.objects.get(pk=value)
            except Departments.DoesNotExist:
                raise serializers.ValidationError(f"Invalid department ID: {value}")
        return None

    def validate(self, data):
        # Inject default role
        role = Role.objects.filter(name=USER_ROLES.END_USER).first()
        data['role'] = role.pk
        data['username'] = data.get('email', '').split('@')[0] or data.get('phone', '')
        data['is_active'] = True
        return data

class GroupsConditionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupsConditions
        fields = ['id', 'field', 'operator', 'value']

class GroupsConditionsMatchedUserSerializer(serializers.ModelSerializer):
    department = DepartmentsSerializer()
    division = DivisionsSerializer()
    # sub_division = SubDivisionsSerializer()
    subdivision = SubDivisionsSerializer()
    location = LocationsSerializer()
    designation = DesignationsSerializer()

    class Meta:
        model = CustomUser
        fields = ['id', 'first_name', 'last_name', 'email', 'department', 'division', 'subdivision', 'location', 'designation']

class RegularGroupSerializer(serializers.ModelSerializer):
    members = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = Groups
        fields = ['id', 'name', 'description', 'allow_chat', 'members', 'organization', 'created_at']
    
    def create(self, validated_data):
        members = validated_data.pop('members', [])
        validated_data.setdefault('type', GROUP_TYPES.NORMAL)
        group = Groups.objects.create(**validated_data)
        group.members.set(members)
        return group

    def update(self, instance, validated_data):
        members = validated_data.pop('members', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if members is not None:
            instance.members.set(members)
        return instance

class RuleBasedGroupSerializer(serializers.ModelSerializer):
    members = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        many=True,
        required=False
    )
    conditions = GroupsConditionsSerializer(many=True)
    member_details = serializers.SerializerMethodField()
    remaining_matched_users = serializers.SerializerMethodField()
    
    class Meta:
        model = Groups
        fields = [
            'id', 'name', 'description', 'allow_chat', 'match_type', 'members', 'member_details',
            'organization', 'conditions', 'remaining_matched_users', 'created_at'
        ]

    def create(self, validated_data):
        conditions_data = validated_data.pop('conditions', [])
        members = validated_data.pop('members', [])
        validated_data.setdefault('type', GROUP_TYPES.RULEBASED)
        group = Groups.objects.create(**validated_data)
        group.members.set(members)

        for condition_data in conditions_data:
            GroupsConditions.objects.create(group=group, **condition_data)
        
        # Re-evaluate membership after creating group with conditions
        if conditions_data:
            from .utils import re_evaluate_group_membership
            re_evaluate_group_membership(group)
        
        return group

    def update(self, instance, validated_data):
        conditions_data = validated_data.pop('conditions', None)
        members = validated_data.pop('members', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if members is not None:
            instance.members.set(members)

        if conditions_data is not None:
            # Clear existing and recreate (or implement smarter diff logic)
            instance.conditions.all().delete()
            for condition_data in conditions_data:
                GroupsConditions.objects.create(group=instance, **condition_data)
            
            # Re-evaluate membership after conditions change
            from .utils import re_evaluate_group_membership
            re_evaluate_group_membership(instance)

        return instance

    def get_member_details(self, group: Groups):
        members = group.members.filter(is_deleted=False, is_archived=False)
        return GroupsConditionsMatchedUserSerializer(members, many=True).data
    
    def get_remaining_matched_users(self, group: Groups):
        conditions = group.conditions.all()
        if not conditions.exists() or not group.organization:
            return []

        users = CustomUser.objects.filter(
            organization=group.organization,
            is_deleted=False,
            is_archived=False
        )
        query = Q()
        for cond in conditions:
            field_map = {
                RULE_BASED_GROUP_FIELDS.DEPARTMENT: 'department__name',
                RULE_BASED_GROUP_FIELDS.DIVISION: 'division__name',
                RULE_BASED_GROUP_FIELDS.SUBDIVISION: 'subdivision__name',
                RULE_BASED_GROUP_FIELDS.LOCATION: 'location__name',
                RULE_BASED_GROUP_FIELDS.DESIGNATION: 'designation__name',
            }
            
            field_name = field_map[cond.field]
            sanitiesed_cond_value = cond.value.strip().lower().replace(" ", "_")            
            
            if cond.operator == RULE_BASED_GROUP_OPERATORS.EQUALS:
                q = Q(**{field_name: sanitiesed_cond_value})
            elif cond.operator == RULE_BASED_GROUP_OPERATORS.NOT_EQUAL:
                q = ~Q(**{field_name: sanitiesed_cond_value})
            elif cond.operator == RULE_BASED_GROUP_OPERATORS.CONTAINS:
                q = Q(**{f"{field_name}__icontains": sanitiesed_cond_value})
            elif cond.operator == RULE_BASED_GROUP_OPERATORS.STARTS_WITH:
                q = Q(**{f"{field_name}__istartswith": sanitiesed_cond_value})
            elif cond.operator == RULE_BASED_GROUP_OPERATORS.ENDS_WITH:
                q = Q(**{f"{field_name}__iendswith": sanitiesed_cond_value})
            elif cond.operator == RULE_BASED_GROUP_OPERATORS.IS_ONE_OF:
                q = Q(**{f"{field_name}__in": [v.strip() for v in sanitiesed_cond_value.split(',')]})
            else:
                continue

            if group.match_type == RULE_BASED_GROUP_CONDITION_TYPES.OR:
                query |= q
            else:
                query &= q

        matched_users = users.filter(query).exclude(pk__in=group.members.all())
        return GroupsConditionsMatchedUserSerializer(matched_users, many=True).data

class GroupSerializer(serializers.ModelSerializer):
    members = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        many=True,
        required=False
    )
    member_details = serializers.SerializerMethodField()
    conditions = GroupsConditionsSerializer(many=True, required=False)
    match_type = serializers.CharField(required=False, allow_blank=True)
    organization_name = serializers.SerializerMethodField()

    class Meta:
        model = Groups
        fields = ['id', 'name', 'description', 'allow_chat', 'type', 'match_type', 'members', 'member_details',
                  'organization', 'organization_name', 'conditions', 'created_at']

    def get_organization_name(self, obj):
        return obj.organization.organization_name if obj.organization else None
    
    def get_member_details(self, obj):
        members = obj.members.filter(is_deleted=False, is_archived=False)
        return GroupsConditionsMatchedUserSerializer(members, many=True).data
  
class OrganizationAdminSerializer(serializers.ModelSerializer):
    user = UserSerializer(source="admin_user", read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    dashboard_access = serializers.BooleanField(default=False, required=False)

    class Meta:
        model = OrganizationAdmin
        fields = ['id', 'organization', 'user', 'user_id', 'assigned_timestamp', 'dashboard_access']
        read_only_fields = ['id', 'organization', 'assigned_timestamp', 'user', 'dashboard_access']

    def validate_user_id(self, value):
        try:
            user = CustomUser.objects.get(id=value)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("User does not exist.")
        return value

class ModulePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModulePermisions
        fields = ['module', 'access']
        read_only_fields = ['created_timestamp']

    def validate(self, data):
        if data['module'] not in dict(ModulePermisions.MODULE_CHOICES):
            raise serializers.ValidationError(f"Invalid module: {data['module']}")
        if data['access'] not in dict(ModulePermisions.ACCESS_CHOICES):
            raise serializers.ValidationError(f"Invalid access: {data['access']}")
        return data
    
class OrganizationListSerializer(serializers.ModelSerializer):
    admin_count = serializers.IntegerField(read_only=True)
    # admins = OrganizationAdminSerializer(many=True, read_only=True) 
    # admin_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True)
    # dashboard_access = serializers.SerializerMethodField(default=False) 
    # module_access_list = ModulePermissionSerializer(many=True, write_only=True)
    # module_permissions = ModulePermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Organization
        fields = [
            'id', 'organization_name', 'organization_description', 'created_date',
            'organization_status', 'created_timestamp', 'admin_count',
        ]
        # read_only_fields = ['id', 'created_date', 'created_timestamp', 'admin_count', 'admins', 'module_permissions', 'dashboard_access']


class OrganizationSerializer(serializers.ModelSerializer):
    admin_count = serializers.IntegerField(read_only=True)
    admins = OrganizationAdminSerializer(many=True, read_only=True) 
    admin_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True)
    dashboard_access = serializers.SerializerMethodField(default=False) 
    module_access_list = ModulePermissionSerializer(many=True, write_only=True)
    module_permissions = ModulePermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Organization
        fields = [
            'id', 'organization_name', 'organization_description', 'created_date',
            'organization_status', 'created_timestamp', 'admin_count', 'admins',
            'admin_ids', 'dashboard_access', 'module_access_list', 'module_permissions'
        ]
        read_only_fields = ['id', 'created_date', 'created_timestamp', 'admin_count', 'admins', 'module_permissions', 'dashboard_access']

    def get_dashboard_access(self, obj):
        perms = obj.module_permissions.all() if hasattr(obj, 'module_permissions') else []
        for perm in perms:
            if perm.module == 'dashboard' and perm.access != 'no_access':
                return True
        return False

    def validate(self, data):
        admin_ids = data.get('admin_ids', [])
        request = self.context.get('request')
        if request and request.method == "POST" and not admin_ids:
            raise serializers.ValidationError({"admin_ids": "At least one admin is required."})


        invalid_ids = []
        for user_id in admin_ids:
            try:
                user = CustomUser.objects.get(id=user_id)
                if not user.role or user.role.name not in ['admin', 'super_admin', 'end_user']:
                    invalid_ids.append(user_id)
                elif user.role.name == 'end_user':
                    # Promote end_user to admin
                    try:
                        admin_role = Role.objects.get(name='admin')
                        user.role = admin_role
                        user.save()
                    except Role.DoesNotExist:
                        raise serializers.ValidationError("Role 'admin' does not exist in the database.")
            except CustomUser.DoesNotExist:
                invalid_ids.append(user_id)
        
        if invalid_ids:
            raise serializers.ValidationError({"admin_ids": f"Invalid user IDs: {invalid_ids}"})

        module_access_list = data.get('module_access_list', [])
        if data.get('dashboard_access') and not any(
            item['module'] == 'dashboard' and item['access'] != 'no_access'
            for item in module_access_list
        ):
            raise serializers.ValidationError({
                "module_access_list": "Dashboard access requires dashboard module with non-'no_access' permission."
            })

        modules = [item['module'] for item in module_access_list]
        if len(modules) != len(set(modules)):
            raise serializers.ValidationError({"module_access_list": "Duplicate modules are not allowed."})

        return data

    def validate_admin_ids(self, value):
        request = self.context.get('request')
        if request and request.method == "POST" and not value:
            raise serializers.ValidationError("At least one admin is required.")
        user_ids = set(value)
        users = CustomUser.objects.filter(id__in=user_ids)
        if len(users) != len(user_ids):
            raise serializers.ValidationError("One or more user IDs are invalid.")
        return value


    def create(self, validated_data):
        admin_ids = validated_data.pop('admin_ids', [])
        dashboard_access = validated_data.pop('dashboard_access', None)
        module_access_list = validated_data.pop('module_access_list', [])
        organization = Organization.objects.create(**validated_data)

        for user_id in admin_ids:
            user = CustomUser.objects.get(id=user_id)
            OrganizationAdmin.objects.create(organization=organization, admin_user=user)
            user.organization = organization
            try:
                user.role = Role.objects.get(name='admin')  # Assuming USER_ROLES.ADMIN is 'ADMIN'
                user.save()
            except Role.DoesNotExist:
                raise serializers.ValidationError(f"Role 'admin' does not exist.")

        for permission_data in module_access_list:
            ModulePermisions.objects.create(
                organization=organization,
                user=None,  # Organization permission, so user is null
                module=permission_data['module'],
                access=permission_data['access']
            )

        return organization

    def update(self, instance, validated_data):
        admin_ids = validated_data.pop('admin_ids', None)
        # print(f"[DEBUG] Raw request data: {self.context['request'].data}")
        dashboard_access = validated_data.pop('dashboard_access', None)
        module_access_list = validated_data.pop('module_access_list', None)
        instance.organization_name = validated_data.get('organization_name', instance.organization_name)
        instance.organization_description = validated_data.get('organization_description', instance.organization_description)
        instance.organization_status = validated_data.get('organization_status', instance.organization_status)
        instance.save()

        # ✅ Update Admins (revoke old, assign new)
        if admin_ids is not None:
            current_admins = OrganizationAdmin.objects.filter(organization=instance)
            print(f"[DEBUG] Current admins: {[admin.admin_user.id for admin in current_admins]}")

            # Step 1: Revoke roles of old admins not in new list
            removed_admins = current_admins.exclude(admin_user__id__in=admin_ids)
            for admin in removed_admins:
                user = admin.admin_user
                try:
                    end_user_role = Role.objects.get(name='end_user')
                    user.role = end_user_role
                    user.save()
                except Role.DoesNotExist:
                    raise serializers.ValidationError(f"Role 'end_user' does not exist.")

            # Step 2: Clear and recreate OrganizationAdmin entries
            current_admins.delete()

            # Step 3: Add new admins and assign role
            for user_id in admin_ids:
                try:
                    user = CustomUser.objects.get(id=user_id)
                    OrganizationAdmin.objects.create(organization=instance, admin_user=user)

                    admin_role = Role.objects.get(name='admin')
                    user.role = admin_role
                    user.save()
                except CustomUser.DoesNotExist:
                    raise serializers.ValidationError(f"User with ID {user_id} does not exist.")
                except Role.DoesNotExist:
                    raise serializers.ValidationError(f"Role 'admin' does not exist.")

        # ✅ Update module permissions (if provided)
        if module_access_list is not None:
            ModulePermisions.objects.filter(organization=instance, user__isnull=True).delete()
            for permission_data in module_access_list:
                ModulePermisions.objects.create(
                    organization=instance,
                    user=None,
                    module=permission_data['module'],
                    access=permission_data['access']
                )

        return instance

       
    
class RestoreUserSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=True)
    username = serializers.SerializerMethodField()
    email = serializers.EmailField(required=True)
    last_deleted_date = serializers.DateTimeField()
    last_archived_date = serializers.DateTimeField()
    archivedBy = MinifiedUserSerializer(read_only=True)
    deletedBy = MinifiedUserSerializer(read_only=True)
    modal= serializers.CharField(max_length=150, required=False, default="User")
    
    class Meta:
        model = CustomUser
        fields = ['id', "modal", 'username', 'email', 'last_deleted_date', 'last_archived_date', 'archivedBy', 'deletedBy']
    
    def get_username(self, user):
        first = user.first_name or ""
        last = user.last_name or ""
        return f"{first.strip()} {last.strip()}".strip()
    
class RestoreGroupSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=True)
    name = serializers.CharField(max_length=150, required=True)
    type = serializers.CharField(max_length=30, required=False, allow_blank=True)
    allow_chat= serializers.BooleanField(required=True)
    last_deleted_date = serializers.DateTimeField()
    last_archived_date = serializers.DateTimeField()
    archivedBy = MinifiedUserSerializer(read_only=True)
    deletedBy = MinifiedUserSerializer(read_only=True)
    modal= serializers.CharField(max_length=150, required=False, default="Group")
    
    class Meta:
        model = Groups
        fields = ['id', "modal", 'name', 'type', 'allow_chat', 'last_deleted_date', 'last_archived_date', 'archivedBy', 'deletedBy']
        
class RestoreOrganizationSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=True)
    organization_name = serializers.CharField(max_length=150, required=True)
    organization_description = serializers.CharField(max_length=30, required=False, allow_blank=True)
    created_date= serializers.BooleanField(required=True)
    last_deleted_date = serializers.DateTimeField()
    last_archived_date = serializers.DateTimeField()
    archivedBy = MinifiedUserSerializer(read_only=True)
    deletedBy = MinifiedUserSerializer(read_only=True)
    modal= serializers.CharField(max_length=150, required=False, default="Organization")
    
    class Meta:
        model = Organization
        fields = ['id', "modal", 'organization_name', 'organization_description', 'created_date', 'last_deleted_date', 'last_archived_date', 'archivedBy', 'deletedBy']

class BulkImportUserSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(write_only=True)
    lastName = serializers.CharField(write_only=True)
    countryCode = serializers.CharField(write_only=True)
    phone = serializers.CharField()
    designation = serializers.CharField()
    division = serializers.CharField()
    subdivision = serializers.CharField()
    location = serializers.CharField()
    department = serializers.CharField()
    email = serializers.EmailField()
    employeeId = serializers.CharField(write_only=True)  # For employee ID

    class Meta:
        model = CustomUser
        fields = [
            'firstName', 'lastName', 'countryCode', 'phone',
            'designation', 'division', 'subdivision', 'location',
            'department', 'email','employeeId'
        ]

    def to_internal_value(self, data):
        validated = super().to_internal_value(data)
        validated['first_name'] = validated.pop('firstName')
        validated['last_name'] = validated.pop('lastName')
        validated['country_code'] = validated.pop('countryCode')
        validated['employee_id'] = validated.pop('employeeId')
        return validated

    def validate(self, attrs):
        # Lookup related fields
        lookup_fields = {
            'designation': Designations,
            'division': Divisions,
            'subdivision': SubDivisions,
            'location': Locations,
            'department': Departments,
        }

        for field, model in lookup_fields.items():
            raw_value = attrs.get(field, "").strip()
            if raw_value:
                try:
                    instance = model.objects.get(name__iexact=raw_value)
                except model.DoesNotExist:
                    instance = model.objects.create(name=raw_value, description=raw_value)
                attrs[field] = instance
            else:
                attrs[field] = None

        # Set username to email
        attrs['username'] = attrs.get('email')


        # Default role_id = 3 (end user)
        attrs['role_id'] = 3

        return attrs

    def create(self, validated_data):
        return CustomUser.objects.create(**validated_data)
        
class OrganizationBulkStatusSerializer(serializers.Serializer):
    organization_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        error_messages={
            'empty': 'Please provide a list of organization IDs.'
        }
    )

class PromoteToLocationLeaderSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True
    )
    password = serializers.CharField(min_length=6, max_length=15, required=False)

    def validate_user_id(self, value):
        try:
            user = CustomUser.objects.get(id=value)
            end_user_role = Role.objects.get(name=USER_ROLES['END_USER'])
            if user.role != end_user_role:
                raise serializers.ValidationError(f"Can only promote {USER_ROLES['END_USER']}s to location leaders.")
            if not user.phone:
                raise serializers.ValidationError("User must have a phone number.")
            if LocationLeader.objects.filter(user=user).exists():
                raise serializers.ValidationError("User is already a location leader.")
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("User not found.")
        except Role.DoesNotExist:
            raise serializers.ValidationError("Role configuration is invalid. Contact the administrator.")
        return value

    def validate(self, data):
        user_ids = data['user_ids']
        user = CustomUser.objects.get(id=user_ids[0])  # ✅ Fix here
        password = data.get('password')
        employee_id_lower = user.employee_id.lower() if user.employee_id else ''
        is_default = employee_id_lower.startswith('default_loc')
        if is_default:
            if not password:
                raise serializers.ValidationError({"password": "Password is required for default location leaders with 'default_loc' prefix in employee_id."})
            if not password.isdigit():
                raise serializers.ValidationError({"password": "Password must be numeric only."})
            if len(password) < 6 or len(password) > 15:
                raise serializers.ValidationError({"password": "Password must be between 6 and 15 digits."})
        else:
            if password:
                data['password'] = None
        return data

class ReassignLocationLeaderSerializer(serializers.Serializer):
    new_user_id = serializers.IntegerField(required=True)
    location_id = serializers.PrimaryKeyRelatedField(queryset=Locations.objects.all(), required=False)  # Optional location change

    def validate_new_user_id(self, value):
        try:
            user = CustomUser.objects.get(id=value)
            if user.role.name == USER_ROLES['LOCATION_LEADER']:
                raise serializers.ValidationError("User is already a location leader.")
            if not user.phone:
                raise serializers.ValidationError("User must have a phone number.")
            return value
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("New user not found.")

class LocationLeaderSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationLeader
        fields = ['id', 'user', 'organization', 'password', 'promoted_at', 'promoted_by']  # Only relevant fields
        depth = 1
