# serializers.py
from rest_framework import serializers
from .models import (
    Form, Stage, Question, Option, Logic, LogicFollowUp, StageAccess, 
    Folder, StageAccessType, QuestionType, FormAssignment, AuditInfo, StageAssignment,
    AuditGroup, FormType, Answer, FormSubmision, StageSubmissionHistory,GroupAssignment,
    AuditFormSubmissionHistory, FollowUpTask, FollowUpTaskResponse, FollowUpTaskStatus, FormResponseShare, FormAutoShareConfig, FormPayloadFiles)
from django.db import transaction
from user.models import CustomUser, Groups, Locations, Divisions, Organization, SubDivisions, LocationLeader
from django.core.exceptions import ObjectDoesNotExist
import uuid
from vibro.utils import UtilsFunctions
from rest_framework.exceptions import ValidationError

from django.shortcuts import get_object_or_404
from django.db.models import Max, Q
import logging

logger = logging.getLogger(__name__)


class FolderSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    folder_name = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = ['id', 'name', 'description', 'parent', 'created_at', 'updated_at', 'created_by','folder_name']
        extra_kwargs = {
            'organization': {'read_only': True},
            'parent': {'required': False, 'allow_null': True}
        }

    def get_created_by(self, obj):
        if obj.created_by:
            first = obj.created_by.first_name or ""
            last = obj.created_by.last_name or ""
            return f"{first.strip()} {last.strip()}".strip() or obj.created_by.username or obj.created_by.email
        return "Unknown"
    
    def get_folder_name(self, obj):
        if obj.parent:
            return obj.parent.name
        return None




class OptionSerializer(serializers.ModelSerializer):
    option = serializers.CharField(allow_blank=True, required=False, max_length=255)

    class Meta:
        model = Option
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'form': {'read_only': True},
            'stage': {'read_only': True},
            'question': {'read_only': True},
            'organization': {'read_only': True}
        }
        
    def validate(self, attrs):
        if self.context.get('skip_unique_checks'):
            return attrs
        stage = self.context.get("stage")
        form = self.context.get("form")
        question = self.context.get("question")
        option = self.context.get("option")
        
        if Option.objects.filter( form=form, stage=stage, question=question, option=option).exists():
            raise serializers.ValidationError({ 'Options': "Option Already exists." })
        
        return attrs
    
    def create(self, validated_data):
        form = self.context.get("form")
        stage = self.context.get("stage", None)
        audit_info = self.context.get("audit_info", None)
        audit_group = self.context.get("audit_group", None)
        question = self.context.get("question")
        organization = self.context.get("organization")

        # Exclude fields that are set in context to avoid duplicate keyword arguments
        safe_validated_data = {k: v for k, v in validated_data.items() if k not in ['form', 'stage', 'question', 'audit_info', 'audit_group', 'organization']}

        option = Option.objects.create(
            form=form,
            stage=stage,
            question=question,
            audit_info=audit_info,
            audit_group=audit_group,
            organization=organization,
            **safe_validated_data
        )
        return option
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class LogicFollowUpQuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False)

    class Meta:
        model = Question
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'organization': {'read_only': True},
            'form': {'read_only': True},
            'stage': {'read_only': True},
            'logic': {'read_only': True}
        }
        
    def create(self, validated_data):
        options = validated_data.pop('options', [])
        context = self.context
        
        form = context.get('form')
        stage = context.get('stage', None)
        audit_info = context.get('audit_info', None)
        audit_group = context.get('audit_group', None)
        organization = context.get('organization')
        is_logic_question=context.get("is_logic_question", False)
        is_task_close_question=context.get("is_task_close_question", False)

        # Exclude context fields to avoid duplicate keyword arguments
        safe_validated_data = {k: v for k, v in validated_data.items() if k not in ['form', 'stage', 'audit_info', 'audit_group', 'organization', 'is_logic_question', 'is_task_close_question']}

        question = Question.objects.create(
            form=form,
            stage=stage,
            audit_info=audit_info,
            audit_group=audit_group,
            organization=organization,
            is_logic_question=is_logic_question,
            is_task_close_question=is_task_close_question,
            **safe_validated_data
        )

        if options:
            option_objs = []
            for opt in options:
                option_value = opt.get('option') or opt.get('label') or opt.get('value') or opt.get('name')
                if option_value in (None, ""):
                    continue
                option_objs.append(Option(
                    option=str(option_value),
                    score=opt.get('score', 0),
                    failed=opt.get('failed', False),
                    order=opt.get('order', 1),
                    question=question,
                    stage=stage,
                    audit_info=audit_info,
                    audit_group=audit_group,
                    form=form,
                    organization=organization,
                ))
            if option_objs:
                Option.objects.bulk_create(option_objs, ignore_conflicts=True)

        return question

    def update(self, instance, validated_data):
        # Only update options when they are explicitly provided by the client.
        # Otherwise, keep existing options intact.
        options = None
        if 'options' in validated_data:
            options = validated_data.pop('options')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if options is not None:
            instance.options.all().delete()
            for option_data in options:
                option_value = option_data.get('option') or option_data.get('label') or option_data.get('value') or option_data.get('name')
                if option_value in (None, ""):
                    continue
                normalized_data = {**option_data, 'option': str(option_value)}
                option_serializer = OptionSerializer(
                    data=normalized_data,
                    context={**self.context, 'question': instance}
                )
                option_serializer.is_valid(raise_exception=True)
                option_serializer.save()
        return instance


class LogicFollowUpSerializer(serializers.ModelSerializer):
    task_close_questions = LogicFollowUpQuestionSerializer(many=True, required=False)
    assignUsers = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    assignGroups = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    assign_form = serializers.PrimaryKeyRelatedField(queryset=Form.objects.all(), required=False, allow_null=True)
    assigned_form_title = serializers.SerializerMethodField()
    followup_toggle = serializers.BooleanField(required=False, default=False)
    logicId = serializers.IntegerField(source='logic_id', read_only=True)
    id = serializers.IntegerField(read_only=True)
    assigned_users = serializers.SerializerMethodField()
    assigned_groups = serializers.SerializerMethodField()
    assigned_leaders = serializers.SerializerMethodField()

    def to_representation(self, instance):
        """Filter response based on configuration - allow both assign_form and task_close_questions"""
        rep = super().to_representation(instance)

        # Determine configuration based on serialized data
        has_assign_form = rep.get('assign_form') is not None
        has_task_close_questions = len(rep.get('task_close_questions', [])) > 0

        # If both are present, keep both (for audit forms and mixed configurations)
        if has_assign_form and has_task_close_questions:
            # Both are present - keep as is
            pass
        # Form-Based configuration (only show assign_form, remove task_close_questions)
        elif has_assign_form:
            rep['task_close_questions'] = []
        # Task-Close-Questions configuration (show task_close_questions, set assign_form to null)
        elif has_task_close_questions:
            rep['assign_form'] = None
            rep['assigned_form_title'] = None
        # Simple toggle configuration (no assign_form, no task_close_questions)
        else:
            rep['task_close_questions'] = []
            rep['assign_form'] = None
            rep['assigned_form_title'] = None

        return rep
    
    def get_assigned_form_title(self, obj):
        if obj.assign_form:
            return obj.assign_form.title
        return None

    def get_assigned_users(self, obj):
        from user.models import CustomUser
        return [{'id': uid, 'name': CustomUser.objects.get(id=uid).get_full_name()} for uid in obj.assign_user_ids or []]

    def get_assigned_groups(self, obj):
        from user.models import Groups
        return [{'id': gid, 'name': Groups.objects.get(id=gid).name} for gid in obj.assign_group_ids or []]

    def get_assigned_leaders(self, obj):
        from user.models import CustomUser
        return [{'id': lid, 'name': CustomUser.objects.get(id=lid).get_full_name()} for lid in obj.assign_leader_ids or []]

    def to_internal_value(self, data):
          if 'assign_form' in data and data['assign_form'] is not None:
              if isinstance(data['assign_form'], Form):
                  data['assign_form'] = data['assign_form'].pk
              elif isinstance(data['assign_form'], str):
                  try:
                      data['assign_form'] = int(data['assign_form'])
                  except ValueError:
                      pass
          return super().to_internal_value(data)

    def validate_title(self, value):
        """Allow blank title values when followup is not enabled"""
        if not value or value.strip() == '':
            # Allow blank title - frontend will handle providing default values
            return value
        return value

    def validate_assign_to(self, value):
        """Allow blank assign_to values when followup is not enabled"""
        if not value or value.strip() == '':
            # Allow blank assign_to - frontend will handle providing default values
            return value
        return value

    class Meta:
        model = LogicFollowUp
        exclude = ()  # Removed 'id' from exclude since we want to include it
        extra_kwargs = {
            'form': {'read_only': True},
            'stage': {'read_only': True},
            'question': {'read_only': True},
            'logic': {'read_only': True},
            'title': {'required': False, 'allow_blank': True},
            'assign_to': {'required': False, 'allow_blank': True}
        }


    @transaction.atomic
    def create(self, validated_data):
        task_close_questions = validated_data.pop('task_close_questions', [])
        assign_users = validated_data.pop('assignUsers', []) # Pop assignUsers
        assign_groups = validated_data.pop('assignGroups', []) # Pop assignGroups
        context = self.context
        
        form = context.get('form')
        stage = context.get('stage', None)
        audit_info = context.get('audit_info', None)
        audit_group = context.get('audit_group', None)
        logic=context.get("logic")
        parent_question=context.get('parent_question')

        # 🔧 FIX: Map assignUsers/assignGroups to user/group fields before creation
        # Store first user/group for backward compatibility (single user/group fields)
        if assign_users and len(assign_users) > 0:
            validated_data['user_id'] = assign_users[0]
        if assign_groups and len(assign_groups) > 0:
            validated_data['group_id'] = assign_groups[0]
        
        # Store all user IDs and group IDs in JSON fields for multiple assignments
        validated_data['assign_user_ids'] = assign_users if assign_users else []
        validated_data['assign_group_ids'] = assign_groups if assign_groups else []

        followUp = LogicFollowUp.objects.create(
            form=form,
            stage=stage,
            audit_info=audit_info,
            audit_group=audit_group,
            logic=logic,
            question=parent_question,
            **validated_data
        )

        # NOTE: FollowUpTask instances are created during form submission,
        # not during form creation. The LogicFollowUp stores the configuration,
        # and actual tasks are triggered when the logic conditions are met.

        # Just create the task_close_questions for reopening purposes
        if task_close_questions:
            for question_data in task_close_questions:
                question_uuid = question_data.get("question_uuid")
                question_form = form
                question_stage = stage

                existing_question = Question.objects.filter(
                    form=question_form,
                    stage=question_stage,
                    question_uuid=question_uuid,
                    question_type=question_data.get("question_type"),
                    organization=self.context['request'].user.organization,
                    is_task_close_question=True
                ).first()

                question_context = {
                    'request': self.context['request'],
                    'form': question_form,
                    'stage': question_stage,
                    'organization': self.context['request'].user.organization,
                    'is_task_close_question': True
                }

                if existing_question:
                    question_serializer = LogicFollowUpQuestionSerializer(
                        existing_question, data=question_data, partial=True, context=question_context
                    )
                else:
                    question_serializer = LogicFollowUpQuestionSerializer(
                        data=question_data, context=question_context
                    )
                question_serializer.is_valid(raise_exception=True)
                question_instance = question_serializer.save()
                followUp.task_close_questions.add(question_instance)

        return followUp

    @transaction.atomic
    def update(self, instance, validated_data):
        task_close_questions = validated_data.pop('task_close_questions', [])
        assign_users = validated_data.pop('assignUsers', []) # Pop assignUsers
        assign_groups = validated_data.pop('assignGroups', []) # Pop assignGroups

        # Update single user/group fields for backward compatibility
        if assign_users and len(assign_users) > 0:
            validated_data['user_id'] = assign_users[0]
        if assign_groups and len(assign_groups) > 0:
            validated_data['group_id'] = assign_groups[0]
        
        # Store all user IDs and group IDs in JSON fields for multiple assignments
        validated_data['assign_user_ids'] = assign_users if assign_users else []
        validated_data['assign_group_ids'] = assign_groups if assign_groups else []

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        follow_up_task_data = {
            "title": validated_data.get("title", instance.title),
            "description": validated_data.get("description", instance.description),
            "deadline": validated_data.get("deadline", instance.deadline),
            "form": instance.form.id,
            "stage": instance.stage.id if instance.stage else None,
            "question": instance.question.id if instance.question else None,
            "logic": instance.logic.id,
            "assigned_user": assign_users,
            "assigned_group": assign_groups,
        }

        # Find existing follow-up task to update
        try:
            follow_up_task_instance = FollowUpTask.objects.filter(
                logic=instance.logic,
                main_form_submission__form=instance.form
            ).first()
        except FollowUpTask.DoesNotExist:
            follow_up_task_instance = None

        if follow_up_task_instance:
            follow_up_task_serializer = FollowUpTaskSerializer(
                follow_up_task_instance, data=follow_up_task_data, partial=True, context=self.context
            )
            follow_up_task_serializer.is_valid(raise_exception=True)
            follow_up_task_instance = follow_up_task_serializer.save()

        # Clear existing task_close_questions from both LogicFollowUp and FollowUpTask
        instance.task_close_questions.clear()
        follow_up_task_instance.task_close_questions.clear()

        # Handle task_close_questions for both LogicFollowUp and FollowUpTask
        for question_data in task_close_questions:
            question_uuid = question_data.get("question_uuid")

            # Determine the correct stage and form for the question
            question_form = instance.form
            question_stage = instance.stage

            existing_question = Question.objects.filter(
                form=question_form,
                stage=question_stage,
                question_uuid=question_uuid,
                question_type=question_data.get("question_type"),
                organization=self.context['request'].user.organization,
                is_task_close_question=True
            ).first()

            question_context = {
                'request': self.context['request'],
                'form': question_form,
                'stage': question_stage,
                'organization': self.context['request'].user.organization,
                'is_task_close_question': True
            }

            if existing_question:
                question_serializer = LogicFollowUpQuestionSerializer(
                    existing_question, data=question_data, partial=True, context=question_context
                )
            else:
                question_serializer = LogicFollowUpQuestionSerializer(
                    data=question_data, context=question_context
                )
            question_serializer.is_valid(raise_exception=True)
            question_instance = question_serializer.save()
            
            instance.task_close_questions.add(question_instance)
            follow_up_task_instance.task_close_questions.add(question_instance)

        return instance


class LogicQuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False)

    class Meta:
        model = Question
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'form': {'read_only': True},
            'stage': {'read_only': True},
            'organization': {'read_only': True},
        }
    @transaction.atomic
    def create(self, validated_data):
        options = validated_data.pop('options', [])
        context = self.context
        
        form = context.get('form')
        stage = context.get('stage', None)
        audit_info = context.get('audit_info', None)
        audit_group = context.get('audit_group', None)
        
        organization = context.get('organization')
        is_logic_question=context.get("is_logic_question", False)
        is_task_close_question=context.get("is_task_close_question", False)

        question = Question.objects.create(
            form=form,
            stage=stage,
            audit_info=audit_info,
            audit_group=audit_group,
            organization=organization,
            is_logic_question=is_logic_question,
            is_task_close_question=is_task_close_question,
            **validated_data
        )

        if options:
            option_objs = []
            for opt in options:
                option_objs.append(Option(
                    option=opt.get('option'),
                    score=opt.get('score', 0),
                    failed=opt.get('failed', False),
                    order=opt.get('order', 1),
                    question=question,
                    stage=stage,
                    audit_info=audit_info,
                    audit_group=audit_group,
                    form=form,
                    organization=organization,
                ))
            if option_objs:
                Option.objects.bulk_create(option_objs, ignore_conflicts=True)

        return question
    
    @transaction.atomic
    def update(self, instance, validated_data):
        options = validated_data.pop('options', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        instance.options.all().delete()
        for option_data in options:
            option_value = option_data.get('option') or option_data.get('label') or option_data.get('value') or option_data.get('name')
            if option_value in (None, ""):
                continue
            normalized_data = {**option_data, 'option': str(option_value)}
            option_serializer = OptionSerializer(
                data=normalized_data,
                context={**self.context, 'form': instance.form, 'stage': instance.stage, 'question': instance}
            )
            option_serializer.is_valid(raise_exception=True)
            option_serializer.save()

        return instance


class LogicSerializer(serializers.ModelSerializer):
    logic_questions = LogicQuestionSerializer(many=True, required=False)
    follow_up = LogicFollowUpSerializer(required=False, allow_null=True)
    
    class Meta:
        model = Logic
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'organization': {'read_only': True},
            'stage': {'read_only': True},
            'audit_info':  {'read_only': True},
            'audit_group':  {'read_only': True},
            'form': {'read_only': True},
            'question': {'read_only': True}
        }

    
    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Use prefetched relations and in-memory filtering to avoid DB hits
        logic_questions_all = list(instance.logic_questions.all())
        logic_questions_filtered = [q for q in logic_questions_all if getattr(q, 'is_logic_question', False)]
        rep['logic_questions'] = LogicQuestionSerializer(logic_questions_filtered, many=True, context=self.context).data

        follow_ups_all = list(instance.follow_ups.all())
        follow_up = follow_ups_all[0] if follow_ups_all else None
        rep['followup_toggle'] = follow_up.followup_toggle if follow_up else False
        rep['follow_up'] = (LogicFollowUpSerializer(follow_up, context=self.context).data if follow_up else None)
        return rep
    
    def validate(self, attrs):
        logic_type = attrs.get('logic_type')
        logic_value = attrs.get('logic_value')
        comparison = attrs.get('comparison')
        form = self.context.get('form')
        stage = self.context.get('stage', None)
        audit_info = self.context.get('audit_info', None)
        audit_group = self.context.get('audit_group', None)
        organization = self.context.get('organization')
        parent_question= self.context.get('parent_question')

        if self.context.get('skip_unique_checks'):
            return attrs

        if Logic.objects.filter(
            form=form,
            stage=stage,
            audit_info=audit_info,
            audit_group=audit_group,
            logic_type=logic_type,
            comparison=comparison,
            logic_value=logic_value,
            question= parent_question,
            organization=organization
        ).exclude(id=self.instance.id if self.instance else None).exists():
            raise serializers.ValidationError({
                'non_field_errors': ['Logic with this type and value already exists for this question.']
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        logic_questions = validated_data.pop('logic_questions', [])
        follow_up = validated_data.pop('follow_up', {})

        form = self.context.get('form')
        stage = self.context.get('stage', None)
        audit_info = self.context.get('audit_info', None)
        audit_group = self.context.get('audit_group', None)
        organization = self.context.get('organization')
        parent_question = self.context.get('parent_question')

        # Exclude fields that are set in context to avoid duplicate keyword arguments
        safe_validated_data = {k: v for k, v in validated_data.items() if k not in ['form', 'stage', 'audit_info', 'audit_group', 'organization', 'question']}

        logic = Logic.objects.create(
            form=form,
            stage=stage,
            audit_info=audit_info,
            audit_group=audit_group,
            organization=organization,
            question=parent_question,
            **safe_validated_data
        )

        # Fast path: bulk create logic_questions when no options are provided
        if logic_questions and all(not (q.get('options') or []) for q in logic_questions):
            to_create = []
            for qd in logic_questions:
                to_create.append(Question(
                    form=form,
                    stage=stage,
                    audit_info=audit_info,
                    audit_group=audit_group,
                    organization=organization,
                    is_logic_question=True,
                    is_task_close_question=False,
                    is_audit_info_question=False,
                    parent_question=None,
                    question_uuid=qd.get('question_uuid', ''),
                    question=qd.get('question', ''),
                    description=qd.get('description'),
                    critical=qd.get('critical', False),
                    formula=qd.get('formula'),
                    question_type=qd.get('question_type'),
                    question_sub_type=qd.get('question_sub_type'),
                    question_hint=qd.get('question_hint'),
                    order=qd.get('order', 1),
                    is_required=qd.get('is_required', False),
                    require_live=qd.get('require_live', False),
                    number_of_file_allowed=qd.get('number_of_file_allowed'),
                    min_value=qd.get('min_value'),
                    max_value=qd.get('max_value'),
                    max_score=qd.get('max_score'),
                    is_other=qd.get('is_other', False),
                    reference_images=qd.get('reference_images', []),
                    reference_videos=qd.get('reference_videos', []),
                ))
            created = Question.objects.bulk_create(to_create)
            logic.logic_questions.add(*created)
        else:
            for question_data in logic_questions:
                question_serializer = LogicQuestionSerializer(
                    data=question_data,
                    context={
                        **self.context,
                        "is_logic_question": True,
                    }
                )
                question_serializer.is_valid(raise_exception=True)
                question = question_serializer.save()
                logic.logic_questions.add(question)
        
        if follow_up and follow_up.get('followup_toggle', False):
            follow_up_serializer = LogicFollowUpSerializer(
                data=follow_up,
                context={
                    **self.context,
                    "logic": logic
                }
            )
            follow_up_serializer.is_valid(raise_exception=True)
            follow_up_serializer.save()
        
        return logic

    @transaction.atomic
    def update(self, instance, validated_data):
        logic_questions_data = validated_data.pop('logic_questions', [])
        follow_up_data = validated_data.pop('follow_up', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        instance.logic_questions.clear()
        for question_data in logic_questions_data:
            question_serializer = LogicQuestionSerializer(
                data=question_data,
                context={**self.context, 'form': instance.form, 'stage': instance.stage, 'organization': instance.organization, "is_logic_question": True}
            )
            question_serializer.is_valid(raise_exception=True)
            question = question_serializer.save()
            instance.logic_questions.add(question)

        if follow_up_data:
            follow_up_instance = instance.follow_ups.first()
            if follow_up_instance:
                follow_up_serializer = LogicFollowUpSerializer(
                    follow_up_instance, data=follow_up_data,
                    context={**self.context, "logic": instance}
                )
                follow_up_serializer.is_valid(raise_exception=True)
                follow_up_serializer.save()
            else:
                follow_up_serializer = LogicFollowUpSerializer(
                    data=follow_up_data,
                    context={**self.context, "logic": instance}
                )
                follow_up_serializer.is_valid(raise_exception=True)
                follow_up_serializer.save()

        return instance
 
       
class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False, allow_null=True)
    logics = LogicSerializer(many=True, required=False)
    sub_questions = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)
    reference_images = serializers.JSONField(required=False)
    reference_videos = serializers.JSONField(required=False)
    
    # Field mapping for frontend compatibility
    requiresApproval = serializers.BooleanField(source='stage_approvals', required=False, allow_null=True)

    class Meta:
        model = Question
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = { 
            'organization': {'read_only': True},
            'stage': {'read_only': True},
            'form': {'read_only': True},
            'parent_question': {'read_only': True},
            'is_other': {'required': False, 'allow_null': True},
        }
    

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # rep.pop('parent_question', None)
        rep.pop('created_at', None)
        rep.pop('updated_at', None)
        # Use prefetched caches; avoid .exists() which may query
        children_qs = instance.child_questions.all()
        children_list = list(children_qs)
        rep["sub_questions"] = QuestionSerializer(children_list, many=True, context=self.context).data if children_list else []

        logics_qs = instance.logic_parent_question.all()
        logics_list = list(logics_qs)
        rep["logics"] = LogicSerializer(logics_list, many=True, context=self.context).data if logics_list else []

        # For linear_scale questions, the UI expects an "options" list similar to multiple choice.
        # If no explicit Option rows exist, generate options from min_value/max_value.
        if instance.question_type == QuestionType.LINEAR_SCALE:
            options = rep.get("options") or []
            min_value = getattr(instance, "min_value", None)
            max_value = getattr(instance, "max_value", None)
            if (not options) and min_value is not None and max_value is not None and max_value >= min_value:
                generated_options = []
                order = 1
                for val in range(int(min_value), int(max_value) + 1):
                    generated_options.append({
                        "option": str(val),
                        "order": order,
                    })
                    order += 1
                rep["options"] = generated_options

        # Ensure options are included for choice-based questions (checkbox/multiple choice/dropdown/audit)
        # Some task-close questions were returning empty options, so we fallback to the DB relation.
        if instance.question_type in [
            QuestionType.CHECKBOXES,
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.DROPDOWN,
            QuestionType.AUDIT,
        ]:
            options = rep.get("options") or []
            if not options:
                try:
                    rep["options"] = OptionSerializer(instance.options.all(), many=True, context=self.context).data
                except Exception:
                    # Keep empty options if something unexpected happens
                    rep["options"] = options
        
        return rep
    
    
    def validate(self, attrs):
        is_other = attrs.get('is_other', False)
        question = attrs.get('question')
        question_type = attrs.get('question_type')
        question_sub_type = attrs.get('question_sub_type')
        parent_question = attrs.get('parent_question', None)

        stage = self.context.get("stage")
        form = self.context.get("form")
        organization = self.context.get("organization")

        if self.context.get('skip_unique_checks'):
            return attrs

        if Question.objects.filter( form=form, stage=stage, question=question, question_type=question_type, organization=organization).exclude(id=self.instance.id if self.instance else None).exists():
            raise serializers.ValidationError({ 'question': "Same Question repeated in a stage."})

        if parent_question:
            if (parent_question.question_type == QuestionType.TABLE and question_type == QuestionType.TABLE) or \
            (parent_question.question_type == QuestionType.AUDIT and question_type == QuestionType.AUDIT):
                raise serializers.ValidationError("Nested Table or Audit questions are not allowed.")

        if is_other:
            if not (
                (question_type == QuestionType.CHECKBOXES) or
                (question_type == QuestionType.AUDIT) or
                (question_type == QuestionType.MULTIPLE_CHOICE and question_sub_type == 'text') or
                (question_type == QuestionType.DROPDOWN and question_sub_type == 'text')
            ):
                raise serializers.ValidationError({
                    'is_other': (
                        "is_other is only allowed for CHECKBOXES, "
                        "or MULTIPLE_CHOICE with sub_type TEXT, "
                        "or DROPDOWN with sub_type TEXT."
                        "or AUDIT Question Types."
                    )
                })
            sub_questions = attrs.get('sub_questions', [])
            if sub_questions:
                if question_type not in (QuestionType.TABLE, QuestionType.AUDIT):
                    raise serializers.ValidationError({'sub_questions': 'Sub-questions are only allowed for TABLE and AUDIT question types.'})
        return attrs
    
    @transaction.atomic
    def create(self, validated_data):
        options = validated_data.pop("options", [])
        if options is None:
            options = []
        logics = validated_data.pop("logics", [])
        sub_questions_data = validated_data.pop("sub_questions", [])
        # Normalize nullable boolean fields sent by frontend
        if validated_data.get("is_other") is None:
            validated_data["is_other"] = False
        context = self.context
        
        form = context.get("form")
        stage = context.get("stage", None)
        audit_info = context.get("audit_info", None)
        audit_group = context.get("audit_group", None)
        organization = context.get("organization")
        is_logic_question=context.get("is_logic_question", False)
        is_task_close_question=context.get("is_task_close_question", False)
        is_audit_info_question=context.get("is_audit_info_question", False)
        parent_question = context.get("parent_question", None)
        
        # Handle requires_approval from context (passed from form level)
        # If requiresApproval is not provided in the payload, use the form's requires_approval value
        requires_approval_from_context = context.get('requires_approval', False)
        
        # Exclude context fields to avoid duplicate keyword arguments
        safe_validated_data = {k: v for k, v in validated_data.items() if k not in ['stage', 'form', 'organization', 'audit_info', 'audit_group', 'is_logic_question', 'is_task_close_question', 'is_audit_info_question', 'parent_question', 'stage_approvals']}
        

        # create question
        question = Question.objects.create(
            stage=stage,
            form=form,
            organization=organization,
            audit_info=audit_info,
            audit_group=audit_group,
            is_logic_question=is_logic_question,
            is_task_close_question=is_task_close_question,
            is_audit_info_question=is_audit_info_question,
            parent_question=parent_question,
            **safe_validated_data
        )

        # Optimize: bulk-create options when possible
        if options:
            allowed_types = [
                QuestionType.DROPDOWN,
                QuestionType.AUDIT,
                QuestionType.CHECKBOXES,
                QuestionType.MULTIPLE_CHOICE,
                QuestionType.LINEAR_SCALE,
            ]
            if question.question_type not in allowed_types:
                raise serializers.ValidationError("Options can only be added to Dropdown, Checkbox, Multiple Choice, Linear Scale and Audit questions.")

            option_objs = []
            for opt in options:
                # Support both dict-form options (web UI) and simple string lists (mobile UI)
                if isinstance(opt, str):
                    option_value = opt
                    score = 0
                    failed = False
                    order = 1
                else:
                    option_value = opt.get('option') or opt.get('label') or opt.get('value') or opt.get('name')
                    score = opt.get('score', 0)
                    failed = opt.get('failed', False)
                    order = opt.get('order', 1)

                if option_value in (None, ""):
                    continue

                option_objs.append(Option(
                    option=str(option_value),
                    score=score,
                    failed=failed,
                    order=order,
                    question=question,
                    stage=stage,
                    audit_info=audit_info,
                    audit_group=audit_group,
                    form=form,
                    organization=organization,
                ))
            if option_objs:
                Option.objects.bulk_create(option_objs, ignore_conflicts=True)

        for sub_question in sub_questions_data:
            subQuestionSerializer = QuestionSerializer(data=sub_question, context={**context, "parent_question": question})
            subQuestionSerializer.is_valid(raise_exception=True)
            subQuestionSerializer.save()
        
        for logic in logics:
            logicSerializer = LogicSerializer(data=logic, context={**context, "parent_question": question})
            logicSerializer.is_valid(raise_exception=True)
            logicSerializer.save()
            
        return question
    
    @transaction.atomic
    def update(self, instance, validated_data):
        options = None
        if 'options' in validated_data:
            options = validated_data.pop("options")
        sub_questions_data = validated_data.pop("sub_questions", [])
        logics_data = validated_data.pop("logics", [])
        # Normalize nullable boolean fields sent by frontend
        if validated_data.get("is_other") is None:
            validated_data.pop("is_other", None)
        context = self.context
        
        # Handle requires_approval from context (passed from form level)
        requires_approval_from_context = context.get('requires_approval', None)
        

        # Update instance fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Handle options: only update if explicitly provided
        if options is not None:
            existing_options = {opt.id: opt for opt in instance.options.all()}
            provided_option_ids = set()
            new_option_objs = []
            for opt_data in options:
                # Support string-only options (mobile UI) as well as dicts
                if isinstance(opt_data, str):
                    option_value = opt_data
                    score = 0
                    failed = False
                    order = 1
                    opt_id = None
                else:
                    opt_id = opt_data.get('id')
                    option_value = opt_data.get('option') or opt_data.get('label') or opt_data.get('value') or opt_data.get('name')
                    score = opt_data.get('score', 0)
                    failed = opt_data.get('failed', False)
                    order = opt_data.get('order', 1)

                if option_value in (None, ""):
                    continue

                if opt_id and opt_id in existing_options:
                    normalized_data = {**(opt_data if isinstance(opt_data, dict) else {}), 'option': str(option_value)}
                    opt_serializer = OptionSerializer(existing_options[opt_id], data=normalized_data, context={**self.context, "question": instance})
                    opt_serializer.is_valid(raise_exception=True)
                    opt_serializer.save()
                    provided_option_ids.add(opt_id)
                else:
                    new_option_objs.append(Option(
                        option=str(option_value),
                        score=score,
                        failed=failed,
                        order=order,
                        question=instance,
                        stage=instance.stage,
                        audit_info=getattr(instance, 'audit_info', None),
                        audit_group=getattr(instance, 'audit_group', None),
                        form=instance.form,
                        organization=instance.organization,
                    ))
            if new_option_objs:
                Option.objects.bulk_create(new_option_objs, ignore_conflicts=True)
            # Delete options not in provided
            instance.options.exclude(id__in=provided_option_ids).delete()

        # Handle sub_questions: update_or_create based on id or question_uuid
        existing_sub_qs = {sub_q.id: sub_q for sub_q in instance.child_questions.all()}
        existing_uuids = {sub_q.question_uuid: sub_q for sub_q in instance.child_questions.all()}
        provided_sub_q_ids = set()
        for sub_data in sub_questions_data:
            sub_id = sub_data.get('id')
            sub_uuid = sub_data.get('question_uuid')
            existing = existing_sub_qs.get(sub_id) if sub_id else (existing_uuids.get(sub_uuid) if sub_uuid else None)
            if existing:
                sub_serializer = QuestionSerializer(existing, data=sub_data, context={**self.context, "parent_question": instance, "is_logic_question": False, "is_task_close_question": False})
                sub_serializer.is_valid(raise_exception=True)
                sub_serializer.save()
                provided_sub_q_ids.add(existing.id)
            else:
                sub_serializer = QuestionSerializer(data=sub_data, context={**self.context, "parent_question": instance, "is_logic_question": False, "is_task_close_question": False})
                sub_serializer.is_valid(raise_exception=True)
                sub_saved = sub_serializer.save()
                provided_sub_q_ids.add(sub_saved.id)
        # Delete sub_questions not in provided
        instance.child_questions.exclude(id__in=provided_sub_q_ids).delete()

        # Handle logics: update_or_create based on id
        existing_logics = {logic.id: logic for logic in instance.logic_parent_question.all()}
        provided_logic_ids = set()
        for logic_data in logics_data:
            logic_id = logic_data.get('id')
            if logic_id and logic_id in existing_logics:
                logic_serializer = LogicSerializer(existing_logics[logic_id], data=logic_data, context={**self.context, "parent_question": instance})
                logic_serializer.is_valid(raise_exception=True)
                logic_serializer.save()
                provided_logic_ids.add(logic_id)
            else:
                logic_serializer = LogicSerializer(data=logic_data, context={**self.context, "parent_question": instance})
                logic_serializer.is_valid(raise_exception=True)
                logic_serializer.save()
        # Delete logics not in provided
        instance.logic_parent_question.exclude(id__in=provided_logic_ids).delete()

        return instance


class StageAccessSerializer(serializers.ModelSerializer):
    allow_user = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all(), required=False, allow_null=True)
    allow_group = serializers.PrimaryKeyRelatedField(queryset=Groups.objects.all(), required=False, allow_null=True)
    allow_stage = serializers.CharField(required=False, allow_null=True)
    form = serializers.PrimaryKeyRelatedField(required=False, allow_null=True, read_only=True)
    stage = serializers.PrimaryKeyRelatedField(required=False, allow_null=True, read_only=True)
    stage_approvals = serializers.BooleanField(required=False, default=False)
    
    class Meta:
        model = StageAccess
        fields = ['id', 'access_type', 'allow_user', 'allow_group', 'allow_stage', 'form', 'stage', 'stage_approvals']

    def validate(self, attrs):
        access_type = attrs.get('access_type')
        allow_user = attrs.get('allow_user')
        allow_group = attrs.get('allow_group')
        allow_stage = attrs.get('allow_stage')
        
        if access_type == StageAccessType.USER and not attrs.get('allow_user'):
            raise serializers.ValidationError("allow_user is required when access_type is USER.")
        if access_type == StageAccessType.GROUP and not attrs.get('allow_group'):
            raise serializers.ValidationError("allow_group is required when access_type is GROUP.")
        if access_type == StageAccessType.PREVIOUS_STAGE and not attrs.get('allow_stage'):
            raise serializers.ValidationError("allow_stage is required when access_type is STAGE.")
        
        if allow_user is not None and hasattr(allow_user, 'pk'):
            attrs['allow_user'] = allow_user.pk
        if allow_group is not None and hasattr(allow_group, 'pk'):
            attrs['allow_group'] = allow_group.pk
        if allow_stage is not None and hasattr(allow_stage, 'pk'):
            attrs['allow_stage'] = allow_stage.pk
        
        return attrs

    def create(self, validated_data):
        allow_user = validated_data.get('allow_user')
        allow_group = validated_data.get('allow_group')

        if isinstance(allow_user, int):
            validated_data['allow_user'] = CustomUser.objects.get(pk=allow_user)
        if isinstance(allow_group, int):
            validated_data['allow_group'] = Groups.objects.get(pk=allow_group)

        # Ensure form and stage are included from context if not in validated_data
        form = validated_data.get('form')
        stage = validated_data.get('stage')
        if not form or not stage:
            context = self.context
            form = context.get('form') or form
            stage = context.get('stage') or stage
            if form:
                validated_data['form'] = form
            if stage:
                validated_data['stage'] = stage

        instance = StageAccess.objects.create(**validated_data)
        return instance
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
    
    
class AuditInfoSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)
    
    class Meta:
        model = AuditInfo
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'form': {'read_only': True},
            'organization': {'read_only': True},
        }

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["questions"] = [
            q for q in rep["questions"]
            if not q.get("parent_question")
            and not q.get("is_logic_question")
            and not q.get("is_task_close_question")
            and q.get("is_audit_info_question")
        ]
        return rep
    
    @transaction.atomic
    def create(self, validated_data):
        form = self.context.get('form')
        organization = self.context.get('organization')
        questions = validated_data.pop("questions", [])
        
        # Create the auditInfo
        audit_info = AuditInfo.objects.create(form=form, organization=organization, **validated_data)
        
        #create AuditInfo Questions
        for question_data in questions:
            questionSerilizer = QuestionSerializer(
                data=question_data, 
                context={
                    **self.context,
                    "audit_info": audit_info,
                    "is_audit_info_question": True,
                }
            )
            questionSerilizer.is_valid(raise_exception=True)
            questionSerilizer.save()
            
        return audit_info

    @transaction.atomic
    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", [])
        validated_data.pop('group_uuid', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        for question_data in questions_data:
            question_id = question_data.get('id')
            if question_id:
                try:
                    question = Question.objects.get(id=question_id, audit_info=instance)
                    question_serializer = QuestionSerializer(question, data=question_data, context={**self.context, "audit_info": instance})
                    question_serializer.is_valid(raise_exception=True)
                    question_serializer.save()
                except Question.DoesNotExist:
                    question_serializer = QuestionSerializer(data=question_data, context={**self.context, "audit_info": instance})
                    question_serializer.is_valid(raise_exception=True)
                    question_serializer.save()
            else:
                question_serializer = QuestionSerializer(data=question_data, context={**self.context, "audit_info": instance})
                question_serializer.is_valid(raise_exception=True)
                question_serializer.save()

        return instance


class AuditGroupSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)
    
    class Meta:
        model = AuditGroup
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'form': {'read_only': True},
            'organization': {'read_only': True},
        }
    
    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["questions"] = [
            q for q in rep["questions"]
            if not q.get("parent_question")
            and not q.get("is_logic_question")
            and not q.get("is_task_close_question")
            and not q.get("is_audit_info_question")
        ]
        return rep
    
    @transaction.atomic
    def create(self, validated_data):
        form = self.context.get('form')
        organization = self.context.get('organization')
        questions = validated_data.pop("questions", [])
        
        # Create the audit_group
        audit_group = AuditGroup.objects.create(form=form, organization=organization, **validated_data)
        
        #create audit_group Questions
        for question_data in questions:
            questionSerilizer = QuestionSerializer(
                data=question_data, 
                context={
                    **self.context,
                    "audit_group": audit_group,
                }
            )
            questionSerilizer.is_valid(raise_exception=True)
            questionSerilizer.save()
            
        return audit_group

    @transaction.atomic
    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", [])
        validated_data.pop('group_uuid', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        for question_data in questions_data:
            question_id = question_data.get('id')
            if question_id:
                try:
                    question = Question.objects.get(id=question_id, audit_group=instance)
                    question_serializer = QuestionSerializer(question, data=question_data, context={**self.context, "audit_group": instance})
                    question_serializer.is_valid(raise_exception=True)
                    question_serializer.save()
                except Question.DoesNotExist:
                    question_serializer = QuestionSerializer(data=question_data, context={**self.context, "audit_group": instance})
                    question_serializer.is_valid(raise_exception=True)
                    question_serializer.save()
            else:
                question_serializer = QuestionSerializer(data=question_data, context={**self.context, "audit_group": instance})
                question_serializer.is_valid(raise_exception=True)
                question_serializer.save()

        return instance
class StageSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)
    stage_access = StageAccessSerializer(many=True, required=False)
    assignments = serializers.SerializerMethodField()  # Fetch assignments from StageAccess

    class Meta:
        model = Stage
        exclude = ('created_by', 'updated_by', 'organization')
        extra_kwargs = {
            'form': {'read_only': True},
            'organization': {'read_only': True},
            'questions': {'read_only': True},
            # Accept client-provided stage_uuid on create; update() still blocks modifications.
            'stage_uuid': {'required': False}
        }

    def get_assignments(self, obj):
        # Use prefetched access_parent_stage to avoid N+1 queries
        assignments_data = []
        stage_access_records = getattr(obj, 'access_parent_stage').all()

        for access in stage_access_records:
            assignment = {
                'id': access.id,
                'assign_type': access.access_type,
                'user': access.allow_user.id if access.allow_user else None,
                'group': access.allow_group.id if access.allow_group else None,
                'stage_order': obj.order,
                'assignment_uuid': str(access.id),  # Use id as a proxy for assignment_uuid
                'organization': obj.organization.id
            }
            assignments_data.append(assignment)

        return assignments_data

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["questions"] = [
            q for q in rep["questions"]
            if not q.get("parent_question")
            and not q.get("is_logic_question")
            and not q.get("is_task_close_question")
            and not q.get("is_audit_info_question")
        ]
        # Ensure stage_access is always included in the response
        if 'stage_access' not in rep or not rep['stage_access']:
            rep['stage_access'] = StageAccessSerializer(instance.access_parent_stage.all(), many=True).data
        return rep

    @transaction.atomic
    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        stage_access_data_list = validated_data.pop("stage_access", [])
        form = self.context.get('form')
        organization = self.context.get('organization')

        # Ensure stage_uuid is generated if not provided
        if 'stage_uuid' not in validated_data:
            validated_data['stage_uuid'] = str(uuid.uuid4())

        # Extract requires_approval from validated_data to pass to questions
        requires_approval = validated_data.pop('requires_approval', False)
        
        stage = Stage.objects.create(form=form, organization=organization, **validated_data)
        if stage_access_data_list:
            # Bulk create StageAccess entries
            to_create = []
            for access in stage_access_data_list:
                access_type = access.get('access_type')
                allow_user = access.get('allow_user')
                allow_group = access.get('allow_group')
                allow_stage = access.get('allow_stage')
                # Get stage_approvals from the access data, fallback to form-level requires_approval
                stage_approvals = access.get('stage_approvals', requires_approval)

                if access_type == StageAccessType.USER and not allow_user:
                    raise serializers.ValidationError("allow_user is required when access_type is USER.")
                if access_type == StageAccessType.GROUP and not allow_group:
                    raise serializers.ValidationError("allow_group is required when access_type is GROUP.")
                if access_type == StageAccessType.PREVIOUS_STAGE and not allow_stage:
                    raise serializers.ValidationError("allow_stage is required when access_type is STAGE.")

                obj = StageAccess(
                    access_type=access_type,
                    allow_stage=allow_stage,
                    form=form,
                    stage=stage,
                    stage_approvals=stage_approvals,
                )
                if allow_user is not None:
                    obj.allow_user_id = allow_user if isinstance(allow_user, int) else getattr(allow_user, 'id', None)
                if allow_group is not None:
                    obj.allow_group_id = allow_group if isinstance(allow_group, int) else getattr(allow_group, 'id', None)
                to_create.append(obj)
            if to_create:
                StageAccess.objects.bulk_create(to_create, ignore_conflicts=True)

        for question in questions_data:
            question_serializer = QuestionSerializer(data=question, context={**self.context, "stage": stage, 'requires_approval': requires_approval})
            question_serializer.is_valid(raise_exception=True)
            question_serializer.save()

        return stage

    @transaction.atomic
    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", [])
        stage_access_data = validated_data.pop("stage_access", [])
        requires_approval = validated_data.pop('requires_approval', None)

        # Update existing stage fields, excluding stage_uuid
        for attr, value in validated_data.items():
            if attr != 'stage_uuid':  # Prevent updating stage_uuid
                setattr(instance, attr, value)
        instance.save()

        # Update existing stage_access and bulk-create new ones
        existing_stage_access = {access.id: access for access in instance.access_parent_stage.all()}
        new_access_to_create = []
        for access_data in stage_access_data:
            access_id = access_data.get('id')
            if access_id and access_id in existing_stage_access:
                access = existing_stage_access[access_id]
                access_serializer = StageAccessSerializer(access, data=access_data, context={**self.context, 'form': instance.form, 'stage': instance})
                access_serializer.is_valid(raise_exception=True)
                access_serializer.save()
            else:
                access_type = access_data.get('access_type')
                allow_user = access_data.get('allow_user')
                allow_group = access_data.get('allow_group')
                allow_stage = access_data.get('allow_stage')
                stage_approvals = access_data.get('stage_approvals', requires_approval)

                if access_type == StageAccessType.USER and not allow_user:
                    raise serializers.ValidationError("allow_user is required when access_type is USER.")
                if access_type == StageAccessType.GROUP and not allow_group:
                    raise serializers.ValidationError("allow_group is required when access_type is GROUP.")
                if access_type == StageAccessType.PREVIOUS_STAGE and not allow_stage:
                    raise serializers.ValidationError("allow_stage is required when access_type is STAGE.")

                obj = StageAccess(
                    access_type=access_type,
                    allow_stage=allow_stage,
                    form=instance.form,
                    stage=instance,
                    stage_approvals=stage_approvals,
                )
                if allow_user is not None:
                    obj.allow_user_id = allow_user if isinstance(allow_user, int) else getattr(allow_user, 'id', None)
                if allow_group is not None:
                    obj.allow_group_id = allow_group if isinstance(allow_group, int) else getattr(allow_group, 'id', None)
                new_access_to_create.append(obj)
        if new_access_to_create:
            StageAccess.objects.bulk_create(new_access_to_create, ignore_conflicts=True)

        # Only update existing StageAccess records if form-level requires_approval is provided
        # and we don't have per-stage stage_approvals data that should be used instead
        if requires_approval is not None and not stage_access_data:
            StageAccess.objects.filter(stage=instance).update(stage_approvals=requires_approval)

        # Update existing questions
        for question_data in questions_data:
            question_id = question_data.get('id')
            if question_id:
                try:
                    question = Question.objects.get(id=question_id, stage=instance)
                    question_serializer = QuestionSerializer(question, data=question_data, context={**self.context, "stage": instance, 'requires_approval': requires_approval})
                    question_serializer.is_valid(raise_exception=True)
                    question_serializer.save()
                except Question.DoesNotExist:
                    raise serializers.ValidationError({
                        'question_id': f"No Question found with id {question_id} for this stage."
                    })
            else:
                question_serializer = QuestionSerializer(data=question_data, context={**self.context, "stage": instance, 'requires_approval': requires_approval})
                question_serializer.is_valid(raise_exception=True)
                question_serializer.save()

        return instance


class FormAssignmentReadSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    leader_name = serializers.CharField(source='leader.username', read_only=True)

    class Meta:
        model = FormAssignment
        fields = ['id', 'assign_type', 'user', 'user_name', 'group', 'group_name', 'leader', 'leader_name']
   
        
class CompactFormSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    response_count = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    class Meta:
        model = Form
        fields = ['id', 'title', 'form_type', 'created_at', 'created_by', 'organization','is_archived', 'response_count', 'status']
        extra_kwargs = {
            'id': {'read_only': True},
            'title': {'read_only': True},
            'form_type': {'read_only': True},
            'created_at': {'read_only': True},
            'is_archived': {'read_only': True},
        }
    def get_created_by(self, obj):
        # Return the full name combining first_name and last_name
        if obj.created_by:
            first = obj.created_by.first_name or ""
            last = obj.created_by.last_name or ""
            return f"{first.strip()} {last.strip()}".strip() or obj.created_by.username
        return "N/A"
    
    def get_response_count(self, obj):
        # Return annotated response count if available, otherwise count only completed submissions.
        if hasattr(obj, 'response_count') and obj.response_count is not None:
            return obj.response_count
        from django.db.models import Q
        return obj.submissions.filter(
            Q(submission_initiated_stage__isnull=False) |
            Q(group_submissions_history__isnull=False) |
            Q(stage_submissions_history__isnull=False)
        ).distinct().count()

    def get_status(self, obj):
        return getattr(obj, 'status', None)

class FormSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True, required=False)
    assignments = FormAssignmentReadSerializer(many=True, read_only=True, source='assignee')
    audit_info = AuditInfoSerializer(many=False, required=False)
    audit_group = AuditGroupSerializer(many=True, required=False)
    auto_share_config = serializers.SerializerMethodField()
    form_admin_display = serializers.SerializerMethodField(read_only=True)
    folder = serializers.PrimaryKeyRelatedField(queryset=Folder.objects.all(), allow_null=True)
    folder_name = serializers.SerializerMethodField(read_only=True)
    is_archived = serializers.BooleanField(read_only=True)

    class Meta:
        model = Form
        fields = '__all__'
        extra_kwargs = {'organization': {'read_only': True}}
    
    def get_folder_name(self, obj):
        return obj.folder.name if obj.folder else None

    def get_auto_share_config(self, obj):
        config = getattr(obj, 'auto_share_config', None)
        if not config:
            return None
        try:
            return {
                'users': [u.id for u in config.users.all()],
                'groups': [g.id for g in config.groups.all()],
                'location_leaders': [l.id for l in config.location_leaders.all()],
            }
        except Exception:
            return {
                'users': list(config.users.values_list('id', flat=True)),
                'groups': list(config.groups.values_list('id', flat=True)),
                'location_leaders': list(config.location_leaders.values_list('id', flat=True)),
            }

    def get_form_admin_display(self, obj):
        user = obj.form_admin
        if user:
            first = user.first_name or ""
            last = user.last_name or ""
            return f"{first.strip()} {last.strip()}".strip() or user.username or user.email
        return "Unknown"

    def _save_auto_share_config(self, form):
        auto_share_config_data = self.initial_data.get('auto_share_config', serializers.empty)
        if auto_share_config_data is serializers.empty or auto_share_config_data is None:
            return

        if not isinstance(auto_share_config_data, dict):
            raise serializers.ValidationError({
                'auto_share_config': 'Expected an object with users, groups, and location_leaders.'
            })

        organization = self.context['request'].user.organization
        config, _ = FormAutoShareConfig.objects.get_or_create(
            form=form,
            organization=organization
        )

        if 'users' in auto_share_config_data:
            user_ids = auto_share_config_data.get('users') or []
            users = CustomUser.objects.filter(id__in=user_ids, organization=organization)
            config.users.set(users)

        if 'groups' in auto_share_config_data:
            group_ids = auto_share_config_data.get('groups') or []
            groups = Groups.objects.filter(id__in=group_ids, organization=organization)
            config.groups.set(groups)

        if 'location_leaders' in auto_share_config_data:
            leader_ids = auto_share_config_data.get('location_leaders') or []
            leaders = self._resolve_location_leader_users(leader_ids, organization)
            config.location_leaders.set(leaders)
            logger.info(
                "FormSerializer saved location leaders for form %s: raw_ids=%s resolved_user_ids=%s",
                form.id,
                leader_ids,
                list(leaders.values_list('id', flat=True)),
            )

    def _resolve_location_leader_users(self, leader_ids, organization):
        if not leader_ids:
            logger.info("Location leader resolve skipped: no leader IDs provided")
            return CustomUser.objects.none()

        direct_users = CustomUser.objects.filter(
            id__in=leader_ids,
            organization=organization,
            role__name='location_leader'
        )
        direct_user_ids = set(direct_users.values_list('id', flat=True))

        remaining_ids = [leader_id for leader_id in leader_ids if leader_id not in direct_user_ids]
        location_leader_user_ids = list(
            LocationLeader.objects.filter(
                id__in=remaining_ids,
                organization=organization
            ).values_list('user_id', flat=True)
        )

        resolved_user_ids = list(direct_user_ids.union(location_leader_user_ids))
        logger.info(
            "Resolved location leaders: raw_ids=%s direct_user_ids=%s location_leader_user_ids=%s final_user_ids=%s",
            leader_ids,
            list(direct_user_ids),
            location_leader_user_ids,
            resolved_user_ids,
        )
        return CustomUser.objects.filter(id__in=resolved_user_ids, organization=organization)

    def validate(self, attrs):
        request = self.context.get('request')
        skip_unique_checks = self.context.get('skip_unique_checks', False)
        if request and request.method == 'POST' and not skip_unique_checks:
            formType = attrs.get('form_type')
            title = attrs.get('title')
            organization = self.context['request'].user.organization
            if Form.objects.filter(form_type=formType, title=title, organization=organization).exists():
                raise serializers.ValidationError({
                    'non_field_errors': ['Form with this title and type already exists for this organization.']
                })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        stages_data = validated_data.pop('stages', [])
        audit_info = validated_data.pop('audit_info', {})
        audit_group = validated_data.pop('audit_group', [])
        organization = self.context['request'].user.organization
        # Extract requires_approval from validated_data to pass to stages/questions
        requires_approval = validated_data.pop('requires_approval', False)

        form = Form.objects.create(organization=organization, **validated_data)

        for stage_data in stages_data:
            name = stage_data.get('name')
            if Stage.objects.filter(form=form, name=name, organization=organization).exists():
                raise serializers.ValidationError({
                    "stages": [{
                        "name": f"Stage with name '{name}' already exists for this form and organization."
                    }]
                })
            stage_serializer = StageSerializer(data=stage_data, context={**self.context, 'form': form, 'organization': organization, 'requires_approval': requires_approval, 'skip_unique_checks': True})
            stage_serializer.is_valid(raise_exception=True)
            stage_serializer.save()

        if validated_data.get("form_type") == FormType.AUDIT:
            if audit_info:
                audit_info_serializer = AuditInfoSerializer(data=audit_info, context={**self.context, 'form': form, 'organization': organization, 'skip_unique_checks': True})
                audit_info_serializer.is_valid(raise_exception=True)
                audit_info_serializer.save()
            if audit_group:
                for audit_group_data in audit_group:
                    audit_group_serializer = AuditGroupSerializer(data=audit_group_data, context={**self.context, 'form': form, 'organization': organization, 'skip_unique_checks': True})
                    audit_group_serializer.is_valid(raise_exception=True)
                    audit_group_serializer.save()

        self._save_auto_share_config(form)

        return form

    @transaction.atomic
    def update(self, instance, validated_data):
        stages_data = validated_data.pop('stages', [])
        audit_info_data = validated_data.pop('audit_info', None)
        audit_group_data = validated_data.pop('audit_group', None)

        # Update form fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update or create stages without duplicating stage_uuid
        existing_stages = {stage.id: stage for stage in instance.stages.all()}
        for stage_data in stages_data:
            stage_id = stage_data.get('id')
            if stage_id and stage_id in existing_stages:
                stage = existing_stages[stage_id]
                # Remove stage_uuid from validated_data to avoid conflict
                stage_data_copy = stage_data.copy()
                if 'stage_uuid' in stage_data_copy:
                    del stage_data_copy['stage_uuid']
                stage_serializer = StageSerializer(stage, data=stage_data_copy, context={**self.context, 'form': instance, 'organization': instance.organization})
                stage_serializer.is_valid(raise_exception=True)
                stage_serializer.save()
            else:
                # Create new stage with new stage_uuid
                stage_data_copy = stage_data.copy()
                if 'stage_uuid' not in stage_data_copy:
                    stage_data_copy['stage_uuid'] = str(uuid.uuid4())
                stage_serializer = StageSerializer(data=stage_data_copy, context={**self.context, 'form': instance, 'organization': instance.organization})
                stage_serializer.is_valid(raise_exception=True)
                stage_serializer.save()

        # Update or create audit_info for AUDIT form type
        if instance.form_type == FormType.AUDIT:
            if audit_info_data is not None:
                existing_ai = getattr(instance, 'audit_info', None)
                if existing_ai:
                    ai_serializer = AuditInfoSerializer(existing_ai, data=audit_info_data, context={**self.context, 'form': instance, 'organization': instance.organization})
                    ai_serializer.is_valid(raise_exception=True)
                    ai_serializer.save()
                else:
                    ai_serializer = AuditInfoSerializer(data=audit_info_data, context={**self.context, 'form': instance, 'organization': instance.organization})
                    ai_serializer.is_valid(raise_exception=True)
                    ai_serializer.save()

            if audit_group_data is not None:
                existing_ag_by_id = {ag.id: ag for ag in instance.audit_group.all()}
                existing_ag_by_uuid = {ag.group_uuid: ag for ag in instance.audit_group.all() if ag.group_uuid}
                for ag_data in audit_group_data:
                    ag_id = ag_data.get('id')
                    ag_uuid = ag_data.get('group_uuid')
                    existing = None
                    if ag_id and ag_id in existing_ag_by_id:
                        existing = existing_ag_by_id[ag_id]
                    elif ag_uuid and ag_uuid in existing_ag_by_uuid:
                        existing = existing_ag_by_uuid[ag_uuid]
                    if existing:
                        ag_serializer = AuditGroupSerializer(existing, data=ag_data, context={**self.context, 'form': instance, 'organization': instance.organization})
                        ag_serializer.is_valid(raise_exception=True)
                        ag_serializer.save()
                    else:
                        ag_serializer = AuditGroupSerializer(data=ag_data, context={**self.context, 'form': instance, 'organization': instance.organization})
                        ag_serializer.is_valid(raise_exception=True)
                        ag_serializer.save()

        self._save_auto_share_config(instance)

        return instance
    
class FormAssignmentSerializer(serializers.ModelSerializer):
    user = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    group = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    leader = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )

    class Meta:
        model = FormAssignment
        fields = ['assign_type', 'form', 'user', 'group', 'leader']

    def validate(self, attrs):
        assign_type = attrs.get('assign_type')
        types = {
            'user': attrs.get('user'),
            'group': attrs.get('group'),
            'leader': attrs.get('leader'),
        }

        if not assign_type:
            raise serializers.ValidationError("assign_type is required.")

        if assign_type not in types:
            raise serializers.ValidationError("Invalid assign_type.")

        # Ensure only the correct field is provided
        provided_field = types.get(assign_type)
        if not provided_field:
            raise serializers.ValidationError(f"Field '{assign_type}' must be provided as a list of IDs.")

        for key, value in types.items():
            if key != assign_type and value:
                raise serializers.ValidationError(f"Only '{assign_type}' can be provided. Remove '{key}'.")

        return attrs
    

class FormSubmissionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    form = serializers.PrimaryKeyRelatedField(queryset=Form.objects.all(), required=True)
    submission_initiated_stage = serializers.PrimaryKeyRelatedField(queryset=Stage.objects.all(), allow_null=True, required=False)
    submission_initiated_on= serializers.DateTimeField(read_only=True, required=False)
    submission_initiated_by = serializers.SerializerMethodField()  # Ensure this returns full name
    is_completed = serializers.BooleanField(default=False, required=False)
    completed_by = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all(), allow_null=True, required=False)
    completed_on = serializers.DateTimeField(read_only=True, required=False)
    # Existing fields
    initiator_designation = serializers.SerializerMethodField()
    initiator_department = serializers.SerializerMethodField()
    initiator_location = serializers.SerializerMethodField()
    current_owner = serializers.SerializerMethodField()
    stage_details = serializers.SerializerMethodField()

    class Meta:
        model = FormSubmision
        fields = [
            'id',
            'form',
            'submission_initiated_stage',
            'submission_initiated_on',
            'submission_initiated_by',
            'is_completed',
            'completed_by',
            'completed_on',
            'initiator_designation',
            'initiator_department',
            'initiator_location',
            'current_owner',
            'stage_details',
        ]
        extra_kwargs = {
            'submitted_on': {'read_only': True}
        }

    def get_submission_initiated_by(self, obj):
        """Return full name of the user who initiated the submission."""
        if obj.submission_initiated_by:
            user = obj.submission_initiated_by
            full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            return full_name or user.username or "N/A"
        return "N/A"

    def get_initiator_designation(self, obj):
        """Return designation of the user who initiated the submission."""
        if obj.submission_initiated_by and obj.submission_initiated_by.designation:
            return obj.submission_initiated_by.designation.name
        return "N/A"

    def get_initiator_department(self, obj):
        """Return department of the user who initiated the submission."""
        if obj.submission_initiated_by and obj.submission_initiated_by.department:
            return obj.submission_initiated_by.department.name
        return "N/A"

    def get_initiator_location(self, obj):
        """Return location selected while filling the form (from location-type answers).
        Falls back to the initiator's mapped location if no location answer exists."""
        # Try prefetched answers first (if available from prefetch_related)
        prefetched = getattr(obj, '_prefetched_location_answers', None)
        if prefetched is not None:
            for ans in prefetched:
                if ans.location_id:
                    return ans.location.name if hasattr(ans, 'location') and ans.location else "N/A"
        else:
            location_answer = Answer.objects.filter(
                submission=obj,
                question_type=QuestionType.LOCATION,
                location__isnull=False
            ).select_related('location').order_by('id').first()
            if location_answer and location_answer.location:
                return location_answer.location.name
        if obj.submission_initiated_by and obj.submission_initiated_by.location:
            return obj.submission_initiated_by.location.name
        return "N/A"

    def get_current_owner(self, obj):
        """Return the appropriate owner based on form type, handling missing stage data."""
        try:
            form_type = getattr(obj.form, 'form_type', None)  # Safely access form_type
            if not form_type:
                return "N/A"

            if form_type == FormType.AUDIT:
                # For audit forms, current_owner is the initiator
                if obj.submission_initiated_by:
                    user = obj.submission_initiated_by
                    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
                    return full_name or user.username or "N/A"
                return "N/A"
            else:
                # For standard and location forms
                if not obj.is_completed:
                    # Check if there are any stages associated
                    if not obj.submission_initiated_stage:
                        return "N/A"  # No stages, return N/A

                    # Use prefetched stage history if available
                    prefetched_history = getattr(obj, '_prefetched_stage_submissions_history', None)
                    if prefetched_history is not None:
                        max_order = max((sh.stage_order for sh in prefetched_history), default=0)
                        current_stage_order = 1 if max_order == 0 else max_order + 1
                    else:
                        completed_stages = StageSubmissionHistory.objects.filter(
                            form_submission=obj,
                            organization=obj.organization
                        ).order_by('-stage_order').values('stage_order').first()
                        current_stage_order = 1 if not completed_stages else completed_stages['stage_order'] + 1

                    # Use cached stages if available
                    cached_stages = getattr(obj, '_cached_stages', None)
                    if cached_stages is not None:
                        next_stage = next((s for s in cached_stages if s.order == current_stage_order), None)
                    else:
                        next_stage = Stage.objects.filter(
                            form=obj.form,
                            order=current_stage_order,
                            form__is_deleted=False,
                            form__is_archived=False,
                            form__organization=obj.organization
                        ).first()

                    if not next_stage:
                        return "N/A"

                    # Find users assigned to the next stage
                    stage_assignments = StageAssignment.objects.filter(
                        form=obj.form,
                        stage=next_stage,
                        stage_order=current_stage_order,
                        form_submission=obj,
                        is_assignment_fullfilled=False,
                        organization=obj.organization
                    ).select_related('user')

                    if not stage_assignments.exists():
                        stage_access = StageAccess.objects.filter(
                            stage=next_stage,
                            form=obj.form
                        ).first()

                        if stage_access and stage_access.access_type == StageAccessType.GROUP:
                            group = stage_access.allow_group
                            if group:
                                group_members = group.members.all()
                                if group_members.exists():
                                    return ", ".join(
                                        f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
                                        for user in group_members
                                    )
                        elif stage_access and stage_access.access_type == StageAccessType.USER:
                            user = stage_access.allow_user
                            if user:
                                return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
                        return "N/A"

                    return ", ".join(
                        f"{assignment.user.first_name or ''} {assignment.user.last_name or ''}".strip() or assignment.user.username
                        for assignment in stage_assignments
                    )
                else:
                    # When all stages are completed, return the name of the last stage completer
                    last_submission = StageSubmissionHistory.objects.filter(
                        form_submission=obj,
                        organization=obj.organization
                    ).order_by('-stage_order').first()
                    if last_submission and last_submission.completed_by:
                        user = last_submission.completed_by
                        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
                        return full_name or user.username or "N/A"
                    return "N/A"
        except (AttributeError, ObjectDoesNotExist, ValueError) as e:
            # Handle cases where form or related objects are missing
            return "N/A"
    
    def get_stage_details(self, obj):
        """Return details of only the incomplete stages in ascending order."""
        try:
            # Use prefetched stage history if available
            prefetched_history = getattr(obj, '_prefetched_stage_submissions_history', None)
            if prefetched_history is not None:
                stage_history = {sh.stage_order: sh for sh in prefetched_history}
            else:
                stage_history = {
                    sh.stage_order: sh for sh in StageSubmissionHistory.objects.filter(
                        form_submission=obj,
                        organization=obj.organization
                    )
                }

            # Cache stages per form to avoid repeated queries
            if not hasattr(obj, '_cached_stages'):
                stages = Stage.objects.filter(
                    form=obj.form,
                    form__organization=obj.organization,
                    form__is_deleted=False,
                    form__is_archived=False
                ).order_by('order')
                obj._cached_stages = list(stages)
            else:
                stages = obj._cached_stages

            stage_data = []
            for stage in stages:
                completed = stage.order in stage_history
                if not completed:
                    stage_data.append({
                        "stage_name": stage.name,
                        "order": stage.order,
                        "is_completed": False,
                    })

            return stage_data
        except Exception:
            return []  


class StageSubmissionHistorySerializer(serializers.ModelSerializer):
    stage = serializers.PrimaryKeyRelatedField(queryset=Stage.objects.all(), required=True)
    form_submission = serializers.PrimaryKeyRelatedField(queryset=FormSubmision.objects.all(), required=True)
    stage_assignment_uuid = serializers.CharField(max_length=255, required=True)
    completed_by = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all(), allow_null=True, required=False)
    completed_on = serializers.DateTimeField(read_only=True, required=False)

    class Meta:
        model = StageSubmissionHistory
        fields = '__all__'
        extra_kwargs = {
            'id': {'read_only': True}
        }

class AuditFormSubmissionHistorySerializer(serializers.ModelSerializer):
    form_submission = serializers.PrimaryKeyRelatedField(queryset=FormSubmision.objects.all(), required=True)
    group_assignment_uuid = serializers.CharField(max_length=255, required=True)
    completed_by = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all(), allow_null=True, required=False)
    completed_on = serializers.DateTimeField(read_only=True, required=False)
    form_overall_status = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    form_overall_score = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    form_critical_failed = serializers.IntegerField(required=False, default=0)
    groups_status = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    group_score = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    form_id = serializers.PrimaryKeyRelatedField(queryset=Form.objects.all(), required=False, allow_null=True)
    group_id = serializers.PrimaryKeyRelatedField(queryset=AuditGroup.objects.all(), required=False, allow_null=True)

    class Meta:
        model = AuditFormSubmissionHistory
        fields = '__all__'
        extra_kwargs = {
            'id': {'read_only': True},
            'organization': {'read_only': True}
        }

class AnswerSerializer(serializers.ModelSerializer):
    stage = serializers.PrimaryKeyRelatedField(queryset=Stage.objects.all(), required=False)
    question = serializers.PrimaryKeyRelatedField(queryset=Question.objects.all(),required=True)
    division = serializers.PrimaryKeyRelatedField(queryset=Divisions.objects.all(), allow_null=True, required=False)
    sub_division = serializers.PrimaryKeyRelatedField(queryset=Divisions.objects.all(), allow_null=True, required=False)
    location = serializers.PrimaryKeyRelatedField(queryset=Locations.objects.all(), allow_null=True, required=False)
    user = serializers.PrimaryKeyRelatedField( queryset=CustomUser.objects.all(), allow_null=True, required=False)
    submitted_by = serializers.PrimaryKeyRelatedField( queryset=CustomUser.objects.all(), allow_null=True, required=False)
    submission = serializers.PrimaryKeyRelatedField(queryset=FormSubmision.objects.all())
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    answer_id = serializers.SerializerMethodField()
    question_uuid = serializers.SerializerMethodField()
    other_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    approved_stages = serializers.BooleanField(required=False, allow_null=True)
    signature = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Answer
        fields = [
            'question',
            'question_uuid',
            'question_type',
            'answer',
            'Form',
            'stage',
            'division',
            'sub_division',
            'location',
            'user',
            'submitted_by',
            'submitted_on',
            'submission',
            'organization',
            'other_text',
            "remarks",
            "approved_stages",
            "signature",
            'answer_id'
        ]

    def create(self, validated_data):
        signature = validated_data.pop("signature", None)
        if validated_data.get("approved_stages") is None:
            validated_data["approved_stages"] = False
        if signature not in (None, "") and not validated_data.get("answer"):
            validated_data["answer"] = signature
        return super().create(validated_data)

    def update(self, instance, validated_data):
        signature = validated_data.pop("signature", None)
        if validated_data.get("approved_stages") is None:
            validated_data["approved_stages"] = False
        if signature not in (None, "") and not validated_data.get("answer"):
            validated_data["answer"] = signature
        return super().update(instance, validated_data)
    def get_answer_id(self, obj):
        return obj.answer

    def get_question_uuid(self, obj):
        return getattr(getattr(obj, 'question', None), 'question_uuid', None)

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        question_type = rep.get('question_type')
        answer_value = rep.get('answer')
        other_text_value = rep.get('other_text')

        # Set answer_id to the raw answer value from the DB
        rep['answer_id'] = instance.answer

        # Always prefer the custom "Other" text when the selected option corresponds to "other".
        # This covers cases where `answer`/`answer_id` may store the option id (string/int) rather than the literal label.
        if other_text_value and other_text_value.strip():
            # If answer is empty, it's definitely "Other".
            if not answer_value:
                rep['answer'] = other_text_value
                return rep

        # Only handle these types
        if question_type == QuestionType.DIVISION and answer_value:
            try:
                rep['answer'] = Divisions.objects.get(pk=answer_value).name
            except Exception:
                pass
        elif question_type == QuestionType.SUB_DIVISION and answer_value:
            try:
                rep['answer'] = SubDivisions.objects.get(pk=answer_value).name  
            except Exception:
                pass
        elif question_type == QuestionType.LOCATION and answer_value:
            try:
                rep['answer'] = Locations.objects.get(pk=answer_value).name
            except Exception:
                pass
        elif question_type == QuestionType.USER and answer_value:
            try:
                user_obj = CustomUser.objects.get(pk=answer_value)
                rep['answer'] = user_obj.get_full_name() or user_obj.username
            except Exception:
                pass
        elif question_type in [QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN, QuestionType.AUDIT] and answer_value:
            try:
                opt = Option.objects.get(pk=answer_value)
                option_text = opt.option
                if other_text_value and str(option_text).strip().lower() == 'other':
                    option_text = other_text_value
                rep['answer'] = option_text
            except Exception:
                pass
        elif question_type == QuestionType.CHECKBOXES and answer_value:
            # Checkboxes may be a comma-separated string of IDs
            try:
                ids = [int(i) for i in answer_value.split(',') if i.strip().isdigit()]
                rep['answer'] = [Option.objects.get(pk=oid).option for oid in ids if Option.objects.filter(pk=oid).exists()]
            except Exception:
                pass

        return rep   


class FormListSerializer(serializers.ModelSerializer):
    stage_count = serializers.SerializerMethodField()
    audit_group_count = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    form_admin = serializers.SerializerMethodField()
    deleted_by = serializers.SerializerMethodField()
    folder = serializers.PrimaryKeyRelatedField(queryset=Folder.objects.all(), allow_null=True)
    response_count = serializers.SerializerMethodField()
    is_disabled = serializers.SerializerMethodField()
    
    class Meta:
        model = Form
        fields = [
            'id',
            'form_type',
            'title',
            'prefix',
            'GPS',
            'form_admin',
            'pass_percentage',
            'max_score',
            'created_at',
            'stage_count',
            'question_count',
            'folder',
            'response_count',
            'audit_group_count',
            'is_deleted',
            'deleted_by', 
            'is_disabled',
            'is_archived'
        ]
    
    def get_stage_count(self, obj):
        return obj.stages.count()
    def get_is_disabled(self, obj):
        return obj.is_disabled
    def get_audit_group_count(self, obj):
        if obj.form_type == FormType.AUDIT:
            return obj.audit_group.count()
        return 0
    
    def get_question_count(self, obj):
        if obj.form_type == FormType.AUDIT:
            # Count questions in audit groups
            count = 0
            for audit_group in obj.audit_group.all():
                count += audit_group.questions.count()
            return count
        else:
            # Count questions in stages
            count = 0
            for stage in obj.stages.all():
                count += stage.questions.count()
            return count
    
    def get_response_count(self, obj):
        # Count only completed submissions (with stage/audit histories).
        from django.db.models import Q
        return obj.submissions.filter(
            Q(submission_initiated_stage__isnull=False) |
            Q(group_submissions_history__isnull=False) |
            Q(stage_submissions_history__isnull=False)
        ).distinct().count()
    
    def get_deleted_by(self, obj):
        if obj.deletedBy:
            return obj.deletedBy.username
        return None
    
    def get_form_admin(self, obj):
        if obj.form_admin:
            return f"{obj.form_admin.first_name} {obj.form_admin.last_name}".strip()
        return None
    
    def get_deleted_by(self, obj):
        if obj.deletedBy:
            return f"{obj.deletedBy.first_name} {obj.deletedBy.last_name}".strip()
        return None
    

class FormSubmissionShareSerializer(serializers.Serializer):
    users = serializers.ListField(child=serializers.IntegerField(), required=False)
    groups = serializers.ListField(child=serializers.IntegerField(), required=False)
    location_leaders = serializers.ListField(child=serializers.IntegerField(), required=False)    


class FormAutoShareConfigSerializer(serializers.ModelSerializer):
    users = serializers.PrimaryKeyRelatedField(many=True, queryset=CustomUser.objects.all(), required=False)
    groups = serializers.PrimaryKeyRelatedField(many=True, queryset=Groups.objects.all(), required=False)
    location_leaders = serializers.PrimaryKeyRelatedField(many=True, queryset=CustomUser.objects.all(), required=False)

    class Meta:
        model = FormAutoShareConfig
        fields = ['users', 'groups', 'location_leaders']

class FormToggleSerializer(serializers.ModelSerializer):
    auto_share_config = FormAutoShareConfigSerializer(required=False)

    class Meta:
        model = Form
        fields = [
            'trigger_email_notifications',
            'share_response',
            'allow_editing',
            'can_edit_previous_state',
            'auto_share_response',
            'auto_share_config',
        ]

    def update(self, instance, validated_data):
        auto_share_config_data = validated_data.pop('auto_share_config', None)
        instance.trigger_email_notifications = validated_data.get(
            'trigger_email_notifications',
            instance.trigger_email_notifications,
        )
        raw_auto_share_config_data = self.initial_data.get('auto_share_config')
        instance.share_response = validated_data.get('share_response', instance.share_response)
        instance.allow_editing = validated_data.get('allow_editing', instance.allow_editing)
        instance.can_edit_previous_state = validated_data.get('can_edit_previous_state', instance.can_edit_previous_state)
        instance.auto_share_response = validated_data.get('auto_share_response', instance.auto_share_response)
        instance.save()

        if auto_share_config_data is not None:
            config, created = FormAutoShareConfig.objects.get_or_create(form=instance, organization=instance.organization)
            if 'users' in auto_share_config_data:
                config.users.set(auto_share_config_data['users'])
            if 'groups' in auto_share_config_data:
                config.groups.set(auto_share_config_data['groups'])
            leader_values = None
            if isinstance(raw_auto_share_config_data, dict) and 'location_leaders' in raw_auto_share_config_data:
                leader_values = raw_auto_share_config_data.get('location_leaders') or []
            elif 'location_leaders' in auto_share_config_data:
                leader_values = auto_share_config_data.get('location_leaders') or []

            if leader_values is not None:
                direct_users = CustomUser.objects.filter(
                    id__in=leader_values,
                    organization=instance.organization,
                    role__name='location_leader'
                )
                direct_user_ids = set(direct_users.values_list('id', flat=True))
                remaining_ids = [leader_id for leader_id in leader_values if leader_id not in direct_user_ids]
                location_leader_user_ids = list(
                    LocationLeader.objects.filter(
                        id__in=remaining_ids,
                        organization=instance.organization
                    ).values_list('user_id', flat=True)
                )
                resolved_users = CustomUser.objects.filter(
                    id__in=list(direct_user_ids.union(location_leader_user_ids)),
                    organization=instance.organization
                )
                config.location_leaders.set(resolved_users)
                logger.info(
                    "FormToggleSerializer saved location leaders for form %s: raw_ids=%s resolved_user_ids=%s",
                    instance.id,
                    leader_values,
                    list(resolved_users.values_list('id', flat=True)),
                )
            config.save()

        return instance
    
class FormAnswerEditSerializer(serializers.Serializer):
    form = serializers.IntegerField(required=True)
    form_submission_id = serializers.IntegerField(required=True)
    stage = serializers.IntegerField(required=False)  # Optional for can_edit_previous_state
    stage_id = serializers.IntegerField(required=False)  # Mobile compatibility fallback
    answers = serializers.ListField(child=AnswerSerializer(many=False, partial=True), required=True)

    def validate(self, attrs):
        form_id = attrs.get('form')
        form_submission_id = attrs.get('form_submission_id')
        stage_id = attrs.get('stage') or attrs.get('stage_id')
        stage = None

        # Fetch form and submission
        form = get_object_or_404(Form, id=form_id, organization=self.context['request'].user.organization)
        submission = get_object_or_404(FormSubmision, id=form_submission_id, form=form)

        # Validate toggle permissions
        if form.allow_editing:
            # Last completer can edit any stage after completion
            if not submission.is_completed or self.context['request'].user != submission.completed_by:
                raise serializers.ValidationError("Only the last completer can edit after completion.")
        elif form.can_edit_previous_state:
            # Current stage user can edit previous stages
            if stage_id:
                stage = get_object_or_404(Stage, id=stage_id, form=form)
                # Check if user is assigned to or completed a stage >= current stage
                user_max_order = 0
                user_histories = StageSubmissionHistory.objects.filter(
                    form_submission=submission,
                    completed_by=self.context['request'].user
                ).aggregate(max_order=Max('stage_order'))
                if user_histories['max_order']:
                    user_max_order = max(user_max_order, user_histories['max_order'])
                user_assignments = StageAssignment.objects.filter(
                    form_submission=submission,
                    user=self.context['request'].user,
                    is_assignment_fullfilled=False
                ).aggregate(max_order=Max('stage_order'))
                if user_assignments['max_order']:
                    user_max_order = max(user_max_order, user_assignments['max_order'])
                if user_max_order < stage.order:
                    raise serializers.ValidationError("You can only edit previous or current stages.")
            else:
                raise serializers.ValidationError("Stage ID is required for can_edit_previous_state.")
        else:
            raise serializers.ValidationError("Editing is not allowed for this form.")

        attrs['form_instance'] = form
        attrs['submission_instance'] = submission
        attrs['stage_instance'] = stage
        return attrs   


# serializers.py
class FormResponseSummarySerializer(serializers.ModelSerializer):
    form_id = serializers.IntegerField(source='form.id')
    form_title = serializers.CharField(source='form.title')
    form_type = serializers.CharField(source='form.form_type')
    shared_by = serializers.SerializerMethodField()
    shared_on = serializers.SerializerMethodField()

    class Meta:
        model = FormSubmision
        fields = ['form_id', 'form_title', 'form_type', 'shared_by', 'shared_on']

    def get_shared_by(self, obj):
        share = FormResponseShare.objects.filter(form_submission=obj).first()
        return f"{share.shared_by.first_name} {share.shared_by.last_name}".strip() or share.shared_by.username if share else 'Not Shared'

    def get_shared_on(self, obj):
        share = FormResponseShare.objects.filter(form_submission=obj).first()
        return share.shared_on if share else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['form_submission_id'] = instance.id  # Rename 'id' to 'form_submission_id'
        return data         


    def update(self, instance, validated_data):
        instance.share_response = validated_data.get('share_response', instance.share_response)
        instance.allow_editing = validated_data.get('allow_editing', instance.allow_editing)
        instance.can_edit_previous_state = validated_data.get('can_edit_previous_state', instance.can_edit_previous_state)
        instance.auto_share_response = validated_data.get('auto_share_response', instance.auto_share_response)
        instance.save()
        return instance

class FollowUpTaskSerializer(serializers.ModelSerializer):
    task_close_questions = LogicFollowUpQuestionSerializer(many=True, required=False)
    assigned_user = serializers.PrimaryKeyRelatedField(many=True, queryset=CustomUser.objects.all(), required=False)
    assigned_group = serializers.PrimaryKeyRelatedField(many=True, queryset=Groups.objects.all(), required=False)
    assigned_form_for_task = serializers.SerializerMethodField()

    class Meta:
        model = FollowUpTask
        fields = '__all__'
        read_only_fields = ('created_by', 'updated_by', 'organization', 'status')

    def get_assigned_form_for_task(self, obj):
          # obj here is a FollowUpTask instance
          # We need to access its related Logic instance, then its related LogicFollowUp instance
          # Assuming there's only one LogicFollowUp instance per Logic (first())
          logic_follow_up = obj.logic.follow_ups.first()
          if logic_follow_up and logic_follow_up.assign_form:
              return logic_follow_up.assign_form.id # Return the ID of the assigned form
          return None

    @transaction.atomic
    def create(self, validated_data):
        assigned_users = validated_data.pop('assigned_user', [])
        assigned_groups = validated_data.pop('assigned_group', [])
        task_close_questions_data = validated_data.pop('task_close_questions', [])
        
        organization = self.context['request'].user.organization
        
        follow_up_task = FollowUpTask.objects.create(organization=organization, **validated_data)

        if assigned_users:
            follow_up_task.assigned_users.set(assigned_users)
        if assigned_groups:
            follow_up_task.assigned_group.set(assigned_groups)

        for question_data in task_close_questions_data:
            question_context = {
                'request': self.context['request'],
                'form': follow_up_task.form,
                'stage': follow_up_task.stage,
                'organization': organization,
                'is_task_close_question': True
            }
            question_serializer = LogicFollowUpQuestionSerializer(data=question_data, context=question_context)
            question_serializer.is_valid(raise_exception=True)
            question = question_serializer.save()
            follow_up_task.task_close_questions.add(question)
            
        return follow_up_task

    @transaction.atomic
    def update(self, instance, validated_data):
        assigned_users = validated_data.pop('assigned_user', None)
        assigned_groups = validated_data.pop('assigned_group', None)
        task_close_questions_data = validated_data.pop('task_close_questions', [])

        instance = super().update(instance, validated_data)

        if assigned_users is not None:
            instance.assigned_user.set(assigned_users)
        if assigned_groups is not None:
            instance.assigned_group.set(assigned_groups)

        instance.task_close_questions.clear()
        organization = self.context['request'].user.organization
        
        for question_data in task_close_questions_data:
            question_context = {
                'request': self.context['request'],
                'form': instance.form,
                'stage': instance.stage,
                'organization': organization,
                'is_task_close_question': True
            }
            question_serializer = LogicFollowUpQuestionSerializer(data=question_data, context=question_context)
            question_serializer.is_valid(raise_exception=True)
            question = question_serializer.save()
            instance.task_close_questions.add(question)

        return instance

class FollowUpTaskResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpTaskResponse 
        fields = '__all__'
        read_only_fields = ('created_by', 'updated_by', 'organization')

    def create(self, validated_data):
        task = validated_data['task']
        task.status = FollowUpTaskStatus.COMPLETED
        task.save()
        return super().create(validated_data)


# ============================================
# OPTIMIZED SERIALIZERS
# ============================================

class FormListSerializerOptimized(serializers.ModelSerializer):
    """
    OPTIMIZED VERSION of FormListSerializer
    
    Key Optimizations:
    - Uses annotated counts from queryset instead of SerializerMethodField
    - Reduces N+1 queries by using pre-fetched/annotated data
    - ForeignKey fields are accessed via select_related in the view
    
    Expected to reduce queries from 100+ to 3-5 queries for large datasets
    """
    stage_count = serializers.IntegerField(read_only=True)
    audit_group_count = serializers.IntegerField(read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    response_count = serializers.IntegerField(read_only=True)
    form_admin = serializers.SerializerMethodField()
    deleted_by = serializers.SerializerMethodField()
    folder = serializers.PrimaryKeyRelatedField(queryset=Folder.objects.all(), allow_null=True)
    is_disabled = serializers.BooleanField(read_only=True)
    status = serializers.CharField(read_only=True)
    
    class Meta:
        model = Form
        fields = [
            'id',
            'form_type',
            'title',
            'prefix',
            'GPS',
            'form_admin',
            'pass_percentage',
            'max_score',
            'created_at',
            'stage_count',
            'question_count',
            'folder',
            'response_count',
            'audit_group_count',
            'is_deleted',
            'deleted_by', 
            'is_disabled',
            'is_archived',
            'status'
        ]
    
    def get_form_admin(self, obj):
        """Optimized: Uses select_related data from queryset"""
        if obj.form_admin:
            return f"{obj.form_admin.first_name} {obj.form_admin.last_name}".strip() or obj.form_admin.username
        return None
    
    def get_deleted_by(self, obj):
        """Optimized: Uses select_related data from queryset"""
        if obj.deletedBy:
            return f"{obj.deletedBy.first_name} {obj.deletedBy.last_name}".strip() or obj.deletedBy.username
        return None


class FormPayloadFilesSerializer(serializers.ModelSerializer):
    form_admin = serializers.SerializerMethodField()
    class Meta:
        model = FormPayloadFiles
        fields = [
            "id",
            "form",
            "title",
            "form_admin",
            "organization",
            "file_path",
            "uploaded_on",
            "status",
            "error_message",
            "method",
            "created_at",
            "updated_at",
            "form_type"
        ]
        read_only_fields = ["uploaded_on", "created_at", "updated_at"]
    def get_form_admin(self, obj):
        """Optimized: Uses select_related data from queryset"""
        if obj.form_admin:
            return f"{obj.form_admin.first_name} {obj.form_admin.last_name}".strip() or obj.form_admin.username
        return None
