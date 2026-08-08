#!/bin/bash
# Test channel layer broadcast directly from inside the backend container
docker exec deploy-backend-1 python3 -c "
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'vibro.settings'
import django
django.setup()
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

layer = get_channel_layer()
print('Channel layer:', layer)

# Try sending a test message to the chat_1 group
try:
    async_to_sync(layer.group_send)(
        'chat_1',
        {
            'type': 'chat_message',
            'message': {'id': 999, 'sender': {'id': 1, 'username': 'test', 'first_name': 'Test', 'last_name': 'User'}, 'message_type': 'text', 'content': 'Test broadcast message', 'attachment_url': None, 'attachment_name': None, 'duration': None, 'created_at': '2026-08-02T17:00:00Z'},
            'group_id': 1,
            'group_name': 'Test Group',
        }
    )
    print('Broadcast sent successfully to chat_1')
except Exception as e:
    print(f'Broadcast error: {e}')
"
