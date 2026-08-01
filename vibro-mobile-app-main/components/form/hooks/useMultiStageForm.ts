




// hooks/useMultiStageForm.ts
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { fetchFormAssignments } from "../../../Redux/actions/formAssignmentActions";
import { fetchFormReceived } from "../../../Redux/actions/formReceivedActions";
import api from "../../../services";
import { backgroundSyncService } from "../../../services/backgroundSyncService";
import { GETALLASSIGNEDSTAGESACCESSID, RECEIVED, SUBMIT_GROUP_ANSWER, SUBMIT_STAGE_ANSWER } from "../../../services/constants";
import { networkService } from "../../../services/networkService";
import { offlineStorageService } from "../../../services/offlineStorageService";
import { RootState } from "../../../store";
import { Stage, SubmissionsDetail } from "../types/formTypes";
import { generateValidationSchema } from "../utils/validationSchemas";

export const useMultiStageForm = (
  stages: Stage[] | any,
  setFormSubmissionId: any,
  setShowSendButton: any,
  submissionsDetail?: SubmissionsDetail,
  formSubmissionId?: number,
  formId?: number,
  setStages?: React.Dispatch<React.SetStateAction<Stage[]>>,
  setIsAutoRedirecting?: (value: boolean) => void,
  formAllowsSharing?: boolean,
  isAutoShareEnabled?: boolean,
  formType?: string,
  setHasJustBeenSubmitted?: (value: boolean) => void,
  onVisibleQuestionsChange?: (newVisible: Set<string>, previousVisible: Set<string>) => void,
  stageApprovalContext?: {
    meta?: { stageId: number; questionId: number; questionType?: string };
    decision?: Record<number, "accepted" | "rejected" | null>;
    remarks?: Record<number, string>;
  },
  allowPreviewNavigation: boolean = false,
  shareFormIdOverride?: number,
  plannerAssignmentId?: string,
) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showShareButton, setShowShareButton] = useState(false);
  const [formUsers, setFormUsers] = useState<any[]>([]);
  const [formGroups, setFormGroups] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [isFormEnabledForSharing, setIsFormEnabledForSharing] = useState<boolean>(formAllowsSharing || false);
  const [isManualShareEnabled, setIsManualShareEnabled] = useState<boolean>(false);
  const [stageSubmitted, setStageSubmitted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>({});
  const [assignedFolders, setAssignedFolders] = useState<any[]>([]);
  const [autoShareEnabled, setAutoShareEnabled] = useState(false);
  const [autoShareConfig, setAutoShareConfig] = useState<{
    users: number[];
    groups: number[];
    location_leaders: number[];
  }>({ users: [], groups: [], location_leaders: [] });
  const [isLastStageSubmitter, setIsLastStageSubmitter] = useState(false);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [errorFieldKeys, setErrorFieldKeys] = useState<string[]>([]);

  const persistentFormSubmissionId = useRef<number | undefined>(
    submissionsDetail?.id ? Number(submissionsDetail.id) : formSubmissionId
  );
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualRedirect, setManualRedirect] = useState<() => void>(() => {});
  const assignments = useSelector((state: RootState) => state.formAssignments.data);
  const receivedAssignment = useSelector((state: RootState) => state.formReceived.data);
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user);
  const allQuestions = useMemo(() => (stages || []).flatMap((stage: any) => stage?.questions || []), [stages]);
  const [visibleQuestions, setVisibleQuestions] = useState<Set<string>>(new Set());
  const [activeModal, setActiveModal] = useState<any>(null);
  const [forceVisibleQuestions, setForceVisibleQuestions] = useState<Set<string>>(new Set());
  const [formOrganizationId, setFormOrganizationId] = useState<number | null>(null);
  const formOrganizationIdRef = useRef<number | null>(null);
  const lastFormSubmissionId = useRef<number | undefined>(undefined);

  // Refs to access latest state inside subscriptions without re-subscribing
  const visibleQuestionsRef = useRef<Set<string>>(visibleQuestions);
  const forceVisibleQuestionsRef = useRef<Set<string>>(forceVisibleQuestions);

  useEffect(() => {
    visibleQuestionsRef.current = visibleQuestions;
  }, [visibleQuestions]);

  useEffect(() => {
    forceVisibleQuestionsRef.current = forceVisibleQuestions;
  }, [forceVisibleQuestions]);

  const currentStage = stages[currentStageIndex];
  const currentStageRef = useRef(currentStage);

  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);
  const toNumericId = useCallback((value: any): number | null => {
    const candidate =
      typeof value === "object" && value !== null ? value.id : value;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, []);

  const resolvedOrganizationId = useMemo(() => {
    const candidates = [
      (user as any)?.organizationId,
      (user as any)?.organization_id,
      (typeof (user as any)?.organization === "number" ? (user as any).organization : null),
      (user as any)?.organization?.id,
      (submissionsDetail as any)?.organization,
      (submissionsDetail as any)?.organization_id,
      (submissionsDetail as any)?.organization?.id,
      (currentStage as any)?.organization,
      (currentStage as any)?.organization_id,
      (currentStage as any)?.organization?.id,
      formOrganizationId,
      formOrganizationIdRef.current,
    ];

    for (const candidate of candidates) {
      const organizationId = toNumericId(candidate);
      if (organizationId !== null) return organizationId;
    }

    return null;
  }, [currentStage, formOrganizationId, submissionsDetail, toNumericId, user]);

  const getAnswerOrganizationId = useCallback(
    (questionMeta?: any, fallbackOrganizationId?: any): number | null => {
      const matchedQuestion =
        questionMeta?.id != null
          ? allQuestions.find((question: any) => Number(question?.id) === Number(questionMeta.id))
          : null;

      const candidates = [
        fallbackOrganizationId,
        questionMeta?.answers?.organization,
        questionMeta?.answers?.organization_id,
        questionMeta?.answers?.organization?.id,
        questionMeta?.answer?.organization,
        questionMeta?.answer?.organization_id,
        questionMeta?.organization,
        questionMeta?.organization_id,
        matchedQuestion?.answers?.organization,
        matchedQuestion?.answers?.organization_id,
        matchedQuestion?.answers?.organization?.id,
        matchedQuestion?.answer?.organization,
        matchedQuestion?.answer?.organization_id,
        resolvedOrganizationId,
      ];

      for (const candidate of candidates) {
        const organizationId = toNumericId(candidate);
        if (organizationId !== null) return organizationId;
      }

      return null;
    },
    [allQuestions, resolvedOrganizationId, toNumericId],
  );
  const ensureOrganizationId = useCallback(async (): Promise<number | null> => {
    const existingOrganizationId = getAnswerOrganizationId();
    if (existingOrganizationId !== null) return existingOrganizationId;
    if (!formId) return null;

    try {
      const response = await api.get(`/form/${formId}/`);
      const candidates = [
        response.data?.organization,
        response.data?.organization_id,
        response.data?.organization?.id,
        response.data?.form?.organization,
        response.data?.form?.organization_id,
        response.data?.form?.organization?.id,
      ];

      for (const candidate of candidates) {
        const organizationId = toNumericId(candidate);
        if (organizationId !== null) {
          formOrganizationIdRef.current = organizationId;
          setFormOrganizationId(organizationId);
          return organizationId;
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }, [formId, getAnswerOrganizationId, toNumericId]);
  const assertAnswersHaveOrganization = useCallback((answersList: any[]) => {
    const missingOrganization = answersList.find(
      (answer: any) => toNumericId(answer?.organization) === null,
    );
    if (missingOrganization) {
      throw new Error(
        "Organization ID is missing for this form update. Please logout and login again, then retry.",
      );
    }
  }, [toNumericId]);
  const isFirstStage = currentStageIndex === 0;
  const isLastStage = currentStageIndex === stages.length - 1;
  const validationSchema = useMemo(() =>
    generateValidationSchema(currentStage?.questions || []),
    [currentStage?.questions]
  );

  const {
    control,
    handleSubmit,
    formState,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
  } = useForm({
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  // Access errors via ref to avoid subscribing to the formState proxy,
  // which would cause the hook (and the whole screen) to re-render on
  // every form state change in large forms.
  const formStateRef = useRef(formState);
  formStateRef.current = formState;
  // Use a state variable instead of directly accessing formState.errors,
  // which is a proxy that subscribes the component to ALL formState changes.
  // We only update this state when errors actually change.
  const [errors, setErrorsState] = useState<Record<string, any>>({});

  // Track form dirtiness manually with a ref so we don't subscribe react-hook-form's
  // isDirty proxy. That proxy causes the hook (and therefore the whole screen) to
  // re-render on every keystroke/option click in large forms.
  const isFormDirtyRef = useRef(false);
  const getIsFormDirty = useCallback(() => isFormDirtyRef.current, []);
  const resetFormDirty = useCallback(() => {
    isFormDirtyRef.current = false;
  }, []);

  const sharingStatusCache = useMemo(() => new Map<number, boolean>(), []);

  // Fetch assigned folders for user
  const fetchAssignedFolders = useCallback(async () => {
    try {
      const response = await api.get('form/used-folders/user');
      setAssignedFolders(response.data || []);
      return response.data || [];
    } catch (error) {
      setAssignedFolders([]);
      return [];
    }
  }, []);

  // Update persistentFormSubmissionId when formSubmissionId or submissionsDetail.id changes
  useEffect(() => {
    if (submissionsDetail?.id && Number(submissionsDetail.id) !== persistentFormSubmissionId.current) {
      persistentFormSubmissionId.current = Number(submissionsDetail.id);
    } else if (formSubmissionId && formSubmissionId !== persistentFormSubmissionId.current) {
      persistentFormSubmissionId.current = formSubmissionId;
    }
  }, [formSubmissionId, submissionsDetail]);

  useEffect(() => {
    if (stages.length > 0) {
      const initialCompleted = stages
        .map((stage: Stage, index: number) => (stage.is_completed ? index : -1))
        .filter((index: number) => index >= 0);
      setCompletedStages(initialCompleted);
    }
  }, [stages]);

  // Fetch folders on component mount
  useEffect(() => {
    fetchAssignedFolders();
  }, [fetchAssignedFolders]);

  const checkFormSharingStatus = useCallback(async (formId: number) => {
    if (sharingStatusCache.has(formId)) {
      const cachedStatus = sharingStatusCache.get(formId);
      setIsFormEnabledForSharing(cachedStatus ?? false);
      return cachedStatus ?? false;
    }
    try {
      const response = await api.get(`/form/${formId}/`);
      const isEnabled = response.data.share_response || false;
      sharingStatusCache.set(formId, isEnabled);
      setIsFormEnabledForSharing(isEnabled);
      return isEnabled;
    } catch (error) {
      // console.error("Error checking form sharing status:", error);
      setIsFormEnabledForSharing(false);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to check form sharing status.",
        position: "top",
      });
      return false;
    }
  }, []);

  useEffect(() => {
    if (formId) {
      checkFormSharingStatus(Number(formId));
    }
  }, [formId, checkFormSharingStatus]);

  const goToNextStage = () => {
    if (currentStageIndex < stages.length - 1) {
      // Record timestamp when navigating to next during edit mode
      if (submissionsDetail?.is_completed && setStages) {
        setStages((prevStages: any) => {
          const updatedStages = [...prevStages];
          updatedStages[currentStageIndex] = {
            ...updatedStages[currentStageIndex],
            edited_by: user.id,
            edited_on: new Date().toISOString(),
            updated: true,
          };
          return updatedStages;
        });
      }

      setCurrentStageIndex(currentStageIndex + 1);
      if (!completedStages.includes(currentStageIndex)) {
        setCompletedStages([...completedStages, currentStageIndex]);
      }
    }
  };

  const goToPrevStage = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1);
    }
  };

  const goToStage = (index: number) => {
    if (index < 0 || index >= stages.length) return;

    if (allowPreviewNavigation) {
      setCurrentStageIndex(index);
      return;
    }

    // For new forms, only allow access to the first stage initially
    if (!submissionsDetail?.id && !formSubmissionId) {
      if (index !== 0) {
        Toast.show({
          type: "error",
          text1: "Access Denied",
          text2: "Please complete stage 1 first before accessing other stages.",
          position: "top",
        });
        return;
      }
      setCurrentStageIndex(index);
      return;
    }

    // For completed forms, allow viewing all stages
    if (submissionsDetail?.is_completed) {
      setCurrentStageIndex(index);
      return;
    }

    // For existing forms, check if user has permission to access the stage
    const targetStage = stages[index];
    if (!targetStage) return;

    const sourceArray = index === 0 ? assignments : receivedAssignment;
    const hasAssignment = sourceArray?.some((assignment: any) =>
      assignment.stageId === targetStage.id &&
      (index === 0 ? !assignment.formSubmissionId : assignment.formSubmissionId === (persistentFormSubmissionId.current || submissionsDetail?.id)) &&
      assignment.form === formId
    );

    if (!hasAssignment) {
      Toast.show({
        type: "error",
        text1: "Access Denied",
        text2: "You don't have permission to access this stage.",
        position: "top",
      });
      return;
    }

    // For stages after the first, check if all previous stages are completed
    if (index > 0) {
      for (let i = 0; i < index; i++) {
        const prevStage = stages[i];
        if (!prevStage?.is_completed) {
          Toast.show({
            type: "error",
            text1: "Stage Not Completed",
            text2: `Please complete stage ${i + 1} before accessing stage ${index + 1}.`,
            position: "top",
          });
          return;
        }
      }
    }

    setCurrentStageIndex(index);
  };

  const lastStageIdRef = useRef<number | string | null>(null);

  useEffect(() => {
    const stageId = currentStage?.id ?? null;
    if (stageId == null) return;

    // Only reset visibility when the actual stage changes, not when the stage
    // object is re-created due to edits (e.g. updating follow-up task details).
    if (lastStageIdRef.current === stageId) return;
    lastStageIdRef.current = stageId;

    const initialVisible = new Set<string>();
    currentStage?.questions?.forEach((question: any) => {
      initialVisible.add(question.question_uuid);
    });
    setVisibleQuestions(initialVisible);
    // Clear forced visible questions when changing stages
    setForceVisibleQuestions(new Set());
  }, [currentStage?.id]);

  // Debounce logic visibility recalculation so rapid value changes (typing,
  // option clicks) don't trigger repeated full-tree traversals. Also only
  // evaluate logics for questions whose values actually changed.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const lastValuesRef: { current?: any } = { current: undefined };

    const subscription = watch((formValues) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const currentVisible = visibleQuestionsRef.current;
        const forceVisible = forceVisibleQuestionsRef.current;
        const stage = currentStageRef.current;
        const newVisible = new Set(currentVisible);
        let hasChanges = false;

        // Determine which parent questions changed since last evaluation so we
        // don't traverse logics for all questions on every keystroke.
        const lastValues = lastValuesRef.current;
        const changedKeys = new Set<string>();
        let hasValueChanges = false;
        if (lastValues) {
          const currentKeys = new Set([...Object.keys(lastValues), ...Object.keys(formValues)]);
          currentKeys.forEach((key) => {
            if (lastValues[key] !== formValues[key]) {
              changedKeys.add(key);
              hasValueChanges = true;
            }
          });
        }
        if (hasValueChanges) {
          isFormDirtyRef.current = true;
        }
        lastValuesRef.current = { ...formValues };

        const questionsToCheck =
          changedKeys.size > 0 && stage?.questions?.length
            ? stage.questions.filter((q: any) => changedKeys.has(q.question_uuid))
            : stage?.questions || [];

        questionsToCheck.forEach((question: any) => {
          question.logics?.forEach((logic: any) => {
            const shouldTrigger = evaluateLogic(logic, formValues, question);
            if (shouldTrigger) {
              logic.logic_questions?.forEach((logicQuestion: any) => {
                const key = logicQuestion.question_uuid;
                if (!newVisible.has(key)) {
                  newVisible.add(key);
                  hasChanges = true;
                }
              });
              // Show follow_up task when logic condition is met
              if (logic.follow_up) {
                const followUpUuid = `followup-${logic.id}`;
                if (!newVisible.has(followUpUuid)) {
                  newVisible.add(followUpUuid);
                  hasChanges = true;
                }
              }
            } else {
              logic.logic_questions?.forEach((logicQuestion: any) => {
                const key = logicQuestion.question_uuid;
                // Don't hide questions that are forcibly visible (e.g., due to validation errors)
                if (newVisible.has(key) && !forceVisible.has(key)) {
                  newVisible.delete(key);
                  hasChanges = true;
                }
              });
              // Hide follow_up task when logic condition is not met
              if (logic.follow_up) {
                const followUpUuid = `followup-${logic.id}`;
                if (newVisible.has(followUpUuid) && !forceVisible.has(followUpUuid)) {
                  newVisible.delete(followUpUuid);
                  hasChanges = true;
                }
              }
            }
          });
        });

        if (hasChanges) {
          const previousVisible = new Set(currentVisible);
          setVisibleQuestions(newVisible);
          onVisibleQuestionsChange?.(newVisible, previousVisible);
        }
      }, 50);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [watch, onVisibleQuestionsChange]);

  function evaluateLogic(logic: any, formValues: any, question: any): boolean {
    // Get the value of the parent question
    const parentValue = formValues[question.question_uuid];

    if (parentValue === undefined || parentValue === null) return false;

    const normalizeTimeToHHMM = (value: any): string | null => {
      if (value === undefined || value === null) return null;
      const raw = String(value).trim();
      if (!raw) return null;

      // Handle direct HH:mm / HH:mm:ss values
      const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (timeMatch) {
        const hours = String(Math.max(0, Math.min(23, Number(timeMatch[1])))).padStart(2, "0");
        const minutes = String(Math.max(0, Math.min(59, Number(timeMatch[2])))).padStart(2, "0");
        return `${hours}:${minutes}`;
      }

      // Handle ISO/Date values stored by DateTimePicker
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const hours = String(parsed.getHours()).padStart(2, "0");
        const minutes = String(parsed.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      }

      return raw;
    };

    const normalizeTimeToMinutes = (value: any): number | null => {
      const hhmm = normalizeTimeToHHMM(value);
      if (!hhmm) return null;
      const [h, m] = hhmm.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    let actualValue = parentValue;

    // Handle different question types properly for follow-up task logic evaluation
    switch (question.question_type) {
      case "short_answer":
      case "long_answer":
        // For text fields, use the value directly as string
        actualValue = String(parentValue).trim();
        break;

      case "dropdown":
        // For dropdown, find the selected option by ID and get its text value
        if (question.options?.length) {
          const selectedOption = question.options.find((opt: any) => opt.id === parentValue);
          if (selectedOption) {
            actualValue = selectedOption.option;
          }
        }
        break;

      case "multiple_choice":
      case "checkboxes":
        // For multiple choice/checkboxes, handle array of selected options
    
    // Handle single selection (object with id and option)
    if (typeof parentValue === 'object' && parentValue !== null && 'option' in parentValue) {
      actualValue = parentValue.option;
    }
    // Handle multiple choice (array of objects)
    else if (Array.isArray(parentValue) && parentValue.length > 0) {
          if (typeof parentValue[0] === 'object' && parentValue[0].id) {
            // Array of objects with id property - extract option texts
            const selectedIds = parentValue.map((item: any) => item.id);
            const selectedOptions = question.options?.filter((opt: any) => selectedIds.includes(opt.id)) || [];
            actualValue = selectedOptions.map((opt: any) => opt.option);
          } else {
            // Array of values directly
            actualValue = parentValue;
          }
        }
        break;

      case "linear_scale":
        // For linear scale, use the numeric value
        if (typeof parentValue === "object" && parentValue?.[question.question_uuid] !== undefined) {
          actualValue = parentValue[question.question_uuid];
        } else if (typeof parentValue === "number") {
          actualValue = parentValue;
        }
        break;

      case "audit":
        // For audit questions, handle similar to multiple choice
        if (Array.isArray(parentValue) && parentValue.length > 0) {
          if (typeof parentValue[0] === 'object' && parentValue[0].id) {
            // Extract selected option values for audit questions
            const selectedIds = parentValue.map((item: any) => item.id);
            const selectedOptions = question.options?.filter((opt: any) => selectedIds.includes(opt.id)) || [];
            actualValue = selectedOptions.map((opt: any) => opt.option);
          } else {
            actualValue = parentValue;
          }
        }
        break;

      case "time":
        // Time answers are saved as ISO strings by DateTimePicker; normalize to HH:mm for stable logic checks
        actualValue = normalizeTimeToHHMM(parentValue);
        break;

      default:
        // For other question types, use value as-is
        actualValue = parentValue;
        break;
    }

    // Apply logic conditions to determine if follow-up task should be shown
    switch (logic.logic_type) {
      case "is":
        if (question.question_type === "time") {
          const left = normalizeTimeToHHMM(actualValue);
          const right = normalizeTimeToHHMM(logic.logic_value);
          return !!left && !!right && left === right;
        }
        if (Array.isArray(actualValue)) {
          // For array values (multiple selections), check if any match
          return actualValue.some(val => String(val) === String(logic.logic_value));
        }
        return String(actualValue) === String(logic.logic_value);

      case "contains":
        if (question.question_type === "time") {
          const left = normalizeTimeToHHMM(actualValue);
          const right = normalizeTimeToHHMM(logic.logic_value) || String(logic.logic_value);
          return !!left && left.includes(String(right));
        }
        return String(actualValue).includes(String(logic.logic_value));

      case "greater_than":
        if (question.question_type === "time") {
          const left = normalizeTimeToMinutes(actualValue);
          const right = normalizeTimeToMinutes(logic.logic_value);
          if (left !== null && right !== null) return left > right;
        }
        return Number(actualValue) > Number(logic.logic_value);

      case "less_than":
        if (question.question_type === "time") {
          const left = normalizeTimeToMinutes(actualValue);
          const right = normalizeTimeToMinutes(logic.logic_value);
          if (left !== null && right !== null) return left < right;
        }
        return Number(actualValue) < Number(logic.logic_value);

      default:
        return false;
    }
  }

  const getStageAssignUuid = useCallback(async () => {
  try {
    const response = await api.get(`${GETALLASSIGNEDSTAGESACCESSID}${user.id}/`);
    dispatch(fetchFormAssignments(response.data));
  } catch (error: unknown) {
    const err = error as { message?: string } & Record<string, any>;
    const isSessionExpired = !!err.message && err.message.includes("Session expired");
    const isOffline = networkService?.isOffline ? networkService.isOffline() : false;

      // Avoid noisy red-screen console errors when offline; just log as info
      if (isOffline) {
        return;
      }

      if (!isSessionExpired) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch stage assignments.",
        position: "top",
      });
    }
  }
  }, [dispatch, user.id]);


  const getReceivedStageAssignUuid = useCallback(async () => {
    try {
      const response = await api.get(`${RECEIVED}${user.id}/`);
      dispatch(fetchFormReceived(response.data));
    } catch (error: any) {
      const isOffline = networkService.isOffline();
      const isSessionExpired = !!error?.message && error.message.includes("Session expired");

      if (isOffline) {
        return;
      }

      if (!isSessionExpired) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to fetch received assignments.",
          position: "top",
        });
      }
    }
  }, [dispatch, user.id]);

  useEffect(() => {
    if (formSubmissionId && formSubmissionId !== lastFormSubmissionId.current) {
      lastFormSubmissionId.current = formSubmissionId;
      getReceivedStageAssignUuid();
    }
  }, [formSubmissionId, getReceivedStageAssignUuid]);

  // Validate ALL fields including hidden conditional logic sub-questions
  const validateAllFields = async () => {
    // Start with currently visible questions
    let allFieldNamesToValidate = new Set(Array.from(visibleQuestions));

    // Only add conditional questions that are actually visible based on current form values
    // Get current form values to evaluate logic conditions
    const currentFormValues = getValues();

    currentStage?.questions?.forEach((question: any) => {
      if (question.logics) {
        question.logics.forEach((logic: any) => {
          // Check if this logic condition is met based on current form values
          const shouldTrigger = evaluateLogic(logic, currentFormValues, question);
          if (shouldTrigger) {
            logic.logic_questions?.forEach((logicQuestion: any) => {
              allFieldNamesToValidate.add(logicQuestion.question_uuid);
            });
          }
        });
      }
    });

    // Convert to array for validation
    const fieldsToValidateArray = Array.from(allFieldNamesToValidate);

    // Update visibility to include conditional questions that should be visible
    const newVisible = new Set(visibleQuestions);
    fieldsToValidateArray.forEach(fieldName => {
      if (!newVisible.has(fieldName)) {
        newVisible.add(fieldName);
      }
    });
    if (newVisible.size > visibleQuestions.size) {
      setVisibleQuestions(newVisible);
      // Small delay to ensure UI updates before validation
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Now validate all fields (visible questions + conditionally visible questions)
    const isValidForm = await trigger(fieldsToValidateArray);
    const errorMap: Record<string, boolean> = {};
    fieldsToValidateArray.forEach((fieldName) => {
      errorMap[fieldName] = !!formStateRef.current.errors[fieldName];
    });
    setValidationErrors(errorMap);

    // Sync errors state so field components can display error messages
    setErrorsState({ ...formStateRef.current.errors });

    // IMPORTANT: If validation failed, keep conditionally visible questions open
    // so users can see and fix any errors in sub-questions
    if (!isValidForm) {
      // Small delay to prevent race conditions, then ensure visibility persists for error correction
      setTimeout(() => {
        setForceVisibleQuestions(new Set(allFieldNamesToValidate));
      }, 50);
    }

    return { isValid: isValidForm, errors: errorMap };
  };

  const resolveStageApprovalMeta = useCallback(() => {
    if (!currentStage?.id) return null;
    const questions = currentStage?.questions || [];
    const explicitApprovalQuestion = questions.find(
      (q: any) => q?.stage_approvals === true || q?.requiresApproval === true
    );
    const approvalQuestion = explicitApprovalQuestion || questions[0];
    const hasStageApprovalAccess =
      (currentStage as any)?.stage_approvals === true ||
      (currentStage as any)?.requiresApproval === true ||
      (currentStage as any)?.stage_access?.some(
        (access: any) => access?.stage_approvals === true
      );
    if (!hasStageApprovalAccess || !approvalQuestion?.id) return null;
    return {
      stageId: currentStage.id,
      questionId: approvalQuestion.id,
      questionType: approvalQuestion.question_type,
      isFallback: !explicitApprovalQuestion,
    };
  }, [currentStage]);

  const isStageApprovalAccepted = useMemo(() => {
    const meta = stageApprovalContext?.meta ?? resolveStageApprovalMeta();
    if (!meta || !currentStage?.id) return false;
    if (meta.stageId !== currentStage.id) return false;
    return stageApprovalContext?.decision?.[meta.stageId] === "accepted";
  }, [currentStage?.id, resolveStageApprovalMeta, stageApprovalContext]);

  const isEmptyForSubmit = useCallback((val: any, questionType: string) => {
    if (val === undefined || val === null) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    if (Array.isArray(val) && val.length === 0) return true;
    if (typeof val === "object") {
      if ("id" in val && (val as any).id == null) return true;
      if (Object.keys(val).length === 0) return true;
    }
    if (questionType === "linear_scale" && val === "") return true;
    return false;
  }, []);

  const isFinalStageForSubmission = isLastStage || isStageApprovalAccepted;

  const applyStageApprovalToAnswers = useCallback(
    (answersList: any[], mode: "submit" | "edit" | "offline") => {
      const meta = stageApprovalContext?.meta ?? resolveStageApprovalMeta();
      if (!meta || !currentStage?.id || !meta.questionId) return;
      if (meta.stageId !== currentStage.id) return;

      const decision = stageApprovalContext?.decision?.[meta.stageId] ?? null;
      const remarks = stageApprovalContext?.remarks?.[meta.stageId];
      const signatureValue = getValues?.(
        `stage_approval_signature_${meta.stageId}`
      ) as string | undefined;

      if (
        decision == null &&
        (!remarks || !remarks.trim()) &&
        (!signatureValue || !String(signatureValue).trim())
      ) {
        return;
      }

      const approvedStages = decision === "accepted";
      const signatureText = signatureValue ? String(signatureValue).trim() : "";
      const signatureExists = signatureText
        ? answersList.some(
            (ans: any) =>
              ans.question === meta.questionId &&
              (String(ans.answer ?? "") === signatureText ||
                String(ans.signature ?? "") === signatureText)
          )
        : false;

      const existing = answersList.find(
        (ans: any) => ans.question === meta.questionId
      );

      if (existing) {
        const hasExistingAnswer =
          existing.answer != null &&
          String(existing.answer).trim() !== "" &&
          String(existing.answer).toLowerCase() !== "undefined";

        if (decision != null && !hasExistingAnswer) {
          existing.answer = decision;
        }
        existing.approved_stages = approvedStages;
        if (remarks != null && remarks.trim()) {
          existing.remarks = remarks.trim();
        }
        if (signatureText) {
          existing.signature = signatureText;
        }
      } else {
        const baseAnswer: any = {
          question: meta.questionId,
          question_type: meta.questionType || "short_answer",
          answer: decision ?? "",
          Form: formId,
          stage: currentStage.id,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          organization: getAnswerOrganizationId({ id: meta.questionId }),
          approved_stages: approvedStages,
        };

        if (remarks != null && remarks.trim()) {
          baseAnswer.remarks = remarks.trim();
        }
        if (signatureText) {
          baseAnswer.signature = signatureText;
        }

        if (mode === "submit") {
          baseAnswer.submitted_by = user.id;
        }

        if (mode === "edit") {
          const effectiveSubmissionId = submissionsDetail?.id
            ? Number(submissionsDetail.id)
            : undefined;
          if (effectiveSubmissionId) {
            baseAnswer.submission = effectiveSubmissionId;
          }
        }

        answersList.push(baseAnswer);
      }

      if (signatureText && !signatureExists) {
        const signatureAnswer: any = {
          question: meta.questionId,
          question_type: meta.questionType || "short_answer",
          answer: signatureText,
          Form: formId,
          stage: currentStage.id,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          organization: getAnswerOrganizationId({ id: meta.questionId }),
        };
        if (mode === "submit") {
          signatureAnswer.submitted_by = user.id;
        }
        if (mode === "edit") {
          const effectiveSubmissionId = submissionsDetail?.id
            ? Number(submissionsDetail.id)
            : undefined;
          if (effectiveSubmissionId) {
            signatureAnswer.submission = effectiveSubmissionId;
          }
        }
        answersList.push(signatureAnswer);
      }
    },
    [
      currentStage?.id,
      formId,
      stageApprovalContext,
      submissionsDetail?.id,
      user.id,
      getAnswerOrganizationId,
      resolveStageApprovalMeta,
      getValues,
    ]
  );

  // Smart validation error clearing - uses watch subscription instead of
  // depending on [errors] from formState proxy, which would cause re-renders.
  // Also syncs errors state only when errors actually change.
  useEffect(() => {
    const subscription = watch(() => {
      const currentErrors = formStateRef.current.errors;

      // Sync errors state — only update when errors actually change
      setErrorsState(prev => {
        const prevKeys = Object.keys(prev);
        const newKeys = Object.keys(currentErrors);
        if (prevKeys.length !== newKeys.length) {
          return { ...currentErrors };
        }
        for (const key of newKeys) {
          if (prev[key]?.message !== currentErrors[key]?.message) {
            return { ...currentErrors };
          }
        }
        return prev;
      });

      setValidationErrors(prev => {
        if (Object.keys(prev).length === 0) {
          return prev;
        }

        const fieldsWithErrors = Object.keys(prev);
        const clearedFields: string[] = [];

        for (const fieldUuid of fieldsWithErrors) {
          if (!currentErrors[fieldUuid]) {
            clearedFields.push(fieldUuid);
          }
        }

        if (clearedFields.length === 0) {
          return prev;
        }

        const newErrors = { ...prev };
        clearedFields.forEach(field => delete newErrors[field]);
        return newErrors;
      });
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // FIXED POST METHOD - Updated to handle allow_share from response and offline mode
  const onSubmit = async (data: any) => {
    const isValid = await validateAllFields();
    if (!isValid) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill all required fields.",
        position: "top",
      });
      return;
    }

    if (!formId) {
      Toast.show({
        type: "error",
        text1: "Submission Error",
        text2: "Form ID is required. Please reload the form.",
        position: "top",
      });
      return;
    }

    const effectiveSubmissionId = persistentFormSubmissionId.current || submissionsDetail?.id;
    if (!isFirstStage && (!effectiveSubmissionId || effectiveSubmissionId === 0)) {
      Toast.show({
        type: "error",
        text1: "Submission Error",
        text2: "Valid form submission ID required for this stage.",
        position: "top",
      });
      return;
    }

    setSubmitting(true);

    // Check if device is offline
    let isOffline = networkService.isOffline();
    if (isOffline) {
      try {
        const refreshedStatus = await networkService.refresh();
        isOffline =
          !refreshedStatus.isConnected ||
          refreshedStatus.isInternetReachable === false;
      } catch {
        isOffline = networkService.isOffline();
      }
    }

    if (isOffline) {
      return await handleOfflineSubmission(data);
    }

    try {
      const extractId = (val: any) =>
        typeof val === "object" && val !== null && "id" in val ? val.id : val;
      const editOrganizationId = await ensureOrganizationId();

      const isNewForm = isFirstStage && !effectiveSubmissionId;

      let stageAssignmentUuid = null;
      const targetStageId = Number(currentStage?.id);
      const targetSubmissionId =
        effectiveSubmissionId != null ? Number(effectiveSubmissionId) : null;
      const assignmentPools = [assignments, receivedAssignment].filter(
        (arr) => Array.isArray(arr),
      ) as any[][];

      const findInPools = (predicate: (a: any) => boolean) => {
        for (const pool of assignmentPools) {
          const found = pool.find(predicate);
          if (found) return found;
        }
        return null;
      };

      // 1) Exact stage + exact submission match
      stageAssignmentUuid = findInPools(
        (a: any) =>
          Number(a?.stageId) === targetStageId &&
          targetSubmissionId !== null &&
          Number(a?.formSubmissionId) === targetSubmissionId,
      );

      // 2) Stage + null submission (first-stage/new-style assignments)
      if (!stageAssignmentUuid) {
        stageAssignmentUuid = findInPools(
          (a: any) =>
            Number(a?.stageId) === targetStageId &&
            (a?.formSubmissionId === null || a?.formSubmissionId === undefined),
        );
      }

      // 3) Any assignment for that stage (fallback for mixed payload shapes)
      if (!stageAssignmentUuid) {
        stageAssignmentUuid = findInPools(
          (a: any) => Number(a?.stageId) === targetStageId,
        );
      }

      // Only require stage assignment UUID for non-first stages and non-Todo forms
      // For Todo forms, users can submit if they have been assigned the Todo task regardless of form assignments
      if (!isFirstStage && !stageAssignmentUuid && formType !== 'todo') {
        throw new Error("Stage assignment UUID not found. Please ensure you have the correct permissions.");
      }


      const stageId = currentStage.id;
      const questions = currentStage.questions;
      const submitOrganizationId = await ensureOrganizationId();

      // Build payload with proper field names
      const payload: any = {
        form: formId,
        stage: stageId,
        answers: [],
      };

      if (plannerAssignmentId) {
        payload.planner_assignment_id = Number(plannerAssignmentId);
      }

      if (isStageApprovalAccepted) {
        payload.approved_stages = true;
      }

      // Only include stage_assignment_uuid for non-new forms
      if (stageAssignmentUuid) {
        payload.stage_assignment_uuid = stageAssignmentUuid.stageAssignmentUUID;
      }

      // Only include form_submission_id for non-first stages
      if (!isFirstStage && effectiveSubmissionId) {
        payload.form_submission_id = Number(effectiveSubmissionId);
      }
      
      const handleAnswer = (meta: any, val: any) => {
        let answerValue;

        // Special handling for linear_scale - extract the numeric value from object
        if (meta.question_type === "linear_scale") {
          if (typeof val === "object" && val !== null) {
            // Linear scale stores value as { question_uuid: numeric_value }
            // Try to get the value using the question_uuid as key
            if (val[meta.question_uuid] !== undefined) {
              answerValue = String(val[meta.question_uuid]);
            } else if (val[String(meta.question_uuid)] !== undefined) {
              // Try string version of question_uuid
              answerValue = String(val[String(meta.question_uuid)]);
            } else {
              // If no direct match, get the first value from the object
              const keys = Object.keys(val);
              if (keys.length > 0) {
                answerValue = String(val[keys[0]]);
              } else {
                answerValue = String(extractId(val));
              }
            }
          } else if (typeof val === "number") {
            answerValue = String(val);
          } else {
            answerValue = String(extractId(val));
          }
        } else {
          if (
            Array.isArray(val) &&
            ["dropdown", "checkboxes", "multiple_choice"].includes(meta.question_type)
          ) {
            const ids = val
              .map(extractId)
              .filter((v: any) => v !== undefined && v !== null && v !== "");
            if (ids.length === 0) {
              return;
            }
            answerValue = ids.join("|");
          } else {
            const extracted = extractId(val);
            if (extracted === undefined || extracted === null || extracted === "") {
              return;
            }
            answerValue = String(extracted);
          }
        }

        if (answerValue === "" || answerValue === "undefined" || answerValue === "null") {
          return;
        }

        const answer: any = {
          question: Number(meta.id) || meta.id,
          question_type: meta.question_type,
          answer: answerValue,
          Form: formId,
          stage: stageId,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          submitted_by: user.id,
          organization: getAnswerOrganizationId(meta, submitOrganizationId),
        };
        
        switch (meta.question_type) {
          case "division":
            answer.division = extractId(val);
            break;
          case "sub_division":
            answer.sub_division = extractId(val);
            break;
          case "location":
            answer.location = extractId(val);
            break;
          case "user":
            answer.user = extractId(val);
            break;
        }
        
        if (!payload.answers.some((ans: any) => Number(ans.question) === Number(meta.id))) {
          payload.answers.push(answer);
        }
      };

      const handleTableAnswer = (meta: any, rows: any[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const answer: any = {
          question: Number(meta.id) || meta.id,
          question_type: meta.question_type,
          answer: JSON.stringify(rows),
          Form: formId,
          stage: stageId,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          submitted_by: user.id,
          organization: getAnswerOrganizationId(meta, submitOrganizationId),
        };
        if (!payload.answers.some((ans: any) => Number(ans.question) === Number(meta.id))) {
          payload.answers.push(answer);
        }
      };
      
      // Process all form data
      for (const [question_uuid, value] of Object.entries(data)) {
        if (value === undefined || value === null || value === '') continue;

        let questionMeta = questions.find((q: any) => q.question_uuid === question_uuid);
        if (!questionMeta) {
          for (const q of questions) {
            const logicQuestion = q?.logics?.flatMap((logic: any) => logic.logic_questions)?.find(
              (lq: any) => lq.question_uuid === question_uuid
            );
            if (logicQuestion) {
              questionMeta = logicQuestion;
              break;
            }
          }
        }

        if (!questionMeta) {
          continue;
        }

        if (questionMeta.question_type === "table" && Array.isArray(value)) {
          handleTableAnswer(questionMeta, value);
          for (const row of value) {
            for (const [subQUuid, subValue] of Object.entries(row)) {
              const subMeta = questionMeta.sub_questions.find(
                (sq: any) => sq.question_uuid === subQUuid
              );
              if (!subMeta) continue;
              handleAnswer(subMeta, subValue);
            }
          }
        } else {
          handleAnswer(questionMeta, value);
        }
      }

      // Handle "Other" text fields separately
      for (const [key, value] of Object.entries(data)) {
        if (key.endsWith('_other') && value && typeof value === 'string' && value.trim()) {
          const questionUuid = key.replace('_other', '');
          const questionMeta = questions.find((q: any) => q.question_uuid === questionUuid);

          if (questionMeta && (questionMeta.question_type === 'multiple_choice' ||
                              questionMeta.question_type === 'checkboxes' ||
                              questionMeta.question_type === 'dropdown')) {
            // Find existing answer for this question
            const existingAnswerIndex = payload.answers.findIndex((ans: any) => ans.question === questionMeta.id);
            if (existingAnswerIndex >= 0) {
              // Update existing answer with other_text
              payload.answers[existingAnswerIndex].other_text = value.trim();
            } else {
              // Create new answer with other_text
              const answer: any = {
                question: questionMeta.id,
                question_type: questionMeta.question_type,
                answer: '', // Empty answer since it's "Other"
                Form: formId,
                stage: currentStage.id,
                division: null,
                sub_division: null,
                location: null,
                user: null,
                submitted_by: user.id,
                organization: getAnswerOrganizationId(questionMeta, submitOrganizationId),
                other_text: value.trim(),
              };
              payload.answers.push(answer);
            }
          }
        }
      }


      applyStageApprovalToAnswers(payload.answers, "submit");
      assertAnswersHaveOrganization(payload.answers);
      // Prevent backend auto-sharing on submit even when web "share response" is enabled.
      payload.share_response = false;
      payload.allow_share = false;

      // Choose API endpoint based on form type
      const submitEndpoint = formType === 'audit' ? SUBMIT_GROUP_ANSWER : SUBMIT_STAGE_ANSWER;
      const res = await api.post(submitEndpoint, payload);
      
      // console.log("✅ POST Response:", JSON.stringify(res.data, null, 2));
      
      // CRITICAL FIX: Check if form allows sharing from the response
      const allowShare = res?.data?.share_response || res?.data?.allow_share || false;
      setIsFormEnabledForSharing(allowShare);

      let submissionIdToSet = res?.data?.form_submission_id;
      if (!submissionIdToSet && payload.form_submission_id) {
        submissionIdToSet = payload.form_submission_id;
      }

      // Check for sharing configuration - only manual sharing, no auto-share
      if (isFinalStageForSubmission) {

        // Check if manual share is enabled (first toggle) - only affects share button visibility
        if (isManualShareEnabled || allowShare) {
          setShowShareButton(true);
        } else {
        }
      } else {
      }
      if (submissionIdToSet) {
        persistentFormSubmissionId.current = submissionIdToSet;
        setFormSubmissionId(submissionIdToSet);
      }
      
      if (!completedStages.includes(currentStageIndex)) {
        setCompletedStages([...completedStages, currentStageIndex]);
      }
      
      if (res?.data?.next_stage_assigning_required) {
        await getStageAssignUuid();
        await getReceivedStageAssignUuid();
      }
      
      if (!isFinalStageForSubmission) {
        setShowSendButton(true);
      }
      
      // Set show share button based on database sharing status
      if (isFinalStageForSubmission) {
        const isEnabled = await checkFormSharingStatus(formId);
        setShowShareButton(isEnabled);

        if (isStageApprovalAccepted && setStages) {
          setStages((prevStages: any) =>
            prevStages.slice(0, currentStageIndex + 1)
          );
        }

      }
      
      Toast.show({
        type: "success",
        text1: "Stage Submitted",
        text2: "Stage submitted successfully.",
        position: "top",
      });

      setSubmittedData(data);
      setStageSubmitted(true);
      // Clear forced visible questions after successful submission
      setForceVisibleQuestions(new Set());

      // Set flag to prevent draft prompts after submission
      if (setHasJustBeenSubmitted) {
        setHasJustBeenSubmitted(true);
      }

      // Show success modal (idle detection starts in useEffect below)
      setShowSuccessModal(true);

      return res.data;
      
    } catch (error: any) {
      
      let errorMsg = "An error occurred while submitting. Please try again.";
      
      if (error?.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMsg = error.response.data;
        } else if (error.response.data.detail) {
          errorMsg = error.response.data.detail;
        } else if (error.response.data.error) {
          errorMsg = error.response.data.error;
        } else if (error.response.data.message) {
          errorMsg = error.response.data.message;
        } else {
          errorMsg = JSON.stringify(error.response.data, null, 2);
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      console.error("🚨 Submission failed:", {
        message: error?.message,
        responseStatus: error?.response?.status,
        responseData: error?.response?.data,
      });
      if (!error.message?.includes("Session expired")) {
        Alert.alert("Submission Failed", errorMsg);
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  // PUT Method - Only for editing COMPLETED forms
  const onEditSubmit = async (data: any) => {

    const isValid = await validateAllFields();
    if (!isValid) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill all required fields.",
        position: "top",
      });
      return;
    }

    if (!submissionsDetail?.id) {
      throw new Error("No submission ID available for editing.");
    }
    if (!formId) {
      throw new Error("Form ID is required for editing.");
    }

    setSubmitting(true);
    try {
      const effectiveSubmissionId = Number(submissionsDetail.id);
      const resolvedStageIdRaw =
        currentStage?.id ?? stages?.[currentStageIndex]?.id ?? null;
      const resolvedStageIdNum = Number(resolvedStageIdRaw);
      if (!Number.isFinite(resolvedStageIdNum) || resolvedStageIdNum <= 0) {
        throw new Error("Valid stage ID is required for editing.");
      }

      if (submissionsDetail?.is_completed && Number(submissionsDetail?.completed_by) !== user.id) {
        throw new Error("Only the user who completed this form can edit it after completion.");
      }

      const allQuestionsMap = new Map();
      allQuestions.forEach((q: any) => {
        allQuestionsMap.set(q.question_uuid, q);
        if (q.sub_questions) {
          q.sub_questions.forEach((subQ: any) => {
            allQuestionsMap.set(subQ.question_uuid, subQ);
          });
        }
        if (q.logics) {
          q.logics.forEach((logic: any) => {
            logic.logic_questions.forEach((logicQ: any) => {
              allQuestionsMap.set(logicQ.question_uuid, logicQ);
            });
          });
        }
      });

      // Ensure we have an organization id to attach to edited answers
      const editOrganizationId = await ensureOrganizationId();

      const extractId = (val: any) =>
        typeof val === "object" && val !== null && "id" in val ? val.id : val;

      const handleAnswer = (meta: any, val: any) => {
        let answerValue;

        // Special handling for linear_scale - extract the numeric value from object
        if (meta.question_type === "linear_scale") {
          if (typeof val === "object" && val !== null) {
            // Linear scale stores value as { question_uuid: numeric_value }
            // Try to get the value using the question_uuid as key
            if (val[meta.question_uuid] !== undefined) {
              answerValue = String(val[meta.question_uuid]);
            } else if (val[String(meta.question_uuid)] !== undefined) {
              // Try string version of question_uuid
              answerValue = String(val[String(meta.question_uuid)]);
            } else {
              // If no direct match, get the first value from the object
              const keys = Object.keys(val);
              if (keys.length > 0) {
                answerValue = String(val[keys[0]]);
              } else {
                answerValue = String(extractId(val));
              }
            }
          } else if (typeof val === "number") {
            answerValue = String(val);
          } else {
            answerValue = String(extractId(val));
          }
        } else {
          if (
            Array.isArray(val) &&
            ["dropdown", "checkboxes", "multiple_choice", "audit"].includes(meta.question_type)
          ) {
            const ids = val
              .map(extractId)
              .filter((v: any) => v !== undefined && v !== null && v !== "");
            if (ids.length === 0) {
              return;
            }
            answerValue = ids.join("|");
          } else {
            const extracted = extractId(val);
            if (extracted === undefined || extracted === null || extracted === "") {
              return;
            }
            answerValue = String(extracted);
          }
        }

        if (answerValue === "" || answerValue === "undefined" || answerValue === "null") {
          return;
        }

        const answer: any = {
          question: Number(meta.id) || meta.id,
          question_type: meta.question_type,
          answer: answerValue,
          submission: Number(effectiveSubmissionId),
          stage: resolvedStageIdNum,
          organization: getAnswerOrganizationId(meta, editOrganizationId),
          Form: formId,
          division: null,
          sub_division: null,
          location: null,
          user: null,
        };

        // Handle special field types that need primary key values
        switch (meta.question_type) {
          case "division":
            answer.division = extractId(val);
            break;
          case "sub_division":
            answer.sub_division = extractId(val);
            break;
          case "location":
            // Ensure location is sent as an integer (primary key) not string
            const extractedLocation = extractId(val);
            answer.location = extractedLocation ? Number(extractedLocation) : null;
            break;
          case "user":
            answer.user = extractId(val);
            break;
        }

        return answer;
      };

      const handleTableAnswer = (meta: any, rows: any[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        return {
          question: Number(meta.id) || meta.id,
          question_type: meta.question_type,
          answer: JSON.stringify(rows),
          Form: formId,
          stage: resolvedStageIdNum,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          submitted_by: user.id,
          organization: getAnswerOrganizationId(meta, editOrganizationId),
        };
      };

      const answers = [];

      for (const [question_uuid, value] of Object.entries(data)) {
        const questionMeta = allQuestionsMap.get(question_uuid);

        if (!questionMeta) {
          continue;
        }

        if (questionMeta.question_type === "table" && Array.isArray(value)) {
          const tableAns = handleTableAnswer(questionMeta, value);
          if (tableAns) answers.push(tableAns);
          for (const row of value) {
            for (const [subQUuid, subValue] of Object.entries(row)) {
              const subMeta = allQuestionsMap.get(subQUuid);
              if (subMeta) {
                const ans = handleAnswer(subMeta, subValue);
                if (ans) answers.push(ans);
              }
            }
          }
        } else if (questionMeta.question_type === "audit") {
          const ans = handleAnswer(questionMeta, value);
          if (ans) answers.push(ans);

          if (questionMeta.sub_questions) {
            questionMeta.sub_questions.forEach((subQ: any) => {
              if (data[subQ.question_uuid] !== undefined) {
                const subAns = handleAnswer(subQ, data[subQ.question_uuid]);
                if (subAns) answers.push(subAns);
              }
            });
          }
        } else {
          const ans = handleAnswer(questionMeta, value);
          if (ans) answers.push(ans);
        }
      }

      applyStageApprovalToAnswers(answers, "edit");
      assertAnswersHaveOrganization(answers);

      const payload = {
        form: Number(formId),
        form_submission_id: Number(effectiveSubmissionId),
        stage: resolvedStageIdNum,
        stage_id: resolvedStageIdNum,
        edited_on: new Date().toISOString(),
        edited_by: user.id,
        answers,
      };

      const response = await api.put("/form/answers/edit/", payload);

      if (setStages) {
        setStages((prevStages: any) => {
          const updatedStages = [...prevStages];
          const currentStage = updatedStages[currentStageIndex];

          // Update stage metadata
          updatedStages[currentStageIndex] = {
            ...currentStage,
            edited_by: user.id,
            edited_on: new Date().toISOString(),
            updated: true,
            edited_by_sr: response.data.edited_by || `${user.first_name} ${user.last_name}`,
            edited_date: new Date().toISOString().split('T')[0],
            edited_time: new Date().toTimeString().split(' ')[0],
          };

          // Update the questions with the new answers so form can be repopulated
          if (currentStage?.questions && response.data?.answers) {
            updatedStages[currentStageIndex] = {
              ...updatedStages[currentStageIndex],
              questions: currentStage.questions.map((question: any) => {
                // Find the updated answer for this question
                const updatedAnswer = response.data.answers.find((ans: any) =>
                  ans.question === question.id
                );

                if (updatedAnswer) {
                  return {
                    ...question,
                    answers: {
                      ...question.answers,
                      answer: updatedAnswer.answer,
                      // Update other fields if they exist in the response
                      ...(updatedAnswer.division && { division: updatedAnswer.division }),
                      ...(updatedAnswer.sub_division && { sub_division: updatedAnswer.sub_division }),
                      ...(updatedAnswer.location && { location: updatedAnswer.location }),
                      ...(updatedAnswer.user && { user: updatedAnswer.user }),
                    }
                  };
                }

                return question;
              })
            };
          }

          return updatedStages;
        });
      }

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Form updated successfully.",
        position: "top",
      });

      setSubmittedData(data);
      setStageSubmitted(true);

      return response.data;
    } catch (error: any) {

      let errorMessage = error.response?.data?.error || error.message || "Failed to update form.";
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.non_field_errors) {
          errorMessage = error.response.data.non_field_errors.join(', ');
        }
      }
      
      if (!error.message?.includes("Session expired")) {
        Toast.show({
          type: "error",
          text1: "Update Error",
          text2: errorMessage,
          position: "top",
        });
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };


  const buildOfflineSubmissionData = useCallback(
    (data: any) => {
      if (!formId || !currentStage?.id) {
        throw new Error("Missing form or stage data for offline submission");
      }

      // Get stage assignment UUID (required for submission)
      const effectiveSubmissionId =
        persistentFormSubmissionId.current || submissionsDetail?.id;
      const sourceArray = isFirstStage ? assignments : receivedAssignment;

      const stageAssignmentUuid = sourceArray?.find((a: any) =>
        isFirstStage
          ? a.stageId === currentStage?.id && a.formSubmissionId === null
          : a.stageId === currentStage?.id &&
            a.formSubmissionId === Number(effectiveSubmissionId),
      );

      // Only require stage assignment UUID for non-first stages
      if (!isFirstStage && !stageAssignmentUuid) {
        throw new Error(
          "Stage assignment UUID not found. Please ensure you have the correct permissions.",
        );
      }

      // Ensure we have a valid user ID
      if (!user?.id) {
        throw new Error("User authentication required for offline submission");
      }

      // Prepare submission data for offline storage
      const submissionData = {
        formId: Number(formId),
        stageId: currentStage.id,
        formSubmissionId: effectiveSubmissionId
          ? Number(effectiveSubmissionId)
          : undefined,
        data: {
          answers: [] as any[],
          rawData: data, // Store raw form data
        },
        stageAssignmentUuid: stageAssignmentUuid?.stageAssignmentUUID || undefined,
        userId: user.id,
        organizationId: resolvedOrganizationId || 0,
        submissionType: "stage" as const,
        approvedStages: isStageApprovalAccepted || undefined,
      };

      // Process form data into answers format (similar to online submission)
      const extractId = (val: any) =>
        typeof val === "object" && val !== null && "id" in val ? val.id : val;

      const questions = currentStage.questions;

      const handleAnswer = (meta: any, val: any) => {
        if (isEmptyForSubmit(val, meta.question_type)) {
          return;
        }
        let answerValue;
        if (
          Array.isArray(val) &&
          ["dropdown", "checkboxes", "multiple_choice"].includes(
            meta.question_type,
          )
        ) {
          const ids = val
            .map(extractId)
            .filter((v: any) => v !== undefined && v !== null && v !== "");
          if (ids.length === 0) {
            return;
          }
          answerValue = ids.join("|");
        } else {
          const extracted = extractId(val);
          if (extracted === undefined || extracted === null || extracted === "") {
            return;
          }
          answerValue = String(extracted);
        }

        if (
          answerValue === "" ||
          answerValue === "undefined" ||
          answerValue === "null"
        ) {
          return;
        }

        const answer: any = {
          question: Number(meta.id) || meta.id,
          question_type: meta.question_type,
          answer: answerValue,
          Form: formId,
          stage: currentStage.id,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          submitted_by: user.id,
          organization: getAnswerOrganizationId(meta),
        };

        switch (meta.question_type) {
          case "division":
            answer.division = extractId(val);
            break;
          case "sub_division":
            answer.sub_division = extractId(val);
            break;
          case "location":
            answer.location = extractId(val);
            break;
          case "user":
            answer.user = extractId(val);
            break;
        }

        if (
          !submissionData.data.answers.some((ans: any) => Number(ans.question) === Number(meta.id))
        ) {
          submissionData.data.answers.push(answer);
        }
      };

      const handleTableAnswer = (meta: any, rows: any[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const answer: any = {
          question: Number(meta.id) || meta.id,
          question_type: meta.question_type,
          answer: JSON.stringify(rows),
          Form: formId,
          stage: currentStage.id,
          division: null,
          sub_division: null,
          location: null,
          user: null,
          submitted_by: user.id,
          organization: getAnswerOrganizationId(meta),
        };
        if (
          !submissionData.data.answers.some((ans: any) => Number(ans.question) === Number(meta.id))
        ) {
          submissionData.data.answers.push(answer);
        }
      };

      // Process all form data
      for (const [question_uuid, value] of Object.entries(data)) {
        if (value === undefined || value === null || value === "") continue;

        let questionMeta = questions.find(
          (q: any) => q.question_uuid === question_uuid,
        );
        if (!questionMeta) {
          for (const q of questions) {
            const logicQuestion = q?.logics
              ?.flatMap((logic: any) => logic.logic_questions)
              ?.find((lq: any) => lq.question_uuid === question_uuid);
            if (logicQuestion) {
              questionMeta = logicQuestion;
              break;
            }
          }
        }

        if (!questionMeta) {
          continue;
        }

        if (questionMeta.question_type === "table" && Array.isArray(value)) {
          handleTableAnswer(questionMeta, value);
          for (const row of value) {
            for (const [subQUuid, subValue] of Object.entries(row)) {
              const subMeta = questionMeta.sub_questions.find(
                (sq: any) => sq.question_uuid === subQUuid,
              );
              if (!subMeta) continue;
              handleAnswer(subMeta, subValue);
            }
          }
        } else {
          handleAnswer(questionMeta, value);
        }
      }

      applyStageApprovalToAnswers(submissionData.data.answers, "offline");
      assertAnswersHaveOrganization(submissionData.data.answers);

      return submissionData;
    },
    [
      assignments,
      currentStage?.id,
      currentStage?.questions,
      formId,
      isFirstStage,
      isStageApprovalAccepted,
      assertAnswersHaveOrganization,
      persistentFormSubmissionId,
      receivedAssignment,
      resolvedOrganizationId,
      submissionsDetail?.id,
      user.id,
      getAnswerOrganizationId,
    ],
  );

  const queueBackgroundSubmission = useCallback(
    async (data: any) => {
      try {
        const submissionData = buildOfflineSubmissionData(data);
        const submissionId = await offlineStorageService.storeSubmission(
          submissionData,
        );
        return submissionId;
      } catch (error: any) {
        return null;
      }
    },
    [buildOfflineSubmissionData],
  );

  // Handle offline submission - store locally for later sync
  const handleOfflineSubmission = async (data: any) => {
    try {
      const submissionData = buildOfflineSubmissionData(data);

      // Store submission offline
      const submissionId = await offlineStorageService.storeSubmission(submissionData);

      // Update UI state
      if (!completedStages.includes(currentStageIndex)) {
        setCompletedStages([...completedStages, currentStageIndex]);
      }

      if (!isFinalStageForSubmission) {
        setShowSendButton(true);
      }

      // Show success message for offline submission
      Toast.show({
        type: "success",
        text1: "Stage Submitted Offline",
        text2: "Your submission will be synced when you're back online.",
        position: "top",
      });

      setSubmittedData(data);
      setStageSubmitted(true);
      setShowSuccessModal(true);

      // Trigger background sync immediately if online (in case network state changed)
      setTimeout(async () => {
        try {
          const syncResult = await backgroundSyncService.forceSync();
          if (syncResult.syncedCount > 0) {
            // Refresh form data if sync was successful
            if (syncResult.success) {
              Toast.show({
                type: "success",
                text1: "Sync Complete",
                text2: "Your offline submission has been synced successfully.",
                position: "top",
              });

              // Refresh form assignments and submissions data
              try {
                await getStageAssignUuid();
                await getReceivedStageAssignUuid();

              } catch (refreshError) {

              }
            }
          }
        } catch (error) {

        }
      }, 1000); // Small delay to allow UI to update

      return { offline: true, submissionId };

    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Offline Storage Failed",
        text2: "Could not save submission locally. Please try again.",
        position: "top",
      });

      throw error;
    }
  };

  // AUTO-REDIRECT TO PREVIOUS PAGE AFTER FORM SUBMISSION (15 SECONDS)
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stageSubmitted || !showSuccessModal) return;
    // Set auto-redirecting flag when timer starts
    if (setIsAutoRedirecting) {
      setIsAutoRedirecting(true);
    }

    const redirectTimer = setTimeout(() => {
      setShowSuccessModal(false);
      // Reset auto-redirecting flag when actually performing redirect
      if (setIsAutoRedirecting) {
        setIsAutoRedirecting(false);
      }
      router.back();
    }, 15000); // 15 seconds

    // Cleanup function to clear timer if component unmounts or conditions change
    return () => {
      clearTimeout(redirectTimer);
      // Also reset the flag if unmounting/canceling
      if (setIsAutoRedirecting) {
        setIsAutoRedirecting(false);
      }
    };
  }, [stageSubmitted, showSuccessModal, setIsAutoRedirecting]);

  // Capture user's location when form is submitted
  const captureUserLocation = async () => {
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
  };

  // SMART SUBMISSION DETECTION
  const handleFormSubmission = useCallback(
    async (data: any) => {

      // Capture user's location at submission time
      const userLocation = await captureUserLocation();
      if (userLocation) {
        // Display location in terminal
      } else {
      }

      // For new forms (no submission detail or form submission ID), always use POST
      if (!submissionsDetail?.id && !formSubmissionId) {
        return await onSubmit(data);
      }

      // For existing forms, use edit endpoint when:
      // 1) whole submission is completed by current user, or
      // 2) current stage is already completed (previous-stage re-edit flow on in-progress submissions).
      const shouldUsePut =
        (submissionsDetail?.is_completed &&
          Number(submissionsDetail?.completed_by) === user.id) ||
        (!!currentStage?.is_completed && !!formSubmissionId);

      if (shouldUsePut) {
        return await onEditSubmit(data);
      } else {
        return await onSubmit(data);
      }
    },
    [onSubmit, onEditSubmit, submissionsDetail, user.id, formSubmissionId, currentStage]
  );

  // Manual control functions
  const handleSubmitForm = useCallback(
    async (data: any) => {
      return await onSubmit(data);
    },
    [onSubmit]
  );

  const handleEditForm = useCallback(
    async (data: any) => {
      return await onEditSubmit(data);
    },
    [onEditSubmit]
  );

  const fetchFormUsersAndGroups = useCallback(async (formId: number) => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        api.get(`/form/${formId}/users/`),
        api.get(`/form/${formId}/groups/`),
      ]);
      setFormUsers(usersRes.data ?? []);
      setFormGroups(groupsRes.data ?? []);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to fetch users/groups",
        position: "top",
      });
      setFormUsers([]);
      setFormGroups([]);
    }
  }, []);

  const handleOpenSharePopup = useCallback(async () => {
    if (formId) {
      await fetchFormUsersAndGroups(formId);
      setShowSharePopup(true);
    } else {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No form ID available for sharing.",
        position: "top",
      });
    }
  }, [formId, fetchFormUsersAndGroups]);

  const handleShare = async (shareSelection?: {
    users?: number[];
    groups?: number[];
    location_leaders?: number[];
  }) => {
    const usersToShare = shareSelection?.users ?? selectedUsers;
    const groupsToShare = shareSelection?.groups ?? selectedGroups;
    const leadersToShare = shareSelection?.location_leaders ?? [];

    const submissionId = submissionsDetail?.id || persistentFormSubmissionId.current;
    if (!submissionId) {
      Toast.show({
        type: "error",
        text1: "No submission ID available",
        position: "top",
      });
      return false;
    }
    if (!formId) {
      Toast.show({
        type: "error",
        text1: "No form ID available",
        position: "top",
      });
      return false;
    }

    // Check if form allows sharing
    try {
      // console.log("🔍 Checking form sharing permissions...");
      const formResponse = await api.get(`/form/${formId}/`);
      // console.log("📋 Form response:", formResponse.data);

      const rawShareFlag =
        formResponse.data?.share_response ??
        formResponse.data?.allow_share ??
        false;
      const shareResponse =
        typeof rawShareFlag === "string"
          ? rawShareFlag.toLowerCase() === "true"
          : Boolean(rawShareFlag);

      if (!shareResponse) {
        Toast.show({
          type: "error",
          text1: "Sharing Disabled",
          text2: "This form is not enabled for sharing.",
          position: "top",
        });
        return false;
      }
    } catch (error) {
    }

    const payload = {
      users: usersToShare.length ? usersToShare : [],
      groups: groupsToShare.length ? groupsToShare : [],
      location_leaders: leadersToShare.length ? leadersToShare : [],
    };

    try {
      setSubmitting(true);

      const toNumericId = (value: any): number | null => {
        const parsed =
          typeof value === "object" && value !== null ? value.id : value;
        const normalized = Number(parsed);
        return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
      };

      const submissionIdNum = toNumericId(submissionId);
      const persistentSubmissionId = toNumericId(persistentFormSubmissionId.current);
      const passedSubmissionId = toNumericId(formSubmissionId);
      const overrideShareFormId = toNumericId(shareFormIdOverride);
      const requestedFormId = toNumericId(formId);
      const submissionFormId = toNumericId((submissionsDetail as any)?.form);
      const stageFormId = toNumericId((currentStage as any)?.form);
      const formIdCandidates = Array.from(
        new Set(
          [overrideShareFormId, requestedFormId, submissionFormId, stageFormId].filter(
            (id): id is number => id !== null
          )
        )
      );
      const submissionIdCandidates = Array.from(
        new Set(
          [submissionIdNum, persistentSubmissionId, passedSubmissionId].filter(
            (id): id is number => id !== null
          )
        )
      );
      const shareUrlCandidates = Array.from(
        new Set(
          formIdCandidates.flatMap((candidateFormId) => {
            const urls: string[] = [];
            for (const candidateSubmissionId of submissionIdCandidates) {
              // Expected order: /share/{form_id}/{submission_id}/
              urls.push(`/form/submission/share/${candidateFormId}/${candidateSubmissionId}/`);
              // Backend fallback: /share/{submission_id}/{form_id}/
              urls.push(`/form/submission/share/${candidateSubmissionId}/${candidateFormId}/`);
            }
            return urls;
          })
        )
      );
      if (shareUrlCandidates.length === 0) {
        throw new Error("No valid form/submission IDs available for sharing.");
      }

      let res: any = null;
      let lastShareError: any = null;

      for (const shareUrl of shareUrlCandidates) {
        try {

          res = await api.post(shareUrl, payload);
          break;
        } catch (candidateError: any) {
          lastShareError = candidateError;
          const statusCode = candidateError?.response?.status ?? candidateError?.status;
          const errorDetail =
            candidateError?.response?.data?.detail ||
            candidateError?.data?.detail ||
            candidateError?.message ||
            "";
          const isRetryable404 =
            statusCode === 404 &&
            (
              String(errorDetail).toLowerCase().includes("no form matches") ||
              String(errorDetail).toLowerCase().includes("not found")
            );

          if (!isRetryable404) {
            throw candidateError;
          }
        }
      }

      if (!res) {
        throw lastShareError || new Error("Failed to share form.");
      }


      Toast.show({
        type: "success",
        text1: "Shared successfully",
        text2: "Receiver: Check your 'Received' tab and refresh!",
        position: "top",
      });

      await getStageAssignUuid();
      await getReceivedStageAssignUuid();
      setShowSharePopup(false);
      setShowShareButton(false);
      setSelectedUsers([]);
      setSelectedGroups([]);
      return true;
    } catch (error: any) {
      let errorMsg =
        error?.response?.data?.detail ||
        error?.data?.detail ||
        error.message ||
        "Failed to share form.";
      if (error?.response?.status === 403) {
        errorMsg = "You lack permission to share this form.";
      }
      Toast.show({
        type: "error",
        text1: "Failed to share",
        text2: errorMsg,
        position: "top",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const triggerAutoShare = useCallback(async (autoShareConfig: any, submissionId: number) => {
    if (!autoShareConfig || !submissionId) {
      return;
    }

    try {
      // CRITICAL: Check if current user is the last stage submitter (backend requirement)
      // Get form details to find the last stage
      const formResponse = await api.get(`/form/${formId}/`);
      const stages = formResponse.data.stages || formResponse.data.audit_group || [];

      if (stages.length === 0) {
        return;
      }

      // Find the last stage (highest order)
      const lastStage = stages.reduce((latest: any, current: any) => {
        return (!latest || current.order > latest.order) ? current : latest;
      }, null);

      if (!lastStage) {
        return;
      }

      // Check if current user completed the last stage
      const lastStageHistory = await api.get(`/form/stage/history/${submissionId}/${lastStage.id}/`);
      const completions = lastStageHistory.data || [];

      if (completions.length === 0) {
        return;
      }

      // Find the most recent completion
      const lastCompletion = completions[0]; // Already ordered by '-completed_on' in backend
      if (lastCompletion.completed_by !== user.id) {
        Toast.show({
          type: "error",
          text1: "Auto-share Blocked",
          text2: "Only the user who completed the last stage can auto-share this form.",
          position: "top",
        });
        return;
      }

      const payload = {
        users: autoShareConfig.users || [],
        groups: autoShareConfig.groups || [],
        location_leaders: autoShareConfig.location_leaders || [],
      };

      const response = await api.post(`/form/submission/share/${formId}/${submissionId}/`, payload);
      Toast.show({
        type: "success",
        text1: "Auto-shared",
        text2: "Form automatically shared with configured users/groups",
        position: "top",
      });

    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Auto-share Failed",
        text2: "Failed to auto-share form",
        position: "top",
      });
    }
  }, [formId, user.id]);

  const evaluateFormula = (formula: string, values: any): string => {
    try {
      const replacedFormula = formula.replace(/#(\w+)/g, (match, varName) => {
        const question = allQuestions.find((q: any) => q?.question === varName);
        if (question && values[question.question_uuid]) {
          return values[question.question_uuid].toString();
        }
        return "0";
      });
      if (replacedFormula.includes("SUM")) {
        const sumParts = replacedFormula.match(/SUM\(([^)]+)\)/);
        if (sumParts) {
          const numbers = sumParts[1].split(",").map(Number);
          const sum = numbers.reduce((a, b) => a + b, 0);
          const multiplierMatch = replacedFormula.match(/(\d+)/);
          const multiplier = multiplierMatch ? Number(multiplierMatch[1]) : 1;
          return (sum * multiplier).toString();
        }
      }
      return eval(replacedFormula).toString();
    } catch (error) {
      return "";
    }
  };

  return {
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
    onEditSubmit,
    handleFormSubmission,
    handleSubmitForm,
    handleEditForm,
    goToPrevStage,
    goToNextStage,
    goToStage,
    evaluateFormula,
    visibleQuestions,
    activeModal,
    watch,
    setValue,
    getValues,
    reset,
    submitting,
    setCurrentStageIndex,
    validationErrors,
    validateAllFields,
    trigger,
    showSharePopup,
    setShowSharePopup,
    formUsers,
    formGroups,
    handleOpenSharePopup,
    showShareButton,
    setShowShareButton,
    isFormEnabledForSharing,
    selectedUsers,
    setSelectedUsers,
    selectedGroups,
    setSelectedGroups,
    handleShare,
    queueBackgroundSubmission,
    getStageAssignUuid,
    getReceivedStageAssignUuid,
    submittedData,
    stageSubmitted,
    showSuccessModal,
    setShowSuccessModal,
    assignedFolders,
    fetchAssignedFolders,
    isLastStageSubmitter,
    isManualShareEnabled,
    setIsManualShareEnabled,
    isAutoShareEnabled,
    setIsAutoShareEnabled: (value: boolean) => {
      // This is a no-op since we're receiving the value from context
    },
  };
};
