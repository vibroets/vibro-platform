import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)


class ChatNotificationConsumer(AsyncWebsocketConsumer):
    """
    Global notification consumer.
    Connects to ws/chat/notifications/?token=<jwt>
    Joins a personal channel for the user and all their group channels.
    Pushes notification events when new messages arrive in any group.
    """

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            logger.warning(f"ChatNotification: Connection rejected - user not authenticated. Scope keys: {list(self.scope.keys())}")
            await self.close()
            return

        logger.info(f"ChatNotification: User {self.user.id} ({self.user.username}) connecting...")

        self.user_channel = f'user_notif_{self.user.id}'
        await self.channel_layer.group_add(
            self.user_channel,
            self.channel_name
        )

        # Join all the user's group channels for notifications
        self.group_channels = await self.get_user_group_channels()
        logger.info(f"ChatNotification: User {self.user.id} joining {len(self.group_channels)} group channels: {self.group_channels}")
        for ch in self.group_channels:
            await self.channel_layer.group_add(ch, self.channel_name)

        await self.accept()
        logger.info(f"ChatNotification: User {self.user.id} connected successfully")

    async def disconnect(self, close_code):
        if hasattr(self, 'user_channel'):
            await self.channel_layer.group_discard(
                self.user_channel,
                self.channel_name
            )
        for ch in getattr(self, 'group_channels', []):
            await self.channel_layer.group_discard(ch, self.channel_name)

    async def receive(self, text_data=None):
        """Handle ping messages from client to keep WebSocket alive."""
        if text_data:
            try:
                data = json.loads(text_data)
                if data.get('type') == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
            except (json.JSONDecodeError, TypeError):
                pass

    async def chat_message(self, event):
        """
        Receives messages broadcast to group channels.
        Sends a notification to the client.
        Note: We don't skip the sender here because the same user may be
        logged in on multiple devices (e.g., web admin + mobile app).
        The client-side decides whether to show the popup.
        """
        message = event.get('message', {})
        sender_id = message.get('sender', {}).get('id')

        logger.info(f"ChatNotification: Sending notification to user {self.user.id} for group {event.get('group_id')} (sender={sender_id})")
        await self.send(text_data=json.dumps({
            'type': 'new_message_notification',
            'message': message,
            'group_id': event.get('group_id'),
            'group_name': event.get('group_name'),
        }))

    @database_sync_to_async
    def get_user_group_channels(self):
        from chat.models import ChatGroup
        groups = ChatGroup.objects.filter(
            members=self.user,
            is_active=True
        )
        return [f'chat_{g.id}' for g in groups]


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.room_group_name = f'chat_{self.group_id}'
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        if not await self.is_member():
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type', 'text')
        content = data.get('content', '')
        attachment = data.get('attachment', None)
        attachment_name = data.get('attachment_name', None)
        duration = data.get('duration', None)

        message = await self.save_message(msg_type, content, attachment, attachment_name, duration)

        group_name = await self.get_group_name()

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'group_id': self.group_id,
                'group_name': group_name,
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message']
        }))

    @database_sync_to_async
    def is_member(self):
        from chat.models import ChatGroup
        try:
            group = ChatGroup.objects.get(id=self.group_id)
            if not group.members.filter(id=self.user.id).exists():
                return False
            if group.organization_id and self.user.organization_id and group.organization_id != self.user.organization_id:
                return False
            return True
        except ChatGroup.DoesNotExist:
            return False

    @database_sync_to_async
    def get_group_name(self):
        from chat.models import ChatGroup
        try:
            group = ChatGroup.objects.get(id=self.group_id)
            return group.name
        except ChatGroup.DoesNotExist:
            return "Unknown"

    @database_sync_to_async
    def save_message(self, msg_type, content, attachment, attachment_name, duration):
        from chat.models import ChatMessage
        from chat.serializers import ChatMessageSerializer

        msg = ChatMessage.objects.create(
            group_id=self.group_id,
            sender=self.user,
            message_type=msg_type,
            content=content,
            attachment=attachment if attachment else None,
            attachment_name=attachment_name,
            duration=duration,
        )
        serializer = ChatMessageSerializer(msg)
        return serializer.data
