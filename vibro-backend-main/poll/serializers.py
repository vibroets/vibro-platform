from rest_framework import serializers
from user.models import CustomUser
from .models import Poll, PollQuestion, PollShare, PollResponse


class PollQuestionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = PollQuestion
        fields = ['id', 'question_text', 'question_type', 'options', 'required', 'order']


class PollSerializer(serializers.ModelSerializer):
    questions = PollQuestionSerializer(many=True)
    created_by_name = serializers.SerializerMethodField()
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id', 'title', 'description', 'category', 'poll_type', 'thumbnail',
            'start_date', 'end_date', 'anonymous', 'allow_multiple_responses',
            'organization', 'created_by', 'created_by_name', 'created_on',
            'is_active', 'questions', 'response_count'
        ]
        read_only_fields = ['created_by', 'created_on', 'organization']

    def get_response_count(self, obj):
        return PollResponse.objects.filter(poll=obj).values('user', 'submitted_on').distinct().count()

    def get_created_by_name(self, obj):
        first = obj.created_by.first_name or ""
        last = obj.created_by.last_name or ""
        full = f"{first} {last}".strip()
        return full or obj.created_by.username or obj.created_by.email

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        poll = Poll.objects.create(**validated_data)
        for idx, q in enumerate(questions_data):
            q.pop('id', None)
            PollQuestion.objects.create(poll=poll, order=idx, **q)
        return poll

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        existing_ids = []
        for idx, q in enumerate(questions_data):
            q_id = q.get('id')
            q.pop('id', None)
            if q_id and PollQuestion.objects.filter(id=q_id, poll=instance).exists():
                PollQuestion.objects.filter(id=q_id).update(order=idx, **q)
                existing_ids.append(q_id)
            else:
                new_q = PollQuestion.objects.create(poll=instance, order=idx, **q)
                existing_ids.append(new_q.id)

        instance.questions.exclude(id__in=existing_ids).delete()
        return instance


class PollShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollShare
        fields = ['id', 'poll', 'sent_to_user', 'sent_to_group', 'sent_to_location', 'share_status', 'sent_timestamp']


class PollResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollResponse
        fields = ['id', 'poll', 'user', 'question', 'answer_text', 'answer_value', 'answer_options', 'submitted_on']
        read_only_fields = ['user', 'submitted_on']


class PollMobileSerializer(serializers.ModelSerializer):
    questions = PollQuestionSerializer(many=True)
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id', 'title', 'description', 'category', 'poll_type', 'thumbnail',
            'start_date', 'end_date', 'anonymous', 'allow_multiple_responses',
            'created_on', 'is_active', 'questions', 'is_completed'
        ]

    def get_is_completed(self, obj):
        # Per-user completion is tracked via PollResponse (the user is stored
        # even for anonymous polls). share_status can't be used because
        # group/location shares are a single row shared by all members.
        user_id = self.context.get('user_id')
        if user_id:
            return PollResponse.objects.filter(poll=obj, user_id=user_id).exists()
        return False
