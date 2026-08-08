import Accordion from '@/components/form/Accordion/Accordion';
import FormField from '@/components/form/FormFields/FormField';
import { Question, Stage } from '@/components/form/types/formTypes';
import StatusBadge from '@/components/StatusBadge';
import api, { get as apiGet, patch as apiPatch } from '@/services';
import { GETFORMSUBMISSIONDETAILS } from '@/services/constants';
import { RootState } from '@/store';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { extractLocationSearchText, hasLocationQuestion } from './tabs-todo/locationFilterUtils';

interface ActivityLog {
  id: number;
  action: string;
  action_by: {
    id: number;
    name: string;
  };
  action_to?: {
    id: number;
    name: string;
  };
  created_at: string;
}

interface TaskDetails {
  id: number;
  task_name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  derived_status?: string;
  parent_question?: string;
  activity_logs: ActivityLog[];
  form?: number;
  followup_task_form_id?: number;
  assigned_form_id?: number;
  can_reopen?: boolean;
  reopened_remarks?: string | null;
    created_by?: number | { id?: number };
  created_by_id?: number;
  submission_initiated_by?: number;
  initiated_by?: number;
  assignee_names?: { type: string; id: number; name: string }[];
  main_form_submission_id?: number | string | null;
  main_form_location?: string | null;
  is_auto_closed?: boolean;
}

type TaskCloseQuestion = Question & { answer?: string };

interface FollowupFormAnswer {
  form_id: number;
  form_title: string;
  submission_id: number;
}

interface CompletionMeta {
  completedByName: string | null;
  completedOn: string | null;
  editedByName?: string | null;
  editedOn?: string | null;
}

interface ReopenModalProps {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  onReopenSuccess: (remarks: string) => Promise<void> | void;
  disabled?: boolean;
}

const ReopenModal: React.FC<ReopenModalProps> = ({ visible, onClose, taskId, onReopenSuccess, disabled }) => {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReopen = async () => {
    if (!remarks.trim()) {
      Alert.alert('Error', 'Please enter a reason for reopening');
      return;
    }

    if (isSubmitting || disabled) return;
    setIsSubmitting(true);
    try {
      await onReopenSuccess(remarks);
      setRemarks('');
      onClose();
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Reopen Task</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalSubtitle}>
            Please provide a reason for reopening this task
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Reason for Reopen</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter the reason..."
              placeholderTextColor="#999"
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (isSubmitting || disabled) && styles.submitButtonDisabled,
              ]}
              onPress={handleReopen}
              disabled={isSubmitting || disabled}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Reopening...' : 'Reopen Task'}
              </Text>
            </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default function SentTaskSummaryScreen() {
  const { taskId, formId, submissionId, canReopen: canReopenParam, isTaskClose: isTaskCloseParam } = useLocalSearchParams<{ 
    taskId: string; 
    formId?: string;
    submissionId?: string;
    canReopen?: string;
    isTaskClose?: string;
  }>();

  // DEBUG: Log received params
  React.useEffect(() => {
  }, [taskId, formId, submissionId, canReopenParam, isTaskCloseParam]);

  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [localActivities, setLocalActivities] = useState<ActivityLog[]>([]);
  const [taskCloseQuestions, setTaskCloseQuestions] = useState<TaskCloseQuestion[]>([]);
  const [followupFormAnswers, setFollowupFormAnswers] = useState<FollowupFormAnswer[]>([]);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [taskCloseAnswers, setTaskCloseAnswers] = useState<Record<number | string, string>>({});
  const [showFollowupFormModal, setShowFollowupFormModal] = useState(false);
  const [showTaskCloseAnswersModal, setShowTaskCloseAnswersModal] = useState(false);
  const [reopeningTask, setReopeningTask] = useState(false);
  const [followupFormData, setFollowupFormData] = useState<any>(null);
  const [followupFormLoading, setFollowupFormLoading] = useState(false);
  const [followupFormStages, setFollowupFormStages] = useState<Stage[]>([]);
  const [followupFormTitle, setFollowupFormTitle] = useState('');
  const [mainFormTitle, setMainFormTitle] = useState<string | null>(null);
  const [mainFormLocation, setMainFormLocation] = useState<string | null>(null);
  const [taskCloseCompletionMeta, setTaskCloseCompletionMeta] = useState<CompletionMeta>({
    completedByName: null,
    completedOn: null,
  });
  const [followupCompletionMeta, setFollowupCompletionMeta] = useState<CompletionMeta>({
    completedByName: null,
    completedOn: null,
  });
  const currentUserId = useSelector((state: RootState) => state.user?.id);
  const {
    control: taskCloseControl,
    formState: { errors: taskCloseErrors },
    watch: taskCloseWatch,
    setValue: setTaskCloseValue,
    reset: resetTaskCloseForm,
  } = useForm({ mode: 'onSubmit' });

  const normalizeQuestionType = useCallback((rawType: any) => {
    const normalized = String(rawType || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (normalized === "checkbox" || normalized === "check_box" || normalized === "check_boxes") return "checkboxes";
    if (normalized === "multiplechoice" || normalized === "multiple_choice") return "multiple_choice";
    if (normalized === "linearscale" || normalized === "linear_scale") return "linear_scale";
    if (normalized === "shortanswer" || normalized === "short_answer") return "short_answer";
    if (normalized === "longanswer" || normalized === "long_answer") return "long_answer";
    if (normalized === "titleanddescription" || normalized === "title_and_description") return "title_and_description";
    if (normalized === "qrcode" || normalized === "qr_code") return "qr_code";
    if (normalized === "uploadimage" || normalized === "upload_image") return "upload_image";
    if (normalized === "uploadvideo" || normalized === "upload_video") return "upload_video";
    if (normalized === "uploadaudio" || normalized === "upload_audio") return "upload_audio";
    if (normalized === "uploadfile" || normalized === "upload_file") return "upload_file";
    return normalized;
  }, []);

  const normalizeQuestion = useCallback((input: any) => {
    if (!input || typeof input !== "object") return input;
    const base = input.question && typeof input.question === "object" ? input.question : input;
    const parseMaybeArray = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            return JSON.parse(trimmed);
          } catch {
            try {
              const normalized = trimmed
                .replace(/'/g, '"')
                .replace(/\bNone\b/g, 'null')
                .replace(/\bTrue\b/g, 'true')
                .replace(/\bFalse\b/g, 'false');
              const parsed = JSON.parse(normalized);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
        }
      }
      return [];
    };

    const rawOptionsCandidate =
      base.options ?? base.option ?? base.choices ?? base.choice ?? base.option_set ?? [];
    const rawOptions = Array.isArray(rawOptionsCandidate)
      ? rawOptionsCandidate
      : parseMaybeArray(rawOptionsCandidate);
    const options = rawOptions.map((opt: any, index: number) => {
      if (opt == null) return opt;
      if (typeof opt === "string" || typeof opt === "number") {
        return { id: index + 1, option: String(opt), order: index + 1 };
      }
      if (typeof opt === "object") {
        const optionText = opt.option ?? opt.label ?? opt.value ?? opt.name;
        return { ...opt, option: optionText ?? opt.option };
      }
      return opt;
    });
    const logics = Array.isArray(base.logics) ? base.logics : [];
    const subQuestions = Array.isArray(base.sub_questions) ? base.sub_questions : [];
    return {
      ...base,
      question_type: normalizeQuestionType(base.question_type),
      options,
      logics,
      sub_questions: subQuestions,
    };
  }, [normalizeQuestionType]);

  useEffect(() => {
    if (!taskCloseQuestions.length) return;
    const defaults: Record<string, any> = {};
    taskCloseQuestions.filter(q => q).forEach((question) => {
      const uuid = (question as any).question_uuid;
      const questionId = Number(question.id);
      const questionType = (question as any).question_type;

      if (!uuid && !questionId) return;

      // Try to find answer using both uuid and numeric id
      let answerValue =
        (uuid && taskCloseAnswers[uuid]) ||
        (uuid && taskCloseAnswers[uuid.toString()]) ||
        (questionId && taskCloseAnswers[questionId]) ||
        (questionId && taskCloseAnswers[questionId.toString()]);

      // Fallback to embedded answer
      if (!answerValue) {
        answerValue =
          (question as any).answer ??
          (question as any).answers?.answer ??
          undefined;
      }

      const fieldKey = uuid || String(questionId);
      const options = Array.isArray((question as any).options) ? (question as any).options : [];

      const normalizeIds = (val: any): number[] => {
        if (val == null) return [];
        if (Array.isArray(val)) {
          return val
            .map((item) => {
              if (item == null) return null;
              if (typeof item === 'object') {
                return item.id ?? item.option_id ?? item.value ?? item.answer_id ?? item.answer ?? item.option;
              }
              return item;
            })
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v));
        }
        if (typeof val === 'string') {
          const parts = val.split(/[|,]/).map((p) => p.trim()).filter(Boolean);
          return parts.map((p) => Number(p)).filter((v) => Number.isFinite(v));
        }
        const num = Number(val);
        return Number.isFinite(num) ? [num] : [];
      };

      const mapTextToIds = (val: any): number[] => {
        if (!options.length || val == null) return [];
        const toTexts = (v: any): string[] => {
          if (v == null) return [];
          if (Array.isArray(v)) {
            return v
              .map((item) => {
                if (item == null) return null;
                if (typeof item === 'object') {
                  return item.option ?? item.label ?? item.value ?? item.name ?? item.answer;
                }
                return item;
              })
              .filter((t) => typeof t === 'string' && t.trim())
              .map((t) => t.trim());
          }
          if (typeof v === 'string') {
            return v.split(/[|,]/).map((t) => t.trim()).filter(Boolean);
          }
          if (typeof v === 'object') {
            const text = v.option ?? v.label ?? v.value ?? v.name ?? v.answer;
            return text ? [String(text).trim()] : [];
          }
          return [];
        };
        const texts = toTexts(val).map((t) => t.toLowerCase());
        if (!texts.length) return [];
        return options
          .filter((opt: any) => texts.includes(String(opt.option ?? '').toLowerCase()))
          .map((opt: any) => Number(opt.id))
          .filter((id: number) => Number.isFinite(id));
      };

      const buildOptionObjects = (ids: number[]) => {
        return ids
          .map((id: number) => {
            const opt = options.find((o: any) => Number(o.id) === Number(id));
            return opt ? { id: opt.id, option: opt.option } : null;
          })
          .filter(Boolean);
      };

      if (answerValue !== undefined) {
        const coerced = coerceAnswerValue(answerValue);
        if (questionType === 'checkboxes' || questionType === 'multiple_choice') {
          let ids = normalizeIds(coerced);
          if (!ids.length) {
            ids = mapTextToIds(coerced);
          }
          const optionObjects = buildOptionObjects(ids);
          defaults[fieldKey] = optionObjects;
        } else if (questionType === 'dropdown') {
          const ids = normalizeIds(coerced);
          defaults[fieldKey] = ids[0] ?? coerced;
        } else {
          defaults[fieldKey] = coerced;
        }
      } else {
        const fieldKey = uuid || String(questionId);
      }
    });

    resetTaskCloseForm(defaults);
  }, [taskCloseQuestions, taskCloseAnswers, resetTaskCloseForm]);

  const getDisplayNameFromActor = (actor: any): string | null => {
    if (!actor) return null;
    if (typeof actor === 'string') return actor;
    if (typeof actor?.name === 'string' && actor.name.trim()) return actor.name.trim();
    const first = actor?.first_name || '';
    const last = actor?.last_name || '';
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return actor?.username || null;
  };

  const formatMetaDateTime = (value?: string | null): string => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString();
  };

  const normalizeAnswersArray = (answersData: any): any[] => {
    if (Array.isArray(answersData)) return answersData;
    if (answersData && Array.isArray(answersData.answers)) return answersData.answers;
    if (answersData && answersData.question_id) return [answersData];
    return [];
  };

  const applyAnswersToQuestions = (questions: TaskCloseQuestion[], answersData: any): TaskCloseQuestion[] => {
    const answersArray = normalizeAnswersArray(answersData);
    if (!answersArray.length) return questions;

    return questions.map((q) => {
      const qId = q?.id != null ? Number(q.id) : null;
      const qUuid = (q as any)?.question_uuid;
      const match = answersArray.find((ans: any) => {
        const ansId = ans?.question_id != null ? Number(ans.question_id) : null;
        const ansUuid = ans?.question_uuid;
        return (qId != null && ansId === qId) || (qUuid && ansUuid && qUuid === ansUuid);
      });
      if (!match) return q;

      const rawAnswerValue = match?.answer ?? match?.value ?? match?.answer_text ?? match?.response ?? match?.response_value;
      const questionType = String((q as any)?.question_type || '').toLowerCase();
      const normalizeChoiceAnswer = (val: any) => {
        if (val == null) return val;
        if (Array.isArray(val)) {
          const parts = val.map((item) => {
            if (item == null) return null;
            if (typeof item === 'object') {
              return item.id ?? item.option_id ?? item.value ?? item.answer_id ?? item.answer;
            }
            return item;
          }).filter((v) => v != null);
          return parts.join('|');
        }
        if (typeof val === 'object') {
          return val.id ?? val.option_id ?? val.value ?? val.answer_id ?? val.answer ?? val.label ?? val.name ?? val.text;
        }
        return val;
      };
      const coercedMatchValue = coerceAnswerValue(rawAnswerValue);
      const answerValue =
        questionType === 'checkboxes' || questionType === 'multiple_choice' || questionType === 'dropdown'
          ? normalizeChoiceAnswer(coercedMatchValue)
          : coercedMatchValue;
      const answerId = match?.answer_id ?? match?.option_id ?? match?.selected_option_id;
      const otherText = match?.other_text ?? match?.other_value;

      return {
        ...q,
        answer: answerValue ?? (q as any).answer,
        submitted_answer: answerValue ?? (q as any).submitted_answer,
        submitted_value: answerValue ?? (q as any).submitted_value,
        answers: {
          ...(q as any).answers,
          answer: answerValue,
          answer_id: answerId,
          other_text: otherText,
        },
      } as TaskCloseQuestion;
    });
  };

  const coerceAnswerValue = (value: any) => {
    if (value == null) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          try {
            const normalized = trimmed
              .replace(/'/g, '"')
              .replace(/\bNone\b/g, 'null')
              .replace(/\bTrue\b/g, 'true')
              .replace(/\bFalse\b/g, 'false');
            return JSON.parse(normalized);
          } catch {
            return value;
          }
        }
      }
      return value;
    }
    return value;
  };

  const normalizeChoiceAnswer = (val: any) => {
    if (val == null) return val;
    if (Array.isArray(val)) {
      const parts = val
        .map((item) => {
          if (item == null) return null;
          if (typeof item === 'object') {
            return item.id ?? item.option_id ?? item.value ?? item.answer_id ?? item.answer;
          }
          return item;
        })
        .filter((v) => v != null);
      return parts.join('|');
    }
    if (typeof val === 'object') {
      return val.id ?? val.option_id ?? val.value ?? val.answer_id ?? val.answer ?? val.label ?? val.name ?? val.text;
    }
    return val;
  };

  const injectTaskCloseAnswer = (question: TaskCloseQuestion, answerMap: Record<number | string, string>) => {
    const qId = question?.id != null ? String(question.id) : '';
    const qUuid = (question as any)?.question_uuid ? String((question as any).question_uuid) : '';
    const raw =
      (qId && answerMap[qId]) ||
      (qUuid && answerMap[qUuid]) ||
      (question as any).answer ||
      (question as any).submitted_answer ||
      (question as any).submitted_value ||
      (question as any).answers?.answer;

    if (raw == null || raw === '') return question;

    const questionType = String((question as any)?.question_type || '').toLowerCase();
    const coerced = coerceAnswerValue(raw);
    let normalized: any =
      questionType === 'checkboxes' || questionType === 'multiple_choice' || questionType === 'dropdown'
        ? normalizeChoiceAnswer(coerced)
        : coerced;

    const options = Array.isArray((question as any).options) ? (question as any).options : [];
    const tryMapTextToId = (val: any): number | null => {
      if (!options.length || val == null) return null;
      const text = String(val).trim().toLowerCase();
      if (!text) return null;
      const found = options.find((opt: any) => String(opt.option ?? '').toLowerCase() === text);
      return found ? Number(found.id) : null;
    };

    if (questionType === 'multiple_choice' && typeof normalized === 'string') {
      const mappedId = tryMapTextToId(normalized);
      if (mappedId != null && Number.isFinite(mappedId)) {
        normalized = String(mappedId);
      }
    }

    const shouldSetAnswerId = questionType !== 'checkboxes';
    return {
      ...question,
      answer: normalized,
      submitted_answer: normalized,
      submitted_value: normalized,
      answers: {
        ...(question as any).answers,
        answer: normalized,
        ...(shouldSetAnswerId
          ? { answer_id: (question as any).answers?.answer_id ?? normalized }
          : {}),
      },
    };
  };

  const handleBackPress = useCallback(() => {
    router.back();
  }, []);

  useEffect(() => {
    fetchTaskDetails();
    fetchTaskCloseQuestions();
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        return true;
      });
      return () => backHandler.remove();
    }, [handleBackPress])
  );

  useEffect(() => {
    const loadMainFormTitle = async () => {
      const mainFormId = taskDetails?.followup_task_form_id;
      if (!mainFormId) {
        setMainFormTitle(null);
        setMainFormLocation(null);
        return;
      }
      try {
        const response = await api.get<any>(`/form/${mainFormId}/`);
        const payload = response?.data ?? response;
        const title = payload?.title || payload?.name || null;
        setMainFormTitle(title);

        // Prefer backend-provided location from task details
        if (taskDetails?.main_form_location) {
          setMainFormLocation(String(taskDetails.main_form_location));
          return;
        }

        const formHasLocation = hasLocationQuestion(payload);
        if (!formHasLocation) {
          setMainFormLocation(null);
          return;
        }

        // Fallback to fetch submission and extract location
        const submissionId = getMainFormSubmissionId(taskDetails);
        if (!submissionId) {
          setMainFormLocation(null);
          return;
        }

        try {
          const submissionResponse = await api.get<any>(`/form/response/${mainFormId}/${submissionId}`);
          const submissionData = submissionResponse?.data ?? submissionResponse;
          const locationText = extractLocationSearchText(submissionData);
          setMainFormLocation(locationText || null);
        } catch (err) {
          setMainFormLocation(null);
        }
      } catch {
        setMainFormTitle(null);
        setMainFormLocation(null);
      }
    };

    loadMainFormTitle();
  }, [taskDetails, taskDetails?.followup_task_form_id]);


  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await apiGet<TaskDetails>(`/tasks/${taskId}/`);
      setTaskDetails(response);
    } catch (error) {
      Alert.alert('Error', 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskCloseQuestions = async () => {
    try {
      // Use the correct endpoint from backend - /form/task-close-questions/ (Api service adds /api/ prefix)
      const questionsResponse = await api.get<any>(`/form/task-close-questions/${taskId}/`);
      const questions = questionsResponse.data?.questions || questionsResponse.data || [];
      const normalizedQuestions = Array.isArray(questions)
        ? questions.filter(q => q != null).map(normalizeQuestion)
        : [];

      normalizedQuestions.forEach((q: any) => {
      });
      
      setTaskCloseQuestions(normalizedQuestions);
      // If answers are embedded in the questions payload, capture them
      if (Array.isArray(questions) && questions.length > 0) {
        const embeddedAnswers: Record<number, string> = {};
        questions.forEach((q: any) => {
          const ans = q?.answer ?? q?.answers?.answer;
          if (ans != null && q?.id != null) {
            embeddedAnswers[Number(q.id)] = String(ans);
          }
        });
        if (Object.keys(embeddedAnswers).length > 0) {
          setTaskCloseAnswers(prev => ({ ...prev, ...embeddedAnswers }));
        }
      }

      // Fetch answers for task close questions using correct endpoint
      try {
        const answersResponse = await api.get<any>(`/form/task-close-questions/${taskId}/answers/`);
        const answersData = answersResponse.data || answersResponse;

        // Build answer maps keyed by both question_id and question_uuid
        const answersByQuestionId: Record<number, string> = {};
        const answersByQuestionUuid: Record<string, string> = {};

        // Handle different response formats
        if (Array.isArray(answersData)) {
          // Multiple answers array
          answersData.forEach((answer: any, idx: number) => {
            if (answer.question_id) {
              answersByQuestionId[answer.question_id] = answer.answer ?? answer.value ?? '';
            }
            if (answer.question_uuid) {
              answersByQuestionUuid[answer.question_uuid] = answer.answer ?? answer.value ?? '';
            }
          });
        } else if (answersData && answersData.question_id) {
          answersByQuestionId[answersData.question_id] = answersData.answer ?? answersData.value ?? '';
          if (answersData.question_uuid) {
            answersByQuestionUuid[answersData.question_uuid] = answersData.answer ?? answersData.value ?? '';
          }
        } else if (answersData && answersData.answers && Array.isArray(answersData.answers)) {
          // Nested answers array
          answersData.answers.forEach((answer: any, idx: number) => {
            if (answer?.question_id != null) {
              answersByQuestionId[answer.question_id] = answer?.answer ?? answer?.value ?? '';
            }
            if (answer?.question_uuid) {
              answersByQuestionUuid[answer.question_uuid] = answer?.answer ?? answer?.value ?? '';
            }
          });
        }

        setTaskCloseCompletionMeta({
          completedByName: getDisplayNameFromActor(answersData?.completed_by),
          completedOn: answersData?.completed_on || null,
          editedByName: answersData?.edited_by ? getDisplayNameFromActor(answersData?.edited_by) : null,
          editedOn: answersData?.edited_on || null,
        });

        // Store both maps for flexible lookup
        setTaskCloseAnswers(answersByQuestionId);
        setTaskCloseQuestions(prev => applyAnswersToQuestions(prev, answersData));
        setTaskCloseQuestions(prev => applyAnswersToQuestions(prev, answersData));

        // Also set form values directly using question_uuid keys
        if (Object.keys(answersByQuestionUuid).length > 0) {
          Object.entries(answersByQuestionUuid).forEach(([uuid, value]) => {
            setTaskCloseValue(uuid, value);
          });
        }
      } catch (e) {
      }

      // Fetch follow-up form submissions if formId exists
      // Followup task form is task.form (assigned form), not followup_task_form_id (main form)
      const effectiveFormId = taskDetails?.form || taskDetails?.assigned_form_id || formId;

      if (effectiveFormId && submissionId) {
        try {
          // Use GETFORMSUBMISSIONDETAILS constant: /form/response/{form_id}/{submission_id}/
          const formResponse = await api.get<any>(`${GETFORMSUBMISSIONDETAILS}${effectiveFormId}/${submissionId}`);
          const submissionData = formResponse.data || formResponse;
          const stages = normalizeStagesFromSubmission(submissionData);
          const title = getFormTitleFromSubmission(submissionData);
          const answerMap = buildAnswerMap(submissionData);
          const details = submissionData?.submissionsDetail || submissionData;
          setFollowupCompletionMeta({
            completedByName: getDisplayNameFromActor(details?.completed_by_details || details?.completed_by),
            completedOn: details?.completed_on || submissionData?.completed_on || null,
            editedByName: details?.edited_by || details?.edited_by_sr ? getDisplayNameFromActor(details?.edited_by_details || details?.edited_by) : null,
            editedOn: details?.edited_on || null,
          });
          setFollowupFormTitle(title);
          setFollowupFormStages(stages);
          setFollowupFormData({
            form_title: title,
            stages,
            answer_map: answerMap
          });

          // Populate followupFormAnswers
          setFollowupFormAnswers([{
            form_id: Number(effectiveFormId),
            form_title: getFormTitleFromSubmission(submissionData),
            submission_id: Number(submissionId)
          }]);

        } catch (e) {
          // If submission not found, try to get form details
          if (effectiveFormId) {
            try {
              const formDetailsResponse = await api.get<any>(`/form/${effectiveFormId}/`);
              const formTitle = formDetailsResponse.data.title || formDetailsResponse.data.name || 'Follow-up Form';
              const stages = formDetailsResponse.data.stages || [];
              setFollowupFormTitle(formTitle);
              setFollowupFormStages(stages);
              setFollowupFormData({
                form_title: formTitle,
                stages
              });
              setFollowupFormAnswers([{
                form_id: Number(effectiveFormId),
                form_title: formTitle,
                submission_id: Number(submissionId)
              }]);
            } catch (formErr) {
            }
          }
        }
      }
    } catch (error) {
    }
  };

  const handleReopenTask = async (remarks: string) => {
    if (!taskDetails) return;
    if (reopeningTask) return;

    try {
      setReopeningTask(true);

      await apiPatch(`/tasks/${taskId}/reopen/`, { remarks });

      await fetchTaskDetails();
      setShowReopenModal(false);
    } catch (error) {
    } finally {
      setReopeningTask(false);
    }
  };

  const handleOpenTaskCloseAnswers = async () => {
    // Fetch answers if not already fetched
    if (Object.keys(taskCloseAnswers).length === 0) {
      try {
        const answerResponse = await api.get<any>(`/form/task-close-questions/${taskId}/answers/`);
        const answerData = answerResponse.data || answerResponse;

        const answersByQuestionId: Record<number, string> = {};
        const answersByQuestionUuid: Record<string, string> = {};

        if (answerData && answerData.answers) {

          answerData.answers.forEach((answer: any, idx: number) => {
            if (answer.question_id) {
              answersByQuestionId[answer.question_id] = answer.answer ?? answer.value ?? '';
            }
            if (answer.question_uuid) {
              answersByQuestionUuid[answer.question_uuid] = answer.answer ?? answer.value ?? '';
            }
          });
        } else if (answerData && answerData.question_id) {
          // Single answer
          answersByQuestionId[answerData.question_id] = answerData.answer ?? answerData.value ?? '';
          if (answerData.question_uuid) {
            answersByQuestionUuid[answerData.question_uuid] = answerData.answer ?? answerData.value ?? '';
          }
        } else if (Array.isArray(answerData)) {

          answerData.forEach((answer: any, idx: number) => {
            if (answer.question_id) {
              answersByQuestionId[answer.question_id] = answer.answer ?? answer.value ?? '';
            }
            if (answer.question_uuid) {
              answersByQuestionUuid[answer.question_uuid] = answer.answer ?? answer.value ?? '';
            }
          });
        }

        setTaskCloseCompletionMeta({
          completedByName: getDisplayNameFromActor(answerData?.completed_by),
          completedOn: answerData?.completed_on || null,
        });

        setTaskCloseAnswers(answersByQuestionId);

        // Also set form values directly using question_uuid keys
        if (Object.keys(answersByQuestionUuid).length > 0) {
          Object.entries(answersByQuestionUuid).forEach(([uuid, value]) => {
            setTaskCloseValue(uuid, value);
          });
        }
      } catch (error) {
      }
    }
    setShowTaskCloseAnswersModal(true);
  };

  const handleOpenFollowupFormAnswers = async () => {
    setFollowupFormLoading(true);
    try {
      // Use correct endpoint: /form/response/{form_id}/{submission_id}/ (Api service adds /api/ prefix)
      const effectiveFormId = taskDetails?.form || taskDetails?.assigned_form_id || formId;
      if (effectiveFormId && submissionId) {
        const response = await api.get<any>(`/form/response/${effectiveFormId}/${submissionId}`);

        const submissionData = response.data || response;
        const stages = normalizeStagesFromSubmission(submissionData);
        const title = getFormTitleFromSubmission(submissionData);
        const answerMap = buildAnswerMap(submissionData);
        const details = submissionData?.submissionsDetail || submissionData;
        setFollowupCompletionMeta({
          completedByName: getDisplayNameFromActor(details?.completed_by_details || details?.completed_by),
          completedOn: details?.completed_on || submissionData?.completed_on || null,
        });
        setFollowupFormTitle(title);
        setFollowupFormStages(stages);
        setFollowupFormData({ form_title: title, stages, answer_map: answerMap });
      } else if (followupFormAnswers.length > 0) {
        const answer = followupFormAnswers[0];
        const response = await api.get<any>(`/form/response/${answer.form_id}/${answer.submission_id}`);
        const submissionData = response.data || response;
        const stages = normalizeStagesFromSubmission(submissionData);
        const title = getFormTitleFromSubmission(submissionData);
        const answerMap = buildAnswerMap(submissionData);
        const details = submissionData?.submissionsDetail || submissionData;
        setFollowupCompletionMeta({
          completedByName: getDisplayNameFromActor(details?.completed_by_details || details?.completed_by),
          completedOn: details?.completed_on || submissionData?.completed_on || null,
        });
        setFollowupFormTitle(title);
        setFollowupFormStages(stages);
        setFollowupFormData({ form_title: title, stages, answer_map: answerMap });
      }
    } catch (error) {
      // Try to get form details even if submission fails
      const effectiveFormId = taskDetails?.form || taskDetails?.assigned_form_id || formId;
      if (effectiveFormId) {
        try {
          const formDetailsResponse = await api.get<any>(`/form/${effectiveFormId}/`);
          const formTitle = formDetailsResponse.data.title || formDetailsResponse.data.name || 'Follow-up Form';
          const stages = formDetailsResponse.data.stages || [];
          setFollowupFormTitle(formTitle);
          setFollowupFormStages(stages);
          setFollowupFormData({ form_title: formTitle, stages });
        } catch (formErr) {
        }
      }
    } finally {
      setFollowupFormLoading(false);
      setShowFollowupFormModal(true);
    }
  };

  const handleTaskCloseAnswersClose = () => {
    setShowTaskCloseAnswersModal(false);
  };

  const handleFollowupFormClose = () => {
    setShowFollowupFormModal(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!taskDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Task not found</Text>
        <Text style={styles.debugText}>Task ID: {taskId}</Text>
      </View>
    );
  }

  const getMainFormSubmitterId = (task: TaskDetails | null): number | null => {
    if (!task) return null;
    const rawCreatedBy = task.created_by;
    if (typeof rawCreatedBy === 'number') return rawCreatedBy;
    if (rawCreatedBy && typeof rawCreatedBy === 'object' && typeof rawCreatedBy.id === 'number') {
      return rawCreatedBy.id;
    }
    if (typeof task.created_by_id === 'number') return task.created_by_id;
    if (typeof task.submission_initiated_by === 'number') return task.submission_initiated_by;
    if (typeof task.initiated_by === 'number') return task.initiated_by;
    const followupCreatedLog = (task.activity_logs || []).find((log) =>
      String(log?.action || '').toLowerCase() === 'followup_created'
    );
    if (typeof followupCreatedLog?.action_by?.id === 'number') {
      return followupCreatedLog.action_by.id;
    }
    return null;
  };

  const allActivities = [...localActivities, ...taskDetails.activity_logs];
  const assigneeLabel =
    Array.isArray(taskDetails.assignee_names) && taskDetails.assignee_names.length > 0
      ? taskDetails.assignee_names
          .map((a) => (a?.type === 'group' ? `Group: ${a.name}` : a?.name))
          .filter(Boolean)
          .join(', ')
      : null;
  const headerDescription = (taskDetails.description || '')
    .replace(/\[REOPENED:\s*[^\]]*\]/g, '')
    .trim();
  const statusDisplay = getStatusDisplay(taskDetails.status);

  // Check for completed activity in both local and server activities
  const completedActivityIndex = allActivities.findIndex(
    log => (log.action || '').toLowerCase() === 'followup_completed'
  );
  const isCompletedActivity = completedActivityIndex >= 0;

  // Check if there are task close questions
  const hasTaskCloseQuestionsData = taskCloseQuestions.length > 0;
  const hasTaskCloseAnswersData = Object.keys(taskCloseAnswers).length > 0;
  
  // Scenario detection: Check if this is scenario 1 or 2
  // Scenario 1: Task has follow-up form (from taskDetails or from formId param)
  // Scenario 2: Task has only task close questions (no follow-up form in taskDetails)
  const isTaskCloseSubmission = isTaskCloseParam === 'true';
  const hasFollowupFormFromTask = !!(taskDetails?.form || taskDetails?.assigned_form_id);
  const hasFollowupFormFromParams = !!formId && formId !== '';
  const hasFollowupForm = !isTaskCloseSubmission && (hasFollowupFormFromTask || hasFollowupFormFromParams);
  
  // Show answer tags only when a completion activity exists
  const showAnswersSection = isCompletedActivity;
  
  // Check if we should show reopen button
  const canReopenFlag = taskDetails.can_reopen || canReopenParam === 'true';
  // Keep Reopen visible after a completed cycle, but disable it when not completed
   const mainFormSubmitterId = getMainFormSubmitterId(taskDetails);
  const isMainFormSubmitter = !!currentUserId && !!mainFormSubmitterId && Number(currentUserId) === Number(mainFormSubmitterId);
  const shouldShowReopen = isMainFormSubmitter && (!!canReopenFlag || isCompletedActivity);
  const isReopenDisabled = reopeningTask || taskDetails.status !== 'completed';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
    <ScrollView style={styles.container}>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          <Text style={styles.backButtonText}>Back to Sent Items</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.boxContainer}>
        <View style={styles.header}>
          {taskDetails.parent_question && (
            <Text style={styles.parentQuestion}>{taskDetails.parent_question}</Text>
          )}

          <View style={styles.taskInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.taskTitle}>{taskDetails.task_name}</Text>
            </View>
            {headerDescription ? (
              <Text style={styles.taskDescription}>{headerDescription}</Text>
            ) : null}
            {taskDetails?.followup_task_form_id ? (
              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.mainFormText}>Main Form : {mainFormTitle || '-'}</Text>
                  <Text style={styles.mainFormText}>Location : {mainFormLocation || '-'}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.dateContainer}>
            <View style={styles.dateRow}>
              <View style={styles.dateTexts}>
                <Text style={styles.dateText}>
                  Start: {formatDate(taskDetails.start_date)}
                </Text>
                <Text style={styles.dateText}>
                  End: {formatDate(taskDetails.end_date)}
                </Text>
              </View>
                {shouldShowReopen && (
                  <TouchableOpacity
                    style={[styles.reopenButton, isReopenDisabled && styles.reopenButtonDisabled]}
                    onPress={() => setShowReopenModal(true)}
                    disabled={isReopenDisabled}
                  >
                    <Ionicons name="refresh-circle" size={20} color="#fff" />
                    <Text style={styles.reopenButtonText}>
                      {reopeningTask ? 'Reopening...' : 'Reopen'}
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status:</Text>
              <StatusBadge status={taskDetails.status} style={styles.statusBadge} />
              {taskDetails.is_auto_closed ? (
                <View style={{ backgroundColor: '#FEE2E2', marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '600' }}>Auto-Closed</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.boxContainer}>
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Activity Feed</Text>
          
          {allActivities.length === 0 ? (
            <Text style={styles.noActivityText}>No activities yet</Text>
          ) : (
            <View style={styles.activityList}>
              {allActivities.map((activity, index) => {
                const isCompletedActivity = (activity.action || '').toLowerCase() === 'followup_completed';
                
                  return (
                    <View key={`${activity.id}-${index}`}>
                      {/* Activity Item */}
                      <View style={styles.activityItem}>
                        <Ionicons
                          name={getActivityIcon(activity.action)}
                          size={24}
                          color={getActivityColor(activity.action)}
                          style={styles.activityIcon}
                        />
                        <View style={styles.activityContent}>
                          <View style={[styles.activityMessageCard, { backgroundColor: getActivityBgColor(activity.action) }]}>
                            <Text style={styles.activityMessage}>
                              {formatActivityMessage(activity, taskDetails.description, taskDetails.reopened_remarks)}
                            </Text>
                            {assigneeLabel && String(activity.action || '').toLowerCase() === 'followup_created' ? (
                              <Text style={styles.activitySubtext}>
                                Shared with: {assigneeLabel}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.activityTime}>
                            {new Date(activity.created_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      {/* Answer tags appear directly under the completed activity */}
                      {showAnswersSection && index === completedActivityIndex && (
                        <View style={styles.answersSection}>
                          <Text style={styles.answersSectionTitle}>Completed Answers</Text>
                          {hasTaskCloseQuestionsData && (
                            <View style={styles.answerTagBlock}>
                              <TouchableOpacity
                                style={styles.answerTag}
                                onPress={handleOpenTaskCloseAnswers}
                              >
                                <Ionicons name="checkbox" size={20} color="#FF9500" style={styles.tagIcon} />
                                <View style={styles.tagContent}>
                                  <Text style={styles.tagTitle}>Task Close Questions</Text>
                                  <Text style={styles.tagSubtitle}>
                                    {taskCloseQuestions.length} question{taskCloseQuestions.length === 1 ? '' : 's'} submitted
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                              </TouchableOpacity>
                              <Text style={styles.tagMetaText}>
                                Completed by: {taskCloseCompletionMeta.completedByName || 'N/A'}
                              </Text>
                              <Text style={styles.tagMetaText}>
                                Completed on: {formatMetaDateTime(taskCloseCompletionMeta.completedOn)}
                              </Text>
                              {taskCloseCompletionMeta.editedOn && (
                                <>
                                  <Text style={styles.tagMetaText}>
                                    Edited by: {taskCloseCompletionMeta.editedByName || 'N/A'}
                                  </Text>
                                  <Text style={styles.tagMetaText}>
                                    Edited on: {formatMetaDateTime(taskCloseCompletionMeta.editedOn)}
                                  </Text>
                                </>
                              )}
                            </View>
                          )}
                          {hasFollowupForm && (
                            <View style={styles.answerTagBlock}>
                              <TouchableOpacity
                                style={styles.answerTag}
                                onPress={handleOpenFollowupFormAnswers}
                              >
                                <Ionicons name="document-text" size={20} color="#007AFF" style={styles.tagIcon} />
                                <View style={styles.tagContent}>
                                  <Text style={styles.tagTitle}>Follow-up Form</Text>
                                  <Text style={styles.tagSubtitle}>
                                    {followupFormAnswers.length > 0
                                      ? 'Click to view submitted answers'
                                      : 'Loading form answers...'}
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                              </TouchableOpacity>
                              <Text style={styles.tagMetaText}>
                                Completed by: {followupCompletionMeta.completedByName || 'N/A'}
                              </Text>
                              <Text style={styles.tagMetaText}>
                                Completed on: {formatMetaDateTime(followupCompletionMeta.completedOn)}
                              </Text>
                              {followupCompletionMeta.editedOn && (
                                <>
                                  <Text style={styles.tagMetaText}>
                                    Edited by: {followupCompletionMeta.editedByName || 'N/A'}
                                  </Text>
                                  <Text style={styles.tagMetaText}>
                                    Edited on: {formatMetaDateTime(followupCompletionMeta.editedOn)}
                                  </Text>
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
        </View>
      </View>

        <ReopenModal
          visible={showReopenModal}
          onClose={() => setShowReopenModal(false)}
          taskId={taskId}
          onReopenSuccess={handleReopenTask}
          disabled={reopeningTask}
        />

      {/* Modal: Task Close Answers (View Only) */}
      <Modal
        visible={showTaskCloseAnswersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleTaskCloseAnswersClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleTaskCloseAnswersClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Task Close Answers</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            {taskCloseQuestions.filter(q => q).map((question) => {
              const hydratedQuestion = injectTaskCloseAnswer(question, taskCloseAnswers);
              const fieldName = (hydratedQuestion as any).question_uuid || String(hydratedQuestion.id);
              return (
                <View key={hydratedQuestion.id} style={styles.questionWrapper}>
                  <FormField
                    question={hydratedQuestion}
                    control={taskCloseControl}
                    errors={taskCloseErrors}
                    name={(hydratedQuestion as any).question_uuid || String(hydratedQuestion.id)}
                    isCompleted={true}
                    hasError={false}
                    isEditable={false}
                    visibleQuestions={new Set([(hydratedQuestion as any).question_uuid || String(hydratedQuestion.id)])}
                    validationErrors={{}}
                    allValues={taskCloseWatch()}
                    allQuestions={taskCloseQuestions}
                    setValue={setTaskCloseValue}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Follow-up Form Answers (View Only) */}
      <Modal
        visible={showFollowupFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleFollowupFormClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleFollowupFormClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Follow-up Form Answers</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            {followupFormLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading form answers...</Text>
              </View>
            ) : followupFormData ? (
              <>
                {/* Form Info */}
                <View style={styles.formInfoHeader}>
                  <Ionicons name="document-text" size={24} color="#007AFF" />
                  <Text style={styles.formInfoTitle}>{followupFormTitle || followupFormData.form_title || 'Follow-up Form'}</Text>
                </View>
                
                {followupFormStages.length > 0 ? (
                  <View style={styles.formAnswersSection}>
                    <Text style={styles.formAnswersTitle}>Submitted Answers</Text>
                    {followupFormStages.map((stage, stageIndex) => (
                      <Accordion
                        key={stage.id || `${stageIndex}`}
                        title={stage.name || `Stage ${stageIndex + 1}`}
                        isCompleted={!!stage.is_completed}
                      >
                        {(stage.questions || []).map((question) => {
                          const answerText = getQuestionAnswerText(question, followupFormData?.answer_map);
                          return (
                            <View key={question.question_uuid || `${stageIndex}-${question.id}`} style={styles.formAnswerCard}>
                              <Text style={styles.formQuestionText}>{question.question}</Text>
                              <View style={styles.formAnswerValue}>
                                <Text style={styles.formAnswerLabel}>Answer:</Text>
                                <Text style={styles.formAnswerText}>
                                  {answerText || 'No answer'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </Accordion>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noDataContainer}>
                    <Ionicons name="information-circle" size={48} color="#999" />
                    <Text style={styles.noDataText}>No form answers available</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noDataContainer}>
                <Ionicons name="document-text-outline" size={48} color="#999" />
                <Text style={styles.noDataText}>No form submissions found</Text>
                <Text style={styles.noDataSubtext}>Form ID: {formId}, Submission ID: {submissionId}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

const getFormTitleFromSubmission = (submissionData: any): string => {
  return (
    submissionData?.form_title ||
    submissionData?.title ||
    submissionData?.submissionsDetail?.form_title ||
    submissionData?.submissionsDetail?.form_name ||
    'Follow-up Form'
  );
};

const normalizeStagesFromSubmission = (submissionData: any): Stage[] => {
  if (!submissionData) return [];
  if (Array.isArray(submissionData?.stages)) return submissionData.stages;
  if (submissionData?.form_type === 'audit' && Array.isArray(submissionData?.audit_group)) {
    return submissionData.audit_group;
  }
  return [];
};

const getQuestionAnswerText = (question: Question, answerMap?: Record<string, string>): string => {
  if (!question) return '';

  const extractSubmittedAnswer = (q: any) => {
    let submittedAnswer = q.answer || q.value || q.submitted_value;

    if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '') && q.answers) {
      if (Array.isArray(q.answers) && q.answers.length > 0) {
        const firstAnswer = q.answers.find((entry: any) => entry != null) ?? q.answers[0];
        if (firstAnswer && typeof firstAnswer === 'object') {
          submittedAnswer =
            firstAnswer.answer ||
            firstAnswer.value ||
            firstAnswer.submitted_value ||
            firstAnswer;
        } else {
          submittedAnswer = firstAnswer;
        }
      } else if (typeof q.answers === 'object' && q.answers !== null) {
        submittedAnswer = q.answers.answer || q.answers.value || q.answers.submitted_value;
      }
    }

    if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '')) {
      if (q.submission_answer) {
        submittedAnswer = q.submission_answer;
      } else if (q.user_answer) {
        submittedAnswer = q.user_answer;
      } else if (q.response) {
        submittedAnswer = q.response;
      } else if (q.response_value) {
        submittedAnswer = q.response_value;
      }

      if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '') && q.answer_data) {
        submittedAnswer = q.answer_data.answer || q.answer_data.value;
      }

      if ((submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '') && q.data) {
        submittedAnswer = q.data.answer || q.data.value;
      }
    }

    return submittedAnswer;
  };

  const rawAnswerId = question.answers?.answer_id ?? '';
  const otherText = question.answers?.other_text ?? '';

  let rawAnswer: any = extractSubmittedAnswer(question);

  if ((rawAnswer === null || rawAnswer === undefined || rawAnswer === '') && answerMap) {
    const idKey = question.id != null ? String(question.id) : '';
    const uuidKey = question.question_uuid || '';
    const questionKey = question.question || '';
    const titleKey = question.title || '';
    const mapped =
      (idKey && answerMap[idKey]) ||
      (uuidKey && answerMap[uuidKey]) ||
      (questionKey && answerMap[questionKey]) ||
      (titleKey && answerMap[titleKey]);
    if (mapped != null && mapped !== '') {
      rawAnswer = mapped;
    }
  }

  const coerceAnswerValue = (value: any) => {
    if (value == null) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          try {
            const normalized = trimmed
              .replace(/'/g, '"')
              .replace(/\bNone\b/g, 'null')
              .replace(/\bTrue\b/g, 'true')
              .replace(/\bFalse\b/g, 'false');
            return JSON.parse(normalized);
          } catch {
            return value;
          }
        }
      }
      return value;
    }
    return value;
  };

  const mapOptionLabels = (answer: any, question: Question): string | null => {
    const options = Array.isArray(question.options) ? question.options : [];
    if (!options.length) return null;

    const normalizedAnswer = coerceAnswerValue(answer);
    const toIds = (val: any): number[] => {
      if (val == null) return [];
      if (Array.isArray(val)) {
        return val
          .map((item) => {
            if (item == null) return null;
            if (typeof item === 'object') {
              const id = item.id ?? item.option_id ?? item.value;
              return id != null ? Number(id) : null;
            }
            const num = Number(item);
            return Number.isFinite(num) ? num : null;
          })
          .filter((id): id is number => id != null);
      }
      if (typeof val === 'object') {
        const id = val.id ?? val.option_id ?? val.value;
        const num = Number(id);
        return Number.isFinite(num) ? [num] : [];
      }
      if (typeof val === 'string') {
        const parts = val.split(/[|,]/).map((v) => v.trim()).filter(Boolean);
        const nums = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n));
        return nums.length ? nums : [];
      }
      const num = Number(val);
      return Number.isFinite(num) ? [num] : [];
    };

    const ids = toIds(normalizedAnswer);
    if (!ids.length && typeof normalizedAnswer === 'string') {
      // sometimes answer is already the option text
      return normalizedAnswer;
    }
    if (!ids.length) return null;

    const labels = options
      .filter((opt: any) => ids.includes(Number(opt.id)))
      .map((opt: any) => opt.option ?? opt.label ?? opt.value ?? opt.name)
      .filter(Boolean);
    return labels.length ? labels.join(', ') : null;
  };

  const formatAnswer = (answer: any, questionType: string) => {
    if (answer === null || answer === undefined || answer === '') {
      return 'No answer';
    }

    switch (questionType) {
      case 'checkboxes':
      case 'multiple_choice':
      case 'dropdown': {
        const mapped = mapOptionLabels(answer, question);
        if (mapped) return mapped;
        if (Array.isArray(answer)) {
          return answer.join(', ');
        }
        if (typeof answer === 'string' && answer.includes('|')) {
          return answer.split('|').filter(v => v.trim() !== '').join(', ');
        }
        return String(answer);
      }

      case 'upload_file':
      case 'upload_image':
      case 'upload_video':
      case 'upload_audio':
        if (typeof answer === 'object' && (answer.file_name || answer.filename)) {
          return `📎 ${answer.file_name || answer.filename}`;
        }
        if (Array.isArray(answer)) {
          return `📎 ${answer.length} file(s) uploaded`;
        }
        return '📎 File uploaded';

      case 'location':
        if (typeof answer === 'object' && answer.latitude && answer.longitude) {
          return `📍 Location: ${Number(answer.latitude).toFixed(4)}, ${Number(answer.longitude).toFixed(4)}`;
        }
        return String(answer);

      case 'signature':
        return '✍️ Signature provided';

      case 'date':
      case 'datetime':
      case 'time':
        if (answer instanceof Date) {
          return answer.toLocaleString();
        }
        if (typeof answer === 'string') {
          const date = new Date(answer);
          if (!isNaN(date.getTime())) {
            return questionType === 'date' ? date.toLocaleDateString() : date.toLocaleString();
          }
        }
        return String(answer);

      default:
        if (Array.isArray(answer)) {
          return answer.join(', ');
        }
        if (typeof answer === 'object') {
          if (answer.label) return answer.label;
          if (answer.value) return answer.value;
          if (answer.text) return answer.text;
          return JSON.stringify(answer);
        }
        return String(answer);
    }
  };

  if (rawAnswerId && Array.isArray(question.options) && question.options.length > 0) {
    const ids = String(rawAnswerId)
      .split('|')
      .map(id => Number(id.trim()))
      .filter(Boolean);
    const optionTexts = question.options
      .filter(opt => ids.includes(Number(opt.id)))
      .map(opt => opt.option);
    const optionAnswer = optionTexts.join(', ');
    return otherText ? `${optionAnswer} (Other: ${otherText})` : optionAnswer || formatAnswer(rawAnswer, question.question_type);
  }

  const formatted = formatAnswer(rawAnswer, question.question_type);
  return otherText ? `${formatted} (Other: ${otherText})` : formatted;
};

const buildAnswerMap = (submissionData: any): Record<string, string> => {
  const map: Record<string, string> = {};
  if (!submissionData) return map;

  if (submissionData.submission_data && typeof submissionData.submission_data === 'object') {
    Object.entries(submissionData.submission_data).forEach(([key, value]) => {
      if (value != null) map[String(key)] = String(value);
    });
  }

  const answersArray = submissionData.answers || submissionData.submission_answers;
  if (Array.isArray(answersArray)) {
    answersArray.forEach((ans: any) => {
      const val = ans?.answer ?? ans?.value ?? ans?.answer_text;
      const qid = ans?.question_id ?? ans?.question ?? ans?.question_uuid;
      if (qid != null && val != null) {
        map[String(qid)] = String(val);
      }
    });
  }

  return map;
};

const formatActivityMessage = (
  log: ActivityLog,
  taskDescription?: string,
  reopenedRemarks?: string | null
): string => {
  const userName = log.action_by?.name || 'System';
  const action = log.action || '';

  // Handle case-insensitive matching
  switch (action.toLowerCase()) {
    case 'followup_created':
      return `${userName} shared this followup task`;
    case 'followup_started':
      return `${userName} Started this followup task`;
    case 'followup_completed':
      return `${userName} Completed this task`;
    case 'auto_closed_related_task':
      return `${userName} Auto-closed this related task`;
    case 'followup_reopened':
      // Extract reopen remarks from description if available
      let remarks = '';
      if (reopenedRemarks && String(reopenedRemarks).trim()) {
        remarks = ` - Reason: ${String(reopenedRemarks).trim()}`;
      } else if (taskDescription) {
        const reopenMatch = taskDescription.match(/\[REOPENED:\s*([^\]]*)\]/);
        if (reopenMatch && reopenMatch[1]) {
          remarks = ` - Reason: ${reopenMatch[1].trim()}`;
        }
      }
      return `${userName} Reopened this task${remarks}`;
    case 'assigned':
      const targetName = log.action_to?.name;
      return targetName
        ? `${userName} shared this task with ${targetName}`
        : `${userName} shared this task`;
    default:
      return `${userName} performed action - ${log.action}`;
  }
};

const getActivityIcon = (action: string): string => {
  const normalizedAction = (action || '').toLowerCase();
  return {
    'followup_created': 'add-circle',
    'followup_started': 'play-circle',
    'followup_completed': 'checkmark-circle',
    'auto_closed_related_task': 'checkmark-done-circle',
    'followup_reopened': 'refresh-circle',
    'assigned': 'share',
  }[normalizedAction] || 'information-circle';
};

const getActivityColor = (action: string): string => {
  const normalizedAction = (action || '').toLowerCase();
  return {
    'followup_created': '#007AFF',
    'followup_started': '#34C759',
    'followup_completed': '#34C759',
    'auto_closed_related_task': '#DC2626',
    'followup_reopened': '#FF9500',
    'assigned': '#007AFF',
  }[normalizedAction] || '#666';
};

const getActivityBgColor = (action: string): string => {
  const normalizedAction = (action || '').toLowerCase();
  return {
    'followup_created': '#E3F2FD',
    'followup_started': '#E8F5E8',
    'followup_completed': '#E8F5E8',
    'auto_closed_related_task': '#FEE2E2',
    'followup_reopened': '#FFF3CD',
    'assigned': '#E3F2FD',
  }[normalizedAction] || '#F8F9FA';
};

const getMainFormSubmissionId = (taskDetails: TaskDetails | null): string | number | null => {
  if (!taskDetails) return null;
  const candidates = [
    (taskDetails as any).main_form_submission_id,
    (taskDetails as any).main_form_submission,
    (taskDetails as any).form_submission_id,
    (taskDetails as any).submission_id,
    (taskDetails as any).parent_submission_id,
    (taskDetails as any).parent_form_submission_id,
    (taskDetails as any).source_submission_id,
    (taskDetails as any).followup_task_form_submission_id,
    (taskDetails as any).followup_form_submission_id,
  ];

  for (const value of candidates) {
    if (value == null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
};

const getStatusDisplay = (status: string) => {
  const normalizedStatus = (status || '').toLowerCase().replace('_', '').replace(' ', '');
  return {
    'notstarted': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
    'notassigned': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
    'inprogress': { text: 'In Progress', color: '#007AFF', bgColor: '#E3F2FD' },
    'completed': { text: 'Completed', color: '#34C759', bgColor: '#E8F5E8' }
  }[normalizedStatus] || { text: status, color: '#666', bgColor: '#F5F5F5' };
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 5,
  },
  backButtonContainer: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
  },
  boxContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 8,
  },
  parentQuestion: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  taskInfo: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainFormText: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 6,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  taskDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 6,
    lineHeight: 20,
  },
  dateContainer: {
    marginTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTexts: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reopenButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  reopenButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginRight: 8,
  },
  statusBadge: {
    marginTop: 4,
  },
  activitySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  activityList: {
    flexDirection: 'column',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityMessageCard: {
    borderRadius: 8,
    padding: 10,
  },
  activityMessage: {
    fontSize: 14,
    color: '#1f2937',
  },
  activitySubtext: {
    marginTop: 6,
    fontSize: 12,
    color: '#6c757d',
  },
  activityTime: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  noActivityText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    paddingVertical: 20,
  },
  answersSection: {
    marginLeft: 36,
    marginTop: 8,
    marginBottom: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#007AFF',
  },
  answersSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  answerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tagIcon: {
    marginRight: 12,
  },
  tagContent: {
    flex: 1,
  },
  tagTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  tagAnswer: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  tagSubtitle: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  answerTagBlock: {
    marginBottom: 8,
  },
  tagMetaText: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 2,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    color: '#1f2937',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9acd32',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  questionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  questionWrapper: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  answerCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: '#1f2937',
  },
  formInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  formInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
    flex: 1,
  },
  formInfoSubtext: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  formInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
  },
  formInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
    flex: 1,
  },
  formAnswersSection: {
    marginTop: 8,
  },
  formAnswersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  formAnswerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  formQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  formAnswerValue: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  formAnswerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  formAnswerText: {
    fontSize: 14,
    color: '#1f2937',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
