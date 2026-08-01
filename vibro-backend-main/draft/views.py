# views.py
import json
import io
from datetime import datetime
import logging
import time
import random
from urllib.parse import urlparse, unquote
from django.db import connection, IntegrityError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Draft
from form.models import AuditGroup
from .serializers import DraftSerializer, DraftListSerializer
from vibro.utils import UtilsFunctions
from django.conf import settings



class DraftViewSet(viewsets.ModelViewSet):
    serializer_class = DraftSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Draft.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return DraftListSerializer
        return DraftSerializer

    def _generate_unique_draft_id(self, attempts=5):
        """Generate a numeric draft_id unlikely to collide; retry on collision."""
        for _ in range(attempts):
            cand = int(time.time() * 1000) * 1000 + random.randint(0, 999)
            if not Draft.objects.filter(draft_id=cand).exists():
                return cand
            time.sleep(0.01)
        raise RuntimeError("Could not generate unique draft_id")

    def _clean_audit_group_id(self, raw_value, logger):
        """
        Validate audit_group id against whichever table is present.
        Returns a safe id or None to avoid FK violations on environments
        where audit_group points to different models across schemas.
        """
        try:
            audit_group_id = int(raw_value)
        except (TypeError, ValueError):
            return None

        try:
            target_model = Draft._meta.get_field('audit_group').remote_field.model
        except Exception:
            target_model = None

        # First, prefer the configured FK target (AuditInfo in latest code)
        if target_model:
            try:
                if target_model.objects.filter(pk=audit_group_id).exists():
                    return audit_group_id
            except Exception:
                pass

        # Fallback for environments where the FK still points to AuditGroup
        try:
            if AuditGroup.objects.filter(pk=audit_group_id).exists():
                return audit_group_id
        except Exception:
            pass

        logger.warning("Dropping invalid audit_group_id=%s to avoid FK error", audit_group_id)
        return None

    def _presign_media_urls(self, payload, logger=None):
        """
        Walk payload and regenerate presigned GET URLs for any object that lives
        in our known buckets. This keeps images/videos/files visible after resume
        even if original signed URLs expired.
        """
        if payload is None:
            return payload

        replaced = 0

        def presign(url: str):
            try:
                parsed = urlparse(url)
                # For local storage, convert S3 URLs to local URLs
                if parsed.netloc.endswith('.amazonaws.com') or parsed.netloc in [getattr(settings, "S3_BUCKET_NAME", None), getattr(settings, "S3_BUCKET_NAME_ANNOUNCEMENT", None), getattr(settings, "S3_DRAFT_FORMS_BUCKET", None)]:
                    # Extract the key from S3 URL and convert to local URL
                    key = unquote(parsed.path.lstrip('/'))
                    nonlocal replaced
                    replaced += 1
                    # Return local file URL instead of presigned S3 URL
                    return f"{settings.BACKEND_BASE_URL.rstrip('/')}/media/{key}"
                return url
            except Exception:
                return url

        def walk(obj):
            if isinstance(obj, dict):
                return {k: walk(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [walk(i) for i in obj]
            if isinstance(obj, str):
                if '.amazonaws.com/' in obj:
                    return presign(obj)
            return obj

        out = walk(payload)
        if logger:
            logger.info("Presign media URLs: replaced=%s", replaced)
        return out

    # List all drafts for logged-in user: GET /api/drafts/
    # Already handled by default list action

    # Save/Update Draft: POST /api/drafts/save/
    @action(detail=False, methods=['post'], url_path='save')
    def save_draft(self, request):
        logger = logging.getLogger(__name__)
        logger.info("SAVE_DRAFT request JSON: %s", request.data)

        form_id = request.data.get('form_id')
        # defensive parsing: accept numeric or strings like 'db_draft_<n>'
        raw_draft = request.data.get('draft_id')
        draft_id_req = None
        if raw_draft is not None:
            cand = raw_draft
            if isinstance(raw_draft, str) and raw_draft.startswith('db_draft_'):
                parts = raw_draft.split('_')
                cand = parts[-1] if parts else raw_draft
            try:
                draft_id_req = int(cand)
            except (TypeError, ValueError):
                draft_id_req = None
        logger.info("Parsed draft_id to persist: %s (raw: %s)", draft_id_req, raw_draft)
        json_s3_url = request.data.get('json_s3_url')
        metadata = request.data.get('metadata')  # Accept metadata for local storage (matches mobile app)

        if not form_id or (not json_s3_url and not metadata):
            return Response({"error": "form_id and either json_s3_url or metadata are required"}, status=status.HTTP_400_BAD_REQUEST)

        utils = UtilsFunctions()
        import os

        # For local development, use metadata directly instead of S3
        if metadata:
            # Save metadata locally
            local_dir = os.path.join(settings.BASE_DIR, "media", "drafts", str(request.user.id))
            os.makedirs(local_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%d%m%y_%H%M%S")
            filename = f"draft_{request.user.id}_{form_id}_{timestamp}.json"
            local_file_path = os.path.join(local_dir, filename)
            
            with open(local_file_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            s3_key = f"drafts/{request.user.id}/{filename}"
            json_s3_url = f"{settings.BACKEND_BASE_URL.rstrip('/')}/media/{s3_key}"
            s3_key = s3_key
            final_form_data = metadata
        else:
            # Fetch the form data from S3 (original logic)
            form_data_result = utils.get_s3_form_payload_with_url(json_s3_url)
            if not form_data_result:
                return Response({"error": "Failed to retrieve data from S3"}, status=status.HTTP_400_BAD_REQUEST)

            # Extract s3_key from URL
            from urllib.parse import urlparse
            parsed = urlparse(json_s3_url)
            s3_key = parsed.path.lstrip('/')
            final_form_data = form_data_result

        # --- New Audit Fields ---
        audit_fields = {
            'form_overall_status': request.data.get('form_overall_status'),
            'form_overall_score': request.data.get('form_overall_score'),
            'form_critical_failed': request.data.get('form_critical_failed'),
            'groups_status': request.data.get('groups_status'),
            'group_score': request.data.get('group_score'),
            'group_percentage': request.data.get('group_percentage'),
            'group_critical_failed': request.data.get('group_critical_failed'),
            'audit_group_id': self._clean_audit_group_id(request.data.get('audit_group'), logger) 
        }

        # Only update an existing draft if client provided a draft_id
        existing_draft = None
        if draft_id_req is not None:
            existing_draft = Draft.objects.filter(draft_id=draft_id_req, user=request.user).first()

        if existing_draft:
            # Update existing: delete old file and update data
            if existing_draft.s3_url and '/media/' in existing_draft.s3_url:
                # Delete local file
                old_file_path = os.path.join(settings.BASE_DIR, "media", existing_draft.s3_key)
                try:
                    if os.path.exists(old_file_path):
                        os.remove(old_file_path)
                except Exception as e:
                    logger.warning("Failed to delete old local file: %s", e)
            elif existing_draft.s3_url:
                # Delete S3 file (original logic)
                utils.delete_file_from_s3(existing_draft.s3_url)
            
            existing_draft.s3_key = s3_key
            existing_draft.s3_url = json_s3_url
            existing_draft.metadata = final_form_data
            # accept client-provided draft_id if given
            if draft_id_req is not None:
                existing_draft.draft_id = draft_id_req
            
            for key, value in audit_fields.items():
                if value is not None:
                    setattr(existing_draft, key, value)

            try:
                existing_draft.save()
            except IntegrityError as e:
                logger.exception("IntegrityError saving existing draft (user=%s, form_id=%s, draft_id=%s): %s", request.user.id, form_id, draft_id_req, e)
                return Response({"error": "Database integrity error saving draft"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            draft = existing_draft
            status_code = status.HTTP_200_OK
        else:
            # Create new draft
            create_kwargs = dict(
                user=request.user,
                form_id=form_id,
                s3_key=s3_key,
                s3_url=json_s3_url,
                metadata=final_form_data,
                **{k: v for k, v in audit_fields.items() if v is not None}
            )
            if draft_id_req is not None:
                create_kwargs['draft_id'] = draft_id_req
            else:
                # generate a numeric draft_id server-side when client didn't provide one
                try:
                    create_kwargs['draft_id'] = self._generate_unique_draft_id()
                except Exception as e:
                    logger.exception("Failed to generate draft_id: %s", e)
                    create_kwargs['draft_id'] = None

            try:
                draft = Draft.objects.create(**create_kwargs)
            except IntegrityError as e:
                logger.exception("IntegrityError creating draft (user=%s, form_id=%s, draft_id=%s): %s", request.user.id, form_id, draft_id_req, e)
                # Try to recover: attempt to find existing by draft_id or user+form and update
                recovery = None
                if draft_id_req is not None:
                    recovery = Draft.objects.filter(draft_id=draft_id_req, user=request.user).first()
                if not recovery:
                    recovery = Draft.objects.filter(user=request.user, form_id=form_id).first()
                if recovery:
                    try:
                        recovery.s3_key = s3_key
                        recovery.s3_url = json_s3_url
                        recovery.metadata = final_form_data
                        if draft_id_req is not None:
                            recovery.draft_id = draft_id_req
                        
                        for key, value in audit_fields.items():
                            if value is not None:
                                setattr(recovery, key, value)

                        recovery.save()
                        draft = recovery
                        status_code = status.HTTP_200_OK
                    except Exception as e2:
                        logger.exception("Recovery update failed: %s", e2)
                        return Response({"error": "Database recovery failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                else:
                    return Response({"error": "Database integrity error creating draft"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            status_code = status.HTTP_201_CREATED

        # Log persisted draft_id and recent SQL for debugging
        logger.info("Persisted draft.draft_id=%s for draft.id=%s", getattr(draft, 'draft_id', None), getattr(draft, 'id', None))
        try:
            for q in connection.queries[-5:]:
                logger.info("SQL: %s", q.get('sql'))
        except Exception:
            pass

        serializer = self.get_serializer(draft)
        return Response(serializer.data, status=status_code)

    # Get Draft by Form ID: GET /api/drafts/<form_id>/
    @action(detail=False, methods=['get'], url_path=r'(?P<form_id>\d+)')
    def get_draft(self, request, form_id):
        try:
            draft = Draft.objects.get(user=request.user, form_id=form_id)
            serializer = self.get_serializer(draft)
            return Response(serializer.data)
        except Draft.DoesNotExist:
            return Response({"error": "Draft not found"}, status=status.HTTP_404_NOT_FOUND)

    # Delete Draft: DELETE /api/drafts/<identifier>/delete/
    # identifier may be a numeric draft_id or a form_id (legacy)
    @action(detail=False, methods=['delete'], url_path=r'(?P<identifier>[^/]+)/delete')
    def delete_draft(self, request, identifier):
        logger = logging.getLogger(__name__)
        logger.info("DELETE_DRAFT request identifier=%s user=%s", identifier, request.user.id)
        utils = UtilsFunctions()
        import os

        # Try to interpret identifier as draft_id (preferred)
        draft = None
        try:
            ident_int = int(identifier)
        except (TypeError, ValueError):
            ident_int = None

        if ident_int is not None:
            draft = Draft.objects.filter(draft_id=ident_int, user=request.user).first()

        # Fallback: treat identifier as form_id and delete the draft for that form
        if not draft:
            try:
                form_id = int(identifier)
                draft = Draft.objects.filter(user=request.user, form_id=form_id).first()
            except (TypeError, ValueError):
                draft = None

        if not draft:
            # Treat missing draft as already-deleted (idempotent delete).
            logger.info("Draft not found for identifier=%s user=%s — treating as deleted", identifier, request.user.id)
            return Response({"detail": "Draft not found; treated as deleted"}, status=status.HTTP_200_OK)

        # Remove local/S3 payload if present and delete
        try:
            if draft.s3_url:
                if '/media/' in draft.s3_url:
                    # Delete local file
                    local_file_path = os.path.join(settings.BASE_DIR, "media", draft.s3_key)
                    try:
                        if os.path.exists(local_file_path):
                            os.remove(local_file_path)
                    except Exception as e:
                        logger.warning("Failed to delete local file: %s", e)
                else:
                    # Delete S3 file (original logic)
                    utils.delete_file_from_s3(draft.s3_url)
            draft_id_out = getattr(draft, 'draft_id', None)
            draft.delete()
            logger.info("Deleted draft id=%s (draft_id=%s) user=%s", getattr(draft, 'id', None), draft_id_out, request.user.id)
            return Response({"detail": "Draft deleted"})
        except Exception as e:
            logger.exception("Error deleting draft identifier=%s user=%s: %s", identifier, request.user.id, e)
            return Response({"error": "Failed to delete draft"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Alternative delete route: /api/drafts/delete/<identifier>/ -> helps when router patterns conflict
    @action(detail=False, methods=['delete'], url_path=r'delete/(?P<identifier>[^/.]+)')
    def delete_draft_alt(self, request, identifier):
        # Reuse logic from delete_draft
        return self.delete_draft(request, identifier)

    def create(self, request, *args, **kwargs):
        utils = UtilsFunctions()
        logger = logging.getLogger(__name__)
        logger.info("CREATE_DRAFT request JSON: %s", request.data)

        # Validate input data
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        logger.info("Validated data: %s", validated_data)
        
        form_id = validated_data['form_id']
        metadata = validated_data.get('metadata', {})
        raw_draft = request.data.get('draft_id')  # Get from original request data, not validated
        logger.info("Raw draft_id from request: %s", raw_draft)
        
        draft_id_req = None
        if raw_draft is not None:
            cand = raw_draft
            if isinstance(raw_draft, str) and raw_draft.startswith('db_draft_'):
                parts = raw_draft.split('_')
                cand = parts[-1] if parts else raw_draft
            try:
                draft_id_req = int(cand)
            except (TypeError, ValueError):
                draft_id_req = None
        logger.info("Parsed draft_id to persist: %s (raw: %s)", draft_id_req, raw_draft)

        # Save metadata locally for development
        import os
        json_data = json.dumps(metadata, indent=2)
        timestamp = datetime.now().strftime("%d%m%y_%H%M%S")
        filename = f"draft_{request.user.id}_{form_id}_{timestamp}.json"
        
        local_dir = os.path.join(settings.BASE_DIR, "media", "drafts", str(request.user.id))
        os.makedirs(local_dir, exist_ok=True)
        local_file_path = os.path.join(local_dir, filename)
        
        with open(local_file_path, 'w') as f:
            f.write(json_data)
        
        s3_key = f"drafts/{request.user.id}/{filename}"
        file_url = f"{settings.BACKEND_BASE_URL.rstrip('/')}/media/{s3_key}"
        s3_key = s3_key
        
        # --- New Audit Fields ---
        audit_fields = {
            'form_overall_status': validated_data.get('form_overall_status'),
            'form_overall_score': validated_data.get('form_overall_score'),
            'form_critical_failed': validated_data.get('form_critical_failed'),
            'groups_status': validated_data.get('groups_status'),
            'group_score': validated_data.get('group_score'),
            'group_percentage': validated_data.get('group_percentage'),
            'group_critical_failed': validated_data.get('group_critical_failed'),
            'audit_group': self._clean_audit_group_id(validated_data.get('audit_group'), logger)
        }

        # Check if draft already exists for this user and form_id
        # Only update an existing draft if client provided a draft_id
        existing_draft = None
        logger.info("Looking for existing draft with draft_id=%s and user=%s", draft_id_req, self.request.user.id)
        if draft_id_req is not None:
            existing_draft = Draft.objects.filter(draft_id=draft_id_req, user=self.request.user).first()
            logger.info("Found existing draft: %s", existing_draft is not None)

        if existing_draft:
            logger.info("Updating existing draft with draft_id=%s", draft_id_req)
            # Update existing draft: delete old file and update fields
            if existing_draft.s3_url and '/media/' in existing_draft.s3_url:
                # Delete local file
                old_file_path = os.path.join(settings.BASE_DIR, "media", existing_draft.s3_key)
                try:
                    if os.path.exists(old_file_path):
                        os.remove(old_file_path)
                except Exception as e:
                    logger.warning("Failed to delete old local file: %s", e)
            elif existing_draft.s3_url:
                # Delete S3 file (original logic)
                utils.delete_file_from_s3(existing_draft.s3_url)
            
            existing_draft.s3_key = s3_key
            existing_draft.s3_url = file_url
            existing_draft.metadata = metadata
            # accept provided draft_id when updating
            if draft_id_req is not None:
                existing_draft.draft_id = draft_id_req
            
            for key, value in audit_fields.items():
                if value is not None:
                    setattr(existing_draft, key, value)

            try:
                existing_draft.save()
                logger.info("Successfully updated draft with draft_id=%s", draft_id_req)
            except IntegrityError as e:
                logger.exception("IntegrityError updating existing draft (user=%s, form_id=%s, draft_id=%s): %s", request.user.id, form_id, draft_id_req, e)
                return Response({"error": "Database integrity error updating draft"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            draft = existing_draft
            status_code = status.HTTP_200_OK
        else:
            logger.info("Creating new draft (no existing draft found with draft_id=%s)", draft_id_req)
            # Create new draft
            create_kwargs = dict(
                user=self.request.user,
                form_id=form_id,
                s3_key=s3_key,
                s3_url=file_url,
                metadata=metadata,
                **{k: v for k, v in audit_fields.items() if v is not None}
            )
            if draft_id_req is not None:
                create_kwargs['draft_id'] = draft_id_req
            else:
                try:
                    create_kwargs['draft_id'] = self._generate_unique_draft_id()
                except Exception as e:
                    logger.exception("Failed to generate draft_id: %s", e)
                    create_kwargs['draft_id'] = None

            try:
                draft = Draft.objects.create(**create_kwargs)
            except IntegrityError as e:
                logger.exception("IntegrityError creating draft (user=%s, form_id=%s, draft_id=%s): %s", request.user.id, form_id, draft_id_req, e)
                # attempt recovery as above
                recovery = None
                if draft_id_req is not None:
                    recovery = Draft.objects.filter(draft_id=draft_id_req, user=self.request.user).first()
                if not recovery:
                    recovery = Draft.objects.filter(user=self.request.user, form_id=form_id).first()
                if recovery:
                    try:
                        recovery.s3_key = s3_key
                        recovery.s3_url = file_url
                        recovery.metadata = metadata
                        if draft_id_req is not None:
                            recovery.draft_id = draft_id_req
                        
                        for key, value in audit_fields.items():
                            if value is not None:
                                setattr(recovery, key, value)

                        recovery.save()
                        draft = recovery
                        status_code = status.HTTP_200_OK
                    except Exception as e2:
                        logger.exception("Recovery update failed: %s", e2)
                        return Response({"error": "Database recovery failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                else:
                    return Response({"error": "Database integrity error creating draft"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            status_code = status.HTTP_201_CREATED

        # Log persisted values and recent SQL for debugging
        logger.info("Persisted draft.draft_id=%s for draft.id=%s", getattr(draft, 'draft_id', None), getattr(draft, 'id', None))
        try:
            for q in connection.queries[-5:]:
                logger.info("SQL: %s", q.get('sql'))
        except Exception:
            pass

        # Return response
        serializer = self.get_serializer(draft)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status_code, headers=headers)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # GET: /drafts/<form_id>/get_payload/
    @action(detail=False, methods=["get"], url_path="get-payload/(?P<form_id>[^/.]+)")
    def get_payload(self, request, form_id):
        utils = UtilsFunctions()
        user = request.user
        logger = logging.getLogger(__name__)
        import os
        # Return all drafts for this user+form_id (new requirement)
        drafts = Draft.objects.filter(user=user, form_id=form_id).order_by('-created_at')
        if not drafts.exists():
            return Response({"error": "No drafts found"}, status=404)

        results = []
        for d in drafts:
            # prefer local file payload if available, otherwise use stored metadata
            form_payload = None
            if d.s3_url and '/media/' in d.s3_url:
                # Read from local file
                local_file_path = os.path.join(settings.BASE_DIR, "media", d.s3_key)
                try:
                    with open(local_file_path, 'r') as f:
                        form_payload = json.load(f)
                except Exception as e:
                    logger.warning("Failed to read local file %s: %s", local_file_path, e)
                    form_payload = None
            elif d.s3_url:
                # Fetch from S3 (original logic)
                form_payload = utils.get_s3_form_payload_with_url(d.s3_url)
                # fallback when S3 object missing/invalid
                if not form_payload or (isinstance(form_payload, dict) and form_payload.get("error")):
                    logger.info("Draft id=%s draft_id=%s: S3 payload missing/invalid, using stored metadata", d.id, d.draft_id)
                    form_payload = None
            
            if form_payload is None:
                form_payload = d.metadata or {}
            form_payload = self._presign_media_urls(form_payload, logger)

            results.append({
                "draft_id": d.draft_id,
                "id": d.id,
                "created_at": d.created_at,
                "timestamp": d.timestamp,
                "s3_url": d.s3_url,
                "form_data": form_payload,
            })

        return Response({"drafts": results})

    # GET: /drafts/<draft_id>/get_payload_by_id/
    @action(detail=False, methods=["get"], url_path="get-payload-by-id/(?P<draft_id>[^/.]+)")
    def get_payload_by_id(self, request, draft_id):
        utils = UtilsFunctions()
        user = request.user
        logger = logging.getLogger(__name__)
        import os

        # Handle fake frontend IDs that start with 'db_draft_'
        if draft_id.startswith('db_draft_'):
            # Extract form_id from the fake ID (format: db_draft_{form_id}_{timestamp}_{random})
            parts = draft_id.split('_')
            if len(parts) >= 3:
                try:
                    form_id = int(parts[2])  # form_id is at index 2
                    draft = Draft.objects.get(form_id=form_id, user=user)
                except (ValueError, IndexError, Draft.DoesNotExist):
                    return Response({"error": "Draft not found"}, status=404)
            else:
                return Response({"error": "Invalid draft ID format"}, status=400)
        else:
            # Try lookup by the new `draft_id` UUID field first
            # Try to interpret draft_id as an integer draft identifier
            try:
                draft_int = int(draft_id)
            except (TypeError, ValueError):
                draft_int = None

            if draft_int is not None:
                try:
                    draft = Draft.objects.get(draft_id=draft_int, user=user)
                except Draft.DoesNotExist:
                    draft = None
            else:
                draft = None

            if draft is None:
                # fallback: maybe an integer primary key was passed as id
                try:
                    draft = Draft.objects.get(id=int(draft_id), user=user)
                except (ValueError, Draft.DoesNotExist):
                    return Response({"error": "Draft not found"}, status=404)

        if not draft.s3_url:
            return Response({"error": "Draft file missing"}, status=400)

        # Read from local file or S3
        if '/media/' in draft.s3_url:
            # Read from local file
            local_file_path = os.path.join(settings.BASE_DIR, "media", draft.s3_key)
            try:
                with open(local_file_path, 'r') as f:
                    payload = json.load(f)
            except Exception as e:
                logger.warning("Failed to read local file %s: %s", local_file_path, e)
                logger.info("Draft id=%s draft_id=%s: Local file missing, using stored metadata", draft.id, draft.draft_id)
                payload = draft.metadata or {}
        else:
            # Fetch from S3 (original logic)
            payload = utils.get_s3_form_payload_with_url(draft.s3_url)
            if not payload or (isinstance(payload, dict) and payload.get("error")):
                logger.info("Draft id=%s draft_id=%s: S3 payload missing/invalid, using stored metadata", draft.id, draft.draft_id)
                payload = draft.metadata or {}
        
        payload = self._presign_media_urls(payload, logger)
        return Response({"form_data": payload})

    # DELETE: override delete → remove local/S3 JSON file also
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        utils = UtilsFunctions()
        import os

        if instance.s3_url:
            if '/media/' in instance.s3_url:
                # Delete local file
                local_file_path = os.path.join(settings.BASE_DIR, "media", instance.s3_key)
                try:
                    if os.path.exists(local_file_path):
                        os.remove(local_file_path)
                except Exception as e:
                    logger.warning("Failed to delete local file: %s", e)
            else:
                # Delete S3 file (original logic)
                utils.delete_file_from_s3(instance.s3_url)

        instance.delete()
        return Response({"detail": "Draft deleted"}, status=204)
