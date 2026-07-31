from rest_framework.views import APIView
from vibro.user_context import set_current_user

# userContextAPIView - this view take the current user snapshot and store it in a global stage.
# Where-ever logged user information rrequired we can call get_current_user to get current user data
class userContextAPIView(APIView):
    def initial(self, request, *args, **kwargs):
        set_current_user(request.user)
        return super().initial(request, *args, **kwargs)