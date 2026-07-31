import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from django.urls import get_resolver
resolver = get_resolver()
from poll import urls as poll_urls
for p in poll_urls.urlpatterns:
    print(f"Pattern: {p.pattern}  Name: {getattr(p, 'name', None)}  Route: {getattr(p, 'route', None)}")
    if hasattr(p, 'url_patterns'):
        for sub in p.url_patterns:
            print(f"  Sub: {sub.pattern}  Name: {getattr(sub, 'name', None)}  Route: {getattr(sub, 'route', None)}")
