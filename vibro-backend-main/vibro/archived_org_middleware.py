from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from user.constants import USER_ROLES

EXEMPT_PATHS = [
    '/api/auth/request-otp/',
    '/api/auth/verify-otp/',
    '/api/token/refresh/',
    '/api/token/verify/',
    '/api/organizations/bulk-activate',
    '/api/restore/',
    '/api/users/archive/',
    '/api/groups/archive/',
    '/api/bulk/archive/',
    '/api/bulk/delete/',
    '/api/users/delete/',
    '/api/groups/delete/',
]


class ArchivedOrganizationMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if not request.path.startswith('/api/'):
            return None

        for exempt in EXEMPT_PATHS:
            if request.path.startswith(exempt):
                return None

        # Manually authenticate via JWT since DRF auth runs later
        jwt_auth = JWTAuthentication()
        header = jwt_auth.get_header(request)
        if not header:
            return None

        try:
            raw_token = jwt_auth.get_raw_token(header)
            if not raw_token:
                return None
            validated_token = jwt_auth.get_validated_token(raw_token)
            user = jwt_auth.get_user(validated_token)
        except (InvalidToken, TokenError, Exception):
            return None

        if not user or not user.is_authenticated:
            return None

        if user.role and user.role.name == USER_ROLES.SUPER_ADMIN:
            return None

        organization = getattr(user, 'organization', None)
        if organization and organization.is_archived:
            return JsonResponse(
                {'error': 'Your organization has been deactivated. Please contact support.'},
                status=403,
            )

        return None
