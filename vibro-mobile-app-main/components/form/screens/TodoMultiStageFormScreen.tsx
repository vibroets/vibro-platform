import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { ToggleContext } from "../../../app/(app)/_layout";
import KeyboardAwareContainer, { KeyboardAwareContainerRef } from "../../../components/KeyboardAwareContainer";
import { RootState } from "../../../Redux/reducer/rootReducer";
import api from "../../../services";
import { FORM, GETFORMSUBMISSIONDETAILS, SAVE_DRAFT, TASK_TRACKING, TASK_TRACKING_CREATE, TRIGGER_FOLLOWUP_TASKS, USERS_LIST } from '../../../services/constants';
import { networkService } from "../../../services/networkService";
import { offlineStorageService } from "../../../services/offlineStorageService";
import { backgroundSyncService } from "../../../services/backgroundSyncService";
import {
  fetchFormMetadata,
  fetchFormStages,
  saveCachedStage,
  saveCachedMetadata,
  assembleFormFromCache,
  updateCacheTimestamp,
} from "../../../services/formCacheService";
import { textColors, typography } from "../../../styles/typography";
import Accordion from "../Accordion/Accordion";
import StageIndicator from "../Accordion/StageIndicator";
import FormField, { FormContainerContext } from "../FormFields/FormField";
import { PreviousSubmissionsContext } from "../FormFields/FormFieldWrapper";
import TableField from "../FormFields/TableField";
import { useMultiStageForm } from "../hooks/useMultiStageForm";
import { usePreviousSubmissions } from "../hooks/usePreviousSubmissions";
import SuccessModal from "../SuccessModal";
import { Stage } from "../types/formTypes";
import ValidationErrorBanner from "../ValidationErrorBanner";
import ReopenSubmissionModal from "./ReopenSubmissionModal";
import RelatedTasksSelector from "@/components/RelatedTasksSelector";

interface TodoMultiStageFormScreenProps {
  formId: string;
  taskId: string;
  submissionId?: string;
  stageId?: string;
  draftData?: any;
  draftId?: string;
  sourceScreen?: string;
  mode?: string; // Add mode parameter for task close questions
  onClose: () => void;
  singleStageSubmit?: boolean;
  onTabChange?: (index: number) => void;
  onNavigateToTaskClose?: (taskId: string) => void; // Callback for task close navigation
}
interface User {
  phone: string;
  department_details: any;
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  email?: string;
}

interface QuestionItemProps {
  question: any;
  stage: any;
  control: any;
  errors: any;
  setValue: any;
  allQuestions: any[];
  focusedInputKey: string | null;
  validationErrors?: Record<string, boolean>;
  isVisible: boolean;
  isPreview: boolean;
  hasStarted: boolean;
  submissionId?: string;
  sourceScreen?: string;
  handleInputFocus: (fieldName: string) => void;
}

const QuestionItem = memo(({
  question,
  stage,
  control,
  errors,
  setValue,
  allQuestions,
  focusedInputKey,
  validationErrors,
  isVisible,
  isPreview,
  hasStarted,
  submissionId,
  sourceScreen,
  handleInputFocus,
}: QuestionItemProps) => {
  const isReceiveForm = !!submissionId;
  const isTodoReceive = sourceScreen === "todo-receive";
  const isStageCompleted = stage?.is_completed || false;
  const isEditable = hasStarted && !isStageCompleted && !isPreview;
  const hasError = !!errors[question.question_uuid];
  if (!isVisible) {
    return null;
  }

  return (
    <View key={question.question_uuid}>
      {question.question_type === "table" ? (
        <TableField
          question={question}
          control={control}
          errors={errors}
          isCompleted={isStageCompleted}
          isEditable={isEditable}
        />
      ) : (
        <FormField
          question={question}
          control={control}
          errors={errors}
          isCompleted={isStageCompleted}
          allQuestions={allQuestions}
          setValue={setValue}
          hasError={hasError}
          isEditable={isEditable}
          onFocus={handleInputFocus}
          focusedInputKey={focusedInputKey}
          validationErrors={validationErrors}
        />
      )}
    </View>
  );
}, (prev, next) => {
  if (prev.isVisible !== next.isVisible) return false;
  if (prev.question !== next.question) return false;
  if (prev.stage !== next.stage) return false;
  if (prev.isPreview !== next.isPreview) return false;
  if (prev.hasStarted !== next.hasStarted) return false;
  if (prev.submissionId !== next.submissionId) return false;
  if (prev.sourceScreen !== next.sourceScreen) return false;

  // Only re-render if THIS question's focus state changed
  const prevFocused = prev.focusedInputKey === prev.question.question_uuid;
  const nextFocused = next.focusedInputKey === next.question.question_uuid;
  if (prevFocused !== nextFocused) return false;

  const prevError = !!prev.errors?.[prev.question.question_uuid];
  const nextError = !!next.errors?.[next.question.question_uuid];
  if (prevError !== nextError) return false;

  const prevValError = !!prev.validationErrors?.[prev.question.question_uuid];
  const nextValError = !!next.validationErrors?.[next.question.question_uuid];
  if (prevValError !== nextValError) return false;

  return true;
});

const TodoMultiStageFormScreen: React.FC<TodoMultiStageFormScreenProps> = ({
  formId,
  taskId,
  submissionId,
  stageId,
  draftData,
  draftId,
  sourceScreen,
  mode,
  onClose,
  singleStageSubmit = false,
  onTabChange,
  onNavigateToTaskClose
}) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [formSubmissionId, setFormSubmissionId] = useState<number | undefined>(undefined);
  const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null);
  const focusedInputKeyRef = useRef<string | null>(null);
  const [showSubmittingOverlay, setShowSubmittingOverlay] = useState(false);
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<string>('standard');
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [hasStarted, setHasStarted] = useState(
    sourceScreen === 'task-summary' ||
      sourceScreen === 'todo-new' ||
      sourceScreen === 'todo'
  );
  const [isPreview, setIsPreview] = useState(false);
  const [canEditPreviousStage, setCanEditPreviousStage] = useState<boolean>(false);
  const [isInUpdateMode, setIsInUpdateMode] = useState<boolean>(false);
  const [taskStartDate, setTaskStartDate] = useState<string | null>(null);
  const [taskEndDate, setTaskEndDate] = useState<string | null>(null);
  const [showDraftConfirmation, setShowDraftConfirmation] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [isFollowupTask, setIsFollowupTask] = useState(false);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [errorFieldKeys, setErrorFieldKeys] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(!networkService.isOffline());
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [originalDraftId, setOriginalDraftId] = useState<number | null>(null);
  const [selectedStageForEdit, setSelectedStageForEdit] = useState<number | null>(null);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [canReopen, setCanReopen] = useState(false);
  const [showRelatedTasksSelector, setShowRelatedTasksSelector] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
  const { setFormId: setCurrentFormId, setOnBackPress, setShowBackButton } = useContext(ToggleContext)!;

  // Temporarily disabled network monitoring to prevent infinite loops
  // useEffect(() => {
  //   const checkNetworkStatus = () => {
  //     const online = !networkService.isOffline();
  //     setIsOnline(online);
  //   };

  //   // Check immediately
  //   checkNetworkStatus();

  //   // Check every 2 seconds for network changes
  //   const interval = setInterval(checkNetworkStatus, 2000);

  //   return () => clearInterval(interval);
  // }, []);



  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardContainerRef = useRef<KeyboardAwareContainerRef>(null);
  const scrollOffsetRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const lastSubmitDataRef = useRef<any | null>(null);
  const queuedBackgroundSubmissionIdRef = useRef<string | null>(null);
  const shouldForceSyncAfterSubmitRef = useRef(false);
  const pendingSubmitMobileRef = useRef<((selectedIds: number[]) => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isLoadingFormRef = useRef(false);
  const shouldRetryLoadOnActiveRef = useRef(false);
  const formLoadRetryCountRef = useRef(0);
  const loadedStageOrdersRef = useRef<Set<number>>(new Set());
  const backgroundLoadInProgressRef = useRef(false);
  const allStageOrdersRef = useRef<number[]>([]);
  const getFormStagesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Handle input focus (for state management only, scrolling is handled by InputWrapper)
  const handleInputFocus = useCallback((inputKey: string) => {
    focusedInputKeyRef.current = inputKey;
    setFocusedInputKey(inputKey);
  }, []);

  const user = useSelector((state: RootState) => state.user);
  const assignments = useSelector((state: RootState) => state.formAssignments.data);
  const receivedAssignment = useSelector((state: RootState) => state.formReceived.data);

  const {
    currentStage,
    currentStageIndex,
    isFirstStage,
    isLastStage,
    completedStages,
    control,
    errors,
    getIsFormDirty,
    resetFormDirty,
    handleSubmit,
    goToPrevStage,
    goToNextStage,
    goToStage,
    visibleQuestions,
    watch,
    setValue,
    getValues,
    reset,
    submitting,
    validationErrors,
    validateAllFields,
    handleFormSubmission,
    queueBackgroundSubmission,
  } = useMultiStageForm(
    stages,
    setFormSubmissionId,
    () => {},
    undefined,
    undefined,
    Number(formId),
    setStages,
    undefined,
    undefined,
    undefined,
    formType
  );

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      const goingBackground =
        prevState === "active" &&
        (nextState === "background" || nextState === "inactive");
      const comingActive = prevState !== "active" && nextState === "active";

      if (
        goingBackground &&
        submitInFlightRef.current &&
        lastSubmitDataRef.current &&
        !queuedBackgroundSubmissionIdRef.current
      ) {
        const queuedId = await queueBackgroundSubmission(
          lastSubmitDataRef.current,
        );
        if (queuedId) {
          queuedBackgroundSubmissionIdRef.current = queuedId;
        }
      }

      if (goingBackground && isLoadingFormRef.current) {
        shouldRetryLoadOnActiveRef.current = true;
      }

      if (comingActive && queuedBackgroundSubmissionIdRef.current) {
        // Avoid forcing sync while an online submission is still in-flight (duplication risk).
        if (submitInFlightRef.current) {
          shouldForceSyncAfterSubmitRef.current = true;
          return;
        }

        try {
          await backgroundSyncService.forceSync();
        } catch (error) {
        }
      }

      if (
        comingActive &&
        shouldRetryLoadOnActiveRef.current &&
        !isLoadingFormRef.current
      ) {
        shouldRetryLoadOnActiveRef.current = false;
        getFormStagesRef.current();
      } else if (comingActive) {
        shouldRetryLoadOnActiveRef.current = false;
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [queueBackgroundSubmission]);

  const isFormAssignedToUser = useMemo(() => {
    const isAssigned = assignments.some((assignment: any) => String(assignment.form) === formId) ||
      receivedAssignment.some((assignment: any) => String(assignment.form) === formId);
    return isAssigned;
  }, [assignments, receivedAssignment, formId]);

  const completedByUser = useMemo(() => {
    if (!stages[currentStageIndex]?.completed_by) return null;
    const userId = stages[currentStageIndex]?.completed_by;
    return users.find((u) => u.id === userId);
  }, [stages, currentStageIndex, users]);

  const editedByUser = useMemo(() => {
    if (!stages[currentStageIndex]?.edited_by) return null;
    const userId = stages[currentStageIndex]?.edited_by;
    return users.find((u) => u.id === userId);
  }, [stages, currentStageIndex, users]);

  // Capture user's location when form is submitted
  const captureUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      // Get place name using reverse geocoding
      let placeName = "Unknown Location";
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocode && geocode.length > 0) {
          const address = geocode[0];
          const addressParts = [
            address.street,
            address.district,
            address.city,
            address.region,
            address.country
          ].filter(Boolean);

          placeName = addressParts.length > 0 ? addressParts.join(", ") : "Unknown Location";
        }
      } catch (geocodeError) {
        placeName = "Unknown Location";
      }

      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
        placeName: placeName,
      };

      return locationData;
    } catch (error) {
      return null;
    }
  }, []);

  const populateFormWithExistingData = useCallback(async () => {
    if (!stages.length) return;

    const allQuestions = stages.flatMap((stage, stageIndex) =>
      stage.questions.flatMap(q => [
        q,
        ...q.sub_questions,
        ...(q.logics?.flatMap(l => l.logic_questions) || [])
      ]).map(q => ({
        ...q,
        _stageIndex: stageIndex,
        _isLastStage: stageIndex === stages.length - 1
      }))
    );

    for (const question of allQuestions) {
      try {
        // Extract answer value using the same logic as TodoFormDataScreen.tsx
        const q = question as any; // Type assertion to bypass TypeScript errors
        let answerValue = q.answer || q.value || q.submitted_value || q.answer_id;

        // If still no answer, check if answers is an array or object
        if ((answerValue === null || answerValue === undefined || answerValue === '') && q.answers) {
          if (Array.isArray(q.answers) && q.answers.length > 0) {
            // If answers is an array, take the first answer
            answerValue = q.answers[0].answer_id || q.answers[0].answer || q.answers[0].value || q.answers[0].submitted_value || q.answers[0];
          } else if (typeof q.answers === 'object' && q.answers !== null) {
            // If answers is an object, try to get the answer from it
            answerValue = q.answers.answer_id || q.answers.answer || q.answers.value || q.answers.submitted_value;
          }
        }

        // Additional check: look for answer in nested structures
        if ((answerValue === null || answerValue === undefined || answerValue === '')) {
          // Check for answer in submission-related fields
          if (q.submission_answer) {
            answerValue = q.submission_answer;
          } else if (q.user_answer) {
            answerValue = q.user_answer;
          } else if (q.response) {
            answerValue = q.response;
          } else if (q.response_value) {
            answerValue = q.response_value;
          }

          // Check for nested answer structures
          if ((answerValue === null || answerValue === undefined || answerValue === '') && q.answer_data) {
            answerValue = q.answer_data.answer_id || q.answer_data.answer || q.answer_data.value;
          }

          // Check if there's a direct answer field in some other structure
          if ((answerValue === null || answerValue === undefined || answerValue === '') && q.data) {
            answerValue = q.data.answer_id || q.data.answer || q.data.value;
          }
        }

        if (answerValue === undefined || answerValue === null || answerValue === '') continue;

        let processedValue = answerValue;

        // Handle different question types properly
        switch (q.question_type) {
          case "checkboxes":
          case "multiple_choice":
            if (Array.isArray(answerValue)) {
              processedValue = answerValue.join('|');
            } else if (typeof answerValue === 'string' && answerValue.includes('|')) {
              processedValue = answerValue.split('|').filter(v => v.trim() !== '').join('|');
            } else {
              processedValue = answerValue;
            }
            break;

          case "table":
            // Skip table questions for now
            continue;

          default:
            processedValue = answerValue;
            break;
        }

        setValue(q.question_uuid, processedValue, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false
        });
      } catch (error) {
      }
    }
  }, [stages, setValue]);

  const populateFromDraft = useCallback(async () => {
    if (!stages.length || !draftData?.formData) return;

    await new Promise(resolve => setTimeout(resolve, 300));

    Object.entries(draftData.formData).forEach(([questionUuid, value]) => {
      try {
        if (value !== undefined && value !== null && value !== '') {
          setValue(questionUuid, value, {
            shouldDirty: false,
            shouldTouch: false,
            shouldValidate: false
          });
        }
      } catch (error) {
      }
    });

    // Also restore the stage if possible
    if (draftData.currentStageIndex !== undefined) {
      setTimeout(() => goToStage(draftData.currentStageIndex), 500);
    }
  }, [stages, draftData]);

  // Fetch previous submission answers for the same form
  const { previousSubmissions: previousSubmissionsData } = usePreviousSubmissions({
    formId,
    excludeSubmissionId: submissionId,
    enabled: !isPreview,
  });

  const getFormStages = useCallback(async () => {
    isLoadingFormRef.current = true;
    try {
      setLoading(true);
      setError(null);

      let stagesToSet: Stage[] = [];
      let subDetail: any = undefined;

      // === Progressive Loading: Try cache first ===
      const cachedForm = await assembleFormFromCache(formId, [], submissionId);
      if (cachedForm) {
        const isAudit = cachedForm.formType === "audit";
        const cachedStages = (isAudit ? cachedForm.auditGroups : cachedForm.stages) as Stage[];
        if (cachedStages && cachedStages.length > 0) {
          // Apply same filtering as below (remaining stages, sent forms, etc.)
          let filteredStages = cachedStages;
          // For now, show all cached stages — filtering will be reapplied when fresh data arrives
          const finalCachedStages = filteredStages.map((stage, index) => ({
            ...stage,
            order: index + 1
          }));
          setStages(finalCachedStages);
          setLoading(false);
          loadedStageOrdersRef.current = new Set(cachedStages.map((s: any) => s.order));

          // Background refresh from API
          backgroundLoadRemainingStages(formId, submissionId);
          return;
        }
      }

      // First, get the task details to know which stages are actually remaining
      let remainingStageIds: number[] = [];
      try {
        const taskResponse = await api.get(`/tasks/${taskId}/`);
        const taskData = taskResponse.data;

        if (taskData.remaining_stages && Array.isArray(taskData.remaining_stages)) {
          remainingStageIds = taskData.remaining_stages.map((stage: any) => stage.id || stage.stage_id);
        } else {
          remainingStageIds = [];
        }
      } catch (taskError) {
        remainingStageIds = [];
      }

      // Fetch metadata for progressive loading
      const metadata = await fetchFormMetadata(formId);
      if (metadata) {
        const isAudit = metadata.form_type === "audit";
        const stageList = isAudit ? metadata.audit_groups : metadata.stages;
        allStageOrdersRef.current = stageList.map((s: any) => s.order);
        await saveCachedMetadata(formId, metadata, submissionId);
        setFormType(metadata.form_type);
        setFormTitle(metadata.form_title || "Untitled Form");
      }

      // Try progressive fetch: first 1 order only (keep response small)
      const initialOrders = allStageOrdersRef.current.slice(0, 1);
      if (initialOrders.length > 0) {
        const partialData = await fetchFormStages(formId, initialOrders, submissionId);
        if (partialData) {
          const isAudit = partialData.form_type === "audit";
          const allStages = (isAudit ? partialData.audit_group : partialData.stages || []).map((stage: Stage) => ({
            ...stage,
            updated: stage.edited_on ? true : false,
          }));

          subDetail = partialData?.submissionsDetail;
          setFormSubmissionId(Number(subDetail?.id) || undefined);
          setCanEditPreviousStage(
            partialData?.submissionsDetail?.can_edit_previous_state ||
              partialData?.can_edit_previous_state || false
          );

          if (sourceScreen === 'sent') {
            stagesToSet = allStages;
          } else if (remainingStageIds.length > 0) {
            stagesToSet = allStages.filter((stage: any) => remainingStageIds.includes(stage.id));
          } else {
            stagesToSet = allStages.filter((stage: any) => !stage.is_completed);
          }

          // Cache each stage in memory
          for (const order of initialOrders) {
            await saveCachedStage(formId, order, partialData, submissionId);
            loadedStageOrdersRef.current.add(order);
          }
        }
      }

      // If progressive loading failed, show error (don't attempt full load — can crash on large forms)
      if (stagesToSet.length === 0) {
        setError("Failed to load form. Please check your connection and try again.");
        setLoading(false);
        return;
      }

      // Re-order stages starting from 1 for consistent display
      const finalStages = stagesToSet.map((stage, index) => ({
        ...stage,
        order: index + 1
      }));

      setStages(finalStages);

      // Background load remaining stages
      backgroundLoadRemainingStages(formId, submissionId);
    } catch (error: any) {
      const isPermissionError = error?.response?.status === 403 || error?.message?.includes("403");
      if (!isPermissionError && formLoadRetryCountRef.current < 3) {
        formLoadRetryCountRef.current += 1;
        shouldRetryLoadOnActiveRef.current = true;
        if (appStateRef.current === "active") {
          setTimeout(() => {
            if (shouldRetryLoadOnActiveRef.current && !isLoadingFormRef.current) {
              shouldRetryLoadOnActiveRef.current = false;
              getFormStagesRef.current();
            }
          }, 1500);
        }
      } else {
        setError("Failed to load form stages. Please check your permissions or try again.");
        Toast.show({
          type: "error",
          text1: "Error",
          text2: isPermissionError ? "You lack permission to access this form." : "Failed to load form stages.",
          position: "top",
        });
      }
    } finally {
      isLoadingFormRef.current = false;
      setLoading(false);
    }
  }, [formId, taskId, submissionId]);

  useEffect(() => {
    getFormStagesRef.current = getFormStages;
  }, [getFormStages]);

  const backgroundLoadRemainingStages = useCallback(async (
    fId: string,
    subId: string | undefined,
  ) => {
    if (backgroundLoadInProgressRef.current) return;
    const remainingOrders = allStageOrdersRef.current.filter(
      (order) => !loadedStageOrdersRef.current.has(order)
    );
    if (remainingOrders.length === 0) return;

    backgroundLoadInProgressRef.current = true;
    try {
      const BATCH_SIZE = 1;
      for (let i = 0; i < remainingOrders.length; i += BATCH_SIZE) {
        const batch = remainingOrders.slice(i, i + BATCH_SIZE);
        try {
          const partialData = await fetchFormStages(fId, batch, subId);
          if (partialData) {
            const isAudit = partialData.form_type === "audit";
            const newStages = isAudit ? partialData.audit_group : partialData.stages;
            if (newStages && newStages.length > 0) {
              for (const order of batch) {
                await saveCachedStage(fId, order, partialData, subId);
                loadedStageOrdersRef.current.add(order);
              }
              setStages((prevStages) => {
                const merged = [...prevStages];
                for (const newStage of newStages) {
                  const existingIdx = merged.findIndex(
                    (s) => s.order === newStage.order
                  );
                  if (existingIdx >= 0) {
                    if (!merged[existingIdx].questions || merged[existingIdx].questions.length === 0) {
                      merged[existingIdx] = { ...newStage, updated: newStage.edited_on ? true : false };
                    }
                  } else {
                    merged.push({ ...newStage, updated: newStage.edited_on ? true : false });
                  }
                }
                merged.sort((a, b) => (a.order || 0) - (b.order || 0));
                return merged;
              });
            }
          }
        } catch {
          // Silent fail — will retry on next open
        }
      }
      await updateCacheTimestamp(fId, subId);
    } finally {
      backgroundLoadInProgressRef.current = false;
    }
  }, []);

  const getUsers = useCallback(async () => {
    try {
      const response = await api.get(USERS_LIST);
      setUsers(response.data);
    } catch (error: any) {
      Toast.show({ type: "error", text1: "Error", text2: "Failed to load users.", position: "top" });
    }
  }, []);

  const getTaskDetails = useCallback(async () => {
    // For todo-receive forms, always fetch task details to check start status
    if (sourceScreen !== 'todo-receive' && submissionId) {
      return;
    }

    if (!taskId) {
      return;
    }

    try {
      const taskResponse = await api.get(`/tasks/${taskId}/`);

      if (taskResponse.data?.start_date) {
        setTaskStartDate(taskResponse.data.start_date);
      }
      if (taskResponse.data?.end_date) {
        setTaskEndDate(taskResponse.data.end_date);
      }

      const isFollowupTaskFromTask = taskResponse.data?.followup_task_form_id !== null;
      setIsFollowupTask(isFollowupTaskFromTask);

      // For todo-receive forms, check if task has already been started
      if (sourceScreen === 'todo-receive') {
        // Check if this is a followup task that has been started
        const isFollowupTask = isFollowupTaskFromTask;
        const taskStatus = taskResponse.data?.status;
        // No longer need followup_task.started_at or task.started_at checks

        if (isFollowupTask) {
          // For followup tasks, check if they have been started via start_followup endpoint
          if (taskStatus === 'followup_started') {
            setHasStarted(true);
          } else {
            setHasStarted(false);
          }
        } else {
          // For regular tasks, check task tracking record
          try {
            const trackingResponse = await api.get(`${TASK_TRACKING}${taskId}/`);
            if (trackingResponse.data?.actual_start_date) {
              setHasStarted(true);
            } else {
              setHasStarted(false);
            }
          } catch (trackingError: any) {
            setHasStarted(false);
          }
        }
      }
    } catch (error: any) {
      // Task might not exist or be accessible - silently fail
      setIsFollowupTask(false);
      // For todo-receive forms, if we can't get task details, assume task hasn't started
      if (sourceScreen === 'todo-receive') {
        setHasStarted(false);
      }
    }
  }, [taskId, submissionId, sourceScreen]);

  // Handle back button press - show draft confirmation
  const handleBackPress = useCallback(async () => {
    if (showSuccessModal) {
      setShowSuccessModal(false);
      return;
    }

    if (submitting) return;

    // For sent forms, don't show draft confirmation - just go back
    if (submissionId) {
      onClose();
      return;
    }

    // Check if there's any form data
    const formData = watch();
    const hasData = Object.values(formData).some(value =>
      value !== undefined && value !== null && value !== ''
    );

    if (!hasData) {
      // No data, just go back
      onClose();
      return;
    }

    // If form hasn't been modified, don't show confirmation
    if (!getIsFormDirty()) {
      // No changes made, just go back
      onClose();
      return;
    }

    // Show draft confirmation popup only if there's data AND form has been modified
    setShowDraftConfirmation(true);
  }, [showSuccessModal, submitting, submissionId, onClose, watch, getIsFormDirty]);

  const handleFormSubmit = useCallback(async () => {
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;

    // Handle task close questions submission differently
    if (mode === 'task-close-questions') {

      // Basic form validation
      const { isValid, errors: fieldErrors } = await validateAllFields();

      if (!isValid) {
        setShowSubmittingOverlay(false);
        submitInFlightRef.current = false;

        const errorCount = Object.keys(fieldErrors).filter((key) => fieldErrors[key]).length;
        setValidationErrorCount(errorCount);
        setShowValidationBanner(true);

        // Scroll to first error
        setTimeout(async () => {
          const firstErrorKey = Object.keys(fieldErrors).find((key) => fieldErrors[key]);
          if (firstErrorKey) {
            keyboardContainerRef.current?.scrollToInput(firstErrorKey);
          }
        }, 200);

        return;
      }

      const formData = watch();

      setShowSubmittingOverlay(true);

      try {
        // Submit task close questions directly to the task close questions API
        const questionMetaByKey = new Map<string, any>();
        (currentStage?.questions || []).forEach((q: any) => {
          const key =
            (q as any).uniqueId ??
            q.question_uuid ??
            (q.id != null ? String(q.id) : undefined);
          if (key) questionMetaByKey.set(String(key), q);
        });

        const answersData = Object.entries(formData).reduce(
          (acc: any[], [fieldKey, answer]) => {
            const questionMeta = questionMetaByKey.get(String(fieldKey));
            if (!questionMeta) return acc;
            if (answer === undefined || answer === null || answer === "") return acc;

            acc.push({
              question_id:
                (questionMeta as any).task_close_question_id ?? questionMeta.id,
              answer,
            });
            return acc;
          },
          [],
        );

        const payload = {
          task_id: Number(Number(taskId)),
          answers: answersData
        };

        const response = await api.post(`/form/task-close-questions/${taskId}/`, payload);

        Toast.show({
          type: "success",
          text1: "Task Completed",
          text2: "Task close questions submitted and task completed successfully.",
          position: "top",
        });

        // Go back after successful submission
        setTimeout(() => {
          onClose();
        }, 1500);

      } catch (error: any) {

        let errorMsg = "An error occurred while submitting task close questions.";
        if (error?.response?.data?.error) {
          errorMsg = error.response.data.error;
        } else if (error?.response?.data?.message) {
          errorMsg = error.response.data.message;
        } else if (error.message) {
          errorMsg = error.message;
        }

        Toast.show({
          type: "error",
          text1: "Submission Failed",
          text2: errorMsg,
          position: "top",
        });
      } finally {
        setShowSubmittingOverlay(false);
        submitInFlightRef.current = false;
      }

      return; // Exit early for task close questions
    }

    if (singleStageSubmit && !isLastStage && !draftData) {
    }

    // Basic form validation
    const { isValid, errors: fieldErrors } = await validateAllFields();

    if (!isValid) {
      setShowSubmittingOverlay(false);
      submitInFlightRef.current = false;

      const errorCount = Object.keys(fieldErrors).filter((key) => fieldErrors[key]).length;
      setValidationErrorCount(errorCount);
      setShowValidationBanner(true);

      // Scroll to first error
      setTimeout(async () => {
        const firstErrorKey = Object.keys(fieldErrors).find((key) => fieldErrors[key]);
        if (firstErrorKey) {
          keyboardContainerRef.current?.scrollToInput(firstErrorKey);
        }
      }, 200);

      // Removed Toast - validation banner provides better UX
      return;
    }

    // Snapshot values immediately after validation passes, so we can queue a background submission
    // if the app is interrupted (call / app switch) before network requests complete.
    lastSubmitDataRef.current = getValues();

    // Capture user's location when form is submitted
    try {
      const userLocation = await captureUserLocation();
      if (userLocation) {
      } else {
      }
    } catch (locationError) {
    }

    const formData = watch();
    lastSubmitDataRef.current = formData;

    setShowSubmittingOverlay(true);

    try {

      let hasTaskCloseQuestions = false;
      try {
        const closeQuestionsResponse = await api.get(`/form/task-close-questions/${taskId}/`);
        const taskCloseQuestions = closeQuestionsResponse.data.questions || closeQuestionsResponse.data || [];

        hasTaskCloseQuestions = Array.isArray(taskCloseQuestions) && taskCloseQuestions.length > 0;
        if (hasTaskCloseQuestions) {
        }
      } catch (error: any) {
      }

      const submissionResult = await handleFormSubmission(formData);

      if (queuedBackgroundSubmissionIdRef.current) {
        try {
          await offlineStorageService.removeSubmission(
            queuedBackgroundSubmissionIdRef.current,
          );
        } catch (cleanupError) {
        } finally {
          queuedBackgroundSubmissionIdRef.current = null;
        }
      }

      // Step 2b: Update task tracking
      const complete_task = hasTaskCloseQuestions ? false : (singleStageSubmit ? false : isLastStage);
      const submitData = {
        form_id: parseInt(formId),
        ...(taskId ? {} : { form_data: formData }), // Only include form_data for non-todo forms since it's already submitted in step 1
        submitted_by: user.id,
        complete_task: complete_task,
        current_stage_id: currentStage?.id,
        current_stage_order: currentStage?.order,
        is_last_stage: isLastStage,
        total_stages: stages.length,
        next_stage_order: isLastStage ? null : (currentStage?.order || 0) + 1,
      };

      const response = await api.post(`${TASK_TRACKING}${taskId}/submit_mobile/`, submitData);

      // Check if related tasks were auto-closed (same location + question)
      const relatedTasksClosed = response?.data?.related_tasks_closed;
      const hasRelatedTasksClosed = relatedTasksClosed && relatedTasksClosed.count > 0;

      if (hasRelatedTasksClosed) {
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
                // For all todo form submissions, go back to the previous page
                onClose();
              }
            }
          ]
        );
      } else if (!hasTaskCloseQuestions && submitData.complete_task) {
        // Task completed here; ask user which related tasks (same location + question) to close
        try {
          const previewResponse = await api.get(`/tasks/${taskId}/related_tasks/`);
          const relatedTasks = previewResponse?.data?.tasks || [];

          if (relatedTasks.length > 0) {
            setShowRelatedTasksSelector(true);
            // Save the function to close related tasks after user selection
            pendingSubmitMobileRef.current = async (selectedIds: number[]) => {
              setShowSubmittingOverlay(true);
              try {
                if (selectedIds.length > 0) {
                  await api.post(`/tasks/${taskId}/close_related/`, {
                    related_task_ids: selectedIds,
                  });
                  Toast.show({
                    type: "success",
                    text1: "Tasks Closed",
                    text2: `${selectedIds.length + 1} task(s) completed successfully.`,
                    position: "top",
                  });
                } else {
                  Toast.show({
                    type: "success",
                    text1: "Stage Submitted",
                    text2: "Task completed successfully.",
                    position: "top",
                  });
                }
              } catch (closeError: any) {
                Alert.alert('Error', closeError?.response?.data?.error || 'Failed to close related tasks');
              } finally {
                setShowSubmittingOverlay(false);
                submitInFlightRef.current = false;
                onClose();
              }
            };
            setShowSubmittingOverlay(false);
            submitInFlightRef.current = false;
            return;
          }
        } catch (previewError) {
          // If preview fails, continue with standard success flow
        }

        Toast.show({
          type: "success",
          text1: "Stage Submitted",
          text2: "Stage submitted successfully.",
          position: "top",
        });
      } else {
        Toast.show({
          type: "success",
          text1: "Stage Submitted",
          text2: "Stage submitted successfully.",
          position: "top",
        });
      }

      // If this was submitted from a draft, remove the draft
      if (draftData) {
        try {
          await offlineStorageService.removeDraft(draftData.id);
        } catch (removeError) {
        }
      }

      if (hasTaskCloseQuestions) {
        Toast.show({
          type: "info",
          text1: "Task Completion Required",
          text2: "Please complete the task close questions to finish this followup task.",
          position: "top"
        });

        setTimeout(() => {
          if (onNavigateToTaskClose) {
            onNavigateToTaskClose(taskId);
          } else {
          }
        }, 500);

        return;
      }

      // For all todo form submissions, go back to the previous page
      if (!hasRelatedTasksClosed) {
        setTimeout(() => {
          onClose();
        }, 1500); // Brief delay to show the success toast
      }

      try {
        if (window.dispatchEvent) {
          // Create a custom event to trigger RECEIVED tab refresh
          const refreshEvent = new CustomEvent('todoStageSubmitted', {
            detail: {
              formId: parseInt(formId),
              taskId: parseInt(taskId),
              submittedStage: currentStage?.id,
              isLastStage: isLastStage,
              timestamp: Date.now()
            }
          });
          window.dispatchEvent(refreshEvent);

          // Also dispatch a more general refresh event in case RECEIVED tab needs it
          const generalRefreshEvent = new CustomEvent('formDataChanged', {
            detail: { action: 'stageSubmitted', formId: parseInt(formId), taskId: parseInt(taskId) }
          });
          window.dispatchEvent(generalRefreshEvent);
        }
      } catch (refreshError) {
      }
    } catch (error: any) {

      let errorMsg = "An error occurred while submitting the task.";
      if (error?.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }

      Toast.show({
        type: "error",
        text1: "Submission Failed",
        text2: errorMsg,
        position: "top",
      });
    } finally {
      setShowSubmittingOverlay(false);
      submitInFlightRef.current = false;
      if (
        shouldForceSyncAfterSubmitRef.current &&
        queuedBackgroundSubmissionIdRef.current
      ) {
        shouldForceSyncAfterSubmitRef.current = false;
        try {
          await backgroundSyncService.forceSync();
        } catch (error) {
        }
      } else {
        shouldForceSyncAfterSubmitRef.current = false;
      }
    }
  }, [formId, taskId, user.id, validateAllFields, watch, getValues, captureUserLocation, handleFormSubmission, onTabChange, singleStageSubmit, isLastStage, mode, currentStage, onClose, currentStage, onClose]);

  const handleStartForm = useCallback(async () => {

    // Check if this is a followup task that should use the start_followup endpoint
    const taskResponse = await api.get(`/tasks/${taskId}/`);
    const isFollowupTask = taskResponse.data?.followup_task_form_id !== null;

    if (isFollowupTask) {
      try {
        const response = await api.patch(`/tasks/${taskId}/start_followup/`);
        setHasStarted(true);
        Toast.show({
          type: "success",
          text1: "Task Started",
          text2: "You can now work on this task.",
          position: "top",
        });
      } catch (error: any) {
        Toast.show({
          type: "error",
          text1: "Start Failed",
          text2: error.response?.data?.error || "Could not start task",
          position: "top",
        });
      }
    } else {
      try {
        const trackingData = {
          task: parseInt(taskId),
          assignee_user: user.id,
          actual_start_date: new Date().toISOString(),
          status: "in_progress",
          comments: "Started working on task"
        };

        const response = await api.post(TASK_TRACKING_CREATE, trackingData);
        setHasStarted(true);

        Toast.show({
          type: "success",
          text1: "Task Started",
          text2: "You can now work on this task.",
          position: "top",
        });
      } catch (error: any) {
        Toast.show({
          type: "error",
          text1: "Start Failed",
          text2: error.response?.data?.error || "Could not start task",
          position: "top",
        });
      }
    }
  }, [taskId, user.id]);

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onClose();
  };

  // current form data as draft
  const saveDraft = useCallback(async () => {
    try {
      setIsSavingDraft(true);
      const formData = watch();

      // Check if there's any data to save
      const hasData = Object.values(formData).some(value =>
        value !== undefined && value !== null && value !== ''
      );

      if (!hasData) {
        Toast.show({
          type: "info",
          text1: "No Data to Save",
          text2: "Form is empty, nothing to save as draft.",
          position: "top",
        });
        return;
      }

      const draftData = {
        formId: Number(formId),
        formTitle: formTitle || "Untitled Form",
        currentStageIndex,
        completedStages: [...completedStages],
        formData,
        // Exclude formStructure from online S3 saves to prevent memory issues with large forms
        // Form structure will be fetched fresh when loading the draft
        // formStructure: {
        //   stages: stages,
        //   form_type: 'multi-stage',
        //   title: formTitle,
        //   name: formTitle,
        // },
        userId: user.id || 0,
        organizationId: (user as any).organizationId || 0,
        sourceScreen: sourceScreen?.startsWith('todo') ? 'todo' : sourceScreen || 'forms',
        taskId: Number(taskId),
      };

      // Save draft directly to S3 only (no local storage for online drafts)
      try {

        // Use original draft_id if editing existing draft, otherwise generate new
        const draftIdToUse = originalDraftId || Math.floor(Math.random() * 900000000) + 100000000; // 9-digit random number

        const s3Payload: any = {
          form_id: Number(formId),
          draft_id: draftIdToUse,
          metadata: draftData,
        };
        const res = await api.post(SAVE_DRAFT, s3Payload);
        // If server returns a draft id, store it locally with a db_draft_ prefix so
        // the draft can be associated with the server record. Otherwise store a local draft id.
        const serverDraftId = res?.data?.draft_id || res?.data?.id || null;
        try {
          await offlineStorageService.storeDraft({ ...draftData, id: serverDraftId ? `db_draft_${serverDraftId}` : undefined });
        } catch (storeErr) {
        }

        Toast.show({
          type: "success",
          text1: "Draft Saved",
          text2: "Your form progress has been saved to cloud.",
          position: "top",
        });

      } catch (s3Error) {
        Toast.show({
          type: "error",
          text1: "Save Failed",
          text2: "Failed to save draft. Please try again.",
          position: "top",
        });
        return; // Don't continue if S3 save failed
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: "Failed to save draft. Please try again.",
        position: "top",
      });
    } finally {
      setIsSavingDraft(false);
    }
  }, [formId, currentStage, currentStageIndex, completedStages, watch, user, stages, formTitle, taskId, draftId, originalDraftId]);

  // Confirm saving draft and go back
  const handleSaveDraftAndBack = useCallback(async () => {
    try {
      setShowDraftConfirmation(false);
      setAllowNavigation(true);
      await saveDraft();
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      setShowDraftConfirmation(false);
      setAllowNavigation(false);
    }
  }, [saveDraft, onClose]);

  // Don't save draft, just go back
  const handleBackWithoutSaving = useCallback(() => {
    setShowDraftConfirmation(false);
    setAllowNavigation(true);
    setTimeout(() => {
      onClose();
    }, 100);
  }, [onClose]);

  // Cancel draft prompt
  const handleCancelDraftPrompt = useCallback(() => {
    setShowDraftConfirmation(false);
  }, []);

  const handlePreview = async () => {
    setShowPreviewOverlay(true);
    try {
      const { isValid, errors: fieldErrors } = await validateAllFields();
      if (!isValid) {
        const errorCount = Object.keys(fieldErrors).filter((key) => fieldErrors[key]).length;
        setValidationErrorCount(errorCount);
        setShowValidationBanner(true);
        // Reset error navigation index and store error keys
        setCurrentErrorIndex(0);
        setErrorFieldKeys(Object.keys(fieldErrors).filter((key) => fieldErrors[key]));
        // Scroll to top to show the banner
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        // Removed Toast - validation banner provides better UX
        return;
      }

      Toast.show({
        type: 'info',
        text1: 'Please preview once the form responses before submission',
        position: 'top',
        visibilityTime: 4000,
      });
      setIsPreview(true);
    } finally {
      setShowPreviewOverlay(false);
    }
  };

  // Handle validation banner click - cycle through errors sequentially
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
      keyboardContainerRef.current?.scrollToInput(targetErrorKey);
    };

    // Wait a moment for any UI updates, then scroll
    setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        scrollDirectlyToField();
      });
    }, 200);
  }, [validateAllFields, currentErrorIndex, errorFieldKeys]);

  const handleStageMenuOpen = (stageIndex: number) => {
    setSelectedStageForEdit(stageIndex);
    setShowStageMenu(true);
  };

  const handleStageMenuClose = () => {
    setShowStageMenu(false);
    setSelectedStageForEdit(null);
  };

  const handleEditStage = (stageIndex: number) => {
    goToStage(stageIndex);
    setShowStageMenu(false);
    setSelectedStageForEdit(null);
    if (stageIndex < currentStageIndex && isFormAssignedToUser) {
      reset();
      resetFormDirty();
      setTimeout(() => populateFormWithExistingData(), 200);
    }
  };

  const handleNextStageTodo = useCallback(async () => {
    if (canEditPreviousStage) {
      setIsInUpdateMode(true);
      setShowSubmittingOverlay(true);
      
      try {
        const { isValid, errors: fieldErrors } = await validateAllFields();
        if (!isValid) {
          setShowSubmittingOverlay(false);
          setIsInUpdateMode(false);
          return;
        }

        const formData = getValues();
        await handleFormSubmission(formData);
        
        setShowSubmittingOverlay(false);
        setIsInUpdateMode(false);
        
        Toast.show({
          type: "success",
          text1: "Stage Updated",
          text2: "Stage data saved successfully.",
          position: "top",
        });
        
        return;
      } catch (error) {
        setShowSubmittingOverlay(false);
        setIsInUpdateMode(false);
        return;
      }
    }

    goToNextStage();
  }, [canEditPreviousStage, validateAllFields, getValues, handleFormSubmission, goToNextStage]);

  const canEditStage = (stageIndex: number) => {
    const stage = stages[stageIndex];
    if (canEditPreviousStage) {
      return stage?.is_completed === true && stageIndex < currentStageIndex;
    }
    if (isFormAssignedToUser) {
      const targetStageOrder = stage?.order || 0;
      const userCompletedStages = stages.filter(s => s.completed_by === user.id && s.is_completed);
      const userMaxCompletedOrder = Math.max(...userCompletedStages.map(s => s.order || 0), 0);
      const userMaxOrder = Math.max(userMaxCompletedOrder, currentStage?.order || 0);
      return userMaxOrder >= targetStageOrder;
    }
    return false;
  };

  // Stub functions for SuccessModal
  const handleShareAction = useCallback(async () => {
  }, []);

  const handleShareToLeaders = useCallback(async () => {
  }, []);

  const handleMakePdf = useCallback(async () => {
  }, []);

  const handleViewSubmission = useCallback(async () => {
  }, []);

  // Load form data — independent effect so it doesn't re-run when task detail
  // or user fetch callbacks change identity.  A ref guard prevents duplicate
  // calls (React Strict Mode double-invoke or param resolution changes).
  const formStagesLoadedRef = useRef(false);
  useEffect(() => {
    if (formStagesLoadedRef.current) return;
    if (!formId) return;
    formStagesLoadedRef.current = true;
    getFormStages();
  }, [getFormStages, formId]);

  // Load users — stable callback, runs once
  useEffect(() => {
    getUsers();
  }, [getUsers]);

  // Load task details — independent effect
  useEffect(() => {
    getTaskDetails();
  }, [getTaskDetails]);

  // Load draft data when draftId is provided
  useEffect(() => {
    const loadDraftData = async () => {
      if (!draftId || !user?.id) return;

      try {

        // First try to load from backend using the draft ID
        let draft = await offlineStorageService.loadDraftFromBackend(draftId);

        // If not found in database, fall back to local storage by form ID
        if (!draft) {
          draft = await offlineStorageService.getDraftForForm(Number(formId), user.id);
          if (draft && draft.id === draftId) {
          }
        }

        if (draft && draft.id === draftId) {
          setDraft(draft.formData);

          // Extract and store the original draft_id for updating later
          if (draft.id && draft.id.startsWith('db_draft_')) {
            const numericDraftId = parseInt(draft.id.replace('db_draft_', ''), 10);
            setOriginalDraftId(numericDraftId);
          }

          // Populate form with draft data
          setTimeout(() => {
            // Use reset to populate all form fields at once
            const draftData = { ...draft.formData };
            reset(draftData);
            resetFormDirty();

            // Also restore the stage if possible
            if (draft.currentStageIndex !== undefined) {
              setTimeout(() => goToStage(draft.currentStageIndex), 500);
            }

            // Show draft loaded notification
            Toast.show({
              type: "info",
              text1: "Draft Loaded",
              text2: "Your saved draft has been loaded.",
              position: "top",
            });
          }, 800); // Increased delay to ensure form fields are rendered
        } else {
        }
      } catch (error) {
        // Only show error if online, otherwise draft might still work with cached data
        if (!networkService.isOffline()) {
          Toast.show({
            type: "error",
            text1: "Draft Load Failed",
            text2: "Failed to load draft data.",
            position: "top",
          });
        }
      }
    };

    if (draftId) {
      loadDraftData();
    }
  }, [draftId, formId, user?.id]);

  useEffect(() => {
    if (stages.length > 0) {
      if (draftData) {
        populateFromDraft();
      } else if (!draftId) {
        // Only populate from existing data if we don't have a draftId (draft loading handles its own population)
        populateFormWithExistingData();
      }
    }
  }, [stages, populateFormWithExistingData, populateFromDraft, draftData, draftId]);

  // Trigger endpoint when formSubmissionId changes (after successful form submission)
  // Use ref to prevent multiple calls for this component instance
  const triggerCalledRef = useRef<boolean>(false);

  useEffect(() => {
    const callTriggerEndpoint = async () => {
      // Only call once per component instance when we have a valid submission ID
      if (triggerCalledRef.current || !formSubmissionId) {
        return;
      }

      // Do not trigger followup tasks when simply viewing an existing submission
      if (submissionId || sourceScreen === "sent") {
        return;
      }
      // Mark as called to prevent any future calls
      triggerCalledRef.current = true;

      try {

        const triggerResponse = await api.post(TRIGGER_FOLLOWUP_TASKS, {
          form_id: Number(formId),
          main_form_submission_id: formSubmissionId,
          followup_task_form_id: Number(formId)
        });

        if (triggerResponse.data && triggerResponse.data.tasks) {
        } else if (triggerResponse.status === 200) {
        }
      } catch (triggerError: any) {

        if (
          triggerError?.response?.status === 400 &&
          triggerError?.response?.data?.missing_logic_followup_ids
        ) {
          Alert.alert(
            "Follow-up Required",
            triggerError?.response?.data?.error ||
              "Please create followup tasks for required questions before submitting.",
          );
          return;
        }

        if (triggerError?.response?.status === 500) {
        } else if (triggerError?.response?.status === 404) {
        }
      }
    };

    callTriggerEndpoint();
  }, [formSubmissionId, formId, submissionId, sourceScreen]); // Include formId to ensure proper dependencies

  useEffect(() => {
    setCurrentFormId(formId);
    return () => {
      setCurrentFormId(undefined);
    };
  }, [formId, setCurrentFormId]);

  // Register the back press handler for the header back button
  useEffect(() => {
    setOnBackPress(() => handleBackPress);
    return () => {
      setOnBackPress(undefined);
    };
  }, [setOnBackPress, handleBackPress]);

  // Show app header back button while todo form is open
  useEffect(() => {
    try {
      setShowBackButton(true);
    } catch (e) {
      // ignore if context not available
    }
    return () => {
      try {
        setShowBackButton(false);
      } catch (e) {}
    };
  }, [setShowBackButton]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [handleBackPress]);

  const allQuestions = useMemo(() => {
    return stages.flatMap((stage) => stage.questions || []);
  }, [stages]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={getFormStages}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stages.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No stages available for this form</Text>
      </View>
    );
  }

  return (
    <PreviousSubmissionsContext.Provider value={previousSubmissionsData}>
    <View style={styles.screenContainer}>
      <View style={styles.header}>
        <TouchableOpacity>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {formTitle ? (
            <Text style={styles.formTitle}>{formTitle}</Text>
          ) : null}
        </View>
      </View>

          {/* Start button removed from form - users must start from TaskSummaryScreen first */}

      <KeyboardAwareContainer
        ref={keyboardContainerRef}
        formType={formType as any}
        style={styles.container}
      >
        <FormContainerContext.Provider value={keyboardContainerRef as React.RefObject<import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef>}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.formContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
            onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
          >
          <ValidationErrorBanner
            errorCount={validationErrorCount}
            visible={showValidationBanner}
            onPress={handleValidationBannerClick}
            currentErrorIndex={currentErrorIndex}
            totalErrors={errorFieldKeys.length}
          />

          <View style={styles.stageIndicatorContainer}>
            <View style={styles.stageIndicator}>
              <StageIndicator
                stages={stages}
                currentStageIndex={currentStageIndex}
                completedStages={completedStages}
                onStagePress={goToStage}
                isToggleEnabled={true}
                isFormAssignedToUser={isFormAssignedToUser}
                onStageMenuPress={handleStageMenuOpen}
              />
            </View>
            {/* Reopen Button for followup tasks in SENT submissions */}
            {sourceScreen === 'sent' && (
              <TouchableOpacity style={styles.reopenActionButton} onPress={() => setShowReopenModal(true)}>
                <Text style={styles.reopenActionButtonText}>Reopen</Text>
              </TouchableOpacity>
            )}
          </View>

          <Accordion title={currentStage?.name || "Loading..."} isCompleted={completedStages.includes(currentStageIndex)}>
            {!submitting ? (
              currentStage?.questions?.map((question: any) => {
                const qUuid = question.question_uuid;
                return (
                  <QuestionItem
                    key={qUuid}
                    question={question}
                    stage={currentStage}
                    control={control}
                    errors={errors}
                    setValue={setValue}
                    allQuestions={allQuestions}
                    focusedInputKey={focusedInputKeyRef.current}
                    validationErrors={validationErrors}
                    isVisible={visibleQuestions.has(qUuid)}
                    isPreview={isPreview}
                    hasStarted={hasStarted}
                    submissionId={submissionId}
                    sourceScreen={sourceScreen}
                    handleInputFocus={handleInputFocus}
                  />
                );
              }) || <Text>No questions</Text>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196f3" />
              </View>
            )}
          </Accordion>

          {/* {!hasStarted && (taskStartDate || taskEndDate) && (
            <View style={styles.todoTaskInfo}>
              <View style={styles.dateContainer}>
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>Start Date:</Text>
                  <Text style={styles.dateValue}>{taskStartDate ? new Date(taskStartDate).toLocaleDateString() : ''}</Text>
                </View>
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>End Date:</Text>
                  <Text style={styles.dateValue}>{taskEndDate ? new Date(taskEndDate).toLocaleDateString() : ''}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.startButton} onPress={handleStartForm}>
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
          )} */}

          {/* Hide buttons for sent forms since they are completed and read-only */}
          {(hasStarted || sourceScreen === 'todo-receive' || (submissionId && sourceScreen !== 'sent')) && (
            <View style={styles.buttonContainer}>
              {!singleStageSubmit && !isFirstStage && (
                <TouchableOpacity style={styles.button} onPress={goToPrevStage}>
                  <Text style={styles.buttonText}>Previous</Text>
                </TouchableOpacity>
              )}
              {!singleStageSubmit && !isLastStage && !taskId && (
                <TouchableOpacity style={styles.button} onPress={handleNextStageTodo}>
                  <Text style={styles.buttonText}>
                    {canEditPreviousStage ? "Update" : "Next"}
                  </Text>
                </TouchableOpacity>
              )}
              {/* For todo forms (including received todos), show Save as Draft and Preview buttons immediately */}
              {(taskId || sourceScreen === 'todo-receive' || submissionId) ? (
                <>
                <View style={styles.footerButtonRow}>
                  {isOnline && sourceScreen !== 'todo-receive' && !isFollowupTask && (
                    <TouchableOpacity
                      style={[styles.button, styles.draftStyleButton, styles.footerBtn]}
                      onPress={() => setShowDraftConfirmation(true)}
                    >
                      <MaterialIcons name="save" size={18} color="white" style={{ marginRight: 6 }} />
                      <Text style={styles.buttonText}>Draft</Text>
                    </TouchableOpacity>
                  )}
                  {sourceScreen === 'todo-receive' ? (
                    // For received todos, show submit button directly without preview requirement
                    <TouchableOpacity
                      style={[styles.button, styles.nextButton, submitting && styles.disabledButton, styles.footerBtn]}
                      onPress={handleFormSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.buttonText}>Submitting...</Text>
                        </>
                      ) : (
                        <Text style={styles.buttonText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    // For other forms, use preview/edit flow
                    !isPreview ? (
                      <TouchableOpacity
                        style={[styles.button, styles.nextButton, styles.footerBtn]}
                        onPress={handlePreview}
                      >
                        <MaterialIcons name="visibility" size={18} color="white" style={{ marginRight: 6 }} />
                        <Text style={styles.buttonText}>Preview</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.button, styles.footerBtn]}
                          onPress={() => setIsPreview(false)}
                        >
                          <MaterialIcons name="edit" size={18} color="white" style={{ marginRight: 6 }} />
                          <Text style={styles.buttonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.nextButton, submitting && styles.disabledButton, styles.footerBtn]}
                          onPress={handleFormSubmit}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                              <Text style={styles.buttonText}>Submitting...</Text>
                            </>
                          ) : (
                            <Text style={styles.buttonText}>Submit</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )
                  )}
                </View>
                </>
              ) : (
                /* For regular forms, show buttons based on stage position */
                (isLastStage || singleStageSubmit) && (
                  <>
                  <View style={styles.footerButtonRow}>
                    {!isPreview ? (
                      <TouchableOpacity
                        style={[styles.button, styles.nextButton, styles.footerBtn]}
                        onPress={handlePreview}
                      >
                        <MaterialIcons name="visibility" size={18} color="white" style={{ marginRight: 6 }} />
                        <Text style={styles.buttonText}>Preview</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.button, styles.footerBtn]}
                          onPress={() => setIsPreview(false)}
                        >
                          <MaterialIcons name="edit" size={18} color="white" style={{ marginRight: 6 }} />
                          <Text style={styles.buttonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.nextButton, submitting && styles.disabledButton, styles.footerBtn]}
                          onPress={handleFormSubmit}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                              <Text style={styles.buttonText}>Submitting...</Text>
                            </>
                          ) : (
                            <Text style={styles.buttonText}>Submit</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  </>
                )
              )}
            </View>
          )}

          {(currentStage?.is_completed || currentStage?.edited_on) && (
            <View style={styles.completedInfo}>
              {currentStage?.is_completed && (
                <>
                  <Text style={styles.stageHeaderText}>Completed</Text>
                  <View style={styles.completedInfoRow}>
                    <MaterialIcons name="person" size={20} color="#007AFF" style={styles.completedInfoIcon} />
                    <Text style={styles.completedText}>
                      Completed by: {completedByUser ? `${completedByUser.username}, ${completedByUser.department_details?.description || "N/A"}` : "N/A"}
                    </Text>
                  </View>
                  <View style={styles.completedInfoRow}>
                    <MaterialIcons name="event" size={20} color="#007AFF" style={styles.completedInfoIcon} />
                    <Text style={styles.completedText}>
                      Completed on: {new Date(currentStage.completed_on ?? "").toLocaleString() || "N/A"}
                    </Text>
                  </View>
                  {currentStage?.edited_on && <View style={styles.infoSeparator} />}
                </>
              )}
              {currentStage?.edited_on && (
                <>
                  <Text style={styles.stageHeaderText}>Edited</Text>
                  <View style={styles.completedInfoRow}>
                    <MaterialIcons name="edit" size={20} color="#007AFF" style={styles.completedInfoIcon} />
                    <Text style={styles.completedText}>
                      Edited by: {editedByUser ? `${editedByUser.username}, ${editedByUser.department_details?.description || "N/A"}` : "N/A"}
                    </Text>
                  </View>
                  <View style={styles.completedInfoRow}>
                    <MaterialIcons name="event" size={20} color="#007AFF" style={styles.completedInfoIcon} />
                    <Text style={styles.completedText}>
                      Edited on: {new Date(currentStage.edited_on).toLocaleString()}
                    </Text>
                  </View>
                </>
              )}


            </View>
          )}
        </ScrollView>
        </FormContainerContext.Provider>
      </KeyboardAwareContainer>

      <SuccessModal
        visible={showSuccessModal}
        onClose={handleSuccessClose}
        onShare={handleShareAction}
        onShareToLeaders={handleShareToLeaders}
        onMakePdf={handleMakePdf}
        onViewSubmission={handleViewSubmission}
        users={users}
        isGeneratingPdf={false}
        submittedData={undefined}
      />

      {showPreviewOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Preparing preview...</Text>
          </View>
        </View>
      )}

      {showSubmittingOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Submitting...</Text>
          </View>
        </View>
      )}

      {/* Draft Confirmation Modal */}
      {showDraftConfirmation && (
        <View style={styles.modalOverlay}>
          <View style={styles.draftModal}>
            <View style={styles.draftModalHeader}>
              <MaterialIcons name="save" size={22} color="#007AFF" />
              <Text style={styles.draftModalTitle}>Save Draft?</Text>
            </View>
            <Text style={styles.draftModalMessage}>
              Save your progress before leaving?
            </Text>
            <View style={styles.draftModalButtons}>
              <TouchableOpacity
                style={[styles.draftButton, styles.saveDraftButton]}
                onPress={handleSaveDraftAndBack}
                disabled={isSavingDraft}
              >
                <MaterialIcons name="save" size={18} color="white" />
                <Text style={styles.draftButtonText}>
                  {isSavingDraft ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.draftButton, styles.discardButton]}
                onPress={handleBackWithoutSaving}
              >
                <MaterialIcons name="close" size={18} color="white" />
                <Text style={styles.draftButtonText}>Discard</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelDraftPrompt}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showStageMenu && selectedStageForEdit !== null && (
        <View style={styles.modalOverlay}>
          <View style={styles.stageMenuModal}>
            <View style={styles.stageMenuHeader}>
              <Text style={styles.stageMenuTitle}>
                Stage {selectedStageForEdit + 1}: {stages[selectedStageForEdit]?.name || 'Unknown Stage'}
              </Text>
              <TouchableOpacity onPress={handleStageMenuClose} style={styles.stageMenuCloseButton}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.stageMenuContent}>
              {canEditStage(selectedStageForEdit) ? (
                <TouchableOpacity
                  style={[styles.stageMenuOption, selectedStageForEdit === currentStageIndex && styles.stageMenuOptionDisabled]}
                  onPress={() => handleEditStage(selectedStageForEdit)}
                  disabled={selectedStageForEdit === currentStageIndex}
                >
                  <MaterialIcons name="edit" size={20} color={selectedStageForEdit === currentStageIndex ? "#CCC" : "#007AFF"} style={styles.stageMenuIcon} />
                  <Text style={[styles.stageMenuOptionText, selectedStageForEdit === currentStageIndex && styles.stageMenuOptionTextDisabled]}>
                    {selectedStageForEdit === currentStageIndex ? "Currently Editing" : "Edit Stage"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.stageMenuOption, styles.stageMenuOptionDisabled]}>
                  <MaterialIcons name="edit-off" size={20} color="#CCC" style={styles.stageMenuIcon} />
                  <Text style={[styles.stageMenuOptionText, styles.stageMenuOptionTextDisabled]}>
                    {canEditPreviousStage
                      ? selectedStageForEdit === currentStageIndex
                        ? "Currently on this stage"
                        : stages[selectedStageForEdit]?.is_completed
                          ? selectedStageForEdit < currentStageIndex
                            ? "Edit Stage"
                            : "Cannot edit completed stage"
                          : "Stage not yet submitted"
                      : stages[selectedStageForEdit]?.is_completed
                        ? "Cannot edit completed stage"
                        : "Stage not available for editing"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      <Toast />

      {/* Related Tasks Selector */}
      <RelatedTasksSelector
        visible={showRelatedTasksSelector}
        taskId={taskId}
        onClose={() => {
          setShowRelatedTasksSelector(false);
          pendingSubmitMobileRef.current?.([]);
          pendingSubmitMobileRef.current = null;
        }}
        onConfirm={(selectedIds) => {
          setShowRelatedTasksSelector(false);
          pendingSubmitMobileRef.current?.(selectedIds);
          pendingSubmitMobileRef.current = null;
        }}
      />

      {/* Reopen Submission Modal */}
      <ReopenSubmissionModal
        visible={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        taskId={taskId}
        submissionId={submissionId || ''}
        onReopenSuccess={() => {
          setShowReopenModal(false);
          // Refresh the form data or navigate back
          Toast.show({
            type: 'success',
            text1: 'Task Reopened',
            text2: 'The followup task has been reopened and reassigned.',
            position: 'top'
          });
          // Optionally refresh the data or navigate back
          setTimeout(() => {
            onClose();
          }, 1500);
        }}
      />
    </View>
    </PreviousSubmissionsContext.Provider>
  );
};

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#fff' },
formTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 6,
    color: "#2196f3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderLeftWidth: 6,
    borderLeftColor: "#2196f3",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },

  // 2. Tighten the todo task info section (dates + Start button)
  todoTaskInfo: {
    paddingVertical: 8,     // ← reduced from 20
    paddingHorizontal: 16,
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },

  datesAndButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  dateContainer: {
    flexShrink: 1,
  },

  dateText: {
    fontSize: 14,
    color: '#666',
  },

  startButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexShrink: 0,
  },

  startButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: '600',
  },
  reopenButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexShrink: 0,
  },
  reopenButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: '600',
  },
  reopenButtonContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  reopenActionButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 80,
  },
  reopenActionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // 3. Reduce top padding of the scroll content so the accordion starts closer
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  draftModal: { width: "85%", maxWidth: 400, backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", shadowColor: "#f31515ff", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  draftModalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  draftModalTitle: { ...typography.titleMedium, color: textColors.primary, marginLeft: 10 },
  draftModalMessage: { ...typography.bodyMedium, color: textColors.secondary, textAlign: "center", marginBottom: 20 },
  draftModalButtons: { flexDirection: "row", width: "100%", marginBottom: 12, paddingHorizontal: 4 },
  draftButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, marginHorizontal: 4, minHeight: 44 },
  saveDraftButton: { backgroundColor: "#007AFF" },
  discardButton: { backgroundColor: "#FF3B30" },
  draftButtonText: { ...typography.labelMedium, color: textColors.white, marginLeft: 6 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelButtonText: { ...typography.labelLarge, color: textColors.link },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  startButtonContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  taskDatesContainer: {
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  taskDateText: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  container: { flex: 1 },
  // scrollContent: {
  //   paddingTop: 8,
  // },
  formContainer: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  closeButton: {
    backgroundColor: "#666",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonText: {
    fontSize: 12,
    color: textColors.white,
    fontWeight: "600",
  },
  stageIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  stageIndicator: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 6,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 16,
    marginBottom: 0, // Ensures consistent spacing
  },
  tripleButtonContainer: {
    flexDirection: "column",
    marginHorizontal: 16,
    marginVertical: 16,
    marginLeft: 50,
    alignItems: "stretch",
    alignSelf: "stretch",
    paddingHorizontal: 16,
  },
  footerButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  footerBtn: {
    flex: 1,
    marginHorizontal: 3,
    minHeight: 40,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  draftStyleButton: {
    backgroundColor: "#FFA500",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 40,
    minWidth: 0,
    flex: 1,
    marginHorizontal: 3,
  },
  submitButton: {
    backgroundColor: "#34C759",
    flex: 2,
  },
  nextButton: { backgroundColor: "#34C759" },
  disabledButton: { backgroundColor: "#C7C7CC" },
  stackedButton: {
    marginVertical: 8,
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    flex: 0, // Override flex to use explicit width
  },
  previewButtonContainer: {
    width: "100%",
  },
  editButton: {
    backgroundColor: "#007AFF",
  },
  submittingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  submittingModal: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  submittingText: {
    ...typography.labelLarge,
    marginTop: 15,
    color: textColors.primary,
  },
  // startButton: {
  //   paddingVertical: 8,
  //   paddingHorizontal: 16,
  //   marginLeft: 8,
  //   flexShrink: 0,
  // },
  // startButtonText: {
  //   color: "#007AFF",
  //   fontSize: 16,
  //   fontWeight: 'bold',
  // },
  taskInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  // dateText: {
  //   fontSize: 14,
  //   color: '#666',
  //   marginRight: 16,
  // },
  // datesAndButtonRow: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   width: '100%',
  //   paddingHorizontal: 16,
  // },
  // todoTaskInfo: {
  //   flex: 1,
  //   justifyContent: "center",
  //   alignItems: "center",
  //   padding: 20,
  // },
  // dateContainer: {
  //   flexShrink: 1,
  // },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  dateValue: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  stageMenuModal: { width: "90%", backgroundColor: "#fff", borderRadius: 10, padding: 16, maxHeight: "60%" },
  stageMenuHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  stageMenuTitle: { ...typography.titleMedium, color: textColors.primary, flex: 1 },
  stageMenuCloseButton: { padding: 5 },
  stageMenuContent: { flex: 1 },
  stageMenuOption: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, marginBottom: 8, borderRadius: 8, backgroundColor: "#F8F9FA" },
  stageMenuOptionDisabled: { backgroundColor: "#F5F5F5", opacity: 0.6 },
  stageMenuIcon: { marginRight: 15 },
  stageMenuOptionText: { ...typography.labelLarge, color: textColors.primary },
  stageMenuOptionTextDisabled: { color: "#999" },
  completedInfo: { padding: 12, borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10, backgroundColor: "#F9FAFB", marginHorizontal: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, marginBottom: 8 },
  completedInfoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  completedInfoIcon: { marginRight: 10, marginTop: 2 },
  completedText: { ...typography.labelMedium, color: textColors.primary, fontWeight: "700", flex: 1, flexWrap: "wrap" },
  stageHeaderText: { ...typography.titleSmall, color: textColors.link, marginBottom: 10, textAlign: "center" },
  infoSeparator: { height: 1, backgroundColor: "#E0E0E0", marginVertical: 8, marginHorizontal: 5 },
});

export default TodoMultiStageFormScreen;
