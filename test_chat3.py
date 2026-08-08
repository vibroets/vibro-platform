from chat.models import MessageReadStatus, ChatMessage, ChatGroup
from chat.serializers import ChatGroupSerializer
from user.models import CustomUser
from rest_framework.test import APIRequestFactory

user3 = CustomUser.objects.get(id=3)
group1 = ChatGroup.objects.get(id=1)

# Use APIRequestFactory to create a proper request
factory = APIRequestFactory()
request = factory.get('/chat/chat-groups/')
request.user = user3

# Test with many=True (like the ViewSet does)
qs = ChatGroup.objects.filter(members=user3, is_active=True).distinct().order_by('-updated_at')
serializer = ChatGroupSerializer(qs, many=True, context={'request': request})
for g in serializer.data:
    print(f"Group {g['id']}: {g['name']}, unread_count={g['unread_count']}")

# Also test single
serializer2 = ChatGroupSerializer(group1, context={'request': request})
print(f"\nSingle - Group {serializer2.data['id']}: unread_count={serializer2.data['unread_count']}")

# Direct query for comparison
read_msg_ids = list(MessageReadStatus.objects.filter(user=user3).values_list('message_id', flat=True))
print(f"\nRead message IDs: {read_msg_ids}")
unread = group1.messages.exclude(sender=user3).exclude(id__in=read_msg_ids).count()
print(f"Direct unread count: {unread}")

# Check all messages
print(f"\nAll messages in group 1:")
for msg in group1.messages.order_by('created_at'):
    read_by = list(msg.read_statuses.values_list('user_id', flat=True))
    print(f"  msg {msg.id}: sender={msg.sender_id} ({msg.sender.username}), read_by={read_by}")
