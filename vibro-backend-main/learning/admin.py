from django.contrib import admin

from .models import LearningCourse, LearningCourseAssignment


@admin.register(LearningCourse)
class LearningCourseAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "organization", "status", "created_on")
    list_filter = ("status", "organization")
    search_fields = ("title", "description")


@admin.register(LearningCourseAssignment)
class LearningCourseAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "course",
        "assigned_user",
        "assigned_group",
        "assigned_location_leader",
        "completion_status",
        "assigned_on",
        "completed_on",
    )
    list_filter = ("completion_status",)


