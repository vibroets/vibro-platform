from rest_framework import permissions
from user.constants import USER_ROLES


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and user.role is not None
            and user.role.name == USER_ROLES.ADMIN
        )


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and user.role is not None
            and user.role.name == USER_ROLES.SUPER_ADMIN
        )


class IsEndUser(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and user.role is not None
            and user.role.name == USER_ROLES.END_USER
        )
    
class IsLocationLeader(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and user.role is not None
            and user.role.name == USER_ROLES.LOCATION_LEADER
        )  # Purpose: Permission check for location leader role    
        
class IsAdminOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return IsAdmin().has_permission(request, view) or IsSuperAdmin().has_permission(request, view)
class IsEndUserOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return IsEndUser().has_permission(request, view) or IsAdmin().has_permission(request, view)

class IsEndUserOrAdminOrLocationLeader(permissions.BasePermission):
    """
    Allows access if the user is End User, Admin, or Location Leader.
    """
    def has_permission(self, request, view):
        return (IsEndUser().has_permission(request, view)or IsAdmin().has_permission(request, view)or IsLocationLeader().has_permission(request, view))

class IsEndUserOrSuperAdminOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            IsEndUser().has_permission(request, view)
            or IsSuperAdmin().has_permission(request, view)
            or IsAdmin().has_permission(request, view)
        )
