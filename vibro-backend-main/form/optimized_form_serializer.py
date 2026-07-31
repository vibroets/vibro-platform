from rest_framework import serializers
from django.db import transaction
from .models import (
    Form, Stage, AuditInfo, Question, Option,
    AuditGroup, StageAccess, FormType, StageAccessType
)
import uuid


class StageWriteSerializer(serializers.ModelSerializer):
    questions = serializers.ListField(child=serializers.DictField(), required=False)
    stage_access = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = Stage
        fields = ['id', 'name', 'stage_uuid', 'order', 'is_completed', 'questions', 'stage_access']
        read_only_fields = ['id', 'stage_uuid']

    def _bulk_create_stage_access(self, stage, access_list, form, organization):
        if not access_list:
            return
        to_create = []
        for item in access_list:
            access_type = item.get('access_type')
            allow_user = item.get('allow_user')
            allow_group = item.get('allow_group')
            allow_stage = item.get('allow_stage')

            if access_type == StageAccessType.USER and not allow_user:
                raise serializers.ValidationError("allow_user is required when access_type is USER.")
            if access_type == StageAccessType.GROUP and not allow_group:
                raise serializers.ValidationError("allow_group is required when access_type is GROUP.")
            if access_type == StageAccessType.PREVIOUS_STAGE and not allow_stage:
                raise serializers.ValidationError("allow_stage is required when access_type is PREVIOUS_STAGE.")

            obj = StageAccess(
                access_type=access_type,
                allow_stage=allow_stage,
                form=form,
                stage=stage,
                stage_approvals=item.get('stage_approvals', False),
            )
            if allow_user is not None:
                obj.allow_user_id = allow_user if isinstance(allow_user, int) else getattr(allow_user, 'id', None)
            if allow_group is not None:
                obj.allow_group_id = allow_group if isinstance(allow_group, int) else getattr(allow_group, 'id', None)
            to_create.append(obj)

        if to_create:
            StageAccess.objects.bulk_create(to_create, ignore_conflicts=True)

    def _bulk_create_questions_and_options(self, questions_list, stage, form, organization):
        if not questions_list:
            return []
        parents = [q for q in questions_list if not q.get('parent_question')]
        children = [q for q in questions_list if q.get('parent_question')]

        parent_objs = []
        for q in parents:
            q_uuid = q.get('question_uuid') or str(uuid.uuid4())
            parent_objs.append(Question(
                form=form, stage=stage, question_uuid=q_uuid, question=q.get('question', ''),
                question_type=q.get('question_type'), order=q.get('order', 1),
                organization=organization,
                remarks=q.get('remarks')
            ))
        if parent_objs:
            Question.objects.bulk_create(parent_objs)
        parent_uuid_to_id = {
            q.question_uuid: q.id
            for q in Question.objects.filter(form=form, stage=stage,
                                             question_uuid__in=[x.question_uuid for x in parent_objs])
        }

        child_objs = []
        for q in children:
            parent_ref = q.get('parent_question')
            parent_id = parent_uuid_to_id.get(parent_ref) if not isinstance(parent_ref, int) else parent_ref
            child_objs.append(Question(
                form=form, stage=stage,
                parent_question_id=parent_id,
                question_uuid=q.get('question_uuid') or str(uuid.uuid4()),
                question=q.get('question', ''), question_type=q.get('question_type'),
                order=q.get('order', 1), organization=organization,
                remarks=q.get('remarks')
            ))
        if child_objs:
            Question.objects.bulk_create(child_objs)

        all_uuids = [q.get('question_uuid') for q in questions_list if q.get('question_uuid')]
        q_map = {q.question_uuid: q.id for q in Question.objects.filter(form=form, stage=stage,
                                                                       question_uuid__in=all_uuids)}

        option_objs = []
        for q in questions_list:
            q_id = q_map.get(q.get('question_uuid'))
            if not q_id:
                continue
            for idx, opt in enumerate(q.get('options', []), start=1):
                option_objs.append(Option(
                    option=opt.get('option', ''), question_id=q_id, form_id=form.id,
                    stage_id=stage.id, score=opt.get('score'),
                    order=opt.get('order', idx), organization=organization,
                ))
        if option_objs:
            Option.objects.bulk_create(option_objs, ignore_conflicts=True)
        return Question.objects.filter(form=form, stage=stage)

    @transaction.atomic
    def create(self, validated_data):
        form = self.context.get('form')
        organization = self.context.get('organization')
        questions_list = validated_data.pop('questions', [])
        access_list = validated_data.pop('stage_access', [])
        validated_data.setdefault('stage_uuid', str(uuid.uuid4()))

        stage = Stage.objects.create(form=form, organization=organization, **validated_data)
        self._bulk_create_stage_access(stage, access_list, form, organization)
        self._bulk_create_questions_and_options(questions_list, stage, form, organization)
        return stage

    @transaction.atomic
    def update(self, instance, validated_data):
        form = self.context.get('form', instance.form)
        organization = self.context.get('organization', instance.organization)
        questions_list = validated_data.pop('questions', [])
        access_list = validated_data.pop('stage_access', [])

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        # Replace access and questions for simplicity (much faster)
        if access_list:
            StageAccess.objects.filter(stage=instance).delete()
            self._bulk_create_stage_access(instance, access_list, form, organization)

        if questions_list:
            Question.objects.filter(stage=instance).delete()
            self._bulk_create_questions_and_options(questions_list, instance, form, organization)

        return instance


class AuditInfoSerializer(serializers.ModelSerializer):
    questions = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = AuditInfo
        fields = ["id", "name", "questions", "form"]
        read_only_fields = ["id", "form"]

    @transaction.atomic
    def create(self, validated_data):
        form = self.context.get("form")
        organization = self.context.get("organization")
        questions = validated_data.pop("questions", [])
        audit_info = AuditInfo.objects.create(form=form, organization=organization, **validated_data)
        if questions:
            StageWriteSerializer()._bulk_create_questions_and_options(questions, None, form, organization)
        return audit_info

    @transaction.atomic
    def update(self, instance, validated_data):
        questions = validated_data.pop("questions", [])
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if questions:
            Question.objects.filter(audit_info=instance).delete()
            StageWriteSerializer()._bulk_create_questions_and_options(questions, None, instance.form, instance.organization)
        return instance


class AuditGroupSerializer(serializers.ModelSerializer):
    questions = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = AuditGroup
        fields = ["id", "name", "order", "questions", "form"]
        read_only_fields = ["id", "form"]

    @transaction.atomic
    def create(self, validated_data):
        form = self.context.get("form")
        organization = self.context.get("organization")
        questions = validated_data.pop("questions", [])
        group = AuditGroup.objects.create(form=form, organization=organization, **validated_data)
        if questions:
            StageWriteSerializer()._bulk_create_questions_and_options(questions, None, form, organization)
        return group

    @transaction.atomic
    def update(self, instance, validated_data):
        questions = validated_data.pop("questions", [])
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if questions:
            Question.objects.filter(audit_group=instance).delete()
            StageWriteSerializer()._bulk_create_questions_and_options(questions, None, instance.form, instance.organization)
        return instance


class OptimizedFormSerializer(serializers.ModelSerializer):
    stages = StageWriteSerializer(many=True, required=False)
    audit_info = AuditInfoSerializer(many=False, required=False)
    audit_group = AuditGroupSerializer(many=True, required=False)

    class Meta:
        model = Form
        fields = "__all__"
        extra_kwargs = {'organization': {'read_only': True}}

    @transaction.atomic
    def create(self, validated_data):
        stages_data = validated_data.pop('stages', [])
        audit_info_data = validated_data.pop('audit_info', {})
        audit_groups_data = validated_data.pop('audit_group', [])
        user = self.context['request'].user
        organization = user.organization

        form = Form.objects.create(organization=organization, **validated_data)

        for s in stages_data:
            serializer = StageWriteSerializer(data=s, context={"form": form, "organization": organization})
            serializer.is_valid(raise_exception=True)
            serializer.save()

        if validated_data.get("form_type") == FormType.AUDIT:
            if audit_info_data:
                audit_info_serializer = AuditInfoSerializer(data=audit_info_data,
                    context={"form": form, "organization": organization})
                audit_info_serializer.is_valid(raise_exception=True)
                audit_info_serializer.save()

            for g in audit_groups_data:
                group_serializer = AuditGroupSerializer(data=g,
                    context={"form": form, "organization": organization})
                group_serializer.is_valid(raise_exception=True)
                group_serializer.save()

        return form

    @transaction.atomic
    def update(self, instance, validated_data):
        stages_data = validated_data.pop('stages', [])
        audit_info_data = validated_data.pop('audit_info', {})
        audit_groups_data = validated_data.pop('audit_group', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        organization = instance.organization

        # Update stages: replace for simplicity (much faster)
        if stages_data:
            Stage.objects.filter(form=instance).delete()
            for s in stages_data:
                serializer = StageWriteSerializer(data=s, context={"form": instance, "organization": organization})
                serializer.is_valid(raise_exception=True)
                serializer.save()

        # Update audit info and groups
        if instance.form_type == FormType.AUDIT:
            if audit_info_data:
                if instance.audit_info.exists():
                    instance.audit_info.all().delete()
                audit_info_serializer = AuditInfoSerializer(
                    data=audit_info_data, context={"form": instance, "organization": organization})
                audit_info_serializer.is_valid(raise_exception=True)
                audit_info_serializer.save()

            if audit_groups_data:
                AuditGroup.objects.filter(form=instance).delete()
                for g in audit_groups_data:
                    group_serializer = AuditGroupSerializer(
                        data=g, context={"form": instance, "organization": organization})
                    group_serializer.is_valid(raise_exception=True)
                    group_serializer.save()

        return instance
