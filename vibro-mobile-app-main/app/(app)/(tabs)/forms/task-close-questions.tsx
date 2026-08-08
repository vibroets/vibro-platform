import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    InteractionManager,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Toast from 'react-native-toast-message';

import KeyboardAwareContainer, {
    KeyboardAwareContainerRef,
} from '../../../../components/KeyboardAwareContainer';
import FormField, {
    FormContainerContext,
} from '../../../../components/form/FormFields/FormField';
import ValidationErrorBanner from '../../../../components/form/ValidationErrorBanner';
import RelatedTasksSelector from '../../../../components/RelatedTasksSelector';
import api from '../../../../services';
import { textColors, typography } from '../../../../styles/typography';

interface TaskCloseQuestionsScreenProps {
  onClose?: () => void;
  taskId?: string; // Accept taskId as prop from parent
  followupTaskId?: string; // Accept followupTaskId as prop from parent
}

const TaskCloseQuestionsScreen: React.FC<TaskCloseQuestionsScreenProps> = ({ onClose, taskId: propTaskId, followupTaskId: propFollowupTaskId }) => {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  // Use prop first, then fall back to params
  const taskId = propTaskId || (params.taskId as string);
  const followupTaskId = propFollowupTaskId || (params.followupTaskId as string);

  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [errorFieldKeys, setErrorFieldKeys] = useState<string[]>([]);
  const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showRelatedTasksSelector, setShowRelatedTasksSelector] = useState(false);

  const keyboardContainerRef = useRef<KeyboardAwareContainerRef>(null);
  const fieldRefs = useRef<{ [key: string]: React.RefObject<View | null> }>({});
  const pendingAnswersRef = useRef<any[]>([]);

  const normalizeQuestionType = useCallback((rawType: any) => {
    const normalized = String(rawType || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (normalized === "checkbox" || normalized === "check_box" || normalized === "check_boxes") return "checkboxes";
    if (normalized === "multiplechoice" || normalized === "multiple_choice") return "multiple_choice";
    if (normalized === "linearscale" || normalized === "linear_scale" || normalized === "linear_scale") return "linear_scale";
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
    const taskCloseQuestionId =
      input.id ??
      input.task_close_question_id ??
      input.taskCloseQuestionId ??
      null;
    const rawOptions =
      Array.isArray(base.options) ? base.options :
      Array.isArray(base.option) ? base.option :
      Array.isArray(base.choices) ? base.choices :
      [];
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
      // Preserve the wrapper id when backend returns
      // { id: <task_close_question_id>, question: { ... } }.
      task_close_question_id: taskCloseQuestionId,
      // Ensure stale answers from previous task runs do not prefill fields.
      answer: "",
      value: "",
      submitted_value: "",
      response: "",
      response_value: "",
      answers: undefined,
      selected_option: undefined,
      selectedOption: undefined,
      answer_data: undefined,
      data: undefined,
      // Ensure question_uuid exists so form fields can be registered reliably
      question_uuid:
        base.question_uuid ??
        base.uuid ??
        (base.id != null ? String(base.id) : undefined),
      question_type: normalizeQuestionType(base.question_type),
      options,
      logics,
      sub_questions: subQuestions,
    };
  }, [normalizeQuestionType]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    getValues,
    trigger,
    reset,
  } = useForm({
    mode: 'onSubmit', // Only validate on submit, not on every change
  });

  // Fetch task close questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        // console.log('🔍 Fetching task close questions for task:', taskId);
        const response = await api.get(`/form/task-close-questions/${taskId}/`);
        // console.log('📋 Task close questions response:', response.data);
        // console.log('📋 Response status:', response.status);

        // Handle different response structures
        const questionsData = response.data.questions || response.data || [];
        
        if (Array.isArray(questionsData)) {
          const normalizedQuestions = questionsData.map(normalizeQuestion);
          if (normalizedQuestions.length > 0) {
            const sample = normalizedQuestions[0];
          }
          setQuestions(normalizedQuestions);

          // Build a mapping from question.id -> the form field key (uuid/uniqueId)
          const questionIdToFieldKey = new Map<number, string>();
          normalizedQuestions.forEach((q) => {
            const fieldKey =
              (q as any).uniqueId ??
              q.question_uuid ??
              (q.id != null ? String(q.id) : undefined);
            if (fieldKey) {
              if (q.id != null) {
                questionIdToFieldKey.set(Number(q.id), fieldKey);
              }
              if ((q as any).task_close_question_id != null) {
                questionIdToFieldKey.set(Number((q as any).task_close_question_id), fieldKey);
              }
            }
          });

          // Fetch answers for this task so we can prefill the form values
          let answerLookup: Record<string, any> = {};
          try {
            const answersResponse = await api.get<any>(`/form/task-close-questions/${taskId}/answers/`);
            const answersData = answersResponse.data || answersResponse;

            const answersArray: any[] = [];
            if (Array.isArray(answersData)) {
              answersArray.push(...answersData);
            } else if (answersData && Array.isArray(answersData.answers)) {
              answersArray.push(...answersData.answers);
            } else if (answersData && typeof answersData.answers === 'object') {
              answersArray.push(...Object.values(answersData.answers));
            }

            answersArray.forEach((ans) => {
              // Determine which field key to use for this answer
              const key =
                ans.question_uuid ??
                ans.questionUuid ??
                (ans.question_id != null
                  ? questionIdToFieldKey.get(Number(ans.question_id))
                  : undefined) ??
                (ans.question != null
                  ? questionIdToFieldKey.get(Number(ans.question))
                  : undefined) ??
                (ans.questionId != null
                  ? questionIdToFieldKey.get(Number(ans.questionId))
                  : undefined);
              if (!key) return;

              answerLookup[key] =
                ans.answer ??
                ans.value ??
                ans.answer_value ??
                ans.response ??
                ans.result ??
                ans.text ??
                '';
            });

          } catch (answerErr) {
          }

          // Always start task-close questions blank for each new followup task.
          const defaults: Record<string, any> = {};
          normalizedQuestions.forEach((q) => {
            const fieldKey =
              (q as any).uniqueId ??
              q.question_uuid ??
              (q.id != null ? String(q.id) : undefined);
            if (!fieldKey) return;
            defaults[fieldKey] = '';
          });
          reset(defaults);

        } else {
          setQuestions([]);
        }
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load task close questions',
          position: 'top'
        });
        // Don't auto-redirect - let user go back manually if needed
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchQuestions();
    }
  }, [taskId, normalizeQuestion, reset]);

  // Handle input focus
  const handleInputFocus = useCallback((inputKey: string) => {
    setFocusedInputKey(inputKey);
  }, []);

  // Keep sticky footer pinned to the bottom of the screen on Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height || 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Validate all fields
  const validateAllFields = useCallback(async () => {
    const fieldsToValidate = questions.map((q) => (q as any).uniqueId ?? q.question_uuid);
    const isValidForm = await trigger(fieldsToValidate);
    const errorMap: Record<string, boolean> = {};

    fieldsToValidate.forEach((fieldName) => {
      if (!fieldName) return;
      errorMap[fieldName] = !!errors[fieldName];
    });

    const errorCount = Object.values(errorMap).filter(Boolean).length;
    setValidationErrorCount(errorCount);

    if (errorCount > 0) {
      setShowValidationBanner(true);
      const errorKeys = Object.keys(errorMap).filter(key => errorMap[key]);
      setErrorFieldKeys(errorKeys);
      setCurrentErrorIndex(0);
    } else {
      setShowValidationBanner(false);
    }

    return { isValid: isValidForm, errors: errorMap };
  }, [questions, errors, trigger]);

  // Handle validation banner click
  const handleValidationBannerClick = useCallback(async () => {
    const { errors: fieldErrors } = await validateAllFields();
    const currentErrorKeys = Object.keys(fieldErrors).filter((key) => fieldErrors[key]);

    if (currentErrorKeys.length === 0) {
      setShowValidationBanner(false);
      return;
    }

    // Update error field keys if they have changed
    if (JSON.stringify(currentErrorKeys) !== JSON.stringify(errorFieldKeys)) {
      setErrorFieldKeys(currentErrorKeys);
      setCurrentErrorIndex(0);
    }

    // Use currentErrorIndex to determine which error to navigate to
    const targetIndex = currentErrorIndex % currentErrorKeys.length;
    const targetErrorKey = currentErrorKeys[targetIndex];

    // Update the current error index for next click
    setCurrentErrorIndex(currentErrorIndex + 1);

    // Scroll directly to the field using measureInWindow
    const scrollDirectlyToField = () => {
      const fieldRef = fieldRefs.current[targetErrorKey];
      const currentOffset =
        keyboardContainerRef.current?.getCurrentScrollOffset() ?? 0;
      
      if (fieldRef?.current && typeof fieldRef.current.measureInWindow === 'function') {
        fieldRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (y !== undefined && y !== null && height > 0) {
            // Calculate scroll needed to position field at 25% from top of screen
            const screenHeight = Dimensions.get('window').height;
            const targetScreenY = screenHeight * 0.25;
            const scrollDelta = y - targetScreenY;
            const newScrollPosition = Math.max(0, currentOffset + scrollDelta);
            keyboardContainerRef.current?.scrollToOffset(newScrollPosition);
          } else {
            keyboardContainerRef.current?.scrollToOffset(0);
          }
        });
      } else {
        // Field ref not available, try scrolling to top
        keyboardContainerRef.current?.scrollToOffset(0);
      }
    };

    // Wait a moment for any UI updates, then scroll
    setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        scrollDirectlyToField();
      });
    }, 200);
  }, [validateAllFields, currentErrorIndex, errorFieldKeys]);

  const handleInvalidSubmit = useCallback((formErrors: any) => {
    const errorKeys = Object.keys(formErrors || {});

    if (errorKeys.length > 0) {
      setValidationErrorCount(errorKeys.length);
      setShowValidationBanner(true);
      setErrorFieldKeys(errorKeys);
      setCurrentErrorIndex(0);

      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill all required fields',
        position: 'top'
      });
    }
  }, []);

  const submitTaskCloseAnswers = useCallback(async (selectedRelatedIds: number[] = []) => {
    if (!pendingAnswersRef.current.length) return;

    try {
      // Submit task close question answers and complete task (handled by backend)
      const response = await api.post(`/form/task-close-questions/${taskId}/`, {
        task_id: Number(taskId),
        answers: pendingAnswersRef.current,
        close_related_task_ids: selectedRelatedIds
      });

      const relatedTasksClosed = response.data?.related_tasks_closed;
      const totalClosed = (relatedTasksClosed?.count ?? 0) + 1;

      if (relatedTasksClosed && relatedTasksClosed.count > 0) {
        const tasksList = relatedTasksClosed.details
          .map((t: any, idx: number) => `${idx + 1}. ${t.task_name || `Task #${t.id}`}`)
          .join('\n');

        Alert.alert(
          '✅ Multiple Tasks Completed',
          `This task and ${relatedTasksClosed.count} related task(s) with the same Location & Question have been closed:\n\n${tasksList}\n\nThis ensures consistency across your workflow.`,
          [
            {
              text: 'OK',
              onPress: () => {
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: `${totalClosed} task(s) completed successfully`,
                  position: 'top'
                });

                // Close the form and return to Todo screen
                setTimeout(() => {
                  if (onClose && typeof onClose === 'function') {
                    onClose();
                  } else {
                    router.replace('/(app)/(tabs)/todo');
                  }
                }, 1500);
              }
            }
          ]
        );
      } else {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: totalClosed > 1 ? `${totalClosed} tasks completed` : 'Task completed successfully',
          position: 'top'
        });

        // Close the form and return to Todo screen
        setTimeout(() => {
          if (onClose && typeof onClose === 'function') {
            onClose(); // Parent (e.g. TaskSummaryScreen) handles navigation to Todo
          } else {
            router.replace('/(app)/(tabs)/todo');
          }
        }, 1500);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.message || 'Failed to submit answers',
        position: 'top'
      });
    }
  }, [taskId, onClose]);

  // Submit task close question answers and complete followup task
  const onSubmit = useCallback(async (data: any) => {

    const { isValid } = await validateAllFields();

    if (!isValid) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill all required fields',
        position: 'top'
      });
      return;
    }

    setSubmitting(true);

    try {
      // Prepare answers data
      const answersData = questions.map((question) => {
        const fieldName = (question as any).uniqueId ?? question.question_uuid;
        const answerValue = data[fieldName] ?? '';
        return {
          // Prefer task-close wrapper id; fallback to question id.
          question_id: (question as any).task_close_question_id ?? question.id,
          answer: answerValue,
          question_type: question.question_type,
        };
      }).filter((answer) => answer.question_id != null);

      pendingAnswersRef.current = answersData;

      // Check for related tasks before completing so the user can choose which to close
      const previewResponse = await api.get(`/tasks/${taskId}/related_tasks/`);
      const relatedTasks = previewResponse.data?.tasks || [];

      if (relatedTasks.length > 0) {
        setShowRelatedTasksSelector(true);
      } else {
        await submitTaskCloseAnswers([]);
      }
    } catch (error: any) {
      // If preview fails, still allow submission without auto-closing related tasks
      try {
        await submitTaskCloseAnswers([]);
      } catch (submitError: any) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: submitError?.response?.data?.message || 'Failed to submit answers',
          position: 'top'
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [taskId, questions, validateAllFields, submitTaskCloseAnswers]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FormContainerContext.Provider value={keyboardContainerRef as React.RefObject<KeyboardAwareContainerRef>}>
        <KeyboardAwareContainer
          ref={keyboardContainerRef}
          scrollViewStyle={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          formType="todo"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  if (onClose && typeof onClose === 'function') {
                    onClose();
                  } else if ((navigation as any).canGoBack?.()) {
                    (navigation as any).goBack();
                  } else {
                    router.replace('/(app)/(tabs)/todo');
                  }
                }}
              >
                <Text style={styles.backButtonText}>‹ Back</Text>
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.title}>Task Close Questions</Text>
                <Text style={styles.subtitle}>
                  Please answer these questions to complete the followup task
                </Text>
              </View>
            </View>
          </View>

          {/* Validation Error Banner */}
          <ValidationErrorBanner
            errorCount={validationErrorCount}
            visible={showValidationBanner}
            onPress={handleValidationBannerClick}
            currentErrorIndex={currentErrorIndex}
            totalErrors={errorFieldKeys.length}
          />

          {/* Questions */}
          <View style={styles.questionsContainer}>
            {questions.length > 0 ? (
              questions.map((question, index) => {
                const fieldKey = (question as any).uniqueId ?? question.question_uuid;
                const hasError = !!(fieldKey && errors[fieldKey]);

                // Create ref if it doesn't exist
                if (fieldKey && !fieldRefs.current[fieldKey]) {
                  fieldRefs.current[fieldKey] = React.createRef<View>();
                }

                return (
                  <View
                    key={question.id}
                    style={styles.questionWrapper}
                    ref={fieldKey ? fieldRefs.current[fieldKey] : undefined}
                  >
                    <FormField
                      question={question}
                      control={control}
                      errors={errors}
                      isCompleted={false}
                      hasError={hasError}
                      isEditable={true}
                      onFocus={handleInputFocus}
                      focusedInputKey={focusedInputKey}
                      visibleQuestions={fieldKey ? new Set([fieldKey]) : new Set()}
                      validationErrors={{}}
                      allValues={watch()} // Add current form values
                      allQuestions={questions} // Add all questions
                      setValue={setValue} // Add setValue function
                    />

                    {/* Separator */}
                    {index < questions.length - 1 && (
                      <View style={styles.questionSeparator} />
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.noQuestionsContainer}>
                <Text style={styles.noQuestionsText}>
                  No task close questions found for this followup task.
                </Text>
              </View>
            )}
          </View>
        </KeyboardAwareContainer>
      </FormContainerContext.Provider>

      {/* Submit Button */}
      {questions.length > 0 && (
        <View
          style={[
            styles.stickyFooter,
            Platform.OS === 'android' && keyboardHeight > 0
              ? { transform: [{ translateY: keyboardHeight }] }
              : null,
          ]}
        >
          <View style={styles.stickyFooterRow}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.disabledButton,
                styles.stickyFooterButton,
              ]}
              onPress={handleSubmit(onSubmit, handleInvalidSubmit)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitButtonText}>
                    Completing Task...
                  </Text>
                </>
              ) : (
                <Text style={styles.submitButtonText}>
                  Complete Followup Task
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Related Tasks Selector */}
      <RelatedTasksSelector
        visible={showRelatedTasksSelector}
        taskId={taskId}
        onClose={() => {
          setShowRelatedTasksSelector(false);
          submitTaskCloseAnswers([]);
        }}
        onConfirm={(selectedIds) => {
          setShowRelatedTasksSelector(false);
          submitTaskCloseAnswers(selectedIds);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 160, // Space for sticky footer
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: textColors.secondary,
    marginTop: 16,
  },
  header: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
    marginRight: 4,
  },
  backButtonText: {
    ...typography.titleMedium,
    color: '#2196f3',
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    ...typography.titleLarge,
    color: textColors.primary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: textColors.secondary,
    lineHeight: 20,
  },
  questionsContainer: {
    padding: 20,
  },
  questionWrapper: {
    marginBottom: 16,
  },
  questionSeparator: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },
  noQuestionsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noQuestionsText: {
    ...typography.bodyLarge,
    color: textColors.secondary,
    textAlign: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingBottom: 0,
    paddingTop: 8,
    zIndex: 200,
  },
  stickyFooterRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyFooterButton: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 56,
  },
  submitButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  submitButtonText: {
    ...typography.labelLarge,
    color: '#fff',
    fontWeight: '600',
  },
});

export default TaskCloseQuestionsScreen;
