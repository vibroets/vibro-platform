from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import viewsets
from datetime import datetime
from rest_framework import viewsets, filters

import csv
import io
import json
from .models import ( 
    CustomUser, 
    OTP, 
    Groups,
    OrganizationAdmin,
    Organization, 
    Role, 
    Departments, 
    Divisions, 
    SubDivisions,
    Locations, 
    Designations,
    ModulePermisions,
    SubDivisions,
    LocationLeader
)
from .serializers import (
    RequestOTPSerializer, 
    DepartmentsSerializer, 
    VerifyOTPSerializer, 
    UserSerializer, 
    BulkUserSerializer, 
    GroupSerializer,
    RegularGroupSerializer, 
    RuleBasedGroupSerializer,
    OrganizationAdminSerializer,
    OrganizationSerializer,
    DesignationsSerializer,
    LocationsSerializer,
    DivisionsSerializer,
    SubDivisionsSerializer,
    RestoreUserSerializer,
    RestoreGroupSerializer,
    RestoreOrganizationSerializer,
    BulkImportUserSerializer,
    ModulePermisionsSerializer,
    PromoteToLocationLeaderSerializer,
    LocationLeaderSerializer,
    ReassignLocationLeaderSerializer,
    OrganizationListSerializer,
    UsersListSerializer
) 
from .utils import create_otp, send_csv_email, re_evaluate_user_group_membership, re_evaluate_group_membership
from django.utils import timezone
from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import MethodNotAllowed
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from vibro.permissions import IsAdmin, IsSuperAdmin, IsAdminOrSuperAdmin, IsEndUser, IsEndUserOrSuperAdminOrAdmin
from .constants import USER_ROLES, GROUP_TYPES, RESTORE_OPTIONS, BULK_DELETE_MODELS
import logging
from django.db.models import Q
from django.db import transaction
from django.db.models import Max
from django.db import IntegrityError
from django.db.models import Count
logger = logging.getLogger(__name__)
USER_ROLES = {'END_USER': 'end_user', 'LOCATION_LEADER': 'location_leader', 'ADMIN': 'admin', 'SUPER_ADMIN': 'super_admin'}

class OrganizationStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization

        total_users_count = CustomUser.objects.filter(
            organization=org,
            is_deleted=False,
            is_archived=False,
            disable=False
        ).count()

        total_groups_count = Groups.objects.filter(
            organization=org,
            is_deleted=False,
            is_archived=False
        ).count()

        today = timezone.now().date()

        recently_added_users = CustomUser.objects.filter(
            organization=org,
            is_deleted=False,
            is_archived=False,
            disable=False,
            date_joined__date=today
        ).count()

        top_groups = Groups.objects.filter(
            organization=org,
            is_deleted=False,
            is_archived=False
        ).annotate(member_count=Count('members', filter=Q(members__is_deleted=False, members__is_archived=False, members__disable=False))).order_by('-member_count')[:3].values('name', 'member_count')

        top_active_groups = [{'name': g['name'], 'count': g['member_count']} for g in top_groups]

        return Response({
            'total_users_count': total_users_count,
            'total_groups_count': total_groups_count,
            'recently_added_users': recently_added_users,
            'top_active_groups': top_active_groups
        }, status=status.HTTP_200_OK)

# class RequestOTPView(APIView):
#     def post(self, request):
#         try:
#             platform = request.data.get("platform")
#             if (request.data['email']).isdigit() and LocationLeader.objects.filter(user__phone=request.data['email']).exists():
#                 return Response({'message': 'OTP sent to your email.'}, status=status.HTTP_200_OK)
#             serializer = RequestOTPSerializer(data=request.data)
#             if serializer.is_valid():
#                 email = serializer.validated_data['email']
#                 OTP.objects.filter(email=email).delete()
#                 try:
#                     user = CustomUser.objects.get(email=email)

#                     #  New check: Restrict End Users (role_id=3) from Web login
#                     if platform == "web" and user.role and user.role.id == 3:
#                         return Response(
#                             {"error": "You don't have access to web login."},
#                             status=status.HTTP_403_FORBIDDEN
#                         )
                    
#                     # Check if default location leader (block email OTP)
#                     if user.role.name == USER_ROLES['LOCATION_LEADER']:
#                         employee_id_lower = user.employee_id.lower() if user.employee_id else ''
#                         if employee_id_lower.startswith('default_loc'):
#                             return Response({"error": "Default location leaders must use phone login. Email login not allowed."}, status=status.HTTP_403_FORBIDDEN)
#                     # Block disabled users
#                     if user.disable:
#                         return Response(
#                             {"error": "Your account is disabled. Please contact Admin."},
#                             status=status.HTTP_403_FORBIDDEN,
#                         )

#                     # Block users from deactivated organizations
#                     if user.organization and user.organization.is_archived:
#                         return Response(
#                             {"error": "Failed to send OTP. Email does not exist."},
#                             status=status.HTTP_403_FORBIDDEN,
#                         )
#                 except CustomUser.DoesNotExist:
#                     # If you still want to auto-create users, keep this line
#                     user = CustomUser.objects.create(
#                         email=email, username=email.split('@')[0]
#                     )

#                 # Proceed with OTP generation
#                 create_otp(email)
#                 return Response({'message': 'OTP sent to your email.'}, status=status.HTTP_200_OK)
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#         except Exception as e:
#             logger.error(f"Error in RequestOTPView: {str(e)}")
#             return Response({'error': 'An error occurred while processing your request.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RequestOTPView(APIView):
    def post(self, request):
        try:
            platform = request.data.get("platform")
            identifier = request.data.get("email")  # email OR phone
            
            if not identifier:
                return Response(
                    {"error": "Email or phone number is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            is_phone_login = identifier.isdigit()

            # 1️⃣ Fetch user
            if is_phone_login:
                user = CustomUser.objects.filter(phone=identifier).first()
            else:
                user = CustomUser.objects.filter(email=identifier).first()

            if not user:
                return Response(
                    {"error": "User not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 2️⃣ Location Leader login restrictions
            if user.role and user.role.name == USER_ROLES['LOCATION_LEADER']:
                employee_id_lower = user.employee_id.lower() if user.employee_id else ''

                # ❌ Default location leader → email not allowed
                if employee_id_lower.startswith('default_loc') and not is_phone_login:
                    return Response(
                        {"error": "Default location leaders must use Number login. Email login not allowed."},
                        status=status.HTTP_403_FORBIDDEN
                    )

                # ❌ Non-default location leader → phone not allowed
                if not employee_id_lower.startswith('default_loc') and is_phone_login:
                    return Response(
                        {"error": "Location leaders must use email login. Number login not allowed."},
                        status=status.HTTP_403_FORBIDDEN
                    )

                # ✅ Default location leader + phone → USE STANDARD OTP
                if employee_id_lower.startswith('default_loc') and is_phone_login:
                    return Response(
                        {
                            "message": "Proceed to OTP verification.",
                            "standard_otp": True
                        },
                        status=status.HTTP_200_OK
                    )

            # 3️⃣ Restrict end users from web login
            if platform == "web" and user.role and user.role.id == 3:
                return Response(
                    {"error": "You don't have access to web login."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 4️⃣ Block disabled users
            if user.disable:
                return Response(
                    {"error": "Your account is disabled. Please contact Admin."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # 5️⃣ Block archived organization
            if user.organization and user.organization.is_archived:
                return Response(
                    {"error": "Failed to send OTP. Email does not exist."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # 6️⃣ Generate OTP (ONLY for normal users)
            OTP.objects.filter(email=identifier).delete()
            create_otp(identifier)

            return Response(
                {"message": "OTP sent successfully."},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error in RequestOTPView: {str(e)}")
            return Response(
                {'error': 'An error occurred while processing your request.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class VerifyOTPView(APIView):
    def post(self, request):
        platform = request.data.get("platform")
        serializer = VerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            identifier = serializer.validated_data['identifier']  # Now guaranteed by serializer
            input_value = serializer.validated_data['otp']
            if '@' in identifier:
                # Email/OTP logic for admin/super admin
                try:
                    user = CustomUser.objects.get(email=identifier)

                    # New check: Restrict End Users (role_id=3) from Web login
                    if platform == "web" and user.role and user.role.id == 3:
                        return Response(
                            {"error": "You don't have access to web login."},
                            status=status.HTTP_403_FORBIDDEN
                        )

                    # Check if default location leader (block email login)
                    if user.role and user.role.name == USER_ROLES['LOCATION_LEADER']:
                        employee_id_lower = user.employee_id.lower() if user.employee_id else ''
                        if employee_id_lower.startswith('default_loc'):
                            return Response({"error": "Default location leaders must use phone login. Email login not allowed."}, status=status.HTTP_403_FORBIDDEN)
                    otp_record = OTP.objects.get(email=identifier, otp=input_value)
                    if otp_record.expires_at < timezone.now():
                        otp_record.delete()
                        return Response({'error': 'OTP expired.'}, status=status.HTTP_400_BAD_REQUEST)
                    otp_record.delete()
                except OTP.DoesNotExist:
                    return Response({'error': 'Invalid OTP or email.'}, status=status.HTTP_400_BAD_REQUEST)
                except CustomUser.DoesNotExist:
                    return Response({'error': 'User not found with this email.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Phone/password logic for location leaders
                try:
                    user = CustomUser.objects.get(phone=identifier)
                    if user.disable:
                        return Response({"error": "Your account is disabled. Please contact Admin."}, status=status.HTTP_403_FORBIDDEN)
                    if user.role.name == 'location_leader':
                        leader = LocationLeader.objects.get(user__phone=identifier)
                        if leader.password is None:
                            return Response({'error': 'This location leader cannot login using phone. Use email login instead.'}, status=status.HTTP_400_BAD_REQUEST)
                        if str(input_value) != str(leader.password):  # Compare as strings to be safe
                            return Response({'error': 'Invalid password.'}, status=status.HTTP_400_BAD_REQUEST)
                    elif user.role.name != 'location_leader':
                        return Response({'error': 'For now only location leader can login using mobile number.If you are not a location leader use email id to login'}, status=status.HTTP_400_BAD_REQUEST)
                except LocationLeader.DoesNotExist:
                    return Response({'error': 'Invalid mobile number or password.'}, status=status.HTTP_400_BAD_REQUEST)
            if user:
                # Block archived organization users from logging in
                if user.organization and user.organization.is_archived:
                    return Response(
                        {"error": "Failed to verify OTP. Email does not exist."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                refresh = RefreshToken.for_user(user)
                module_permissions = []
                if user.organization:
                    permissions = ModulePermisions.objects.filter(organization=user.organization, user__isnull=True)
                    module_permissions = ModulePermisionsSerializer(permissions, many=True).data
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user': UserSerializer(user).data,
                    'module_permissions': module_permissions
                }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # Allow authenticated users
    queryset = Departments.objects.all()
    serializer_class = DepartmentsSerializer

    def get_queryset(self):
        """
        Return departments where organization is NULL for the base /api/department/ endpoint.
        For organization-specific endpoints, use DepartmentListByOrganizationOptimized.
        """
        return Departments.objects.filter(organization__isnull=True)

    def create(self, request, *args, **kwargs):
        data = request.data
        if isinstance(data, list):
            # Handle bulk import
            errors = []
            imported_count = 0
            seen_names = set()

            for idx, row in enumerate(data, start=1):
                name = row.get("name", "").strip()
                description = row.get("description", "").strip()
                user_identifier = name if name else f"Row {idx}"

                row_errors = []

                if not name:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": "Name is required."
                    })
                    errors.extend(row_errors)
                    continue

                if name in seen_names:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Departments.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Department '{name}' already exists."
                    })

                if row_errors:
                    errors.extend(row_errors)
                    continue

                try:
                    Departments.objects.create(name=name, description=description)
                    imported_count += 1
                except Exception as e:
                    errors.append({
                        'row': idx,
                        'user': user_identifier,
                        'field': 'general',
                        'message': str(e)
                    })

            if errors:
                return Response({
                    'error': 'Import failed',
                    'errors': errors,
                    'imported_count': imported_count,
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'message': f'Successfully imported {imported_count} departments',
                'imported_count': imported_count,
            }, status=status.HTTP_201_CREATED)
        else:
            # Single create
            # print("request.user.organization ::", request.user.organization)
            # data['organization_id'] = request.user.organization.id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
class DesignationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # Allow authenticated users
    queryset = Designations.objects.all()
    serializer_class = DesignationsSerializer

    def get_queryset(self):
        """
        Return designations where organization is NULL for the base /api/designation/ endpoint.
        For organization-specific endpoints, use DesignationListByOrganizationOptimized.
        """
        return Designations.objects.filter(organization__isnull=True)

    def create(self, request, *args, **kwargs):
        data = request.data
        if isinstance(data, list):
            # Handle bulk import
            errors = []
            imported_count = 0
            seen_names = set()

            for idx, row in enumerate(data, start=1):
                name = row.get("name", "").strip()
                description = row.get("description", "").strip()
                user_identifier = name if name else f"Row {idx}"

                row_errors = []

                if not name:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": "Name is required."
                    })
                    errors.extend(row_errors)
                    continue

                if name in seen_names:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Designations.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Designation '{name}' already exists."
                    })

                if row_errors:
                    errors.extend(row_errors)
                    continue

                try:
                    Designations.objects.create(name=name, description=description)
                    imported_count += 1
                except Exception as e:
                    errors.append({
                        'row': idx,
                        'user': user_identifier,
                        'field': 'general',
                        'message': str(e)
                    })

            if errors:
                return Response({
                    'error': 'Import failed',
                    'errors': errors,
                    'imported_count': imported_count,
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'message': f'Successfully imported {imported_count} designations',
                'imported_count': imported_count,
            }, status=status.HTTP_201_CREATED)
        else:
            # Single create
            # data['organization_id'] = request.user.organization.id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
class LocationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # Allow authenticated users
    queryset = Locations.objects.all()
    serializer_class = LocationsSerializer

    def get_queryset(self):
        """
        Return locations where organization is NULL for the base /api/location/ endpoint.
        For organization-specific endpoints, use LocationListByOrganizationOptimized.
        """
        return Locations.objects.filter(organization__isnull=True)

    def create(self, request, *args, **kwargs):
        data = request.data
        if isinstance(data, list):
            # Handle bulk import
            errors = []
            imported_count = 0
            seen_names = set()

            for idx, row in enumerate(data, start=1):
                name = row.get("name", "").strip()
                description = row.get("description", "").strip()
                user_identifier = name if name else f"Row {idx}"

                row_errors = []

                if not name:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": "Name is required."
                    })
                    errors.extend(row_errors)
                    continue

                if name in seen_names:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Locations.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Location '{name}' already exists."
                    })

                if row_errors:
                    errors.extend(row_errors)
                    continue

                try:
                    Locations.objects.create(name=name, description=description)
                    imported_count += 1
                except Exception as e:
                    errors.append({
                        'row': idx,
                        'user': user_identifier,
                        'field': 'general',
                        'message': str(e)
                    })

            if errors:
                return Response({
                    'error': 'Import failed',
                    'errors': errors,
                    'imported_count': imported_count,
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'message': f'Successfully imported {imported_count} locations',
                'imported_count': imported_count,
            }, status=status.HTTP_201_CREATED)
        else:
            # Single create
            # data['organization_id'] = request.user.organization.id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
class DivisionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # Allow authenticated users
    queryset = Divisions.objects.all()
    serializer_class = DivisionsSerializer

    def get_queryset(self):
        """
        Return divisions where organization is NULL for the base /api/division/ endpoint.
        For organization-specific endpoints, use DivisionListByOrganizationOptimized.
        """
        return Divisions.objects.filter(organization__isnull=True)

    def create(self, request, *args, **kwargs):
        data = request.data
        if isinstance(data, list):
            # Handle bulk import
            errors = []
            imported_count = 0
            seen_names = set()

            for idx, row in enumerate(data, start=1):
                name = row.get("name", "").strip()
                description = row.get("description", "").strip()
                user_identifier = name if name else f"Row {idx}"

                row_errors = []

                if not name:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": "Name is required."
                    })
                    errors.extend(row_errors)
                    continue

                if name in seen_names:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Divisions.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Division '{name}' already exists."
                    })

                if row_errors:
                    errors.extend(row_errors)
                    continue

                try:
                    Divisions.objects.create(name=name, description=description)
                    imported_count += 1
                except Exception as e:
                    errors.append({
                        'row': idx,
                        'user': user_identifier,
                        'field': 'general',
                        'message': str(e)
                    })

            if errors:
                return Response({
                    'error': 'Import failed',
                    'errors': errors,
                    'imported_count': imported_count,
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'message': f'Successfully imported {imported_count} divisions',
                'imported_count': imported_count,
            }, status=status.HTTP_201_CREATED)
        else:
            # Single create
            # print("request.user.organization ::", request.user.organization.id)
            # data['organization_id'] = request.user.organization.id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

class SubDivisionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # Allow authenticated users
    queryset = SubDivisions.objects.all()
    serializer_class = SubDivisionsSerializer

    def get_queryset(self):
        """
        Return subdivisions where organization is NULL for the base /api/subdivision/ endpoint.
        For organization-specific endpoints, use SubDivisionListByOrganizationOptimized.
        """
        return SubDivisions.objects.filter(organization__isnull=True)

    def create(self, request, *args, **kwargs):
        data = request.data
        if isinstance(data, list):
            # Handle bulk import
            errors = []
            imported_count = 0
            seen_names = set()

            for idx, row in enumerate(data, start=1):
                name = row.get("name", "").strip()
                description = row.get("description", "").strip()
                user_identifier = name if name else f"Row {idx}"

                row_errors = []

                if not name:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": "Name is required."
                    })
                    errors.extend(row_errors)
                    continue

                if name in seen_names:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if SubDivisions.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Subdivision '{name}' already exists."
                    })

                if row_errors:
                    errors.extend(row_errors)
                    continue

                try:
                    SubDivisions.objects.create(name=name, description=description)
                    imported_count += 1
                except Exception as e:
                    errors.append({
                        'row': idx,
                        'user': user_identifier,
                        'field': 'general',
                        'message': str(e)
                    })

            if errors:
                return Response({
                    'error': 'Import failed',
                    'errors': errors,
                    'imported_count': imported_count,
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'message': f'Successfully imported {imported_count} subdivisions',
                'imported_count': imported_count,
            }, status=status.HTTP_201_CREATED)
        else:
            # Single create
            # data['organization_id'] = request.user.organization.id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

class UserCreateView(APIView):
    def post(self, request):

        organization_id = request.data.get('organizationId')
        organization = None

        if organization_id:
            try:
                organization = Organization.objects.get(id=organization_id)
            except Organization.DoesNotExist:
                return Response(
                    {"error": f"Organization with id {organization_id} does not exist."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        email = request.data.get("email")
        phone = request.data.get("phone")
        employee_id = request.data.get("employee_id")
        dashboard_access = request.data.get("dashboard_access", False)
        module_access_list = request.data.get("module_access_list", [])

        if not email or not phone:
            return Response({"error": "Both email and phone are required"}, status=400)

        error_fields = []
        if CustomUser.objects.filter(email=email).exists():
            error_fields.append('email')
        if phone and CustomUser.objects.filter(phone=phone).exists():
            error_fields.append('phone')
        if employee_id and CustomUser.objects.filter(employee_id=employee_id).exists():
            error_fields.append('employee id')

        if error_fields:
            field_str = ', '.join(error_fields[:-1]) + (
                f' and {error_fields[-1]}' if len(error_fields) > 1 else ''
            )
            return Response(
                {"error": f"A user with this {field_str} already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )


        # If should promote, update role to admin

        should_promote = dashboard_access or any(
            m.get("access") != "no_access" for m in module_access_list
        )

        if should_promote:
            try:
                admin_role = Role.objects.get(name__iexact="admin")
                request.data["role"] = admin_role.id
            except Role.DoesNotExist:
                return Response({"error": "Admin role not found"}, status=500)

        data = request.data.copy()
        if organization:
            data["organization"] = organization.id

        serializer = UserSerializer(data=data)

        if serializer.is_valid():
            user = serializer.save()
            # Automatically add user to matching rule-based groups
            from .utils import add_user_to_matching_rule_based_groups
            add_user_to_matching_rule_based_groups(user)
            return Response(
                {"message": "User created successfully.", "user": serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




# class UserCreateView(APIView):
#     # permission_classes = [IsAuthenticated, IsSuperAdmin]

#     def post(self, request):
#         try:
#             data = request.data.copy()

#             # ===== Step 1: Create minimal organization =====
#             last_org = Organization.objects.order_by('-id').first()
#             next_org_id = (last_org.id + 1) if last_org else 1

#             organization = Organization.objects.create(
#                 organization_name=f"Temp_Org_{next_org_id}",
#                 organization_description=None,
#                 organization_status="pending",  # Must be valid choice in your model
#                 created_date=timezone.now().date()
#             )

#             # ===== Step 2: Assign org ID to user data =====
#             data["organization"] = organization.id

#             # ===== Step 3: User creation validations =====
#             email = data.get("email")
#             phone = data.get("phone")
#             employee_id = data.get("employee_id")
#             dashboard_access = data.get("dashboard_access", False)
#             module_access_list = data.get("module_access_list", [])

#             if not email or not phone:
#                 organization.delete()  # rollback org creation
#                 return Response(
#                     {"error": "Both email and phone are required"},
#                     status=status.HTTP_400_BAD_REQUEST
#                 )

#             error_fields = []
#             if CustomUser.objects.filter(email=email).exists():
#                 error_fields.append('email')
#             if phone and CustomUser.objects.filter(phone=phone).exists():
#                 error_fields.append('phone')
#             if employee_id and CustomUser.objects.filter(employee_id=employee_id).exists():
#                 error_fields.append('employee id')

#             if error_fields:
#                 organization.delete()  # rollback org creation
#                 field_str = ', '.join(error_fields[:-1]) + (
#                     f' and {error_fields[-1]}' if len(error_fields) > 1 else ''
#                 )
#                 return Response(
#                     {"error": f"A user with this {field_str} already exists."},
#                     status=status.HTTP_400_BAD_REQUEST
#                 )

#             # ===== Step 4: Assign role if needed =====
#             should_promote = dashboard_access or any(
#                 m.get("access") != "no_access" for m in module_access_list
#             )
#             if should_promote:
#                 try:
#                     admin_role = Role.objects.get(name__iexact="admin")
#                     data["role"] = admin_role.id
#                 except Role.DoesNotExist:
#                     organization.delete()  # rollback org creation
#                     return Response(
#                         {"error": "Admin role not found"},
#                         status=status.HTTP_500_INTERNAL_SERVER_ERROR
#                     )

#             # ===== Step 5: Save user =====
#             serializer = UserSerializer(data=data, context={"request": request})
#             if serializer.is_valid():
#                 serializer.save()
#                 return Response(
#                     {
#                         "message": "User and organization created successfully.",
#                         "user": serializer.data,
#                         "organization_id": organization.id
#                     },
#                     status=status.HTTP_201_CREATED
#                 )

#             # Rollback organization if user creation fails
#             organization.delete()
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

#         except Exception as e:
#             logger.error(f"Error creating user with organization: {str(e)}")
#             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class UserListView(APIView):
    permission_classes = [IsEndUserOrSuperAdminOrAdmin]

    def get(self, request):
        print("reques.user ::", request.user)
        users = CustomUser.objects.filter(is_deleted=False, is_archived=False).exclude(role__name=USER_ROLES.SUPER_ADMIN)
        
        filters = {}
        filter_query = request.query_params.get("filter", None)
        
        if filter_query:
            q_objects = Q()
            for each_filter in filter_query.split("|"):
                key, value = each_filter.split(":")
                if value.lower() == "null":
                    q_objects |= Q(**{f"{key}__isnull": True})
                else:
                    q_objects |= Q(**{key: value})

            users = users.filter(q_objects)
        
        # Apply dynamic filters
        users = users.filter(**filters)
        
        
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class OrganizationUserListView(APIView):
    # permission_classes = [IsEndUserOrSuperAdminOrAdmin]
    permission_classes = [AllowAny]

    def get(self, request):
        org_id = request.query_params.get("orgId", None)
        user = request.user  # ✅ get the logged-in user

        try:
            # ✅ If logged-in user is super admin → show all users (null + not null orgs)
            if hasattr(user, "role") and user.role and user.role.name.lower() == "super_admin":
                users = CustomUser.objects.filter(
                    is_deleted=False,
                    is_archived=False
                ).exclude(
                    role__name__iexact="super_admin"  # exclude other super admins
                )

            # ✅ Otherwise, keep existing logic
            elif org_id:
                users = CustomUser.objects.filter(
                    organization_id=org_id,
                    is_deleted=False,
                    is_archived=False
                ).exclude(
                    first_name__isnull=True,
                    last_name__isnull=True,
                    email__isnull=True
                )
            else:
                users = CustomUser.objects.filter(
                    organization_id=request.user.organization_id,
                    is_deleted=False,
                    is_archived=False
                ).exclude(
                    first_name__isnull=True,
                    last_name__isnull=True,
                    email__isnull=True
                )

            serializer = UsersListSerializer(users, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except CustomUser.DoesNotExist:
            return Response({'error': 'Users not found for this organization.'}, status=status.HTTP_404_NOT_FOUND)




class UserDetailView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, pk):
        try:
            user = CustomUser.objects.get(pk=pk, is_deleted=False, is_archived=False)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        try:
            user = CustomUser.objects.get(pk=pk)

            # Preserve user's organization if Super Admin didn't send one
            if "organization" not in request.data or request.data.get("organization") in [None, "", "null"]:
                if user.organization_id:
                    request.data["organization"] = user.organization_id

            # Check if user should be promoted based on new permissions
            should_promote = False
            dashboard_access = request.data.get("dashboard_access", False)
            module_access_list = request.data.get("module_access_list", [])

            if dashboard_access:
                should_promote = True
            else:
                for module in module_access_list:
                    if module.get("access") != "no_access":
                        should_promote = True
                        break

            if should_promote:
                try:
                    admin_role = Role.objects.get(name="admin")
                    request.data["role"] = admin_role.id
                except Role.DoesNotExist:
                    return Response(
                        {"error": "Admin role not found in system"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

            serializer = UserSerializer(user, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                logger.info("User updated successfully: %s", serializer.data)
                
                # Refresh user from database to get updated relationships
                user.refresh_from_db()
                
                print(f"=== ABOUT TO CALL re_evaluate_user_group_membership for user {user.email} ===")
                
                # Re-evaluate user's rule-based group membership after update
                try:
                    re_evaluate_user_group_membership(user)
                    logger.info("User group membership re-evaluated for user: %s", user.email)
                    print(f"=== SUCCESSFULLY CALLED re_evaluate_user_group_membership for user {user.email} ===")
                except Exception as e:
                    logger.error("Error re-evaluating group membership for user %s: %s", user.email, str(e))
                    print(f"=== ERROR in re_evaluate_user_group_membership: {str(e)} ===")
                
                return Response({
                    'message': 'User updated successfully.',
                    'user': serializer.data
                }, status=status.HTTP_200_OK)
            logger.error("Serializer errors: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)


    def delete(self, request, pk):
        try:
            user = CustomUser.objects.get(pk=pk)
            commit_param = request.query_params.get('commit', 'false')
            if commit_param == 'true':
                # Permanently delete the user
                user.delete()
                logger.info("User permanently deleted: %s", pk)
                return Response({'message': 'User permanently deleted.'}, status=status.HTTP_204_NO_CONTENT)
            else:
                # Soft delete
                user.is_deleted = True
                user.deletedBy = request.user
                user.save()
                user.user_groups.clear()
                logger.info("User soft deleted (is_deleted=True): %s", pk)
                return Response({'message': 'User marked as deleted.'}, status=status.HTTP_200_OK)

        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

class UserArchiveView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    def post(self, request, pk):
        try:
            re_active_param = request.query_params.get('re-activate', 'false')
            user = CustomUser.objects.get(pk=pk)
            user.is_archived = False if re_active_param == 'true' else True
            user.archivedBy = request.user if re_active_param == 'false' else None
            user.save()
            
            message = 'User re-activated successfully.' if user.is_archived is False else 'User archived successfully.'
            logger.info(message, "User ID:", pk, "Re-active param:", re_active_param)
            return Response({'message': message}, status=status.HTTP_200_OK)
        
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    
class UserArchiveListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get(self, request):
        try:
            user = CustomUser.objects.filter(is_archived=True)
            serializer = UserSerializer(user, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

class UserDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    def post(self, request, pk):
        try:
            re_active_param = request.query_params.get('re-activate', 'false')
            user = CustomUser.objects.get(pk=pk)
            user.is_deleted = False if re_active_param == 'true' else True
            user.deletedBy = request.user if re_active_param == 'false' else None
            user.save()

            if re_active_param != 'true':
                user.user_groups.clear()
            
            message = 'User re-activated successfully.' if user.is_deleted is False else 'User maked as deleted successfully.'
            logger.info(message, "User ID:", pk, "Re-active param:", re_active_param)
            return Response({'message': message}, status=status.HTTP_200_OK)
        
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

class UserDeletedListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get(self, request):
        try:
            user = CustomUser.objects.filter(is_deleted=True)
            serializer = UserSerializer(user, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)           

class DownloadTemplateView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="bulk_user_import_template.csv"'

        writer = csv.writer(response)
        # Define the headers matching the BulkImportUserSerializer fields
        headers = [
            'firstName', 'lastName', 'countryCode', 'phone', 'designation', 'division','subdivision',
            'location', 'department', 'email', 'dashboardAccess', 'mobileSupervisor'
        ]
        writer.writerow(headers)

        # Fetch the first available department, division, location, and designation for the sample row
        sample_department = Departments.objects.first()
        sample_division = Divisions.objects.first()
        sample_location = Locations.objects.first()
        sample_designation = Designations.objects.first()
        sample_subdivision = SubDivisions.objects.first()

        writer.writerow([
            'John', 'Doe', '+1', '1234567890',
            sample_designation.name if sample_designation else 'Manager',
            sample_division.name if sample_division else 'Sales',
            sample_location.name if sample_location else 'New York',
            sample_department.name if sample_department else 'Marketing',
            sample_subdivision.name if sample_subdivision else 'North America',     
            'john.doe@example.com'
        ])

        return response

class BulkUserValidateView(APIView):
    # permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Handle different request.data types
        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_emails = set()
        seen_phones = set()

        for index, row in enumerate(data, start=2):
            # Use firstName and lastName for user_identifier if available, otherwise email or row number
            first_name = row.get("firstName", "").strip()
            last_name = row.get("lastName", "").strip()
            email = row.get("email", "").strip()
            user_identifier = (
                f"{first_name} {last_name}".strip() if first_name or last_name
                else email if email
                else f"Row {index}"
            )

            row_errors = []

            # Check for duplicates in the current file
            email = email.lower()
            phone = row.get("phone", "").strip()

            if email:
                if email in seen_emails:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "email",
                        "message": f"Duplicate email '{email}' found in the file."
                    })
                else:
                    seen_emails.add(email)

            if phone:
                if phone in seen_phones:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "phone",
                        "message": f"Duplicate phone '{phone}' found in the file."
                    })
                else:
                    seen_phones.add(phone)

            # Check against database
            if email and CustomUser.objects.filter(email=email).exists():
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "email",
                    "message": f"Email '{email}' already exists in the system."
                })

            if phone and CustomUser.objects.filter(phone=phone).exists():
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "phone",
                    "message": f"Phone '{phone}' already exists in the system."
                })

            # Validate foreign key fields by fetching objects dynamically
            for field, model in [
                ("designation", Designations),
                ("division", Divisions),
                ("subdivision", SubDivisions),
                ("location", Locations),
                ("department", Departments),
            ]:
                value = row.get(field, "").strip().lower()
                if value:
                    # Normalize the input value: replace hyphens and underscores with spaces and convert to lowercase
                    normalized_value = value.replace("-", " ").replace("_", " ").strip().title()

                    # Search for a match in either name or description, case-insensitive
                    try:
                        print(f"Validating {field} with value: {value} (normalized: {normalized_value})")
                        print("value :",type(value), "normalized_value :", type(normalized_value))
                        model.objects.get(
                            # name=value,
                            description__iexact=normalized_value
                        )
                    except model.DoesNotExist:
                        row_errors.append({
                            "row": index,
                            "user": user_identifier,
                            "field": field,
                            "message": f"{field.capitalize()} '{value}' does not exist."
                        })

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)

class RegularGroupViewSet(viewsets.ModelViewSet):
    queryset = Groups.objects.filter(type=GROUP_TYPES.NORMAL, is_deleted=False, is_archived=False)
    serializer_class = RegularGroupSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def perform_update(self, serializer):
        serializer.save(type=GROUP_TYPES.NORMAL)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed("DELETE")
    
class RuleBasedGroupViewSet(viewsets.ModelViewSet):
    queryset = Groups.objects.filter(type=GROUP_TYPES.RULEBASED, is_deleted=False, is_archived=False)
    serializer_class = RuleBasedGroupSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def perform_create(self, serializer):
        group = serializer.save(type=GROUP_TYPES.RULEBASED)
        # Automatically sync users when a new rule-based group is created
        try:
            re_evaluate_group_membership(group)
            logger.info("Rule-based group members synced for group: %s", group.name)
        except Exception as e:
            logger.error("Error syncing members for group %s: %s", group.name, str(e))

    def perform_update(self, serializer):
        group = serializer.save(type=GROUP_TYPES.RULEBASED)
        # Automatically sync users when a rule-based group is updated
        try:
            re_evaluate_group_membership(group)
            logger.info("Rule-based group members synced for group: %s", group.name)
        except Exception as e:
            logger.error("Error syncing members for group %s: %s", group.name, str(e))

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed("DELETE")
    
class GroupArchiveListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get(self, request):
        try:
            groups = Groups.objects.filter(is_archived=True)
            serializer = GroupSerializer(groups, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Groups not found.'}, status=status.HTTP_404_NOT_FOUND)

class GroupDeletedListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get(self, request):
        try:
            groups = Groups.objects.filter(is_deleted=True)
            serializer = GroupSerializer(groups, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Groups not found.'}, status=status.HTTP_404_NOT_FOUND)   

class GroupViewSet(viewsets.ModelViewSet):
    # permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    permission_classes = [IsAuthenticated, AllowAny]
    queryset = Groups.objects.filter(is_deleted=False, is_archived=False)
    serializer_class = GroupSerializer

    def get_queryset(self):
        queryset = Groups.objects.filter(is_deleted=False, is_archived=False).prefetch_related(
            'members',
            'conditions',
            'members__department',
            'members__designation',
            'members__location',
            'members__division',
            'members__subdivision'
        )
        org_id = self.kwargs.get("org_id")
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST")

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed("PUT")

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed("DELETE")

class GroupArchiveView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def post(self, request, pk):
        try:
            re_active_param = request.query_params.get('re-activate', 'false')
            group = Groups.objects.get(pk=pk)
            group.is_archived = False if re_active_param == 'true' else True
            group.archivedBy = request.user if re_active_param == 'false' else None
            group.save()
            
            message = 'Group re-activated successfully.' if group.is_archived is False else 'Group archived successfully.'
            print(message, "Group ID:", pk, "Re-active param:", re_active_param)
            return Response({'message': message}, status=status.HTTP_200_OK)
        
        except Groups.DoesNotExist:
            return Response({'error': 'Group not found GroupArchiveView.'}, status=status.HTTP_404_NOT_FOUND)

class GroupDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]
    
    def post(self, request, pk):
        try:
            re_active_param = request.query_params.get('re-activate', 'false')
            group = Groups.objects.get(pk=pk)
            group.is_deleted = False if re_active_param == 'true' else True
            group.deletedBy = request.user if re_active_param == 'false' else None
            group.save()
            
            message = 'Group re-activated successfully.' if group.is_deleted is False else 'Group maked as deleted successfully.'
            print(message, "Group ID:", pk, "Re-active param:", re_active_param)
            return Response({'message': message}, status=status.HTTP_200_OK)
        
        except Groups.DoesNotExist:
            return Response({'error': 'Group not found GroupDeleteView POST.'}, status=status.HTTP_404_NOT_FOUND)
        
    def delete(self, request, pk):
        try:
            group = get_object_or_404(Groups, pk=pk)
            commit_param = request.query_params.get('commit', 'false')
            print("commit_param ", commit_param)
            if commit_param == 'true':
                group.delete()
                logger.info("Group permanently deleted: %s", pk)
                return Response({'message': 'Group permanently deleted.'}, status=status.HTTP_204_NO_CONTENT)
            else:
                # Soft delete
                group.is_deleted = True
                group.deletedBy = request.user
                group.save()
                logger.info("Group soft deleted (is_deleted=True): %s", pk)
                return Response({'message': 'Group marked as deleted.'}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Group not found GroupDeleteView DELETE.'}, status=status.HTTP_404_NOT_FOUND)


class GroupBulkDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        group_ids = request.data.get('group_ids', [])
        re_active_param = request.query_params.get('re-activate', 'false')

        if not isinstance(group_ids, list) or not group_ids:
            return Response({'error': 'Please provide a list of group IDs.'}, status=status.HTTP_400_BAD_REQUEST)

        updated_groups = []
        not_found = []

        for pk in group_ids:
            try:
                group = Groups.objects.get(pk=pk)
                group.is_deleted = False if re_active_param == 'true' else True
                group.save()
                updated_groups.append(pk)
            except Groups.DoesNotExist:
                not_found.append(pk)

        message = 'Groups re-activated successfully.' if re_active_param == 'true' else 'Groups marked as deleted successfully.'
        logger.info("Bulk Group POST: %s", updated_groups)

        return Response({
            'message': message,
            'updated_groups': updated_groups,
            'not_found': not_found
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        group_ids = request.data.get('group_ids', [])
        commit_param = request.query_params.get('commit', 'false')

        if not isinstance(group_ids, list) or not group_ids:
            return Response({'error': 'Please provide a list of group IDs.'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_groups = []
        soft_deleted_groups = []
        not_found = []

        for pk in group_ids:
            try:
                group = Groups.objects.get(pk=pk)
                if commit_param == 'true':
                    group.delete()
                    logger.info("Group permanently deleted: %s", pk)
                    deleted_groups.append(pk)
                else:
                    group.is_deleted = True
                    group.save()
                    logger.info("Group soft deleted (is_deleted=True): %s", pk)
                    soft_deleted_groups.append(pk)
            except Groups.DoesNotExist:
                not_found.append(pk)

        return Response({
            'message': 'Bulk delete operation completed.',
            'deleted_groups': deleted_groups,
            'soft_deleted_groups': soft_deleted_groups,
            'not_found': not_found
        }, status=status.HTTP_200_OK)
    
class OrganizationCreateView(APIView):
    def post(self, request):
        org_id = request.data.get("organizationId")

        if not org_id:
            return Response({"error": "organizationId is required"}, status=400)

        try:
            # Step 1: Find the draft org
            organization = Organization.objects.get(id=org_id)

            # Step 2: Update the existing draft
            serializer = OrganizationSerializer(
                organization, data=request.data, partial=True
            )
            if serializer.is_valid():
                serializer.save(is_draft=False)
                return Response({
                    "message": "Organization finalized successfully",
                    "organization": serializer.data
                }, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=400)

        except Organization.DoesNotExist:
            return Response(
                {"error": f"Organization with id {org_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print("Error in OrganizationCreateView:", e)
            return Response({"error": str(e)}, status=500)


class OrganizationListView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        organizations = Organization.objects.filter(is_archived=False, is_deleted=False)
        serializer = OrganizationListSerializer(organizations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class OrganizationAvailableUsersView(APIView):
    """
    API to get all users belonging to a specific organization (by org id).
    Usage: GET /api/organization/<org_id>/available-users/
    """
    def get(self, request, org_id):
        users = CustomUser.objects.filter(organization_id=org_id, is_deleted=False, is_archived=False)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class AvailableUsersView(APIView):
    """
    GET /api/users/available-users/<int:organization_id>/
    Returns users for the specified organization_id,
    with permission based on the request user's role.
    """

    def get(self, request, organization_id, *args, **kwargs):
        user = request.user

        # Super-admin can view all users
        if getattr(user, 'role', None) and user.role.name == 'super_admin':
            users = CustomUser.objects.filter(is_deleted=False, is_archived=False)

        # Admin can view users in their own organization
        elif getattr(user, 'role', None) and user.role.name == 'admin' and user.organization_id == organization_id:
            users = CustomUser.objects.filter(
                organization_id=organization_id,
                is_deleted=False,
                is_archived=False
            )

        else:
            return Response(
                {'detail': 'Not authorized to view these users.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class OrganizationDetailView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, pk):
        try:
            organization = Organization.objects.get(pk=pk)
            serializer = OrganizationSerializer(organization)
            return Response({
                'message': 'Organization retrieved successfully.',
                'organization': serializer.data
            }, status=status.HTTP_200_OK)
        except Organization.DoesNotExist:
            logger.error("Organization not found: %d", pk)
            return Response({'error': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        try:
            organization = Organization.objects.get(pk=pk)
            serializer = OrganizationSerializer(organization, data=request.data)
            if serializer.is_valid():
                serializer.save()
                logger.info("Organization updated successfully: %s", organization.organization_name)
                return Response({
                    'message': 'Organization updated successfully.',
                    'organization': serializer.data
                }, status=status.HTTP_200_OK)
            logger.error("Serializer errors: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Organization.DoesNotExist:
            logger.error("Organization not found: %d", pk)
            return Response({'error': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            organization = Organization.objects.get(pk=pk)
            serializer = OrganizationSerializer(organization, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                status_message = 'active' if serializer.data['organization_status'] == 'Active' else 'inactive'
                logger.info("Organization %s successfully: %s", status_message, organization.organization_name)
                return Response({
                    'message': f'Organization {status_message} successfully.',
                    'organization': serializer.data
                }, status=status.HTTP_200_OK)
            logger.error("Serializer errors: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Organization.DoesNotExist:
            logger.error("Organization not found: %d", pk)
            return Response({'error': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

class AvailableAdminsView(APIView):
    # permission_classes = [IsAuthenticated ,IsSuperAdmin]

    def get(self, request):
        adminRole = Role.objects.get(name=USER_ROLES['ADMIN'])
        superadminRole = Role.objects.get(name=USER_ROLES['SUPER_ADMIN'])

        print(adminRole, superadminRole)
        admins = CustomUser.objects.filter(role=adminRole) # | CustomUser.objects.filter(role=superadminRole)
        serializer = UserSerializer(admins, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class AvailableEndUserView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        serializer = UserSerializer(
            CustomUser.objects.filter(role=Role.objects.get(name=USER_ROLES['END_USER'])),
            many=True
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

class OrganizationAdminsView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get(self, request, pk):
        try:
            organization = Organization.objects.get(pk=id)
            admins = OrganizationAdmin.objects.filter(organization=organization)
            serializer = OrganizationAdminSerializer(admins, many=True)
            logger.info("Admins retrieved successfully for organization: %s", organization.organization_name)
            return Response({
                'message': 'Admins retrieved successfully.',
                'admins': serializer.data
            }, status=status.HTTP_200_OK)
        except Organization.DoesNotExist:
            logger.error("Organization not found: %d", id)
            return Response({'error': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, pk):
        try:
            organization = Organization.objects.get(pk=id)
            serializer = OrganizationAdminSerializer(data=request.data)
            if serializer.is_valid():
                user_id = serializer.validated_data['user_id']
                try:
                    user = CustomUser.objects.get(id=user_id)
                    if not user.is_admin and not user.is_superadmin:
                        logger.error("User is not an admin or superadmin: %d", user_id)
                        return Response({'error': 'User must be an admin or superadmin.'}, status=status.HTTP_400_BAD_REQUEST)
                    admin, created = OrganizationAdmin.objects.get_or_create(
                        organization=organization,
                        admin_user=user
                    )
                    if not created:
                        logger.warning("Admin already exists for organization: %s, user: %s", organization.organization_name, user.email)
                        return Response({'error': 'Admin already exists for this organization.'}, status=status.HTTP_400_BAD_REQUEST)
                    logger.info("Admin added successfully to organization: %s, user: %s", organization.organization_name, user.email)
                    return Response({
                        'message': 'Admin added successfully.',
                        'admin': OrganizationAdminSerializer(admin).data
                    }, status=status.HTTP_201_CREATED)
                except CustomUser.DoesNotExist:
                    logger.error("User not found: %d", user_id)
                    return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
            logger.error("Serializer errors: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Organization.DoesNotExist:
            logger.error("Organization not found: %d", id)
            return Response({'error': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            organization = Organization.objects.get(pk=id)
            user_id = request.data.get('user_id')
            if not user_id:
                logger.error("User ID not provided for organization: %d", id)
                return Response({'error': 'User ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                admin = OrganizationAdmin.objects.get(organization=organization, admin_user__id=user_id)
                admin.delete()
                logger.info("Admin removed successfully from organization: %s, user_id: %d", organization.organization_name, user_id)
                return Response({'message': 'Admin removed successfully.'}, status=status.HTTP_200_OK)
            except OrganizationAdmin.DoesNotExist:
                logger.error("Admin not found for organization: %d, user_id: %d", id, user_id)
                return Response({'error': 'Admin not found for this organization.'}, status=status.HTTP_404_NOT_FOUND)
            except CustomUser.DoesNotExist:
                logger.error("User not found: %d", user_id)
                return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Organization.DoesNotExist:
            logger.error("Organization not found: %d", pk)
            return Response({'error': 'Organization not found.'}, status=status.HTTP_404_NOT_FOUND)    
        
class RestoreListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get(self, request, type):
        
        if type not in [RESTORE_OPTIONS.ARCHIVED, RESTORE_OPTIONS.DELETED]:
            return Response({"message": "Invalid type only type=archived or type=deleted permit"}, status=status.HTTP_400_BAD_REQUEST)
        
        restoreList = []
        users = CustomUser()
        groups = Groups()
        
        if type == RESTORE_OPTIONS.ARCHIVED:
            users = CustomUser.objects.filter(is_archived=True).exclude(role__name=USER_ROLES['SUPER_ADMIN'])
            groups = Groups.objects.filter(is_archived=True)
            organizations = Organization.objects.filter(is_archived=True)
            
        elif type == RESTORE_OPTIONS.DELETED:
            users = CustomUser.objects.filter(is_deleted=True).exclude(role__name=USER_ROLES['SUPER_ADMIN'])
            groups = Groups.objects.filter(is_deleted=True)
            organizations = Organization.objects.filter(is_deleted=True)

        userSerialize = RestoreUserSerializer(users, many=True)
        groupSerialize = RestoreGroupSerializer(groups, many=True)
        organizationsSerialize = RestoreOrganizationSerializer(organizations, many=True)
        
        restoreList.extend(userSerialize.data)
        restoreList.extend(groupSerialize.data)
        restoreList.extend(organizationsSerialize.data)
        
        return Response(restoreList, status=status.HTTP_200_OK)        

class BulkArchiveView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request, model_type):
        ids = request.data.get('ids', [])
        
        if model_type not in BULK_DELETE_MODELS.ALL_MODELS:
            return Response({"error": "Invalid model type."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not ids:
            return Response({"error": "No IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        if model_type == BULK_DELETE_MODELS.USER:
            users = CustomUser.objects.filter(id__in=ids)
            users.update(is_archived=True, archivedBy=request.user, last_archived_date = timezone.now())
            logger.info("Bulk archive users: %s", ids)
            return Response({"message": "Users marked as archived."}, status=status.HTTP_200_OK)

        elif model_type == BULK_DELETE_MODELS.GROUP:
            groups = Groups.objects.filter(id__in=ids)
            groups.update(is_archived=True, archivedBy=request.user, last_archived_date = timezone.now())
            logger.info("Bulk archive groups: %s", ids)
            return Response({"message": "Groups marked as archived."}, status=status.HTTP_200_OK)
            
        elif model_type == BULK_DELETE_MODELS.ORGANIZATION:
            organizations = Organization.objects.filter(id__in=ids)
            organizations.update(is_archived=True, archivedBy=request.user, last_archived_date = timezone.now())
            logger.info("Bulk archive organizations: %s", ids)
            return Response({"message": "Organizations marked as archived."}, status=status.HTTP_200_OK)

class BulkDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, model_type):
        ids = request.data.get('ids', [])
        commit_param = request.data.get('commit', False)
        
        print("commit_param ", commit_param)
        
        if model_type not in BULK_DELETE_MODELS.ALL_MODELS:
            return Response({"error": "Invalid model type."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not ids:
            return Response({"error": "No IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        if model_type == BULK_DELETE_MODELS.USER:
            if commit_param:
                # Permanently delete users
                CustomUser.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete users: %s", ids)
                return Response({"message": "Users permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                users = CustomUser.objects.filter(id__in=ids)
                users.update(is_deleted=True, deletedBy=request.user, last_deleted_date = timezone.now())
                for user in users:
                    user.user_groups.clear()
                logger.info("Bulk delete users: %s", ids)
                return Response({"message": "Users marked as deleted."}, status=status.HTTP_200_OK)

        elif model_type == BULK_DELETE_MODELS.GROUP:
            if commit_param:
                # Permanently delete groups
                Groups.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete groups: %s", ids)
                return Response({"message": "Groups permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                groups = Groups.objects.filter(id__in=ids)
                groups.update(is_deleted=True, deletedBy=request.user, last_deleted_date = timezone.now())
                logger.info("Bulk delete groups: %s", ids)
                return Response({"message": "Groups marked as deleted."}, status=status.HTTP_200_OK)
            
        elif model_type == BULK_DELETE_MODELS.ORGANIZATION:
            if commit_param:
                # Permanently delete organizations
                Organization.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete organizations: %s", ids)
                return Response({"message": "Organizations permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                organizations = Organization.objects.filter(id__in=ids)
                organizations.update(is_deleted=True, deletedBy=request.user, last_deleted_date = timezone.now())
                logger.info("Bulk delete organizations: %s", ids)
                return Response({"message": "Organizations marked as deleted."}, status=status.HTTP_200_OK)

        elif model_type == BULK_DELETE_MODELS.DESIGNATION:
            if commit_param:
                # Permanently delete designations
                Designations.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete designations: %s", ids)
                return Response({"message": "Designations permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                return Response({"error": "Bulk delete is only supported with commit=True for designations."}, status=status.HTTP_400_BAD_REQUEST)

        elif model_type == BULK_DELETE_MODELS.DIVISION:
            if commit_param:
                # Permanently delete divisions
                Divisions.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete divisions: %s", ids)
                return Response({"message": "Divisions permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                return Response({"error": "Bulk delete is only supported with commit=True for divisions."}, status=status.HTTP_400_BAD_REQUEST)

        elif model_type == BULK_DELETE_MODELS.LOCATION:
            if commit_param:
                # Permanently delete locations
                Locations.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete locations: %s", ids)
                return Response({"message": "Locations permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                return Response({"error": "Bulk delete is only supported with commit=True for locations."}, status=status.HTTP_400_BAD_REQUEST)

        elif model_type == BULK_DELETE_MODELS.SUBDIVISION:
            if commit_param:
                # Permanently delete subdivisions
                SubDivisions.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete subdivisions: %s", ids)
                return Response({"message": "Subdivisions permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                return Response({"error": "Bulk delete is only supported with commit=True for subdivisions."}, status=status.HTTP_400_BAD_REQUEST)

        elif model_type == BULK_DELETE_MODELS.DEPARTMENT:
            if commit_param:
                # Permanently delete departments
                Departments.objects.filter(id__in=ids).delete()
                logger.info("Bulk permanently delete departments: %s", ids)
                return Response({"message": "Departments permanently deleted."}, status=status.HTTP_204_NO_CONTENT)
            else:
                return Response({"error": "Bulk delete is only supported with commit=True for departments."}, status=status.HTTP_400_BAD_REQUEST)


        return Response({"error": "Invalid model type or no IDs provided."}, status=status.HTTP_400_BAD_REQUEST)
    
class GroupChatStatusView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def post(self, request):
        isChatEnabled = request.data.get('isChatEnabled', False)
        ids = request.data.get('ids', [])
        
        if not ids:
            return Response({"error": "No IDs provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not isinstance(isChatEnabled, bool):
            return Response({"error": "isChatEnabled must be a boolean."}, status=status.HTTP_400_BAD_REQUEST)
        
        groups = Groups.objects.filter(id__in=ids)
        if not groups.exists():
            return Response({"error": "No groups found with the provided IDs."}, status=status.HTTP_404_NOT_FOUND)
        
        groups.update(allow_chat=isChatEnabled)
        logger.info("Group chat status updated for groups: %s", ids)
        return Response({"message": "Group chat status updated successfully."}, status=status.HTTP_200_OK)

class EmailCSVView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        try:
            email = request.query_params.get('email', None)
            if not email:
                return Response({"error": "Email parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            users = CustomUser.objects.filter(
                is_deleted=False,
                is_archived=False,
            ).values(
                'id', 'email', 'username', 'first_name', 'last_name', 'role__name',
                'country_code', 'phone', 'dashboard_access', 'mobile_supervisor',
                'designation__name', 'division__name', 'subdivision__name', 'location__name', 'department__name', 'organization__organization_name'
            )
            
            if not users.exists():
                return Response({"error": "No active users found."}, status=status.HTTP_404_NOT_FOUND)
            
            # Create a CSV response
            buffer = io.StringIO()
            
            writer = csv.writer(buffer)
            writer.writerow([
                'ID', 'Email', 'Username', 'First Name', 'Last Name', 'Role',
                'Country Code', 'Phone', 'Dashboard Access', 'Mobile Supervisor',
                'Designation', 'Division', 'subdivision', 'Location', 'Department', "Organization"
            ])
            for user in users:
                writer.writerow([
                    user['id'], user['email'], user['username'], user['first_name'],
                    user['last_name'], user['role__name'], user['country_code'],
                    user['phone'], user['dashboard_access'], user['mobile_supervisor'],
                    user['designation__name'], user['division__name'],user['subdivision__name'],
                    user['location__name'], user['department__name'], user['organization__organization_name']
                ])
            buffer.seek(0)

            timestamp = datetime.now().strftime("%d_%m_%y_%H_%M")
            filename = f"{timestamp}_vibro_users.csv"
            send_csv_email(email, buffer, filename=filename)
            return Response({"message": f"CSV sent to {email}."}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error("Error generating CSV file: %s", str(e))
            return Response({"error": "An error occurred while generating the CSV file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class DownloadTemplateView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="bulk_user_import_template.csv"'

        writer = csv.writer(response)
        # Define the headers matching the BulkImportUserSerializer fields
        headers = [
            'firstName', 'lastName', 'countryCode', 'phone', 'designation', 'division','subdivision',
            'location', 'department', 'email', 'employeeId'
        ]
        writer.writerow(headers)

        # Fetch the first available department, division, location, and designation for the sample row
        sample_department = Departments.objects.first()
        sample_division = Divisions.objects.first()
        sample_subdivision = SubDivisions.objects.first()
        sample_location = Locations.objects.first()
        sample_designation = Designations.objects.first()

        writer.writerow([
            'John', 'Doe', '+1', '1234567890',
            sample_designation.name if sample_designation else 'Manager',
            sample_division.name if sample_division else 'Sales',
            sample_subdivision.name if sample_subdivision else 'North America',
            sample_location.name if sample_location else 'New York',
            sample_department.name if sample_department else 'Marketing',
            'john.doe@example.com'
        ])

        return response

class BulkUserValidateView(APIView):
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Handle different request.data types
        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_emails = set()
        seen_phones = set()
        seen_employee_ids = set()
        seen_ = set()

        for index, row in enumerate(data, start=2):
            first_name = row.get("firstName", "").strip()
            last_name = row.get("lastName", "").strip()
            email = row.get("email", "").strip().lower()
            phone = row.get("phone", "").strip()
            employee_id = row.get("employeeId", "").strip()
            user_identifier = (
                f"{first_name} {last_name}".strip() if first_name or last_name
                else email if email
                else f"Row {index}"
            )

            row_errors = []

            # Only check for duplicate email/phone
            if email:
                if email in seen_emails:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "email",
                        "message": f"Duplicate email '{email}' found in the file."
                    })
                else:
                    seen_emails.add(email)
            if phone:
                if phone in seen_phones:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "phone",
                        "message": f"Duplicate phone '{phone}' found in the file."
                    })
                else:
                    seen_phones.add(phone)
            
            if employee_id:
                if employee_id in seen_employee_ids:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "employeeId",
                        "message": f"Duplicate employeeId '{employee_id}' found in the file."
                    })
                else:
                    seen_employee_ids.add(employee_id)

            # DB duplicate checks
            db_duplicate_fields = []
            if email and CustomUser.objects.filter(email=email).exists():
                db_duplicate_fields.append('email')
            
            if phone and CustomUser.objects.filter(phone=phone).exists():
                db_duplicate_fields.append('phone')

            if employee_id and CustomUser.objects.filter(employee_id=employee_id).exists():
                db_duplicate_fields.append('employeeId')

            if db_duplicate_fields:
                if len(db_duplicate_fields) > 1:
                    field_str = ', '.join(db_duplicate_fields[:-1]) + f' and {db_duplicate_fields[-1]}'
                else:
                    field_str = db_duplicate_fields[0]
                
                message = f"A user with this {field_str} already exists in the system."
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": ", ".join(db_duplicate_fields),
                    "message": message
                })

            # DO NOT validate FK fields here!

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)

class BulkUserImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Determine organization to assign users to
        org_to_use = request.user.organization  # Default: user's own organization
        if request.user.role.name.lower() == 'super_admin':
            # Super admin can specify organization via organizationId
            org_id = request.data.get('organizationId')
            if org_id:
                try:
                    org_to_use = Organization.objects.get(id=org_id, is_deleted=False, is_archived=False)
                except Organization.DoesNotExist:
                    return Response({"error": f"Organization with id {org_id} does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        # Handle different request.data types
        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        imported_count = 0
        failed_records = []
        seen_emails = set()
        seen_phones = set()
        seen_employee_ids = set()

        for idx, row in enumerate(data, start=2):
            first_name = row.get("firstName", "").strip()
            last_name = row.get("lastName", "").strip()
            email = row.get("email", "").strip().lower()
            phone = row.get("phone", "").strip()
            employee_id = row.get("employeeId", "").strip()
            user_identifier = (
                f"{first_name} {last_name}".strip() if first_name or last_name
                else email if email
                else f"Row {idx}"
            )

            # Duplicate check in file
            row_errors = []
            if email:
                if email in seen_emails:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "email",
                        "message": f"Duplicate email '{email}' found in the file."
                    })
                else:
                    seen_emails.add(email)
            if phone:
                if phone in seen_phones:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "phone",
                        "message": f"Duplicate phone '{phone}' found in the file."
                    })
                else:
                    seen_phones.add(phone)
            
            if employee_id:
                if employee_id in seen_employee_ids:
                    row_errors.append({
                        "row": idx,
                        "user": user_identifier,
                        "field": "employeeId",
                        "message": f"Duplicate employeeId '{employee_id}' found in the file."
                    })
                else:
                    seen_employee_ids.add(employee_id)

            # Duplicate check in DB
            db_duplicate_fields = []
            if email and CustomUser.objects.filter(email=email).exists():
                db_duplicate_fields.append('email')
            
            if phone and CustomUser.objects.filter(phone=phone).exists():
                db_duplicate_fields.append('phone')

            if employee_id and CustomUser.objects.filter(employee_id=employee_id).exists():
                db_duplicate_fields.append('employeeId')

            if db_duplicate_fields:
                if len(db_duplicate_fields) > 1:
                    field_str = ', '.join(db_duplicate_fields[:-1]) + f' and {db_duplicate_fields[-1]}'
                else:
                    field_str = db_duplicate_fields[0]
                
                message = f"A user with this {field_str} already exists in the system."
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": ", ".join(db_duplicate_fields),
                    "message": message
                })

            if row_errors:
                errors.extend(row_errors)
                continue  # Skip this row

            # Handle FK fields: get or create, assign ID
            user_data = {
                "first_name": first_name,
                "last_name": last_name,
                "country_code": row.get("countryCode", "").strip(),
                "phone": phone,
                "email": email,
                "employee_id": employee_id,
                "mobile_supervisor": True,
            }
            for field, model in [
                ("designation", Designations),
                ("division", Divisions),
                ("subdivision", SubDivisions),
                ("location", Locations),
                ("department", Departments),
            ]:
                value = row.get(field, "").strip()
                if value:
                    normalized_value = value.replace("-", " ").replace("_", " ").strip()
                    obj = model.objects.filter(
                        name__iexact=normalized_value,
                        organization=org_to_use
                    ).first()
                    if not obj:
                        obj = model.objects.create(
                            name=normalized_value,
                            description=normalized_value.title(),
                            organization=org_to_use
                        )
                    user_data[field] = obj
                else:
                    user_data[field] = None

            # Set username (required)
            user_data["username"] = email or phone

            # Set default role (end_user) and organization
            end_user_role = Role.objects.get(name="end_user")
            user_data["role"] = end_user_role
            user_data["organization"] = org_to_use

            try:
                user = CustomUser.objects.create(**user_data)
                # Automatically add user to matching rule-based groups
                from .utils import add_user_to_matching_rule_based_groups
                add_user_to_matching_rule_based_groups(user)
                imported_count += 1
            except Exception as e:
                failed_records.append({
                    'row': idx,
                    'user': user_identifier,
                    'field': 'general',
                    'message': str(e)
                })
                logger.error("Failed to import user at row %d: %s", idx, str(e))

        if errors or failed_records:
            return Response({
                'error': 'Validation failed' if errors else 'Import completed with some errors',
                'errors': errors + failed_records,
                'imported_count': imported_count,
                'failed_count': len(errors) + len(failed_records),
            }, status=status.HTTP_400_BAD_REQUEST if errors else status.HTTP_201_CREATED)

        return Response({
            'message': f'Successfully imported {imported_count} users',
            'imported_count': imported_count,
            'failed_count': 0,
            'failed_records': [],
        }, status=status.HTTP_201_CREATED)
    
class OrganizationBulkStatusView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        organization_ids = request.data.get('organization_ids', [])
        activate_param = request.query_params.get('activate', 'false')

        if not isinstance(organization_ids, list) or not organization_ids:
            return Response(
                {'error': 'Please provide a list of organization IDs.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_organizations = []
        not_found = []

        for pk in organization_ids:
            try:
                organization = Organization.objects.get(pk=pk)
                organization.is_archived = False
                organization.save()
                updated_organizations.append(pk)
            except Organization.DoesNotExist:
                not_found.append(pk)

        message = 'Organizations activated successfully.' if activate_param == 'true' else 'Organizations deactivated successfully.'
        logger.info("Bulk Organization Status Update: %s", updated_organizations)

        return Response({
            'message': message,
            'updated_organizations': updated_organizations,
            'not_found': not_found
        }, status=status.HTTP_200_OK)


class PromoteToLocationLeaderView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]  # Ensure IsAdmin is imported

    def post(self, request):
        serializer = PromoteToLocationLeaderSerializer(data=request.data)
        if serializer.is_valid():
            user_ids = serializer.validated_data['user_ids']
            password = serializer.validated_data.get('password')  # May be None
            password_int = int(password) if password else None
            # Fetch the location_leader role dynamically
            location_leader_role = Role.objects.get(name=USER_ROLES['LOCATION_LEADER'])
            promoted_count = 0
            for user_id in user_ids:
                user = CustomUser.objects.get(id=user_id)
                # Determine if default based on prefix
                employee_id_lower = user.employee_id.lower() if user.employee_id else ''
                is_default = employee_id_lower.startswith('default_loc')
                password_to_set = password_int if is_default else None
                user.role = location_leader_role
                user.save()
                LocationLeader.objects.update_or_create(
                    user=user,
                    defaults={
                        'organization': user.organization,
                        # 'location': user.location,  # Map to user's existing location
                        'password': password_to_set,  # Set based on type
                        'promoted_at': timezone.now(),
                        'promoted_by': request.user,
                        'is_default': bool(password_to_set)
                    }
                )
                logger.info("User promoted to location leader: %s", user.id)
                promoted_count += 1
            return Response({
                'message': f'{promoted_count} users promoted to location leader successfully.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DePromoteLocationLeaderView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
            if user.role.name != USER_ROLES['LOCATION_LEADER']:
                return Response({'error': 'User is not a location leader.'}, status=status.HTTP_400_BAD_REQUEST)
            user_role = Role.objects.get(name=USER_ROLES['END_USER'])  # Change to end_user (role ID 3)
            user.role = user_role
            user.save()
            LocationLeader.objects.filter(user=user).delete()  # Remove location leader entry
            logger.info("User demoted from location leader: %s", user_id)
            return Response({'message': 'User demoted from location leader successfully.'}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_400_BAD_REQUEST)

class ReassignLocationLeaderView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        serializer = ReassignLocationLeaderSerializer(data=request.data)
        if serializer.is_valid():
            new_user_id = serializer.validated_data['new_user_id']
            location_id = serializer.validated_data['location_id']  # Optional, if location changes
            current_leader = LocationLeader.objects.get(user__id=user_id)
            new_user = CustomUser.objects.get(id=new_user_id)
            location_leader_role = Role.objects.get(name=USER_ROLES['LOCATION_LEADER'])
            new_user.role = location_leader_role
            new_user.save()
            LocationLeader.objects.update_or_create(
                user=new_user,
                defaults={
                    'organization': current_leader.organization,
                    'password': current_leader.password,  # Retain old password or allow new one
                    'promoted_at': timezone.now(),
                    'promoted_by': request.user
                }
            )
            current_leader.delete()  # Remove the old leader entry
            logger.info("Location leader reassigned from user %s to %s", user_id, new_user_id)
            return Response({'message': 'Location leader reassigned successfully.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LocationLeaderListView(APIView):
    permission_classes = [IsAuthenticated, IsEndUserOrSuperAdminOrAdmin]  # Purpose: End users, admins, and super admins can view

    def get(self, request):
        leaders = LocationLeader.objects.all()  # Purpose: Fetch all location leaders
        serializer = LocationLeaderSerializer(leaders, many=True)  # Purpose: Serialize with expanded FKs
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrganizationListByUserView(APIView):
    """
    API to get organizations based on user ID.
    Usage: GET /api/organization/list-by-user/<user_id>/
    """
    # permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, user_id):
        try:
            # Get the user first
            user = CustomUser.objects.get(id=user_id, is_deleted=False, is_archived=False)
            
            # Get the organization for this user
            if user.organization:
                organizations = Organization.objects.filter(
                    id=user.organization.id,
                    is_archived=False, 
                    is_deleted=False
                )
                serializer = OrganizationSerializer(organizations, many=True)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                return Response({'message': 'User has no organization assigned.'}, status=status.HTTP_404_NOT_FOUND)
                
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class NextOrganizationIdView(APIView):
    def post(self, request):
        try:
            # Step 1: Find the current max ID
            last_org = Organization.objects.order_by('-id').first()
            next_id = (last_org.id + 1) if last_org else 1

            # Step 2: Create a new draft entry
            org = Organization.objects.create(
                id=next_id,
                organization_name=None,
                organization_description=None,
                is_draft=True
            )

            return Response({
                "nextOrgId": org.id,
                "message": "New draft organization created."
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print("Error in NextOrganizationIdView:", e)
            return Response(
                {"error": "Unable to generate next organization ID."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrganizationUsersOnlyView(APIView):
    permission_classes = [IsEndUserOrSuperAdminOrAdmin]

    def get(self, request):
        org_id = request.query_params.get("orgId", None)

        if not org_id:
            return Response({"error": "Organization ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            users = CustomUser.objects.filter(
                organization_id=org_id,
                is_deleted=False,
                is_archived=False
            ).exclude(
                Q(first_name__isnull=True) & Q(last_name__isnull=True) & Q(email__isnull=True)
            )

            serializer = UserSerializer(users, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except CustomUser.DoesNotExist:
            return Response({'error': 'Users not found for this organization.'}, status=status.HTTP_404_NOT_FOUND)
        

class DeleteDraftOrganizationView(APIView):
    """
    Delete only draft organizations (created via NextOrganizationIdView),
    along with any users linked to them.
    """

    def delete(self, request, org_id):
        try:
            # Step 1: Check if the organization exists and is a draft
            organization = Organization.objects.filter(id=org_id, is_draft=True).first()
            if not organization:
                return Response(
                    {"error": f"Organization with id {org_id} not found or not a draft."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Step 2: Delete any users linked to this org
            CustomUser.objects.filter(organization=organization).delete()

            # Step 3: Delete the draft org itself
            organization.delete()

            return Response(
                {"message": f"Draft organization (ID: {org_id}) and related users deleted successfully."},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            print("Error in DeleteDraftOrganizationView:", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class BulkDesignationValidateView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_names = set()

        for index, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            user_identifier = name if name else f"Row {index}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })

            if name:
                if name in seen_names:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Designations.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Designation '{name}' already exists."
                    })

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)


class BulkDesignationImportView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        imported_count = 0
        seen_names = set()

        for idx, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            description = row.get("description", "").strip()
            user_identifier = name if name else f"Row {idx}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })
                errors.extend(row_errors)
                continue

            if name in seen_names:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Duplicate name '{name}' found in the file."
                })
            else:
                seen_names.add(name)

            if Designations.objects.filter(name__iexact=name).exists():
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Designation '{name}' already exists."
                })

            if row_errors:
                errors.extend(row_errors)
                continue

            try:
                Designations.objects.create(name=name, description=description)
                imported_count += 1
            except Exception as e:
                errors.append({
                    'row': idx,
                    'user': user_identifier,
                    'field': 'general',
                    'message': str(e)
                })

        if errors:
            return Response({
                'error': 'Import failed',
                'errors': errors,
                'imported_count': imported_count,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'Successfully imported {imported_count} designations',
            'imported_count': imported_count,
        }, status=status.HTTP_201_CREATED)




class BulkDivisionValidateView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_names = set()

        for index, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            user_identifier = name if name else f"Row {index}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })

            if name:
                if name in seen_names:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Divisions.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Division '{name}' already exists."
                    })

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)


class BulkDivisionImportView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        imported_count = 0
        seen_names = set()

        for idx, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            description = row.get("description", "").strip()
            user_identifier = name if name else f"Row {idx}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })
                errors.extend(row_errors)
                continue

            if name in seen_names:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Duplicate name '{name}' found in the file."
                })
            else:
                seen_names.add(name)

            if Divisions.objects.filter(name__iexact=name).exists():
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Division '{name}' already exists."
                })

            if row_errors:
                errors.extend(row_errors)
                continue

            try:
                Divisions.objects.create(name=name, description=description)
                imported_count += 1
            except Exception as e:
                errors.append({
                    'row': idx,
                    'user': user_identifier,
                    'field': 'general',
                    'message': str(e)
                })

        if errors:
            return Response({
                'error': 'Import failed',
                'errors': errors,
                'imported_count': imported_count,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'Successfully imported {imported_count} divisions',
            'imported_count': imported_count,
        }, status=status.HTTP_201_CREATED)



class BulkLocationValidateView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_names = set()

        for index, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            user_identifier = name if name else f"Row {index}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })

            if name:
                if name in seen_names:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Locations.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Location '{name}' already exists."
                    })

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)


class BulkLocationImportView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        imported_count = 0
        seen_names = set()

        for idx, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            description = row.get("description", "").strip()
            user_identifier = name if name else f"Row {idx}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })
                errors.extend(row_errors)
                continue

            if name in seen_names:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Duplicate name '{name}' found in the file."
                })
            else:
                seen_names.add(name)

            if Locations.objects.filter(name__iexact=name).exists():
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Location '{name}' already exists."
                })

            if row_errors:
                errors.extend(row_errors)
                continue

            try:
                Locations.objects.create(name=name, description=description)
                imported_count += 1
            except Exception as e:
                errors.append({
                    'row': idx,
                    'user': user_identifier,
                    'field': 'general',
                    'message': str(e)
                })

        if errors:
            return Response({
                'error': 'Import failed',
                'errors': errors,
                'imported_count': imported_count,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'Successfully imported {imported_count} locations',
            'imported_count': imported_count,
        }, status=status.HTTP_201_CREATED)



class BulkSubdivisionValidateView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_names = set()

        for index, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            user_identifier = name if name else f"Row {index}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })

            if name:
                if name in seen_names:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if SubDivisions.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Subdivision '{name}' already exists."
                    })

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)


class BulkSubdivisionImportView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        imported_count = 0
        seen_names = set()

        for idx, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            description = row.get("description", "").strip()
            user_identifier = name if name else f"Row {idx}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })
                errors.extend(row_errors)
                continue

            if name in seen_names:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Duplicate name '{name}' found in the file."
                })
            else:
                seen_names.add(name)

            if SubDivisions.objects.filter(name__iexact=name).exists():
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Subdivision '{name}' already exists."
                })

            if row_errors:
                errors.extend(row_errors)
                continue

            try:
                SubDivisions.objects.create(name=name, description=description)
                imported_count += 1
            except Exception as e:
                errors.append({
                    'row': idx,
                    'user': user_identifier,
                    'field': 'general',
                    'message': str(e)
                })

        if errors:
            return Response({
                'error': 'Import failed',
                'errors': errors,
                'imported_count': imported_count,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'Successfully imported {imported_count} subdivisions',
            'imported_count': imported_count,
        }, status=status.HTTP_201_CREATED)


class DownloadDepartmentTemplateView(APIView):
    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="bulk_department_import_template.csv"'

        writer = csv.writer(response)
        headers = ['name', 'description']
        writer.writerow(headers)

        writer.writerow(['Marketing', 'Marketing Department'])

        return response


class BulkDepartmentValidateView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        seen_names = set()

        for index, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            user_identifier = name if name else f"Row {index}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": index,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })

            if name:
                if name in seen_names:
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Duplicate name '{name}' found in the file."
                    })
                else:
                    seen_names.add(name)

                if Departments.objects.filter(name__iexact=name).exists():
                    row_errors.append({
                        "row": index,
                        "user": user_identifier,
                        "field": "name",
                        "message": f"Department '{name}' already exists."
                    })

            errors.extend(row_errors)

        if errors:
            return Response({"error": "Validation failed", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Validation successful", "errors": []}, status=status.HTTP_200_OK)


class BulkDepartmentImportView(APIView):
    def post(self, request):
        data = request.data
        if not data:
            return Response({"error": "No data provided"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if isinstance(data, str):
            data = json.loads(data)

        errors = []
        imported_count = 0
        seen_names = set()

        for idx, row in enumerate(data, start=2):
            name = row.get("name", "").strip()
            description = row.get("description", "").strip()
            user_identifier = name if name else f"Row {idx}"

            row_errors = []

            if not name:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": "Name is required."
                })
                errors.extend(row_errors)
                continue

            if name in seen_names:
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Duplicate name '{name}' found in the file."
                })
            else:
                seen_names.add(name)

            if Departments.objects.filter(name__iexact=name).exists():
                row_errors.append({
                    "row": idx,
                    "user": user_identifier,
                    "field": "name",
                    "message": f"Department '{name}' already exists."
                })

            if row_errors:
                errors.extend(row_errors)
                continue

            try:
                Departments.objects.create(name=name, description=description)
                imported_count += 1
            except Exception as e:
                errors.append({
                    'row': idx,
                    'user': user_identifier,
                    'field': 'general',
                    'message': str(e)
                })

        if errors:
            return Response({
                'error': 'Import failed',
                'errors': errors,
                'imported_count': imported_count,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f'Successfully imported {imported_count} departments',
            'imported_count': imported_count,
        }, status=status.HTTP_201_CREATED)


class LocationListByOrganizationOptimized(APIView):
    """
    Returns distinct locations for a given organization, derived from users
    belonging to that organization. This mirrors the optimization approach used
    in OrganizationUserListViewOptimized by avoiding N+1 lookups and only
    fetching fields we need.
    """
    permission_classes = [AllowAny]

    def get(self, request, organization_id):
        try:
            # Derive locations via users scoped to the organization, excluding deleted/archived users
            user_qs = (
                CustomUser.objects
                .filter(
                    organization_id=organization_id,
                    is_deleted=False,
                    is_archived=False,
                    location__isnull=False
                )
                .select_related('location')
                .only('id', 'location__id', 'location__name', 'location__description')
            )

            # Collect distinct location IDs while using the select_related cache
            location_ids = (
                user_qs
                .values_list('location_id', flat=True)
                .distinct()
            )

            locations_qs = (
                Locations.objects
                .filter(organization_id=organization_id)
                .only('id', 'name', 'description')
                .order_by('name')
            )

            serializer = LocationsSerializer(locations_qs, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in LocationListByOrganizationOptimized: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching locations.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, organization_id):
        try:
            # Verify organization exists
            from .models import Organization
            organization = Organization.objects.get(id=organization_id, is_deleted=False, is_archived=False)
        except Organization.DoesNotExist:
            return Response({'error': f'Organization with id {organization_id} does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(request.data, list):
            # Handle bulk creation
            created_items = []
            errors = []

            for idx, item_data in enumerate(request.data, start=1):
                # Add organization to each item
                item_data_copy = item_data.copy()
                item_data_copy['organization'] = organization_id

                serializer = LocationsSerializer(data=item_data_copy)
                if serializer.is_valid():
                    serializer.save()
                    created_items.append(serializer.data)
                else:
                    errors.append({
                        'index': idx,
                        'data': item_data,
                        'errors': serializer.errors
                    })

            if errors:
                return Response({
                    'message': f'Created {len(created_items)} locations, {len(errors)} failed',
                    'created': created_items,
                    'errors': errors
                }, status=status.HTTP_207_MULTI_STATUS)

            return Response({
                'message': f'Successfully created {len(created_items)} locations',
                'created': created_items
            }, status=status.HTTP_201_CREATED)
        else:
            # Handle single creation
            data = request.data.copy()
            data['organization'] = organization_id

            serializer = LocationsSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DepartmentListByOrganizationOptimized(APIView):
    permission_classes = [AllowAny]

    def get(self, request, organization_id):
        try:
            user_qs = (
                CustomUser.objects
                .filter(
                    organization_id=organization_id,
                    is_deleted=False,
                    is_archived=False,
                    department__isnull=False
                )
                .select_related('department')
                .only('id', 'department__id', 'department__name', 'department__description')
            )
            department_ids = user_qs.values_list('department_id', flat=True).distinct()
            departments_qs = Departments.objects.filter(organization_id=organization_id).only('id', 'name', 'description').order_by('name')
            serializer = DepartmentsSerializer(departments_qs, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in DepartmentListByOrganizationOptimized: {str(e)}")
            return Response({'error': 'An error occurred while fetching departments.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, organization_id):
        try:
            # Verify organization exists
            from .models import Organization
            organization = Organization.objects.get(id=organization_id, is_deleted=False, is_archived=False)
        except Organization.DoesNotExist:
            return Response({'error': f'Organization with id {organization_id} does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(request.data, list):
            # Handle bulk creation
            created_items = []
            errors = []

            for idx, item_data in enumerate(request.data, start=1):
                # Add organization to each item
                item_data_copy = item_data.copy()
                item_data_copy['organization'] = organization_id

                serializer = DepartmentsSerializer(data=item_data_copy)
                if serializer.is_valid():
                    serializer.save()
                    created_items.append(serializer.data)
                else:
                    errors.append({
                        'index': idx,
                        'data': item_data,
                        'errors': serializer.errors
                    })

            if errors:
                return Response({
                    'message': f'Created {len(created_items)} departments, {len(errors)} failed',
                    'created': created_items,
                    'errors': errors
                }, status=status.HTTP_207_MULTI_STATUS)

            return Response({
                'message': f'Successfully created {len(created_items)} departments',
                'created': created_items
            }, status=status.HTTP_201_CREATED)
        else:
            # Handle single creation
            data = request.data.copy()
            data['organization'] = organization_id

            serializer = DepartmentsSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DesignationListByOrganizationOptimized(APIView):
    permission_classes = [AllowAny]

    def get(self, request, organization_id):
        try:
            user_qs = (
                CustomUser.objects
                .filter(
                    organization_id=organization_id,
                    is_deleted=False,
                    is_archived=False,
                    designation__isnull=False
                )
                .select_related('designation')
                .only('id', 'designation__id', 'designation__name', 'designation__description')
            )
            designation_ids = user_qs.values_list('designation_id', flat=True).distinct()
            designations_qs = Designations.objects.filter(organization_id=organization_id).only('id', 'name', 'description').order_by('name')
            serializer = DesignationsSerializer(designations_qs, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in DesignationListByOrganizationOptimized: {str(e)}")
            return Response({'error': 'An error occurred while fetching designations.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, organization_id):
        try:
            # Verify organization exists
            from .models import Organization
            organization = Organization.objects.get(id=organization_id, is_deleted=False, is_archived=False)
        except Organization.DoesNotExist:
            return Response({'error': f'Organization with id {organization_id} does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(request.data, list):
            # Handle bulk creation
            created_items = []
            errors = []

            for idx, item_data in enumerate(request.data, start=1):
                # Add organization to each item
                item_data_copy = item_data.copy()
                item_data_copy['organization'] = organization_id

                serializer = DesignationsSerializer(data=item_data_copy)
                if serializer.is_valid():
                    serializer.save()
                    created_items.append(serializer.data)
                else:
                    errors.append({
                        'index': idx,
                        'data': item_data,
                        'errors': serializer.errors
                    })

            if errors:
                return Response({
                    'message': f'Created {len(created_items)} designations, {len(errors)} failed',
                    'created': created_items,
                    'errors': errors
                }, status=status.HTTP_207_MULTI_STATUS)

            return Response({
                'message': f'Successfully created {len(created_items)} designations',
                'created': created_items
            }, status=status.HTTP_201_CREATED)
        else:
            # Handle single creation
            data = request.data.copy()
            data['organization'] = organization_id

            serializer = DesignationsSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DivisionListByOrganizationOptimized(APIView):
    permission_classes = [AllowAny]

    def get(self, request, organization_id):
        try:
            user_qs = (
                CustomUser.objects
                .filter(
                    organization_id=organization_id,
                    is_deleted=False,
                    is_archived=False,
                    division__isnull=False
                )
                .select_related('division')
                .only('id', 'division__id', 'division__name', 'division__description')
            )
            division_ids = user_qs.values_list('division_id', flat=True).distinct()
            divisions_qs = Divisions.objects.filter(organization_id=organization_id).only('id', 'name', 'description').order_by('name')
            serializer = DivisionsSerializer(divisions_qs, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in DivisionListByOrganizationOptimized: {str(e)}")
            return Response({'error': 'An error occurred while fetching divisions.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, organization_id):
        try:
            # Verify organization exists
            from .models import Organization
            organization = Organization.objects.get(id=organization_id, is_deleted=False, is_archived=False)
        except Organization.DoesNotExist:
            return Response({'error': f'Organization with id {organization_id} does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(request.data, list):
            # Handle bulk creation
            created_items = []
            errors = []

            for idx, item_data in enumerate(request.data, start=1):
                # Add organization to each item
                item_data_copy = item_data.copy()
                item_data_copy['organization'] = organization_id

                serializer = DivisionsSerializer(data=item_data_copy)
                if serializer.is_valid():
                    serializer.save()
                    created_items.append(serializer.data)
                else:
                    errors.append({
                        'index': idx,
                        'data': item_data,
                        'errors': serializer.errors
                    })

            if errors:
                return Response({
                    'message': f'Created {len(created_items)} divisions, {len(errors)} failed',
                    'created': created_items,
                    'errors': errors
                }, status=status.HTTP_207_MULTI_STATUS)

            return Response({
                'message': f'Successfully created {len(created_items)} divisions',
                'created': created_items
            }, status=status.HTTP_201_CREATED)
        else:
            # Handle single creation
            data = request.data.copy()
            data['organization'] = organization_id

            serializer = DivisionsSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SubDivisionListByOrganizationOptimized(APIView):
    permission_classes = [AllowAny]

    def get(self, request, organization_id):
        try:
            user_qs = (
                CustomUser.objects
                .filter(
                    organization_id=organization_id,
                    is_deleted=False,
                    is_archived=False,
                    subdivision__isnull=False
                )
                .select_related('subdivision')
                .only('id', 'subdivision__id', 'subdivision__name', 'subdivision__description')
            )
            # Return all subdivisions for this organization
            subdivisions_qs = SubDivisions.objects.filter(
                organization_id=organization_id,
            ).only('id', 'name', 'description').order_by('name')
            serializer = SubDivisionsSerializer(subdivisions_qs, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in SubDivisionListByOrganizationOptimized: {str(e)}")
            return Response({'error': 'An error occurred while fetching subdivisions.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, organization_id):
        try:
            # Verify organization exists
            from .models import Organization
            organization = Organization.objects.get(id=organization_id, is_deleted=False, is_archived=False)
        except Organization.DoesNotExist:
            return Response({'error': f'Organization with id {organization_id} does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(request.data, list):
            # Handle bulk creation
            created_items = []
            errors = []

            for idx, item_data in enumerate(request.data, start=1):
                # Add organization to each item
                item_data_copy = item_data.copy()
                item_data_copy['organization'] = organization_id

                serializer = SubDivisionsSerializer(data=item_data_copy)
                if serializer.is_valid():
                    serializer.save()
                    created_items.append(serializer.data)
                else:
                    errors.append({
                        'index': idx,
                        'data': item_data,
                        'errors': serializer.errors
                    })

            if errors:
                return Response({
                    'message': f'Created {len(created_items)} subdivisions, {len(errors)} failed',
                    'created': created_items,
                    'errors': errors
                }, status=status.HTTP_207_MULTI_STATUS)

            return Response({
                'message': f'Successfully created {len(created_items)} subdivisions',
                'created': created_items
            }, status=status.HTTP_201_CREATED)
        else:
            # Handle single creation
            data = request.data.copy()
            data['organization'] = organization_id

            serializer = SubDivisionsSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
