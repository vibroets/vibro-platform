from django.db.models import Q, Count
from django.utils import timezone
from django.db.models.functions import TruncDate
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from user.models import CustomUser, Groups, Locations
from .models import Poll, PollQuestion, PollShare, PollResponse
from .serializers import (
    PollSerializer, PollQuestionSerializer, PollShareSerializer,
    PollResponseSerializer, PollMobileSerializer
)


class PollViewSet(viewsets.ModelViewSet):
    serializer_class = PollSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Poll.objects.all()
        return Poll.objects.filter(organization=user.organization)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, organization=self.request.user.organization)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        poll = self.get_object()
        user_ids = request.data.get('users', [])
        group_ids = request.data.get('groups', [])
        location_ids = request.data.get('locations', [])

        created = []
        for uid in user_ids:
            if CustomUser.objects.filter(id=uid, organization=poll.organization).exists():
                share = PollShare.objects.create(poll=poll, sent_to_user_id=uid)
                created.append(share.id)
        for gid in group_ids:
            if Groups.objects.filter(id=gid, organization=poll.organization).exists():
                share = PollShare.objects.create(poll=poll, sent_to_group_id=gid)
                created.append(share.id)
        for lid in location_ids:
            if Locations.objects.filter(id=lid, organization=poll.organization).exists():
                share = PollShare.objects.create(poll=poll, sent_to_location_id=lid)
                created.append(share.id)

        return Response({"shared_count": len(created), "share_ids": created}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        poll = self.get_object()
        user = request.user
        answers = request.data.get('answers', [])

        # For anonymous polls, don't link user to responses
        response_user = None if poll.anonymous else user

        if not poll.allow_multiple_responses and PollResponse.objects.filter(poll=poll, user=user).exists():
            return Response({"error": "You have already submitted this poll."}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for ans in answers:
            question_id = ans.get('question_id')
            question = PollQuestion.objects.filter(id=question_id, poll=poll).first()
            if not question:
                continue

            data = {"poll": poll.id, "question": question.id, "answer_text": None, "answer_value": None, "answer_options": []}
            if question.question_type in ["multiple-choice", "yes-no", "text", "emoji"]:
                data["answer_text"] = ans.get('answer')
            elif question.question_type == "checkbox":
                data["answer_options"] = ans.get('answer', [])
            elif question.question_type == "rating":
                data["answer_value"] = ans.get('answer')

            PollResponse.objects.filter(poll=poll, user=user, question=question).delete()
            serializer = PollResponseSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save(user=response_user)
            created.append(serializer.data)

        PollShare.objects.filter(poll=poll, sent_to_user=user).update(share_status='submitted')
        return Response({"submitted_count": len(created), "responses": created}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        poll = self.get_object()

        # Collect all eligible user IDs from PollShare (users, group members, location users)
        eligible_user_ids = set()

        # Direct user shares - only non-deleted users
        user_shares = PollShare.objects.filter(
            poll=poll, sent_to_user__isnull=False, sent_to_user__is_deleted=False
        ).values_list('sent_to_user_id', flat=True)
        eligible_user_ids.update(user_shares)

        # Group shares - expand group members (filter is_deleted)
        # Deduplicate by group to avoid counting same group multiple times
        group_shares = PollShare.objects.filter(
            poll=poll, sent_to_group__isnull=False
        ).select_related('sent_to_group')
        seen_group_ids = set()
        for gs in group_shares:
            if gs.sent_to_group_id in seen_group_ids:
                continue
            seen_group_ids.add(gs.sent_to_group_id)
            member_ids = gs.sent_to_group.members.filter(is_deleted=False).values_list('id', flat=True)
            eligible_user_ids.update(member_ids)

        # Location shares - expand users at location
        # Deduplicate by location
        location_shares = PollShare.objects.filter(
            poll=poll, sent_to_location__isnull=False
        ).select_related('sent_to_location')
        seen_location_ids = set()
        for ls in location_shares:
            if ls.sent_to_location_id in seen_location_ids:
                continue
            seen_location_ids.add(ls.sent_to_location_id)
            loc_user_ids = CustomUser.objects.filter(
                location=ls.sent_to_location, is_deleted=False
            ).values_list('id', flat=True)
            eligible_user_ids.update(loc_user_ids)

        # Users who have submitted responses (only count identified users)
        all_responded_user_ids = set(
            PollResponse.objects.filter(poll=poll, user__isnull=False)
            .values_list('user_id', flat=True).distinct()
        )
        # Only count responses from eligible users
        responded_user_ids = all_responded_user_ids & eligible_user_ids

        total_eligible = len(eligible_user_ids)
        responses_received = len(responded_user_ids)
        pending_responses = total_eligible - responses_received
        response_percentage = round((responses_received / total_eligible * 100), 1) if total_eligible > 0 else 0

        # Anonymous responses count (responses with no user linked)
        anonymous_responses = PollResponse.objects.filter(
            poll=poll, user__isnull=True
        ).values('user').distinct().count()

        # Department-wise participation
        dept_participation = {}
        responded_users = CustomUser.objects.filter(
            id__in=responded_user_ids, is_deleted=False
        ).select_related('department')
        for user in responded_users:
            dept_name = user.department.name if user.department else "No Department"
            if dept_name not in dept_participation:
                dept_participation[dept_name] = {"department": dept_name, "responded": 0, "total": 0}
            dept_participation[dept_name]["responded"] += 1

        # Count total eligible per department
        eligible_users = CustomUser.objects.filter(
            id__in=eligible_user_ids, is_deleted=False
        ).select_related('department')
        for user in eligible_users:
            dept_name = user.department.name if user.department else "No Department"
            if dept_name not in dept_participation:
                dept_participation[dept_name] = {"department": dept_name, "responded": 0, "total": 0}
            dept_participation[dept_name]["total"] += 1

        dept_list = list(dept_participation.values())
        for d in dept_list:
            d["pending"] = d["total"] - d["responded"]
            d["percentage"] = round((d["responded"] / d["total"] * 100), 1) if d["total"] > 0 else 0

        # Response trends (daily counts) - count distinct users per day
        daily_responses = (
            PollResponse.objects.filter(poll=poll, user__isnull=False)
            .annotate(date=TruncDate('submitted_on'))
            .values('date')
            .annotate(count=Count('user', distinct=True))
            .order_by('date')
        )
        response_trends = [
            {"date": item['date'].strftime('%Y-%m-%d'), "count": item['count']}
            for item in daily_responses
        ]

        # Cumulative trend
        cumulative = 0
        cumulative_trends = []
        for t in response_trends:
            cumulative += t["count"]
            cumulative_trends.append({"date": t["date"], "count": cumulative})

        # Group-wise participation (deduplicated)
        group_participation = []
        seen_group_ids_gp = set()
        for gs in group_shares:
            if gs.sent_to_group_id in seen_group_ids_gp:
                continue
            seen_group_ids_gp.add(gs.sent_to_group_id)
            group = gs.sent_to_group
            member_ids = set(group.members.filter(is_deleted=False).values_list('id', flat=True))
            responded_in_group = member_ids & responded_user_ids
            total_in_group = len(member_ids)
            responded_count = len(responded_in_group)
            group_participation.append({
                "name": group.name,
                "total": total_in_group,
                "responded": responded_count,
                "pending": total_in_group - responded_count,
                "percentage": round((responded_count / total_in_group * 100), 1) if total_in_group > 0 else 0,
            })

        # Location-wise participation (deduplicated)
        location_participation = []
        seen_location_ids_lp = set()
        for ls in location_shares:
            if ls.sent_to_location_id in seen_location_ids_lp:
                continue
            seen_location_ids_lp.add(ls.sent_to_location_id)
            loc = ls.sent_to_location
            loc_user_ids = set(CustomUser.objects.filter(
                location=loc, is_deleted=False
            ).values_list('id', flat=True))
            responded_at_loc = loc_user_ids & responded_user_ids
            total_at_loc = len(loc_user_ids)
            responded_count = len(responded_at_loc)
            location_participation.append({
                "name": loc.name,
                "total": total_at_loc,
                "responded": responded_count,
                "pending": total_at_loc - responded_count,
                "percentage": round((responded_count / total_at_loc * 100), 1) if total_at_loc > 0 else 0,
            })

        # User-wise list (eligible users with response status)
        user_wise = []
        eligible_user_objs = CustomUser.objects.filter(
            id__in=eligible_user_ids, is_deleted=False
        ).select_related('department', 'location')
        for user in eligible_user_objs:
            user_wise.append({
                "id": user.id,
                "name": f"{user.first_name} {user.last_name}".strip() or user.username or user.email,
                "email": user.email,
                "department": user.department.name if user.department else "No Department",
                "location": user.location.name if user.location else "No Location",
                "responded": user.id in responded_user_ids,
            })

        # Department × Location heat map data
        heat_map = {}
        for user in eligible_user_objs:
            dept = user.department.name if user.department else "No Department"
            loc = user.location.name if user.location else "No Location"
            key = f"{dept}||{loc}"
            if key not in heat_map:
                heat_map[key] = {"department": dept, "location": loc, "total": 0, "responded": 0}
            heat_map[key]["total"] += 1
            if user.id in responded_user_ids:
                heat_map[key]["responded"] += 1
        heat_map_list = []
        for h in heat_map.values():
            h["pending"] = h["total"] - h["responded"]
            h["percentage"] = round((h["responded"] / h["total"] * 100), 1) if h["total"] > 0 else 0
            heat_map_list.append(h)

        # Poll history timeline
        history = []
        # Creation event
        history.append({
            "event": "Poll Created",
            "timestamp": poll.created_on.strftime('%Y-%m-%d %H:%M') if poll.created_on else "—",
            "details": f"Created by {poll.created_by.first_name} {poll.created_by.last_name}".strip() if poll.created_by else "",
        })
        # Share events
        all_shares = PollShare.objects.filter(poll=poll).select_related('sent_to_user', 'sent_to_group', 'sent_to_location').order_by('sent_timestamp')
        for share in all_shares:
            target = ""
            if share.sent_to_user:
                target = f"User: {share.sent_to_user.first_name} {share.sent_to_user.last_name}".strip()
            elif share.sent_to_group:
                target = f"Group: {share.sent_to_group.name}"
            elif share.sent_to_location:
                target = f"Location: {share.sent_to_location.name}"
            history.append({
                "event": "Poll Shared",
                "timestamp": share.sent_timestamp.strftime('%Y-%m-%d %H:%M') if share.sent_timestamp else "—",
                "details": target,
            })
        # First response event
        first_response = PollResponse.objects.filter(poll=poll).order_by('submitted_on').first()
        if first_response:
            history.append({
                "event": "First Response Received",
                "timestamp": first_response.submitted_on.strftime('%Y-%m-%d %H:%M') if first_response.submitted_on else "—",
                "details": "",
            })
        # Last response event
        last_response = PollResponse.objects.filter(poll=poll).order_by('-submitted_on').first()
        if last_response:
            history.append({
                "event": "Latest Response",
                "timestamp": last_response.submitted_on.strftime('%Y-%m-%d %H:%M') if last_response.submitted_on else "—",
                "details": "",
            })
        # Status change (if closed)
        if not poll.is_active:
            history.append({
                "event": "Poll Closed",
                "timestamp": "—",
                "details": "Poll has been deactivated",
            })
        # Sort history by timestamp
        history.sort(key=lambda x: x["timestamp"], reverse=True)

        return Response({
            "total_eligible_users": total_eligible,
            "responses_received": responses_received,
            "pending_responses": pending_responses,
            "response_percentage": response_percentage,
            "anonymous_responses": anonymous_responses,
            "department_participation": dept_list,
            "response_trends": response_trends,
            "cumulative_trends": cumulative_trends,
            "group_participation": group_participation,
            "location_participation": location_participation,
            "user_wise": user_wise,
            "heat_map": heat_map_list,
            "poll_history": history,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def responses(self, request, pk=None):
        poll = self.get_object()
        responses = PollResponse.objects.filter(poll=poll).select_related('user', 'user__department', 'question').order_by('-submitted_on')

        # Group by user (one entry per user submission)
        user_responses = {}
        for r in responses:
            uid = r.user_id
            if uid not in user_responses:
                user_responses[uid] = {
                    "id": uid,
                    "respondent": f"{r.user.first_name} {r.user.last_name}".strip() if r.user else "Anonymous",
                    "department": r.user.department.name if r.user and r.user.department else "—",
                    "submittedOn": r.submitted_on.strftime("%Y-%m-%d %H:%M") if r.submitted_on else "—",
                    "answers": [],
                }
            user_responses[uid]["answers"].append({
                "questionId": str(r.question_id),
                "question": r.question.question_text,
                "answer": r.answer_text or (r.answer_options if r.answer_options else r.answer_value),
            })

        return Response(list(user_responses.values()), status=status.HTTP_200_OK)


class PollQuestionViewSet(viewsets.ModelViewSet):
    queryset = PollQuestion.objects.all()
    serializer_class = PollQuestionSerializer
    permission_classes = [IsAuthenticated]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_polls(request):
    user = request.user
    now = timezone.now()

    # Exclude polls the user has already submitted responses to
    submitted_poll_ids = PollResponse.objects.filter(user=user).values_list('poll_id', flat=True)

    user_shares = PollShare.objects.filter(
        Q(sent_to_user=user) |
        Q(sent_to_group__members=user) |
        Q(sent_to_location=user.location)
    ).select_related('poll').filter(
        poll__is_active=True,
        poll__end_date__gte=now
    ).exclude(poll_id__in=submitted_poll_ids)

    poll_ids = [share.poll_id for share in user_shares]
    polls = Poll.objects.filter(id__in=poll_ids)

    data = []
    for poll in polls:
        share = user_shares.filter(poll=poll).first()
        serializer = PollMobileSerializer(poll, context={'user_id': user.id})
        serialized = serializer.data
        serialized['share_id'] = share.id if share else None
        data.append(serialized)

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sent_polls(request):
    user = request.user
    responses = PollResponse.objects.filter(user=user).select_related('poll').order_by('-submitted_on')
    poll_ids = list({r.poll_id for r in responses})
    polls = Poll.objects.filter(id__in=poll_ids)
    serializer = PollMobileSerializer(polls, many=True, context={'user_id': user.id})
    return Response(serializer.data)
