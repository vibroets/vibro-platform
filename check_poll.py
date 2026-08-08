from poll.models import Poll, PollShare, PollResponse
from django.contrib.auth import get_user_model
User = get_user_model()

poll = Poll.objects.order_by('-created_on').first()
if not poll:
    print('No polls found')
else:
    print("=== Poll: %s ===" % poll.id)
    print("Title: %s" % poll.title)
    print("Anonymous: %s" % poll.anonymous)
    print("Allow multiple: %s" % poll.allow_multiple_responses)
    print("Active: %s" % poll.is_active)
    print("Created by: %s (%s)" % (poll.created_by.id, poll.created_by.username))
    print("End date: %s" % poll.end_date)
    print("")
    print("Questions: %s" % poll.questions.count())
    for q in poll.questions.all():
        print("  Q%s: %s (type=%s, options=%s)" % (q.id, q.question_text, q.question_type, q.options))
    print("")
    print("Shares: %s" % PollShare.objects.filter(poll=poll).count())
    for s in PollShare.objects.filter(poll=poll):
        target = s.sent_to_user or s.sent_to_group or s.sent_to_location
        print("  Share %s: target=%s, status=%s" % (s.id, target, s.share_status))
    print("")
    print("Responses: %s" % PollResponse.objects.filter(poll=poll).count())
    for r in PollResponse.objects.filter(poll=poll):
        uname = r.user.username if r.user else "None"
        print("  Response %s: user=%s (%s), q=%s, text=%s, value=%s, options=%s" % (r.id, r.user_id, uname, r.question_id, r.answer_text, r.answer_value, r.answer_options))
    print("")
    print("=== All polls (recent 5) ===")
    for p in Poll.objects.order_by('-created_on')[:5]:
        resp_count = PollResponse.objects.filter(poll=p).count()
        share_count = PollShare.objects.filter(poll=p).count()
        print("  Poll %s: %s | anon=%s | shares=%s | responses=%s" % (p.id, p.title, p.anonymous, share_count, resp_count))
