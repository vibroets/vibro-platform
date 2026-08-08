


/* eslint-disable import/no-named-as-default-member */
import { MaterialIcons } from "@expo/vector-icons";
import { addDays, format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  Dimensions,
  FlatList,
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";
import { ToggleContext } from "../../../app/(app)/_layout";
import KeyboardAwareContainer, {
  KeyboardAwareContainerRef,
} from "../../../components/KeyboardAwareContainer";
import { RootState } from "../../../Redux/reducer/rootReducer";
import api from "../../../services";
import { performAuditBulkAssignment } from "../../../services/auditBulkAssignmentService";
import {
  FORM,
  GETFORMSUBMISSIONDETAILS,
  GROUPS_LIST,
  LOCATION_LEADERS_LIST,
  SAVE_DRAFT,
  TRIGGER_FOLLOWUP_TASKS,
  USERS_LIST,
  PLANNER_COLLABORATIVE_POLL_ANSWERS,
  PLANNER_COLLABORATIVE_AUTO_SAVE,
} from "../../../services/constants";
import { SecureStoreService } from "../../../services/secureStore";
import { networkService } from "../../../services/networkService";
import { offlineStorageService } from "../../../services/offlineStorageService";
import {
  fetchFormMetadata,
  fetchFormStages,
  saveCachedStage,
  saveCachedMetadata,
  assembleFormFromCache,
  updateCacheTimestamp,
} from "../../../services/formCacheService";
import { textColors, typography } from "../../../styles/typography";
import AuditAccordion from "../Accordion/AuditAccordion";
import FormField, { FormContainerContext } from "../FormFields/FormField";
import { PreviousSubmissionsContext } from "../FormFields/FormFieldWrapper";
import TableField from "../FormFields/TableField";
import { usePreviousSubmissions } from "../hooks/usePreviousSubmissions";
import {
  collectVisibleLogicQuestions,
  hasAuditFollowUpTasks,
  useAuditForm,
} from "../hooks/useAuditform";
import { Form, Question, Stage, SubmissionsDetail } from "../types/formTypes";
import ValidationErrorBanner from "../ValidationErrorBanner";
import AuditSummaryScreen from "./AuditSummaryScreen";

/**
 * Helper function to check if a value is empty based on question type
 * Used for validation of both main questions and sub-questions
 */
const isValueEmpty = (value: any, questionType: string): boolean => {
  switch (questionType) {
    case "short_answer":
    case "long_answer":
      return !value || (typeof value === "string" && value.trim() === "");
    case "dropdown":
    case "division":
    case "sub_division":
    case "location":
    case "user":
      return !value || (typeof value === "object" && !value?.id);
    case "multiple_choice":
    case "checkboxes":
      return !Array.isArray(value) || value.length === 0;
    case "date":
    case "time":
    case "datetime":
      return !value;
    case "linear_scale":
      return value === undefined || value === null;
    case "upload_image":
    case "upload_video":
    case "upload_audio":
    case "upload_file":
      return (
        !value ||
        (typeof value === "string" &&
          value.split("|").filter(Boolean).length === 0)
      );
    case "audit":
    case "signature":
      return !value;
    case "qr_code":
      return !value || (typeof value === "string" && value.trim() === "");
    case "title_and_description":
      return false; // Title and description are never considered empty
    default:
      return !value;
  }
};

interface AuditFormScreenProps {
  formId: string;
  submissionId?: string;
  draftId?: string;
  sourceScreen?: string;
  taskId?: string;
  onClose?: () => void;
  auditSubmissionData?: string;
  plannerAssignmentId?: string;
  collaborativeSubmissionId?: string;
  groupDelegationId?: string;
  groupDelegationStatus?: string;
  auditGroupId?: string;
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

type AccordionLayoutSnapshot = {
  expandedHeight?: number;
  collapsedHeight?: number;
  currentHeight?: number;
  y?: number;
};

const buildUniqueId = (
  groupId: string,
  questionUuid: string,
  parentQuestionUuid?: string,
) => {
  return parentQuestionUuid
    ? `${groupId}_${parentQuestionUuid}_${questionUuid}`
    : `${groupId}_${questionUuid}`;
};

const withUniqueIdsForQuestion = (question: Question, groupId: string) => {
  const updatedQuestion: any = {
    ...question,
    uniqueId: buildUniqueId(groupId, question.question_uuid),
  };

  if (question.sub_questions?.length) {
    updatedQuestion.sub_questions = question.sub_questions.map((subQ: Question) => ({
      ...subQ,
      uniqueId: buildUniqueId(groupId, subQ.question_uuid, question.question_uuid),
    }));
  }

  if (question.logics?.length) {
    updatedQuestion.logics = question.logics.map((logic) => ({
      ...logic,
      logic_questions: logic.logic_questions?.map((lq: Question) => ({
        ...lq,
        uniqueId: buildUniqueId(groupId, lq.question_uuid, question.question_uuid),
      })),
    }));
  }

  return updatedQuestion;
};

const withUniqueIdsForStage = (stage: Stage, stageIndex: number): Stage => ({
  ...stage,
  questions: (stage.questions || []).map((q: Question) =>
    withUniqueIdsForQuestion(q, `stage-${stageIndex}`),
  ),
});

const withUniqueIdsForAuditInfo = (auditInfo?: Stage | null): Stage | undefined => {
  if (!auditInfo) return auditInfo || undefined;
  return {
    ...auditInfo,
    questions: (auditInfo.questions || []).map((q: Question) =>
      withUniqueIdsForQuestion(q, "audit-info"),
    ),
  };
};

const AuditFormScreen: React.FC<AuditFormScreenProps> = ({
  formId,
  submissionId,
  draftId,
  sourceScreen,
  taskId,
  onClose,
  auditSubmissionData,
  plannerAssignmentId: plannerAssignmentIdProp,
  collaborativeSubmissionId: collaborativeSubmissionIdProp,
  groupDelegationId: groupDelegationIdProp,
  groupDelegationStatus: groupDelegationStatusProp,
  auditGroupId: auditGroupIdProp,
}) => {
  const navigation = useNavigation<any>();
  const params = useLocalSearchParams();
  const plannerLocation = params.plannerLocation as string | undefined;
  const plannerLocationId = params.plannerLocationId as string | undefined;
  const plannerAssignmentId = (params.plannerAssignmentId as string | undefined) || plannerAssignmentIdProp;
  const collaborativeSubmissionId = (params.collaborativeSubmissionId as string | undefined) || collaborativeSubmissionIdProp;
  const groupDelegationId = (params.groupDelegationId as string | undefined) || groupDelegationIdProp;
  const groupDelegationStatus = (params.groupDelegationStatus as string | undefined) || groupDelegationStatusProp;
  const auditGroupId = (params.auditGroupId as string | undefined) || auditGroupIdProp;
  const user = useSelector((state: RootState) => state.user);

  // Force close: try onClose prop, then router navigation as fallback
  // Uses a ref to prevent multiple calls
  const hasClosedRef = useRef(false);
  const forceClose = useCallback(() => {
    if (hasClosedRef.current) return;
    hasClosedRef.current = true;
    if (onClose) {
      onClose();
    } else {
      // No onClose prop — must be a route, navigate to appropriate page
      try {
        const { router } = require("expo-router");
        if (sourceScreen === "sent" || sourceScreen === "todo") {
          router.replace("/(app)/(tabs)/todo?tab=sent");
        } else if (sourceScreen === "collaborative") {
          router.replace("/(app)/(tabs)/planner");
        } else {
          router.replace("/(app)/(tabs)/forms");
        }
      } catch (e) {
        console.log("🔍 [Screen] router navigation failed:", e);
      }
    }
  }, [onClose, sourceScreen]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditInfo, setAuditInfo] = useState<Stage | undefined>(undefined);
  const [showPreview, setShowPreview] = useState(false);
  const [passPercentage, setPassPercentage] = useState(0);
  const [formData, setFomData] = useState<Form | undefined>();
  const [submissionsDetail, setSubmissionsDetail] = useState<
    SubmissionsDetail | undefined
  >();
  const [auditsummarydata, setAuditsummarydata] = useState<any>(null);

  const [collaborativeAnsweredQuestions, setCollaborativeAnsweredQuestions] = useState<Set<string>>(new Set());
  const collaborativeAnsweredRef = useRef<Set<string>>(new Set());
  const allValuesRef = useRef<any>({});

  const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null);
  const [showSubmittingOverlay, setShowSubmittingOverlay] = useState(false);
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [showAssigningOverlay, setShowAssigningOverlay] = useState(false);
  const [showDraftConfirmation, setShowDraftConfirmation] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const allowNavigationRef = useRef(false);
  const [draft, setDraft] = useState<any>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [hasLocalDraftStructure, setHasLocalDraftStructure] = useState(false);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [originalDraftId, setOriginalDraftId] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});
  const [autoExpandAuditQuestionKey, setAutoExpandAuditQuestionKey] = useState<
    string | null
  >(null);
  const [
    autoExpandMultipleChoiceQuestionKey,
    setAutoExpandMultipleChoiceQuestionKey,
  ] = useState<string | null>(null);
  const [autoExpandDropdownQuestionKey, setAutoExpandDropdownQuestionKey] =
    useState<string | null>(null);
  const [expandedAccordionIds, setExpandedAccordionIds] = useState<string[]>(
    [],
  );
  const [expandedAuditGroups, setExpandedAuditGroups] = useState<Set<number>>(
    new Set([1]),
  );
  const [isOnline, setIsOnline] = useState(!networkService.isOffline());
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedFollowUpTasks, setCollapsedFollowUpTasks] = useState<
    Record<string, boolean>
  >({});
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isLoadingFormRef = useRef(false);
  const shouldRetryLoadOnActiveRef = useRef(false);
  const formLoadRetryCountRef = useRef(0);
  const loadedStageOrdersRef = useRef<Set<number>>(new Set());
  const backgroundLoadInProgressRef = useRef(false);
  const allStageOrdersRef = useRef<number[]>([]);
  const getFormStagesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Follow-up task modal state
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(0);
  const [assignForm, setAssignForm] = useState<number | null>(null);
  const [assignFormName, setAssignFormName] = useState<string>("");
  const [assignUsers, setAssignUsers] = useState<number[]>([]);
  const [assignGroups, setAssignGroups] = useState<number[]>([]);
  const [assignLocationLeaders, setAssignLocationLeaders] = useState<number[]>(
    [],
  );
  const [assignUserNames, setAssignUserNames] = useState<string[]>([]);
  const [assignGroupNames, setAssignGroupNames] = useState<string[]>([]);
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
  const [groups, setGroups] = useState<any[]>([]);
  const [locationLeaders, setLocationLeaders] = useState<any[]>([]);

  // Parent form ID for follow-up tasks
  const [parentFormId, setParentFormId] = useState<number | null>(null);

  // Temporary follow-up tasks state and ref
  const [temporaryFollowUpTasks, setTemporaryFollowUpTasks] = useState<any[]>(
    [],
  );
  const temporaryTasksRef = useRef<any[]>([]);

  // Edited web tasks state for backend submission
  const [editedWebTasks, setEditedWebTasks] = useState<any[]>([]);
  const editedWebTasksRef = useRef<any[]>([]);

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

  // Track current followup task being edited (for Scenario 1 - web-created tasks)
  const [currentEditingTask, setCurrentEditingTask] = useState<any>(null);
  const [isEditingWebTask, setIsEditingWebTask] = useState(false);
  const [allowEditing, setAllowEditing] = useState(false);
  const [isEditButtonClicked, setIsEditButtonClicked] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareActiveTab, setShareActiveTab] = useState<"user" | "groups" | "leaders">("user");
  const [shareSelectedIds, setShareSelectedIds] = useState<number[]>([]);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [isSharing, setIsSharing] = useState(false);



  // Refs to prevent duplicate submission/trigger flows
  const triggerCalledRef = useRef<boolean>(false);
  const processedSubmissionIdsRef = useRef<Set<number>>(new Set());
  const shouldTriggerFollowupsRef = useRef<boolean>(false);
  const submitInFlightRef = useRef(false);

  // Refs to capture current values (avoid stale closures)
  const stagesRef = useRef<Stage[]>([]);
  const auditInfoRef = useRef<Stage | undefined>(undefined);
  const visibleQuestionsRef = useRef<Set<string>>(new Set());
  const hasPopulatedViewData = useRef(false);

  // Update refs when values change
  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  useEffect(() => {
    auditInfoRef.current = auditInfo;
  }, [auditInfo]);

  // Keep temporaryTasksRef in sync - critical for production APK to avoid stale closure
  useEffect(() => {
    temporaryTasksRef.current = temporaryFollowUpTasks;
  }, [temporaryFollowUpTasks]);

  // Helpers for fallback IDs (use refs to avoid ordering issues)
  const getQuestionIdByUuid = useCallback((questionUuid: string | null) => {
    if (!questionUuid) return null;
    const allQuestions = [
      ...(auditInfoRef.current?.questions || []),
      ...(stagesRef.current || []).flatMap((g: any) => g?.questions || []),
    ];
    for (const q of allQuestions) {
      if (q?.question_uuid === questionUuid && q?.id != null) {
        return Number(q.id);
      }
    }
    return null;
  }, []);

  const getFollowupLogicIdByQuestion = useCallback((questionUuid: string | null) => {
    if (!questionUuid) return null;
    const allQuestions = [
      ...(auditInfoRef.current?.questions || []),
      ...(stagesRef.current || []).flatMap((g: any) => g?.questions || []),
    ];
    for (const q of allQuestions) {
      if (q?.question_uuid !== questionUuid) continue;
      // Prefer Scenario 2 toggle logic
      const toggleLogic = q?.logics?.find((l: any) => l?.followup_toggle);
      if (toggleLogic?.id != null) return Number(toggleLogic.id);
      // Fallback to any logic that has follow_up defined (Scenario 1)
      const followupLogic = q?.logics?.find((l: any) => l?.follow_up);
      if (followupLogic?.id != null) return Number(followupLogic.id);
    }
    return null;
  }, []);

  // Parse auditSubmissionData for sent forms
  useEffect(() => {
    if (sourceScreen === "sent" && auditSubmissionData) {
      try {
        const parsed = JSON.parse(auditSubmissionData);
        setAuditsummarydata(parsed);
      } catch (error) {
      }
    }
  }, [sourceScreen, auditSubmissionData]);

  // Debug the setFormSubmissionId function - this replaces the direct setFormSubmissionId call
  const debugSetFormSubmissionId = useCallback(
    async (id: number | undefined) => {
      setFormSubmissionId(id); // Update the state

      // Trigger followup task processing when submission ID is set
      if (id && !triggerCalledRef.current) {
        if (processedSubmissionIdsRef.current.has(id)) {
          return;
        }

        // Never trigger for SENT view, unless user is editing and resubmitting
        if (sourceScreen === "sent" && !isEditButtonClicked) {
          return;
        }
        if (submissionId && !shouldTriggerFollowupsRef.current) {
          return;
        }
        triggerCalledRef.current = true; // Prevent multiple calls
        processedSubmissionIdsRef.current.add(id);

        // Use ref for mobile tasks - ensures correct value in production APK (avoids stale closure)
        const mobileTasks = temporaryTasksRef.current ?? [];
        const currentEditedWebTasks = editedWebTasksRef.current || [];

        // Call TRIGGER_FOLLOWUP_TASKS with both web-defined and mobile tasks
        const callTriggerEndpoint = async () => {
          try {
            const hasEditedWebTasks = currentEditedWebTasks.length > 0;
            const hasMobileTasks = mobileTasks.length > 0;

            // Check if there are any web-defined follow-up tasks with meaningful content.
            let hasValidWebFollowUpTasks = false;
            const currentStagesForValidation = stagesRef.current || [];
            currentStagesForValidation.forEach((stage: Stage) => {
              stage.questions?.forEach((question: any) => {
                question.logics?.forEach((logic: any) => {
                  if (!logic?.follow_up) return;
                  const followUp = logic.follow_up;
                  const title = followUp.title || followUp.task_name;
                  const description = followUp.description;
                  const formTitle = followUp.assigned_form_title;
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
                    (typeof formTitle === "string" && formTitle.trim() !== "");

                  if (
                    hasTaskContent &&
                    (hasAssignedForm || hasAssignees || hasTaskCloseQuestions)
                  ) {
                    hasValidWebFollowUpTasks = true;
                  }
                });
              });
            });

            if (
              !hasValidWebFollowUpTasks &&
              !hasEditedWebTasks &&
              !hasMobileTasks
            ) {
              shouldTriggerFollowupsRef.current = false;
              return;
            }

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
              const currentStages = stagesRef.current || [];
              const currentVisible = visibleQuestionsRef.current;

              currentStages.forEach((stage: Stage) => {
                stage.questions?.forEach((question: any) => {
                  question.logics?.forEach((logic: any) => {
                    if (!logic?.follow_up) return;
                    if (!currentVisible.has(`followup-${logic.id}`)) return;

                    const followUp = logic.follow_up;
                    const title = followUp.title || followUp.task_name || "";
                    const description = followUp.description || "";
                    const deadline = Number(followUp.deadline ?? 0) || 0;
                    const assign_user_ids = toNumberArray(
                      followUp.assign_user_ids,
                    );
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

            const payload: any = {
              form_id: Number(formId),
              main_form_submission_id: id,
              followup_task_form_id: Number(formId),
            };

            if (false && currentEditedWebTasks.length > 0) {
              const editTask = currentEditedWebTasks[0]; // Only one editing task per question

              payload.isEditingWebTask = true;
              payload.logicId = editTask.logicId;
              payload.title = editTask.title;
              payload.description = editTask.description;
              payload.deadline = editTask.deadline;
              payload.assign_user_ids = editTask.assign_user_ids;
              payload.assign_group_ids = editTask.assign_group_ids;
              payload.assign_leader_ids = editTask.assign_leader_ids;
            } else {
            }

            // Check if we have any mobile editing tasks (legacy)
            const mobileEditingTasks = mobileTasks.filter(
              (task) => task.isEditingWebTask,
            );
            const mobileCreatingTasks = mobileTasks.filter(
              (task) => !task.isEditingWebTask,
            );

            // Handle mobile editing tasks (send directly, not in mobile_created_tasks array)
            if (
              false && mobileEditingTasks.length > 0 &&
              currentEditedWebTasks.length === 0
            ) {
              const editTask = mobileEditingTasks[0]; // Only one editing task per question
              payload.isEditingWebTask = true;
              payload.logicId = editTask.logicId;
              payload.title = editTask.title;
              payload.description = editTask.description;
              payload.assign_user_ids = editTask.assign_user_ids;
              payload.assign_group_ids = editTask.assign_group_ids;
              payload.assign_leader_ids = editTask.assign_leader_ids;

            }

            // Handle mobile creating tasks (existing logic)
            if (mobileCreatingTasks.length > 0) {
                const normalizedMobileTasks = mobileCreatingTasks.map((t: any) => ({
                  created_from: "mobile",
                  title: t.title ?? "",
                  description: t.description ?? "",
                  deadline: t.deadline ?? 0,
                  assign_user_ids: Array.isArray(t.assign_user_ids) ? t.assign_user_ids : [],
                  assign_group_ids: Array.isArray(t.assign_group_ids) ? t.assign_group_ids : [],
                  assign_leader_ids: Array.isArray(t.assign_leader_ids) ? t.assign_leader_ids : [],
                  follow_task_sub_question_id: t.follow_task_sub_question_id,
                  logic_followup_id: t.logic_followup_id,
                }));
              payload.mobile_created_tasks = normalizedMobileTasks;
              normalizedMobileTasks.forEach((t: any, i: number) => {
              });
            } else if (
              currentEditedWebTasks.length === 0 &&
              mobileEditingTasks.length === 0
            ) {
            }

            // Do not convert web-defined follow-up tasks into mobile_created_tasks.
            // Backend already handles web follow-up logic from the submission itself.
            // Sending derived web tasks here can create duplicate follow-up tasks.

            const editTasksToProcess = currentEditedWebTasks.length > 0
              ? currentEditedWebTasks
              : mobileEditingTasks;

            // If edited web tasks are present, avoid generic trigger first
            // (generic + edit calls can create duplicates for same logic).
            const shouldRunGenericTrigger =
              mobileCreatingTasks.length > 0 || editTasksToProcess.length === 0;

            let triggerResponse: any = null;
            if (shouldRunGenericTrigger) {
              triggerResponse = await api.post(
                TRIGGER_FOLLOWUP_TASKS,
                payload,
              );

              if (triggerResponse.data && triggerResponse.data.tasks) {
              }

              if (
                triggerResponse.data &&
                triggerResponse.data.mobile_tasks_created
              ) {
                Toast.show({
                  type: "success",
                  text1: "Tasks Created",
                  text2: `${triggerResponse.data.mobile_tasks_created.length} task(s) created successfully`,
                  position: "top",
                });
              }
            }

            if (editTasksToProcess.length > 0) {
              for (const editTask of editTasksToProcess) {
                const editPayload: any = {
                  form_id: Number(formId),
                  main_form_submission_id: id,
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

                const editResponse = await api.post(TRIGGER_FOLLOWUP_TASKS, editPayload);
                if (!triggerResponse) {
                  triggerResponse = editResponse;
                }
              }
            }

            // Clear mobile tasks and edited web tasks after successful processing
            setTemporaryFollowUpTasks([]);
            temporaryTasksRef.current = [];
            setEditedWebTasks([]);

            try {
              // Use current values from refs (avoid stale closures)
              const currentStages = stagesRef.current;
              const currentAuditInfo = auditInfoRef.current;
              await performAuditBulkAssignment(
                String(formId),
                {
                  auditGroups: currentStages,
                  auditInfo: currentAuditInfo,
                  formType: "audit",
                },
                triggerResponse,
                String(id),
              );
            } catch (bulkAssignError: any) {
              // Don't fail the entire submission if audit bulk assignment fails
            }
            shouldTriggerFollowupsRef.current = false;
          } catch (triggerError: any) {
            const backendError =
              triggerError?.response?.data?.error || triggerError?.message || "";
            if (
              triggerError?.response?.status === 400 &&
              triggerError?.response?.data?.missing_logic_followup_ids
            ) {
              Alert.alert(
                "Follow-up Required",
                triggerError?.response?.data?.error ||
                  "Please create followup tasks for required questions before submitting.",
              );
              shouldTriggerFollowupsRef.current = false;
              return;
            }
            const missingTable =
              typeof backendError === "string" &&
              backendError.includes("form_taskclosequestion");

            if (missingTable) {
            } else {

              Toast.show({
                type: "error",
                text1: "Task Creation Failed",
                text2: "Failed to create followup tasks",
                position: "top",
              });
            }

            // Clear tasks even on error to prevent retry loops
            setTemporaryFollowUpTasks([]);
            temporaryTasksRef.current = [];
            shouldTriggerFollowupsRef.current = false;
          }
        };

        // Await trigger so navigation waits - critical for production APK
        await callTriggerEndpoint();
      }
    },
    [formId, submissionId, sourceScreen, isEditButtonClicked],
  ); // Use ref for temporaryFollowUpTasks - no need in deps

  // View mode and notification checks
  const isViewMode = (submissionsDetail?.is_completed || sourceScreen === "sent") && !isEditButtonClicked;
  const isFromNotification = sourceScreen === "notification";

  // Calculate modal content max height based on dropdown visibility
  const taskModalContentMaxHeight =
    showGroupDropdown ||
    showUserDropdown ||
    showLocationLeaderDropdown ||
    showFormDropdown
      ? 600
      : 400;

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
        const mainFormIdValue = Number(parentFormId || formId);

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
    [parentFormId, formId],
  );

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

    if (isEditingWebTask && currentEditingTask) {

      // Update the follow-up task logic in the question
      setStages((prevStages) => {
        const newStages = prevStages.map((stage) => ({
          ...stage,
          questions: stage.questions.map((q) => {
            if (q.question_uuid === currentTaskQuestionUuid && q.logics) {
              // Update the follow_up object in the logic that contains the task
              const updatedLogics = q.logics.map((logic) => {
                if (logic.follow_up) {

                  return {
                    ...logic,
                    follow_up: {
                      ...logic.follow_up,
                      title: taskTitle,
                      description: taskDescription,
                      deadline: taskDeadline,
                      assign_user_ids: assignUsers,
                      assign_group_ids: assignGroups,
                      assign_leader_ids: assignLocationLeaders,
                    },
                  };
                }
                return logic;
              });

              return {
                ...q,
                logics: updatedLogics,
              };
            }
            return q;
          }),
        }));

        return newStages;
      });

      // Store edited web task data for backend submission when form is submitted
      // Use a separate mechanism to avoid UI duplication
      const editedWebTaskData = {
        parentQuestionUuid: currentTaskQuestionUuid,
        logicId: currentEditingTask.id,
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

    } else {
      // Scenario 2: Create new mobile task (no assigned form required)
      const temporaryTask: Record<string, any> = {
        parentQuestionUuid: currentTaskQuestionUuid,
        title: taskTitle,
        description: taskDescription,
        deadline: taskDeadline,
        created_from: "mobile",
        assign_form_id: assignForm ?? undefined, // Optional for Scenario 2
        assign_form: assignForm ?? undefined, // Backend compatibility (optional)
        assign_form_name: assignFormName || "", // Empty if not selected
        assign_user_ids: assignUsers, // Backend expects assign_user_ids
        assign_group_ids: assignGroups, // Backend expects assign_group_ids
        assign_leader_ids: assignLocationLeaders, // Backend expects assign_leader_ids
        assign_user_names: assignUserNames,
        assign_group_names: assignGroupNames,
        assign_location_leader_names: assignLocationLeaderNames,
        created_at: new Date().toISOString(),
      };
      // Fix: Send logic_followup_id and follow_task_sub_question_id per task so backend
      // links correct parent question and task close questions (avoids same parent for all)
      // Use REFS (not state) so we use values from when modal opened (avoids stale state)
      let lfId = currentTaskLogicFollowUpIdRef.current;
      let qId = currentTaskParentQuestionIdRef.current;

      if (qId == null && currentTaskQuestionUuid) {
        const fallbackQId = getQuestionIdByUuid(String(currentTaskQuestionUuid));
        if (fallbackQId != null) qId = fallbackQId;
      }

      if (lfId == null && currentTaskQuestionUuid) {
        const fallbackLfId = getFollowupLogicIdByQuestion(
          String(currentTaskQuestionUuid),
        );
        if (fallbackLfId != null) lfId = fallbackLfId;
      }

      if (lfId == null || qId == null) {
        Toast.show({
          type: "error",
          text1: "Task Error",
          text2: "Unable to create follow-up task. Please reopen and try again.",
          position: "top",
        });
        return;
      }

      temporaryTask.logic_followup_id = lfId;
      temporaryTask.follow_task_sub_question_id = qId;
      if (!assignForm) {
        delete temporaryTask.assign_form_id;
        delete temporaryTask.assign_form;
      }
      if (lfId == null || qId == null) {
      }


      // Add to temporary tasks state and ref
      setTemporaryFollowUpTasks((prev) => [...prev, temporaryTask]);
      temporaryTasksRef.current = [...temporaryTasksRef.current, temporaryTask];
    }

    if (isEditingWebTask) {
      // Update the current editing task with new data
      setCurrentEditingTask({
        ...currentEditingTask,
        title: taskTitle,
        description: taskDescription,
        deadline: taskDeadline,
        assign_user_ids: assignUsers,
        assign_group_ids: assignGroups,
        assign_leader_ids: assignLocationLeaders,
      });

      // Show success message
      Toast.show({
        type: "success",
        text1: "Task Updated",
        text2: "Changes saved and will be applied when form is submitted.",
        position: "top",
      });
    }

    // For creating new tasks, reset and close modal as before
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
    setTaskLocationLeaderSearchQuery("");
    setTaskFormSearchQuery("");
    setShowUserDropdown(false);
    setShowGroupDropdown(false);
    setShowLocationLeaderDropdown(false);
    setShowFormDropdown(false);

    // Reset editing state
    setCurrentEditingTask(null);
    setIsEditingWebTask(false);
    setCurrentTaskLogicFollowUpId(null);
    setCurrentTaskParentQuestionId(null);
    currentTaskLogicFollowUpIdRef.current = null;
    currentTaskParentQuestionIdRef.current = null;

    setShowTaskDialog(false);
  }, [
    taskTitle,
    taskDescription,
    taskDeadline,
    assignUsers,
    assignGroups,
    assignLocationLeaders,
    assignUserNames,
    assignGroupNames,
    assignLocationLeaderNames,
    isEditingWebTask,
    currentEditingTask,
    assignForm,
    assignFormName,
    currentTaskQuestionUuid,
    currentTaskLogicFollowUpId,
    currentTaskParentQuestionId,
    getQuestionIdByUuid,
    getFollowupLogicIdByQuestion,
  ]);

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

        // Update group names using real group data
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

        // Update location leader names using real location leader data
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

  const filteredTaskForms = useMemo(() => {
    return availableForms.filter(
      (form) =>
        form.name?.toLowerCase().includes(taskFormSearchQuery.toLowerCase()) ||
        form.title?.toLowerCase().includes(taskFormSearchQuery.toLowerCase()),
    );
  }, [availableForms, taskFormSearchQuery]);

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

  const filteredTaskLocationLeaders = useMemo(() => {
    return locationLeaders.filter(
      (leader) =>
        `${leader.first_name || ""} ${leader.last_name || ""}`
          .toLowerCase()
          .includes(taskLocationLeaderSearchQuery.toLowerCase()) ||
        leader.username
          ?.toLowerCase()
          .includes(taskLocationLeaderSearchQuery.toLowerCase()) ||
        leader.email
          ?.toLowerCase()
          .includes(taskLocationLeaderSearchQuery.toLowerCase()),
    );
  }, [locationLeaders, taskLocationLeaderSearchQuery]);

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

  const fieldRefs = useRef<{ [key: string]: React.RefObject<View | null> }>({});
  const keyboardContainerRef = useRef<KeyboardAwareContainerRef>(null);
  const accordionLayoutsRef = useRef<Record<string, AccordionLayoutSnapshot>>(
    {},
  );

  useEffect(() => {
    if (!showPreview) return;
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        keyboardContainerRef.current?.scrollToOffset(999999);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [showPreview]);

  const handleInputFocus = useCallback(
    (inputKey: string) => {
      setFocusedInputKey(inputKey);
      // Note: Banner now only hides when ALL errors are cleared (handled in useEffect)
      // This provides consistent UX - banner stays visible until form is fully valid

      // Clear validation error highlight for this specific field
      if (validationErrors[inputKey]) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[inputKey];
          return newErrors;
        });
      }
      // Note: Scrolling is handled by InputWrapper in KeyboardAwareContainer, not here
    },
    [validationErrors],
  );

  // ===== API: get form stages & details =====
  const getFormStages = useCallback(async () => {
    isLoadingFormRef.current = true;
    try {
      setLoading(true);
      setError(null);

      // === Progressive Loading: Try cache first ===
      // Skip cache in collaborative mode — we need fresh data with teammate answers
      if (sourceScreen !== "collaborative") {
        const cachedForm = await assembleFormFromCache(formId, [], submissionId);
        if (cachedForm) {
          const cachedGroups = cachedForm.auditGroups as Stage[];
          if (cachedGroups && cachedGroups.length > 0) {
            let allCachedGroups = cachedGroups.map((stage: Stage, index: number) => withUniqueIdsForStage(stage, index));
            allCachedGroups.sort((a: Stage, b: Stage) => (a.order || 0) - (b.order || 0));
            setStages(allCachedGroups);
            setLoading(false);
            loadedStageOrdersRef.current = new Set(cachedGroups.map((s: any) => s.order));

            // Background refresh from API
            backgroundLoadRemainingStages(formId, submissionId);
            return;
          }
        }
      }

      // In collaborative mode, skip metadata (we know which group we need) and fetch only the assigned group
      const isCollab = sourceScreen === "collaborative" && auditGroupId;
      
      if (!isCollab) {
        const metadata = await fetchFormMetadata(formId);
        if (metadata) {
          allStageOrdersRef.current = (metadata.audit_groups || []).map((g: any) => g.order);
          await saveCachedMetadata(formId, metadata, submissionId);
        } else {
          console.warn("[AudiForm] fetchFormMetadata returned null for formId:", formId);
        }
      }

      // Single full load from fast endpoint — pass group_id for collaborative mode to filter server-side
      const partialData = await fetchFormStages(formId, [], submissionId, isCollab ? auditGroupId : undefined);
      if (partialData && partialData.audit_group && partialData.audit_group.length > 0) {
          const data = partialData;
          let allStages = (data.audit_group || []).map((stage: Stage, index: number) => withUniqueIdsForStage(stage, index));
          allStages.sort((a: Stage, b: Stage) => (a.order || 0) - (b.order || 0));
          setStages(allStages);
          setAuditInfo(withUniqueIdsForAuditInfo(data.audit_info || null));
          setPassPercentage(data?.pass_percentage || 0);
          setFomData(data);
          setSubmissionsDetail(data?.submissionsDetail);
          setAllowEditing(data?.submissionsDetail?.allow_editing || data?.allow_editing || false);
          setParentFormId(Number(formId));

          // Mark all orders as loaded
          for (const order of allStageOrdersRef.current) {
            loadedStageOrdersRef.current.add(order);
          }

          setLoading(false);
          return;
      }

      // If fast endpoint fails, show error
      console.error("[AudiForm] Fast endpoint returned no data for formId:", formId);
      setError("Failed to load form. Please check your connection and try again.");
      setLoading(false);
    } catch (err: any) {
      const isPermissionError = err?.response?.status === 403 || err?.message?.includes("403");
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
        setError("Failed to load form stages");
      }
      const isOffline = networkService.isOffline();
      if (isOffline) {
      } else {
      }
    } finally {
      isLoadingFormRef.current = false;
      setLoading(false);
    }
  }, [formId, submissionId, sourceScreen, auditGroupId]);

  useEffect(() => {
    getFormStagesRef.current = getFormStages;
  }, [getFormStages]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      formLoadRetryCountRef.current = 0;
      loadedStageOrdersRef.current = new Set();
      allStageOrdersRef.current = [];
      await getFormStages();
    } finally {
      setRefreshing(false);
    }
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

    // Delay background loading to let user interact with first group without lag
    await new Promise(resolve => setTimeout(resolve, 3000));

    backgroundLoadInProgressRef.current = true;
    try {
      const BATCH_SIZE = 1;
      const allNewGroups: any[] = [];
      for (let i = 0; i < remainingOrders.length; i += BATCH_SIZE) {
        const batch = remainingOrders.slice(i, i + BATCH_SIZE);
        try {
          const partialData = await fetchFormStages(fId, batch, subId);
          if (partialData) {
            const newGroups = partialData.audit_group || [];
            if (newGroups.length > 0) {
              for (const order of batch) {
                await saveCachedStage(fId, order, partialData, subId);
                loadedStageOrdersRef.current.add(order);
              }
              allNewGroups.push(...newGroups);
            }
          }
        } catch {
          // Silent fail — will retry on next open
        }
        // Small delay between batches to let UI breathe
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Merge all new groups into state at once (single re-render)
      if (allNewGroups.length > 0) {
        setStages((prevStages) => {
          const merged = [...prevStages];
          for (const newGroup of allNewGroups) {
            const existingIdx = merged.findIndex(
              (s) => s.order === newGroup.order
            );
            const stageData = withUniqueIdsForStage(newGroup, existingIdx >= 0 ? existingIdx : merged.length);
            if (existingIdx >= 0) {
              merged[existingIdx] = stageData;
            } else {
              merged.push(stageData);
            }
          }
          merged.sort((a, b) => (a.order || 0) - (b.order || 0));
          return merged;
        });
      }
      await updateCacheTimestamp(fId, subId);
    } finally {
      backgroundLoadInProgressRef.current = false;
    }
  }, []);

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
        getFormStagesRef.current();
      } else if (comingActive) {
        shouldRetryLoadOnActiveRef.current = false;
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  // Fetch users (needed for some audit metadata; safe to skip when offline)
  const getUsers = useCallback(async () => {
    // Avoid noisy red-screen errors when offline; just log and skip
    if (networkService.isOffline()) {
      return;
    }

    try {
      const response = await api.get(USERS_LIST);
      setUsers(response.data);
    } catch (err: any) {
    }
  }, []);

  const getGroups = useCallback(async () => {
    try {
      const response = await api.get(GROUPS_LIST);
      setGroups(response.data);
    } catch (error: any) {
      // Fallback: set empty groups array
      setGroups([]);
    }
  }, []);

  const getLocationLeaders = useCallback(async () => {
    try {
      const response = await api.get(LOCATION_LEADERS_LIST);
      setLocationLeaders(response.data);
    } catch (error: any) {
      // Fallback: set empty location leaders array
      setLocationLeaders([]);
    }
  }, []);

  // Load users, groups, and location leaders when component mounts (needed for followup task display)
  useEffect(() => {
    getUsers();
    getGroups();
    getLocationLeaders();
  }, [getUsers, getGroups, getLocationLeaders]);

  // Load forms when task dialog opens
  useEffect(() => {
    if (showTaskDialog) {
      getAvailableForms();
    }
  }, [showTaskDialog, getAvailableForms]);

  // Use audit form hook (pass draft so hook can use saved values if needed)
  const {
    control,
    errors,
    isDirty,
    handleSubmit,
    onSubmit,
    watch,
    setValue,
    submitting,
    updateScore,
    calculateGroupScore,
    groupScores,
    formMaxScore,
    formUserScore,
    formPercentage,
    trigger,
    areAllRequiredQuestionsFilled,
    visibleQuestions,
    setFormSubmissionId, // Get the setter function from the hook
    formSubmissionId, // Get the submission ID from the hook
    reset, // Get reset to populate form with existing submission data
    submissionCompleted,
  } = useAuditForm(
    stages,
    submissionsDetail,
    formData,
    auditInfo,
    draft,
    draftId,
    sourceScreen,
    onClose,
    debugSetFormSubmissionId,
    plannerAssignmentId,
    collaborativeSubmissionId,
    groupDelegationId,
  );

  // Close the screen when submission completes successfully
  useEffect(() => {
    if (submissionCompleted) {
      allowNavigationRef.current = true;
      setAllowNavigation(true);
      if (onClose) {
        onClose();
      } else {
        router.back();
      }
    }
  }, [submissionCompleted, onClose]);

  // Build a draft-like data object from existing submission answers and reset the form
  // This runs when user clicks Edit on a sent form, transitioning from view to edit mode
  const hasPopulatedEditData = useRef(false);

  useEffect(() => {
    if (!isEditButtonClicked) {
      hasPopulatedEditData.current = false;
      return;
    }
    if (hasPopulatedEditData.current) return;
    if (!stages.length && !auditInfo?.questions?.length) return;
    if (draft) return; // Draft takes priority

    hasPopulatedEditData.current = true;

    const flattenQuestions = (questions: any[]) =>
      questions.flatMap((q) => [
        q,
        ...(q.sub_questions || []),
        ...(q.logics?.flatMap((l: any) => l.logic_questions) || []),
      ]);

    const allQuestions = [
      ...flattenQuestions((auditInfo as any)?.questions || []),
      ...flattenQuestions((stages || []).flatMap((g: any) => g?.questions || [])),
    ];

    const resetData: Record<string, any> = {};

    for (const q of allQuestions) {
      const uniqueId = (q as any).uniqueId || q.question_uuid;
      if (!uniqueId) continue;

      // Extract raw answer value from question.answers
      let rawAnswer: any = undefined;
      if (q.answers) {
        if (Array.isArray(q.answers) && q.answers.length > 0) {
          rawAnswer = q.answers[0]?.answer_id ?? q.answers[0]?.answer ?? q.answers[0]?.value ?? q.answers[0]?.submitted_value;
        } else if (typeof q.answers === "object" && q.answers !== null) {
          rawAnswer = q.answers.answer_id ?? q.answers.answer ?? q.answers.value ?? q.answers.submitted_value;
        }
      }
      if (rawAnswer === undefined || rawAnswer === null || rawAnswer === "") {
        rawAnswer = q.answer ?? q.value ?? q.submitted_value ?? q.answer_id;
      }
      if (rawAnswer === undefined || rawAnswer === null || rawAnswer === "") continue;

      // Convert to the format expected by each field type in edit mode
      switch (q.question_type) {
        case "checkboxes": {
          // CheckboxField expects array of raw IDs: [1, 3]
          if (typeof rawAnswer === "string" && rawAnswer.includes("|")) {
            resetData[uniqueId] = rawAnswer.split("|").map((v) => Number(v.trim())).filter((v) => !isNaN(v));
          } else if (Array.isArray(rawAnswer)) {
            resetData[uniqueId] = rawAnswer.map((v: any) => typeof v === "object" ? Number(v?.id) : Number(v)).filter((v) => !isNaN(v));
          } else {
            resetData[uniqueId] = [Number(rawAnswer)].filter((v) => !isNaN(v));
          }
          // Handle other_text
          const otherText = (typeof q.answers === "object" ? q.answers?.other_text : q.answers?.[0]?.other_text) || "";
          if (otherText) resetData[`${uniqueId}_other`] = otherText;
          break;
        }
        case "multiple_choice":
        case "audit": {
          // MultipleChoiceField and AuditField expect array of {id, option} objects
          const resolveOpt = (raw: any) => {
            const id = typeof raw === "object" ? Number(raw?.id) : Number(raw);
            if (isNaN(id)) return null;
            const matched = q.options?.find((opt: any) => Number(opt.id) === id);
            return matched ? { id: Number(matched.id), option: matched.option } : { id, option: raw };
          };
          if (typeof rawAnswer === "string" && rawAnswer.includes("|")) {
            resetData[uniqueId] = rawAnswer.split("|").map((v) => resolveOpt(v.trim())).filter(Boolean);
          } else if (Array.isArray(rawAnswer)) {
            resetData[uniqueId] = rawAnswer.map(resolveOpt).filter(Boolean);
          } else {
            const resolved = resolveOpt(rawAnswer);
            resetData[uniqueId] = resolved ? [resolved] : [];
          }
          // Handle other_text
          const otherText = (typeof q.answers === "object" ? q.answers?.other_text : q.answers?.[0]?.other_text) || "";
          if (otherText) resetData[`${uniqueId}_other`] = otherText;
          break;
        }
        case "dropdown":
        case "division":
        case "sub_division":
        case "user": {
          // These fields expect a raw ID value
          if (typeof rawAnswer === "object" && rawAnswer?.id != null) {
            resetData[uniqueId] = Number(rawAnswer.id);
          } else {
            resetData[uniqueId] = isNaN(Number(rawAnswer)) ? rawAnswer : Number(rawAnswer);
          }
          break;
        }
        case "table": {
          // Table field expects array of row objects
          if (typeof rawAnswer === "string") {
            try { resetData[uniqueId] = JSON.parse(rawAnswer); } catch {}
          } else if (Array.isArray(rawAnswer)) {
            resetData[uniqueId] = rawAnswer;
          }
          break;
        }
        case "linear_scale": {
          // LinearScaleField expects a numeric value
          resetData[uniqueId] = Number(rawAnswer);
          break;
        }
        case "location": {
          // Location is rendered as DropdownField, expects a raw ID
          if (typeof rawAnswer === "object" && rawAnswer?.id != null) {
            resetData[uniqueId] = Number(rawAnswer.id);
          } else if (typeof rawAnswer === "object" && rawAnswer?.answer_id != null) {
            resetData[uniqueId] = Number(rawAnswer.answer_id);
          } else {
            resetData[uniqueId] = isNaN(Number(rawAnswer)) ? rawAnswer : Number(rawAnswer);
          }
          break;
        }
        default: {
          // Text, textarea, date, etc. expect string values
          resetData[uniqueId] = rawAnswer;
          break;
        }
      }
    }

    // Use reset to populate all form fields at once, like loading a draft
    setTimeout(() => {
      reset(resetData);
    }, 100);
  }, [isEditButtonClicked, stages, auditInfo, draft, reset]);

  const hasFollowUpTasks = useMemo(() => {
    if (hasAuditFollowUpTasks(stages, auditInfo)) return true;
    return Array.isArray(temporaryFollowUpTasks) && temporaryFollowUpTasks.length > 0;
  }, [stages, auditInfo, temporaryFollowUpTasks]);

  useEffect(() => {
    if (visibleQuestions) {
      visibleQuestionsRef.current = visibleQuestions;
    }
  }, [visibleQuestions]);


  // Hide submitting overlay when submit completes
  useEffect(() => {
    if (!submitting) setShowSubmittingOverlay(false);
  }, [submitting]);

  // ===== Handle modal close cleanup =====
  const handleCloseTaskDialog = useCallback(() => {
    setShowTaskDialog(false);
    // Reset editing state when closing
    setCurrentEditingTask(null);
    setIsEditingWebTask(false);
    setCurrentTaskLogicFollowUpId(null);
    setCurrentTaskParentQuestionId(null);
    currentTaskLogicFollowUpIdRef.current = null;
    currentTaskParentQuestionIdRef.current = null;
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
    setTaskLocationLeaderSearchQuery("");
    setTaskFormSearchQuery("");
    setShowUserDropdown(false);
    setShowGroupDropdown(false);
    setShowLocationLeaderDropdown(false);
    setShowFormDropdown(false);
  }, []);

  // ===== Load draft data when draftId is provided =====
  const formStagesLoadedRef = useRef(false);
  useEffect(() => {
    const loadDraftData = async () => {
      if (!draftId || !user?.id) {
        setLoadingDraft(false);
        return;
      }

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
            const draftStages = (draft.formStructure.stages || []).map((stage: Stage, index: number) => withUniqueIdsForStage(stage, index));
            draftStages.sort((a: Stage, b: Stage) => (a.order || 0) - (b.order || 0));
            setStages(draftStages);
            setAuditInfo(withUniqueIdsForAuditInfo(draft.formStructure.audit_info || null));
            setPassPercentage(draft.formStructure.pass_percentage || 0);
            setFomData(draft.formStructure);
            setLoading(false);
            isUsingLocalData = true;
            setHasLocalDraftStructure(true);
          } else if (stages.length === 0) {
            // If no local structure and no stages loaded yet, continue and let API fetch later
            // We don't block here; fallthrough to fetch getFormStages below
          }

          // Always call getUsers() if we have a draft
          await getUsers();

          // Show draft loaded notification only if using local data or offline
          const isOffline = networkService.isOffline();
          if (isUsingLocalData || isOffline) {
            // Set draft loaded flag to show notification in populateFormWithExistingData
            setTimeout(() => {
              setDraft((prevDraft: any) => ({
                ...prevDraft,
                _loadedFromDraft: true,
              }));
            }, 100);
          }
        } else {
        }
      } catch (err) {
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
        setLoadingDraft(false);
      }
    };

    loadDraftData();
    if (formStagesLoadedRef.current) return;
    if (!draftId || !user?.id) {
      formStagesLoadedRef.current = true;
      getFormStages();
    } else if (!hasLocalDraftStructure) {
      formStagesLoadedRef.current = true;
      getFormStages();
    }
  }, [
    draftId,
    formId,
    user?.id,
    stages.length,
    getUsers,
    hasLocalDraftStructure,
  ]);

  useEffect(() => {
    if (draft && Object.keys(draft).length > 0) {
      for (const [key, value] of Object.entries(draft)) {
        if (key !== "_loadedFromDraft") {
          setValue(key, value, {
            shouldDirty: false,
            shouldTouch: false,
            shouldValidate: false,
          });
        }
      }

      if (draft._loadedFromDraft) {
        Toast.show({
          type: "info",
          text1: "Draft Loaded",
          text2: "Your saved audit form draft has been loaded.",
          position: "top",
        });
      }
    }
  }, [draft, setValue]);

  // Debounced allValues — prevents entire screen re-render on every keystroke/click
  // Updates 300ms after last change, keeping UI responsive
  const [allValues, setAllValues] = useState<any>({});
  useEffect(() => {
    allValuesRef.current = allValues;
  }, [allValues]);
  useEffect(() => {
    collaborativeAnsweredRef.current = collaborativeAnsweredQuestions;
  }, [collaborativeAnsweredQuestions]);
  useEffect(() => {
    let timer: any = null;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setAllValues({ ...values });
      }, 300);
    });
    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [watch]);

  useEffect(() => {
    const isCollaborative = sourceScreen === "collaborative";
    if (!isViewMode && !isCollaborative) return;
    if (hasPopulatedViewData.current) return;

    const auditInfoQuestions = (auditInfo as any)?.questions || [];
    const stageQuestions = (stages || []).flatMap(
      (g: any) => g?.questions || [],
    );
    if (auditInfoQuestions.length === 0 && stageQuestions.length === 0) return;

    // When group is rejected, user re-edits their own answers — don't lock them
    const isRejectedGroup = groupDelegationStatus === "rejected";

    const flattenQuestions = (questions: any[]) =>
      questions.flatMap((q) => [
        q,
        ...(q.sub_questions || []),
        ...(q.logics?.flatMap((l: any) => l.logic_questions) || []),
      ]);

    const allQuestions = [
      ...flattenQuestions(auditInfoQuestions),
      ...flattenQuestions(stageQuestions),
    ];

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

    const isEmptyValue = (val: any) => {
      if (val === undefined || val === null) return true;
      if (typeof val === "string" && val.trim() === "") return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    };

    const resolveOption = (question: any, raw: any) => {
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
        const matched = question.options?.find(
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
        const matched = question.options?.find(
          (opt: any) =>
            String(opt.option || "").toLowerCase() === optionText!.toLowerCase(),
        );
        if (matched) {
          return { id: Number(matched.id), option: matched.option };
        }
        return { id: optionId ?? Number.NaN, option: optionText };
      }

      return null;
    };

    const answeredKeys = new Set<string>();

    for (const question of allQuestions) {
      try {
        const q = question as any;
        const questionKey = (q as any).uniqueId || q.question_uuid;

        // Determine who submitted this answer, so we don't lock the current
        // user's own previously-saved answers as if a teammate answered them.
        let answerSubmittedById: number | undefined;
        if (Array.isArray(q.answers) && q.answers.length > 0) {
          answerSubmittedById = q.answers[0]?.submitted_by ?? q.answers[0]?.submitted_by_id;
        } else if (typeof q.answers === "object" && q.answers !== null) {
          answerSubmittedById = q.answers.submitted_by ?? q.answers.submitted_by_id;
        }

        const isTeammateAnswer =
          isCollaborative &&
          answerSubmittedById != null &&
          Number(answerSubmittedById) !== Number(user?.id);

        // Skip re-populating if the local value is already set — UNLESS this is a
        // teammate's answer (locked/uneditable for this user), in which case we
        // always refresh from server data since a stale/wrong-shaped cached value
        // (e.g. from an older draft) would otherwise render blank forever.
        if (!isEmptyValue(allValues?.[questionKey]) && !isTeammateAnswer) continue;

        let answerValue = q.answer || q.value || q.submitted_value;

        // Location questions: backend replaces "answer" with location NAME text,
        // but DropdownField needs the raw location ID. Prefer the "location" FK field.
        if (q.question_type === "location") {
          if (Array.isArray(q.answers) && q.answers.length > 0) {
            const locEntry = q.answers.find((a: any) => a?.location != null) || q.answers[0];
            if (locEntry?.location != null) {
              answerValue = locEntry.location;
            }
          } else if (typeof q.answers === "object" && q.answers?.location != null) {
            answerValue = q.answers.location;
          }
        }

        if (
          (answerValue === null ||
            answerValue === undefined ||
            answerValue === "") &&
          q.answers
        ) {
          if (Array.isArray(q.answers) && q.answers.length > 0) {
            answerValue =
              q.answers[0].answer ||
              q.answers[0].value ||
              q.answers[0].submitted_value ||
              q.answers[0];
          } else if (typeof q.answers === "object" && q.answers !== null) {
            answerValue =
              q.answers.answer || q.answers.value || q.answers.submitted_value;
          }
        }

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

          if (q.submission_answer) {
            answerValue = q.submission_answer;
          } else if (q.user_answer) {
            answerValue = q.user_answer;
          } else if (q.response) {
            answerValue = q.response;
          } else if (q.response_value) {
            answerValue = q.response_value;
          }

          if (
            (answerValue === null ||
              answerValue === undefined ||
              answerValue === "") &&
            q.answer_data
          ) {
            answerValue = q.answer_data.answer || q.answer_data.value;
          }

          if (
            (answerValue === null ||
              answerValue === undefined ||
              answerValue === "") &&
            q.data
          ) {
            answerValue = q.data.answer || q.data.value;
          }
        }

        if (
          answerValue === undefined ||
          answerValue === null ||
          answerValue === ""
        )
          continue;

        let processedValue = answerValue;
        switch (q.question_type) {
          case "checkboxes":
          case "multiple_choice":
          case "audit": {
            if (Array.isArray(answerValue)) {
              processedValue = answerValue
                .map((v: any) => resolveOption(q, v))
                .filter(Boolean);
            } else if (
              typeof answerValue === "string" &&
              (answerValue.includes("|") || answerValue.includes(","))
            ) {
              processedValue = answerValue
                .split(/[|,]/)
                .filter((v) => v.trim() !== "")
                .map((v) => resolveOption(q, v))
                .filter(Boolean);
            } else {
              const resolved = resolveOption(q, answerValue);
              processedValue = resolved ? [resolved] : [];
            }
            break;
          }
          case "dropdown":
          case "linear_scale": {
            const resolved = resolveOption(q, answerValue);
            processedValue = resolved || answerValue;
            break;
          }
          default:
            processedValue = answerValue;
            break;
        }

        setValue(questionKey, processedValue, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        });

        const answeredBySomeoneElse =
          answerSubmittedById == null || Number(answerSubmittedById) !== Number(user?.id);
        if (isCollaborative && !isRejectedGroup && answeredBySomeoneElse) {
          answeredKeys.add(questionKey);
        }
      } catch (error) {
      }
    }

    if (isCollaborative) {
      if (isRejectedGroup) {
        // Rejected group: clear all locks so user can re-edit everything
        collaborativeAnsweredRef.current = new Set();
        setCollaborativeAnsweredQuestions(new Set());
      } else if (answeredKeys.size > 0) {
        collaborativeAnsweredRef.current = answeredKeys;
        setCollaborativeAnsweredQuestions(answeredKeys);
      }
    }

    // Only mark as populated if we've processed both auditInfo and stages
    // In collaborative mode, stages load after auditInfo — don't lock out stage questions
    const hasAuditInfo = auditInfoQuestions.length > 0;
    const hasStages = stageQuestions.length > 0;
    if (hasAuditInfo && hasStages) {
      hasPopulatedViewData.current = true;
    } else if (hasAuditInfo && !isCollaborative) {
      // Non-collaborative: auditInfo-only is enough (no stages to wait for)
      hasPopulatedViewData.current = true;
    } else if (hasStages) {
      // Stages loaded without auditInfo — mark as populated
      hasPopulatedViewData.current = true;
    }
  }, [allValues, auditInfo, isViewMode, setValue, stages, sourceScreen, groupDelegationStatus]);

  // ===== Silent polling for collaborative mode =====
  // Polls every 5 seconds for new answers from teammates and merges them silently
  useEffect(() => {
    if (sourceScreen !== "collaborative" || !plannerAssignmentId) return;
    if (!stagesRef.current || stagesRef.current.length === 0) return;

    // Build a map of question_id -> question_uuid from loaded stages for answer mapping
    const buildQuestionIdMap = () => {
      const idMap = new Map<number, string>();
      const flattenQuestions = (questions: any[]) =>
        questions.flatMap((q) => [
          q,
          ...(q.sub_questions || []),
          ...(q.logics?.flatMap((l: any) => l.logic_questions) || []),
        ]);

      const auditInfoQuestions = (auditInfoRef.current as any)?.questions || [];
      const stageQuestions = (stagesRef.current || []).flatMap((g: any) => g?.questions || []);
      const allQs = [...flattenQuestions(auditInfoQuestions), ...flattenQuestions(stageQuestions)];

      for (const q of allQs) {
        if (q.id != null) {
          const key = (q as any).uniqueId || q.question_uuid;
          if (key) idMap.set(Number(q.id), key);
        }
      }
      return idMap;
    };

    const pollAnswers = async () => {
      try {
        const isRejectedGroup = groupDelegationStatus === "rejected";
        const res = await api.get(PLANNER_COLLABORATIVE_POLL_ANSWERS(plannerAssignmentId));
        const polledAnswers = res.data?.answers || [];
        if (polledAnswers.length === 0) return;

        const idMap = buildQuestionIdMap();
        const currentAnswered = collaborativeAnsweredRef.current;
        const newAnsweredKeys = new Set(currentAnswered);
        let hasNewAnswers = false;

        for (const ans of polledAnswers) {
          const qKey = idMap.get(Number(ans.question_id));
          if (!qKey) continue;

          // Skip answers submitted by the current user — they're editing their own
          if (ans.submitted_by_id && Number(ans.submitted_by_id) === Number(user.id)) continue;

          // For rejected groups, don't lock any questions — user needs to re-edit
          if (isRejectedGroup) continue;

          // Only update if the user hasn't already filled this question themselves
          const currentValue = allValuesRef.current?.[qKey];
          const isEmpty = currentValue === undefined || currentValue === null || currentValue === "" ||
            (Array.isArray(currentValue) && currentValue.length === 0);

          if (isEmpty) {
            let processedValue: any = ans.answer;
            // Handle selection-type answer format (audit, multiple_choice, checkboxes, dropdown, linear_scale)
            const question = [...(auditInfoRef.current as any)?.questions || [], ...(stagesRef.current || []).flatMap((g: any) => g?.questions || [])]
              .flatMap((q: any) => [q, ...(q.sub_questions || []), ...(q.logics?.flatMap((l: any) => l.logic_questions) || [])])
              .find((q: any) => Number(q.id) === Number(ans.question_id));

            // Location questions: use the raw location_id field, not the answer text
            if (question && question.question_type === "location" && ans.location_id != null) {
              processedValue = ans.location_id;
            } else {
              const selectionTypes = ["checkboxes", "multiple_choice", "audit", "dropdown", "linear_scale"];
              if (question && selectionTypes.includes(question.question_type)) {
              const resolveOptionObj = (raw: any) => {
                if (typeof raw === "object" && raw?.id != null) return { id: Number(raw.id), option: raw.option || raw.value || raw.label };
                const matched = question.options?.find((opt: any) => Number(opt.id) === Number(raw));
                if (matched) return { id: Number(matched.id), option: matched.option };
                // Fallback: try text match (case-insensitive)
                if (typeof raw === "string") {
                  const textMatched = question.options?.find((opt: any) => String(opt.option || "").toLowerCase() === raw.toLowerCase());
                  if (textMatched) return { id: Number(textMatched.id), option: textMatched.option };
                  return { id: Number.NaN, option: raw };
                }
                return null;
              };

              if (question.question_type === "checkboxes" || question.question_type === "multiple_choice" || question.question_type === "audit") {
                if (Array.isArray(ans.answer)) {
                  processedValue = ans.answer.map(resolveOptionObj).filter(Boolean);
                } else if (typeof ans.answer === "string" && (ans.answer.includes("|") || ans.answer.includes(","))) {
                  processedValue = ans.answer
                    .split(/[|,]/)
                    .filter((v: string) => v.trim() !== "")
                    .map(resolveOptionObj)
                    .filter(Boolean);
                } else {
                  const resolved = resolveOptionObj(ans.answer);
                  processedValue = resolved ? [resolved] : [];
                }
              } else {
                // audit, dropdown, linear_scale — single option as {id, option}
                const resolved = resolveOptionObj(ans.answer);
                processedValue = resolved || ans.answer;
              }
            }
            }

            setValue(qKey, processedValue, {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
            newAnsweredKeys.add(qKey);
            hasNewAnswers = true;
          } else if (!currentAnswered.has(qKey)) {
            // User has filled this question themselves, but teammate also answered.
            // Silently resolve with the teammate's answer and lock — no popup.
            if (ans.submitted_by_id && Number(ans.submitted_by_id) !== Number(user.id)) {
              if (!conflictAlertShownRef.current.has(String(ans.question_id))) {
                conflictAlertShownRef.current.add(String(ans.question_id));

                const conflictQuestion = [...(auditInfoRef.current as any)?.questions || [], ...(stagesRef.current || []).flatMap((g: any) => g?.questions || [])]
                  .flatMap((q: any) => [q, ...(q.sub_questions || []), ...(q.logics?.flatMap((l: any) => l.logic_questions) || [])])
                  .find((q: any) => Number(q.id) === Number(ans.question_id));

                // Override with teammate's answer
                let processedValue: any = ans.answer;
                const conflictSelectionTypes = ["checkboxes", "multiple_choice", "audit", "dropdown", "linear_scale"];
                if (conflictQuestion && conflictSelectionTypes.includes(conflictQuestion.question_type)) {
                  const resolveOpt = (raw: any) => {
                    if (typeof raw === "object" && raw?.id != null) return { id: Number(raw.id), option: raw.option || raw.value || raw.label };
                    const matched = conflictQuestion.options?.find((opt: any) => Number(opt.id) === Number(raw));
                    if (matched) return { id: Number(matched.id), option: matched.option };
                    if (typeof raw === "string") {
                      const textMatched = conflictQuestion.options?.find((opt: any) => String(opt.option || "").toLowerCase() === raw.toLowerCase());
                      if (textMatched) return { id: Number(textMatched.id), option: textMatched.option };
                      return { id: Number.NaN, option: raw };
                    }
                    return null;
                  };
                  if (conflictQuestion.question_type === "checkboxes" || conflictQuestion.question_type === "multiple_choice" || conflictQuestion.question_type === "audit") {
                    if (typeof ans.answer === "string" && (ans.answer.includes("|") || ans.answer.includes(","))) {
                      processedValue = ans.answer
                        .split(/[|,]/)
                        .filter((v: string) => v.trim() !== "")
                        .map(resolveOpt)
                        .filter(Boolean);
                    } else {
                      const resolved = resolveOpt(ans.answer);
                      processedValue = resolved ? [resolved] : [];
                    }
                  } else {
                    const resolved = resolveOpt(ans.answer);
                    processedValue = resolved || ans.answer;
                  }
                }
                setValue(qKey, processedValue, {
                  shouldDirty: false,
                  shouldTouch: false,
                  shouldValidate: false,
                });
              }
              newAnsweredKeys.add(qKey);
              hasNewAnswers = true;
            } else {
              newAnsweredKeys.add(qKey);
              hasNewAnswers = true;
            }
          }
        }

        if (hasNewAnswers) {
          collaborativeAnsweredRef.current = newAnsweredKeys;
          setCollaborativeAnsweredQuestions(newAnsweredKeys);
        }
      } catch {
        // Silent fail — retry next cycle
      }
    };

    // Initial poll after 1.5 seconds (let form load first), then every 5 seconds
    const initialTimer = setTimeout(pollAnswers, 1500);
    const interval = setInterval(pollAnswers, 5000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [sourceScreen, plannerAssignmentId, setValue]);

  // ===== Collaborative auto-save =====
  // Saves answers to backend so teammates see them in real-time via polling.
  // Uses refs for stages/auditInfo so the watch subscription stays alive across re-renders.
  const lastAutoSaveRef = useRef<string>("");
  const conflictAlertShownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (sourceScreen !== "collaborative" || !plannerAssignmentId || !groupDelegationId) return;

    let debounceTimer: any = null;

    const getAllQuestions = () => {
      const flatten = (qs: any[]) =>
        qs.flatMap((q) => [q, ...(q.sub_questions || []), ...(q.logics?.flatMap((l: any) => l.logic_questions) || [])]);
      const ai = (auditInfoRef.current as any)?.questions || [];
      const sq = (stagesRef.current || []).flatMap((g: any) => g?.questions || []);
      return [...flatten(ai), ...flatten(sq)];
    };

    const buildPayload = (values: any) => {
      const allQs = getAllQuestions();
      const answers: any[] = [];
      for (const q of allQs) {
        if (q.id == null) continue;
        const key = (q as any).uniqueId || q.question_uuid;
        if (!key) continue;
        // Don't re-send questions already locked (answered by a teammate) —
        // resending them causes spurious "already answered" conflicts and wipes
        // the value out from under the (read-only) field.
        // Exception: for rejected groups, user needs to re-edit all answers.
        const isRejectedGroup = groupDelegationStatus === "rejected";
        if (!isRejectedGroup && collaborativeAnsweredRef.current.has(key)) continue;
        const val = values?.[key];
        if (val === undefined || val === null || val === "" ||
            (Array.isArray(val) && val.length === 0)) continue;

        let answerValue: any = val;
        if (Array.isArray(val) && ["checkboxes", "multiple_choice", "audit"].includes(q.question_type)) {
          answerValue = val
            .filter((item: any) => !item?.isOther)
            .map((item: any) => typeof item === "object" && item?.id != null ? item.id : item)
            .filter((v: any) => v !== undefined && v !== null && v !== "")
            .join("|");
        } else if (typeof val === "object" && val !== null && val.id != null) {
          answerValue = String(val.id);
        } else {
          answerValue = String(val);
        }
        if (!answerValue) continue;

        answers.push({
          question: Number(q.id),
          question_type: q.question_type,
          answer: answerValue,
          _qKey: key,
        });
      }
      return answers;
    };

    const sendAutoSave = async (values: any) => {
      const answers = buildPayload(values);
      if (answers.length === 0) return;

      const payload = answers.map(({ _qKey, ...rest }) => rest);
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastAutoSaveRef.current) return;
      lastAutoSaveRef.current = payloadKey;

      try {
        const res = await api.post(PLANNER_COLLABORATIVE_AUTO_SAVE(plannerAssignmentId), {
          group_delegation_id: Number(groupDelegationId),
          answers: payload,
        });

        const conflicts = res.data?.conflicts || [];
        for (const conflict of conflicts) {
          const cKey = String(conflict.question_id);
          if (conflictAlertShownRef.current.has(cKey)) continue;
          conflictAlertShownRef.current.add(cKey);

          const allQs = getAllQuestions();
          const q = allQs.find((qq: any) => Number(qq.id) === Number(conflict.question_id));
          const qKey = q ? ((q as any).uniqueId || q.question_uuid) : null;

          // Silently lock the field — no popup. The next poll cycle will fill in
          // the teammate's actual answer text via the polling effect below.
          if (qKey) {
            setValue(qKey, "", { shouldDirty: false, shouldValidate: false });
            const newAnswered = new Set(collaborativeAnsweredRef.current);
            newAnswered.add(qKey);
            collaborativeAnsweredRef.current = newAnswered;
            setCollaborativeAnsweredQuestions(newAnswered);
          }
        }
      } catch {
        // Silent fail — will retry on next change
      }
    };

    const subscription = watch((values) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        sendAutoSave(values);
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [sourceScreen, plannerAssignmentId, groupDelegationId, watch, setValue]);

  const getQuestionKey = useCallback(
    (question: Question) => (question as any).uniqueId || question.question_uuid,
    [],
  );

  // Memoize allQuestions array for better performance
  // IMPORTANT: Include both auditInfo questions AND stage/group questions
  // Use a Set to eliminate duplicates when combining questions

  const allQuestions = useMemo(() => {
    const auditInfoQuestions = (auditInfo as any)?.questions || [];

    // Create a Set to track unique questions per group
    const questionSet = new Set<string>();
    const uniqueQuestions: Question[] = [];

    // Add audit info questions
    auditInfoQuestions.forEach((q: Question) => {
      const uniqueKey = (q as any).uniqueId || `audit-info_${q.question_uuid}`;
      if (!questionSet.has(uniqueKey)) {
        questionSet.add(uniqueKey);
        uniqueQuestions.push(q);
      }
    });

    // Add stage questions - keep all questions including duplicates across stages
    stages.forEach((stage: any, stageIndex: number) => {
      const stageQuestions = stage.questions || [];
      stageQuestions.forEach((q: Question) => {
        const uniqueKey = (q as any).uniqueId || `stage-${stageIndex}_${q.question_uuid}`;
        if (!questionSet.has(uniqueKey)) {
          questionSet.add(uniqueKey);
          uniqueQuestions.push(q);
        }
      });
    });

    return uniqueQuestions;
  }, [stages, auditInfo]);

  // Collect all questions including logic questions for follow-up task visibility
  // Check if there are visible follow-up tasks (second scenario logic)
  const hasVisibleFollowUpTasks = useMemo(() => {
    const auditInfoQuestions = (auditInfo as any)?.questions || [];
    const stageQuestions = (stages || []).flatMap(
      (stage: any) => stage?.questions || [],
    );
    const allQuestions = [...auditInfoQuestions, ...stageQuestions];

    for (const question of allQuestions) {
      if (question.logics) {
        for (const logic of question.logics) {
          // Check if logic has followup_toggle=true but no assign_form (second scenario)
          if (logic.followup_toggle && !logic.follow_up?.assign_form) {
            return true;
          }
        }
      }
    }
    return false;
  }, [stages, auditInfo]);

  const allQuestionsWithLogic = useMemo(() => {
    const result: Question[] = [];
    const auditInfoQuestions = (auditInfo as any)?.questions || [];

    // Create a Set to track unique questions per group
    const questionSet = new Set<string>();

    // Add audit info questions
    auditInfoQuestions.forEach((q: Question) => {
      const uniqueKey = (q as any).uniqueId || `audit-info_${q.question_uuid}`;
      if (!questionSet.has(uniqueKey)) {
        questionSet.add(uniqueKey);
        result.push(q);
      }
    });

    // Add stage questions - keep all questions including duplicates across stages
    stages.forEach((stage: any, stageIndex: number) => {
      const stageQuestions = stage.questions || [];
      stageQuestions.forEach((q: Question) => {
        const uniqueKey = (q as any).uniqueId || `stage-${stageIndex}_${q.question_uuid}`;
        if (!questionSet.has(uniqueKey)) {
          questionSet.add(uniqueKey);
          result.push(q);
        }
      });
    });

    // Add logic questions that are visible (only if not already in main questions)
    for (const question of [
      ...auditInfoQuestions,
      ...stages.flatMap((s: any) => s.questions || []),
    ]) {
      if (question.logics) {
        for (const logic of question.logics) {
          if (logic.logic_questions) {
            logic.logic_questions.forEach((logicQuestion: Question) => {
              // Check if this logic question already exists
              const exists = result.some(
                (q) => q.question_uuid === logicQuestion.question_uuid,
              );
              if (!exists) {
                result.push(logicQuestion);
              }
            });
          }
        }
      }
    }

    return result;
  }, [stages, auditInfo]);

  const isCollaborativeMode = sourceScreen === "collaborative";
  const isCompleted = submissionsDetail?.is_completed && !isEditButtonClicked;
  const isRejectedCollabGroup = isCollaborativeMode && groupDelegationStatus === "rejected";
  const isEditable = !showPreview && (!isCompleted || isRejectedCollabGroup);

  const handleMakePdf = async () => {
    setShowOptionsMenu(false);
    try {
      setIsGeneratingPdf(true);
      if (!formId) {
        Toast.show({ type: "error", text1: "Error", text2: "Form ID missing for PDF generation.", position: "top" });
        return;
      }

      const submissionIdLocal = submissionsDetail?.id || submissionId;
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
            encoding: (FileSystem as any).EncodingType?.Base64 ?? (FileSystem as any).EncodingType ?? "base64",
          } as any);

          await Sharing.shareAsync(fileUri, {
            mimeType: "application/pdf",
            dialogTitle: `Form ${formId} Submission PDF`,
            UTI: "com.adobe.pdf",
          });
          Toast.show({ type: "success", text1: "Success", text2: "PDF shared successfully.", position: "top" });
        };
      }
    } catch (error: any) {
      let errorMessage = "Failed to generate or share PDF. Please try again.";
      if (error.response?.status === 400)
        errorMessage = error.response.data?.error || "Bad request - please check form data.";
      else if (error.response?.status === 404)
        errorMessage = "Form not found or no submissions available for PDF generation.";
      else if (error.response?.status === 403)
        errorMessage = "You don't have permission to generate PDF for this form.";
      else if (error.response?.data?.error)
        errorMessage = error.response.data.error;

      Toast.show({ type: "error", text1: "PDF Generation Error", text2: errorMessage, position: "top" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareForm = async () => {
    setShowOptionsMenu(false);
    const submissionIdLocal = submissionsDetail?.id || submissionId;
    if (!submissionIdLocal) {
      Alert.alert("Share Failed", "No submission ID available for sharing.");
      return;
    }

    try {
      const response = await api.get(`/form/${formId}/`);
      const rawShareFlag = response.data?.share_response ?? response.data?.allow_share ?? false;
      if (!rawShareFlag) {
        Alert.alert("Sharing Disabled", "This form does not have sharing enabled.");
        return;
      }
      setShareSelectedIds([]);
      setShareActiveTab("user");
      setShareSearchQuery("");
      setShowShareModal(true);
    } catch (error: any) {
      Alert.alert("Share Failed", "Failed to check form sharing status.");
    }
  };

  const handleShareSubmit = async () => {
    const submissionIdLocal = submissionsDetail?.id || submissionId;
    if (!submissionIdLocal) {
      Alert.alert("Share Failed", "No submission ID available for sharing.");
      return;
    }
    if (shareSelectedIds.length === 0) {
      Alert.alert("Share Failed", "Please select at least one recipient.");
      return;
    }

    setIsSharing(true);
    try {
      const sharePayload =
        shareActiveTab === "groups"
          ? { users: [], groups: shareSelectedIds, location_leaders: [] }
          : shareActiveTab === "leaders"
            ? { users: [], groups: [], location_leaders: shareSelectedIds }
            : { users: shareSelectedIds, groups: [], location_leaders: [] };

      const shareRes = await api.post(
        `/form/submission/share/${formId}/${submissionIdLocal}/`,
        sharePayload,
      );

      if (shareRes.data?.share_url) {
        const shareUrl = shareRes.data.share_url;
        if (Platform.OS === "web") {
          navigator.clipboard?.writeText(shareUrl);
          Toast.show({ type: "success", text1: "Link Copied", text2: "Share link copied to clipboard.", position: "top" });
        } else {
          await Sharing.shareAsync(shareUrl, { dialogTitle: "Share Form Link" });
        }
      } else {
        Toast.show({ type: "success", text1: "Shared", text2: "Form shared successfully.", position: "top" });
      }
      setShowShareModal(false);
      setShareSelectedIds([]);
    } catch (shareError: any) {
      Alert.alert("Share Failed", shareError?.response?.data?.error || "Failed to share form.");
    } finally {
      setIsSharing(false);
    }
  };

  const filteredShareOptions = useMemo(() => {
    const query = shareSearchQuery.toLowerCase();
    if (shareActiveTab === "groups") {
      return groups.filter((g) => g.name?.toLowerCase().includes(query));
    } else if (shareActiveTab === "leaders") {
      return locationLeaders.filter((l) => {
        const fullName = `${l.first_name || ""} ${l.last_name || ""}`.toLowerCase();
        return fullName.includes(query) || l.username?.toLowerCase().includes(query) || l.email?.toLowerCase().includes(query);
      });
    } else {
      return users.filter((u) => {
        const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
        return fullName.includes(query) || u.username?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query);
      });
    }
  }, [shareActiveTab, shareSearchQuery, users, groups, locationLeaders]);

  const toggleShareSelection = useCallback((id: number) => {
    setShareSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  }, []);

  const handleEditClick = () => {
    setShowOptionsMenu(false);
    setIsEditButtonClicked(true);
    triggerCalledRef.current = false;
  };

  // Register global header options and back button for sent/view audit form screens
  const { setFormOptions, setShowBackButton, setOnBackPress } = useContext(ToggleContext) ?? {};

  const collectMissingRequiredErrors = useCallback(
    (formValues: any) => {
      const errorMap: Record<string, boolean> = {};

      const addErrorIfMissing = (question: Question) => {
        if (!question?.is_required) return;
        if (question.question_type === "title_and_description") return;
        const key = getQuestionKey(question);
        // Skip validation for questions answered by teammates in collaborative mode
        if (isCollaborativeMode && collaborativeAnsweredQuestions.has(key)) return;
        if (question.question_type === "table") {
          const tableValue =
            formValues[key] ?? formValues[question.question_uuid];
          const rows = Array.isArray(tableValue) ? tableValue : [];

          if (rows.length === 0) {
            errorMap[key] = true;
            return;
          }

          if (question.sub_questions?.length) {
            for (const row of rows) {
              for (const subQ of question.sub_questions) {
                if (!subQ?.is_required) continue;
                const subKey = (subQ as any).uniqueId || subQ.question_uuid;
                const subValue = row?.[subKey] ?? row?.[subQ.question_uuid];
                if (isValueEmpty(subValue, subQ.question_type)) {
                  errorMap[key] = true;
                  return;
                }
              }
            }
          }
          return;
        }

        const value = formValues[key];
        if (isValueEmpty(value, question.question_type)) {
          errorMap[key] = true;
        }
      };

      const isLogicQuestionVisible = (q: Question) => {
        const key = getQuestionKey(q);
        return (
          (visibleQuestions && visibleQuestions.has(key)) ||
          (visibleQuestions && visibleQuestions.has(q.question_uuid))
        );
      };

      const checkQuestionAndNested = (question: Question) => {
        // If the parent question is locked (answered by a teammate in
        // collaborative mode), its sub_questions/logic_questions inherit the
        // same disabled/read-only UI state (see AuditField.tsx) — so they must
        // also be excluded from required validation, otherwise the user is
        // blocked by a required field they have no way to fill in.
        const parentKey = getQuestionKey(question);
        const isParentLocked =
          isCollaborativeMode && collaborativeAnsweredQuestions.has(parentKey);

        addErrorIfMissing(question);
        if (isParentLocked) return;

        if (question.sub_questions?.length) {
          question.sub_questions.forEach((subQ: Question) => {
            addErrorIfMissing(subQ);
          });
        }

        if (question.logics?.length) {
          for (const logic of question.logics) {
            if (logic.logic_questions?.length) {
              for (const logicQuestion of logic.logic_questions) {
                if (!isLogicQuestionVisible(logicQuestion)) continue;
                addErrorIfMissing(logicQuestion);
                if (logicQuestion.sub_questions?.length) {
                  logicQuestion.sub_questions.forEach((subQ: Question) => {
                    addErrorIfMissing(subQ);
                  });
                }
              }
            }
          }
        }
      };

      for (const question of allQuestions) {
        checkQuestionAndNested(question);
      }

      return errorMap;
    },
    [allQuestions, visibleQuestions, getQuestionKey, isCollaborativeMode, collaborativeAnsweredQuestions],
  );

  const allRequiredFilledLocal = useMemo(
    () => Object.keys(collectMissingRequiredErrors(allValues)).length === 0,
    [collectMissingRequiredErrors, allValues],
  );

  // ===== ACCORDION MANAGEMENT =====
  // Track accordion IDs to detect structural changes (not just score updates)
  const accordionIdsRef = useRef<string[]>([]);

  // Memoize accordion data for performance
  // Separate the structure (IDs, titles) from dynamic data (scores)
  const accordionsStructure = useMemo(() => {
    const data: Array<{
      id: string;
      title: string;
      questions: Question[];
      auditGroupId: number;
      initialExpanded: boolean;
    }> = [];

    if (
      auditInfo &&
      (auditInfo as any).questions &&
      (auditInfo as any).questions.length > 0
    ) {
      data.push({
        id: `audit-info-${(auditInfo as any).id}`,
        title: "Audit Information",
        questions: (auditInfo as any).questions,
        auditGroupId: (auditInfo as any).id,
        initialExpanded: true,
      });
    }

    const sortedStages = [...stages].sort((a: Stage, b: Stage) => (a.order || 0) - (b.order || 0));
    sortedStages.forEach((stage, stageIndex) => {
      // Add ALL questions from this stage - don't filter out duplicates
      // The uniqueId will ensure each question has its own form field
      const stageQuestions = stage.questions || [];

      // Only add accordion if there are questions
      if (stageQuestions.length > 0) {
        data.push({
          id: `stage-${stage.id}`,
          title: stage.name,
          questions: stageQuestions,
          auditGroupId: stage.id,
          initialExpanded: stage.name === "Audit Group 1",
        });
      }
    });

    return data;
  }, [stages, auditInfo]);

  // Memoize accordion data with scores (this will update when scores change)
  const accordionsData = useMemo(() => {
    return accordionsStructure.map((acc) => ({
      ...acc,
      groupScore: calculateGroupScore(acc.questions),
    }));
  }, [accordionsStructure, calculateGroupScore]);

  // Only initialize/reset expanded accordions when structure changes, not when scores change
  useEffect(() => {
    const currentIds = accordionsStructure.map((acc) => acc.id);
    const previousIds = accordionIdsRef.current;
    const structureChanged =
      currentIds.length !== previousIds.length ||
      currentIds.some((id, index) => id !== previousIds[index]);

    if (structureChanged || previousIds.length === 0) {
      // Structure changed or first mount - initialize expanded state
      accordionIdsRef.current = currentIds;

      setExpandedAccordionIds((prev) => {
        const currentExpanded: string[] = [];

        // Respect user toggle for audit info; only auto-expand on first load
        const auditInfo = accordionsStructure.find((acc) =>
          acc.id.startsWith("audit-info"),
        );
        if (auditInfo) {
          const hadAuditInfoBefore = prev.some((id) =>
            id.startsWith("audit-info"),
          );
          const shouldExpandAuditInfo =
            prev.length === 0 ||
            prev.includes(auditInfo.id) ||
            !hadAuditInfoBefore;
          if (shouldExpandAuditInfo) {
            currentExpanded.push(auditInfo.id);
          }
        }

        // Preserve any manually expanded accordions that still exist
        const validPrevExpanded = prev.filter((id) => currentIds.includes(id));
        validPrevExpanded.forEach((id) => {
          if (!currentExpanded.includes(id)) {
            currentExpanded.push(id);
          }
        });

        // Add groups that need to be expanded due to validation errors
        expandedAuditGroups.forEach((groupId) => {
          const groupAccId = `stage-${groupId}`;
          if (!currentExpanded.includes(groupAccId)) {
            currentExpanded.push(groupAccId);
          }
        });

        return currentExpanded;
      });
    } else {
      // Only structure is the same, just update expandedAuditGroups if needed
      setExpandedAccordionIds((prev) => {
        const currentExpanded = [...prev];

        // Add groups that need to be expanded due to validation errors
        expandedAuditGroups.forEach((groupId) => {
          const groupAccId = `stage-${groupId}`;
          if (!currentExpanded.includes(groupAccId)) {
            currentExpanded.push(groupAccId);
          }
        });

        return currentExpanded;
      });
    }
  }, [accordionsStructure, expandedAuditGroups]);

  const getAccordionIndex = useCallback(
    (accordionId: string) => {
      return accordionsData.findIndex((acc) => acc.id === accordionId);
    },
    [accordionsData],
  );

  // Simplified scroll functions - focus on direct field scrolling like old working code
  const scrollToField = useCallback((fieldUuid: string) => {
    const fieldRef = fieldRefs.current[fieldUuid];
    if (
      fieldRef?.current &&
      typeof fieldRef.current.measureInWindow === "function"
    ) {
      fieldRef.current.measureInWindow(
        (x: number, y: number, width: number, height: number) => {
          if (y > 0) {
            // Scroll to position the field at 25% from top of screen
            const screenHeight = Dimensions.get("window").height;
            const targetY = Math.max(0, y - screenHeight * 0.25);
            keyboardContainerRef.current?.scrollToOffset(targetY);
          }
        },
      );
    }
  }, []);

  const scrollToAccordion = useCallback((accordionId: string) => {
    // Simple fallback - just scroll to top if direct field scrolling fails
    keyboardContainerRef.current?.scrollToTop();
  }, []);

  // Simplified scroll functions that actually work
  const registerAccordionLayout = useCallback((...args: any[]) => {
    // Layout registration not needed for simplified approach
  }, []);

  const findHighestAccordion = useCallback((...args: any[]) => null, []);

  const scheduleAccordionScroll = useCallback((...args: any[]) => {
    const [targetAccordionId, prevExpandedIds, nextExpandedIds] = args as [
      string | null | undefined,
      string[] | undefined,
      string[] | undefined,
    ];

    if (!targetAccordionId) return;

    const wasExpanded = Array.isArray(prevExpandedIds)
      ? prevExpandedIds.includes(targetAccordionId)
      : false;
    const isExpanded = Array.isArray(nextExpandedIds)
      ? nextExpandedIds.includes(targetAccordionId)
      : false;

    // Only scroll when an accordion is newly expanded
    if (!isExpanded || wasExpanded) return;

    // Delay to allow layout to settle so we land near the first question
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        keyboardContainerRef.current?.scrollToAccordion(targetAccordionId);
      });
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  // Initialize expanded accordions on first load (only if not already initialized)
  useEffect(() => {
    if (expandedAccordionIds.length === 0 && accordionsStructure.length > 0) {
      const initialExpanded = accordionsStructure
        .filter((acc) => acc.id.startsWith("audit-info"))
        .map((acc) => acc.id);
      setExpandedAccordionIds(initialExpanded);
    }
  }, [accordionsStructure, expandedAccordionIds.length]);

  // Handle accordion toggle with max 2 open limit when total > 2 accordions
  const handleAccordionToggle = useCallback(
    (accordionId: string) => {
      setExpandedAccordionIds((prevExpandedIds) => {
        const isCurrentlyExpanded = prevExpandedIds.includes(accordionId);
        const totalAccordions = accordionsData.length;
        let nextExpandedIds: string[] = prevExpandedIds;

        if (totalAccordions <= 2) {
          nextExpandedIds = isCurrentlyExpanded
            ? prevExpandedIds.filter((id) => id !== accordionId)
            : [...prevExpandedIds, accordionId];
        } else if (isCurrentlyExpanded) {
          nextExpandedIds = prevExpandedIds.filter((id) => id !== accordionId);
        } else if (prevExpandedIds.length < 2) {
          nextExpandedIds = [...prevExpandedIds, accordionId];
        } else {
          nextExpandedIds = [...prevExpandedIds.slice(1), accordionId];
        }

        const targetAccordionId = isCurrentlyExpanded
          ? findHighestAccordion(nextExpandedIds)
          : accordionId;

        scheduleAccordionScroll(
          targetAccordionId,
          prevExpandedIds,
          nextExpandedIds,
        );

        return nextExpandedIds;
      });
    },
    [accordionsData, findHighestAccordion, scheduleAccordionScroll],
  );

  const saveDraft = useCallback(async () => {
    try {
      setIsSavingDraft(true);
      const currentFormData = watch();

      // Check if there's any data to save
      const hasData = Object.values(currentFormData).some(
        (value) => value !== undefined && value !== null && value !== "",
      );

      if (!hasData) {
        Toast.show({
          type: "info",
          text1: "No Data to Save",
          text2: "Audit form is empty, nothing to save as draft.",
          position: "top",
        });
        return;
      }

      // Calculate audit scoring data for the new draft columns
      let formOverallStatus,
        formCriticalFailed,
        primaryAuditGroup,
        groupsStatus,
        totalGroupScore,
        averageGroupPercentage;

      try {
        formOverallStatus =
          formPercentage >= (formData?.pass_percentage || 0) ? "PASS" : "FAIL";
        formCriticalFailed = groupScores.some(
          (group) => group.critical && !group.passed,
        )
          ? 1
          : 0;

        // Get the primary audit group (first group or current stage's group)
        primaryAuditGroup = auditInfo?.id || stages[0]?.id || 0;

        // Calculate overall group status (simplified - could be 'passed', 'failed', or 'partial')
        const allGroupsPassed = groupScores.every((group) => group.passed);
        const someGroupsPassed = groupScores.some((group) => group.passed);
        groupsStatus = allGroupsPassed
          ? "passed"
          : someGroupsPassed
            ? "partial"
            : "failed";

        // Calculate total group score and percentage (for backward compatibility)
        totalGroupScore = groupScores.reduce(
          (sum, group) => sum + group.userScore,
          0,
        );
        averageGroupPercentage =
          groupScores.length > 0
            ? Math.round(
                groupScores.reduce((sum, group) => sum + group.percentage, 0) /
                  groupScores.length,
              )
            : 0;

      } catch (calcError) {
        // Use default values if calculation fails
        formOverallStatus = "PASS";
        formCriticalFailed = 0;
        primaryAuditGroup = auditInfo?.id || stages[0]?.id || 0;
        groupsStatus = "passed";
        totalGroupScore = 0;
        averageGroupPercentage = 0;
      }

      // Create enhanced form data that includes calculated scores for S3 storage
      // Exclude heavy objects like groupScores (which contain full question objects) to reduce payload size
      const enhancedFormData = {
        ...currentFormData,
        // Store only essential calculated scores in form data so they persist in S3 and can be restored
        _calculatedScores: {
          formOverallStatus: formOverallStatus,
          formPercentage: formPercentage,
          formCriticalFailed: formCriticalFailed,
          groupsStatus: groupsStatus,
          totalGroupScore: totalGroupScore,
          averageGroupPercentage: averageGroupPercentage,
          // Exclude groupScores as it contains heavy objects and can be recalculated
          // groupScores: groupScores,  // Removed to reduce payload size
          formMaxScore: formMaxScore,
          formUserScore: formUserScore,
          calculatedAt: new Date().toISOString(),
        },
      };

      const draftData = {
        formId: Number(formId),
        formTitle:
          formData?.title ||
          (formData as any)?.name ||
          currentFormData?.title ||
          "Audit Form",
        currentStageIndex: 0,
        completedStages: [],
        formData: enhancedFormData, // Use enhanced form data with calculated scores
        userId: user.id || 0,
        organizationId: (user as any).organizationId || 0,
        sourceScreen: sourceScreen || "forms",
        taskId: taskId ? Number(taskId) : undefined,
        formType: formData?.form_type,
        // Include audit scoring data for the new draft columns
        auditScoringData: {
          form_overall_status: formOverallStatus,
          form_overall_score: formPercentage,
          form_critical_failed: formCriticalFailed,
          groups_status: groupsStatus,
          group_score: totalGroupScore,
          group_percentage: `${averageGroupPercentage}%`,
          group_critical_failed: formCriticalFailed,
          audit_group: primaryAuditGroup,
          // Note: Removed groupScores and selectedScores to reduce payload size
          // They can be recalculated when loading the draft
          formMaxScore: formMaxScore,
          formUserScore: formUserScore,
        },
      };

      // Save draft directly to S3 only (no local storage for online drafts)
      // Use original draft_id if editing existing draft, otherwise generate new
      const draftIdToUse = originalDraftId || Math.floor(Math.random() * 900000000) + 100000000; // 9-digit random number

      const s3Payload: any = {
        form_id: Number(formId),
        draft_id: draftIdToUse,
        metadata: draftData,
        // Include the new audit scoring fields directly in payload
        form_overall_status: formOverallStatus,
        form_overall_score: formPercentage,
        form_critical_failed: formCriticalFailed,
        groups_status: groupsStatus,
        group_score: totalGroupScore,
        group_percentage: `${averageGroupPercentage}%`,
        group_critical_failed: formCriticalFailed,
        audit_group: primaryAuditGroup,
      };

      // Validate payload can be serialized
      try {
        JSON.stringify(s3Payload);
      } catch (serializationError) {
        Toast.show({
          type: "error",
          text1: "Save Failed",
          text2: "Form data contains invalid content that cannot be saved.",
          position: "top",
        });
        return;
      }

      const res = await api.post(SAVE_DRAFT, s3Payload);
      const serverDraftId = res?.data?.draft_id || res?.data?.id || null;
      try {
        await offlineStorageService.storeDraft({
          ...draftData,
          id: serverDraftId ? `db_draft_${serverDraftId}` : undefined,
        });
      } catch (storeErr) {
      }

      Toast.show({
        type: "success",
        text1: "Draft Saved",
        text2: "Your audit form progress and scores have been saved to cloud.",
        position: "top",
      });
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
  }, [
    formId,
    watch,
    formData,
    user,
    stages,
    auditInfo,
    passPercentage,
    formMaxScore,
    draftId,
    groupScores,
    formPercentage,
    formUserScore,
    originalDraftId,
  ]);

  const handleBackPress = useCallback(async () => {
    if (isEditButtonClicked) {
      setIsEditButtonClicked(false);
      setShowPreview(false);
      return;
    }
    if (
      submissionsDetail?.is_completed ||
      isAutoRedirecting ||
      sourceScreen === "sent" ||
      sourceScreen === "collaborative"
    ) {
      allowNavigationRef.current = true;
      setAllowNavigation(true);
      if (onClose) {
        onClose();
      } else {
        router.back();
      }
      return;
    }

    const currentFormData = watch();
    const hasData = Object.values(currentFormData).some(
      (value) => value !== undefined && value !== null && value !== "",
    );

    if (!hasData) {
      if (onClose) {
        onClose();
      } else {
        const router = require("expo-router").router;
        router.back();
      }
      return;
    }

    if (draftId && !isDirty) {
      if (onClose) {
        onClose();
      } else {
        const router = require("expo-router").router;
        router.back();
      }
      return;
    }

    setShowDraftConfirmation(true);
  }, [
    submissionsDetail?.is_completed,
    isAutoRedirecting,
    sourceScreen,
    onClose,
    watch,
    draftId,
    isDirty,
    isEditButtonClicked,
  ]);

  // Register global header options and back button for sent/view audit form screens
  const formCallbacksRef = useRef({ handleEditClick, handleShareForm, handleMakePdf, handleBackPress });
  formCallbacksRef.current = { handleEditClick, handleShareForm, handleMakePdf, handleBackPress };

  useEffect(() => {
    if (!setFormOptions) return;
    const isSent = sourceScreen === "sent";
    const optionsEnabled = isSent && submissionsDetail?.is_completed && !isEditButtonClicked;
    const { handleEditClick: onEdit, handleShareForm: onShare, handleMakePdf: onPdf, handleBackPress: onBack } = formCallbacksRef.current;

    setShowBackButton?.(isSent || !!submissionId || sourceScreen === "collaborative");
    setOnBackPress?.(() => () => { formCallbacksRef.current.handleBackPress(); });
    setFormOptions({
      enabled: !!optionsEnabled,
      onEdit: allowEditing ? onEdit : undefined,
      onShare,
      onPdf,
    });

    return () => {
      setFormOptions({ enabled: false });
      setShowBackButton?.(false);
      setOnBackPress?.(undefined);
    };
  }, [
    sourceScreen,
    submissionsDetail?.is_completed,
    isEditButtonClicked,
    allowEditing,
    submissionId,
    setFormOptions,
    setShowBackButton,
    setOnBackPress,
  ]);

  const handleSaveDraftAndBack = useCallback(async () => {
    try {
      setShowDraftConfirmation(false);
      allowNavigationRef.current = true;
      setAllowNavigation(true);
      await saveDraft();
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          const router = require("expo-router").router;
          router.back();
        }
      }, 100);
    } catch (err) {
      setShowDraftConfirmation(false);
      setAllowNavigation(false);
    }
  }, [saveDraft, onClose]);

  const handleBackWithoutSaving = useCallback(() => {
    setShowDraftConfirmation(false);
    allowNavigationRef.current = true;
    setAllowNavigation(true);
    setTimeout(() => {
      if (onClose) {
        onClose();
      } else {
        const router = require("expo-router").router;
        router.back();
      }
    }, 100);
  }, [onClose]);

  const handleCancelDraftPrompt = useCallback(() => {
    setShowDraftConfirmation(false);
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackPress();
        return true;
      },
    );

    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (allowNavigationRef.current || allowNavigation) {
        return;
      }

      // Exit edit mode instead of navigating away
      if (isEditButtonClicked) {
        e.preventDefault();
        setIsEditButtonClicked(false);
        setShowPreview(false);
        return;
      }

      if (
        submissionsDetail?.is_completed ||
        isAutoRedirecting ||
        sourceScreen === "sent" ||
        sourceScreen === "collaborative"
      ) {
        return;
      }

      const currentFormData = watch();
      const hasData = Object.values(currentFormData).some(
        (value) => value !== undefined && value !== null && value !== "",
      );

      if (!hasData) {
        return;
      }

      if (draftId && !isDirty) {
        return;
      }

      e.preventDefault();
      setShowDraftConfirmation(true);
    });

    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [
    navigation,
    handleBackPress,
    submissionsDetail?.is_completed,
    isAutoRedirecting,
    sourceScreen,
    watch,
    allowNavigation,
    draftId,
    isDirty,
    isEditButtonClicked,
  ]);

  // Helper to get field ref for sub-questions
  const getFieldRef = useCallback(
    (inputKey: string): React.RefObject<View | null> | undefined => {
      if (!fieldRefs.current[inputKey]) {
        fieldRefs.current[inputKey] = React.createRef<View>();
      }
      return fieldRefs.current[inputKey];
    },
    [],
  );

  const renderQuestionWithSeparator = useCallback(
    (question: any, index: number, totalQuestions: number) => {
      const uniqueId = question.uniqueId || question.question_uuid;
      // For collaborative mode, disable questions already answered by other team members
      // Exception: rejected groups — user needs to re-edit all answers
      const isRejectedGroup = groupDelegationStatus === "rejected";
      const questionIsEditable = isCollaborativeMode
        ? isEditable && (isRejectedGroup || !collaborativeAnsweredQuestions.has(uniqueId))
        : isEditable;
      // Check for errors using both uniqueId (new format) and question_uuid (backward compatibility)
      const hasError =
        !!errors[uniqueId] ||
        !!errors[question.question_uuid] ||
        !!validationErrors[uniqueId] ||
        !!validationErrors[getQuestionKey(question)];

      // Handle follow-up task rendering
      if (question.question_type === "followup_task") {
        // Check if this web-defined task has meaningful configured content
        const title = question.title;
        const description = question.description;
        const formTitle = question.assigned_form_title || question.assign_form_name || "";
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
          temporaryFollowUpTasks.some(
            (task) => task.parentQuestionUuid === question._parentQuestion,
          );

        // Check if this follow-up task allows mobile creation (followup_toggle=true)
        const canCreateMobileTask = question.followup_toggle;
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
                    <Text style={styles.followUpTaskValue}>
                      {formTitle}
                    </Text>

                    <Text style={styles.followUpTaskLabel}>Deadline:</Text>
                    <Text style={styles.followUpTaskValue}>
                      {question.deadline} days after form submission
                    </Text>

                    <Text style={styles.followUpTaskLabel}>Assigned to:</Text>
                    <Text style={styles.followUpTaskValue}>
                      {(() => {
                        // Resolve user names from IDs
                        const allAssigneeNames = [];

                        // Add user names from assign_user_ids
                        if (
                          question.assign_user_ids &&
                          Array.isArray(question.assign_user_ids)
                        ) {
                          const userNames = question.assign_user_ids.map(
                            (userId: number) => {
                              const user = users.find((u) => u.id === userId);
                              return user
                                ? `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                                    user.username
                                : `User ${userId}`;
                            },
                          );
                          allAssigneeNames.push(...userNames);
                        }

                        // Add group names from assign_group_ids
                        if (
                          question.assign_group_ids &&
                          Array.isArray(question.assign_group_ids)
                        ) {
                          const groupNames = question.assign_group_ids.map(
                            (groupId: number) => {
                              const group = groups.find((g) => g.id === groupId);
                              return group ? group.name : `Group ${groupId}`;
                            },
                          );
                          if (groupNames.length > 0) {
                            allAssigneeNames.push(
                              `Groups: ${groupNames.join(", ")}`,
                            );
                          }
                        }

                        // Add location leader names from assign_leader_ids
                        if (
                          question.assign_leader_ids &&
                          Array.isArray(question.assign_leader_ids)
                        ) {
                          const leaderNames = question.assign_leader_ids.map(
                            (leaderId: number) => {
                              const leader = locationLeaders.find(
                                (l) => l.id === leaderId,
                              );
                              return leader
                                ? `${leader.first_name || ""} ${leader.last_name || ""}`.trim() ||
                                    leader.username
                                : `Leader ${leaderId}`;
                            },
                          );
                          if (leaderNames.length > 0) {
                            allAssigneeNames.push(
                              `Leaders: ${leaderNames.join(", ")}`,
                            );
                          }
                        }

                        // Return resolved names or fallback
                        if (allAssigneeNames.length > 0) {
                          return allAssigneeNames.join(", ");
                        } else if (question.assign_to === "form_submitter") {
                          return "Form Submitter";
                        } else {
                          return "Not specified";
                        }
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

                {/* Add Followup Task Button - shows below followup tasks when canCreateMobileTask is true and NOT in audit info */}
                {/* {canCreateMobileTask && !question.question_uuid?.includes('audit-info') && (
                <TouchableOpacity
                  style={styles.addTaskButton}
                  onPress={() => setShowTaskDialog(true)}
                >
                  <MaterialIcons name="add" size={16} color="#fff" />
                  <Text style={styles.addTaskButtonText}>Add Followup Task</Text>
                </TouchableOpacity>
              )} */}
              </View>
            )}
          </View>
        );

        if (hasEmptyContent && hasTemporaryTaskForParent) return null;

        // Only check visibility for follow-up tasks, regular questions are always visible
        if (
          question.question_type === "followup_task" &&
          !visibleQuestions.has(getQuestionKey(question))
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

      const isCollaborativelyLocked = isCollaborativeMode && !isRejectedGroup && collaborativeAnsweredQuestions.has(uniqueId);
      const collaborativeLockedBadge = isCollaborativelyLocked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
          <MaterialIcons name="lock" size={12} color="#9CA3AF" />
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>Answered by teammate</Text>
        </View>
      ) : null;
      const collaborativeFadedStyle = isCollaborativelyLocked
        ? { opacity: 0.5, backgroundColor: '#F3F4F6', borderRadius: 8, overflow: 'hidden' as const }
        : null;

      const questionComponent =
        question.question_type === "table" ? (
          <View
            key={uniqueId}
            ref={(ref) => {
              if (ref)
                fieldRefs.current[uniqueId] = { current: ref };
            }}
            style={collaborativeFadedStyle}
          >
            {collaborativeLockedBadge}
            <TableField
              question={question}
              control={control}
              errors={errors}
              isCompleted={isCompleted}
              isEditable={questionIsEditable}
              hasError={hasError}
            />
          </View>
        ) : (
          <View
            key={uniqueId}
            ref={(ref) => {
              if (ref)
                fieldRefs.current[uniqueId] = { current: ref };
            }}
            style={collaborativeFadedStyle}
          >
            {collaborativeLockedBadge}
            <FormField
              question={question}
              control={control}
              errors={errors}
              isCompleted={isCompleted}
              isEditable={questionIsEditable}
              allQuestions={allQuestions}
              setValue={setValue}
              updateScore={updateScore}
              hasError={hasError}
              onFocus={handleInputFocus}
              focusedInputKey={focusedInputKey}
              getFieldRef={getFieldRef}
              validationErrors={validationErrors}
              plannerLocationId={plannerLocationId}
              plannerLocationName={plannerLocation}
              defaultExpanded={
                question.question_type === "multiple_choice" ||
                question.question_type === "checkboxes" ||
                question.question_type === "dropdown"
                  ? false
                  : undefined
              }
              forceExpanded={
                (question.question_type === "audit" &&
                  autoExpandAuditQuestionKey === getQuestionKey(question)) ||
                ((question.question_type === "multiple_choice" ||
                  question.question_type === "checkboxes") &&
                  autoExpandMultipleChoiceQuestionKey ===
                    getQuestionKey(question)) ||
                (question.question_type === "dropdown" &&
                  autoExpandDropdownQuestionKey === getQuestionKey(question))
              }
              container={
                keyboardContainerRef as React.RefObject<
                  import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef
                >
              }
            />
          </View>
        );

      // Add separator line after each question except the last one
      if (index < totalQuestions - 1) {
        return (
          <React.Fragment key={`${uniqueId}-wrapper`}>
            {questionComponent}
            <View style={styles.questionSeparator} />
          </React.Fragment>
        );
      }

      return questionComponent;
    },
    [
      control,
      errors,
      isCompleted,
      isEditable,
      allQuestions,
      setValue,
      updateScore,
      handleInputFocus,
      focusedInputKey,
      validationErrors,
      getFieldRef,
      visibleQuestions,
      collapsedFollowUpTasks,
      temporaryFollowUpTasks,
      autoExpandAuditQuestionKey,
      autoExpandMultipleChoiceQuestionKey,
      autoExpandDropdownQuestionKey,
      isCollaborativeMode,
      collaborativeAnsweredQuestions,
      groupDelegationStatus,
    ],
  );

  const countMissingRequiredFields = useCallback(
    (formValues: any) => Object.keys(collectMissingRequiredErrors(formValues)).length,
    [collectMissingRequiredErrors],
  );

  const handlePreviewPress = async () => {
    setShowPreviewOverlay(true);
    try {
      if (allRequiredFilledLocal) {
        setValidationErrors({});
        setShowValidationBanner(false);
        setAutoExpandAuditQuestionKey(null);
        setAutoExpandMultipleChoiceQuestionKey(null);
        setAutoExpandDropdownQuestionKey(null);
        setShowPreview(true);
      } else {
        setValidationErrors({});
        setShowValidationBanner(false);
        setAutoExpandAuditQuestionKey(null);
        setAutoExpandMultipleChoiceQuestionKey(null);
        setAutoExpandDropdownQuestionKey(null);
        const errorMap: Record<string, boolean> =
          collectMissingRequiredErrors(allValues);
        const groupsToExpand = new Set([1]);

        const auditInfoQuestions = (auditInfo as any)?.questions || [];

        // Helper to check if a question or its sub-questions have errors
        const hasErrorsIncludingSubQuestions = (question: Question): boolean => {
          if (errorMap[getQuestionKey(question)]) return true;

          // Check if any sub_question under this question has errors (for audit questions)
          if (question.sub_questions?.length) {
            if (
              question.sub_questions.some(
                (sq: Question) => errorMap[getQuestionKey(sq)],
              )
            ) {
              return true;
            }
          }

          // Check if any logic question under this question has errors
          if (question.logics?.length) {
            for (const logic of question.logics) {
              if (
                logic.logic_questions?.some(
                  (lq: Question) => errorMap[getQuestionKey(lq)],
                )
              ) {
                return true;
              }
            }
          }
          return false;
        };

        const hasAuditInfoMissingFields = auditInfoQuestions.some((q: Question) =>
          hasErrorsIncludingSubQuestions(q),
        );
        if (hasAuditInfoMissingFields) {
          groupsToExpand.add(1);
          const auditInfoAccordionId = auditInfo
            ? `audit-info-${(auditInfo as any).id}`
            : null;
          if (auditInfoAccordionId) {
            setExpandedAccordionIds((prev) =>
              prev.includes(auditInfoAccordionId)
                ? prev
                : [...prev, auditInfoAccordionId],
            );
          }
        }

        stages.forEach((stage) => {
          const hasMissingRequiredFields = (stage.questions || []).some(
            (q: Question) => hasErrorsIncludingSubQuestions(q),
          );
          if (hasMissingRequiredFields) {
            groupsToExpand.add(stage.id);
          }
        });

        setExpandedAuditGroups(groupsToExpand);
        setValidationErrorCount(Object.keys(errorMap).length);
        setShowValidationBanner(true);
        setValidationErrors(errorMap);
        setBannerDismissed(false); // Reset banner dismissal when preview shows validation errors

        setTimeout(() => {
          keyboardContainerRef.current?.scrollToTop();
        }, 100);
      }
    } finally {
      setShowPreviewOverlay(false);
    }
  };

  const handleAssignTaskPress = async () => {
    setShowAssigningOverlay(true);
    try {
      const auditFormData = JSON.stringify({
        auditGroups: stages,
        auditInfo: auditInfo,
        formId,
        formType: "audit",
        currentFormValues: allValues, // Pass current form responses for logic evaluation
        visibleQuestions: Array.from(visibleQuestions), // Pass currently visible questions
      });
      const bulkAssignKey = `audit_bulk_assign_formData_${formId}`;
      let stored = false;
      try {
        await SecureStoreService.set(bulkAssignKey, auditFormData);
        stored = true;
      } catch (storeError) {
      }
      const bulkAssignRoute = stored
        ? `/forms/audit-bulk-assign-task?bulkAssignKey=${encodeURIComponent(bulkAssignKey)}`
        : `/forms/audit-bulk-assign-task?formData=${encodeURIComponent(auditFormData)}&bulkAssignKey=${encodeURIComponent(bulkAssignKey)}`;
      router.push(bulkAssignRoute as any);
    } finally {
      setShowAssigningOverlay(false);
    }
  };


  const handleValidationBannerClick = useCallback(() => {
    // Find the first error in VISUAL order (not object key order)
    // This ensures we navigate to errors in the order they appear in the form
    let firstErrorKey: string | undefined = undefined;
    let targetGroupId: number | undefined = undefined;
    let isInAuditInfo = false;
    let isSubQuestion = false;
    let parentQuestionUuid: string | undefined = undefined;
    let targetAuditQuestionKey: string | undefined = undefined;
    let targetMultipleChoiceQuestionKey: string | undefined = undefined;
    let targetDropdownQuestionKey: string | undefined = undefined;

    // Build a set of keys to ignore for title/description (defensive even if errors map contains them)
    const titleDescriptionKeys = new Set<string>();
    const allQuestionsForKeyMap = [
      ...((auditInfo as any)?.questions || []),
      ...stages.flatMap((stage) => stage.questions || []),
    ];
    allQuestionsForKeyMap.forEach((q: Question) => {
      if (q.question_type === "title_and_description") {
        const key = getQuestionKey(q);
        if (key) titleDescriptionKeys.add(key);
        if (q.question_uuid) titleDescriptionKeys.add(q.question_uuid);
      }
    });

    const filteredValidationErrors: Record<string, boolean> = {};
    Object.keys(validationErrors).forEach((key) => {
      if (!titleDescriptionKeys.has(key)) {
        filteredValidationErrors[key] = true;
      }
    });

    // Helper to check if a question has an error (ignore title/description)
    const hasError = (question: Question) => {
      if (question.question_type === "title_and_description") return false;
      return filteredValidationErrors[getQuestionKey(question)];
    };

    // Get all visible sub-questions and logic questions using the same function as validation
    const visibleNestedQuestions = collectVisibleLogicQuestions(
      allQuestions,
      allValues,
    );
    const visibleNestedUuids = new Set(
      visibleNestedQuestions.map((q) => getQuestionKey(q)),
    );

    // Helper to find first error in a question and its nested questions
    const findFirstErrorInQuestion = (
      q: any,
      groupId: number,
      inAuditInfo: boolean,
    ): boolean => {
      // Check the question itself
      if (hasError(q)) {
        firstErrorKey = getQuestionKey(q);
        targetGroupId = groupId;
        isInAuditInfo = inAuditInfo;
        isSubQuestion = false;
        parentQuestionUuid = undefined;
        if (q.question_type === "audit") {
          targetAuditQuestionKey = getQuestionKey(q);
        }
        if (
          q.question_type === "multiple_choice" ||
          q.question_type === "checkboxes"
        ) {
          targetMultipleChoiceQuestionKey = getQuestionKey(q);
        }
        if (q.question_type === "dropdown") {
          targetDropdownQuestionKey = getQuestionKey(q);
        }
        return true;
      }

      // Check sub_questions (for audit questions) - only if they're visible/collected
      if (q.sub_questions?.length) {
        for (const sq of q.sub_questions) {
          // Only check sub_questions that are in the visible set (from collectVisibleLogicQuestions)
          if (
            visibleNestedUuids.has(getQuestionKey(sq)) &&
            hasError(sq)
          ) {
            firstErrorKey = getQuestionKey(sq);
            targetGroupId = groupId;
            isInAuditInfo = inAuditInfo;
            isSubQuestion = true;
            parentQuestionUuid = q.question_uuid;
            if (q.question_type === "audit") {
              targetAuditQuestionKey = getQuestionKey(q);
            }
            if (
              q.question_type === "multiple_choice" ||
              q.question_type === "checkboxes"
            ) {
              targetMultipleChoiceQuestionKey = getQuestionKey(q);
            }
            if (q.question_type === "dropdown") {
              targetDropdownQuestionKey = getQuestionKey(q);
            }
            return true;
          }
        }
      }

      // Check logic_questions - only if they're visible/collected
      if (q.logics?.length) {
        for (const logic of q.logics) {
          if (logic.logic_questions?.length) {
            for (const lq of logic.logic_questions) {
              // Only check logic_questions that are in the visible set
              if (
                visibleNestedUuids.has(getQuestionKey(lq)) &&
                hasError(lq)
              ) {
                firstErrorKey = getQuestionKey(lq);
                targetGroupId = groupId;
                isInAuditInfo = inAuditInfo;
                isSubQuestion = true;
                parentQuestionUuid = q.question_uuid;
                if (q.question_type === "audit") {
                  targetAuditQuestionKey = getQuestionKey(q);
                }
                if (
                  q.question_type === "multiple_choice" ||
                  q.question_type === "checkboxes"
                ) {
                  targetMultipleChoiceQuestionKey = getQuestionKey(q);
                }
                if (q.question_type === "dropdown") {
                  targetDropdownQuestionKey = getQuestionKey(q);
                }
                return true;
              }
            }
          }
        }
      }

      return false;
    };

    // Search in visual order: audit info first, then stages
    const auditInfoQuestions = (auditInfo as any)?.questions || [];
    const auditInfoId = (auditInfo as any)?.id || 1;

    // Check audit info questions first
    for (const q of auditInfoQuestions) {
      if (findFirstErrorInQuestion(q, auditInfoId, true)) {
        break;
      }
    }

    // If no error found in audit info, check stages
    if (!firstErrorKey) {
      for (const stage of stages) {
        let found = false;
        for (const q of stage.questions || []) {
          if (findFirstErrorInQuestion(q, stage.id, false)) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    if (firstErrorKey) {
      setAutoExpandAuditQuestionKey(targetAuditQuestionKey || null);
      setAutoExpandMultipleChoiceQuestionKey(
        targetMultipleChoiceQuestionKey || null,
      );
      setAutoExpandDropdownQuestionKey(targetDropdownQuestionKey || null);
      // Expand the group if needed
      if (
        targetGroupId &&
        !isInAuditInfo &&
        !expandedAuditGroups.has(targetGroupId)
      ) {
        const groupsToExpandSet = new Set(expandedAuditGroups);
        groupsToExpandSet.add(targetGroupId);
        setExpandedAuditGroups(groupsToExpandSet);
      }
      if (targetGroupId && isInAuditInfo) {
        const auditInfoAccordionId = `audit-info-${targetGroupId}`;
        setExpandedAccordionIds((prev) =>
          prev.includes(auditInfoAccordionId)
            ? prev
            : [...prev, auditInfoAccordionId],
        );
      }

      // Wait for group expansion, then scroll directly to field
      setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          // Try to get the direct field ref first (works for main questions and sub-questions)
          let fieldRef = firstErrorKey
            ? fieldRefs.current[firstErrorKey]
            : null;
          let scrollTarget = firstErrorKey;

          // If sub-question ref not available, try parent question as fallback
          if (!fieldRef?.current && parentQuestionUuid) {
            fieldRef = fieldRefs.current[parentQuestionUuid];
            scrollTarget = parentQuestionUuid;
          }

          if (
            fieldRef?.current &&
            typeof fieldRef.current.measureInWindow === "function"
          ) {

            fieldRef.current.measureInWindow(
              (x: number, y: number, width: number, height: number) => {

                if (y !== undefined && y !== null && height > 0) {
                  // Calculate scroll needed to position field at 25% from top of screen
                  const screenHeight = Dimensions.get("window").height;
                  const targetScreenY = screenHeight * 0.25;
                  const scrollDelta = y - targetScreenY;

                  keyboardContainerRef.current?.scrollByOffset(scrollDelta);
                } else {
                  // Fallback to accordion scroll if measurement fails
                  keyboardContainerRef.current?.scrollToAccordion(
                    isInAuditInfo
                      ? `audit-info-${targetGroupId}`
                      : `stage-${targetGroupId}`,
                  );
                }
              },
            );
          } else {
            // Fallback to accordion scroll if field ref not available
            keyboardContainerRef.current?.scrollToAccordion(
              isInAuditInfo
                ? `audit-info-${targetGroupId}`
                : `stage-${targetGroupId}`,
            );
          }
        });
      }, 350);
    }
  }, [
    validationErrors,
    expandedAuditGroups,
    stages,
    auditInfo,
    allQuestions,
    allValues,
  ]);

  useEffect(() => {
    if (Object.keys(validationErrors).length === 0) {
      return;
    }

    const fieldsWithErrors = Object.keys(validationErrors);
    const clearedFields: string[] = [];

    // Get all visible logic questions
    const visibleLogicQuestions = collectVisibleLogicQuestions(
      allQuestions,
      allValues,
    );
    const allQuestionsIncludingLogic = [
      ...allQuestions,
      ...visibleLogicQuestions,
    ];

    for (const questionUuid of fieldsWithErrors) {
      // Find question by uniqueId first, then fallback to question_uuid
      const question = allQuestionsIncludingLogic.find((q) => {
        const key = getQuestionKey(q);
        return key === questionUuid || q.question_uuid === questionUuid;
      });
      if (!question || !question.is_required) continue;

      // Check value using uniqueId first (new format), then question_uuid (backward compatibility)
      const uniqueId = (question as any).uniqueId;
      const primaryKey = uniqueId || question.question_uuid;
      const value =
        (primaryKey && allValues[primaryKey]) || allValues[question.question_uuid];

      // Check if the value is NOT empty (i.e., now valid)
      if (!isValueEmpty(value, question.question_type)) {
        // Clear both the stored error key and the raw question_uuid (if present)
        clearedFields.push(questionUuid);
        if (uniqueId && uniqueId !== questionUuid) {
          clearedFields.push(uniqueId);
        }
        if (question.question_uuid !== questionUuid) {
          clearedFields.push(question.question_uuid);
        }
      }
    }

    if (clearedFields.length > 0) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        clearedFields.forEach((field) => delete newErrors[field]);
        return newErrors;
      });
    }
  }, [allValues, validationErrors, allQuestions, getQuestionKey]);

  useEffect(() => {
    const currentErrorCount = Object.keys(validationErrors).length;

    if (currentErrorCount !== validationErrorCount) {
      setValidationErrorCount(currentErrorCount);

      // Reset banner dismissal when errors are cleared and then new errors appear
      if (currentErrorCount > 0 && bannerDismissed) {
        setBannerDismissed(false);
      }
    }

    if (currentErrorCount === 0 && showValidationBanner) {
      setShowValidationBanner(false);
    }
  }, [
    validationErrors,
    validationErrorCount,
    showValidationBanner,
    bannerDismissed,
  ]);

  // Find the location question from audit info or stages
  const locationQuestion = useMemo(() => {
    return allQuestions.find((q: any) => q.question_type === "location");
  }, [allQuestions]);

  // Watch the location question's answer to get the selected location ID
  const locationFieldName = (locationQuestion as any)?.uniqueId || (locationQuestion as any)?.question_uuid || "";
  const locationAnswerValue = locationFieldName ? (allValues as any)[locationFieldName] : undefined;

  // Use plannerLocationId if available, otherwise use the location question answer
  const effectiveLocationId = plannerLocationId || (locationAnswerValue ? String(locationAnswerValue) : undefined);

  // Fetch previous submission answers for the same form + location
  const { previousSubmissions: previousSubmissionsData } = usePreviousSubmissions({
    formId,
    locationId: effectiveLocationId,
    excludeSubmissionId: submissionId,
    enabled: !isViewMode && !!effectiveLocationId,
  });

  if (loading || loadingDraft) {
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

  return (
    <PreviousSubmissionsContext.Provider value={previousSubmissionsData}>
    <View style={styles.screenContainer}>
      <Text style={styles.formTitle}>{formData?.title || "Audit Form"}</Text>

      {/* Sticky Validation Error Banner */}
      {validationErrorCount > 0 && !bannerDismissed && (
        <View style={styles.stickyBannerContainer}>
          <ValidationErrorBanner
            errorCount={validationErrorCount}
            visible={true}
            onPress={handleValidationBannerClick}
            onClose={() => setBannerDismissed(true)}
          />
        </View>
      )}

      <KeyboardAwareContainer
        ref={keyboardContainerRef}
        contentContainerStyle={StyleSheet.flatten([
          styles.formContainer,
          validationErrorCount > 0 &&
            !bannerDismissed &&
            styles.formContainerWithBanner,
        ])}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2196f3"
            colors={["#2196f3"]}
            progressViewOffset={80}
          />
        }
      >
        <FormContainerContext.Provider
          value={
            keyboardContainerRef as React.RefObject<
              import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef
            >
          }
        >
          {((submissionsDetail?.is_completed && !isEditButtonClicked && !isRejectedCollabGroup) ||
            (sourceScreen === "sent" && auditsummarydata && !isEditButtonClicked)) && (
            <AuditSummaryScreen
              groupScores={groupScores}
              formMaxScore={formMaxScore}
              formUserScore={formUserScore}
              passPercentage={passPercentage}
              auditsummarydata={auditsummarydata}
            />
          )}

          {accordionsData.map((accordionData) => (
            <AuditAccordion
              key={accordionData.id}
              title={accordionData.title}
              questions={accordionData.questions}
              groupScore={accordionData.groupScore}
              passPercentage={passPercentage}
              groupScores={groupScores}
              auditGroupId={accordionData.auditGroupId}
              accordionId={accordionData.id}
              isExpanded={expandedAccordionIds.includes(accordionData.id)}
              onToggle={() => handleAccordionToggle(accordionData.id)}
              containerRef={keyboardContainerRef}
              onMeasure={registerAccordionLayout}
              auditsummarydata={auditsummarydata}
            >
              {!submitting ? (
                (() => {
                  return (
                    <>
                      {accordionData.questions?.map(
                        (question: any, questionIndex: number) => {
                          // Get visible follow-up tasks for this specific question
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
                        const hasTemporaryTask = temporaryFollowUpTasks.some(task => task.parentQuestionUuid === question.question_uuid);                          return (
                            <React.Fragment key={question.question_uuid}>
                              {/* Render the main question */}
                              {renderQuestionWithSeparator(
                                question,
                                questionIndex,
                                accordionData.questions.length,
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
                              {temporaryFollowUpTasks
                                .filter(
                                  (task) =>
                                    task.parentQuestionUuid ===
                                    question.question_uuid,
                                )
                                .map((task: any, taskIndex: number) => (
                                  <View
                                    key={`temp-task-${task.parentQuestionUuid}-${task.created_at}`}
                                    style={styles.followUpTaskContainer}
                                  >
                                    <View style={styles.followUpTaskHeader}>
                                      <MaterialIcons
                                        name="assignment"
                                        size={20}
                                        color="#007AFF"
                                      />
                                      <Text style={styles.followUpTaskTitle}>
                                        Follow-Up Task
                                      </Text>
                                    </View>
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
                                        {task.description}
                                      </Text>

                                      <Text style={styles.followUpTaskLabel}>
                                        Deadline:
                                      </Text>
                                      <Text style={styles.followUpTaskValue}>
                                        {task.deadline} days after form
                                        submission
                                      </Text>

                                  <Text style={styles.followUpTaskLabel}>Assigned to:</Text>
                                  <Text style={styles.followUpTaskValue}>
                                    {(() => {
                                      const userNames = Array.isArray(task.assign_user_names)
                                        ? task.assign_user_names
                                        : [];
                                      const groupNames = Array.isArray(task.assign_group_names)
                                        ? task.assign_group_names
                                        : [];
                                      const labels = [...userNames, ...groupNames].filter(Boolean);
                                      if (labels.length > 0) return labels.join(", ");
                                      if (task.assign_to === "form_submitter") return "Form Submitter";
                                      return "Not specified";
                                    })()}
                                  </Text>
                                </View>
                              </View>
                            ))}
                            {/* Add/Edit Follow-Up Task Button - show only when a follow-up task is visible */}
                            {(() => {
                              if (isViewMode || isFromNotification) return null;
                              if (questionFollowUpTasks.length === 0) return null;
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
                                (Array.isArray(followUpTask?.assign_leader_ids) &&
                                  followUpTask.assign_leader_ids.length > 0) ||
                                followUpTask?.assign_to === "form_submitter" ||
                                (Array.isArray(followUpTask?.task_close_questions) &&
                                  followUpTask.task_close_questions.length > 0)
                              );
                              const shouldUseEditFollowUpFlow =
                                hasAssignedFormForButton ||
                                hasWebFollowUpDataForButton;
                              const shouldShowButton =
                                shouldUseEditFollowUpFlow ||
                                (!shouldUseEditFollowUpFlow && !hasTemporaryTask);
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
                                            webGroupIds =
                                              JSON.parse(webGroupIds);
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
                                        const webUserNames = users
                                          .filter((u) =>
                                            webUserIds.includes(u.id),
                                          )
                                          .map(
                                            (u) =>
                                              `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                                              u.username,
                                          );
                                        const webGroupNames = groups
                                          .filter((g) =>
                                            webGroupIds.includes(g.id),
                                          )
                                          .map((g) => g.name);
                                        const webLeaderNames = locationLeaders
                                          .filter((l) =>
                                            webLeaderIds.includes(l.id),
                                          )
                                          .map(
                                            (l) =>
                                              `${l.first_name || ""} ${l.last_name || ""}`.trim() ||
                                              l.username,
                                          );

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
                                        setCurrentTaskLogicFollowUpId(null);
                                        setCurrentTaskParentQuestionId(null);
                                        currentTaskLogicFollowUpIdRef.current =
                                          null;
                                        currentTaskParentQuestionIdRef.current =
                                          null;
                                      } else {

                                        setCurrentTaskQuestionUuid(
                                          question.question_uuid,
                                        );
                                        setIsEditingWebTask(false);
                                        setCurrentEditingTask(null);
                                        // Fix: Store LogicFollowUp id and parent Question id so backend gets correct
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
                                      name="add-task"
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
                        },
                      ) || <Text>No questions</Text>}
                    </>
                  );
                })()
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196f3" />
                </View>
              )}
            </AuditAccordion>
          ))}

          {__DEV__ && (
            <View style={{ padding: 10, backgroundColor: "#f0f0f0" }}>
              <Text>
                Debug - Audit Info: {auditInfo ? "Present" : "Missing"}
              </Text>
              <Text>
                Questions: {(auditInfo as any)?.questions?.length || 0}
              </Text>
              <Text>Form Type: {formData?.form_type}</Text>
              <Text>Total Accordions: {accordionsData.length}</Text>
              <Text>Expanded: {expandedAccordionIds.join(", ")}</Text>
            </View>
          )}

          {showPreview && (
            <AuditSummaryScreen
              groupScores={groupScores}
              formMaxScore={formMaxScore}
              formUserScore={formUserScore}
              passPercentage={passPercentage}
              auditsummarydata={auditsummarydata}
            />
          )}

          {showPreview && false && (
            <View style={styles.tripleButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: "#2196f3" },
                  styles.stackedButton,
                ]}
                onPress={() => {
                  setShowPreview(false);

                  const groupsToExpand = new Set([1]);

                  stages.forEach((stage) => {
                    const hasMissingRequiredFields = (
                      stage.questions || []
                    ).some((question: any) => {
                      if (!question.is_required) return false;

                      const value = allValues[getQuestionKey(question)];
                      let isMissing = false;

                      switch (question.question_type) {
                        case "short_answer":
                        case "long_answer":
                          return (
                            !value ||
                            (typeof value === "string" && value.trim() === "")
                          );
                        case "dropdown":
                        case "division":
                        case "sub_division":
                        case "location":
                        case "user":
                          return (
                            !value || typeof value !== "object" || !value?.id
                          );
                        case "multiple_choice":
                        case "checkboxes":
                          return !Array.isArray(value) || value.length === 0;
                        case "date":
                        case "time":
                        case "datetime":
                          return !value;
                        case "linear_scale":
                          return value === undefined || value === null;
                        case "upload_image":
                        case "upload_video":
                        case "upload_audio":
                        case "upload_file":
                          return (
                            !value ||
                            (typeof value === "string" &&
                              value.split("|").filter(Boolean).length === 0)
                          );
                        case "audit":
                        case "signature":
                          return !value;
                        default:
                          return false;
                      }
                    });

                    if (hasMissingRequiredFields) {
                      groupsToExpand.add(stage.id);
                    }
                  });

                  setExpandedAuditGroups(groupsToExpand);
                }}
              >
                <Text style={styles.buttonText}>Editttt</Text>
              </TouchableOpacity>
              {/* Audit Bulk Assign Button - Only for audit forms, doesn't affect standard forms */}
              {(() => {
                const hasAnyFollowUpTasks = hasFollowUpTasks;

                return (
                  hasAnyFollowUpTasks && (
                    <TouchableOpacity
                      style={[
                        styles.button,
                        { backgroundColor: "#FF9500" },
                        styles.stickyFooterGridButton,
                      ]}
                      onPress={handleAssignTaskPress}
                    >
                      <MaterialIcons
                        name="assignment"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={styles.buttonText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        Assign Task
                      </Text>
                    </TouchableOpacity>
                  )
                );
              })()}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  submitting && styles.disabledButton,
                  styles.stackedButton,
                ]}
                onPress={async () => {
                  if (submitInFlightRef.current) {
                    return;
                  }
                  submitInFlightRef.current = true;

                  if (!allRequiredFilledLocal) {
                    const errorMap =
                      collectMissingRequiredErrors(allValues);
                    setValidationErrorCount(Object.keys(errorMap).length);
                    setShowValidationBanner(true);
                    setValidationErrors(errorMap);
                    setShowPreview(false);
                    Toast.show({
                      type: "error",
                      text1: "Validation Error",
                      text2:
                        "Please fill all required fields before submitting.",
                      position: "top",
                    });
                    submitInFlightRef.current = false;
                    return;
                  }

                  setShowSubmittingOverlay(true);
                  setIsAutoRedirecting(true);
                  allowNavigationRef.current = true;
                  setAllowNavigation(true);

                  try {
                    // Submit the form using the hook's handleSubmit.
                    // In collaborative mode, bypass RHF's built-in per-field "required"
                    // validation (it doesn't know about collaboratively-locked/teammate-
                    // answered fields) and rely on our own allRequiredFilledLocal check above.
                    shouldTriggerFollowupsRef.current = true;
                    if (isCollaborativeMode) {
                      // Exclude locked/teammate-answered questions from the
                      // submission payload to prevent 409 conflicts on the
                      // backend.  Only send answers this user actually filled in.
                      const submitValues = { ...allValues };
                      for (const lk of collaborativeAnsweredRef.current) {
                        delete submitValues[lk];
                      }
                      await onSubmit(submitValues);
                    } else {
                      await handleSubmit(onSubmit)();
                      forceClose();
                    }
                  } catch (error: any) {
                    shouldTriggerFollowupsRef.current = false;
                    hasClosedRef.current = false;
                    setShowSubmittingOverlay(false);
                    setIsAutoRedirecting(false);
                    allowNavigationRef.current = false;
                    setAllowNavigation(false);
                    setShowPreview(false);
                    const errData = error?.data || error?.response?.data;
                    const backendError =
                      errData?.error ||
                      (typeof errData === "string" ? errData : null) ||
                      error?.message ||
                      "An error occurred during submission";
                    Toast.show({
                      type: "error",
                      text1: "Submission Failed",
                      text2: backendError,
                      position: "top",
                    });
                  } finally {
                    submitInFlightRef.current = false;
                    // Reset navigation flags if submission didn't succeed
                    // (onSubmit catches errors internally and doesn't throw,
                    // so the catch block above won't fire for submit errors)
                    if (!hasClosedRef.current) {
                      allowNavigationRef.current = false;
                      setAllowNavigation(false);
                    }
                    // Always hide overlay if onSubmit didn't set submitting to true
                    // (handles case where handleSubmit validation fails silently)
                    setTimeout(() => {
                      setShowSubmittingOverlay(false);
                      setIsAutoRedirecting(false);
                    }, 100);
                  }
                }}
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
                  <Text style={styles.buttonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Spacer to allow scrolling past sticky footer */}
          <View style={{ height: 120 }} />
        </FormContainerContext.Provider>
      </KeyboardAwareContainer>

      {!isCompleted && (
        <View style={styles.stickyFooter}>
          {showPreview ? (
            <View style={styles.stickyFooterRow}>
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: "#2196f3" },
                  styles.stickyFooterButton,
                ]}
                onPress={() => {
                  setShowPreview(false);

                  const groupsToExpand = new Set([1]);

                  stages.forEach((stage) => {
                    const hasMissingRequiredFields = (
                      stage.questions || []
                    ).some((question: any) => {
                      if (!question.is_required) return false;

                      const value = allValues[getQuestionKey(question)];
                      let isMissing = false;

                      switch (question.question_type) {
                        case "short_answer":
                        case "long_answer":
                          return (
                            !value ||
                            (typeof value === "string" && value.trim() === "")
                          );
                        case "dropdown":
                        case "division":
                        case "sub_division":
                        case "location":
                        case "user":
                          return (
                            !value || typeof value !== "object" || !value?.id
                          );
                        case "multiple_choice":
                        case "checkboxes":
                          return !Array.isArray(value) || value.length === 0;
                        case "date":
                        case "time":
                        case "datetime":
                          return !value;
                        case "linear_scale":
                          return value === undefined || value === null;
                        case "upload_image":
                        case "upload_video":
                        case "upload_audio":
                        case "upload_file":
                          return (
                            !value ||
                            (typeof value === "string" &&
                              value.split("|").filter(Boolean).length === 0)
                          );
                        case "audit":
                        case "signature":
                          return !value;
                        default:
                          return false;
                      }
                    });

                    if (hasMissingRequiredFields) {
                      groupsToExpand.add(stage.id);
                    }
                  });

                  setExpandedAuditGroups(groupsToExpand);
                }}
              >
                <MaterialIcons name="edit" size={18} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              {/* Audit Bulk Assign Button - Only for audit forms, doesn't affect standard forms */}
              {(() => {
                const hasAnyFollowUpTasks = hasFollowUpTasks;

                return (
                  hasAnyFollowUpTasks && (
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
                  )
                );
              })()}
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
              ) : null}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  submitting && styles.disabledButton,
                  styles.stickyFooterButton,
                ]}
                onPress={async () => {
                  if (submitInFlightRef.current) {
                    return;
                  }
                  submitInFlightRef.current = true;

                  if (!allRequiredFilledLocal) {
                    const errorMap =
                      collectMissingRequiredErrors(allValues);
                    setValidationErrorCount(Object.keys(errorMap).length);
                    setShowValidationBanner(true);
                    setValidationErrors(errorMap);
                    setShowPreview(false);
                    Toast.show({
                      type: "error",
                      text1: "Validation Error",
                      text2:
                        "Please fill all required fields before submitting.",
                      position: "top",
                    });
                    submitInFlightRef.current = false;
                    return;
                  }

                    setShowSubmittingOverlay(true);
                    setIsAutoRedirecting(true);
                  allowNavigationRef.current = true;
                  setAllowNavigation(true);

                  try {
                    shouldTriggerFollowupsRef.current = true;
                    if (isCollaborativeMode) {
                      const submitValues = { ...allValues };
                      for (const lk of collaborativeAnsweredRef.current) {
                        delete submitValues[lk];
                      }
                      await onSubmit(submitValues);
                    } else {
                      await handleSubmit(onSubmit)();
                      forceClose();
                    }
                  } catch (error: any) {
                    shouldTriggerFollowupsRef.current = false;
                    hasClosedRef.current = false;
                      setShowSubmittingOverlay(false);
                      setIsAutoRedirecting(false);
                      allowNavigationRef.current = false;
                      setAllowNavigation(false);
                      setShowPreview(false);
                    const errData = error?.data || error?.response?.data;
                    const backendError =
                      errData?.error ||
                      (typeof errData === "string" ? errData : null) ||
                      error?.message ||
                      "An error occurred during submission";
                    Toast.show({
                      type: "error",
                      text1: "Submission Failed",
                      text2: backendError,
                      position: "top",
                    });
                  } finally {
                    submitInFlightRef.current = false;
                    if (!hasClosedRef.current) {
                      allowNavigationRef.current = false;
                      setAllowNavigation(false);
                    }
                    setTimeout(() => {
                      setShowSubmittingOverlay(false);
                      setIsAutoRedirecting(false);
                    }, 100);
                  }
                }}
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
                  <Text style={styles.buttonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stickyFooterRow}>
              {isOnline && (
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
              )}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  styles.stickyFooterButton,
                ]}
                onPress={handlePreviewPress}
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
          )}
        </View>
      )}

      {showPreviewOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Preparing preview...</Text>
          </View>
        </View>
      )}

      {showAssigningOverlay && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Assigning task...</Text>
          </View>
        </View>
      )}

      {isGeneratingPdf && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.submittingText}>Generating PDF...</Text>
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

      {/* Task Dialog Modal - Exact same as multi-stage form */}
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
              style={[
                styles.taskModalContent,
                { maxHeight: taskModalContentMaxHeight },
              ]}
              contentContainerStyle={styles.taskModalContentContainer}
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

              {/* Assign Form - Only show for Scenario 1 (web-created tasks with assigned forms) */}
              {isEditingWebTask && currentEditingTask?.assign_form && (
                <View style={styles.taskField}>
                  <Text style={styles.taskFieldLabel}>Assigned Form</Text>
                  <View style={styles.webAssignedUsersContainer}>
                    <Text style={styles.webAssignedUsersText}>
                      {currentEditingTask.assigned_form_title ||
                        currentEditingTask.assign_form?.title ||
                        "Form assigned"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Web-assigned users display for Scenario 1 (editing web tasks) */}
              {isEditingWebTask && currentEditingTask && (
                <View style={styles.taskField}>
                  <Text style={styles.taskFieldLabel}>
                    Web Assigned Users (Cannot Edit)
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
                      showLocationLeaderDropdown
                        ? "expand-less"
                        : "expand-more"
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

      {/* User Dropdown Modal */}
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
                    style={[styles.optionItem, isSelected && styles.selectedOptionItem]}
                    onPress={() => toggleAssignUser(item.id)}
                  >
                    <Text style={styles.optionText}>
                      {displayName} - {item.email || "Email Not Available"}
                    </Text>
                    {isSelected && <MaterialIcons name="check" size={20} color="#007AFF" />}
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

      {/* Group Dropdown Modal */}
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
                    style={[styles.optionItem, isSelected && styles.selectedOptionItem]}
                    onPress={() => toggleAssignGroup(item.id)}
                  >
                    <Text style={styles.optionText}>{item.name || "NA"}</Text>
                    {isSelected && <MaterialIcons name="check" size={20} color="#007AFF" />}
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

      {/* Location Leader Dropdown Modal */}
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
                    style={[styles.optionItem, isSelected && styles.selectedOptionItem]}
                    onPress={() => toggleAssignLocationLeader(item.id)}
                  >
                    <Text style={styles.optionText}>{displayName}</Text>
                    {isSelected && <MaterialIcons name="check" size={20} color="#007AFF" />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No location leaders found</Text>
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

      {/* Share Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showShareModal}
        onRequestClose={() => {
          setShowShareModal(false);
          setShareSelectedIds([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.taskModal}>
            <View style={styles.taskModalHeader}>
              <Text style={styles.taskModalTitle}>Share Form</Text>
              <TouchableOpacity onPress={() => { setShowShareModal(false); setShareSelectedIds([]); }}>
                <MaterialIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              {(["user", "groups", "leaders"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => { setShareActiveTab(tab); setShareSelectedIds([]); }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: "center",
                    borderBottomWidth: 2,
                    borderBottomColor: shareActiveTab === tab ? "#2196f3" : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600", color: shareActiveTab === tab ? "#2196f3" : "#666" }}>
                    {tab === "user" ? "Users" : tab === "groups" ? "Groups" : "Leaders"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: 12,
                fontSize: 16,
              }}
              placeholder="Search..."
              value={shareSearchQuery}
              onChangeText={setShareSearchQuery}
            />

            <FlatList
              data={filteredShareOptions}
              keyExtractor={(item: any) => item.id.toString()}
              style={{ maxHeight: 300 }}
              renderItem={({ item }: { item: any }) => {
                const displayName =
                  shareActiveTab === "groups"
                    ? item?.name || "NA"
                    : `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || item?.username || item?.email || "Unknown";
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F3F4F6",
                    }}
                    onPress={() => toggleShareSelection(item.id)}
                  >
                    <Text style={{ fontSize: 16, color: "#333" }}>{displayName}</Text>
                    {shareSelectedIds.includes(item.id) && (
                      <MaterialIcons name="check" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: "#9CA3AF", fontSize: 16 }}>No items found</Text>
                </View>
              }
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setShowShareModal(false); setShareSelectedIds([]); }}
                style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: "#F3F4F6" }}
              >
                <Text style={{ fontSize: 16, color: "#666", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShareSubmit}
                disabled={isSharing || shareSelectedIds.length === 0}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  backgroundColor: isSharing || shareSelectedIds.length === 0 ? "#93C5FD" : "#2196f3",
                }}
              >
                <Text style={{ fontSize: 16, color: "white", fontWeight: "600" }}>
                  {isSharing ? "Sharing..." : "Share"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </PreviousSubmissionsContext.Provider>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    width: "100%", // Ensure full width on all screens
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
    marginLeft: 18,
    marginRight: 18,
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
  container: {
    flex: 1,
    width: "100%",
  },
  formContainer: {
    paddingBottom: 140,
    flexGrow: 1, // Allow content to grow
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 12,
    flexWrap: "wrap", // Allow buttons to wrap on very small screens
  },
  doubleButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 12,
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: 8,
    maxWidth: "100%",
  },
  tripleButtonContainer: {
    flexDirection: "column",
    marginHorizontal: 16,
    marginVertical: 16,
    alignItems: "stretch",
    alignSelf: "stretch",
    paddingHorizontal: 16,
  },
  draftStyleButton: {
    backgroundColor: "#FFA500", // Orange color for draft button
  },
  stackedButton: {
    marginVertical: 8,
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    flex: 0, // Override flex to use explicit width
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
  buttonText: {
    fontSize: 12,
    color: textColors.white,
    fontWeight: "600",
  },
  stageIndicator: {
    marginTop: 6,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    ...typography.labelLarge,
    color: textColors.primary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 10,
    fontSize: 14,
    paddingRight: 36,
  },
  searchInputContainer: {
    position: 'relative',
  },
  searchClearButton: {
    position: 'absolute',
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
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedOptionItem: {
    backgroundColor: "#F0F7FF",
  },
  optionText: {
    ...typography.labelMedium,
    color: textColors.primary,
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
    ...typography.bodyMedium,
    color: textColors.tertiary,
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
    ...typography.labelLarge,
    color: textColors.white,
    textAlign: "center",
  },
  modalTitle: {
    ...typography.titleSmall,
    flex: 1,
  },
  groupListContainer: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    ...typography.bodyMedium,
    color: textColors.tertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    ...typography.bodyLarge,
    color: textColors.error,
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  errorInput: {
    borderColor: "#FF3B30",
    borderWidth: 2,
  },
  errorMessage: {
    color: "#FF3B30",
    fontSize: 14,
    marginTop: 4,
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
    ...typography.titleMedium,
    color: textColors.primary,
    marginLeft: 10,
  },
  draftModalMessage: {
    ...typography.bodyMedium,
    color: textColors.secondary,
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
    ...typography.labelMedium,
    color: textColors.white,
    marginLeft: 6,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    ...typography.labelLarge,
    color: textColors.link,
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
    ...typography.bodyMedium,
    marginTop: 12,
    color: textColors.primary,
  },
  questionSeparator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
    marginHorizontal: 4,
  },
  stickyBannerContainer: {
    position: "absolute",
    top: 35, // Position below the form title (adjust as needed)
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "transparent",
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
  stickyFooterButton: {
    flex: 1,
    marginHorizontal: 3,
    minHeight: 40,
    minWidth: 0,
    maxWidth: undefined,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  stickyFooterRow: {
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyFooterGridButton: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 56,
    marginBottom: 8,
  },
  stickyFooterSpacer: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 56,
  },
  formContainerWithBanner: {
    paddingTop: 70, // Add padding to account for the sticky banner
  },
  followUpTaskContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 10,
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
    ...typography.titleSmall,
    color: "#007AFF",
    marginLeft: 8,
    fontWeight: "600",
    flexShrink: 1,
  },
  followUpTaskContent: {
    flex: 1,
  },
  followUpTaskLabel: {
    ...typography.labelMedium,
    color: textColors.secondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  followUpTaskValue: {
    ...typography.bodyMedium,
    color: textColors.primary,
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
    ...typography.labelMedium,
    color: "#fff",
    marginLeft: 6,
    fontWeight: "600",
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
    ...typography.titleMedium,
    color: textColors.primary,
    flex: 1,
  },
  taskModalCloseButton: {
    padding: 5,
  },
  taskModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  taskModalContentContainer: {
    paddingBottom: 80,
  },
  taskField: {
    marginBottom: 20,
  },
  taskFieldLabel: {
    ...typography.labelLarge,
    color: textColors.primary,
    marginBottom: 8,
    fontWeight: "600",
  },
  taskTextInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: textColors.primary,
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
    padding: 10,
    fontSize: 14,
    color: textColors.primary,
    backgroundColor: "#fff",
    width: 60,
    textAlign: "center",
    marginRight: 8,
  },
  deadlineText: {
    ...typography.bodyMedium,
    color: textColors.secondary,
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
    ...typography.bodyLarge,
    color: textColors.primary,
    flex: 1,
  },
  taskDropdownScrollContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#fff",
    maxHeight: 100,
    zIndex: 99999999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 200,
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
    padding: 10,
    fontSize: 14,
    color: textColors.primary,
  },
  taskDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  taskDropdownItemText: {
    ...typography.bodyMedium,
    color: textColors.primary,
    flex: 1,
  },
  taskDropdownEmpty: {
    ...typography.bodyMedium,
    color: textColors.tertiary,
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
  taskCreateButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  taskCancelButtonText: {
    ...typography.labelLarge,
    color: textColors.white,
    fontWeight: "600",
  },
  taskCreateButtonText: {
    ...typography.labelLarge,
    color: textColors.white,
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
    ...typography.bodyMedium,
    color: textColors.secondary,
    marginBottom: 4,
  },
});

export default AuditFormScreen;
