from chat.models import ChatGroup, ChatMessage, MessageReadStatus
from user.models import CustomUser

print("=== All users ===")
for u in CustomUser.objects.filter(is_active=True, is_deleted=False)[:10]:
    groups = ChatGroup.objects.filter(members=u, is_active=True)
    print(f"User {u.id} ({u.username}): role={u.role}, org={u.organization_id}, groups={list(groups.values_list('id', 'name'))}")

print("\n=== ChatGroup 1 members ===")
g = ChatGroup.objects.get(id=1)
print(f"Group: {g.name}, org={g.organization_id}, is_active={g.is_active}")
for m in g.members.all():
    print(f"  Member {m.id} ({m.username}), org={m.organization_id}")

print("\n=== Recent messages (last 5) ===")
for msg in g.messages.order_by('-created_at')[:5]:
    print(f"  msg {msg.id}: sender={msg.sender_id} ({msg.sender.username}), type={msg.message_type}, content={msg.content[:50] if msg.content else None}")
