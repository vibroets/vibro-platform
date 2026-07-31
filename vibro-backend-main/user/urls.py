from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RequestOTPView,
    VerifyOTPView,
    UserCreateView,
    UserListView,
    UserArchiveView,
    UserDeleteView,
    UserArchiveListView,
    UserDeletedListView,
    UserDetailView,
    BulkUserValidateView,
    BulkUserImportView,
    GroupViewSet,
    GroupArchiveListView,
    GroupArchiveView,
    GroupDeletedListView,
    GroupDeleteView,
    GroupBulkDeleteView,
    RegularGroupViewSet,
    RuleBasedGroupViewSet,
    DownloadTemplateView,
    OrganizationCreateView,
    OrganizationListView,
    OrganizationDetailView,
    AvailableAdminsView,
    AvailableEndUserView,
    OrganizationAdminsView,
    OrganizationAvailableUsersView,
    DepartmentViewSet,
    DivisionViewSet,
    LocationViewSet,
    DesignationViewSet,
    RestoreListView,
    BulkDeleteView,
    BulkArchiveView,
    GroupChatStatusView,
    EmailCSVView,
    OrganizationBulkStatusView,
    AvailableUsersView,
    SubDivisionViewSet,
    OrganizationUserListView,
    PromoteToLocationLeaderView,
    LocationLeaderListView,
    DePromoteLocationLeaderView,
    ReassignLocationLeaderView,
    NextOrganizationIdView,
    OrganizationListByUserView,
    OrganizationUsersOnlyView,
    DeleteDraftOrganizationView,
    OrganizationStatsView,
    LocationListByOrganizationOptimized,
    DepartmentListByOrganizationOptimized,
    DesignationListByOrganizationOptimized,
    DivisionListByOrganizationOptimized,
    SubDivisionListByOrganizationOptimized 

)

from .views_optimized import (
    OrganizationUserListViewOptimized,
    UserDetailViewOptimized,
    GroupViewSetOptimized,
    OrganizationListViewOptimized,
    OrganizationDetailViewOptimized
)

router = DefaultRouter()
router.register(r'department', DepartmentViewSet, basename='department')
router.register(r'designation', DesignationViewSet, basename='designation')
router.register(r'division', DivisionViewSet, basename='division')
router.register(r'subdivision', SubDivisionViewSet, basename='subdivision')
router.register(r'location', LocationViewSet, basename='location')
router.register(r'groups', GroupViewSet, basename='groups')
router.register(r'regular-groups', RegularGroupViewSet, basename='regular-groups')
router.register(r'rule-based-groups', RuleBasedGroupViewSet, basename='rule-groups')

urlpatterns = [
    path('auth/request-otp/', RequestOTPView.as_view(), name='request-otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('users/create', UserCreateView.as_view(), name='user-create'),
    path('users/list', OrganizationUserListViewOptimized.as_view(), name='user_list'),
    path('users/archive/list', UserArchiveListView.as_view(), name='user-archive-list'),
    path('users/archive/<int:pk>', UserArchiveView.as_view(), name='user-archive'),
    path('users/delete/list', UserDeletedListView.as_view(), name='user-delete-list'),
    path('users/delete/<int:pk>', UserDeleteView.as_view(), name='user-delete'),
    path('users/<int:pk>', UserDetailViewOptimized.as_view(), name='user-detail'),
    path('users/bulk-validate', BulkUserValidateView.as_view(), name='bulk-validate'),
    path('users/bulk-import', BulkUserImportView.as_view(), name='bulk-import'),
    path('users/download-template', DownloadTemplateView.as_view(), name='download-template'),
    path('users/emailcsv', EmailCSVView.as_view(), name='email-csv'),
    path('organization/create', OrganizationCreateView.as_view(), name='organization-create'),
    path('organization/list', OrganizationListViewOptimized.as_view(), name='organization-list'),
    path('organization/<int:pk>', OrganizationDetailViewOptimized.as_view(), name='organization-detail'),
    path('available/admins', AvailableAdminsView.as_view(), name='available-admins'),
    path('available/enduser', AvailableEndUserView.as_view(), name='available-enduser'),
    path('groups/archive/list', GroupArchiveListView.as_view(), name='group-archive-list'),
    path('groups/archive/<int:pk>', GroupArchiveView.as_view(), name='group-archive'),
    path('groups/delete/list', GroupDeletedListView.as_view(), name='group-delete-list'),
    path('groups/delete/<int:pk>', GroupDeleteView.as_view(), name='group-delete'),
    path('groups/chat-status/', GroupChatStatusView.as_view(), name='group-chat-status'),
    path('<int:pk>/admins', OrganizationAdminsView.as_view(), name='organization-admins'),
    path('restore/list/<str:type>', RestoreListView.as_view(), name='restore-list'),
    path('bulk/delete/<str:model_type>', BulkDeleteView.as_view(), name='bulk-delete'),
    path('bulk/archive/<str:model_type>', BulkArchiveView.as_view(), name='bulk-archive'),
    path('organizations/bulk-activate', OrganizationBulkStatusView.as_view(), name='organization-bulk-activate'),
    path('organization/<int:org_id>/available-users/', OrganizationAvailableUsersView.as_view(), name='organization-available-users'),
    path('users/available-users/<int:organization_id>/', AvailableUsersView.as_view(), name='available-users'),
    path('promote/location-leader/', PromoteToLocationLeaderView.as_view(), name='promote-location-leader'), 
    path('location-leaders/list/', LocationLeaderListView.as_view(), name='location-leaders-list'),
    path('depromote/location-leader/<int:user_id>/', DePromoteLocationLeaderView.as_view(), name='depromote_location_leader'),
    path('reassign/location-leader/<int:user_id>/', ReassignLocationLeaderView.as_view(), name='reassign_location_leader'),
    path('organization/groups/<int:org_id>/', GroupViewSet.as_view({'get': 'list'}), name='organization-groups-list-alt'),
    path('organization/next-id/', NextOrganizationIdView.as_view(), name='next-organization-id'),
    path('organization/list-by-user/<int:user_id>', OrganizationListByUserView.as_view(), name='organization-list-by-user'),
    path("users/by-organization/", OrganizationUsersOnlyView.as_view(), name="users-by-org"),
    path('organization/delete-draft/<int:org_id>/', DeleteDraftOrganizationView.as_view(), name='delete-draft-organization'),
    path('organization/stats/', OrganizationStatsView.as_view(), name='organization-stats'),

    path('location/<int:organization_id>/', LocationListByOrganizationOptimized.as_view(), name='location-by-organization'),
    path('department/<int:organization_id>/', DepartmentListByOrganizationOptimized.as_view(), name='department-by-organization'),
    path('designation/<int:organization_id>/', DesignationListByOrganizationOptimized.as_view(), name='designation-by-organization'),
    path('division/<int:organization_id>/', DivisionListByOrganizationOptimized.as_view(), name='division-by-organization'),
    path('subdivision/<int:organization_id>/', SubDivisionListByOrganizationOptimized.as_view(), name='subdivision-by-organization'),




    path('', include(router.urls)),
]



urlpatterns += [
    path('users/list/v2', OrganizationUserListViewOptimized.as_view()),
    path('users/<int:pk>/v2', UserDetailViewOptimized.as_view()),
    path('organization/list/v2', OrganizationListViewOptimized.as_view()),
    path('organization/<int:pk>/v2', OrganizationDetailViewOptimized.as_view()),
]
