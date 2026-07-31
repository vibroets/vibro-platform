from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TaskViewSet, TaskAssigneeViewSet, TaskTrackingViewSet, TaskAuditLogViewSet,
    UserAssignedTasksView, UserCompletedTasksView, OrganizationFormsForTaskView,
    OrganizationUsersForTaskView, OrganizationGroupsForTaskView, FormsAssociatedWithTasksView, FormAssigneesView,
    TaskDownloadTemplateView,TaskBulkValidateView
)
from .views import TaskBulkImportView

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'task-assignees', TaskAssigneeViewSet, basename='task-assignee')
router.register(r'task-tracking', TaskTrackingViewSet, basename='task-tracking')
router.register(r'task-audit-logs', TaskAuditLogViewSet, basename='task-audit-log')

urlpatterns = [
    path('download-template/', TaskDownloadTemplateView.as_view(), name='download-template'),
    path('tasks/bulk-validate/', TaskBulkValidateView.as_view(), name='bulk-validate'),
    path('tasks/bulk-import/', TaskBulkImportView.as_view(), name='bulk-import'),
    path('', include(router.urls)),
    path('user/assigned-tasks/', UserAssignedTasksView.as_view(), name='user-assigned-tasks'),
    path('user/completed-tasks/<int:user_id>/', UserCompletedTasksView.as_view(), name='user-completed-tasks'),
    path('organization/forms/', OrganizationFormsForTaskView.as_view(), name='organization-forms-for-task'),
    path('organization/users/', OrganizationUsersForTaskView.as_view(), name='organization-users-for-task'),
    path('organization/groups/', OrganizationGroupsForTaskView.as_view(), name='organization-groups-for-task'),
    path('forms-associated-with-tasks/', FormsAssociatedWithTasksView.as_view(), name='forms-associated-with-tasks'),
    path('forms/<int:form_id>/assignees/', FormAssigneesView.as_view(), name='form-assignees'),
]
