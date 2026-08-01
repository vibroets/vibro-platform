from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatGroupViewSet, GroupRequestViewSet, OrganizationUsersView, OrganizationGroupsView, CreateChatGroupView

router = DefaultRouter()
router.register(r'chat-groups', ChatGroupViewSet, basename='chatgroup')
router.register(r'group-requests', GroupRequestViewSet, basename='grouprequest')

urlpatterns = [
    path('', include(router.urls)),
    path('users/', OrganizationUsersView.as_view(), name='chat-users'),
    path('groups/', OrganizationGroupsView.as_view(), name='chat-groups-list'),
    path('create-group/', CreateChatGroupView.as_view(), name='chat-create-group'),
]
