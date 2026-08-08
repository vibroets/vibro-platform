#!/bin/bash
docker exec deploy-backend-1 python3 -c "
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'vibro.settings'
import django
django.setup()
from poll.models import Poll, PollShare, PollResponse, PollQuestion
from django.contrib.auth import get_user_model
User = get_user_model()

# Get the most recent poll
poll = Poll.objects.order_by('-created_on').first()
if not poll:
    print('No polls found')
    exit()

print(f'=== Poll: {poll.id} ===')
print(f'Title: {poll.title}')
print(f'Anonymous: {poll.anonymous}')
print(f'Allow multiple: {poll.allow_multiple_responses}')
print(f'Active: {poll.is_active}')
print(f'Created by: {poll.created_by.id} ({poll.created_by.username})')
print(f'End date: {poll.end_date}')

# Questions
print(f'\nQuestions: {poll.questions.count()}')
for q in poll.questions.all():
    print(f'  Q{q.id}: {q.question_text} (type={q.question_type}, options={q.options})')

# Shares
print(f'\nShares: {PollShare.objects.filter(poll=poll).count()}')
for s in PollShare.objects.filter(poll=poll):
    target = s.sent_to_user or s.sent_to_group or s.sent_to_location
    print(f'  Share {s.id}: target={target}, status={s.share_status}')

# Responses
print(f'\nResponses: {PollResponse.objects.filter(poll=poll).count()}')
for r in PollResponse.objects.filter(poll=poll):
    print(f'  Response {r.id}: user={r.user_id} ({r.user.username if r.user else \"None\"}), q={r.question_id}, text={r.answer_text}, value={r.answer_value}, options={r.answer_options}')

# Check all users
print(f'\n=== Users in org ===')
for u in User.objects.filter(organization=poll.organization, is_deleted=False).values('id', 'username', 'first_name'):
    has_resp = PollResponse.objects.filter(poll=poll, user_id=u['id']).exists()
    print(f'  User {u[\"id\"]} ({u[\"username\"]}): responded={has_resp}')
"
