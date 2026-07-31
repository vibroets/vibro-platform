# urls.py
from rest_framework.routers import DefaultRouter
from .views import DraftViewSet

router = DefaultRouter()
router.register("drafts", DraftViewSet, basename="drafts")

urlpatterns = router.urls
