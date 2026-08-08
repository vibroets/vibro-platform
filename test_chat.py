from chat.models import MessageReadStatus, ChatMessage, ChatGroup
from chat.serializers import ChatGroupSerializer
from user.models import CustomUser

print("=== MessageReadStatus records ===")
print("Count:", MessageReadStatus.objects.count())
for r in MessageReadStatus.objects.all()[:20]:
    print(f"  msg={r.message_id} user={r.user_id} read_at={r.read_at}")

print("\n=== ChatGroups ===")
for g in ChatGroup.objects.all():
    total_msgs = g.messages.count()
    print(f"Group {g.id}: {g.name}, messages={total_msgs}")

print("\n=== Unread counts per user per group ===")
for u in CustomUser.objects.filter(is_active=True, is_deleted=False)[:5]:
    for g in ChatGroup.objects.filter(members=u):
        unread = g.messages.exclude(read_statuses__user=u).exclude(sender=u).count()
        print(f"  User {u.id} ({u.username}) - Group {g.id} ({g.name}): unread={unread}")

print("\n=== Test serializer context ===")
user3 = CustomUser.objects.get(id=3)
group1 = ChatGroup.objects.get(id=1)
# Simulate what the API does
class FakeRequest:
    user = user3
serializer = ChatGroupSerializer(group1, context={'request': FakeRequest()})
print(f"Serialized unread_count: {serializer.data.get('unread_count')}")
print(f"Serialized last_message: {serializer.data.get('last_message')}")
