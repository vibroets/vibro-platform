from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnnouncementViewSet, AnnouncementCategoryViewSet, announcement_share_info

router = DefaultRouter()
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'announcement-categories', AnnouncementCategoryViewSet, basename='announcement-category')

urlpatterns = [
    path('', include(router.urls)),
    path('announcements/<int:pk>/share-info/', announcement_share_info, name='announcement-share-info'),
]
