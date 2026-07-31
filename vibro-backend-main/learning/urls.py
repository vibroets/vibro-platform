from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LearningCourseViewSet,
    LearningCourseAssignmentViewSet,
    MyCoursesViewSet,
    QuizViewSet,
    VideoContentViewSet,
    TrainingItemViewSet,
    TrainingScheduleViewSet,
    TrainerViewSet,
    VenueViewSet,
    EnrollmentViewSet,
    ApprovalRequestViewSet,
    NotificationTemplateViewSet,
    TrainingAttendanceViewSet,
    LTDraftViewSet,
    LTAnalyticsView,
    MyNotificationsViewSet,
)

router = DefaultRouter()
router.register(r"learning/courses", LearningCourseViewSet, basename="learning-course")
router.register(r"learning/assignments", LearningCourseAssignmentViewSet, basename="learning-assignment")
router.register(r"learning/my-courses", MyCoursesViewSet, basename="learning-my-courses")
router.register(r"learning/quizzes", QuizViewSet, basename="learning-quiz")
router.register(r"learning/videos", VideoContentViewSet, basename="learning-video")
router.register(r"learning/training-items", TrainingItemViewSet, basename="learning-training-item")
router.register(r"learning/training-schedules", TrainingScheduleViewSet, basename="training-schedule")
router.register(r"learning/trainers", TrainerViewSet, basename="trainer")
router.register(r"learning/venues", VenueViewSet, basename="venue")
router.register(r"learning/enrollments", EnrollmentViewSet, basename="enrollment")
router.register(r"learning/approvals", ApprovalRequestViewSet, basename="approval")
router.register(r"learning/notifications", NotificationTemplateViewSet, basename="notification-template")
router.register(r"learning/attendances", TrainingAttendanceViewSet, basename="training-attendance")
router.register(r"learning/drafts", LTDraftViewSet, basename="lt-draft")
router.register(r"learning/my-notifications", MyNotificationsViewSet, basename="lt-my-notifications")

urlpatterns = [
    path("", include(router.urls)),
    path("learning/analytics/", LTAnalyticsView.as_view(), name="lt-analytics"),
]

