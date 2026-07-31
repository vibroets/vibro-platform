"""
ASGI config for vibro project.
Supports Django Channels for WebSocket-based real-time chat.
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')

django_asgi_app = get_asgi_application()

from chat.consumers import ChatConsumer, ChatNotificationConsumer
from chat.middleware import JWTAuthMiddleware

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<group_id>\d+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/chat/notifications/$', ChatNotificationConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
