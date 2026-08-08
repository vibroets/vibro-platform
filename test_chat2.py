from chat.models import MessageReadStatus, ChatMessage, ChatGroup
from django.db.models import Q, Exists, OuterRef
from user.models import CustomUser

user3 = CustomUser.objects.get(id=3)
group1 = ChatGroup.objects.get(id=1)

print("=== Messages in group 1 ===")
print("Total:", group1.messages.count())
print("Sent by user 3:", group1.messages.filter(sender=user3).count())
print("Sent by others:", group1.messages.exclude(sender=user3).count())

print("\n=== Read statuses for user 3 ===")
print("Count:", MessageReadStatus.objects.filter(user=user3).count())

print("\n=== Current buggy query (exclude with relation) ===")
# This is what the current code does
buggy = group1.messages.exclude(read_statuses__user=user3).exclude(sender=user3)
print("Buggy result:", buggy.count())
print("Buggy SQL:", buggy.query)

print("\n=== Fixed query (subquery) ===")
read_msg_ids = MessageReadStatus.objects.filter(user=user3).values_list('message_id', flat=True)
fixed = group1.messages.exclude(sender=user3).exclude(id__in=read_msg_ids)
print("Fixed result:", fixed.count())

print("\n=== Fixed query 2 (Exists) ===")
read_by_user = MessageReadStatus.objects.filter(message=OuterRef('pk'), user=user3)
fixed2 = group1.messages.exclude(sender=user3).filter(~Exists(read_by_user))
print("Fixed2 result:", fixed2.count())

print("\n=== Test mark_read with buggy query ===")
unread_buggy = group1.messages.exclude(read_statuses__user=user3).exclude(sender=user3)
print("Messages that would be marked read (buggy):", list(unread_buggy.values_list('id', flat=True)))

print("\n=== Test mark_read with fixed query ===")
unread_fixed = group1.messages.exclude(sender=user3).exclude(id__in=read_msg_ids)
print("Messages that would be marked read (fixed):", list(unread_fixed.values_list('id', flat=True)))
