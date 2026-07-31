from django.db.models import Count, Q as models
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from vibro.views import userContextAPIView
from .models import (
    LearningCourse, LearningCourseAssignment,
    Quiz, VideoContent, TrainingItem, TrainingSchedule,
    Trainer, Venue, Enrollment, ApprovalRequest,
    NotificationTemplate, TrainingAttendance, LTDraft,
    QuizResult, Certificate, NotificationLog,
)
from .notification_utils import dispatch_notification
from user.models import CustomUser, Groups, LocationLeader, Locations
from .serializers import (
    LearningCourseSerializer,
    LearningCourseAssignmentSerializer,
    MyCourseSerializer,
    CourseShareSerializer,
    QuizSerializer,
    VideoContentSerializer,
    TrainingItemSerializer,
    TrainingScheduleSerializer,
    TrainerSerializer,
    VenueSerializer,
    EnrollmentSerializer,
    ApprovalRequestSerializer,
    NotificationTemplateSerializer,
    TrainingAttendanceSerializer,
    LTDraftSerializer,
    QuizResultSerializer,
    CertificateSerializer,
    NotificationLogSerializer,
)

class LearningCourseViewSet(userContextAPIView, ModelViewSet):
    """
    Admin-facing CRUD for learning courses.
    Includes logic to 'Share' (Assign) courses and fetch User/Group lists.
    """
    permission_classes = [IsAuthenticated]
    queryset = LearningCourse.objects.all()
    serializer_class = LearningCourseSerializer

    def get_queryset(self):
        return (
            LearningCourse.objects.filter(
                organization=self.request.user.organization
            )
            .annotate(enrollment_count=Count("assignments"))
            .select_related("organization", "created_by", "updated_by")
        )

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user, updated_on=timezone.now())

    # --- NEW HELPER: Get Clean User List ---
    @action(detail=False, methods=['get'], url_path='users-list')
    def get_users_list(self, request):
        """
        Returns a clean list of active, non-deleted, non-archived users with names for the dropdown.
        """
        users = CustomUser.objects.filter(
            organization=request.user.organization,
            is_active=True,
            is_deleted=False,
            is_archived=False
        )
        data = []
        for u in users:
            data.append({
                'id': u.id,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'username': u.username,
                'email': u.email
            })
        return Response(data, status=status.HTTP_200_OK)

    # --- NEW HELPER: Get Clean Group List ---
    @action(detail=False, methods=['get'], url_path='groups-list')
    def get_groups_list(self, request):
        groups = Groups.objects.filter(
            organization=request.user.organization,
            is_deleted=False,
            is_archived=False
        )
        data = [{'id': g.id, 'name': g.name} for g in groups]
        return Response(data, status=status.HTTP_200_OK)

    # --- NEW HELPER: Get Clean Location List ---
    @action(detail=False, methods=['get'], url_path='locations-list')
    def get_locations_list(self, request):
        locations = Locations.objects.filter(organization=request.user.organization)
        data = [{'id': loc.id, 'name': loc.name} for loc in locations]
        return Response(data, status=status.HTTP_200_OK)

    # --- MY ASSIGNED CONTENT (for mobile learn module) ---
    @action(detail=False, methods=['get'], url_path='my-assigned-content')
    def get_my_assigned_content(self, request):
        """
        Returns quizzes, videos, and training items assigned to the current user
        via selected_users (containing user id), selected_groups, or selected_locations.
        Also returns user's group ids and location ids for client-side filtering.
        """
        user = request.user
        user_id_str = str(user.id)

        # Get user's groups
        user_group_ids = list(user.user_groups.values_list('id', flat=True)) if hasattr(user, 'user_groups') else []
        user_group_id_strs = [str(gid) for gid in user_group_ids]

        # Get user's locations (via LocationLeader or user.location)
        user_location_ids = []
        try:
            from user.models import LocationLeader
            leader_locs = LocationLeader.objects.filter(user=user)
            user_location_ids = list(leader_locs.values_list('location_id', flat=True))
        except Exception:
            pass
        if not user_location_ids and hasattr(user, 'location_id') and user.location_id:
            user_location_ids = [user.location_id]
        user_location_id_strs = [str(lid) for lid in user_location_ids]

        def is_assigned(item):
            sel_users = item.get('selected_users') or []
            sel_groups = item.get('selected_groups') or []
            sel_locs = item.get('selected_locations') or []
            # Convert all to strings for comparison
            sel_users = [str(s) for s in sel_users]
            sel_groups = [str(s) for s in sel_groups]
            sel_locs = [str(s) for s in sel_locs]
            return (user_id_str in sel_users or
                    any(gid in sel_groups for gid in user_group_id_strs) or
                    any(lid in sel_locs for lid in user_location_id_strs))

        quizzes = Quiz.objects.filter(organization=user.organization, is_draft=False)
        videos = VideoContent.objects.filter(organization=user.organization, is_draft=False)
        trainings = TrainingItem.objects.filter(organization=user.organization, is_draft=False)

        quiz_data = QuizSerializer(quizzes, many=True, context={'request': request}).data
        video_data = VideoContentSerializer(videos, many=True, context={'request': request}).data
        training_data = TrainingItemSerializer(trainings, many=True, context={'request': request}).data

        # Filter to only assigned items
        assigned_quizzes = [q for q in quiz_data if is_assigned(q)]
        assigned_videos = [v for v in video_data if is_assigned(v)]
        assigned_trainings = [t for t in training_data if is_assigned(t)]

        # Add type field
        for q in assigned_quizzes:
            q['type'] = 'quiz'
        for v in assigned_videos:
            v['type'] = 'video'
        for t in assigned_trainings:
            t['type'] = 'training'

        # Fetch training schedules the user is enrolled in
        enrolled_schedule_ids = Enrollment.objects.filter(
            participant=user,
            content_type='training-schedule',
            organization=user.organization,
            status='approved',
        ).values_list('content_id', flat=True)

        schedule_ids = [int(cid) for cid in enrolled_schedule_ids if str(cid).isdigit()]
        schedules = TrainingSchedule.objects.filter(
            id__in=schedule_ids,
            organization=user.organization,
            status__in=['approved', 'completed'],
        )
        schedule_data = TrainingScheduleSerializer(schedules, many=True).data
        for s in schedule_data:
            s['type'] = 'training-schedule'
            # Resolve lt_content_ids to actual content data
            linked_content = []
            for item in (s.get('lt_content_ids') or []):
                if isinstance(item, dict):
                    cid = item.get('id')
                    ctype = item.get('type')
                elif isinstance(item, (int, str)):
                    cid = item
                    ctype = None
                else:
                    continue
                try:
                    cid = int(cid)
                except (ValueError, TypeError):
                    continue
                if ctype == 'quiz':
                    q = Quiz.objects.filter(id=cid, organization=user.organization).first()
                    if q:
                        qd = QuizSerializer(q, context={'request': request}).data
                        qd['type'] = 'quiz'
                        linked_content.append(qd)
                elif ctype == 'video':
                    v = VideoContent.objects.filter(id=cid, organization=user.organization).first()
                    if v:
                        vd = VideoContentSerializer(v, context={'request': request}).data
                        vd['type'] = 'video'
                        linked_content.append(vd)
                elif ctype == 'training':
                    t = TrainingItem.objects.filter(id=cid, organization=user.organization).first()
                    if t:
                        td = TrainingItemSerializer(t, context={'request': request}).data
                        td['type'] = 'training'
                        linked_content.append(td)
                elif ctype is None:
                    # Legacy format: plain integer ID without type info.
                    # Search all three content models to find the match.
                    q = Quiz.objects.filter(id=cid, organization=user.organization).first()
                    if q:
                        qd = QuizSerializer(q, context={'request': request}).data
                        qd['type'] = 'quiz'
                        linked_content.append(qd)
                        continue
                    v = VideoContent.objects.filter(id=cid, organization=user.organization).first()
                    if v:
                        vd = VideoContentSerializer(v, context={'request': request}).data
                        vd['type'] = 'video'
                        linked_content.append(vd)
                        continue
                    t = TrainingItem.objects.filter(id=cid, organization=user.organization).first()
                    if t:
                        td = TrainingItemSerializer(t, context={'request': request}).data
                        td['type'] = 'training'
                        linked_content.append(td)
            s['linked_content'] = linked_content

            # Include user's attendance status for this schedule
            att = TrainingAttendance.objects.filter(
                training_id=str(s['id']),
                user=user,
                organization=user.organization,
            ).first()
            s['my_attendance'] = TrainingAttendanceSerializer(att).data if att else None

        return Response({
            'quizzes': assigned_quizzes,
            'videos': assigned_videos,
            'trainings': assigned_trainings,
            'training_schedules': schedule_data,
            'user_group_ids': user_group_id_strs,
            'user_location_ids': user_location_id_strs,
        }, status=status.HTTP_200_OK)

    # --- SUBMIT QUIZ RESULT (from mobile app) ---
    @action(detail=False, methods=['post'], url_path='submit-quiz-result')
    def submit_quiz_result(self, request):
        user = request.user
        data = request.data
        content_type = data.get('content_type', 'quiz')
        content_id = data.get('content_id')
        content_title = data.get('content_title', '')
        score = data.get('score', 0)
        correct_answers = data.get('correct_answers', 0)
        total_questions = data.get('total_questions', 0)
        time_taken = data.get('time_taken', 0)
        answers = data.get('answers', [])
        questions = data.get('questions', [])
        pass_percentage = data.get('pass_percentage', 70)
        if content_type in ('video', 'training') and total_questions == 0:
            status_val = 'passed'
        else:
            status_val = 'passed' if score >= pass_percentage else 'failed'

        result = QuizResult.objects.create(
            content_type=content_type,
            content_id=content_id,
            content_title=content_title,
            user=user,
            user_name=f"{user.first_name} {user.last_name}".strip() or user.username,
            score=score,
            correct_answers=correct_answers,
            total_questions=total_questions,
            time_taken=time_taken,
            answers=answers,
            questions=questions,
            pass_percentage=pass_percentage,
            status=status_val,
            organization=user.organization,
        )

        notif_type = 'quiz-completed' if status_val == 'passed' else 'quiz-failed'
        dispatch_notification(
            notif_type=notif_type,
            users=[user],
            organization=user.organization,
            context={'title': content_title, 'score': score, 'user': result.user_name},
            content_type=content_type,
            content_id=content_id,
            content_title=content_title,
        )

        return Response(QuizResultSerializer(result).data, status=status.HTTP_201_CREATED)

    # --- MY QUIZ RESULTS (for mobile app) ---
    @action(detail=False, methods=['get'], url_path='my-results')
    def my_results(self, request):
        user = request.user
        results = QuizResult.objects.filter(user=user).order_by('-completed_at')
        return Response(QuizResultSerializer(results, many=True).data, status=status.HTTP_200_OK)

    # --- MY CERTIFICATES (for mobile app) ---
    @action(detail=False, methods=['get'], url_path='my-certificates')
    def my_certificates(self, request):
        user = request.user
        certs = Certificate.objects.filter(user=user).order_by('-issued_at')
        # Only return certificates where the user actually passed
        certs = [c for c in certs if c.score >= (c.pass_percentage or 70)]
        return Response(CertificateSerializer(certs, many=True).data, status=status.HTTP_200_OK)

    # --- ADMIN: ALL QUIZ RESULTS ---
    @action(detail=False, methods=['get'], url_path='all-quiz-results')
    def all_quiz_results(self, request):
        results = QuizResult.objects.all().order_by('-completed_at')
        data = QuizResultSerializer(results, many=True).data
        for r in data:
            user = CustomUser.objects.filter(id=r['user']).first()
            if user:
                dept = user.department
                r['user_department'] = str(dept) if dept else None
            else:
                r['user_department'] = None
        return Response(data, status=status.HTTP_200_OK)

    # --- ADMIN: USERS LIST (for filters and share) ---
    @action(detail=False, methods=['get'], url_path='users-list')
    def users_list(self, request):
        users = CustomUser.objects.all().values('id', 'first_name', 'last_name', 'username', 'email', 'department')
        user_list = []
        for u in users:
            dept = u.get('department')
            user_list.append({
                'id': u['id'],
                'name': f"{u['first_name']} {u['last_name']}".strip() or u['username'],
                'username': u['username'],
                'email': u['email'],
                'department': str(dept) if dept else None,
            })
        return Response(user_list, status=status.HTTP_200_OK)

    # --- ADMIN: ISSUE CERTIFICATE ---
    @action(detail=False, methods=['post'], url_path='issue-certificate')
    def issue_certificate(self, request):
        import uuid, hashlib
        data = request.data
        result_id = data.get('result_id')
        try:
            result = QuizResult.objects.get(id=result_id)
        except QuizResult.DoesNotExist:
            return Response({'error': 'Result not found'}, status=status.HTTP_404_NOT_FOUND)

        existing = Certificate.objects.filter(result=result).first()
        if existing:
            return Response({'error': 'Certificate already issued for this result'}, status=status.HTTP_400_BAD_REQUEST)

        # Strict check: only passed users can get a certificate
        if result.score < (result.pass_percentage or 70):
            return Response({'error': 'Certificate cannot be issued - user did not pass (score below pass threshold)'}, status=status.HTTP_400_BAD_REQUEST)

        cert_number = f"VIBLTD-{uuid.uuid4().hex[:8].upper()}-{uuid.uuid4().hex[:8].upper()}"
        validity_value = data.get('validity_value', 1)
        validity_unit = data.get('validity_unit', 'years')

        from datetime import datetime, timedelta
        from dateutil.relativedelta import relativedelta
        issued_at = datetime.now()
        if validity_unit == 'days':
            expires_at = issued_at + timedelta(days=validity_value)
        elif validity_unit == 'months':
            expires_at = issued_at + relativedelta(months=validity_value)
        else:
            expires_at = issued_at + relativedelta(years=validity_value)

        cert = Certificate.objects.create(
            certificate_number=cert_number,
            result=result,
            user=result.user,
            user_name=result.user_name,
            user_department=data.get('user_department', ''),
            quiz_id=result.content_id,
            quiz_title=result.content_title,
            training_type=result.content_type,
            score=result.score,
            pass_percentage=result.pass_percentage,
            issued_at=issued_at,
            expires_at=expires_at,
            validity_value=validity_value,
            validity_unit=validity_unit,
            status='active',
            organization_name='VIBRO Learning, Training & Development',
        )

        dispatch_notification(
            notif_type='certificate-issued',
            users=[result.user],
            organization=result.user.organization,
            context={'title': result.content_title, 'cert_number': cert_number, 'user': result.user_name},
            content_type=result.content_type,
            content_id=result.content_id,
            content_title=result.content_title,
        )

        return Response(CertificateSerializer(cert).data, status=status.HTTP_201_CREATED)

    # --- ADMIN: ALL CERTIFICATES ---
    @action(detail=False, methods=['get'], url_path='all-certificates')
    def all_certificates(self, request):
        certs = Certificate.objects.all().order_by('-issued_at')
        # Only return certificates where the user actually passed
        certs = [c for c in certs if c.score >= (c.pass_percentage or 70)]
        return Response(CertificateSerializer(certs, many=True).data, status=status.HTTP_200_OK)

    # --- ADMIN: SHARE CERTIFICATE ---
    @action(detail=False, methods=['post'], url_path='share-certificate')
    def share_certificate(self, request):
        data = request.data
        cert_id = data.get('certificate_id')
        share_type = data.get('share_type')  # 'user', 'group', 'location', 'email'

        try:
            cert = Certificate.objects.get(id=cert_id)
        except Certificate.DoesNotExist:
            return Response({'error': 'Certificate not found'}, status=status.HTTP_404_NOT_FOUND)

        cert_data = CertificateSerializer(cert).data
        share_text = (
            f"{cert.user_name} earned a certificate for completing "
            f'"{cert.quiz_title}" with {cert.score}%. '
            f"Certificate No: {cert.certificate_number}"
        )

        if share_type == 'email':
            email = data.get('email')
            if not email:
                return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

            from django.core.mail import EmailMultiAlternatives
            from django.conf import settings

            subject = f"Certificate of Completion - {cert.quiz_title or 'Training Program'}"
            issued_date = cert.issued_at.strftime('%B %d, %Y') if cert.issued_at else ''
            expiry_date = cert.expires_at.strftime('%B %d, %Y') if cert.expires_at else 'No Expiry'

            text_message = (
                f"Dear Recipient,\n\n"
                f"This certificate has been shared with you.\n\n"
                f"Recipient: {cert.user_name}\n"
                f"Training: {cert.quiz_title or 'Training Program'}\n"
                f"Score: {cert.score}%\n"
                f"Certificate No: {cert.certificate_number}\n"
                f"Issued On: {issued_date}\n"
                f"Valid Until: {expiry_date}\n"
                f"Organization: {cert.organization_name}\n\n"
                f"Thank you,\n"
                f"VIBRO Learning, Training & Development"
            )

            html_message = f"""
            <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #fff; border: 4px solid #d97706; border-radius: 8px; margin: 20px;">
                <div style="border: 2px solid #1e3a5f; border-radius: 4px; margin: 8px; padding: 24px; text-align: center;">
                  <h2 style="color: #1e3a5f; font-family: Georgia, serif; margin: 0 0 8px;">{cert.organization_name}</h2>
                  <div style="width: 120px; height: 3px; background: #d97706; margin: 0 auto 16px;"></div>
                  <h1 style="color: #d97706; font-family: Georgia, serif; font-size: 24px; margin: 0 0 16px;">CERTIFICATE OF COMPLETION</h1>
                  <p style="color: #6b7280; font-style: italic; margin: 0 0 8px;">This certificate is awarded to</p>
                  <h3 style="color: #1e3a5f; font-family: Georgia, serif; font-size: 22px; margin: 0 0 8px;">{cert.user_name}</h3>
                  <div style="width: 80px; height: 1.5px; background: #d97706; margin: 8px auto;"></div>
                  <p style="color: #6b7280; font-style: italic; margin: 8px 0;">for successfully completing</p>
                  <h4 style="color: #1e3a5f; font-family: Georgia, serif; font-size: 18px; margin: 4px 0;">{cert.quiz_title or 'Training Program'}</h4>
                  <div style="background: #fef3c7; display: inline-block; padding: 8px 16px; border-radius: 20px; margin: 12px 0;">
                    <span style="color: #92400e; font-weight: bold;">Score: {cert.score}% (Pass: {cert.pass_percentage}%)</span>
                  </div>
                  <div style="margin: 12px 0; color: #6b7280; font-size: 13px;">
                    <p style="margin: 2px 0;">Issued on: <strong>{issued_date}</strong></p>
                    <p style="margin: 2px 0;">Valid until: <strong>{expiry_date}</strong></p>
                  </div>
                  <div style="background: linear-gradient(to right, #facc15, #d97706); color: #fff; display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin: 8px 0;">
                    Certified Professional
                  </div>
                  <p style="color: #d97706; font-weight: bold; font-size: 12px; margin: 8px 0;">Certificate No: {cert.certificate_number}</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                      <p style="color: #1e3a5f; font-weight: bold; font-size: 12px; margin: 0;">{cert.organization_name}</p>
                      <p style="color: #9ca3af; font-size: 11px; margin: 2px 0;">Authorized Signatory</p>
                      <p style="color: #2563eb; font-size: 11px; font-weight: 600; margin: 4px 0;">Digitally Signed</p>
                    </div>
                  </div>
                </div>
              </div>
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
                This certificate was shared with you via VIBRO Learning, Training & Development.
              </p>
            </body></html>
            """

            try:
                msg = EmailMultiAlternatives(
                    subject,
                    text_message,
                    settings.EMAIL_FROM_ADDRESS,
                    [email],
                )
                msg.attach_alternative(html_message, "text/html")
                msg.send(fail_silently=False)
                return Response({'message': f'Certificate sent to {email}'}, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({'error': f'Failed to send email: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        elif share_type == 'group':
            group_id = data.get('group_id')
            if not group_id:
                return Response({'error': 'group_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            # Get users in the group and share with them
            from accounts.models import CustomUser
            users = CustomUser.objects.filter(groups__id=group_id)
            count = users.count()
            return Response({'message': f'Certificate shared with group ({count} users)'}, status=status.HTTP_200_OK)

        elif share_type == 'location':
            location_id = data.get('location_id')
            if not location_id:
                return Response({'error': 'location_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            from accounts.models import CustomUser
            users = CustomUser.objects.filter(location_id=location_id)
            count = users.count()
            return Response({'message': f'Certificate shared with location ({count} users)'}, status=status.HTTP_200_OK)

        elif share_type == 'user':
            user_id = data.get('user_id')
            if not user_id:
                return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': 'Certificate shared with user'}, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid share_type'}, status=status.HTTP_400_BAD_REQUEST)

    # --- ADMIN: QUIZ RESULTS BY CONTENT ---
    @action(detail=False, methods=['get'], url_path='results-by-content')
    def results_by_content(self, request):
        content_id = request.query_params.get('content_id')
        if not content_id:
            return Response({'error': 'content_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        results = QuizResult.objects.filter(content_id=content_id).order_by('-completed_at')
        data = []
        for r in results:
            user = CustomUser.objects.filter(id=r.user_id).first()
            dept = str(user.department) if user and user.department else None
            data.append({
                'id': r.id,
                'user_id': r.user_id,
                'user_name': r.user_name,
                'user_email': user.email if user else '',
                'user_department': dept,
                'content_id': r.content_id,
                'content_title': r.content_title,
                'content_type': r.content_type,
                'score': r.score,
                'correct_answers': r.correct_answers,
                'total_questions': r.total_questions,
                'pass_percentage': r.pass_percentage,
                'passed': r.score >= (r.pass_percentage or 70),
                'completed_at': r.completed_at.isoformat() if r.completed_at else None,
                'time_taken': r.time_taken,
            })
        return Response(data, status=status.HTTP_200_OK)

    # --- EXISTING SHARE FUNCTION ---
    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        course = self.get_object()
        serializer = CourseShareSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        users = serializer.validated_data.get('users', [])
        groups = serializer.validated_data.get('groups', [])
        start_date = serializer.validated_data.get('start_date')
        due_date = serializer.validated_data.get('due_date')

        created_count = 0

        # 1. Share with Users
        for user_id in users:
            obj, created = LearningCourseAssignment.objects.update_or_create(
                course=course,
                assigned_user_id=user_id,
                defaults={
                    'start_date': start_date,
                    'due_date': due_date,
                    'assigned_group': None,
                }
            )
            created_count += 1

        # 2. Share with Groups
        for group_id in groups:
            obj, created = LearningCourseAssignment.objects.update_or_create(
                course=course,
                assigned_group_id=group_id,
                defaults={
                    'start_date': start_date,
                    'due_date': due_date,
                    'assigned_user': None
                }
            )
            created_count += 1

        return Response(
            {'message': f'Course assigned successfully to {created_count} entities.'},
            status=status.HTTP_200_OK
        )


class LearningCourseAssignmentViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = LearningCourseAssignment.objects.all()
    serializer_class = LearningCourseAssignmentSerializer

    def get_queryset(self):
        return LearningCourseAssignment.objects.filter(
            course__organization=self.request.user.organization
        ).select_related(
            "course", "assigned_user", "assigned_group", "assigned_location_leader"
        )


class MyCoursesViewSet(userContextAPIView, ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MyCourseSerializer

    def get_queryset(self):
        user = self.request.user
        direct = LearningCourseAssignment.objects.filter(
            course__organization=user.organization,
            assigned_user=user
        )
        group = LearningCourseAssignment.objects.filter(
            course__organization=user.organization,
            assigned_group__members=user
        )
        return (direct | group).select_related("course").distinct()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        filter_status = request.query_params.get("status")
        if filter_status == "completed":
            queryset = queryset.filter(completion_status="completed")
            
        data = []
        for assignment in queryset:
            course_data = MyCourseSerializer(
                assignment.course,
                context=self.get_serializer_context()
            ).data
            course_data["assignment_id"] = assignment.id
            course_data["completion_status"] = assignment.completion_status
            course_data["completed_on"] = assignment.completed_on
            course_data["start_date"] = assignment.start_date
            course_data["due_date"] = assignment.due_date
            data.append(course_data)
            
        return Response(data)

    @action(detail=True, methods=["patch"])
    def mark_completed(self, request, pk=None):
        assignment = self.get_object()
        assignment.completion_status = "completed"
        assignment.completed_by = request.user
        assignment.completed_on = timezone.now()
        assignment.save(update_fields=["completion_status", "completed_by", "completed_on"])
        return Response({"message": "Course marked as completed"}, status=status.HTTP_200_OK)


class QuizViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = QuizSerializer

    def get_queryset(self):
        return Quiz.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())


class VideoContentViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = VideoContentSerializer

    def get_queryset(self):
        return VideoContent.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())


class TrainingItemViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TrainingItemSerializer

    def get_queryset(self):
        return TrainingItem.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())


class TrainingScheduleViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TrainingScheduleSerializer

    def get_queryset(self):
        return TrainingSchedule.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        training = serializer.save(organization=self.request.user.organization, created_by=self.request.user)
        # Notify the creator that training was created
        dispatch_notification(
            notif_type='training-created',
            users=[self.request.user],
            organization=self.request.user.organization,
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

        # Auto-create approval request if approval_type is configured
        approval_type = getattr(training, 'approval_type', 'none')
        approval_chain = getattr(training, 'approval_chain', [])
        if approval_type and approval_type != 'none' and approval_chain:
            requester = self.request.user
            requester_name = f"{requester.first_name} {requester.last_name}".strip() or requester.username
            levels = [c.get('level', '') for c in approval_chain if c.get('level')]
            ApprovalRequest.objects.create(
                title=f"Training Approval: {training.title}",
                type="training-request",
                requested_by=requester_name,
                department=training.department or "",
                description=f"Approval request for training \"{training.title}\" scheduled on {training.start_date}",
                status="pending",
                current_level=levels[0] if levels else "HR",
                approval_levels=levels,
                approval_chain=approval_chain,
                training_id=str(training.id),
                training_title=training.title,
                expected_outcome=training.learning_outcomes or "",
                justification="",
                approval_history=[],
                organization=self.request.user.organization,
            )

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())

    @action(detail=True, methods=['post'], url_path='generate-attendance')
    def generate_attendance(self, request, pk=None):
        """Generate attendance records for a training schedule based on enrolled participants."""
        training = self.get_object()
        org = request.user.organization

        enrollments = Enrollment.objects.filter(
            content_type='training-schedule',
            content_id=str(training.id),
            organization=org,
            status='approved',
        )

        if not enrollments:
            return Response({"detail": "No enrolled participants found for this training."}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        skipped = 0
        for en in enrollments:
            existing = TrainingAttendance.objects.filter(
                training_id=str(training.id),
                user_id=en.participant_id,
                organization=org,
            ).first()
            if existing:
                skipped += 1
                continue
            TrainingAttendance.objects.create(
                training_id=str(training.id),
                training_title=training.title,
                user_id=en.participant_id,
                user_name=f"{en.participant.first_name} {en.participant.last_name}".strip() if en.participant else "",
                status='pending',
                organization=org,
            )
            created += 1

        return Response({
            "message": f"Attendance generated: {created} created, {skipped} already existed.",
            "created_count": created,
            "skipped_count": skipped,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        """Update training schedule status (approve, reject, complete, cancel)."""
        training = self.get_object()
        new_status = request.data.get('status')
        valid_statuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled']
        if new_status not in valid_statuses:
            return Response({"detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}, status=status.HTTP_400_BAD_REQUEST)
        training.status = new_status
        training.save(update_fields=['status', 'updated_on'])

        # Notify enrolled participants of status change
        if new_status in ['approved', 'rejected', 'completed', 'cancelled']:
            enrollments = Enrollment.objects.filter(
                content_type='training-schedule',
                content_id=str(training.id),
                organization=request.user.organization,
                status='approved',
            ).select_related('participant')
            notif_users = [e.participant for e in enrollments if e.participant]
            type_map = {'approved': 'training-created', 'completed': 'training-completed', 'cancelled': 'training-cancelled', 'rejected': 'training-cancelled'}
            dispatch_notification(
                notif_type=type_map.get(new_status, 'training-modified'),
                users=notif_users,
                organization=request.user.organization,
                context={'title': training.title, 'date': str(training.start_date) if hasattr(training, 'start_date') else '', 'venue': getattr(training, 'venue_name', '') or '', 'trainer': getattr(training, 'trainer_name', '') or ''},
                content_type='training-schedule',
                content_id=training.id,
                content_title=training.title,
            )

        return Response(TrainingScheduleSerializer(training).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='auto-checkin')
    def auto_checkin(self, request, pk=None):
        """Auto check-in the current user when they open a training schedule on mobile."""
        training = self.get_object()
        user = request.user
        org = user.organization

        att, created = TrainingAttendance.objects.get_or_create(
            training_id=str(training.id),
            user=user,
            organization=org,
            defaults={
                'training_title': training.title,
                'user_name': f"{user.first_name} {user.last_name}".strip(),
                'status': 'present',
                'check_in_time': timezone.now(),
                'check_in_method': 'auto',
            }
        )

        if not created and not att.check_in_time:
            att.check_in_time = timezone.now()
            att.check_in_method = 'auto'
            att.status = 'present'
            att.save(update_fields=['check_in_time', 'check_in_method', 'status', 'updated_on'])

        return Response({
            'message': 'Checked in' if (created or not att.check_in_time) else 'Already checked in',
            'attendance': TrainingAttendanceSerializer(att).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='complete-training')
    def complete_training(self, request, pk=None):
        """Mark the current user's training as completed (check-out)."""
        training = self.get_object()
        user = request.user
        org = user.organization

        att = TrainingAttendance.objects.filter(
            training_id=str(training.id),
            user=user,
            organization=org,
        ).first()

        if not att:
            # Auto create attendance with check-in and check-out
            att = TrainingAttendance.objects.create(
                training_id=str(training.id),
                training_title=training.title,
                user=user,
                user_name=f"{user.first_name} {user.last_name}".strip(),
                status='present',
                check_in_time=timezone.now(),
                check_in_method='auto',
                check_out_time=timezone.now(),
                check_out_method='auto',
                organization=org,
            )
        else:
            if not att.check_in_time:
                att.check_in_time = timezone.now()
                att.check_in_method = 'auto'
            att.check_out_time = timezone.now()
            att.check_out_method = 'auto'
            att.status = 'present'
            att.save(update_fields=['check_in_time', 'check_in_method', 'check_out_time', 'check_out_method', 'status', 'updated_on'])

        return Response({
            'message': 'Training completed',
            'attendance': TrainingAttendanceSerializer(att).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='attendance-stats')
    def attendance_stats(self, request, pk=None):
        """Get attendance statistics for a training schedule."""
        training = self.get_object()
        org = request.user.organization

        enrolled_count = Enrollment.objects.filter(
            content_type='training-schedule',
            content_id=str(training.id),
            organization=org,
            status='approved',
        ).count()

        attendances = TrainingAttendance.objects.filter(
            training_id=str(training.id),
            organization=org,
        )

        checked_in = attendances.filter(check_in_time__isnull=False).count()
        completed = attendances.filter(check_out_time__isnull=False).count()
        pending = enrolled_count - checked_in

        return Response({
            'enrolled': enrolled_count,
            'checked_in': checked_in,
            'completed': completed,
            'pending': pending,
            'in_progress': checked_in - completed,
        }, status=status.HTTP_200_OK)


class TrainerViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TrainerSerializer

    def get_queryset(self):
        return Trainer.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())


class VenueViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = VenueSerializer

    def get_queryset(self):
        return Venue.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())


class EnrollmentViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        return Enrollment.objects.filter(organization=self.request.user.organization).select_related('participant')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())

    def create(self, request, *args, **kwargs):
        """
        Bulk enrollment: accepts participant_ids (list) for multiple participants.
        Auto-approves enrollments and auto-assigns content to participants.
        """
        try:
            data = request.data
            participant_ids = data.get('participant_ids', [])
            single_participant = data.get('participant')

            # Support both single participant and bulk
            if not participant_ids and single_participant:
                participant_ids = [single_participant]

            if not participant_ids:
                return Response({"detail": "At least one participant is required."}, status=status.HTTP_400_BAD_REQUEST)

            content_type = data.get('content_type', '')
            content_id = data.get('content_id', '')
            content_title = data.get('content_title', '')
            enrollment_title = data.get('enrollment_title', '')
            enrollment_type = data.get('enrollment_type', 'self')
            nominator = data.get('nominator', '')
            justification = data.get('justification', '')
            auto_approve = data.get('auto_approve', True)
            notification_lead_value = int(data.get('notification_lead_value', 0))
            notification_lead_unit = data.get('notification_lead_unit', 'days')

            # Convert participant_ids to ints
            try:
                participant_ids = [int(pid) for pid in participant_ids]
            except (ValueError, TypeError):
                pass

            # Resolve groups/locations to actual user IDs
            participant_mode = data.get('participant_mode', 'users')
            if participant_mode == 'groups':
                from user.models import Groups
                group_users = CustomUser.objects.filter(
                    user_groups__id__in=participant_ids,
                    organization=request.user.organization,
                    is_active=True,
                    is_deleted=False,
                    is_archived=False,
                ).values_list('id', flat=True)
                participant_ids = list(group_users)
            elif participant_mode == 'locations':
                loc_users = CustomUser.objects.filter(
                    location_id__in=participant_ids,
                    organization=request.user.organization,
                    is_active=True,
                    is_deleted=False,
                    is_archived=False,
                ).values_list('id', flat=True)
                participant_ids = list(loc_users)

            org = request.user.organization
            created_enrollments = []
            duplicates = []

            for pid in participant_ids:
                # Check for duplicate — only block if same content + participant + enrollment_title
                dup_qs = Enrollment.objects.filter(
                    content_id=str(content_id),
                    participant_id=pid,
                    organization=org,
                ).exclude(status='rejected')
                if enrollment_title:
                    dup_qs = dup_qs.filter(enrollment_title__iexact=enrollment_title)
                existing = dup_qs.first()
                if existing:
                    user = CustomUser.objects.filter(id=pid).first()
                    duplicates.append(f"{user.first_name} {user.last_name}".strip() if user else f"User {pid}")
                    continue

                enrollment = Enrollment.objects.create(
                    content_type=content_type,
                    content_id=str(content_id),
                    content_title=content_title,
                    enrollment_title=enrollment_title,
                    participant_id=pid,
                    enrollment_type=enrollment_type,
                    nominator=nominator,
                    justification=justification,
                    status='approved' if auto_approve else 'pending',
                    approved_at=timezone.now() if auto_approve else None,
                    notification_lead_value=notification_lead_value,
                    notification_lead_unit=notification_lead_unit,
                    organization=org,
                )
                created_enrollments.append(enrollment)

            # Auto-assign content to participants
            if created_enrollments:
                self._auto_assign_content(content_type, content_id, participant_ids, org)

                # Send notifications to enrolled participants
                enrolled_users = list(CustomUser.objects.filter(id__in=participant_ids, organization=org))
                notif_type = 'enrollment-approved' if auto_approve else 'enrollment-request'
                dispatch_notification(
                    notif_type=notif_type,
                    users=enrolled_users,
                    organization=org,
                    context={'title': content_title, 'user': ''},
                    content_type=content_type,
                    content_id=content_id,
                    content_title=content_title,
                )

            # If auto_approve is False, create an approval request for each pending enrollment
            if not auto_approve and created_enrollments:
                from learning.models import ApprovalRequest
                requester = request.user
                requester_name = f"{requester.first_name} {requester.last_name}".strip() or requester.username
                default_chain = [
                    {"level": "HR", "approver_id": "", "approver_name": ""},
                    {"level": "Management", "approver_id": "", "approver_name": ""},
                ]
                default_levels = ["HR", "Management"]
                for en in created_enrollments:
                    ApprovalRequest.objects.create(
                        title=enrollment_title or content_title or f"Enrollment: {en.participant}",
                        type="participant-request",
                        requested_by=requester_name,
                        description=f"Enrollment approval for {en.participant.first_name} {en.participant.last_name}".strip(),
                        status="pending",
                        current_level="HR",
                        approval_levels=default_levels,
                        approval_chain=default_chain,
                        training_id=str(en.id),
                        training_title=content_title or "",
                        justification=justification or "",
                        approval_history=[],
                        organization=org,
                    )

            serializer = EnrollmentSerializer(created_enrollments, many=True)
            result = {
                "enrollments": serializer.data,
                "created_count": len(created_enrollments),
            }
            if duplicates:
                result["duplicates"] = duplicates
                result["message"] = f"{len(created_enrollments)} enrolled. Duplicates skipped: {', '.join(duplicates)}"
            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            traceback.print_exc()
            import logging
            logging.error(f"[Enrollment Create ERROR] {str(e)}\n{traceback.format_exc()}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _auto_assign_content(self, content_type, content_id, participant_ids, org):
        """Add participant IDs to the content's selected_users list."""
        try:
            cid = int(content_id)
        except (ValueError, TypeError):
            cid = content_id

        if content_type == 'quiz':
            try:
                quiz = Quiz.objects.get(id=cid, organization=org)
                existing = quiz.selected_users or []
                existing_strs = [str(u) for u in existing]
                new_users = existing + [pid for pid in participant_ids if str(pid) not in existing_strs]
                quiz.selected_users = new_users
                quiz.save(update_fields=['selected_users'])
            except Quiz.DoesNotExist:
                pass
        elif content_type == 'video':
            try:
                video = VideoContent.objects.get(id=cid, organization=org)
                existing = video.selected_users or []
                existing_strs = [str(u) for u in existing]
                new_users = existing + [pid for pid in participant_ids if str(pid) not in existing_strs]
                video.selected_users = new_users
                video.save(update_fields=['selected_users'])
            except VideoContent.DoesNotExist:
                pass
        elif content_type == 'training':
            try:
                training = TrainingItem.objects.get(id=cid, organization=org)
                existing = training.selected_users or []
                existing_strs = [str(u) for u in existing]
                new_users = existing + [pid for pid in participant_ids if str(pid) not in existing_strs]
                training.selected_users = new_users
                training.save(update_fields=['selected_users'])
            except TrainingItem.DoesNotExist:
                pass
        elif content_type == 'training-schedule':
            pass

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        enrollment = self.get_object()
        enrollment.status = 'approved'
        enrollment.approved_at = timezone.now()
        enrollment.save(update_fields=['status', 'approved_at', 'updated_on'])
        # Auto-assign content
        self._auto_assign_content(enrollment.content_type, enrollment.content_id, [enrollment.participant_id], enrollment.organization)
        return Response({"message": "Enrollment approved"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        enrollment = self.get_object()
        enrollment.status = 'rejected'
        enrollment.rejected_at = timezone.now()
        enrollment.save(update_fields=['status', 'rejected_at', 'updated_on'])
        return Response({"message": "Enrollment rejected"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'])
    def delete_enrollment(self, request, pk=None):
        enrollment = self.get_object()
        enrollment.delete()
        return Response({"message": "Enrollment deleted"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='by-content')
    def by_content(self, request):
        """Returns enrollments grouped by content."""
        org = request.user.organization
        enrollments = Enrollment.objects.filter(organization=org).select_related('participant')
        
        # Get all content
        quizzes = Quiz.objects.filter(organization=org).values('id', 'title')
        videos = VideoContent.objects.filter(organization=org).values('id', 'title')
        trainings = TrainingItem.objects.filter(organization=org).values('id', 'title')
        training_schedules = TrainingSchedule.objects.filter(organization=org).values('id', 'title', 'status')

        content_map = {}
        for q in quizzes:
            key = f"quiz-{q['id']}"
            content_map[key] = {'id': q['id'], 'title': q['title'], 'content_type': 'quiz', 'library_name': 'Quiz Library', 'enrollments': []}
        for v in videos:
            key = f"video-{v['id']}"
            content_map[key] = {'id': v['id'], 'title': v['title'], 'content_type': 'video', 'library_name': 'Video Library', 'enrollments': []}
        for t in trainings:
            key = f"training-{t['id']}"
            content_map[key] = {'id': t['id'], 'title': t['title'], 'content_type': 'training', 'library_name': 'Training Library', 'enrollments': []}
        for ts in training_schedules:
            key = f"training-schedule-{ts['id']}"
            content_map[key] = {'id': ts['id'], 'title': ts['title'], 'content_type': 'training-schedule', 'library_name': 'Training Calendar', 'status': ts['status'], 'enrollments': []}

        for en in enrollments:
            key = f"{en.content_type}-{en.content_id}"
            if key in content_map:
                content_map[key]['enrollments'].append(EnrollmentSerializer(en).data)
            else:
                content_map[key] = {
                    'id': en.content_id, 'title': en.content_title or 'Unknown',
                    'content_type': en.content_type, 'library_name': 'Unknown',
                    'enrollments': [EnrollmentSerializer(en).data]
                }

        return Response(list(content_map.values()), status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='by-participant')
    def by_participant(self, request):
        """Returns enrollments grouped by participant."""
        org = request.user.organization
        enrollments = Enrollment.objects.filter(organization=org).select_related('participant')
        
        participant_map = {}
        for en in enrollments:
            uid = en.participant_id
            if uid not in participant_map:
                participant_map[uid] = {
                    'id': uid,
                    'name': f"{en.participant.first_name} {en.participant.last_name}".strip() if en.participant else 'Unknown',
                    'email': en.participant.email if en.participant else '',
                    'enrollments': []
                }
            participant_map[uid]['enrollments'].append(EnrollmentSerializer(en).data)

        return Response(list(participant_map.values()), status=status.HTTP_200_OK)


class ApprovalRequestViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ApprovalRequestSerializer

    def get_queryset(self):
        return ApprovalRequest.objects.filter(organization=self.request.user.organization)

    def list(self, request, *args, **kwargs):
        """Override list to add can_approve and pending_with_department per item."""
        queryset = self.get_queryset()
        user = request.user
        data = []
        for approval in queryset:
            serialized = ApprovalRequestSerializer(approval).data
            serialized['can_approve'] = self._can_user_approve(approval, user)
            chain = approval.approval_chain or []
            if chain:
                current_level = (approval.current_level or chain[0]['level'])
            else:
                current_level = (approval.current_level or 'HR')
            # Find users whose department name matches current level
            from user.models import Departments
            pending_users = []
            deps = Departments.objects.filter(name__iexact=current_level)
            if deps.exists():
                pending_users = [
                    f"{u.first_name} {u.last_name}".strip() or u.username
                    for u in CustomUser.objects.filter(
                        organization=user.organization,
                        department__in=deps,
                        is_active=True,
                        is_deleted=False,
                        is_archived=False,
                    )
                ]
            serialized['pending_with_department'] = current_level
            serialized['pending_with_users'] = pending_users
            data.append(serialized)
        return Response(data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())

    def create(self, request, *args, **kwargs):
        """
        Create approval request with approval chain.
        Expected body: title, type, requested_by (user id), department, description,
                       approval_chain: [{level, approver_id, approver_name}],
                       training_id, training_title, expected_outcome, amount, justification
        """
        data = request.data
        approval_chain = data.get('approval_chain', [])
        if not approval_chain:
            return Response({"detail": "Please add at least one approval level."}, status=status.HTTP_400_BAD_REQUEST)

        approval_levels = [c['level'] for c in approval_chain]
        current_level = approval_levels[0] if approval_levels else 'manager'

        approval = ApprovalRequest.objects.create(
            title=data.get('title', ''),
            type=data.get('type', 'training-request'),
            requested_by=str(data.get('requested_by', '')),
            department=data.get('department', ''),
            description=data.get('description', ''),
            status='pending',
            current_level=current_level,
            approval_levels=approval_levels,
            approval_chain=approval_chain,
            training_id=data.get('training_id'),
            training_title=data.get('training_title', ''),
            expected_outcome=data.get('expected_outcome', ''),
            amount=data.get('amount', 0),
            justification=data.get('justification', ''),
            approval_history=[],
            organization=request.user.organization,
        )
        return Response(ApprovalRequestSerializer(approval).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        approval = self.get_object()
        user = request.user
        user_name = f"{user.first_name} {user.last_name}".strip() or user.username

        # Check if user can approve
        if not self._can_user_approve(approval, user):
            return Response({"detail": f"You are not the designated approver for {approval.current_level} level."}, status=status.HTTP_403_FORBIDDEN)

        chain = approval.approval_chain or []
        levels = [c['level'] for c in chain] if chain else (approval.approval_levels or ['HR', 'Management'])
        current_lower = (approval.current_level or '').lower()
        current_idx = next((i for i, l in enumerate(levels) if l.lower() == current_lower), 0)

        history = approval.approval_history or []
        history.append({
            'level': approval.current_level,
            'action': 'approved',
            'by': user_name,
            'by_id': user.id,
            'at': timezone.now().isoformat(),
        })

        if current_idx + 1 < len(levels):
            # Move to next level
            approval.current_level = levels[current_idx + 1]
            approval.approval_history = history
            approval.save(update_fields=['current_level', 'approval_history', 'updated_on'])
        else:
            # Final approval
            approval.status = 'approved'
            approval.approved_by = user_name
            approval.approved_at = timezone.now()
            approval.approval_history = history
            approval.save(update_fields=['status', 'approved_by', 'approved_at', 'approval_history', 'updated_on'])
            # Update training status if linked
            if approval.training_id:
                self._update_training_status(approval, 'approved')

            # Notify the requester
            requester_id = approval.requested_by
            requester = None
            try:
                requester = CustomUser.objects.get(id=int(requester_id))
            except (ValueError, TypeError, CustomUser.DoesNotExist):
                pass
            if requester:
                dispatch_notification(
                    notif_type='approval-approved',
                    users=[requester],
                    organization=approval.organization,
                    context={'title': approval.title, 'user': requester_name},
                    content_type='approval',
                    content_id=approval.id,
                    content_title=approval.title,
                )

        return Response(ApprovalRequestSerializer(approval).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        approval = self.get_object()
        user = request.user
        user_name = f"{user.first_name} {user.last_name}".strip() or user.username

        history = approval.approval_history or []
        history.append({
            'level': approval.current_level,
            'action': 'rejected',
            'by': user_name,
            'by_id': user.id,
            'at': timezone.now().isoformat(),
        })

        approval.status = 'rejected'
        approval.rejected_by = user_name
        approval.rejected_at = timezone.now()
        approval.approval_history = history
        approval.save(update_fields=['status', 'rejected_by', 'rejected_at', 'approval_history', 'updated_on'])

        # Update training status if linked
        if approval.training_id:
            self._update_training_status(approval, 'cancelled')

        # Notify the requester
        requester_id = approval.requested_by
        requester = None
        try:
            requester = CustomUser.objects.get(id=int(requester_id))
        except (ValueError, TypeError, CustomUser.DoesNotExist):
            pass
        if requester:
            dispatch_notification(
                notif_type='approval-rejected',
                users=[requester],
                organization=approval.organization,
                context={'title': approval.title, 'user': requester_name},
                content_type='approval',
                content_id=approval.id,
                content_title=approval.title,
            )

        return Response(ApprovalRequestSerializer(approval).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='edit')
    def edit_approval(self, request, pk=None):
        """Edit approval request (super admin only)."""
        approval = self.get_object()
        data = request.data

        approved_levels = [h['level'] for h in (approval.approval_history or []) if h.get('action') == 'approved']

        # Update fields
        if 'title' in data:
            approval.title = data['title']
        if 'type' in data:
            approval.type = data['type']
        if 'requested_by' in data:
            approval.requested_by = str(data['requested_by'])
        if 'department' in data:
            approval.department = data['department']
        if 'description' in data:
            approval.description = data['description']
        if 'approval_levels' in data:
            # Don't modify already approved levels
            new_levels = data['approval_levels']
            approval.approval_levels = new_levels
        if 'current_level' in data:
            approval.current_level = data['current_level']
        if 'status' in data:
            approval.status = data['status']

        approval.updated_on = timezone.now()
        approval.save()
        return Response(ApprovalRequestSerializer(approval).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-pending')
    def my_pending(self, request):
        """Approvals pending for current user based on approval chain / designation."""
        user = request.user
        approvals = ApprovalRequest.objects.filter(organization=user.organization, status='pending')
        filtered = [a for a in approvals if self._can_user_approve(a, user)]
        return Response(ApprovalRequestSerializer(filtered, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-approved')
    def my_approved(self, request):
        """Approvals that current user has already approved."""
        user = request.user
        user_name = f"{user.first_name} {user.last_name}".strip() or user.username
        approvals = ApprovalRequest.objects.filter(organization=user.organization)
        filtered = []
        for a in approvals:
            history = a.approval_history or []
            if any(h.get('by_id') == user.id or h.get('by') == user_name for h in history):
                filtered.append(a)
        return Response(ApprovalRequestSerializer(filtered, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='designations')
    def designations(self, request):
        """Return all departments for the organization (including global ones)."""
        from user.models import Departments
        from django.db.models import Q
        deps = Departments.objects.filter(
            Q(organization=request.user.organization) | Q(organization__isnull=True)
        )
        data = [{'id': d.id, 'name': d.name} for d in deps]
        if not data:
            data = [
                {'id': 0, 'name': 'HR'},
                {'id': 0, 'name': 'Management'},
                {'id': 0, 'name': 'Quality'},
            ]
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='users-by-designation')
    def users_by_designation(self, request):
        """Return users filtered by department name."""
        department = request.query_params.get('designation', '')
        if not department:
            return Response([], status=status.HTTP_200_OK)
        
        from user.models import Departments
        deps = Departments.objects.filter(name__iexact=department)
        if deps.exists():
            users = CustomUser.objects.filter(
                organization=request.user.organization,
                department__in=deps,
                is_active=True,
                is_deleted=False,
                is_archived=False,
            )
        else:
            users = CustomUser.objects.none()

        data = [{'id': u.id, 'name': f"{u.first_name} {u.last_name}".strip() or u.username, 'email': u.email} for u in users]
        return Response(data, status=status.HTTP_200_OK)

    def _can_user_approve(self, approval, user):
        """Check if user can approve at current level — dynamic by department."""
        if user.role and user.role.name == 'super_admin':
            return True

        chain = approval.approval_chain or []
        if chain:
            current_level = (approval.current_level or chain[0]['level'])
        else:
            current_level = (approval.current_level or 'HR')

        user_dept = user.department.name if user.department else ''
        print(f"[DEBUG _can_user_approve] user={user.username}, user_department='{user_dept}', current_level='{current_level}', match={user_dept.lower() == current_level.lower()}")
        if user_dept and user_dept.lower() == current_level.lower():
            return True

        return False

    def _update_training_status(self, approval, status_val):
        """Update linked training schedule status and notify enrolled participants."""
        try:
            training = TrainingSchedule.objects.get(id=approval.training_id)
            training.status = status_val
            training.save(update_fields=['status', 'updated_on'])

            # Notify enrolled participants about status change
            if status_val in ('approved', 'completed', 'cancelled'):
                enrollments = Enrollment.objects.filter(
                    content_type='training-schedule',
                    content_id=str(training.id),
                    organization=training.organization,
                    status='approved',
                ).select_related('participant')
                users = [e.participant for e in enrollments if e.participant]
                if users:
                    notif_map = {
                        'approved': 'training-created',
                        'completed': 'training-completed',
                        'cancelled': 'training-cancelled',
                    }
                    dispatch_notification(
                        notif_type=notif_map.get(status_val, 'training-created'),
                        users=users,
                        organization=training.organization,
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
        except TrainingSchedule.DoesNotExist:
            pass


class NotificationTemplateViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationTemplateSerializer

    def get_queryset(self):
        return NotificationTemplate.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())


class TrainingAttendanceViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TrainingAttendanceSerializer

    def get_queryset(self):
        return TrainingAttendance.objects.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def perform_update(self, serializer):
        serializer.save(updated_on=timezone.now())

    @action(detail=True, methods=['patch'])
    def check_in(self, request, pk=None):
        att = self.get_object()
        att.check_in_time = timezone.now()
        att.check_in_method = 'manual'
        att.status = 'present'
        att.save(update_fields=['check_in_time', 'check_in_method', 'status', 'updated_on'])
        return Response({"message": "Checked in"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def check_out(self, request, pk=None):
        att = self.get_object()
        att.check_out_time = timezone.now()
        att.check_out_method = 'manual'
        att.save(update_fields=['check_out_time', 'check_out_method', 'updated_on'])
        return Response({"message": "Checked out"}, status=status.HTTP_200_OK)


class LTDraftViewSet(userContextAPIView, ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LTDraftSerializer

    def get_queryset(self):
        return LTDraft.objects.filter(organization=self.request.user.organization, user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, user=self.request.user)


class LTAnalyticsView(userContextAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization
        total_trainings = TrainingSchedule.objects.filter(organization=org).count()
        total_trainers = Trainer.objects.filter(organization=org).count()
        total_venues = Venue.objects.filter(organization=org).count()
        total_quizzes = Quiz.objects.filter(organization=org, is_draft=False).count()
        total_videos = VideoContent.objects.filter(organization=org, is_draft=False).count()
        total_enrollments = Enrollment.objects.filter(organization=org).count()
        total_attendances = TrainingAttendance.objects.filter(organization=org).count()
        present_count = TrainingAttendance.objects.filter(organization=org, status='present').count()
        attendance_rate = round((present_count / total_attendances * 100), 1) if total_attendances > 0 else 0

        recent_trainings = TrainingSchedule.objects.filter(organization=org).order_by('-created_on')[:10]
        recent_trainings_data = TrainingScheduleSerializer(recent_trainings, many=True).data

        return Response({
            "total_trainings": total_trainings,
            "total_trainers": total_trainers,
            "total_venues": total_venues,
            "total_quizzes": total_quizzes,
            "total_videos": total_videos,
            "total_enrollments": total_enrollments,
            "total_attendances": total_attendances,
            "attendance_rate": attendance_rate,
            "recent_trainings": recent_trainings_data,
        }, status=status.HTTP_200_OK)


class MyNotificationsViewSet(userContextAPIView, ModelViewSet):
    """Endpoints for the mobile app to fetch and manage L&T notifications."""
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationLogSerializer

    def get_queryset(self):
        return NotificationLog.objects.filter(
            user=self.request.user,
            organization=self.request.user.organization,
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        unread_count = queryset.filter(is_read=False).count()
        items = queryset[:50]
        data = NotificationLogSerializer(items, many=True).data
        return Response({
            "notifications": data,
            "unread_count": unread_count,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'status': 'read'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch'], url_path='mark-all-read')
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'all_read'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='admin-all')
    def admin_all(self, request):
        """Admin endpoint: list all notification logs in the organization with filters."""
        queryset = NotificationLog.objects.filter(
            organization=request.user.organization,
        ).select_related('user').order_by('-created_at')

        # Filters
        notif_type = request.query_params.get('notif_type')
        if notif_type:
            queryset = queryset.filter(notif_type=notif_type)

        is_read = request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')

        user_id = request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Pagination — simple limit
        limit = int(request.query_params.get('limit', 100))
        items = queryset[:limit]
        data = []
        for item in items:
            d = NotificationLogSerializer(item).data
            d['user_name'] = f"{item.user.first_name} {item.user.last_name}".strip() if item.user else ""
            d['user_username'] = item.user.username if item.user else ""
            d['user_email'] = item.user.email if item.user else ""
            data.append(d)

        total = queryset.count()
        unread = queryset.filter(is_read=False).count()

        return Response({
            "notifications": data,
            "total": total,
            "unread": unread,
        }, status=status.HTTP_200_OK)