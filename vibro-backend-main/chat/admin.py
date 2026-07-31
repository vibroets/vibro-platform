from django.contrib import admin
from .models import ChatGroup, ChatMessage, GroupRequest, MessageReadStatus

admin.site.register(ChatGroup)
admin.site.register(ChatMessage)
admin.site.register(GroupRequest)
admin.site.register(MessageReadStatus)
