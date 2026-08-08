from django.conf import settings
print("CHANNEL_LAYERS:", settings.CHANNEL_LAYERS)
print("ASGI_APPLICATION:", getattr(settings, 'ASGI_APPLICATION', 'NOT SET'))
print("REDIS:", getattr(settings, 'REDIS', 'NOT SET'))
