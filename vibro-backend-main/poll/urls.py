from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PollViewSet, PollQuestionViewSet, my_polls, sent_polls

router = DefaultRouter()
router.register(r'polls', PollViewSet, basename='poll')
router.register(r'poll-questions', PollQuestionViewSet, basename='poll-question')

urlpatterns = [
    path('polls/my-polls/', my_polls, name='my-polls'),
    path('polls/sent/', sent_polls, name='sent-polls'),
    path('', include(router.urls)),
]
