from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from learning.models import (
    TrainingSchedule, Enrollment, NotificationTemplate, NotificationLog
)
from learning.notification_utils import dispatch_notification


UNIT_TO_DELTA = {
    'minutes': lambda v: timedelta(minutes=v),
    'hours': lambda v: timedelta(hours=v),
    'days': lambda v: timedelta(days=v),
    'weeks': lambda v: timedelta(weeks=v),
    'months': lambda v: timedelta(days=v * 30),
}

TRIGGER_DELTAS = {
    '30-days': timedelta(days=30),
    '15-days': timedelta(days=15),
    '7-days': timedelta(days=7),
    '3-days': timedelta(days=3),
    '1-day': timedelta(days=1),
    '1-hour': timedelta(hours=1),
    '15-minutes': timedelta(minutes=15),
}


class Command(BaseCommand):
    help = 'Send scheduled training reminder notifications based on enrollment lead settings and NotificationTemplate rules.'

    def handle(self, *args, **options):
        now = timezone.now()
        sent_count = 0
        tolerance = timedelta(minutes=5)

        # ── Part 1: Enrollment-based reminders (per-participant lead time) ──
        enrollments = Enrollment.objects.filter(
            content_type='training-schedule',
            status='approved',
            notification_lead_value__gt=0,
        ).select_related('participant', 'organization')

        for enrollment in enrollments:
            try:
                training = TrainingSchedule.objects.get(
                    id=int(enrollment.content_id),
                    organization=enrollment.organization,
                )
            except TrainingSchedule.DoesNotExist:
                continue

            if training.status not in ('approved', 'pending'):
                continue
            if not training.start_date or not training.start_time:
                continue

            start_dt = timezone.make_aware(
                timezone.datetime.combine(training.start_date, training.start_time)
            )

            delta_fn = UNIT_TO_DELTA.get(enrollment.notification_lead_unit)
            if not delta_fn:
                continue
            delta = delta_fn(enrollment.notification_lead_value)

            window_start = now + delta - tolerance
            window_end = now + delta + tolerance

            if not (window_start <= start_dt <= window_end):
                continue

            already_sent = NotificationLog.objects.filter(
                user=enrollment.participant,
                organization=enrollment.organization,
                notif_type='training-reminder',
                content_type='training-schedule',
                content_id=str(training.id),
                created_at__gte=now - delta - tolerance,
            ).exists()
            if already_sent:
                continue
            if not enrollment.participant:
                continue

            dispatch_notification(
                notif_type='training-reminder',
                users=[enrollment.participant],
                organization=enrollment.organization,
                context={
                    'title': training.title,
                    'date': str(training.start_date),
                    'venue': training.venue_name or '',
                    'trainer': training.trainer_name or '',
                },
                content_type='training-schedule',
                content_id=training.id,
                content_title=training.title,
            )
            sent_count += 1

        # ── Part 2: Template-based reminders (from NotificationTemplate rules) ──
        templates = NotificationTemplate.objects.filter(
            type='training-reminder',
            enabled=True,
            trigger__in=list(TRIGGER_DELTAS.keys()),
        )

        for template in templates:
            delta = TRIGGER_DELTAS[template.trigger]
            window_start = now + delta - tolerance
            window_end = now + delta + tolerance

            trainings = TrainingSchedule.objects.filter(
                organization=template.organization,
                status__in=['approved', 'pending'],
            )

            for training in trainings:
                if not training.start_date or not training.start_time:
                    continue

                start_dt = timezone.make_aware(
                    timezone.datetime.combine(training.start_date, training.start_time)
                )

                if not (window_start <= start_dt <= window_end):
                    continue

                already_sent = NotificationLog.objects.filter(
                    organization=template.organization,
                    notif_type='training-reminder',
                    content_type='training-schedule',
                    content_id=str(training.id),
                    created_at__gte=now - delta - tolerance,
                ).exists()
                if already_sent:
                    continue

                enrolls = Enrollment.objects.filter(
                    content_type='training-schedule',
                    content_id=str(training.id),
                    organization=template.organization,
                    status='approved',
                ).select_related('participant')

                users = [e.participant for e in enrolls if e.participant]
                if not users:
                    continue

                dispatch_notification(
                    notif_type='training-reminder',
                    users=users,
                    organization=template.organization,
                    context={
                        'title': training.title,
                        'date': str(training.start_date),
                        'venue': training.venue_name or '',
                        'trainer': training.trainer_name or '',
                    },
                    content_type='training-schedule',
                    content_id=training.id,
                    content_title=training.title,
                )
                sent_count += len(users)

        self.stdout.write(
            self.style.SUCCESS(f'Sent {sent_count} training reminder notifications.')
        )
