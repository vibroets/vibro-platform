#!/bin/bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/jwt/create/ \
  -H "Content-Type: application/json" \
  -d '{"username":"gu.kumaran","password":"Vibro@2024"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

echo "Token: ${TOKEN:0:20}..."

# Send a test message
RESPONSE=$(curl -s -X POST http://localhost:8000/api/chat/chat-groups/1/send_message/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "message_type=text" \
  -F "content=test notification message")

echo "Send response: $RESPONSE"

# Wait a moment for WebSocket delivery
sleep 2

# Check recent backend logs for notification delivery
echo "=== Recent backend logs ==="
docker logs deploy-backend-1 --since 10s 2>&1 | tail -20
