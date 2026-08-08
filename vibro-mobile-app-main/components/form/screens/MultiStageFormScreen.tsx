import { MaterialIcons } from "@expo/vector-icons";
import { addDays, format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import * as Sharing from "expo-sharing";
import React, {
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
  Dimensions,
  FlatList,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { ToggleContext } from "../../../app/(app)/_layout";
import KeyboardAwareContainer, {
  KeyboardAwareContainerRef,
} from "../../../components/KeyboardAwareContainer";
import { fetchFormReceived } from "../../../Redux/actions/formReceivedActions";
import { RootState } from "../../../Redux/reducer/rootReducer";
import api from "../../../services";
import { performBulkAssignment } from "../../../services/bulkAssignmentService";
import {
  FORM,
  GETFORMSUBMISSIONDETAILS,
  LOCATION_LEADERS_LIST,
  SAVE_DRAFT,
  TRIGGER_FOLLOWUP_TASKS,
  USERS_LIST,
} from "../../../services/constants";
import { networkService } from "../../../services/networkService";
import { offlineStorageService } from "../../../services/offlineStorageService";
import { backgroundSyncService } from "../../../services/backgroundSyncService";
import {
  fetchFormMetadata,
  fetchFormStages,
  loadCachedStage,
  saveCachedStage,
  saveCachedMetadata,
  loadCachedMetadata,
  getCachedStageOrders,
  assembleFormFromCache,
  updateCacheTimestamp,
  clearFormCache,
} from "../../../services/formCacheService";
import { SecureStoreService } from "../../../services/secureStore";
import Accordion from "../Accordion/Accordion";
import StageIndicator from "../Accordion/StageIndicator";
import FormField, { FormContainerContext } from "../FormFields/FormField";
import { PreviousSubmissionsContext } from "../FormFields/FormFieldWrapper";
import SignatureField from "../FormFields/SignatureField";
import TableField from "../FormFields/TableField";
import { useMultiStageForm } from "../hooks/useMultiStageForm";
import { usePreviousSubmissions } from "../hooks/usePreviousSubmissions";
import SuccessModal from "../SuccessModal";
import { Stage, SubmissionsDetail } from "../types/formTypes";
import ValidationErrorBanner from "../ValidationErrorBanner";

interface MultiStageFormScreenProps {
  formId: string;
  submissionId?: string;
  stageId?: string;
  editMode?: string;
  sourceScreen?: string;
  todoStarted?: boolean;
  todoDisabled?: boolean;
  onClose?: () => void;
  plannerAssignmentId?: string;
  plannerLocation?: string;
  plannerLocationId?: string;
  plannerOrderId?: string;
  formTitle?: string;
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

interface Group {
  id: number;
  name: string;
}

interface CommonFieldProps {
  question: any;
  control: any;
  errors: any;
  isCompleted?: boolean;
  hasError?: boolean;
  isEditable?: boolean;
}

interface FormFieldProps extends CommonFieldProps {
  allValues: any;
  allQuestions: any[];
  setValue: any;
}

interface TableFieldProps extends CommonFieldProps {}

const MultiStageFormScreen: React.FC<MultiStageFormScreenProps> = ({
  formId: propFormId,
  submissionId: propSubmissionId,
  stageId: propStageId,
  editMode: propEditMode,
  sourceScreen: propSourceScreen,
  todoStarted: propTodoStarted,
  todoDisabled: propTodoDisabled,
  onClose: propOnClose,
  plannerAssignmentId: propPlannerAssignmentId,
  plannerLocation: propPlannerLocation,
  plannerLocationId: propPlannerLocationId,
  plannerOrderId: propPlannerOrderId,
  formTitle: propFormTitle,
}) => {
  const isDropdownLikeQuestionType = (questionType?: string) =>
    questionType === "dropdown" ||
    questionType === "user" ||
    questionType === "division" ||
    questionType === "sub_division" ||
    questionType === "location";

  const STAGE_APPROVAL_ERROR_KEY = "__stage_approval__";
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const formId = propFormId || (params.formId as string);
  const submissionId =
    propSubmissionId || (params.submissionId as string | undefined);
  const stageId = propStageId || (params.stageId as string | undefined);
  const editMode = propEditMode || (params.editMode as string | undefined);
  const viewMode = params.viewMode as string | undefined;
  const fromNotification = params.fromNotification as string | undefined;
  const draftId = params.draftId as string | undefined;
  const sourceScreen =
    propSourceScreen || (params.sourceScreen as string | undefined);
  const mainFormId = params.mainFormId as string | undefined; // Main form ID for followup tasks
  const plannerLocation = (params.plannerLocation as string | undefined) || propPlannerLocation;
  const plannerLocationId = (params.plannerLocationId as string | undefined) || propPlannerLocationId;
  const plannerOrderId = (params.plannerOrderId as string | undefined) || propPlannerOrderId;
  const plannerAssignmentId = (params.plannerAssignmentId as string | undefined) || propPlannerAssignmentId;
  const isEditMode = editMode === "true";
  const isViewMode = viewMode === "true" || fromNotification === "true";
  const isFromNotification = fromNotification === "true";
  const returnToSharedOnly = params.returnToSharedOnly as string | undefined;
  const notificationReturnPath =
    params.notificationReturnPath as string | undefined;
  const isSentScreen = sourceScreen === "sent";

  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSendToNext, setShowSendToNext] = useState(false); // Replaces showSendButton
  const [sendInProgress, setSendInProgress] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"user" | "groups" | "leaders">(
    "user",
  );
  const [formSubmissionId, setFormSubmissionId] = useState<number | undefined>(
    undefined,
  );
  const submissionIdRef = useRef<number | undefined>(undefined);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [submissionsDetail, setSubmissionsDetail] =
    useState<SubmissionsDetail>();
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [triggeredByShare, setTriggeredByShare] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [selectedStageForEdit, setSelectedStageForEdit] = useState<
    number | null
  >(null);
  const [previousStageEditCeilingIndex, setPreviousStageEditCeilingIndex] =
    useState<number | null>(null);
  const [isEditButtonClicked, setIsEditButtonClicked] = useState(false);
  const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null);
  const focusedInputKeyRef = useRef<string | null>(null);
  const [showSubmittingOverlay, setShowSubmittingOverlay] = useState(false);
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [showAssigningOverlay, setShowAssigningOverlay] = useState(false);
  const [showDraftConfirmation, setShowDraftConfirmation] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [assignedFormTitle, setAssignedFormTitle] = useState<string>("");
  const [draft, setDraft] = useState<any>(null);
  const [isDraftLoading, setIsDraftLoading] = useState<boolean>(!!draftId);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [originalDraftId, setOriginalDraftId] = useState<number | null>(null);
  const [formType, setFormType] = useState<string>("");
  const [isPreview, setIsPreview] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [errorFieldKeys, setErrorFieldKeys] = useState<string[]>([]);
  const [autoExpandAuditQuestionKey, setAutoExpandAuditQuestionKey] =
    useState<string | null>(null);
  const [
    autoExpandMultipleChoiceQuestionKey,
    setAutoExpandMultipleChoiceQuestionKey,
  ] = useState<string | null>(null);
  const [autoExpandDropdownQuestionKey, setAutoExpandDropdownQuestionKey] =
    useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(!networkService.isOffline());
  const [canEditPreviousStateEnabled, setCanEditPreviousStateEnabled] =
    useState(false);
  const [collapsedFollowUpTasks, setCollapsedFollowUpTasks] = useState<
    Record<string, boolean>
  >({});
  const [hasJustBeenSubmitted, setHasJustBeenSubmitted] = useState(false); // Track if form was just submitted to prevent draft prompts
  const [isFullyCompletedMultiStageForm, setIsFullyCompletedMultiStageForm] =
    useState(false); // Track if this is a fully completed multi-stage form
  // rely on react-hook-form's isDirty instead of custom JSON comparisons
  const [stageApprovalDecision, setStageApprovalDecision] = useState<
    Record<number, "accepted" | "rejected" | null>
  >({});
  const [stageApprovalRemarks, setStageApprovalRemarks] = useState<
    Record<number, string>
  >({});

  // Task Dialog States
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(0);
  const [assignForm, setAssignForm] = useState<number | null>(null);
  const [assignFormName, setAssignFormName] = useState<string>("");
  const [assignUsers, setAssignUsers] = useState<number[]>([]);
  const [assignGroups, setAssignGroups] = useState<number[]>([]);
  const [assignUserNames, setAssignUserNames] = useState<string[]>([]);
  const [assignGroupNames, setAssignGroupNames] = useState<string[]>([]);
  const [assignLocationLeaders, setAssignLocationLeaders] = useState<number[]>(
    [],
  );
  const [assignLocationLeaderNames, setAssignLocationLeaderNames] = useState<
    string[]
  >([]);
  const [taskUserSearchQuery, setTaskUserSearchQuery] = useState("");
  const [taskGroupSearchQuery, setTaskGroupSearchQuery] = useState("");
  const [taskLocationLeaderSearchQuery, setTaskLocationLeaderSearchQuery] =
    useState("");
  const [taskFormSearchQuery, setTaskFormSearchQuery] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showLocationLeaderDropdown, setShowLocationLeaderDropdown] =
    useState(false);
  const [showFormDropdown, setShowFormDropdown] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [locationLeaders, setLocationLeaders] = useState<any[]>([]);

  const [parentFormId, setParentFormId] = useState<number | null>(null);

  // Temporary follow-up tasks state - now keyed by parent question UUID
  const [temporaryFollowUpTasks, setTemporaryFollowUpTasks] = useState<{
    [questionUuid: string]: any[];
  }>({});
  const [forceRefresh, setForceRefresh] = useState(0);

  // Track which question's "Add Follow-Up Task" button was clicked
  const [currentTaskQuestionUuid, setCurrentTaskQuestionUuid] = useState<
    string | null
  >(null);

  // Track LogicFollowUp id and parent Question id for Scenario 2 (mobile-created tasks)
  // Ensures each task gets correct follow_task_sub_question_id / logic_followup_id in backend
  const [currentTaskLogicFollowUpId, setCurrentTaskLogicFollowUpId] = useState<
    number | null
  >(null);
  const [currentTaskParentQuestionId, setCurrentTaskParentQuestionId] =
    useState<number | null>(null);
  // Refs so Save uses values from when modal opened (avoids stale state)
  const currentTaskLogicFollowUpIdRef = useRef<number | null>(null);
  const currentTaskParentQuestionIdRef = useRef<number | null>(null);
  const stagesRef = useRef<Stage[]>([]);
  const submitInFlightRef = useRef(false);
  const lastSubmitDataRef = useRef<any | null>(null);
  const queuedBackgroundSubmissionIdRef = useRef<string | null>(null);
  const isQueueingBackgroundSubmissionRef = useRef(false);
  const shouldForceSyncAfterSubmitRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isLoadingFormRef = useRef(false);
  const shouldRetryLoadOnActiveRef = useRef(false);
  const formLoadRetryCountRef = useRef(0);
  const loadedStageOrdersRef = useRef<Set<number>>(new Set());
  const backgroundLoadInProgressRef = useRef(false);
  const allStageOrdersRef = useRef<number[]>([]);
  const formMetadataRef = useRef<any>(null);

  // Track which stages have already triggered their follow-up tasks
  const [triggeredStages, setTriggeredStages] = useState<Set<number>>(
    new Set(),
  );

  // Edit Follow-Up Task states (similar to AuditFormScreen)
  const [currentEditingTask, setCurrentEditingTask] = useState<any>(null);
  const [isEditingWebTask, setIsEditingWebTask] = useState(false);

  // Edited web tasks state for backend submission (similar to AuditFormScreen)
  const [editedWebTasks, setEditedWebTasks] = useState<any[]>([]);
  const editedWebTasksRef = useRef<any[]>([]);

  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  const getQuestionIdByUuid = useCallback((questionUuid: string | null) => {
    if (!questionUuid) return null;
    const allQuestions = (stagesRef.current || []).flatMap(
      (s: any) => s?.questions || [],
    );
    for (const q of allQuestions) {
      if (q?.question_uuid === questionUuid && q?.id != null)
        return Number(q.id);
    }
    return null;
  }, []);

  const getFollowupLogicIdByQuestion = useCallback(
    (questionUuid: string | null) => {
      if (!questionUuid) return null;
      const allQuestions = (stagesRef.current || []).flatMap(
        (s: any) => s?.questions || [],
      );
      for (const q of allQuestions) {
        if (q?.question_uuid !== questionUuid) continue;
        const toggleLogic = q?.logics?.find((l: any) => l?.followup_toggle);
        if (toggleLogic?.id != null) return Number(toggleLogic.id);
        const followupLogic = q?.logics?.find((l: any) => l?.follow_up);
        if (followupLogic?.id != null) return Number(followupLogic.id);
      }
      return null;
    },
    [],
  );

  // Create task function - moved before useEffect that uses it
  const createTaskWithData = useCallback(
    async (taskData: any) => {
      const {
        title,
        description,
        deadline,
        assign_users,
        assign_groups,
        assign_form,
      } = taskData;

      if (!title.trim()) {
        return;
      }

      if (deadline < 0) {
        return;
      }

      try {
        // Calculate start_date and end_date
        const today = new Date();
        const startDate = format(today, "yyyy-MM-dd") + "T00:00:00.000Z";
        const endDate =
          format(addDays(today, deadline), "yyyy-MM-dd") + "T00:00:00.000Z";
        // Determine the main form ID: use mainFormId if available (from navigation), otherwise parentFormId or current formId
        const mainFormIdValue = mainFormId
          ? Number(mainFormId)
          : Number(parentFormId || formId);

        const payload = {
          task_name: title,
          description: description,
          start_date: startDate,
          end_date: endDate,
          form: assign_form, // The assigned form user needs to fill
          followup_task_form_id: mainFormIdValue, // The main form ID that triggered this followup
          // form_submission_id: formSubmissionId,
        };

        const createdFollowUpTaskResponse = await api.post("/tasks/", payload);
        const taskId =
          createdFollowUpTaskResponse.data?.task_id ||
          createdFollowUpTaskResponse.data?.id;

        // Share task with assigned users and groups if any are assigned
        if ((assign_users?.length > 0 || assign_groups?.length > 0) && taskId) {
          try {
            const sharePayload = {
              users: assign_users,
              groups: assign_groups,
            };

            const shareFollowUpTaskResponse = await api.post(
              `/tasks/${taskId}/share/`,
              sharePayload,
            );
          } catch (shareError: any) {
            // Don't fail the entire operation if sharing fails, just log the error
          }
        }

        return true;
      } catch (error: any) {
        return false;
      }
    },
    [parentFormId, formId, mainFormId],
  );
  const temporaryTasksRef = useRef<any[]>([]);

  useEffect(() => {
    setIsEditButtonClicked(false);
  }, [formId, submissionId]);

  useEffect(() => {
    const show = () => setIsKeyboardVisible(true);
    const hide = () => setIsKeyboardVisible(false);
    const subs = [
      Keyboard.addListener("keyboardWillShow", show),
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardWillHide", hide),
      Keyboard.addListener("keyboardDidHide", hide),
    ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, []);

  // Monitor network status changes to automatically hide/show Save as Draft button
  useEffect(() => {
    const checkNetworkStatus = () => {
      const online = !networkService.isOffline();
      setIsOnline(online);
    };

    // Check immediately
    checkNetworkStatus();

    // Check every 2 seconds for network changes
    const interval = setInterval(checkNetworkStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const {
    isToggleEnabled,
    setIsToggleEnabled,
    setFormId: setCurrentFormId,
    setSubmissionId: setCurrentSubmissionId,
    setFormOptions,
    setShowBackButton,
    setOnBackPress,
  } = useContext(ToggleContext)!;

  const keyboardContainerRef = useRef<KeyboardAwareContainerRef>(null);
  const fieldRefs = useRef<{ [key: string]: React.RefObject<View> }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const stageApprovalRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const currentStageRef = useRef<any>(null);
  const errorsRef = useRef<any>({});
  const validationErrorsRef = useRef<Record<string, boolean>>({});
  const dispatch = useDispatch();

  // Automatic scrolling when input is focused - handled by InputWrapper in KeyboardAwareContainer

  // Handle input focus (for state management only, scrolling is handled by InputWrapper)
  const handleInputFocus = useCallback((inputKey: string) => {
    focusedInputKeyRef.current = inputKey;
    setFocusedInputKey(inputKey);
    setIsKeyboardVisible(true);
  }, []);

  const user = useSelector((state: RootState) => state.user);
  const assignments = useSelector(
    (state: RootState) => state.formAssignments.data,
  );
  const receivedAssignment = useSelector(
    (state: RootState) => state.formReceived.data,
  );

  // Callback to set formSubmissionId (trigger handled by effect below)
  const handleFormSubmissionIdSet = useCallback((id: number | undefined) => {
    setFormSubmissionId(id); // Update the state
  }, []);

  const handleVisibleQuestionsChange = useCallback(
    (newVisible: Set<string>, previousVisible: Set<string>) => {
      // Find newly visible questions that are sub-questions (logic_questions)
      const newlyVisible = Array.from(newVisible).filter(
        (q) => !previousVisible.has(q),
      );

      if (newlyVisible.length > 0) {
        // Find the first newly visible sub-question (logic_question)
        const firstNewSubQuestion = newlyVisible.find((q) =>
          currentStageRef.current?.questions?.some((question: any) =>
            question.logics?.some((logic: any) =>
              logic.logic_questions?.some((lq: any) => lq.question_uuid === q),
            ),
          ),
        );

        if (firstNewSubQuestion) {
          setTimeout(() => {
            keyboardContainerRef.current?.scrollToInput(firstNewSubQuestion);
          }, 500); // Delay to allow rendering
        }
      }
    },
    [],
  );

  const scrollToStageApproval = useCallback(() => {
    const target = stageApprovalRef.current;
    if (target && typeof target.measureInWindow === "function") {
      target.measureInWindow(
        (x: number, y: number, width: number, height: number) => {
          if (y !== undefined && y !== null && height > 0) {
            const screenHeight = Dimensions.get("window").height;
            const scrollDelta = y - screenHeight * 0.25;
            keyboardContainerRef.current?.scrollByOffset(
              Math.max(0, scrollDelta),
            );
          } else {
            keyboardContainerRef.current?.scrollToTop();
          }
        },
      );
    } else {
      keyboardContainerRef.current?.scrollToTop();
    }
  }, []);

  const allowStagePreviewNavigation =
    !isViewMode &&
    !isPreview &&
    !isEditMode &&
    !isEditButtonClicked &&
    !isFromNotification &&
    !propTodoDisabled &&
    !submissionsDetail?.is_completed;
  const shareRouteFormId = mainFormId
    ? Number(mainFormId)
    : parentFormId != null
      ? Number(parentFormId)
      : undefined;

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
    onSubmit,
    goToPrevStage,
    goToNextStage,
    goToStage,
    visibleQuestions,
    watch,
    setValue,
    getValues,
    reset,
    submitting,
    setCurrentStageIndex,
    validationErrors,
    validateAllFields,
    showShareButton,
    handleShare,
    getStageAssignUuid,
    getReceivedStageAssignUuid,
    handleFormSubmission,
    queueBackgroundSubmission,
    submittedData,
    stageSubmitted,
    isFormEnabledForSharing,
    setSelectedUsers,
    setSelectedGroups,
    setShowSuccessModal: setHookShowSuccessModal,
  } = useMultiStageForm(
    stages,
    handleFormSubmissionIdSet, // Pass the proper callback
    () => {}, // unused callback
    submissionsDetail,
    formSubmissionId, // Pass the current value
    Number(formId),
    setStages,
    setIsAutoRedirecting,
    undefined,
    undefined,
    undefined,
    undefined,
    handleVisibleQuestionsChange,
    {
      decision: stageApprovalDecision,
      remarks: stageApprovalRemarks,
    },
    allowStagePreviewNavigation,
    shareRouteFormId,
    plannerAssignmentId,
  );

  // Keep refs in sync so renderQuestionWithSeparator can read latest values
  // without having them in its dependency array (prevents all questions from
  // re-rendering when errors or validationErrors change).
  errorsRef.current = errors;
  validationErrorsRef.current = validationErrors;

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      const goingBackground =
        prevState === "active" &&
        (nextState === "background" || nextState === "inactive");
      const comingActive =
        prevState !== "active" && nextState === "active";

      if (
        goingBackground &&
        submitInFlightRef.current &&
        lastSubmitDataRef.current &&
        !queuedBackgroundSubmissionIdRef.current &&
        !isQueueingBackgroundSubmissionRef.current
      ) {
        isQueueingBackgroundSubmissionRef.current = true;
        const queuedId = await queueBackgroundSubmission(
          lastSubmitDataRef.current,
        );
        isQueueingBackgroundSubmissionRef.current = false;
        if (queuedId && !queuedBackgroundSubmissionIdRef.current) {
          queuedBackgroundSubmissionIdRef.current = queuedId;
        }
      }

      if (comingActive && queuedBackgroundSubmissionIdRef.current) {
        if (submitInFlightRef.current) {
          shouldForceSyncAfterSubmitRef.current = true;
          return;
        }
        try {
          Toast.show({
            type: "info",
            text1: "Syncing submission",
            text2: "Your saved form is being synced now.",
            position: "top",
          });
          await backgroundSyncService.forceSync();
        } catch (error) {
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [queueBackgroundSubmission]);

  const isFormAssignedToUser = useMemo(() => {
    const isAssigned =
      assignments.some(
        (assignment: any) => String(assignment.form) === formId,
      ) ||
      receivedAssignment.some(
        (assignment: any) => String(assignment.form) === formId,
      );
    return isAssigned;
  }, [assignments, receivedAssignment, formId]);

  const stageApprovalMeta = useMemo(() => {
    const questions = currentStage?.questions || [];
    const approvalQuestion =
      questions.find(
        (q: any) => q?.stage_approvals === true || q?.requiresApproval === true,
      ) || questions[0];
    const hasStageApprovalAccess =
      (currentStage as any)?.stage_approvals === true ||
      (currentStage as any)?.requiresApproval === true ||
      (currentStage as any)?.stage_access?.some(
        (access: any) => access?.stage_approvals === true,
      );
    if (!currentStage?.id || !hasStageApprovalAccess || !approvalQuestion?.id)
      return null;
    return {
      stageId: currentStage.id,
      questionId: approvalQuestion?.id,
      questionType: approvalQuestion?.question_type,
      remarks: approvalQuestion?.remarks ?? "",
    };
  }, [currentStage]);

  const isStageApprovalAccepted = useMemo(() => {
    if (!stageApprovalMeta) return false;
    return stageApprovalDecision[stageApprovalMeta.stageId] === "accepted";
  }, [stageApprovalMeta, stageApprovalDecision]);

  const isStageApprovalRequired = useMemo(() => {
    return (
      !!stageApprovalMeta &&
      !isSentScreen &&
      !isViewMode &&
      !isFromNotification
    );
  }, [stageApprovalMeta, isSentScreen, isViewMode, isFromNotification]);

  const isStageApprovalMissing = useMemo(() => {
    if (!isStageApprovalRequired || !stageApprovalMeta) return false;
    return !stageApprovalDecision[stageApprovalMeta.stageId];
  }, [isStageApprovalRequired, stageApprovalMeta, stageApprovalDecision]);

  const editableStageIndex = useMemo(() => {
    if (!allowStagePreviewNavigation) return currentStageIndex;
    const firstIncompleteIndex = stages.findIndex((stage) => !stage?.is_completed);
    return firstIncompleteIndex >= 0 ? firstIncompleteIndex : currentStageIndex;
  }, [allowStagePreviewNavigation, currentStageIndex, stages]);

  const isReadOnlyStagePreview =
    allowStagePreviewNavigation && currentStageIndex !== editableStageIndex;

  useEffect(() => {
    if (!stageApprovalMeta) return;
    setStageApprovalRemarks((prev) => {
      if (prev[stageApprovalMeta.stageId] != null) return prev;
      return {
        ...prev,
        [stageApprovalMeta.stageId]: stageApprovalMeta.remarks ?? "",
      };
    });
  }, [stageApprovalMeta]);

  const populateFormWithExistingData = useCallback(async () => {
    if (!stages.length) return;

    await new Promise((resolve) => setTimeout(resolve, 300));

    const allQuestions = stages.flatMap((stage, stageIndex) =>
      stage.questions
        .flatMap((q) => [
          q,
          ...q.sub_questions,
          ...(q.logics?.flatMap((l) => l.logic_questions) || []),
          ...(q.logics
            ?.filter((l) => l.follow_up)
            .map((l) => ({
              ...l.follow_up,
              _isFollowUpTask: true,
              _logicId: l.id,
              _parentQuestion: q.question_uuid,
              question_uuid: `followup-${l.id}`,
              question_type: "followup_task",
            })) || []),
        ])
        .map((q) => ({
          ...q,
          _stageIndex: stageIndex,
          _isLastStage: stageIndex === stages.length - 1,
        })),
    );

    const answersByQuestionId = new Map<number, any[]>();
    const collectAnswers = (q: any) => {
      if (!q || q.id == null) return;
      const rawAnswers = q.answers;
      const answerEntries: any[] = [];
      if (Array.isArray(rawAnswers)) answerEntries.push(...rawAnswers);
      else if (rawAnswers && typeof rawAnswers === "object")
        answerEntries.push(rawAnswers);
      if (answerEntries.length === 0) return;
      for (const entry of answerEntries) {
        const entryQuestionId =
          typeof entry?.question === "object"
            ? entry?.question?.id
            : entry?.question ?? entry?.question_id;
        if (entryQuestionId == null) continue;
        const list = answersByQuestionId.get(Number(entryQuestionId)) || [];
        list.push(entry);
        answersByQuestionId.set(Number(entryQuestionId), list);
      }
    };
    allQuestions.forEach(collectAnswers);

    for (const question of allQuestions) {
      try {
        // Extract answer value using the same logic as TodoFormDataScreen.tsx
        const q = question as any; // Type assertion to bypass TypeScript errors
        let answerValue = q.answer || q.value || q.submitted_value || q.answer_id;

        // If still no answer, check if answers is an array or object
        if (
          (answerValue === null ||
            answerValue === undefined ||
            answerValue === "") &&
          q.answers
        ) {
          if (Array.isArray(q.answers) && q.answers.length > 0) {
            // If answers is an array, take the first answer
            answerValue =
              q.answers[0].answer_id ||
              q.answers[0].answer ||
              q.answers[0].value ||
              q.answers[0].submitted_value ||
              q.answers[0];
          } else if (typeof q.answers === "object" && q.answers !== null) {
            // If answers is an object, try to get the answer from it
            answerValue =
              q.answers.answer_id || q.answers.answer || q.answers.value || q.answers.submitted_value;
          }
        }

        // Additional check: look for answer in nested structures
        if (
          answerValue === null ||
          answerValue === undefined ||
          answerValue === ""
        ) {
          if (q?.id != null) {
            const mappedAnswers = answersByQuestionId.get(Number(q.id));
            if (mappedAnswers && mappedAnswers.length > 0) {
              const entry =
                mappedAnswers.find(
                  (a: any) =>
                    a?.answer != null ||
                    a?.value != null ||
                    a?.submitted_value != null ||
                    a?.other_text != null,
                ) || mappedAnswers[0];
              answerValue =
                entry?.answer ??
                entry?.value ??
                entry?.submitted_value ??
                entry?.other_text ??
                entry;
            }
          }

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
          if (
            (answerValue === null ||
              answerValue === undefined ||
              answerValue === "") &&
            q.answer_data
          ) {
            answerValue = q.answer_data.answer_id || q.answer_data.answer || q.answer_data.value;
          }

          // Check if there's a direct answer field in some other structure
          if (
            (answerValue === null ||
              answerValue === undefined ||
              answerValue === "") &&
            q.data
          ) {
            answerValue = q.data.answer_id || q.data.answer || q.data.value;
          }
        }

        if (
          answerValue === undefined ||
          answerValue === null ||
          answerValue === ""
        )
          continue;

        let processedValue = answerValue;

        // Handle different question types properly
        switch (q.question_type) {
          case "table": {
            const normalizeTableRows = (raw: any): any[] | null => {
              if (raw == null) return null;

              if (typeof raw === "string") {
                const trimmed = raw.trim();
                if (
                  (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
                  (trimmed.startsWith("{") && trimmed.endsWith("}"))
                ) {
                  try {
                    return normalizeTableRows(JSON.parse(trimmed));
                  } catch {
                    return null;
                  }
                }
                return null;
              }

              if (Array.isArray(raw)) {
                const subQuestions = q.sub_questions || [];
                const rows = raw
                  .map((row) => {
                    if (row && typeof row === "object" && !Array.isArray(row)) {
                      return row;
                    }
                    if (Array.isArray(row) && subQuestions.length) {
                      const mapped: Record<string, any> = {};
                      row.forEach((cell, idx) => {
                        const subQ = subQuestions[idx];
                        if (subQ?.question_uuid) {
                          mapped[subQ.question_uuid] = cell;
                        }
                      });
                      return Object.keys(mapped).length ? mapped : null;
                    }
                    return null;
                  })
                  .filter(Boolean);
                return rows.length > 0 ? rows : null;
              }

              if (raw && typeof raw === "object") {
                const possible =
                  (raw as any).rows ||
                  (raw as any).table_rows ||
                  (raw as any).table_values ||
                  (raw as any).data ||
                  (raw as any).answer ||
                  (raw as any).value ||
                  (raw as any).submitted_value ||
                  (raw as any).response ||
                  (raw as any).response_value ||
                  (raw as any).answer_data?.answer ||
                  (raw as any).answer_data?.value;
                if (possible) return normalizeTableRows(possible);
              }

              return null;
            };

            const tableRows =
              normalizeTableRows(answerValue) ||
              normalizeTableRows((q as any).table_rows) ||
              normalizeTableRows((q as any).rows) ||
              normalizeTableRows((q as any).answers);

            if (tableRows && tableRows.length > 0) {
              const questionKey =
                (q as any).uniqueId || q.question_uuid;
              setValue(questionKey, tableRows, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: false,
              });
            }
            continue;
          }
          case "checkboxes": {
            // CheckboxField expects array of raw IDs: [1, 3]
            const resolveCheckboxId = (raw: any): number | null => {
              if (raw == null) return null;
              if (typeof raw === "object") {
                const id = Number(raw.id ?? raw.option_id ?? raw.value ?? raw.answer_id ?? raw.answer);
                return isNaN(id) ? null : id;
              }
              const num = Number(raw);
              return isNaN(num) ? null : num;
            };
            if (Array.isArray(answerValue)) {
              processedValue = answerValue.map(resolveCheckboxId).filter((v): v is number => v !== null);
            } else if (typeof answerValue === "string" && answerValue.includes("|")) {
              processedValue = answerValue.split("|").map((v) => resolveCheckboxId(v.trim())).filter((v): v is number => v !== null);
            } else {
              const id = resolveCheckboxId(answerValue);
              processedValue = id !== null ? [id] : [];
            }
            break;
          }
          case "multiple_choice":
            const resolveOption = (raw: any) => {
              if (raw == null) return null;
              let optionText: string | null = null;
              let optionId: number | null = null;

              if (typeof raw === "object") {
                if (raw.id != null && !Number.isNaN(Number(raw.id))) {
                  optionId = Number(raw.id);
                }
                optionText =
                  (typeof raw.option === "string" && raw.option) ||
                  (typeof raw.value === "string" && raw.value) ||
                  (typeof raw.label === "string" && raw.label) ||
                  (typeof raw.name === "string" && raw.name) ||
                  null;
              }

              if (
                optionId == null &&
                (typeof raw === "number" ||
                  (typeof raw === "string" &&
                    raw.trim() !== "" &&
                    !Number.isNaN(Number(raw))))
              ) {
                optionId = Number(raw);
              }

              if (optionId != null) {
                const matched = q.options?.find(
                  (opt: any) => Number(opt.id) === optionId,
                );
                if (matched) {
                  return { id: Number(matched.id), option: matched.option };
                }
              }

              if (!optionText && typeof raw === "string") {
                optionText = raw;
              }

              if (optionText) {
                const matched = q.options?.find(
                  (opt: any) =>
                    String(opt.option || "").toLowerCase() ===
                    optionText!.toLowerCase(),
                );
                if (matched) {
                  return { id: Number(matched.id), option: matched.option };
                }
                return { id: optionId ?? Number.NaN, option: optionText };
              }

              return null;
            };

            if (Array.isArray(answerValue)) {
              processedValue = answerValue
                .map(resolveOption)
                .filter(Boolean);
            } else if (
              typeof answerValue === "string" &&
              answerValue.includes("|")
            ) {
              processedValue = answerValue
                .split("|")
                .filter((v) => v.trim() !== "")
                .map((v) => resolveOption(v))
                .filter(Boolean);
            } else {
              const resolved = resolveOption(answerValue);
              processedValue = resolved ? [resolved] : [];
            }
            break;

          case "audit": {
            // AuditField expects array of {id} objects
            const resolveAuditOpt = (raw: any) => {
              const id = typeof raw === "object" ? Number(raw?.id) : Number(raw);
              if (isNaN(id)) return null;
              const matched = q.options?.find((opt: any) => Number(opt.id) === id);
              return matched ? { id: Number(matched.id), option: matched.option } : { id };
            };
            if (Array.isArray(answerValue)) {
              processedValue = answerValue.map(resolveAuditOpt).filter(Boolean);
            } else {
              const resolved = resolveAuditOpt(answerValue);
              processedValue = resolved ? [resolved] : [];
            }
            break;
          }

          case "dropdown":
          case "division":
          case "sub_division":
          case "user":
          case "location": {
            // These fields expect a raw ID in edit mode
            if (typeof answerValue === "object" && answerValue?.id != null) {
              processedValue = Number(answerValue.id);
            } else if (typeof answerValue === "object" && answerValue?.answer_id != null) {
              processedValue = Number(answerValue.answer_id);
            } else {
              processedValue = answerValue;
            }
            break;
          }

          default:
            processedValue = answerValue;
            break;
        }

        const answersArray = Array.isArray(q.answers)
          ? q.answers
          : q.answers && typeof q.answers === "object"
            ? [q.answers]
            : [];
        const questionScopedAnswers = q?.id
          ? answersArray.filter((entry: any) => {
              const entryQuestionId =
                typeof entry?.question === "object"
                  ? entry?.question?.id
                  : entry?.question ?? entry?.question_id;
              return entryQuestionId == null || entryQuestionId === q.id;
            })
          : answersArray;
        const approvalAnswers = questionScopedAnswers.filter(
          (entry: any) =>
            entry?.signature != null ||
            entry?.remarks != null ||
            entry?.approved_stages === true ||
            entry?.approved_stages === false,
        );
        const answersObj =
          approvalAnswers.find(
            (entry: any) =>
              entry?.signature != null ||
              entry?.remarks != null ||
              entry?.approved_stages === true,
          ) || null;
        const hasApprovalPayload =
          answersObj?.signature != null ||
          answersObj?.remarks != null ||
          answersObj?.approved_stages === true;
        const isApprovalQuestion =
          q?.stage_approvals === true ||
          q?.requiresApproval === true ||
          hasApprovalPayload;
        if (isApprovalQuestion) {
          const stageIdForApproval =
            q?.stage?.id ??
            stages?.[q._stageIndex ?? -1]?.id ??
            stageApprovalMeta?.stageId;
          const approvedFlag = answersObj?.approved_stages;
          const decisionValue =
            approvedFlag === true
              ? "accepted"
              : approvedFlag === false
                ? "rejected"
                : typeof answerValue === "string"
                  ? answerValue.toLowerCase() === "accepted"
                    ? "accepted"
                    : answerValue.toLowerCase() === "rejected"
                      ? "rejected"
                      : null
                  : typeof answerValue === "boolean"
                    ? answerValue
                      ? "accepted"
                      : "rejected"
                    : null;
          if (stageIdForApproval != null && decisionValue) {
            setStageApprovalDecision((prev) => ({
              ...prev,
              [stageIdForApproval]: decisionValue,
            }));
          }
          const remarksValue =
            answersObj?.remarks ?? answersObj?.other_text ?? q.remarks ?? "";
          if (stageIdForApproval != null && remarksValue) {
            setStageApprovalRemarks((prev) => ({
              ...prev,
              [stageIdForApproval]: String(remarksValue),
            }));
          }
          const signatureValue = (() => {
            const directSignature = answersObj?.signature;
            if (directSignature) return directSignature;
            const answerValue = answersObj?.answer;
            if (
              typeof answerValue === "string" &&
              /^https?:\/\//i.test(answerValue) &&
              /\.(png|jpe?g|webp)(\?.*)?$/i.test(answerValue)
            ) {
              return answerValue;
            }
            const approvalImageEntry = approvalAnswers.find(
              (entry: any) =>
                entry?.signature == null &&
                entry?.remarks == null &&
                (entry?.approved_stages === true ||
                  entry?.approved_stages === false) &&
                typeof entry?.answer === "string" &&
                /^https?:\/\//i.test(entry.answer) &&
                /\.(png|jpe?g|webp)(\?.*)?$/i.test(entry.answer),
            );
            return approvalImageEntry?.answer ?? null;
          })();
          if (stageIdForApproval != null && signatureValue) {
            setValue(
              `stage_approval_signature_${stageIdForApproval}`,
              signatureValue,
              {
                shouldDirty: false,
                shouldTouch: false,
                shouldValidate: false,
              },
            );
          }
        }

        const questionKey =
          (q as any).uniqueId || q.question_uuid;
        setValue(questionKey, processedValue, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false,
        });

        // Set other_text for checkboxes/multiple_choice if present
        if (q.question_type === "checkboxes" || q.question_type === "multiple_choice") {
          const otherText = (typeof q.answers === "object" && !Array.isArray(q.answers))
            ? q.answers?.other_text
            : Array.isArray(q.answers) ? q.answers?.[0]?.other_text : undefined;
          if (otherText) {
            setValue(`${questionKey}_other`, otherText, {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
          }
        }
      } catch (error) {
      }
    }
  }, [
    stages,
    setValue,
    stageApprovalMeta,
    setStageApprovalDecision,
    setStageApprovalRemarks,
  ]);

  // Fetch previous submission answers for the same form + location
  const { previousSubmissions: previousSubmissionsData } = usePreviousSubmissions({
    formId,
    locationId: plannerLocationId,
    excludeSubmissionId: submissionId,
    enabled: !isPreview && !isViewMode,
  });

  const backgroundLoadRemainingStages = useCallback(async (
    fId: string,
    subId: string | undefined,
    currentStages: Stage[],
  ) => {
    if (backgroundLoadInProgressRef.current) return;
    const remainingOrders = allStageOrdersRef.current.filter(
      (order) => !loadedStageOrdersRef.current.has(order)
    );
    if (remainingOrders.length === 0) return;

    backgroundLoadInProgressRef.current = true;
    try {
      // Fetch 1 stage at a time to keep memory usage low
      const BATCH_SIZE = 1;
      for (let i = 0; i < remainingOrders.length; i += BATCH_SIZE) {
        const batch = remainingOrders.slice(i, i + BATCH_SIZE);
        try {
          const partialData = await fetchFormStages(fId, batch, subId);
          if (partialData) {
            const isAudit = partialData.form_type === "audit";
            const newStages = isAudit ? partialData.audit_group : partialData.stages;
            if (newStages && newStages.length > 0) {
              // Cache each stage in the batch
              for (const order of batch) {
                await saveCachedStage(fId, order, partialData, subId);
                loadedStageOrdersRef.current.add(order);
              }

              // Merge new stages into existing stages
              setStages((prevStages) => {
                const merged = [...prevStages];
                for (const newStage of newStages) {
                  const existingIdx = merged.findIndex(
                    (s) => s.order === newStage.order
                  );
                  const stageData = {
                    ...newStage,
                    updated: newStage.edited_on ? true : false,
                  };
                  if (existingIdx >= 0) {
                    // Only update if the existing stage has no questions (placeholder)
                    if (!merged[existingIdx].questions || merged[existingIdx].questions.length === 0) {
                      merged[existingIdx] = stageData;
                    }
                  } else {
                    merged.push(stageData);
                  }
                }
                // Sort by order
                merged.sort((a, b) => (a.order || 0) - (b.order || 0));
                return merged;
              });
            }
          }
        } catch {
          // Silent fail for background loading — will retry on next open
        }
      }
      await updateCacheTimestamp(fId, subId);
    } finally {
      backgroundLoadInProgressRef.current = false;
    }
  }, []);

  const getFormStages = useCallback(async () => {
    isLoadingFormRef.current = true;
    try {
      setLoading(true);
      setError(null);

      let stagesToSet: Stage[] = [];
      let subDetail: SubmissionsDetail | undefined = undefined;
      let toggleEnabled = false;
      let previousStateEditEnabled = false;

      setParentFormId(Number(formId));

      // === Progressive Loading ===
      // Step 1: Try to load from cache first (instant display)
      const cachedForm = await assembleFormFromCache(formId, [], submissionId);
      if (cachedForm) {
        const isAudit = cachedForm.formType === "audit";
        stagesToSet = (isAudit ? cachedForm.auditGroups : cachedForm.stages) as Stage[];
        if (stagesToSet.length > 0) {
          // Show cached data immediately
          setStages(stagesToSet);
          setLoading(false);

          // Track loaded orders from cache
          loadedStageOrdersRef.current = new Set(stagesToSet.map((s: any) => s.order));

          // Background refresh: fetch metadata + all stages from API
          backgroundLoadRemainingStages(formId, submissionId, stagesToSet);
          return;
        }
      }

      // Step 2: Fetch metadata (lightweight — no questions)
      const metadata = await fetchFormMetadata(formId);
      if (metadata) {
        formMetadataRef.current = metadata;
        const isAudit = metadata.form_type === "audit";
        const stageList = isAudit ? metadata.audit_groups : metadata.stages;
        allStageOrdersRef.current = stageList.map((s: any) => s.order);
        await saveCachedMetadata(formId, metadata, submissionId);
        setFormType(metadata.form_type);
        setFormTitle(metadata.form_title || "Untitled Form");
      }

      // Step 3: Fetch first 1 stage with full question data (keep response small)
      const initialOrders = allStageOrdersRef.current.slice(0, 1);
      if (initialOrders.length > 0) {
        const partialData = await fetchFormStages(formId, initialOrders, submissionId);
        if (partialData) {
          const isAudit = partialData.form_type === "audit";
          setFormType(partialData.form_type || metadata?.form_type || "standard");

          if (submissionId) {
            subDetail = partialData?.submissionsDetail;
            toggleEnabled = partialData?.submissionsDetail?.allow_editing || partialData?.allow_editing || false;
            previousStateEditEnabled = partialData?.submissionsDetail?.can_edit_previous_state || partialData?.can_edit_previous_state || false;
            setFormSubmissionId(Number(subDetail?.id) || undefined);
            const parentFormIdFromResponse = partialData?.form_id || partialData?.form?.id || Number(formId);
            setParentFormId(parentFormIdFromResponse);
          } else {
            setParentFormId(partialData.id || Number(formId));
            toggleEnabled = partialData?.allow_editing || false;
            previousStateEditEnabled = partialData?.can_edit_previous_state || false;
            subDetail = partialData?.submissionsDetail;
          }

          stagesToSet = (
            isAudit ? partialData.audit_group : partialData.stages
          ).map((stage: Stage) => ({
            ...stage,
            updated: stage.edited_on ? true : false,
          }));

          // Cache each stage in memory
          for (const order of initialOrders) {
            await saveCachedStage(formId, order, partialData, submissionId);
            loadedStageOrdersRef.current.add(order);
          }
        }
      }

      // Step 4: If no progressive data, show error (don't attempt full load — can crash on large forms)
      if (stagesToSet.length === 0) {
        setError("Failed to load form. Please check your connection and try again.");
        setLoading(false);
        return;
      }

      setStages(stagesToSet);
      setSubmissionsDetail(subDetail);
      setIsToggleEnabled(toggleEnabled);
      setCanEditPreviousStateEnabled(previousStateEditEnabled);

      if (stageId && stagesToSet.length > 0) {
        const userStageIndex = stagesToSet.findIndex(
          (stage: Stage) => Number(stage?.id) === Number(stageId),
        );
        if (userStageIndex >= 0) {
          setCurrentStageIndex(userStageIndex);
        }
      } else if (sourceScreen === "sent" && stagesToSet.length > 0) {
        const lastCompletedIndex = stagesToSet
          .map((stage, index) => (stage.is_completed ? index : -1))
          .filter((index) => index >= 0)
          .pop();

        if (lastCompletedIndex !== undefined) {
          setCurrentStageIndex(lastCompletedIndex);
        } else {
          setCurrentStageIndex(0);
        }
      }

      // Step 5: Background load remaining stages
      backgroundLoadRemainingStages(formId, submissionId, stagesToSet);
    } catch (error: any) {
      const isPermissionError = error?.response?.status === 403 || error?.message?.includes("403");
      if (!isPermissionError && formLoadRetryCountRef.current < 3) {
        formLoadRetryCountRef.current += 1;
        shouldRetryLoadOnActiveRef.current = true;
        if (appStateRef.current === "active") {
          setTimeout(() => {
            if (shouldRetryLoadOnActiveRef.current && !isLoadingFormRef.current) {
              shouldRetryLoadOnActiveRef.current = false;
              getFormStages();
            }
          }, 1500);
        }
      } else {
        setError(
          "Failed to load form stages. Please check your permissions or try again.",
        );
        Toast.show({
          type: "error",
          text1: "Error",
          text2: isPermissionError
            ? "You lack permission to access this form."
            : "Failed to load form stages.",
          position: "top",
        });
      }
    } finally {
      isLoadingFormRef.current = false;
      setLoading(false);
    }
  }, [formId, submissionId, stageId, setCurrentStageIndex, setIsToggleEnabled]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      const goingBackground =
        prevState === "active" &&
        (nextState === "background" || nextState === "inactive");
      const comingActive = prevState !== "active" && nextState === "active";

      if (goingBackground && isLoadingFormRef.current) {
        shouldRetryLoadOnActiveRef.current = true;
      }

      if (
        comingActive &&
        shouldRetryLoadOnActiveRef.current &&
        !isLoadingFormRef.current
      ) {
        shouldRetryLoadOnActiveRef.current = false;
        getFormStages();
      } else if (comingActive) {
        shouldRetryLoadOnActiveRef.current = false;
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [getFormStages]);

  const getUsers = useCallback(async () => {
    try {
      const response = await api.get(USERS_LIST);
      setUsers(response.data);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load users.",
        position: "top",
      });
    }
  }, []);

  const getGroups = useCallback(async () => {
    try {
      const response = await api.get("/groups/");
      setGroups(response.data);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load groups.",
        position: "top",
      });
    }
  }, []);

  const getLocationLeaders = useCallback(async () => {
    try {
      const response = await api.get(LOCATION_LEADERS_LIST);
      setLocationLeaders(response.data);
    } catch (error: any) {
      setLocationLeaders([]);
    }
  }, []);

  const getAvailableForms = useCallback(async () => {
    try {
      // Extract organization ID directly from user object
      let orgId = null;
      if (user && typeof user === "object") {
        // Check for organizationId first (from Redux saga), then organization field
        orgId =
          (user as any).organizationId ||
          (user as any).organization?.id ||
          (user as any).organization ||
          (user as any).org_id;
      }

      if (!orgId) {
        setAvailableForms([]);
        return;
      }

      const response = await api.get(`/forms/organization/${orgId}/`);
      // Extract the forms array from the response
      setAvailableForms(response.data?.forms || []);
    } catch (error: any) {
      // Fallback: try general forms endpoint if organization-specific fails
      try {
        const fallbackResponse = await api.get("/forms/");
        setAvailableForms(fallbackResponse.data || []);
      } catch (fallbackError) {
        setAvailableForms([]);
      }
    }
  }, [user]);

  const handleCloseTaskDialog = useCallback(() => {

    setShowTaskDialog(false);
    // Reset editing state
    setCurrentEditingTask(null);
    setIsEditingWebTask(false);
    // Reset form state
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeadline(0);
    setAssignForm(null);
    setAssignFormName("");
    setAssignUsers([]);
    setAssignGroups([]);
    setAssignLocationLeaders([]);
    setAssignUserNames([]);
    setAssignGroupNames([]);
    setAssignLocationLeaderNames([]);
    setTaskUserSearchQuery("");
    setTaskGroupSearchQuery("");
    setTaskFormSearchQuery("");
    setTaskLocationLeaderSearchQuery("");
    setShowUserDropdown(false);
    setShowGroupDropdown(false);
    setShowFormDropdown(false);
    setShowLocationLeaderDropdown(false);
  }, []);

  const handleSaveTask = useCallback(() => {
    if (!taskTitle.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Title is required.",
        position: "top",
      });
      return;
    }

    if (taskDeadline < 0) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Deadline must be 0 or greater.",
        position: "top",
      });
      return;
    }
    // Assign form is optional for Scenario 2 (task close questions only)

    // For Scenario 1 (editing web tasks), update the LogicFollowUp configuration
    if (isEditingWebTask && currentEditingTask) {
      // Update the follow-up task logic in the question
      setStages((prevStages) => {
        // Create a deep copy to force React to detect the change
        const newStages = JSON.parse(JSON.stringify(prevStages));

        newStages.forEach((stage: Stage) => {
          if (stage.questions) {
            stage.questions.forEach((q) => {
              if (q.question_uuid === currentTaskQuestionUuid && q.logics) {
                q.logics.forEach((logic) => {
                  if (logic.follow_up) {

                    logic.follow_up = {
                      ...logic.follow_up,
                      title: taskTitle,
                      description: taskDescription,
                      deadline: taskDeadline,
                      assign_user_ids: assignUsers,
                      assign_group_ids: assignGroups,
                      assign_leader_ids: assignLocationLeaders,
                    };
                  }
                });
              }
            });
          }
        });

        return newStages;
      });

      // Force update visible questions to ensure the followup task remains visible
      setTimeout(() => {
        const followupQuestionId = `followup-${currentEditingTask.logicId}`;
        // Create a new Set to force React to detect the change
        const newVisibleQuestions = new Set(visibleQuestions);
        newVisibleQuestions.add(followupQuestionId);
        // Note: visibleQuestions comes from useMultiStageForm hook and is read-only
        // The hook will handle the visibility based on the stages update
      }, 100);

      // Store edited web task data for backend submission when form is submitted
      const editedWebTaskData = {
        parentQuestionUuid: currentTaskQuestionUuid,
        logicId: currentEditingTask.logicId,
        title: taskTitle,
        description: taskDescription,
        deadline: taskDeadline,
        assign_user_ids: assignUsers,
        assign_group_ids: assignGroups,
        assign_leader_ids: assignLocationLeaders,
        isEditingWebTask: true,
        created_at: new Date().toISOString(),
      };

      // Add to the edited web tasks array for backend submission
      setEditedWebTasks((prev) => {
        const newTasks = [...prev, editedWebTaskData];
        editedWebTasksRef.current = newTasks;
        return newTasks;
      });

      // Show success message
      Toast.show({
        type: "success",
        text1: "Task Updated",
        text2: "Changes saved and will be applied when form is submitted.",
        position: "top",
      });

      // Close modal after a brief delay to allow state updates
      setTimeout(() => {
        handleCloseTaskDialog();

        // Scroll down to show the updated followup task
        setTimeout(() => {
          if (scrollViewRef.current) {
            // Scroll down to show the task that was just edited
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      }, 300);
    } else {
      // Scenario 2: Create new mobile task
      const temporaryTask: any = {
        parentQuestionUuid: currentTaskQuestionUuid,
        title: taskTitle,
        description: taskDescription,
        deadline: taskDeadline,
        created_from: "mobile",
        assign_form_id: assignForm ?? undefined, // Optional for Scenario 2
        assign_form: assignForm ?? undefined, // Backend compatibility (optional)
        assign_form_name: assignFormName || "",
        assign_user_ids: assignUsers,
        assign_group_ids: assignGroups,
        assign_leader_ids: assignLocationLeaders,
        assign_user_names: assignUserNames,
        assign_group_names: assignGroupNames,
        assign_location_leader_names: assignLocationLeaderNames,
        created_at: new Date().toISOString(),
      };

      // Fix: Send logic_followup_id and follow_task_sub_question_id per task so backend
      // links correct parent question and task close questions (avoids same parent for all)
      let lfId = currentTaskLogicFollowUpIdRef.current;
      let qId = currentTaskParentQuestionIdRef.current;

      if (qId == null && currentTaskQuestionUuid) {
        const fallbackQId = getQuestionIdByUuid(
          String(currentTaskQuestionUuid),
        );
        if (fallbackQId != null) qId = fallbackQId;
      }

      if (lfId == null && currentTaskQuestionUuid) {
        const fallbackLfId = getFollowupLogicIdByQuestion(
          String(currentTaskQuestionUuid),
        );
        if (fallbackLfId != null) lfId = fallbackLfId;
      }

      if (!lfId || !qId) {
        Toast.show({
          type: "error",
          text1: "Internal Error",
          text2: "Follow-up task could not be linked. Please re-open the form.",
          position: "top",
        });
        return;
      }

      temporaryTask.logic_followup_id = lfId;
      temporaryTask.follow_task_sub_question_id = qId;
      // Remove assign_form fields if not provided (backend may reject null)
      if (!assignForm) {
        delete temporaryTask.assign_form_id;
        delete temporaryTask.assign_form;
      }

      // Add to temporary tasks state and ref
      if (currentTaskQuestionUuid) {
        setTemporaryFollowUpTasks((prev) => ({
          ...prev,
          [currentTaskQuestionUuid]: [
            ...(prev[currentTaskQuestionUuid] || []),
            temporaryTask,
          ],
        }));
      }
      temporaryTasksRef.current = [...temporaryTasksRef.current, temporaryTask];
      setForceRefresh((prev) => prev + 1);
    }

    // Close modal after saving - the updated task will display below
    handleCloseTaskDialog();
  }, [
    taskTitle,
    taskDescription,
    taskDeadline,
    assignForm,
    assignFormName,
    assignUsers,
    assignGroups,
    assignLocationLeaders,
    assignUserNames,
    assignGroupNames,
    assignLocationLeaderNames,
    isEditingWebTask,
    currentEditingTask,
    currentTaskQuestionUuid,
    visibleQuestions,
    handleCloseTaskDialog,
  ]);

  // const handleCreateTask = useCallback(async () => {
  //   if (!taskTitle.trim()) {
  //     Toast.show({ type: "error", text1: "Error", text2: "Title is required.", position: "top" });
  //     return;
  //   }

  //   if (taskDeadline < 0) {
  //     Toast.show({ type: "error", text1: "Error", text2: "Deadline must be 0 or greater.", position: "top" });
  //     return;
  //   }

  //   setIsCreatingTask(true);

  //   try {
  //     // Calculate start_date and end_date
  //     const today = new Date();
  //     const startDate = format(today, 'yyyy-MM-dd') + 'T00:00:00.000Z';
  //     const endDate = format(addDays(today, taskDeadline), 'yyyy-MM-dd') + 'T00:00:00.000Z';

  //     const payload = {
  //       task_name: title,
  //       description: description,
  //       start_date: startDate,
  //       end_date: endDate,
  //       assign_users: assign_users,
  //       assign_groups: assign_groups,
  //       form: assign_form, // Include the selected form assignment from taskData
  //       // form_submission_id: formSubmissionId,
  //     };
  //     const createdFollowUpTaskResponse = await api.post('/tasks/', payload);
  //     const taskId = createdFollowUpTaskResponse.data?.task_id || createdFollowUpTaskResponse.data?.id;
  //     // Share task with assigned users and groups if any are assigned
  //     if ((assignUsers.length > 0 || assignGroups.length > 0) && taskId) {
  //       try {
  //         const sharePayload = {
  //           users: assignUsers,
  //           groups: assignGroups,
  //         };

  //        const shareFollowUpTaskResponse = await api.post(`/tasks/${taskId}/share/`, sharePayload);
  //       } catch (shareError: any) {
  //         // Don't fail the entire operation if sharing fails, just log the error
  //       }
  //     }

  //     Toast.show({ type: "success", text1: "Success", text2: "Task created successfully.", position: "top" });

  //     // Reset form
  //   setTaskTitle('');
  //   setTaskDescription('');
  //   setTaskDeadline(0);
  //   setAssignForm(null);
  //   setAssignFormName('');
  //   setAssignUsers([]);
  //   setAssignGroups([]);
  //   setAssignUserNames([]);
  //   setAssignGroupNames([]);
  //   setTaskUserSearchQuery('');
  //   setTaskGroupSearchQuery('');
  //   setTaskFormSearchQuery('');
  //   setShowUserDropdown(false);
  //   setShowGroupDropdown(false);
  //   setShowFormDropdown(false);

  //     setShowTaskDialog(false);
  //   } catch (error: any) {
  //     Toast.show({ type: "error", text1: "Error", text2: "Failed to create task.", position: "top" });
  //   } finally {
  //     setIsCreatingTask(false);
  //   }
  // }, [taskTitle, taskDescription, taskDeadline, assignUsers, assignGroups, formSubmissionId, formId]);

  const toggleAssignUser = useCallback(
    (userId: number) => {
      setAssignUsers((prev) => {
        const newUsers = prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId];

        // Update user names
        const selectedUserObjects = users.filter((u) =>
          newUsers.includes(u.id),
        );
        setAssignUserNames(
          selectedUserObjects.map(
            (u) =>
              `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username,
          ),
        );

        return newUsers;
      });
    },
    [users],
  );

  const toggleAssignGroup = useCallback(
    (groupId: number) => {
      setAssignGroups((prev) => {
        const newGroups = prev.includes(groupId)
          ? prev.filter((id) => id !== groupId)
          : [...prev, groupId];

        // Update group names
        const selectedGroupObjects = groups.filter((g) =>
          newGroups.includes(g.id),
        );
        setAssignGroupNames(selectedGroupObjects.map((g) => g.name));

        return newGroups;
      });
    },
    [groups],
  );

  const toggleAssignLocationLeader = useCallback(
    (leaderId: number) => {
      setAssignLocationLeaders((prev) => {
        const newLeaders = prev.includes(leaderId)
          ? prev.filter((id) => id !== leaderId)
          : [...prev, leaderId];

        // Update location leader names
        const selectedLeaderObjects = locationLeaders.filter((l) =>
          newLeaders.includes(l.id),
        );
        setAssignLocationLeaderNames(
          selectedLeaderObjects.map(
            (l) =>
              `${l.first_name || ""} ${l.last_name || ""}`.trim() || l.username,
          ),
        );

        return newLeaders;
      });
    },
    [locationLeaders],
  );

  const selectAssignForm = useCallback((formId: number, formName: string) => {
    setAssignForm(formId);
    setAssignFormName(formName);
    setShowFormDropdown(false);
  }, []);

  const filteredTaskUsers = useMemo(() => {
    return users.filter(
      (user) =>
        `${user.first_name} ${user.last_name}`
          .toLowerCase()
          .includes(taskUserSearchQuery.toLowerCase()) ||
        user.username
          .toLowerCase()
          .includes(taskUserSearchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(taskUserSearchQuery.toLowerCase()),
    );
  }, [users, taskUserSearchQuery]);

  const filteredTaskGroups = useMemo(() => {
    return groups.filter((group) =>
      group.name.toLowerCase().includes(taskGroupSearchQuery.toLowerCase()),
    );
  }, [groups, taskGroupSearchQuery]);

  const filteredTaskForms = useMemo(() => {
    return availableForms.filter(
      (form) =>
        form.name?.toLowerCase().includes(taskFormSearchQuery.toLowerCase()) ||
        form.title?.toLowerCase().includes(taskFormSearchQuery.toLowerCase()),
    );
  }, [availableForms, taskFormSearchQuery]);

  const userOrganizationId = useMemo(() => {
    if (!user || typeof user !== "object") return null;
    return (
      (user as any).organizationId ||
      (user as any).organization?.id ||
      (user as any).organization ||
      (user as any).org_id ||
      null
    );
  }, [user]);

  const isLocationLeader = useCallback((leader: any) => {
    if (!leader || typeof leader !== "object") return false;
    const roleId = leader.role_id ?? leader.roleId ?? leader?.role?.id ?? null;
    if (roleId != null) return Number(roleId) === 4;
    const roleValue = String(leader.role ?? leader.user_role ?? "").toLowerCase();
    if (roleValue) {
      return roleValue === "location_leader" || roleValue === "location leader";
    }
    if (leader.is_location_leader != null) return Boolean(leader.is_location_leader);
    if (leader.isLocationLeader != null) return Boolean(leader.isLocationLeader);
    if (leader.is_leader != null) return Boolean(leader.is_leader);
    return true;
  }, []);

  const filteredTaskLocationLeaders = useMemo(() => {
    return locationLeaders.filter(
      (leader) => {
        if (!isLocationLeader(leader)) return false;
        if (userOrganizationId != null) {
          const leaderOrgId =
            leader?.organizationId ||
            leader?.organization?.id ||
            leader?.organization ||
            leader?.org_id ||
            null;
          if (leaderOrgId == null) return false;
          if (Number(leaderOrgId) !== Number(userOrganizationId)) return false;
        }

        const query = taskLocationLeaderSearchQuery.toLowerCase();
        return (
          `${leader.first_name || ""} ${leader.last_name || ""}`
            .toLowerCase()
            .includes(query) ||
          leader.username?.toLowerCase().includes(query) ||
          leader.email?.toLowerCase().includes(query)
        );
      },
    );
  }, [
    locationLeaders,
    taskLocationLeaderSearchQuery,
    userOrganizationId,
    isLocationLeader,
  ]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id],
    );
  }, []);

  const assignUser = useCallback(async () => {
    const submissionIdLocal =
      submissionsDetail?.id || formSubmissionId || submissionId;
    if (triggeredByShare) {
      if (!submissionIdLocal) {
        Alert.alert("Share Failed", "No submission ID available for sharing.");
        return;
      }
      if (!selectedUserIds.length) {
        Alert.alert("Share Failed", "Please select at least one user to share with.");
        return;
      }

      try {
        const sharePayload =
          activeTab === "groups"
            ? { users: [], groups: selectedUserIds, location_leaders: [] }
            : activeTab === "leaders"
              ? { users: [], groups: [], location_leaders: selectedUserIds }
              : { users: selectedUserIds, groups: [], location_leaders: [] };

        const isShared = await handleShare(sharePayload);
        if (isShared) {
          Alert.alert("Success", "Form shared successfully.", [
            {
              text: "OK",
              onPress: () => {
                dispatch(fetchFormReceived({}));
                setShowAssignModal(false);
                setSelectedUserIds([]);
                setTriggeredByShare(false);
                router.replace("/(app)/(tabs)/forms");
              },
            },
          ]);
        } else {
          Alert.alert("Share Failed", "Failed to share form.");
        }
      } catch (error: any) {
        const errorMessage =
          error?.message && String(error.message).includes("403")
            ? "You lack permission to share this form."
            : "Failed to share form.";
        Alert.alert("Share Failed", errorMessage);
      }
    }
  }, [
    triggeredByShare,
    submissionsDetail,
    formSubmissionId,
    submissionId,
    activeTab,
    selectedUserIds,
    handleShare,
    dispatch,
  ]);

  // Handle "Send to Next" - opens Success modal for user to choose next action
  const handleSendToNext = useCallback(async () => {
    // Cancel auto-redirect timer started inside useMultiStageForm (15s after submit)
    if (setHookShowSuccessModal) {
      setHookShowSuccessModal(false);
    }
    setIsAutoRedirecting(false);
    setShowSuccessModal(true);
  }, [setHookShowSuccessModal]);

  const handleShareAction = () => {
    setTriggeredByShare(true);
    setActiveTab("user");
    setShowAssignModal(true);
    setSelectedUsers(selectedUserIds);
  };

  const handleShareToLeaders = () => {
    setTriggeredByShare(false);
    setActiveTab("leaders");
    setShowAssignModal(true);
    setSelectedUsers(selectedUserIds);
  };

  const handleMakePdf = async (emails: string[] = []) => {
    try {
      setIsGeneratingPdf(true);
      if (!formId) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Form ID missing for PDF generation.",
          position: "top",
        });
        return;
      }

      const submissionIdLocal = submissionsDetail?.id || formSubmissionId || submissionId;
      const downloadUrl = submissionIdLocal
        ? `/forms/${formId}/submissions/pdf/download?submission_id=${submissionIdLocal}`
        : `/forms/${formId}/submissions/pdf/download`;

      const response = await api.get(downloadUrl, {
        responseType: "blob",
        headers: { "Content-Type": "application/json" },
      });

      if (Platform.OS === "web") {
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `form_${formId}_submission_${submissionIdLocal || "all"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const reader = new FileReader();
        reader.readAsDataURL(response.data);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Pdf = base64data.split(",")[1];
          const cacheDir = (FileSystem as any).cacheDirectory ?? "";
          const fileUri = `${cacheDir}form_${formId}_submission_${submissionIdLocal || "all"}.pdf`;

          await FileSystem.writeAsStringAsync(fileUri, base64Pdf, {
            encoding:
              (FileSystem as any).EncodingType?.Base64 ??
              (FileSystem as any).EncodingType ??
              "base64",
          } as any);

          await Sharing.shareAsync(fileUri, {
            mimeType: "application/pdf",
            dialogTitle: `Form ${formId} Submission PDF`,
            UTI: "com.adobe.pdf",
          });
          Toast.show({
            type: "success",
            text1: "Success",
            text2: "PDF shared successfully.",
            position: "top",
          });
        };
      }
    } catch (error: any) {
      let errorMessage = "Failed to generate or share PDF. Please try again.";
      if (error.response?.status === 400)
        errorMessage =
          error.response.data?.error || "Bad request - please check form data.";
      else if (error.response?.status === 404)
        errorMessage =
          "Form not found or no submissions available for PDF generation.";
      else if (error.response?.status === 403)
        errorMessage =
          "You don't have permission to generate PDF for this form.";
      else if (error.response?.data?.error)
        errorMessage = error.response.data.error;

      Toast.show({
        type: "error",
        text1: "PDF Generation Error",
        text2: errorMessage,
        position: "top",
      });
    } finally {
      setIsGeneratingPdf(false);
      setShowSuccessModal(false);
    }
  };

  const handleViewSubmission = () => {
    setShowSuccessModal(false);
    const subId = submissionsDetail?.id ?? formSubmissionId;
    if (subId === undefined) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No submission ID available.",
        position: "top",
      });
      return;
    }
    router.push(`/forms/${formId}/submission/${String(subId)}` as any);
  };

  const handleClose = () => setShowSuccessModal(false);

  const handleStageMenuOpen = (stageIndex: number) => {
    setSelectedStageForEdit(stageIndex);
    setShowStageMenu(true);
  };

  const handleStageMenuClose = () => {
    setShowStageMenu(false);
    setSelectedStageForEdit(null);
  };

  const handleEditStage = (stageIndex: number) => {
    // Enable editable field mode while using can_edit_previous_state flow.
    setIsEditButtonClicked(true);
    setPreviousStageEditCeilingIndex((prev) =>
      prev === null ? currentStageIndex : Math.max(prev, currentStageIndex),
    );
    setCurrentStageIndex(stageIndex);
    setShowStageMenu(false);
    setSelectedStageForEdit(null);
    if (
      stageIndex < currentStageIndex &&
      canEditPreviousStateEnabled &&
      isFormAssignedToUser
    ) {
      reset();
      resetFormDirty();
      setTimeout(() => populateFormWithExistingData(), 200);
    }
  };

  const canEditStage = (stageIndex: number) => {
    const stage = stages[stageIndex];
    if (canEditPreviousStateEnabled && submissionsDetail?.is_completed)
      return true;
    if (canEditPreviousStateEnabled && !submissionsDetail?.is_completed) {
      const targetStageOrder = stage?.order || 0;
      const userCompletedStages = stages.filter(
        (s) => s.completed_by === user.id && s.is_completed,
      );
      const userMaxCompletedOrder = Math.max(
        ...userCompletedStages.map((s) => s.order || 0),
        0,
      );
      const userMaxOrder = Math.max(
        userMaxCompletedOrder,
        currentStage?.order || 0,
      );
      return userMaxOrder >= targetStageOrder;
    }
    return false;
  };

  const handleEditPreviousStageFromTopMenu = useCallback(() => {
    const stageCeilingIndex =
      previousStageEditCeilingIndex ?? currentStageIndex;

    if (stageCeilingIndex <= 0) {
      Alert.alert("Edit", "No previous stages available to edit.");
      return;
    }

    // Match allow_editing-like UX: enter edit flow directly, no second popup.
    setIsEditButtonClicked(true);
    setPreviousStageEditCeilingIndex((prev) =>
      prev === null ? currentStageIndex : Math.max(prev, currentStageIndex),
    );
    setCurrentStageIndex(0);
  }, [currentStageIndex, previousStageEditCeilingIndex]);

  const handleTopMenuOptions = useCallback(() => {
    Alert.alert("Options", "Choose an action", [
      { text: "Edit", onPress: handleEditPreviousStageFromTopMenu },
      { text: "Share", onPress: handleShareAction },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleEditPreviousStageFromTopMenu, handleShareAction]);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (activeTab === "groups") {
      return groups.filter((item: any) =>
        (item?.name || "").toLowerCase().includes(query),
      );
    }
    if (activeTab === "leaders") {
      return locationLeaders.filter((leader: any) => {
        if (!isLocationLeader(leader)) return false;
        if (userOrganizationId != null) {
          const leaderOrgId =
            leader?.organizationId ||
            leader?.organization?.id ||
            leader?.organization ||
            leader?.org_id ||
            null;
          if (leaderOrgId == null) return false;
          if (Number(leaderOrgId) !== Number(userOrganizationId)) return false;
        }
        return (
          `${leader.first_name || ""} ${leader.last_name || ""}`
            .toLowerCase()
            .includes(query) ||
          leader.username?.toLowerCase().includes(query) ||
          leader.email?.toLowerCase().includes(query)
        );
      });
    }
    return users.filter((item: any) =>
      (item?.username || "").toLowerCase().includes(query),
    );
  }, [
    users,
    groups,
    locationLeaders,
    activeTab,
    searchQuery,
    isLocationLeader,
    userOrganizationId,
  ]);

  const getLeaderDisplayName = useCallback((leader: any) => {
    if (!leader || typeof leader !== "object") return "Unknown";
    const directFullName =
      leader.full_name ||
      leader.fullName ||
      leader.name ||
      leader.display_name ||
      leader.displayName ||
      "";
    if (directFullName) return String(directFullName).trim();

    const firstName =
      leader.first_name ||
      leader.firstName ||
      leader?.user?.first_name ||
      leader?.user?.firstName ||
      "";
    const lastName =
      leader.last_name ||
      leader.lastName ||
      leader?.user?.last_name ||
      leader?.user?.lastName ||
      "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (fullName) return fullName;

    return (
      leader.username ||
      leader?.user?.username ||
      leader.email ||
      leader?.user?.email ||
      "Unknown"
    );
  }, []);

  // Show "Send to Next" after any stage submission
  useEffect(() => {
    if (stageSubmitted && !isStageApprovalAccepted) {
      setShowSendToNext(true);
    } else {
      setShowSendToNext(false);
    }
  }, [stageSubmitted, isStageApprovalAccepted]);

  useEffect(() => {
    if (!stageSubmitted || !isStageApprovalAccepted) return;
    setIsFullyCompletedMultiStageForm(true);
    setStages((prev) => prev.slice(0, currentStageIndex + 1));
  }, [stageSubmitted, isStageApprovalAccepted, currentStageIndex, setStages]);

  // Hide submitting overlay when submission is complete
  useEffect(() => {
    if (!submitting) {
      setShowSubmittingOverlay(false);
    }
  }, [submitting]);

  // Update currentStage ref when currentStage changes
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  // Load form data — independent effect with ref guard to prevent duplicate
  // calls when other callback identities change (e.g. user.id resolving).
  const formStagesLoadedRef = useRef(false);
  useEffect(() => {
    if (formStagesLoadedRef.current) return;
    if (!formId) return;
    formStagesLoadedRef.current = true;
    getFormStages();
  }, [getFormStages, formId]);

  // Load supplementary data — independent effects
  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    getGroups();
  }, [getGroups]);

  useEffect(() => {
    getStageAssignUuid();
  }, [getStageAssignUuid]);

  useEffect(() => {
    getReceivedStageAssignUuid();
  }, [getReceivedStageAssignUuid]);

  // Load forms and location leaders when task dialog opens
  useEffect(() => {
    if (showTaskDialog) {
      getAvailableForms();
      getLocationLeaders();
    }
  }, [showTaskDialog, getAvailableForms, getLocationLeaders]);

  // Load location leaders when Share -> Location Leaders modal opens
  useEffect(() => {
    if (showAssignModal && activeTab === "leaders") {
      getLocationLeaders();
    }
  }, [showAssignModal, activeTab, getLocationLeaders]);
  

  // Trigger endpoint when formSubmissionId changes (after successful form submission)
  // Web-created tasks always use trigger endpoint for consistency
  // Use ref to prevent multiple calls for this component instance
  const triggerCalledRef = useRef<boolean>(false);
  const processedSubmissionIdsRef = useRef<Set<number>>(new Set());
  const shouldTriggerFollowupsRef = useRef<boolean>(false);

  useEffect(() => {
    const callTriggerEndpoint = async () => {
      // Only call once per component instance when we have a valid submission ID
      if (triggerCalledRef.current || !formSubmissionId) {
        return;
      }

      // Additional protection: check if we've already processed this submission ID
      if (processedSubmissionIdsRef.current.has(formSubmissionId)) {
        return;
      }

      // Never trigger for SENT view, and don't trigger existing submissions
      // unless the user explicitly submitted from this screen.
      if (sourceScreen === "sent") {
        return;
      }
      if (submissionId && !shouldTriggerFollowupsRef.current) {
        return;
      }

      // Check if we have edited web tasks to send
      const hasEditedWebTasks =
        editedWebTasksRef.current && editedWebTasksRef.current.length > 0;

      // Check if we have mobile tasks (use state to avoid stale ref in release builds)
      const mobileTasks = [...temporaryTasksRef.current];
      const hasMobileTasks = mobileTasks.length > 0;
      if (hasMobileTasks) {
      }

      // Check if there are any web-defined follow-up tasks with meaningful content (non-empty title, description, or assignedFormTitle)
      let hasValidWebFollowUpTasks = false;

      // Check follow-up tasks from form logic (web-defined tasks only)
      stages.forEach((stage: Stage) => {
        stage.questions?.forEach((question: any) => {
          question.logics?.forEach((logic: any) => {
            if (logic.follow_up) {
              const followUp = logic.follow_up;
              const title = followUp.title || followUp.task_name;
              const description = followUp.description;
              const formTitle =
                followUp.assigned_form_title || assignedFormTitle;
              const hasAssignedForm =
                followUp.assign_form != null ||
                (typeof followUp.assigned_form_title === "string" &&
                  followUp.assigned_form_title.trim() !== "") ||
                (typeof followUp.assign_form_name === "string" &&
                  followUp.assign_form_name.trim() !== "");
              const hasAssignees =
                (Array.isArray(followUp.assign_user_ids) &&
                  followUp.assign_user_ids.length > 0) ||
                (Array.isArray(followUp.assign_group_ids) &&
                  followUp.assign_group_ids.length > 0) ||
                (Array.isArray(followUp.assign_leader_ids) &&
                  followUp.assign_leader_ids.length > 0) ||
                followUp.user != null ||
                followUp.group != null ||
                followUp.leader != null ||
                followUp.assign_to === "form_submitter";
              const hasTaskCloseQuestions =
                Array.isArray(followUp.task_close_questions) &&
                followUp.task_close_questions.length > 0;
              const hasTaskContent =
                (typeof title === "string" && title.trim() !== "") ||
                (typeof description === "string" &&
                  description.trim() !== "") ||
                (formTitle && formTitle.trim() !== "");

              // Trigger web follow-up creation only when there is task content and
              // at least one actionable target (assigned form or assignee/close question).
              if (
                hasTaskContent &&
                (hasAssignedForm || hasAssignees || hasTaskCloseQuestions)
              ) {
                hasValidWebFollowUpTasks = true;
              }
            }
          });
        });
      });

      // If no tasks of any type, skip calling the trigger endpoint
      if (!hasValidWebFollowUpTasks && !hasEditedWebTasks && !hasMobileTasks) {
        return;
      }


      // Mark as called to prevent any future calls
      triggerCalledRef.current = true;
      processedSubmissionIdsRef.current.add(formSubmissionId);

      try {
        const toNumberArray = (value: any): number[] => {
          if (Array.isArray(value)) {
            return value
              .map((v) => Number(v))
              .filter((v) => Number.isFinite(v));
          }
          if (typeof value === "string" && value.trim() !== "") {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                return parsed
                  .map((v) => Number(v))
                  .filter((v) => Number.isFinite(v));
              }
            } catch {
              return [];
            }
          }
          return [];
        };

        const deriveVisibleWebTasksAsMobile = () => {
          const derivedTasks: any[] = [];
          stages.forEach((stage: Stage) => {
            stage.questions?.forEach((question: any) => {
              question.logics?.forEach((logic: any) => {
                if (!logic?.follow_up) return;
                if (!visibleQuestions.has(`followup-${logic.id}`)) return;

                const followUp = logic.follow_up;
                const title = followUp.title || followUp.task_name || "";
                const description = followUp.description || "";
                const deadline = Number(followUp.deadline ?? 0) || 0;
                const assign_user_ids = toNumberArray(followUp.assign_user_ids);
                const assign_group_ids = toNumberArray(
                  followUp.assign_group_ids,
                );
                const assign_leader_ids = toNumberArray(
                  followUp.assign_leader_ids,
                );

                const hasContent =
                  (typeof title === "string" && title.trim() !== "") ||
                  (typeof description === "string" &&
                    description.trim() !== "");
                const hasTarget =
                  assign_user_ids.length > 0 ||
                  assign_group_ids.length > 0 ||
                  assign_leader_ids.length > 0 ||
                  followUp.assign_to === "form_submitter" ||
                  (Array.isArray(followUp.task_close_questions) &&
                    followUp.task_close_questions.length > 0);

                if (!hasContent || !hasTarget) return;
                if (!logic?.id || !question?.id) return;

                derivedTasks.push({
                  created_from: "mobile",
                  title,
                  description,
                  deadline,
                  assign_user_ids,
                  assign_group_ids,
                  assign_leader_ids,
                  follow_task_sub_question_id: Number(question.id),
                  logic_followup_id: Number(logic.id),
                });
              });
            });
          });
          return derivedTasks;
        };

        // Prepare base payload
        let payload: any = {
          form_id: Number(formId),
          main_form_submission_id: formSubmissionId,
          followup_task_form_id: Number(formId),
        };

        // If we have edited web tasks, send them for processing
        if (
          false &&
          hasEditedWebTasks &&
          editedWebTasksRef.current.length > 0
        ) {
          const editTask = editedWebTasksRef.current[0]; // Take first edited task
          payload = {
            ...payload,
            isEditingWebTask: true,
            logicId: editTask.logicId,
            title: editTask.title,
            description: editTask.description,
            deadline: editTask.deadline,
            assign_user_ids: editTask.assign_user_ids,
            assign_group_ids: editTask.assign_group_ids,
            assign_leader_ids: editTask.assign_leader_ids,
          };
        } else if (hasMobileTasks) {
        } else {
        }

        // Add mobile-created tasks if they exist
        if (hasMobileTasks) {
          const normalizedMobileTasks = mobileTasks.map((t: any) => ({
            created_from: "mobile",
            title: t.title ?? "",
            description: t.description ?? "",
            deadline: t.deadline ?? 0,
            assign_user_ids: Array.isArray(t.assign_user_ids)
              ? t.assign_user_ids
              : [],
            assign_group_ids: Array.isArray(t.assign_group_ids)
              ? t.assign_group_ids
              : [],
            assign_leader_ids: Array.isArray(t.assign_leader_ids)
              ? t.assign_leader_ids
              : [],
            follow_task_sub_question_id: t.follow_task_sub_question_id,
            logic_followup_id: t.logic_followup_id,
          }));
          payload.mobile_created_tasks = normalizedMobileTasks;
        }

        let triggerResponse = await api.post(TRIGGER_FOLLOWUP_TASKS, payload);

        if (triggerResponse.data && triggerResponse.data.tasks) {

        } else if (triggerResponse.status === 200) {

        }

        // Do not convert web-defined follow-up tasks into mobile_created_tasks.
        // Backend already handles web follow-up logic from the submission itself.
        // Sending derived web tasks here creates duplicate follow-up tasks.
        // (Same fix applied in AudiFormScreen.tsx)

        if (hasEditedWebTasks && editedWebTasksRef.current.length > 0) {
          for (const editTask of editedWebTasksRef.current) {
            const editPayload: any = {
              form_id: Number(formId),
              main_form_submission_id: formSubmissionId,
              followup_task_form_id: Number(formId),
              isEditingWebTask: true,
              logicId: editTask.logicId,
              title: editTask.title,
              description: editTask.description,
              deadline: editTask.deadline,
              assign_user_ids: editTask.assign_user_ids,
              assign_group_ids: editTask.assign_group_ids,
              assign_leader_ids: editTask.assign_leader_ids,
            };

            await api.post(TRIGGER_FOLLOWUP_TASKS, editPayload);
          }

          // Clear the edited tasks after successful update
          editedWebTasksRef.current = [];
          setEditedWebTasks([]);
        }

        try {

          await performBulkAssignment(
            formId,
            { stages, currentStageId: currentStage?.id },
            triggerResponse.data,
            formSubmissionId?.toString(),
          );
        } catch (bulkAssignError: any) {
          // Don't fail the entire submission if bulk assignment fails
        }
        // Reset explicit-submit trigger guard after handling trigger flow.
        shouldTriggerFollowupsRef.current = false;
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

        const backendError =
          triggerError?.response?.data?.error || triggerError?.message || "";
        const missingTable =
          typeof backendError === "string" &&
          backendError.includes("form_taskclosequestion");

        if (!missingTable) {
          Toast.show({
            type: "error",
            text1: "Task Creation Failed",
            text2: backendError || "Failed to create followup tasks",
            position: "top",
          });
        }

        // Reset guard on trigger failure as well.
        shouldTriggerFollowupsRef.current = false;
      }
    };

    callTriggerEndpoint();
  }, [
    formSubmissionId,
    formId,
    stages,
    visibleQuestions,
    assignedFormTitle,
    temporaryFollowUpTasks, submissionId, sourceScreen,
  ]); // Removed isSingleStageStandardForm dependency

  useEffect(() => {
    setCurrentFormId(formId);
    setCurrentSubmissionId(submissionId);
    return () => {
      setIsToggleEnabled(false);
      setCurrentFormId(undefined);
      setCurrentSubmissionId(undefined);

      // Note: Stage-specific bulk assignment configs (bulk_assignments_${formId}_${stageId})
      // are cleaned up by performBulkAssignment service after successful submission.
    };
  }, [
    formId,
    submissionId,
    setCurrentFormId,
    setCurrentSubmissionId,
    setIsToggleEnabled,
  ]);

  // Reset draft loading state when draftId changes
  useEffect(() => {
    setIsDraftLoading(!!draftId);
  }, [draftId]);

  const collectMediaAndSignatureFieldNames = useCallback(
    (questions: any[] = [], fieldNames: Set<string> = new Set<string>()) => {
      questions.forEach((question: any) => {
        const questionType = question?.question_type;
        const fieldName =
          (question as any)?.uniqueId || question?.question_uuid;

        if (
          fieldName &&
          [
            "upload_image",
            "upload_video",
            "upload_audio",
            "upload_file",
            "signature",
          ].includes(questionType)
        ) {
          fieldNames.add(fieldName);
        }

        if (Array.isArray(question?.sub_questions)) {
          collectMediaAndSignatureFieldNames(question.sub_questions, fieldNames);
        }

        if (Array.isArray(question?.logics)) {
          question.logics.forEach((logic: any) => {
            if (Array.isArray(logic?.logic_questions)) {
              collectMediaAndSignatureFieldNames(
                logic.logic_questions,
                fieldNames,
              );
            }
          });
        }
      });

      return fieldNames;
    },
    [],
  );

  // Populate form with draft data when draft is loaded
  useEffect(() => {
    if (draft && Object.keys(draft).length > 0 && stages.length > 0) {

      // Add delay to ensure form fields are rendered before populating
      setTimeout(() => {
        // Use reset to populate all form fields at once
        const draftData = { ...draft };
        delete draftData._loadedFromDraft; // Remove internal flag
        reset(draftData); // Reset the entire form with draft data
        resetFormDirty();

        // File/signature fields keep local preview state, so reapply those values
        // explicitly after reset to ensure resume shows saved media.
        const mediaFieldNames = Array.from(
          stages.reduce((acc, stage) => {
            collectMediaAndSignatureFieldNames(stage?.questions || [], acc);
            return acc;
          }, new Set<string>()),
        );

        mediaFieldNames.forEach((fieldName) => {
          if (draftData[fieldName] !== undefined) {
            setValue(fieldName, draftData[fieldName], {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
          }
        });

        Object.entries(draftData).forEach(([fieldName, value]) => {
          if (
            fieldName.startsWith("stage_approval_signature_") &&
            value !== undefined
          ) {
            setValue(fieldName, value, {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
          }
        });

        // after populating the form we rely on react-hook-form's isDirty flag
        // (we intentionally don't set any custom initial snapshot)

        // Only show draft loaded notification if this draft was loaded from external storage
        if (draft._loadedFromDraft) {
          Toast.show({
            type: "info",
            text1: "Draft Loaded",
            text2: "Your saved draft has been loaded.",
            position: "top",
          });
        }

        // Mark draft loading as complete once fields are populated
        setIsDraftLoading(false);
      }, 800); // Increased delay to ensure form fields are rendered
    }
  }, [draft, stages, reset, setValue, collectMediaAndSignatureFieldNames]);

  useEffect(() => {
    if (stages.length > 0 && (submissionId || isEditMode)) {
      populateFormWithExistingData();
    }
  }, [stages, submissionId, isEditMode, populateFormWithExistingData]);

  // Load draft data when draftId is provided
  useEffect(() => {
    const loadDraftData = async () => {
      if (!draftId || !user?.id) return;

      try {

        // First try to load from backend using the draft ID
        let draft = await offlineStorageService.loadDraftFromBackend(draftId);

        // If not found in database, fall back to local storage by form ID
        if (!draft) {
          draft = await offlineStorageService.getDraftForForm(
            Number(formId),
            user.id,
          );
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

          let isUsingLocalData = false;

          // If we have form structure stored locally, use it instead of fetching
          if (draft.formStructure) {
            setStages(draft.formStructure.stages || []);
            setFormType(draft.formStructure.form_type || "standard");
            setFormTitle(
              draft.formStructure.title ||
                draft.formStructure.name ||
                "Untitled Form",
            );
            setLoading(false); // Skip API loading since we have local data
            isUsingLocalData = true;
          }

          // Always call getUsers() if we have a draft
          await getUsers();

          // Show draft loaded notification only if using local data or offline
          const isOffline = networkService.isOffline();
          if (isUsingLocalData || isOffline) {
            // Set draft loaded flag to show notification in populateFormWithExistingData
            setTimeout(() => {
              // Use a flag in draft state to indicate this is a loaded draft
              setDraft((prevDraft: any) => ({
                ...prevDraft,
                _loadedFromDraft: true,
              }));
            }, 100);
          }
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
      } finally {
        setIsDraftLoading(false);
      }
    };

    loadDraftData();
  }, [draftId, formId, user?.id, getUsers]);

  const handleFormSubmit = useCallback(async (): Promise<boolean> => {
    if (submitInFlightRef.current) {
      return false;
    }
    submitInFlightRef.current = true;
    isQueueingBackgroundSubmissionRef.current = false;

    // Show overlay immediately
    setShowSubmittingOverlay(true);

    const { isValid, errors: fieldErrors } = await validateAllFields();
    if (!isValid || isStageApprovalMissing) {
      // Hide overlay if validation fails
      setShowSubmittingOverlay(false);
      submitInFlightRef.current = false;

      // Count the number of validation errors
      const orderedErrorKeys: string[] = [];
      const currentStageQuestions = currentStage?.questions || [];

      for (const q of currentStageQuestions) {
        if (fieldErrors[q.question_uuid]) {
          orderedErrorKeys.push(q.question_uuid);
        }
        if (q.sub_questions?.length) {
          for (const sq of q.sub_questions) {
            if (fieldErrors[sq.question_uuid]) {
              orderedErrorKeys.push(sq.question_uuid);
            }
          }
        }
        if (q.logics?.length) {
          for (const logic of q.logics) {
            if (logic.logic_questions?.length) {
              for (const lq of logic.logic_questions) {
                if (fieldErrors[lq.question_uuid]) {
                  orderedErrorKeys.push(lq.question_uuid);
                }
              }
            }
          }
        }
      }

      if (isStageApprovalMissing) {
        orderedErrorKeys.push(STAGE_APPROVAL_ERROR_KEY);
      }

      setValidationErrorCount(orderedErrorKeys.length);
      setShowValidationBanner(true);
      setBannerDismissed(false);
      setErrorFieldKeys(orderedErrorKeys);
      setCurrentErrorIndex(0);

      // Wait a bit more for conditionally visible questions to render
      setTimeout(async () => {
        const firstErrorKey = orderedErrorKeys[0];
        if (!firstErrorKey) return;

        if (firstErrorKey === STAGE_APPROVAL_ERROR_KEY) {
          scrollToStageApproval();
          return;
        }
        // Use KeyboardAwareContainer to scroll to the input
        keyboardContainerRef.current?.scrollToInput(firstErrorKey);
      }, 200); // Initial delay to let UI update

      // Removed Toast - validation banner provides better UX
      return false;
    }

    try {
      // Snapshot values immediately after validation passes, so we can queue a background submission
      // if the app is interrupted (call / app switch) before the network request completes.
      lastSubmitDataRef.current = getValues();

      // Ensure the ref has the latest mobile-created tasks before submission
      const pendingTempTasks = Object.values(temporaryFollowUpTasks).flat();
      if (
        pendingTempTasks.length > 0 &&
        pendingTempTasks.length !== temporaryTasksRef.current.length
      ) {
        temporaryTasksRef.current = pendingTempTasks;
      }

      // Call handleSubmit which should update the formSubmissionId state
      // This will trigger debugSetFormSubmissionId which handles all follow-up task creation
      shouldTriggerFollowupsRef.current = true;
      const submissionResponse: any =
        await handleSubmit(async (data) => {
          lastSubmitDataRef.current = data;
          return await handleFormSubmission(data);
        })();

      // Fallback: ensure trigger happens even if setFormSubmissionId wasn't called
      const submissionIdFromResponse = Number(
        submissionResponse?.form_submission_id || submissionResponse?.id,
      );
      if (
        submissionIdFromResponse &&
        !processedSubmissionIdsRef.current.has(submissionIdFromResponse) &&
        !triggerCalledRef.current
      ) {
        handleFormSubmissionIdSet(submissionIdFromResponse);
      }

      setHasJustBeenSubmitted(true);

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

      // If this form was loaded from a draft and submission completed,
      // remove the corresponding draft so it disappears from the Drafts tab.
      if (draftId && user?.id) {
        try {
          await offlineStorageService.removeDraft(draftId);
        } catch (draftError) {
        }
      }

      if (isEditMode && isLastStage && sourceScreen === "sent" && !isFromNotification) {
        router.replace({
          pathname: "/(app)/(tabs)/forms",
          params: { tab: "sent" },
        } as any);
      }
      return true;
    } catch (error) {
      shouldTriggerFollowupsRef.current = false;
      return false;
    } finally {
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
  }, [
    handleSubmit,
    handleFormSubmission,
    handleFormSubmissionIdSet,
    validateAllFields,
    getValues,
    draftId,
    user?.id,
    formId,
    temporaryFollowUpTasks,
    createTaskWithData,
    stages,
    assignedFormTitle,
    currentStage,
    isStageApprovalMissing,
    scrollToStageApproval,
    isEditMode,
    isLastStage,
    sourceScreen,
    isFromNotification,
  ]);

  // Note: Removed aggressive auto-hide logic that was causing scroll-to-top on every keystroke
  // Banner now hides when user focuses any field (handled in handleInputFocus)
  // This prevents performance issues and unwanted scrolling in large forms

  // Handle validation banner click - navigate to first unresolved error in visual order
  const handleValidationBannerClick = useCallback(async () => {
    const { errors: fieldErrors } = await validateAllFields();
    const currentErrorKeys: string[] = [];

    // Keep strict visual order: question -> sub_questions -> logic_questions
    const currentStageQuestions = currentStage?.questions || [];
    for (const q of currentStageQuestions) {
      if (fieldErrors[q.question_uuid]) {
        currentErrorKeys.push(q.question_uuid);
      }
      if (q.sub_questions?.length) {
        for (const sq of q.sub_questions) {
          if (fieldErrors[sq.question_uuid]) {
            currentErrorKeys.push(sq.question_uuid);
          }
        }
      }
      if (q.logics?.length) {
        for (const logic of q.logics) {
          if (logic.logic_questions?.length) {
            for (const lq of logic.logic_questions) {
              if (fieldErrors[lq.question_uuid]) {
                currentErrorKeys.push(lq.question_uuid);
              }
            }
          }
        }
      }
    }

    if (isStageApprovalMissing) {
      currentErrorKeys.push(STAGE_APPROVAL_ERROR_KEY);
    }

    if (currentErrorKeys.length === 0) {
      setShowValidationBanner(false);
      return;
    }

    // Always keep navigation pinned to the first unresolved field.
    // It advances naturally only after the first one is fixed.
    setErrorFieldKeys(currentErrorKeys);
    setCurrentErrorIndex(0);
    const targetErrorKey = currentErrorKeys[0];

    // Force-expand only the targeted dropdown during auto-navigation
    const findQuestionByKey = (questions: any[], targetKey: string): any => {
      for (const q of questions || []) {
        if (q?.question_uuid === targetKey || (q as any)?.uniqueId === targetKey) {
          return q;
        }
        const foundInSub = findQuestionByKey(q?.sub_questions || [], targetKey);
        if (foundInSub) return foundInSub;
        const foundInLogic = findQuestionByKey(
          (q?.logics || []).flatMap((l: any) => l?.logic_questions || []),
          targetKey,
        );
        if (foundInLogic) return foundInLogic;
      }
      return null;
    };

    const targetQuestion = findQuestionByKey(
      currentStage?.questions || [],
      targetErrorKey,
    );
    setAutoExpandAuditQuestionKey(
      targetQuestion?.question_type === "audit" ? targetErrorKey : null,
    );
    setAutoExpandMultipleChoiceQuestionKey(
      targetQuestion?.question_type === "multiple_choice" ||
        targetQuestion?.question_type === "checkboxes"
        ? targetErrorKey
        : null,
    );
    setAutoExpandDropdownQuestionKey(
      isDropdownLikeQuestionType(targetQuestion?.question_type)
        ? targetErrorKey
        : null,
    );

    if (targetErrorKey === STAGE_APPROVAL_ERROR_KEY) {
      setAutoExpandAuditQuestionKey(null);
      setAutoExpandMultipleChoiceQuestionKey(null);
      setAutoExpandDropdownQuestionKey(null);
      scrollToStageApproval();
      return;
    }

    // Retry scrollToInput multiple times to handle sub-questions that may not be mounted yet
    const tryScrollToInput = (retries = 3) => {
      if (retries <= 0) return;

      keyboardContainerRef.current?.scrollToInput(targetErrorKey);

      setTimeout(() => tryScrollToInput(retries - 1), 300);
    };

    // Scroll directly to the field using measureInWindow as fallback
    const scrollDirectlyToField = () => {
      const fieldRef = fieldRefs.current[targetErrorKey];

      if (
        fieldRef?.current &&
        typeof fieldRef.current.measureInWindow === "function"
      ) {
        fieldRef.current.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            if (y !== undefined && y !== null && height > 0) {
              // Keep the focused error field near center so it doesn't hide behind sticky banner
              const screenHeight = Dimensions.get("window").height;
              const targetScreenY = screenHeight * 0.45;
              const scrollDelta = y - targetScreenY;
              keyboardContainerRef.current?.scrollByOffset(
                Math.max(0, scrollDelta),
              );
            } else {
              // Fallback to scrollToTop if measurement fails
              keyboardContainerRef.current?.scrollToTop();
            }
          },
        );
      } else {
        // Field ref not available, try again after a short delay
        setTimeout(() => {
          const retryRef = fieldRefs.current[targetErrorKey];
          if (
            retryRef?.current &&
            typeof retryRef.current.measureInWindow === "function"
          ) {
            retryRef.current.measureInWindow(
              (x: number, y: number, width: number, height: number) => {
                if (y !== undefined && y !== null && height > 0) {
                  const screenHeight = Dimensions.get("window").height;
                  const scrollDelta = y - screenHeight * 0.45;
                  keyboardContainerRef.current?.scrollByOffset(
                    Math.max(0, scrollDelta),
                  );
                }
              },
            );
          } else {
            keyboardContainerRef.current?.scrollToTop();
          }
        }, 300);
      }
    };

    // Wait for UI updates, then try scrollToInput with retries, and fallback to direct scroll
    setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        tryScrollToInput();
        setTimeout(() => scrollDirectlyToField(), 1000); // Fallback after retries
      });
    }, 300);
  }, [
    validateAllFields,
    isStageApprovalMissing,
    scrollToStageApproval,
    currentStage,
  ]);

  // Update banner count and visibility when validation errors change
  useEffect(() => {
    const currentErrors = Object.keys(validationErrors).filter(
      (key) => validationErrors[key],
    );
    if (isStageApprovalMissing) {
      currentErrors.push(STAGE_APPROVAL_ERROR_KEY);
    }
    const errorCount = currentErrors.length;

    // Only update if the count actually changed to avoid unnecessary re-renders
    if (errorCount !== validationErrorCount) {
      setValidationErrorCount(errorCount);
    }

    // Update errorFieldKeys to remove cleared fields (maintains visual order)
    if (errorFieldKeys.length > 0 && errorCount < errorFieldKeys.length) {
      const updatedKeys = errorFieldKeys.filter((key) =>
        key === STAGE_APPROVAL_ERROR_KEY
          ? isStageApprovalMissing
          : validationErrors[key],
      );
      if (updatedKeys.length !== errorFieldKeys.length) {
        setErrorFieldKeys(updatedKeys);
        // Adjust currentErrorIndex if needed
        if (currentErrorIndex >= updatedKeys.length && updatedKeys.length > 0) {
          setCurrentErrorIndex(0);
        }
      }
    }

    // Hide banner when all errors are cleared
    if (errorCount === 0 && showValidationBanner) {
      setShowValidationBanner(false);
      setCurrentErrorIndex(0);
      setErrorFieldKeys([]);
    }
  }, [
    validationErrors,
    validationErrorCount,
    showValidationBanner,
    errorFieldKeys,
    currentErrorIndex,
  ]);

  const handlePreview = async () => {
    setShowPreviewOverlay(true);
    try {
      setAutoExpandAuditQuestionKey(null);
      setAutoExpandMultipleChoiceQuestionKey(null);
      setAutoExpandDropdownQuestionKey(null);
      const { isValid, errors: fieldErrors } = await validateAllFields();
      if (!isValid || isStageApprovalMissing) {
        // Collect error keys in VISUAL ORDER (order they appear in the form)
        const orderedErrorKeys: string[] = [];

        // Get current stage questions
        const currentStageQuestions = currentStage?.questions || [];

        // Collect errors from current stage questions in order
        for (const q of currentStageQuestions) {
          if (fieldErrors[q.question_uuid]) {
            orderedErrorKeys.push(q.question_uuid);
          }
          // Check sub_questions
          if (q.sub_questions?.length) {
            for (const sq of q.sub_questions) {
              if (fieldErrors[sq.question_uuid]) {
                orderedErrorKeys.push(sq.question_uuid);
              }
            }
          }
          // Check logic_questions
          if (q.logics?.length) {
            for (const logic of q.logics) {
              if (logic.logic_questions?.length) {
                for (const lq of logic.logic_questions) {
                  if (fieldErrors[lq.question_uuid]) {
                    orderedErrorKeys.push(lq.question_uuid);
                  }
                }
              }
            }
          }
        }

        if (isStageApprovalMissing) {
          orderedErrorKeys.push(STAGE_APPROVAL_ERROR_KEY);
        }

        setValidationErrorCount(orderedErrorKeys.length);
        setErrorFieldKeys(orderedErrorKeys);
        setCurrentErrorIndex(0);
        setShowValidationBanner(true);
        setBannerDismissed(false); // Reset banner dismissal when preview shows validation errors

        // Scroll to top to show the banner (like audit forms)
        setTimeout(() => {
          keyboardContainerRef.current?.scrollToTop();
        }, 100);
        return;
      }

      Toast.show({
        type: "info",
        text1: "Please preview once the form responses before submission",
        position: "top",
        visibilityTime: 4000,
      });
      setIsPreview(true);
    } finally {
      setShowPreviewOverlay(false);
    }
  };

  const handleAssignTaskPress = async () => {
    setShowAssigningOverlay(true);
    try {
      const currentStageData = currentStage ? [currentStage] : [];
      const formData = JSON.stringify({
        stages: currentStageData,
        formId,
        formType,
        currentStageId: currentStage?.id,
        currentFormValues: getValues(),
        visibleQuestions: Array.from(visibleQuestions),
        temporaryFollowUpTasks: Object.values(temporaryFollowUpTasks).flat(),
      });
      const bulkAssignKey = `bulk_assign_formData_${formId}`;
      let stored = false;
      try {
        await SecureStoreService.set(bulkAssignKey, formData);
        stored = true;
      } catch (storeError) {
      }
      const bulkAssignRoute = stored
        ? `/forms/bulk-assign-task?bulkAssignKey=${encodeURIComponent(bulkAssignKey)}`
        : `/forms/bulk-assign-task?formData=${encodeURIComponent(formData)}&bulkAssignKey=${encodeURIComponent(bulkAssignKey)}`;
      router.push(bulkAssignRoute as any);
    } finally {
      setShowAssigningOverlay(false);
    }
  };

  const handleNextStage = useCallback(async () => {
    if (isStageApprovalMissing) {
      setShowValidationBanner(true);
      setBannerDismissed(false);
      setValidationErrorCount((prev) => (prev > 0 ? prev : 1));
      setErrorFieldKeys((prev) => {
        if (prev.includes(STAGE_APPROVAL_ERROR_KEY)) return prev;
        return [...prev, STAGE_APPROVAL_ERROR_KEY];
      });
      setCurrentErrorIndex(0);
      scrollToStageApproval();
      return;
    }

    if (isEditMode || (isEditButtonClicked && canEditPreviousStateEnabled)) {
      const saved = await handleFormSubmit();
      if (!saved) return;
    }

    goToNextStage();
  }, [
    goToNextStage,
    isStageApprovalMissing,
    scrollToStageApproval,
    isEditMode,
    isEditButtonClicked,
    canEditPreviousStateEnabled,
    handleFormSubmit,
  ]);

  // ===== DRAFT FUNCTIONALITY =====

  // Save current form data as draft
  const saveDraft = useCallback(async (): Promise<boolean> => {
    try {
      setIsSavingDraft(true);
      const formData = watch();

      // Check if there's any data to save
      const hasData = Object.values(formData).some(
        (value) => value !== undefined && value !== null && value !== "",
      );

      if (!hasData) {
        Toast.show({
          type: "info",
          text1: "No Data to Save",
          text2: "Form is empty, nothing to save as draft.",
          position: "top",
        });
        return false;
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
        //   form_type: formType, // Indicate this is a multi-stage form
        //   title: formTitle,
        //   name: formTitle,
        // }, // Store complete form structure for offline access
        userId: user.id || 0,
        organizationId: user.organizationId || 0,
        sourceScreen: (params.sourceScreen as string) || "new",
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
        const serverDraftId = res?.data?.draft_id || res?.data?.id || null;
        try {
          // Store the draft locally with the server-assigned ID
          const localDraftId = serverDraftId
            ? `db_draft_${serverDraftId}`
            : undefined;
          await offlineStorageService.storeDraft({
            ...draftData,
            id: localDraftId,
          });

          // If we have a server draft ID, also store the full draft data locally for offline access
          if (serverDraftId && localDraftId) {
            const fullDraftData: any = {
              id: localDraftId,
              formId: Number(formId),
              formTitle: formTitle || (formData as any)?.title || "Multi-Stage Form",
              currentStageIndex: 0,
              completedStages: [],
              formData: draftData.formData,
              formStructure: formData,
              timestamp: Date.now(),
              userId: user.id || 0,
              organizationId: (user as any).organizationId || 0,
              sourceScreen: "multi-stage",
            };
            await offlineStorageService.storeDatabaseDraftLocally(
              fullDraftData,
            );
          }
        } catch (storeErr) {
        }

      } catch (s3Error) {
        Toast.show({
          type: "error",
          text1: "Save Failed",
          text2: "Failed to save draft. Please try again.",
          position: "top",
        });
        return false; // Don't continue if S3 save failed
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: "Failed to save draft. Please try again.",
        position: "top",
      });
      return false;
    } finally {
      setIsSavingDraft(false);
    }
    return true;
  }, [
    formId,
    currentStage,
    currentStageIndex,
    completedStages,
    watch,
    user,
    params.sourceScreen,
    stages,
    formTitle,
    draftId,
    originalDraftId,
  ]);

  // Handle back button press - show draft confirmation
  const handleBackPress = useCallback(async () => {
    // Don't show draft prompt for view mode, completed forms, auto-redirecting after submission, viewing sent forms, or just submitted forms
      if (
        isViewMode ||
        isFromNotification ||
        isAutoRedirecting ||
        sourceScreen === "sent" ||
        hasJustBeenSubmitted ||
        stageSubmitted
      ) {
        if (propOnClose) {
          propOnClose();
        } else if (isFromNotification && returnToSharedOnly === "true") {
          router.replace({
            pathname: "/(app)/screens/Notification/notification",
            params: {
              showSharedOnly: "true",
              returnPath: notificationReturnPath,
            },
          } as any);
        } else {
          router.back();
        }
        return;
      }

    // Check if there's any form data
    const formData = watch();
    const hasData = Object.values(formData).some(
      (value) => value !== undefined && value !== null && value !== "",
    );

    if (!hasData) {
      // No data, just go back
      router.back();
      return;
    }

    // If this is a draft that hasn't been modified, don't show confirmation
    if (draftId && !getIsFormDirty()) {
      // No changes made to the draft, just go back
      router.back();
      return;
    }

    // Show draft confirmation popup
    setShowDraftConfirmation(true);
  }, [
    isViewMode,
    isFromNotification,
    isAutoRedirecting,
    watch,
    draftId,
    getIsFormDirty,
    params.sourceScreen,
    propSourceScreen,
      hasJustBeenSubmitted,
      stageSubmitted,
      sourceScreen,
      returnToSharedOnly,
      notificationReturnPath,
    ]);

  // Confirm saving draft and go back
  const handleSaveDraftAndBack = useCallback(async () => {
    try {
      setShowDraftConfirmation(false);
      setAllowNavigation(true);
      const didSave = await saveDraft();
      // Use setTimeout to ensure modal closes before navigation
      setTimeout(() => {
        if (didSave) {
          Toast.show({
            type: "success",
            text1: "Draft Saved",
            text2: "Your audit form progress and scores have been saved to cloud.",
            position: "top",
          });
        }
        router.back();
      }, 100);
    } catch (error) {
      setShowDraftConfirmation(false);
      setAllowNavigation(false);
    }
  }, [saveDraft]);

  // Don't save draft, just go back
  const handleBackWithoutSaving = useCallback(() => {
    setShowDraftConfirmation(false);
    setAllowNavigation(true);
    // Use setTimeout to ensure modal closes before navigation
    setTimeout(() => {
      router.back();
    }, 100);
  }, []);

  // Cancel draft prompt
  const handleCancelDraftPrompt = useCallback(() => {
    setShowDraftConfirmation(false);
  }, []);

  // Register global header options and back button for sent/view form screens
  const formCallbacksRef = useRef({ handleEditPreviousStageFromTopMenu, handleShareAction, handleMakePdf, handleBackPress });
  formCallbacksRef.current = { handleEditPreviousStageFromTopMenu, handleShareAction, handleMakePdf, handleBackPress };

  useEffect(() => {
    const isSent = sourceScreen === "sent";
    const isViewingSubmission = !!submissionId || !!formSubmissionId || !!submissionsDetail?.id;
    const optionsEnabled = !!(
      isSent &&
      submissionsDetail?.is_completed &&
      (isToggleEnabled || canEditPreviousStateEnabled)
    );
    const { handleEditPreviousStageFromTopMenu: onEdit, handleShareAction: onShare, handleMakePdf: onPdf, handleBackPress: onBack } = formCallbacksRef.current;

    setShowBackButton(isSent || isViewingSubmission);
    setOnBackPress(() => onBack);
    setFormOptions({
      enabled: optionsEnabled,
      onEdit,
      onShare,
      onPdf: () => onPdf(),
    });

    return () => {
      setFormOptions({ enabled: false });
      setShowBackButton(false);
      setOnBackPress(undefined);
    };
  }, [
    sourceScreen,
    submissionId,
    formSubmissionId,
    submissionsDetail?.is_completed,
    submissionsDetail?.id,
    isToggleEnabled,
    canEditPreviousStateEnabled,
    setFormOptions,
    setShowBackButton,
    setOnBackPress,
  ]);

  // Back button interception for both hardware and header back buttons
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackPress();
        return true; // Prevent default behavior
      },
    );

    // Intercept header back button (Expo Router navigation)
    const unsubscribe = navigation.addListener(
      "beforeRemove",
      (e: { preventDefault: () => void }) => {
        // If navigation is already allowed, don't intercept
        if (allowNavigation) {
          return;
        }

        // Don't intercept if we're in view mode, from notification, auto-redirecting after submission, viewing sent forms, or success modal is showing
        if (
          isViewMode ||
          isFromNotification ||
          isAutoRedirecting ||
          params.sourceScreen === "sent" ||
          showSuccessModal ||
          stageSubmitted ||
          hasJustBeenSubmitted
        ) {
          return;
        }

        // Check if there's any form data
        const formData = watch();
        const hasData = Object.values(formData).some(
          (value) => value !== undefined && value !== null && value !== "",
        );

        if (!hasData) {
          // No data, allow navigation
          return;
        }

        // If this is a draft and the user hasn't modified it, allow navigation
        if (draftId && !getIsFormDirty()) {
          return;
        }

        // Prevent default navigation and show draft confirmation
        e.preventDefault();
        setShowDraftConfirmation(true);
      },
    );

    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [
    navigation,
    handleBackPress,
    isViewMode,
    isFromNotification,
    isAutoRedirecting,
    watch,
    allowNavigation,
    params.sourceScreen,
    showSuccessModal,
    stageSubmitted,
    hasJustBeenSubmitted,
    draftId,
    getIsFormDirty,
  ]);

  // Memoize allQuestions to prevent recreation on every render
  const allQuestions = useMemo(() => {
    return stages.flatMap((stage) => stage.questions || []);
  }, [stages]);

  const isPreviousStageInlineEditFlow =
    !isEditMode &&
    isEditButtonClicked &&
    canEditPreviousStateEnabled &&
    previousStageEditCeilingIndex !== null &&
    currentStageIndex < previousStageEditCeilingIndex;

  const renderQuestionWithSeparator = useCallback(
    (question: any, index: number, totalQuestions: number) => {
      // Only use React Hook Form's errors for styling - fields become normal immediately when filled
      const hasError = !!errorsRef.current[question.question_uuid];

      let isEditable = false;
      if (isViewMode || isPreview) isEditable = false;
      else if (isReadOnlyStagePreview) isEditable = false;
      else if (propTodoDisabled)
        isEditable = false; // Disable form fields for todo forms before start
      else if (isEditMode) isEditable = true;
      else if (sourceScreen === "received")
        isEditable = true; // Allow editing for forms accessed from RECEIVED tab
      else if (!submissionId && !submissionsDetail) isEditable = true;
      else if (isEditButtonClicked === true) isEditable = true;
      else isEditable = false;

      // Handle follow-up task rendering
      if (question.question_type === "followup_task") {
        // Check if this web-defined task has meaningful configured content
        const title = question.title;
        const description = question.description;
        const formTitle =
          question.assigned_form_title || question.assign_form_name || "";
        const hasAssignedForm = !!(
          question.assign_form ||
          question.assigned_form_title ||
          question.assign_form_name
        );
        const hasMeaningfulFollowUpContent = !!(
          (typeof title === "string" && title.trim() !== "") ||
          (typeof description === "string" && description.trim() !== "") ||
          (typeof formTitle === "string" && formTitle.trim() !== "") ||
          (question.deadline != null &&
            !Number.isNaN(Number(question.deadline))) ||
          (Array.isArray(question.assign_user_ids) &&
            question.assign_user_ids.length > 0) ||
          (Array.isArray(question.assign_group_ids) &&
            question.assign_group_ids.length > 0) ||
          (Array.isArray(question.assign_leader_ids) &&
            question.assign_leader_ids.length > 0) ||
          question.assign_to === "form_submitter" ||
          (Array.isArray(question.task_close_questions) &&
            question.task_close_questions.length > 0)
        );
        const hasEmptyContent = !hasMeaningfulFollowUpContent;
        const hasTemporaryTaskForParent =
          !!question._parentQuestion &&
          (temporaryFollowUpTasks[question._parentQuestion]?.length ?? 0) > 0;
        const isFollowUpCollapsed =
          collapsedFollowUpTasks[question.question_uuid] ?? true;

        const followUpComponent = (
          <View
            key={question.question_uuid}
            ref={(ref) => {
              if (ref)
                fieldRefs.current[question.question_uuid] = { current: ref };
            }}
            style={styles.followUpTaskContainer}
          >
            <View style={styles.followUpTaskHeader}>
              <View style={styles.followUpTaskHeaderLeft}>
                <MaterialIcons name="assignment" size={20} color="#007AFF" />
                <Text style={styles.followUpTaskTitle}>
                  {question.title && question.title.trim() !== ""
                    ? question.title
                    : "Follow-Up Task"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.followUpTaskToggleButton}
                onPress={() =>
                  setCollapsedFollowUpTasks((prev) => ({
                    ...prev,
                    [question.question_uuid]: !isFollowUpCollapsed,
                  }))
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons
                  name={isFollowUpCollapsed ? "expand-more" : "expand-less"}
                  size={20}
                  color="#007AFF"
                />
              </TouchableOpacity>
            </View>
            {!isFollowUpCollapsed && (
              <View style={styles.followUpTaskContent}>
                {hasEmptyContent ? (
                  <Text style={styles.followUpTaskValue}>
                    You have pending task
                  </Text>
                ) : (
                  <>
                    <Text style={styles.followUpTaskLabel}>Title:</Text>
                    <Text style={styles.followUpTaskValue}>{question.title}</Text>

                    <Text style={styles.followUpTaskLabel}>Description:</Text>
                    <Text style={styles.followUpTaskValue}>
                      {question.description && question.description.trim() !== ""
                        ? question.description
                        : "------"}
                    </Text>

                    <Text style={styles.followUpTaskLabel}>Form:</Text>
                    <Text style={styles.followUpTaskValue}>{formTitle}</Text>

                    <Text style={styles.followUpTaskLabel}>Deadline:</Text>
                    <Text style={styles.followUpTaskValue}>
                      {question.deadline} days after form submission
                    </Text>

                    <Text style={styles.followUpTaskLabel}>Assigned to:</Text>
                    <Text style={styles.followUpTaskValue}>
                      {(() => {
                        const userNames =
                          question.assign_user_ids?.length > 0
                            ? users
                                .filter((u) =>
                                  question.assign_user_ids.includes(u.id),
                                )
                                .map(
                                  (u) =>
                                    `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                                    u.username,
                                )
                            : [];
                        const groupNames =
                          question.assign_group_ids?.length > 0
                            ? groups
                                .filter((g) =>
                                  question.assign_group_ids.includes(g.id),
                                )
                                .map((g) => g.name)
                            : [];
                        const labels = [...userNames, ...groupNames].filter(Boolean);
                        if (labels.length > 0) return labels.join(", ");
                        if (question.assign_to === "form_submitter")
                          return "Form Submitter";
                        return "Not specified";
                      })()}
                    </Text>

                    {question.task_close_questions &&
                      question.task_close_questions.length > 0 && (
                        <>
                          <Text style={styles.followUpTaskLabel}>
                            Close Task Questions:
                          </Text>
                          <Text style={styles.followUpTaskValue}>
                            {question.task_close_questions.length} question(s)
                          </Text>
                        </>
                      )}
                  </>
                )}
              </View>
            )}
          </View>
        );

        if (hasEmptyContent && hasTemporaryTaskForParent) return null;

        // Only render if visible - but always show followup tasks
        if (
          question.question_type !== "followup_task" &&
          !visibleQuestions.has(question.question_uuid)
        )
          return null;

        // Add separator line after each question except the last one
        if (index < totalQuestions - 1) {
          return (
            <React.Fragment key={`${question.question_uuid}-wrapper`}>
              {followUpComponent}
              <View style={styles.questionSeparator} />
            </React.Fragment>
          );
        }

        return followUpComponent;
      }

      // Always create refs for all questions, even if not visible, to ensure navigation works
      const questionComponent = (
        <View
          key={question.question_uuid}
          ref={(ref) => {
            if (ref)
              fieldRefs.current[question.question_uuid] = { current: ref };
          }}
        >
          {question.question_type === "table" ? (
            <TableField
              question={question}
              control={control}
              errors={errorsRef.current}
              isCompleted={
                !isEditMode &&
                !isViewMode &&
                !isPreviousStageInlineEditFlow &&
                currentStage?.is_completed
              }
              isEditable={isEditable}
              container={
                keyboardContainerRef as React.RefObject<
                  import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef
                >
              }
            />
          ) : (
            <FormField
              question={question}
              control={control}
              errors={errorsRef.current}
              isCompleted={
                !isEditMode &&
                !isViewMode &&
                !isFromNotification &&
                !isPreviousStageInlineEditFlow &&
                currentStage?.is_completed
              }
              allQuestions={allQuestions}
              setValue={setValue}
              hasError={hasError}
              isEditable={isEditable}
              onFocus={handleInputFocus}
              focusedInputKey={focusedInputKeyRef.current}
              visibleQuestions={visibleQuestions}
              validationErrors={validationErrorsRef.current}
              plannerLocationId={plannerLocationId}
              plannerLocationName={plannerLocation}
              defaultExpanded={
                question.question_type === "audit" ||
                question.question_type === "multiple_choice" ||
                question.question_type === "checkboxes" ||
                isDropdownLikeQuestionType(question.question_type)
                  ? false
                  : undefined
              }
              forceExpanded={
                ((question.question_type === "audit" &&
                  autoExpandAuditQuestionKey ===
                    ((question as any).uniqueId || question.question_uuid)) ||
                  ((question.question_type === "multiple_choice" ||
                    question.question_type === "checkboxes") &&
                    autoExpandMultipleChoiceQuestionKey ===
                      ((question as any).uniqueId ||
                        question.question_uuid)) ||
                  (isDropdownLikeQuestionType(question.question_type) &&
                    autoExpandDropdownQuestionKey ===
                      ((question as any).uniqueId || question.question_uuid)))
              }
            />
          )}
        </View>
      );

      // Only render if visible
      if (!visibleQuestions.has(question.question_uuid)) return null;

      // Add separator line after each question except the last one
      if (index < totalQuestions - 1) {
        return (
          <React.Fragment key={`${question.question_uuid}-wrapper`}>
            {questionComponent}
            <View style={styles.questionSeparator} />
          </React.Fragment>
        );
      }

      return questionComponent;
    },
    [
      visibleQuestions,
      isViewMode,
      isReadOnlyStagePreview,
      isEditMode,
      submissionId,
      submissionsDetail,
      isEditButtonClicked,
      isFromNotification,
      control,
      allQuestions,
      setValue,
      handleInputFocus,
      currentStage,
      collapsedFollowUpTasks,
      temporaryFollowUpTasks,
      autoExpandAuditQuestionKey,
      autoExpandMultipleChoiceQuestionKey,
      autoExpandDropdownQuestionKey,
    ],
  );

  const shouldShowSubmitButton = useCallback(() => {
    // Don't show submit buttons for fully completed multi-stage forms
    if (isFullyCompletedMultiStageForm) return false;
    if (isReadOnlyStagePreview) return false;
    // In edit mode, keep save/update actions visible across stage navigation.
    if (isEditMode) return true;
    if (isEditButtonClicked && canEditPreviousStateEnabled) return true;

    if (!submissionId && !submissionsDetail) return !stageSubmitted;
    const show =
      !stageSubmitted &&
      (!stages.some((s) => s.updated) || isEditMode || isEditButtonClicked) &&
      (isEditMode ||
        (isEditButtonClicked &&
          isToggleEnabled &&
          isFormAssignedToUser &&
          (submissionId || formSubmissionId)) ||
        !stages[currentStageIndex]?.is_completed) &&
      (submissionId || formSubmissionId || isFirstStage);
    return show;
  }, [
    submissionId,
    submissionsDetail,
    stages,
    currentStageIndex,
    stageSubmitted,
    isEditMode,
    isEditButtonClicked,
    canEditPreviousStateEnabled,
    formSubmissionId,
    isFirstStage,
    isToggleEnabled,
    isFormAssignedToUser,
    isFullyCompletedMultiStageForm,
    isReadOnlyStagePreview,
  ]);

  const showStandardStickyFooter =
    !isViewMode &&
    !isEditMode &&
    shouldShowSubmitButton() &&
    !isKeyboardVisible &&
    !propTodoDisabled &&
    !propTodoStarted &&
    formType !== "audit";
  const showPreviewStickyActions = showStandardStickyFooter && isPreview;
  const showNonPreviewStickyActions = showStandardStickyFooter && !isPreview;
  const hasFollowUpTasks = useMemo(() => {
    const hasConfiguredFollowUps = stages.some((stage) =>
      (stage.questions || []).some((q: any) =>
        (q.logics || []).some(
          (l: any) => l?.follow_up || l?.followup_toggle,
        ),
      ),
    );
    if (hasConfiguredFollowUps) return true;

    return Object.values(temporaryFollowUpTasks).some(
      (tasks) => Array.isArray(tasks) && tasks.length > 0,
    );
  }, [stages, temporaryFollowUpTasks]);

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

  if (loading || isDraftLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
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
      </View>
    );
  }

  if (!stages.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No stages available</Text>
      </View>
    );
  }

  return (
    <PreviousSubmissionsContext.Provider value={previousSubmissionsData}>
    <View style={styles.screenContainer}>
      {/* Sticky validation banner overlay (kept fixed at top like audit behavior) */}
      <View style={styles.stickyValidationBannerContainer} pointerEvents="box-none">
        <ValidationErrorBanner
          errorCount={validationErrorCount}
          visible={showValidationBanner}
          onPress={handleValidationBannerClick}
          currentErrorIndex={currentErrorIndex}
          totalErrors={errorFieldKeys.length}
        />
      </View>

      <KeyboardAwareContainer
        ref={keyboardContainerRef}
        formType="standard"
        contentContainerStyle={StyleSheet.flatten([
          styles.formContainer,
          validationErrorCount > 0 &&
            !bannerDismissed &&
            styles.formContainerWithBanner,
        ])}
      >
        <FormContainerContext.Provider
          value={
            keyboardContainerRef as React.RefObject<
              import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef
            >
          }
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.formContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            removeClippedSubviews={true}
            scrollEnabled={
              !showAssignModal &&
              !showTaskDialog &&
              !showStageMenu &&
              !showSuccessModal &&
              !showDraftConfirmation
            }
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            onScroll={(event) =>
              { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }
            }
          >
            <View style={styles.stageIndicator}>
              <StageIndicator
                stages={stages}
                currentStageIndex={currentStageIndex}
                completedStages={completedStages}
                onStagePress={goToStage}
                allowPreviewNavigation={allowStagePreviewNavigation}
                isToggleEnabled={false}
                isFormAssignedToUser={isFormAssignedToUser}
              />
            </View>

            <Accordion
              key={`stage-${currentStage?.id ?? "loading"}-${forceRefresh}`}
              title={currentStage?.name || "Loading..."}
              isCompleted={completedStages.includes(currentStageIndex)}
            >
              {!submitting ? (
                (() => {
                  const questions = currentStage?.questions || [];

                  return (
                    <>
                      {questions.map((question: any, questionIndex: number) => {
                        // Get follow-up tasks for this specific question (only show if visible)
                        const questionFollowUpTasks =
                          question.logics
                            ?.filter(
                              (logic: any) =>
                                logic.follow_up &&
                                visibleQuestions.has(`followup-${logic.id}`),
                            )
                            .map((logic: any) => ({
                              ...logic.follow_up,
                              _isFollowUpTask: true,
                              _logicId:
                                logic.follow_up?.id ||
                                logic.follow_up?.follow_up_id ||
                                logic.id,
                              _parentQuestion: question.question_uuid,
                              question_uuid: `followup-${logic.id}`,
                              question_type: "followup_task",
                            })) || [];

                        // Get temporary tasks for this specific question
                        const questionTemporaryTasks =
                          temporaryFollowUpTasks[question.question_uuid] || [];
                        const hasTemporaryTask =
                          questionTemporaryTasks.length > 0;

                        return (
                          <React.Fragment key={question.question_uuid}>
                            {/* Render the main question */}
                            {renderQuestionWithSeparator(
                              question,
                              questionIndex,
                              questions.length,
                            )}

                            {/* Render follow-up tasks immediately after their parent question */}
                            {questionFollowUpTasks.map(
                              (followUpTask: any, taskIndex: number) => (
                                <React.Fragment
                                  key={followUpTask.question_uuid}
                                >
                                  {renderQuestionWithSeparator(
                                    followUpTask,
                                    taskIndex,
                                    questionFollowUpTasks.length,
                                  )}
                                </React.Fragment>
                              ),
                            )}

                            {/* Render temporary tasks for this question */}
                            {questionTemporaryTasks.map(
                              (task: any, taskIndex: number) => {
                                const tempTaskKey = `temp-${task.id}`;
                                const isTempCollapsed =
                                  collapsedFollowUpTasks[tempTaskKey] ?? true;
                                return (
                                  <View
                                    key={`temp-task-${task.id}`}
                                    style={styles.followUpTaskContainer}
                                  >
                                    <View style={styles.followUpTaskHeader}>
                                      <View style={styles.followUpTaskHeaderLeft}>
                                        <MaterialIcons
                                          name="assignment"
                                          size={20}
                                          color="#007AFF"
                                        />
                                        <Text style={styles.followUpTaskTitle}>
                                          {task.title &&
                                          String(task.title).trim() !== ""
                                            ? task.title
                                            : "Follow-Up Task"}
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        style={styles.followUpTaskToggleButton}
                                        onPress={() =>
                                          setCollapsedFollowUpTasks((prev) => ({
                                            ...prev,
                                            [tempTaskKey]: !isTempCollapsed,
                                          }))
                                        }
                                        hitSlop={{
                                          top: 8,
                                          bottom: 8,
                                          left: 8,
                                          right: 8,
                                        }}
                                      >
                                        <MaterialIcons
                                          name={
                                            isTempCollapsed
                                              ? "expand-more"
                                              : "expand-less"
                                          }
                                          size={20}
                                          color="#007AFF"
                                        />
                                      </TouchableOpacity>
                                    </View>
                                    {!isTempCollapsed && (
                                      <View style={styles.followUpTaskContent}>
                                        <Text style={styles.followUpTaskLabel}>
                                          Title:
                                        </Text>
                                        <Text style={styles.followUpTaskValue}>
                                          {task.title}
                                        </Text>

                                        <Text style={styles.followUpTaskLabel}>
                                          Description:
                                        </Text>
                                        <Text style={styles.followUpTaskValue}>
                                          {task.description &&
                                          String(task.description).trim() !== ""
                                            ? task.description
                                            : "------"}
                                        </Text>

                                        {task.assign_form_name && (
                                          <>
                                            <Text
                                              style={styles.followUpTaskLabel}
                                            >
                                              Form:
                                            </Text>
                                            <Text
                                              style={styles.followUpTaskValue}
                                            >
                                              {task.assign_form_name}
                                            </Text>
                                          </>
                                        )}

                                        <Text style={styles.followUpTaskLabel}>
                                          Deadline:
                                        </Text>
                                        <Text style={styles.followUpTaskValue}>
                                          {task.deadline} days after form
                                          submission
                                        </Text>

                                        <Text style={styles.followUpTaskLabel}>
                                          Assigned to:
                                        </Text>
                                        <Text style={styles.followUpTaskValue}>
                                          {(() => {
                                            const userNames = Array.isArray(
                                              task.assign_user_names,
                                            )
                                              ? task.assign_user_names
                                              : [];
                                            const groupNames = Array.isArray(
                                              task.assign_group_names,
                                            )
                                              ? task.assign_group_names
                                              : [];
                                            const labels = [
                                              ...userNames,
                                              ...groupNames,
                                            ].filter(Boolean);
                                            if (labels.length > 0)
                                              return labels.join(", ");
                                            if (task.assign_to === "form_submitter")
                                              return "Form Submitter";
                                            return "Not specified";
                                          })()}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              },
                            )}

                            {/* Edit/Add Follow-Up Task Button - show only when a follow-up task is visible */}
                            {(() => {
                              if (
                                isViewMode ||
                                isFromNotification ||
                                isReadOnlyStagePreview
                              )
                                return null;
                              if (questionFollowUpTasks.length === 0)
                                return null;
                              const followUpTask = questionFollowUpTasks[0];
                              if (
                                followUpTask?.question_uuid &&
                                (collapsedFollowUpTasks[
                                  followUpTask.question_uuid
                                ] ??
                                  true)
                              )
                                return null;
                              const hasAssignedFormForButton = !!(
                                followUpTask?.assign_form ||
                                followUpTask?.assigned_form_title ||
                                followUpTask?.assign_form_name
                              );
                              const hasWebFollowUpDataForButton = !!(
                                (typeof followUpTask?.title === "string" &&
                                  followUpTask.title.trim() !== "") ||
                                (typeof followUpTask?.description ===
                                  "string" &&
                                  followUpTask.description.trim() !== "") ||
                                (followUpTask?.deadline != null &&
                                  !Number.isNaN(Number(followUpTask.deadline))) ||
                                (Array.isArray(followUpTask?.assign_user_ids) &&
                                  followUpTask.assign_user_ids.length > 0) ||
                                (Array.isArray(followUpTask?.assign_group_ids) &&
                                  followUpTask.assign_group_ids.length > 0) ||
                                (Array.isArray(
                                  followUpTask?.assign_leader_ids,
                                ) &&
                                  followUpTask.assign_leader_ids.length > 0) ||
                                followUpTask?.assign_to === "form_submitter" ||
                                (Array.isArray(
                                  followUpTask?.task_close_questions,
                                ) &&
                                  followUpTask.task_close_questions.length > 0)
                              );
                              const shouldUseEditFollowUpFlow =
                                hasAssignedFormForButton ||
                                hasWebFollowUpDataForButton;
                              const shouldShowButton =
                                shouldUseEditFollowUpFlow ||
                                (!shouldUseEditFollowUpFlow &&
                                  !hasTemporaryTask);
                              if (!shouldShowButton) return null;
                              return (
                                <TouchableOpacity
                                  style={styles.addTaskButton}
                                  onPress={() => {

                                    // Always open the modal for editing tasks, regardless of web-created or mobile-created
                                    const followUpTask =
                                      questionFollowUpTasks[0];
                                    if (shouldUseEditFollowUpFlow) {

                                      // Pre-populate modal fields with current web task data
                                      setTaskTitle(followUpTask.title || "");
                                      setTaskDescription(
                                        followUpTask.description || "",
                                      );
                                      setTaskDeadline(
                                        followUpTask.deadline || 7,
                                      );

                                      // Parse and set assignee IDs
                                      let webUserIds =
                                        followUpTask.assign_user_ids || [];
                                      let webGroupIds =
                                        followUpTask.assign_group_ids || [];
                                      let webLeaderIds =
                                        followUpTask.assign_leader_ids || [];

                                      // Handle JSON parsing if needed
                                      if (typeof webUserIds === "string") {
                                        try {
                                          webUserIds = JSON.parse(webUserIds);
                                        } catch (e) {
                                          webUserIds = [];
                                        }
                                      }
                                      if (typeof webGroupIds === "string") {
                                        try {
                                          webGroupIds = JSON.parse(webGroupIds);
                                        } catch (e) {
                                          webGroupIds = [];
                                        }
                                      }
                                      if (typeof webLeaderIds === "string") {
                                        try {
                                          webLeaderIds =
                                            JSON.parse(webLeaderIds);
                                        } catch (e) {
                                          webLeaderIds = [];
                                        }
                                      }

                                      // Convert IDs to names
                                      const webUserNames: string[] = users
                                        .filter((u) =>
                                          webUserIds.includes(u.id),
                                        )
                                        .map(
                                          (u) =>
                                            `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                                            u.username,
                                        );
                                      const webGroupNames: string[] = groups
                                        .filter((g) =>
                                          webGroupIds.includes(g.id),
                                        )
                                        .map((g) => g.name);
                                      const webLeaderNames: string[] = []; // Location leaders not supported in MultiStageFormScreen

                                      setAssignUsers([...webUserIds]);
                                      setAssignUserNames([...webUserNames]);
                                      setAssignGroups([...webGroupIds]);
                                      setAssignGroupNames([...webGroupNames]);
                                      setAssignLocationLeaders([
                                        ...webLeaderIds,
                                      ]);
                                      setAssignLocationLeaderNames([
                                        ...webLeaderNames,
                                      ]);

                                      // Set editing state for web task
                                      setIsEditingWebTask(true);
                                      setCurrentEditingTask({
                                        ...followUpTask,
                                        logicId: followUpTask._logicId,
                                      });
                                      setCurrentTaskQuestionUuid(
                                        question.question_uuid,
                                      );
                                    } else {

                                      setCurrentTaskQuestionUuid(
                                        question.question_uuid,
                                      );
                                      setIsEditingWebTask(false);
                                      setCurrentEditingTask(null);

                                      // Store LogicFollowUp id and parent Question id so backend gets correct
                                      // follow_task_sub_question_id / logic_followup_id per task (avoids same parent for all)
                                      const lfId =
                                        followUpTask.id ??
                                        followUpTask._logicId;
                                      const lfIdNum =
                                        lfId != null &&
                                        !Number.isNaN(Number(lfId))
                                          ? Number(lfId)
                                          : null;
                                      // Parent question id: question.id (accordion) or followUpTask.question (LogicFollowUp API, id or {id})
                                      let qIdNum: number | null = null;
                                      const qIdRaw =
                                        question.id ??
                                        followUpTask.question ??
                                        (typeof followUpTask.question ===
                                          "object" &&
                                        followUpTask.question != null
                                          ? followUpTask.question.id
                                          : null);
                                      if (
                                        qIdRaw != null &&
                                        !Number.isNaN(Number(qIdRaw))
                                      )
                                        qIdNum = Number(qIdRaw);
                                      setCurrentTaskLogicFollowUpId(lfIdNum);
                                      setCurrentTaskParentQuestionId(qIdNum);
                                      currentTaskLogicFollowUpIdRef.current =
                                        lfIdNum;
                                      currentTaskParentQuestionIdRef.current =
                                        qIdNum;

                                      // Reset modal to empty state
                                      setTaskTitle("");
                                      setTaskDescription("");
                                      setTaskDeadline(0);
                                      setAssignUsers([]);
                                      setAssignUserNames([]);
                                      setAssignGroups([]);
                                      setAssignGroupNames([]);
                                      setAssignLocationLeaders([]);
                                      setAssignLocationLeaderNames([]);

                                      setShowTaskDialog(true);
                                    }

                                    // Always open the modal
                                    setShowTaskDialog(true);
                                  }}
                                >
                                  <MaterialIcons
                                    name="edit"
                                    size={20}
                                    color="#007AFF"
                                    style={{ marginRight: 8 }}
                                  />
                                  <Text style={styles.addTaskButtonText}>
                                    {shouldUseEditFollowUpFlow
                                      ? "Edit Follow-Up Task"
                                      : "Add Follow-Up Task"}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })()}
                          </React.Fragment>
                        );
                      }) || <Text>No questions</Text>}

                      {stageApprovalMeta && (
                        <View
                          ref={stageApprovalRef}
                          style={[
                            styles.stageApprovalContainer,
                            isStageApprovalMissing &&
                              showValidationBanner &&
                              styles.stageApprovalContainerError,
                          ]}
                        >
                          {(() => {
                            const isStageApprovalAccepted =
                              stageApprovalDecision[stageApprovalMeta.stageId] ===
                              "accepted";
                            const isStageApprovalReadOnly =
                              isSentScreen || isReadOnlyStagePreview;
                            return (
                              <>
                                <Text style={styles.stageApprovalTitle}>
                                  Stage Approval
                                </Text>
                                <View style={styles.stageApprovalButtons}>
                                  <TouchableOpacity
                                    style={styles.stageApprovalOption}
                                    disabled={isStageApprovalReadOnly}
                                    onPress={() =>
                                !isStageApprovalReadOnly &&
                                setStageApprovalDecision((prev) => ({
                                  ...prev,
                                  [stageApprovalMeta.stageId]:
                                    prev[stageApprovalMeta.stageId] ===
                                    "rejected"
                                      ? null
                                      : "rejected",
                                }))
                              }
                            >
                              <MaterialIcons
                                name={
                                  stageApprovalDecision[
                                    stageApprovalMeta.stageId
                                  ] === "rejected"
                                    ? "check-box"
                                    : "check-box-outline-blank"
                                }
                                size={20}
                                color={
                                  stageApprovalDecision[
                                    stageApprovalMeta.stageId
                                  ] === "rejected"
                                    ? "#10B981"
                                    : "#9CA3AF"
                                }
                                style={styles.stageApprovalIcon}
                              />
                              <Text style={styles.stageApprovalOptionText}>
                                Accept
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.stageApprovalOption}
                              disabled={isStageApprovalReadOnly}
                              onPress={() =>
                                !isStageApprovalReadOnly &&
                                setStageApprovalDecision((prev) => ({
                                  ...prev,
                                  [stageApprovalMeta.stageId]:
                                    prev[stageApprovalMeta.stageId] ===
                                    "accepted"
                                      ? null
                                      : "accepted",
                                }))
                              }
                            >
                              <MaterialIcons
                                name={
                                  stageApprovalDecision[
                                    stageApprovalMeta.stageId
                                  ] === "accepted"
                                    ? "check-box"
                                    : "check-box-outline-blank"
                                }
                                size={20}
                                color={
                                  stageApprovalDecision[
                                    stageApprovalMeta.stageId
                                  ] === "accepted"
                                    ? "#EF4444"
                                    : "#9CA3AF"
                                }
                                style={styles.stageApprovalIcon}
                              />
                              <Text style={styles.stageApprovalOptionText}>
                                Reject
                              </Text>
                                  </TouchableOpacity>
                                </View>
                                <Text style={styles.stageApprovalHint}>
                                  (please select accept for next stage or end
                                  this form here by reject)
                                </Text>
                                <Text style={styles.stageApprovalLabel}>
                                  Remarks
                                </Text>
                                <TextInput
                                  style={styles.stageApprovalRemarksInput}
                                  value={
                                    stageApprovalRemarks[
                                      stageApprovalMeta.stageId
                                    ] ?? ""
                                  }
                                  onChangeText={(text) =>
                                    setStageApprovalRemarks((prev) => ({
                                      ...prev,
                                      [stageApprovalMeta.stageId]: text,
                                    }))
                                  }
                                  editable={
                                    isStageApprovalAccepted &&
                                    !isStageApprovalReadOnly
                                  }
                                  placeholder="Enter remarks"
                                  multiline
                                  textAlignVertical="top"
                                />
                                <Text style={styles.stageApprovalLabel}>
                                  Signature
                                </Text>
                                <SignatureField
                                  control={control}
                                  errors={errors}
                                  name={`stage_approval_signature_${stageApprovalMeta.stageId}`}
                                  question={{
                                    id: stageApprovalMeta.stageId,
                                    question: "Signature",
                                    question_type: "signature",
                                    is_required: false,
                                    reference_images: [],
                                    reference_videos: [],
                                  } as any}
                                  isCompleted={
                                    !isEditMode &&
                                    !isViewMode &&
                                    !isPreviousStageInlineEditFlow &&
                                    currentStage?.is_completed
                                  }
                                  isEditable={
                                    !isViewMode &&
                                    !isFromNotification &&
                                    isStageApprovalAccepted &&
                                    !isStageApprovalReadOnly
                                  }
                                />
                              </>
                            );
                          })()}
                        </View>
                      )}
                    </>
                  );
                })()
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196f3" />
                </View>
              )}
            </Accordion>

            <View style={styles.buttonContainer}>
              {!isEditMode &&
                !isViewMode &&
                !isEditButtonClicked &&
                (submissionId || submissionsDetail) &&
                isToggleEnabled &&
                isFormAssignedToUser &&
                submissionsDetail?.is_completed && (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#FF9500" }]}
                    onPress={() => setIsEditButtonClicked(true)}
                  >
                    <MaterialIcons
                      name="edit"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.buttonText}>Edit Form</Text>
                  </TouchableOpacity>
                )}

              {(isEditMode || isPreviousStageInlineEditFlow) && !isFromNotification && (
                <>
                  {!isFirstStage && (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={goToPrevStage}
                    >
                      <Text style={styles.buttonText}>Previous</Text>
                    </TouchableOpacity>
                  )}
                  {shouldShowSubmitButton() && isLastStage && (
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.nextButton,
                        submitting && styles.disabledButton,
                      ]}
                      onPress={handleFormSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color="#007AFF"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.buttonText}>
                            {isLastStage ? "Updating..." : "Saving..."}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.buttonText}>
                          Update
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {!isLastStage && (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleNextStage}
                    >
                      <Text style={styles.buttonText}>Save & Next</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {!isEditMode &&
                !isViewMode &&
                shouldShowSubmitButton() &&
                !propTodoDisabled &&
                (propTodoStarted ? (
                  <View style={styles.tripleButtonContainer}>
                    {/* <TouchableOpacity
                style={[styles.button, styles.draftStyleButton, styles.stackedButton]}
                onPress={() => setShowDraftConfirmation(true)}
              > */}
                    {/* <MaterialIcons name="save" size={20} color="white" style={{ marginRight: 8 }} /> */}
                    {/* <Text style={styles.buttonText}>Save as Draft</Text> */}
                    {/* </TouchableOpacity> */}
                    {!isPreview ? (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.nextButton,
                          styles.stackedButton,
                        ]}
                        onPress={handlePreview}
                      >
                        <Text style={styles.buttonText}>Preview</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.button, styles.stackedButton]}
                          onPress={() => setIsPreview(false)}
                        >
                          <MaterialIcons
                            name="edit"
                            size={20}
                            color="white"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.buttonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.button,
                            styles.nextButton,
                            submitting && styles.disabledButton,
                            styles.stackedButton,
                          ]}
                          onPress={handleFormSubmit}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <ActivityIndicator
                                size="small"
                                color="#fff"
                                style={{ marginRight: 8 }}
                              />
                              <Text style={styles.buttonText}>
                                Submitting...
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.buttonText}>
                              {!submissionId && !submissionsDetail
                                ? "Submit"
                                : isEditMode
                                  ? "Update"
                                  : "Submit"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : formType === "audit" ? (
                  <View style={styles.tripleButtonContainer}>
                    {/* <TouchableOpacity
                style={[styles.button, styles.draftStyleButton, styles.stackedButton]}
                onPress={() => setShowDraftConfirmation(true)}
              >
                <MaterialIcons name="save" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Save aft</Text>
              </TouchableOpacity> */}
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.nextButton,
                        submitting && styles.disabledButton,
                        styles.stackedButton,
                      ]}
                      onPress={handleFormSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color="#fff"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.buttonText}>Submitting...</Text>
                        </>
                      ) : (
                        <Text style={styles.buttonText}>
                          {!submissionId && !submissionsDetail
                            ? "Submit"
                            : isEditMode
                              ? "Update"
                              : "Submit"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null)}

              {/* Send to Next Button */}
              {showSendToNext &&
                !isViewMode &&
                !isFromNotification &&
                !isReadOnlyStagePreview && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#FF9500" }]}
                  onPress={handleSendToNext}
                  disabled={sendInProgress}
                >
                  {sendInProgress ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color="white"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.buttonText}>Sending…</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons
                        name="next-plan"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.buttonText}>Send to Next</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Final Share Button */}
              {stageSubmitted &&
                isLastStage &&
                isFormEnabledForSharing &&
                !isViewMode &&
                !isFromNotification &&
                !isReadOnlyStagePreview && (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#FF9500" }]}
                    onPress={handleShareAction}
                  >
                    <MaterialIcons
                      name="share"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.buttonText}>Share Form</Text>
                  </TouchableOpacity>
                )}
            </View>

            {(currentStage?.is_completed ||
              currentStage?.edited_on ||
              isFullyCompletedMultiStageForm) && (
              <View style={styles.completedInfo}>
                {isFullyCompletedMultiStageForm ? (
                  <>
                    <Text style={styles.stageHeaderText}>Form Completed</Text>
                    <View style={styles.completedInfoRow}>
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#10b981"
                        style={styles.completedInfoIcon}
                      />
                      <Text style={styles.completedText}>
                        All stages completed successfully
                      </Text>
                    </View>
                    <View style={styles.completedInfoRow}>
                      <MaterialIcons
                        name="event"
                        size={20}
                        color="#007AFF"
                        style={styles.completedInfoIcon}
                      />
                      <Text style={styles.completedText}>
                        Completed on:{" "}
                        {new Date(
                          currentStage?.completed_on ?? "",
                        ).toLocaleString() || "N/A"}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    {currentStage?.is_completed && (
                      <>
                        <Text style={styles.stageHeaderText}>Completed</Text>
                        <View style={styles.completedInfoRow}>
                          <MaterialIcons
                            name="person"
                            size={20}
                            color="#007AFF"
                            style={styles.completedInfoIcon}
                          />
                          <Text style={styles.completedText}>
                            Completed by:{" "}
                            {completedByUser
                              ? `${completedByUser.username}, ${completedByUser.department_details?.description || "N/A"}`
                              : "N/A"}
                          </Text>
                        </View>
                        <View style={styles.completedInfoRow}>
                          <MaterialIcons
                            name="event"
                            size={20}
                            color="#007AFF"
                            style={styles.completedInfoIcon}
                          />
                          <Text style={styles.completedText}>
                            Completed on:{" "}
                            {new Date(
                              currentStage.completed_on ?? "",
                            ).toLocaleString() || "N/A"}
                          </Text>
                        </View>
                        {currentStage?.edited_on && (
                          <View style={styles.infoSeparator} />
                        )}
                      </>
                    )}
                    {currentStage?.edited_on && (
                      <>
                        <Text style={styles.stageHeaderText}>Edited</Text>
                        <View style={styles.completedInfoRow}>
                          <MaterialIcons
                            name="edit"
                            size={20}
                            color="#007AFF"
                            style={styles.completedInfoIcon}
                          />
                          <Text style={styles.completedText}>
                            Edited by:{" "}
                            {editedByUser
                              ? `${editedByUser.username}, ${editedByUser.department_details?.description || "N/A"}`
                              : "N/A"}
                          </Text>
                        </View>
                        <View style={styles.completedInfoRow}>
                          <MaterialIcons
                            name="event"
                            size={20}
                            color="#007AFF"
                            style={styles.completedInfoIcon}
                          />
                          <Text style={styles.completedText}>
                            Edited on:{" "}
                            {new Date(currentStage.edited_on).toLocaleString()}
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>
            )}

            <SuccessModal
              visible={showSuccessModal}
              onClose={handleClose}
              onShare={handleShareAction}
              onShareToLeaders={handleShareToLeaders}
              onMakePdf={handleMakePdf}
              onViewSubmission={handleViewSubmission}
              users={users}
              isGeneratingPdf={isGeneratingPdf}
              submittedData={submittedData}
              showShareButtons={watch("share_reponse")}
            />

            {showStageMenu && selectedStageForEdit !== null && (
              <View style={styles.modalOverlay}>
                <View style={styles.stageMenuModal}>
                  <View style={styles.stageMenuHeader}>
                    <Text style={styles.stageMenuTitle}>
                      Stage {selectedStageForEdit + 1}:{" "}
                      {stages[selectedStageForEdit]?.name || "Unknown Stage"}
                    </Text>
                    <TouchableOpacity
                      onPress={handleStageMenuClose}
                      style={styles.stageMenuCloseButton}
                    >
                      <MaterialIcons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.stageMenuContent}>
                    {canEditStage(selectedStageForEdit) ? (
                      <TouchableOpacity
                        style={[
                          styles.stageMenuOption,
                          selectedStageForEdit === currentStageIndex &&
                            styles.stageMenuOptionDisabled,
                        ]}
                        onPress={() => handleEditStage(selectedStageForEdit)}
                        disabled={selectedStageForEdit === currentStageIndex}
                      >
                        <MaterialIcons
                          name="edit"
                          size={20}
                          color={
                            selectedStageForEdit === currentStageIndex
                              ? "#CCC"
                              : "#007AFF"
                          }
                          style={styles.stageMenuIcon}
                        />
                        <Text
                          style={[
                            styles.stageMenuOptionText,
                            selectedStageForEdit === currentStageIndex &&
                              styles.stageMenuOptionTextDisabled,
                          ]}
                        >
                          {selectedStageForEdit === currentStageIndex
                            ? "Currently Editing"
                            : "Edit Stage"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.stageMenuOption,
                          styles.stageMenuOptionDisabled,
                        ]}
                      >
                        <MaterialIcons
                          name="edit-off"
                          size={20}
                          color="#CCC"
                          style={styles.stageMenuIcon}
                        />
                        <Text
                          style={[
                            styles.stageMenuOptionText,
                            styles.stageMenuOptionTextDisabled,
                          ]}
                        >
                          {stages[selectedStageForEdit]?.is_completed
                            ? "Cannot edit completed stage"
                            : "Stage not available for editing"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

          </ScrollView>
        </FormContainerContext.Provider>
      </KeyboardAwareContainer>

      <Modal
        transparent
        animationType="fade"
        visible={showAssignModal}
        onRequestClose={() => {
          setShowAssignModal(false);
          setTriggeredByShare(false);
          setSelectedUsers([]);
          setSelectedGroups([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.headerContainer}>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  onPress={() => setActiveTab("user")}
                  style={[
                    styles.tabButton,
                    activeTab === "user" && styles.activeTab,
                  ]}
                >
                  <Text style={styles.tabText}>Users</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item: any) => item.id.toString()}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={false}
              renderItem={({ item }: { item: any }) => {
                const displayName =
                  activeTab === "groups"
                    ? item?.name || "NA"
                    : activeTab === "leaders"
                      ? getLeaderDisplayName(item)
                      : (() => {
                          const firstName = item?.first_name || "";
                          const lastName = item?.last_name || "";
                          const fullName = [firstName, lastName]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            fullName || item?.username || item?.email || "Unknown"
                          );
                        })();
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      selectedUserIds.includes(item.id) &&
                        styles.selectedOptionItem,
                    ]}
                    onPress={() => toggleSelection(item.id)}
                  >
                    <Text style={styles.optionText}>{displayName}</Text>
                    {selectedUserIds.includes(item.id) && (
                      <MaterialIcons name="check" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No items found</Text>
                </View>
              }
            />

            <View style={styles.footerContainer}>
              <TouchableOpacity onPress={assignUser} style={styles.assignButton}>
                <Text style={styles.footerButtonText}>
                  {triggeredByShare ? "Share Form" : "Assign Stage"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowAssignModal(false);
                  setTriggeredByShare(false);
                  setSelectedUsers([]);
                  setSelectedGroups([]);
                }}
                style={styles.closeButton}
              >
                <Text style={styles.footerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={showUserDropdown}
        onRequestClose={() => {
          setShowUserDropdown(false);
          setTaskUserSearchQuery("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.headerContainer}>
              <View style={styles.tabContainer}>
                <View style={[styles.tabButton, styles.activeTab]}>
                  <Text style={styles.tabText}>Users</Text>
                </View>
              </View>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={taskUserSearchQuery}
                  onChangeText={setTaskUserSearchQuery}
                />
                <TouchableOpacity
                  style={styles.searchClearButton}
                  onPress={() => setTaskUserSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={filteredTaskUsers}
              keyExtractor={(item: any) => item.id.toString()}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={false}
              renderItem={({ item }: { item: any }) => {
                const isSelected = assignUsers.includes(item.id);
                const displayName =
                  `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
                  item.username ||
                  item.email ||
                  "Unknown";
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && styles.selectedOptionItem,
                    ]}
                    onPress={() => toggleAssignUser(item.id)}
                  >
                    <Text style={styles.optionText}>
                      {displayName} - {item.email || "Email Not Available"}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No users found</Text>
                </View>
              }
            />

            <View style={styles.footerContainer}>
              <TouchableOpacity
                onPress={() => {
                  setShowUserDropdown(false);
                  setTaskUserSearchQuery("");
                }}
                style={styles.assignButton}
              >
                <Text style={styles.footerButtonText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowUserDropdown(false);
                  setTaskUserSearchQuery("");
                }}
                style={styles.closeButton}
              >
                <Text style={styles.footerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={showGroupDropdown}
        onRequestClose={() => {
          setShowGroupDropdown(false);
          setTaskGroupSearchQuery("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.headerContainer}>
              <View style={styles.tabContainer}>
                <View style={[styles.tabButton, styles.activeTab]}>
                  <Text style={styles.tabText}>Groups</Text>
                </View>
              </View>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={taskGroupSearchQuery}
                  onChangeText={setTaskGroupSearchQuery}
                />
                <TouchableOpacity
                  style={styles.searchClearButton}
                  onPress={() => setTaskGroupSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={filteredTaskGroups}
              keyExtractor={(item: any) => item.id.toString()}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={false}
              renderItem={({ item }: { item: any }) => {
                const isSelected = assignGroups.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && styles.selectedOptionItem,
                    ]}
                    onPress={() => toggleAssignGroup(item.id)}
                  >
                    <Text style={styles.optionText}>{item.name || "NA"}</Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No groups found</Text>
                </View>
              }
            />

            <View style={styles.footerContainer}>
              <TouchableOpacity
                onPress={() => {
                  setShowGroupDropdown(false);
                  setTaskGroupSearchQuery("");
                }}
                style={styles.assignButton}
              >
                <Text style={styles.footerButtonText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowGroupDropdown(false);
                  setTaskGroupSearchQuery("");
                }}
                style={styles.closeButton}
              >
                <Text style={styles.footerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={showLocationLeaderDropdown}
        onRequestClose={() => {
          setShowLocationLeaderDropdown(false);
          setTaskLocationLeaderSearchQuery("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.headerContainer}>
              <View style={styles.tabContainer}>
                <View style={[styles.tabButton, styles.activeTab]}>
                  <Text style={styles.tabText}>Location Leaders</Text>
                </View>
              </View>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={taskLocationLeaderSearchQuery}
                  onChangeText={setTaskLocationLeaderSearchQuery}
                />
                <TouchableOpacity
                  style={styles.searchClearButton}
                  onPress={() => setTaskLocationLeaderSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={filteredTaskLocationLeaders}
              keyExtractor={(item: any) => item.id.toString()}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={false}
              renderItem={({ item }: { item: any }) => {
                const isSelected = assignLocationLeaders.includes(item.id);
                const displayName =
                  `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
                  item.username ||
                  item.email ||
                  "Unknown";
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && styles.selectedOptionItem,
                    ]}
                    onPress={() => toggleAssignLocationLeader(item.id)}
                  >
                    <Text style={styles.optionText}>{displayName}</Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No location leaders found
                  </Text>
                </View>
              }
            />

            <View style={styles.footerContainer}>
              <TouchableOpacity
                onPress={() => {
                  setShowLocationLeaderDropdown(false);
                  setTaskLocationLeaderSearchQuery("");
                }}
                style={styles.assignButton}
              >
                <Text style={styles.footerButtonText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowLocationLeaderDropdown(false);
                  setTaskLocationLeaderSearchQuery("");
                }}
                style={styles.closeButton}
              >
                <Text style={styles.footerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showPreviewStickyActions && (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyFooterRow}>
            <TouchableOpacity
              style={[styles.button, styles.stickyFooterButton]}
              onPress={() => setIsPreview(false)}
            >
              <MaterialIcons
                name="edit"
                size={18}
                color="white"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
            {hasFollowUpTasks && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: "#FF9500" },
                    styles.stickyFooterButton,
                  ]}
                  onPress={handleAssignTaskPress}
                >
                <MaterialIcons
                  name="assignment"
                  size={18}
                  color="white"
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={styles.buttonText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Assign Task
                </Text>
              </TouchableOpacity>
            )}
            {isOnline ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.draftStyleButton,
                  styles.stickyFooterButton,
                ]}
                onPress={() => setShowDraftConfirmation(true)}
              >
                <MaterialIcons
                  name="save"
                  size={18}
                  color="white"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.buttonText}>Draft</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.stickyFooterSpacer} />
            )}
            <TouchableOpacity
              style={[
                styles.button,
                styles.nextButton,
                submitting && styles.disabledButton,
                styles.stickyFooterButton,
              ]}
              onPress={handleFormSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.buttonText}>Submitting...</Text>
                </>
              ) : (
                <Text style={styles.buttonText}>
                  {!submissionId && !submissionsDetail
                    ? "Submit"
                    : isEditMode
                      ? "Update"
                      : "Submit"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showNonPreviewStickyActions && (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyFooterRow}>
            {isOnline ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.draftStyleButton,
                  styles.stickyFooterButton,
                ]}
                onPress={() => setShowDraftConfirmation(true)}
              >
                <MaterialIcons
                  name="save"
                  size={18}
                  color="white"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.buttonText}>Draft</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.stickyFooterSpacer} />
            )}
            <TouchableOpacity
              style={[
                styles.button,
                styles.nextButton,
                styles.stickyFooterButton,
              ]}
              onPress={handlePreview}
            >
              <MaterialIcons
                name="visibility"
                size={18}
                color="white"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.buttonText}>Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Preview Overlay */}
      {showPreviewOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Preparing preview...</Text>
          </View>
        </View>
      )}

      {/* Assign Task Overlay */}
      {showAssigningOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Assigning task...</Text>
          </View>
        </View>
      )}

      {/* Submitting Overlay */}
      {showSubmittingOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Submitting...</Text>
          </View>
        </View>
      )}

      {/* Draft Confirmation Modal */}
      {showDraftConfirmation && !showSuccessModal && (
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

      {/* Task Dialog Modal */}
      {showTaskDialog && (
        <View style={styles.modalOverlay}>
          <View style={styles.taskModal}>
            <View style={styles.taskModalHeader}>
              <Text style={styles.taskModalTitle}>
                {isEditingWebTask
                  ? "Edit Follow-Up Task"
                  : "Create Follow-Up Task"}
              </Text>
              <TouchableOpacity
                onPress={handleCloseTaskDialog}
                style={styles.taskModalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.taskModalContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={
                !showFormDropdown && !showUserDropdown && !showGroupDropdown
              }
            >
              {/* Title */}
              <View style={styles.taskField}>
                <Text style={styles.taskFieldLabel}>Title *</Text>
                <TextInput
                  style={styles.taskTextInput}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="Enter task title"
                />
              </View>

              {/* Description */}
              <View style={styles.taskField}>
                <Text style={styles.taskFieldLabel}>Description</Text>
                <TextInput
                  style={[styles.taskTextInput, styles.taskTextArea]}
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  placeholder="Enter task description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Web-assigned users display for Scenario 1 (editing web tasks) */}
              {isEditingWebTask && currentEditingTask && (
                <View style={styles.taskField}>
                  <Text style={styles.taskFieldLabel}>
                    Web Assigned Users/Groups
                  </Text>
                  <View style={styles.webAssignedUsersContainer}>
                    <Text style={styles.webAssignedUsersText}>
                      {assignUserNames.length > 0
                        ? assignUserNames.join(", ")
                        : "None"}
                    </Text>
                    {assignGroupNames.length > 0 && (
                      <Text style={styles.webAssignedUsersText}>
                        Groups: {assignGroupNames.join(", ")}
                      </Text>
                    )}
                    {assignLocationLeaderNames.length > 0 && (
                      <Text style={styles.webAssignedUsersText}>
                        Location Leaders: {assignLocationLeaderNames.join(", ")}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Deadline */}
              <View style={styles.taskField}>
                <Text style={styles.taskFieldLabel}>Deadline *</Text>
                <View style={styles.deadlineInput}>
                  <TextInput
                    style={styles.deadlineNumberInput}
                    value={taskDeadline.toString()}
                    onChangeText={(text) => setTaskDeadline(Number(text) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.deadlineText}>
                    day(s) after form submission at 11:59 PM
                  </Text>
                </View>
              </View>

              {/* Assign Users */}
              <View style={styles.taskField}>
                <Text style={styles.taskFieldLabel}>Users</Text>
                <TouchableOpacity
                  style={styles.taskDropdownButton}
                  onPress={() => setShowUserDropdown(true)}
                >
                  <Text style={styles.taskDropdownText}>
                    {assignUserNames.length > 0
                      ? assignUserNames.join(", ")
                      : "Select Users"}
                  </Text>
                  <MaterialIcons
                    name={showUserDropdown ? "expand-less" : "expand-more"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              {/* Assign Groups */}
              <View style={styles.taskField}>
                <Text style={styles.taskFieldLabel}>Groups</Text>
                <TouchableOpacity
                  style={styles.taskDropdownButton}
                  onPress={() => setShowGroupDropdown(true)}
                >
                  <Text style={styles.taskDropdownText}>
                    {assignGroupNames.length > 0
                      ? assignGroupNames.join(", ")
                      : "Select Groups"}
                  </Text>
                  <MaterialIcons
                    name={showGroupDropdown ? "expand-less" : "expand-more"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              {/* Assign Location Leaders */}
              <View style={styles.taskField}>
                <Text style={styles.taskFieldLabel}>Location Leaders</Text>
                <TouchableOpacity
                  style={styles.taskDropdownButton}
                  onPress={() => setShowLocationLeaderDropdown(true)}
                >
                  <Text style={styles.taskDropdownText}>
                    {assignLocationLeaderNames.length > 0
                      ? assignLocationLeaderNames.join(", ")
                      : "Select Location Leaders"}
                  </Text>
                  <MaterialIcons
                    name={
                      showLocationLeaderDropdown ? "expand-less" : "expand-more"
                    }
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.taskModalFooter}>
              <TouchableOpacity
                style={[styles.taskModalButton, styles.taskCancelButton]}
                onPress={() => setShowTaskDialog(false)}
              >
                <Text style={styles.taskCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.taskModalButton, styles.taskCreateButton]}
                onPress={handleSaveTask}
              >
                <Text style={styles.taskCreateButtonText}>Save Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
    </PreviousSubmissionsContext.Provider>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  stickyValidationBannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  formContainer: {
    paddingBottom: 50,
    flexGrow: 1,
  },
  formContainerWithBanner: {
    paddingTop: 70,
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F2F2F7",
    paddingBottom: 0,
    paddingTop: 4,
    zIndex: 200,
  },
  stickyFooterRow: {
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyFooterButton: {
    flex: 1,
    marginHorizontal: 3,
    minHeight: 40,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  stickyFooterSpacer: {
    flex: 1,
    marginHorizontal: 3,
    minHeight: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  stageIndicator: {
    marginTop: 1,
    marginBottom: 6,
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  topMenuButton: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 10,
    padding: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 12,
    flexWrap: "wrap",
  },
  tripleButtonContainer: {
    flexDirection: "column",
    marginHorizontal: 16,
    marginVertical: 16,
    alignItems: "stretch",
    alignSelf: "stretch",
    paddingHorizontal: 16,
  },
  stackedButton: {
    marginVertical: 8,
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    flex: 0,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 3,
    minHeight: 40,
    minWidth: 0,
    maxWidth: "100%",
  },
  nextButton: {
    backgroundColor: "#34C759",
  },
  disabledButton: {
    backgroundColor: "#C7C7CC",
  },
  draftStyleButton: {
    backgroundColor: "#FFA500",
  },
  completedInfo: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stageHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 8,
  },
  completedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  completedInfoIcon: {
    marginRight: 8,
  },
  completedText: {
    fontSize: 13,
    color: "#374151",
    flex: 1,
  },
  infoSeparator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  followUpTaskContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  followUpTaskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  followUpTaskHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  followUpTaskToggleButton: {
    padding: 4,
  },
  followUpTaskTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    marginLeft: 6,
    flexShrink: 1,
  },
  followUpTaskContent: {
    flex: 1,
  },
  followUpTaskLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 3,
  },
  followUpTaskValue: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
  },
  addTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  addTaskButtonText: {
    fontSize: 13,
    color: "#fff",
    marginLeft: 4,
    fontWeight: "600",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999999,
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    height: "70%",
  },
  headerContainer: {
    backgroundColor: "#fff",
    zIndex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  activeTab: {
    borderColor: "#007AFF",
  },
  tabText: {
    fontSize: 16,
    color: "#374151",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
    marginHorizontal: 10,
    fontSize: 14,
    paddingRight: 36,
  },
  searchInputContainer: {
    position: "relative",
  },
  searchClearButton: {
    position: "absolute",
    right: 18,
    top: 18,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  optionItem: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedOptionItem: {
    backgroundColor: "#F0F7FF",
  },
  optionText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: "#eee",
    marginHorizontal: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  emptyText: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  assignButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  closeButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  footerButtonText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  stageMenuModal: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    maxHeight: "50%",
  },
  stageMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  stageMenuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  stageMenuCloseButton: {
    padding: 5,
  },
  stageMenuContent: {
    flex: 1,
  },
  stageMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
  },
  stageMenuOptionDisabled: {
    backgroundColor: "#F3F4F6",
  },
  stageMenuIcon: {
    marginRight: 12,
  },
  stageMenuOptionText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  stageMenuOptionTextDisabled: {
    color: "#9CA3AF",
  },
  submittingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  submittingModal: {
    width: 220,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  submittingText: {
    fontSize: 16,
    marginTop: 12,
    color: "#374151",
  },
  draftModal: {
    width: "85%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  draftModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  draftModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 10,
  },
  draftModalMessage: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  draftModalButtons: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  draftButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 4,
    minHeight: 44,
  },
  saveDraftButton: {
    backgroundColor: "#007AFF",
  },
  discardButton: {
    backgroundColor: "#FF3B30",
  },
  draftButtonText: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 6,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#007AFF",
  },
  questionSeparator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
    marginHorizontal: 4,
  },
  stageApprovalContainer: {
    marginTop: 10,
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  stageApprovalContainerError: {
    backgroundColor: "#FEE2E2",
  },
  stageApprovalTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  stageApprovalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  stageApprovalRemarksInput: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#374151",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  stageApprovalButtons: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  stageApprovalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginRight: 20,
  },
  stageApprovalIcon: {
    marginRight: 8,
  },
  stageApprovalOptionText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  stageApprovalHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  taskModal: {
    width: "95%",
    maxWidth: 500,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 0,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  taskModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  taskModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  taskModalCloseButton: {
    padding: 5,
  },
  taskModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  taskField: {
    marginBottom: 20,
  },
  taskFieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  taskTextInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#374151",
    backgroundColor: "#fff",
  },
  taskTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  deadlineInput: {
    flexDirection: "row",
    alignItems: "center",
  },
  deadlineNumberInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#374151",
    backgroundColor: "#fff",
    width: 60,
    textAlign: "center",
    marginRight: 8,
  },
  deadlineText: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  taskDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  taskDropdownText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  taskDropdownScrollContainerTop: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#fff",
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  taskDropdownFlatList: {
    maxHeight: 180,
  },
  taskDropdownSearch: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    padding: 12,
    fontSize: 16,
    color: "#374151",
  },
  taskDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  taskDropdownItemText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  taskDropdownEmpty: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    padding: 20,
  },
  taskCheckboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCheckboxChecked: {
    backgroundColor: "#007AFF",
  },
  taskModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  taskModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  taskCancelButton: {
    backgroundColor: "#6B7280",
  },
  taskCreateButton: {
    backgroundColor: "#007AFF",
  },
  taskCancelButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  taskCreateButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  webAssignedUsersContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  webAssignedUsersText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
});

export default MultiStageFormScreen;

