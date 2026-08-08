from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Enquiry
from .serializers import EnquirySerializer
from vibro.permissions import IsSuperAdmin


class EnquiryViewSet(ModelViewSet):
    serializer_class = EnquirySerializer
    queryset = Enquiry.objects.all()

    def get_permissions(self):
        if self.action in ['create']:
            return [AllowAny()]
        return [IsAuthenticated(), IsSuperAdmin()]

    def perform_create(self, serializer):
        serializer.save()
