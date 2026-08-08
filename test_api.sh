#!/bin/bash
# Get a token by logging in via OTP flow - we need to use the Django shell
docker exec deploy-backend-1 python3 -c "
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'vibro.settings'
import django
django.setup()
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='gu.kumaran')
refresh = RefreshToken.for_user(user)
print(refresh.access_token)
" > /tmp/jwt_token.txt

TOKEN=$(cat /tmp/jwt_token.txt)
echo "Token: ${TOKEN:0:20}..."

# Fetch chat groups
echo "=== Chat groups response ==="
curl -s http://localhost:8000/api/chat/chat-groups/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || \
curl -s http://localhost:8000/api/chat/chat-groups/ \
  -H "Authorization: Bearer $TOKEN"
