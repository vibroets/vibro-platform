from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GuideFolderViewSet, GuideDocumentViewSet, GuideShareViewSet

router = DefaultRouter()
router.register(r'guide-folders', GuideFolderViewSet, basename='guide-folder')
router.register(r'guide-documents', GuideDocumentViewSet, basename='guide-document')
router.register(r'guide-shares', GuideShareViewSet, basename='guide-share')

urlpatterns = [
    path('', include(router.urls)),
]
