from rest_framework import serializers
from .models import Enquiry


class EnquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = Enquiry
        fields = ['id', 'name', 'organization_name', 'email', 'phone', 'message', 'submitted_at', 'is_contacted']
        read_only_fields = ['id', 'submitted_at', 'is_contacted']
