#!/bin/bash
docker exec deploy-backend-1 python3 -c "
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'vibro.settings'
import django
django.setup()
from chat.models import ChatGroup, ChatMessage, MessageReadStatus
from django.contrib.auth import get_user_model
User = get_user_model()

user = User.objects.get(username='gu.kumaran')
group = ChatGroup.objects.get(id=1)

print(f'User: {user.id} ({user.username})')
print(f'Group: {group.id} ({group.name})')
print(f'Total messages: {group.messages.count()}')

# All messages
for msg in group.messages.order_by('created_at'):
    read = MessageReadStatus.objects.filter(message=msg, user=user).exists()
    print(f'  msg {msg.id}: sender={msg.sender.id} ({msg.sender.username}), content={msg.content[:30] if msg.content else None}, read={read}')

# Unread count (old way - without excluding sender)
old_count = group.messages.exclude(read_statuses__user=user).count()
print(f'Old unread_count (includes self): {old_count}')

# Unread count (new way - excluding sender)
new_count = group.messages.exclude(read_statuses__user=user).exclude(sender=user).count()
print(f'New unread_count (excludes self): {new_count}')

# Messages from other users
other_msgs = group.messages.exclude(sender=user)
print(f'Messages from other users: {other_msgs.count()}')
for msg in other_msgs:
    read = MessageReadStatus.objects.filter(message=msg, user=user).exists()
    print(f'  msg {msg.id}: sender={msg.sender.id} ({msg.sender.username}), content={msg.content[:30] if msg.content else None}, read={read}')
"
