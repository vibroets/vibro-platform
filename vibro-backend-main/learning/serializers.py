from rest_framework import serializers
from .models import (
    LearningCourse, LearningCourseAssignment,
    Quiz, VideoContent, TrainingItem, TrainingSchedule,
    Trainer, Venue, Enrollment, ApprovalRequest,
    NotificationTemplate, TrainingAttendance, LTDraft,
    QuizResult, Certificate, NotificationLog,
)
from user.models import CustomUser, Groups

class LearningCourseSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.organization_name", read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name = serializers.SerializerMethodField(read_only=True)
    enrollment_count = serializers.IntegerField(read_only=True)
    
    # We keep video_file for compatibility, even if we just use URL now
    video_file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = LearningCourse
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_by", "created_on", "updated_by", "updated_on", "enrollment_count"]

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() if obj.created_by else None

    def get_updated_by_name(self, obj):
        return f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip() if obj.updated_by else None


# --- NEW SERIALIZER FOR THE SHARE POPUP ---
class CourseShareSerializer(serializers.Serializer):
    """
    Validates input for the 'Share' popup (Bulk Assign).
    Expects: users list, groups list, start_date, due_date.
    """
    users = serializers.ListField(child=serializers.IntegerField(), required=False)
    groups = serializers.ListField(child=serializers.IntegerField(), required=False)
    start_date = serializers.DateTimeField(required=True)
    due_date = serializers.DateTimeField(required=True)

    def validate(self, attrs):
        if not attrs.get('users') and not attrs.get('groups'):
            raise serializers.ValidationError("At least one User or Group must be selected.")
        
        if attrs['start_date'] > attrs['due_date']:
            raise serializers.ValidationError("Start Date cannot be after Due Date.")
        return attrs


class LearningCourseAssignmentSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)
    assigned_user_name = serializers.SerializerMethodField(read_only=True)
    assigned_group_name = serializers.CharField(source="assigned_group.name", read_only=True)

    class Meta:
        model = LearningCourseAssignment
        fields = [
            "id", "course", "course_title", 
            "assigned_user", "assigned_user_name",
            "assigned_group", "assigned_group_name",
            "assigned_location_leader",
            "start_date", "due_date",  # <--- Added Dates
            "assigned_on", "completion_status", 
            "completed_by", "completed_on"
        ]
        read_only_fields = ["id", "assigned_on", "completed_on"]

    def get_assigned_user_name(self, obj):
        return f"{obj.assigned_user.first_name} {obj.assigned_user.last_name}".strip() if obj.assigned_user else None


class MyCourseSerializer(serializers.ModelSerializer):
    """
    Mobile App View: Includes Assignments + Course Details
    """
    assignment_id = serializers.IntegerField(read_only=True)
    completion_status = serializers.CharField(read_only=True)
    completed_on = serializers.DateTimeField(allow_null=True, read_only=True)
    # Expose dates to mobile app
    start_date = serializers.DateTimeField(read_only=True)
    due_date = serializers.DateTimeField(read_only=True)

    class Meta:
        model = LearningCourse
        fields = [
            "id", "title", "description", "video_url", "duration", "status",
            "assignment_id", "completion_status", "completed_on",
            "start_date", "due_date" 
        ]


class QuizSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    # camelCase aliases for frontend compatibility
    questionsPerUser = serializers.IntegerField(source='questions_per_user', required=False, default=15)
    timeLimit = serializers.IntegerField(source='time_limit', required=False, default=30)
    passPercentage = serializers.FloatField(source='pass_percentage', required=False, default=70)
    allowSkip = serializers.BooleanField(source='allow_skip_questions', required=False, default=False)
    issueCertificate = serializers.BooleanField(source='certificate_enabled', required=False, default=False)
    validityPeriod = serializers.IntegerField(source='certificate_validity_value', required=False, default=1)
    validityUnit = serializers.CharField(source='certificate_validity_unit', required=False, default='year')
    accessMode = serializers.CharField(source='access_mode', required=False, default='permanent')
    reassignOnFail = serializers.BooleanField(source='reassign_on_fail', required=False, default=False)
    rescheduleDays = serializers.IntegerField(source='reschedule_days', required=False, default=7)

    class Meta:
        model = Quiz
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_by", "created_on", "updated_on"]

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() if obj.created_by else None


class VideoContentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    video_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    duration = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    video_file_url = serializers.SerializerMethodField(read_only=True)

    # camelCase aliases for frontend compatibility
    videoSource = serializers.CharField(source='video_source', required=False, default='url')
    questionsPerUser = serializers.IntegerField(source='questions_per_user', required=False, default=15)
    timeLimit = serializers.IntegerField(source='time_limit', required=False, default=30)
    passPercentage = serializers.FloatField(source='pass_percentage', required=False, default=70)
    allowSkip = serializers.BooleanField(source='allow_skip_questions', required=False, default=False)
    issueCertificate = serializers.BooleanField(source='certificate_enabled', required=False, default=False)
    validityPeriod = serializers.IntegerField(source='certificate_validity_value', required=False, default=1)
    validityUnit = serializers.CharField(source='certificate_validity_unit', required=False, default='year')
    accessMode = serializers.CharField(source='access_mode', required=False, default='permanent')
    reassignOnFail = serializers.BooleanField(source='reassign_on_fail', required=False, default=False)
    rescheduleDays = serializers.IntegerField(source='reschedule_days', required=False, default=7)

    class Meta:
        model = VideoContent
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_by", "created_on", "updated_on"]

    def to_internal_value(self, data):
        # Strip video_file if it's not an actual file (e.g. null or empty string from JSON)
        if 'video_file' in data and not hasattr(data['video_file'], 'read'):
            if hasattr(data, 'copy'):
                data = data.copy()
                del data['video_file']
            else:
                data = {**data}
                del data['video_file']
        return super().to_internal_value(data)

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() if obj.created_by else None

    def get_video_file_url(self, obj):
        request = self.context.get('request')
        if obj.video_file and hasattr(obj.video_file, 'url'):
            url = obj.video_file.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class TrainingItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    content_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    file_url = serializers.SerializerMethodField(read_only=True)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    follow_up_type = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    follow_up_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    # camelCase aliases for frontend compatibility
    assetType = serializers.CharField(source='asset_type', required=False, default='document')
    sourceType = serializers.CharField(source='source_type', required=False, default='url')
    fileUrl = serializers.SerializerMethodField(read_only=True)
    allowDownload = serializers.BooleanField(source='allow_download', required=False, default=False)
    allowPrint = serializers.BooleanField(source='allow_print', required=False, default=False)
    allowShare = serializers.BooleanField(source='allow_share', required=False, default=False)
    followUpType = serializers.CharField(source='follow_up_type', required=False, allow_null=True)
    followUpId = serializers.CharField(source='follow_up_id', required=False, allow_null=True)
    questionsPerUser = serializers.IntegerField(source='questions_per_user', required=False, default=15)
    timeLimit = serializers.IntegerField(source='time_limit', required=False, default=30)
    passPercentage = serializers.FloatField(source='pass_percentage', required=False, default=70)
    allowSkip = serializers.BooleanField(source='allow_skip_questions', required=False, default=False)
    issueCertificate = serializers.BooleanField(source='certificate_enabled', required=False, default=False)
    validityPeriod = serializers.IntegerField(source='certificate_validity_value', required=False, default=1)
    validityUnit = serializers.CharField(source='certificate_validity_unit', required=False, default='year')
    accessMode = serializers.CharField(source='access_mode', required=False, default='permanent')
    reassignOnFail = serializers.BooleanField(source='reassign_on_fail', required=False, default=False)
    rescheduleDays = serializers.IntegerField(source='reschedule_days', required=False, default=7)

    class Meta:
        model = TrainingItem
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_by", "created_on", "updated_on"]

    def to_internal_value(self, data):
        # Strip file if it's not an actual file (e.g. null or empty string from JSON)
        if 'file' in data and not hasattr(data['file'], 'read'):
            if hasattr(data, 'copy'):
                data = data.copy()
                del data['file']
            else:
                data = {**data}
                del data['file']
        return super().to_internal_value(data)

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() if obj.created_by else None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            url = obj.file.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return obj.content_url or None

    def get_fileUrl(self, obj):
        return self.get_file_url(obj)


class TrainingScheduleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TrainingSchedule
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_by", "created_on", "updated_on"]

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() if obj.created_by else None


class TrainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trainer
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_on", "updated_on"]


class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_on", "updated_on"]


class EnrollmentSerializer(serializers.ModelSerializer):
    participant_name = serializers.SerializerMethodField(read_only=True)
    participant_email = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Enrollment
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_on", "updated_on"]

    def get_participant_name(self, obj):
        return f"{obj.participant.first_name} {obj.participant.last_name}".strip() if obj.participant else None

    def get_participant_email(self, obj):
        return obj.participant.email if obj.participant else None


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField(read_only=True)
    requester_designation = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_on", "updated_on"]

    def get_requested_by_name(self, obj):
        return obj.requested_by

    def get_requester_designation(self, obj):
        try:
            user = CustomUser.objects.filter(id=obj.requested_by).first()
            if user and user.designation:
                return user.designation.name
        except Exception:
            pass
        return None


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_on", "updated_on"]


class TrainingAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingAttendance
        fields = "__all__"
        read_only_fields = ["id", "organization", "created_on", "updated_on"]


class LTDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = LTDraft
        fields = "__all__"
        read_only_fields = ["id", "organization", "user", "saved_at"]


class QuizResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizResult
        fields = "__all__"
        read_only_fields = ["id", "organization", "user", "user_name", "completed_at"]


class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = "__all__"
        read_only_fields = ["id", "certificate_number", "issued_at"]


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = "__all__"
        read_only_fields = ["id", "user", "organization", "created_at"]