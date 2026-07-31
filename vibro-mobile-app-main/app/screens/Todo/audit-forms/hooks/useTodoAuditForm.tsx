import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "react-native";
import Toast from "react-native-toast-message";
import uuid from 'react-native-uuid';
import { useDispatch, useSelector } from "react-redux";
import { fetchFormAssignments } from "../../../../../Redux/actions/formAssignmentActions";
import { fetchFormReceived } from "../../../../../Redux/actions/formReceivedActions";
import { fetchGroupAssignments } from "../../../../../Redux/actions/groupAssignmentAction";
import api from "../../../../../services";
import { backgroundSyncService } from "../../../../../services/backgroundSyncService";
import { GETALLASSIGNEDSTAGESACCESSID, GETAUDITFORMGROUPASSINGEDUUID, RECEIVED, SUBMIT_GROUP_ANSWER } from "../../../../../services/constants";
import { matchLogicCondition } from "../../../../../services/matchLogicCondition";
import { networkService } from "../../../../../services/networkService";
import { offlineStorageService } from "../../../../../services/offlineStorageService";
import { RootState } from "../../../../../store";
import {
  AuditScoreInfo,
  Form,
  Logic,
  Option,
  Question,
  Stage,
  SubmissionsDetail,
} from "../../../../../components/form/types/formTypes";
import { generateValidationSchema } from "../../../../../components/form/utils/validationSchemas";

/**
 * Helper function to check if a value is empty based on question type
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
      return !value || (typeof value === "string" && value.split("|").filter(Boolean).length === 0);
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

/**
 * Get visible logic indexes for a question based on current form values
 * This determines which sub-questions (logic_questions) should be visible
 */
const getVisibleLogicIndexesForQuestion = (
  question: Question,
  formValues: any
): number[] => {
  if (!question?.logics?.length) return [];

  const visibleLogicIndexes: number[] = [];
  const currentValue = formValues[question.question_uuid];

  // Skip if no value selected for parent question
  if (currentValue === undefined || currentValue === null) return [];

  // Handle different question types to extract selected option values
  let selectedOptionValues: (string | number)[] = [];

  switch (question.question_type) {
    case "short_answer":
    case "long_answer":
      // For text fields, use the value directly
      if (currentValue && typeof currentValue === "string" && currentValue.trim()) {
        selectedOptionValues = [currentValue.trim()];
      }
      break;
    case "dropdown":
      // For dropdown, find the option by ID
      if (question.options?.length) {
        const selectedOption = question.options.find((opt: any) => opt.id === currentValue);
        if (selectedOption) {
          selectedOptionValues = [selectedOption.option];
        }
      }
      break;
    case "multiple_choice":
    case "checkboxes":
      // For multiple choice, extract option values from selected items
      if (Array.isArray(currentValue) && question.options?.length) {
        selectedOptionValues = currentValue
          .filter((item: any) => item?.id)
          .map((item: any) => question.options.find(opt => opt.id === item.id)?.option)
          .filter((value): value is string => value !== undefined);
      }
      break;
    case "audit":
      // For audit questions, value is stored as [{ id: optionId }] or just the optionId
      if (question.options?.length) {
        if (Array.isArray(currentValue)) {
          // Value is array like [{ id: optionId }]
          selectedOptionValues = currentValue
            .filter((item: any) => item?.id)
            .map((item: any) => question.options.find(opt => opt.id === item.id)?.option)
            .filter((value): value is string => value !== undefined);
        } else {
          // Value might be the option ID directly
          const selectedOption = question.options.find(opt => opt.id === currentValue);
          if (selectedOption) {
            selectedOptionValues = [selectedOption.option];
          }
        }
      }
      break;
    case "linear_scale":
      // For linear scale, use the numeric value
      if (typeof currentValue === "object" && currentValue?.[question.question_uuid] !== undefined) {
        selectedOptionValues = [currentValue[question.question_uuid]];
      } else if (typeof currentValue === "number") {
        selectedOptionValues = [currentValue];
      }
      break;
    default:
      if (currentValue) {
        selectedOptionValues = [currentValue];
      }
  }

  // Check each logic condition
  question.logics.forEach((logic: Logic, index: number) => {
    const passes = selectedOptionValues.some((selectedValue) =>
      matchLogicCondition(
        selectedValue,
        logic.logic_value,
        logic.logic_type,
        logic.comparison
      )
    );
    if (passes) {
      visibleLogicIndexes.push(index);
    }
  });

  return visibleLogicIndexes;
};

/**
 * Collect all visible logic questions and sub-questions from all questions based on current form values
 * This recursively collects sub-questions that are currently visible
 */
export const collectVisibleLogicQuestions = (
  allQuestions: Question[],
  formValues: any
): Question[] => {
  const visibleLogicQuestions: Question[] = [];
  const addedUuids = new Set<string>(); // Track added question UUIDs to avoid duplicates

  const addQuestion = (question: Question) => {
    if (!addedUuids.has(question.question_uuid)) {
      addedUuids.add(question.question_uuid);
      visibleLogicQuestions.push(question);
    }
  };

  const collectFromQuestion = (question: Question) => {
    const currentValue = formValues[question.question_uuid];
    const hasValue = currentValue !== undefined && currentValue !== null &&
      (Array.isArray(currentValue) ? currentValue.length > 0 : true);

    // For audit questions, ALWAYS collect sub_questions (they're always visible when parent is visible)
    // This ensures validation counts them regardless of whether parent has a value
    if (question.question_type === "audit" && question.sub_questions?.length) {
      question.sub_questions.forEach((subQuestion) => {
        addQuestion(subQuestion);
        // Recursively collect from sub-questions (they may have their own logics)
        collectFromQuestion(subQuestion);
      });
    }

    // Collect logic_questions based on selected values (these ARE conditional)
    if (question.logics?.length) {
      const visibleLogicIndexes = getVisibleLogicIndexesForQuestion(question, formValues);

      visibleLogicIndexes.forEach((logicIndex) => {
        const logic = question.logics[logicIndex];
        if (logic?.logic_questions?.length) {
          logic.logic_questions.forEach((logicQuestion) => {
            addQuestion(logicQuestion);
            // Recursively collect nested logic questions
            collectFromQuestion(logicQuestion);
          });
        }
      });
    }
  };

  allQuestions.forEach(collectFromQuestion);

  return visibleLogicQuestions;
};

export const useTodoAuditForm = (
  stages: Stage[] | any,
  submissionsDetail?: SubmissionsDetail,
  formData?: Form,
  auditInfo?: Stage,
  draftData?: any,
  draftId?: string
) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Include both audit info questions and stage questions
  const auditInfoQuestions = auditInfo?.questions || [];
  const stageQuestions = (stages || []).flatMap(
    (stage: any) => stage?.questions || []
  );
  const questions: Question[] = [...auditInfoQuestions, ...stageQuestions];

  const getInitialScores = useCallback(() => {
    if (!draftData) return {};
    const scores: Record<string, number> = {};
    const allQuestionsForScore = [...auditInfoQuestions, ...stageQuestions];
    for (const q of allQuestionsForScore) {
      if (q.question_type === 'audit' && draftData[q.question_uuid]) {
        const selectedOption = q.options?.find((opt: Option) => String(opt.id) === String(draftData[q.question_uuid]));
        if (selectedOption) {
          scores[q.id] = selectedOption.score || 0;
        }
      }
    }
    return scores;
  }, [draftData, auditInfoQuestions, stageQuestions]);

  const [selectedScores, setSelectedScores] = useState<Record<string, number>>(
    getInitialScores()
  );

  // Calculate group score
  const calculateGroupScore = useCallback(
    (questions: Question[]): number => {
      return questions
        .filter((q) => q.question_type === "audit")
        .reduce((sum, q) => sum + (selectedScores[q.id] || 0), 0);
    },
    [selectedScores]
  );

  useEffect(() => {
    // Only run if submissionsDetail exists and is completed
    if (submissionsDetail?.is_completed && formData?.audit_group) {
      const scores: Record<string, number> = {};

      // Loop through all groups and questions
      formData.audit_group.forEach((group) => {
        group.questions.forEach((question) => {
          if (question.question_type === "audit" && question.answers?.answer) {
            // Find the selected option's score
            const selectedOption = question.options?.find(
              (opt) => String(opt.id) === String(question.answers.answer)
            );
            scores[question.id] = selectedOption?.score || 0;
          }
        });
      });

      setSelectedScores(scores);
    }
  }, [submissionsDetail, formData]);

  // 1. Helper: Get max score for a single question
  const getMaxScoreForQuestion = (question: Question) => {
    if (!question.options || question.options.length === 0) return 0;
    return Math.max(...question.options.map((opt) => opt.score || 0));
  };

  const groupOrderMap = useMemo(() => {
    const map: Record<string, number> = {};
    formData?.audit_group?.forEach((group: any, index: number) => {
      const candidateIds = [
        group?.id,
        group?.audit_group,
        group?.group_id,
        group?.uuid,
        group?.name,
      ];
      candidateIds.forEach((id) => {
        if (id !== undefined && id !== null) {
          const key = String(id);
          if (map[key] === undefined) {
            map[key] = index + 1;
          }
        }
      });
    });
    return map;
  }, [formData?.audit_group]);

  // 2. Group questions and calculate scores
  const groupScores: AuditScoreInfo[] = useMemo(() => {
    const groupsMap: Record<string, AuditScoreInfo> = {};

    formData?.audit_group?.forEach((group) => {
      group?.questions?.forEach((q) => {
        if (!q.audit_group) return;

        const maxScore = q.max_score;
        const userScore = selectedScores[q.id] || 0;

        if (!groupsMap[q.audit_group]) {
          const groupNumber =
            groupOrderMap[String(q.audit_group)] ??
            Object.keys(groupsMap).length + 1;
          groupsMap[q.audit_group] = {
            groupId: q.audit_group,
            groupTitle: `Group ${groupNumber}`,
            maxScore: 0,
            userScore: 0,
            percentage: 0,
            passPercentage: formData.pass_percentage || 0,
            passed: false,
            questions: [],
            critical: q.critical,
          };
        }

        groupsMap[q.audit_group].maxScore += maxScore;
        groupsMap[q.audit_group].userScore += userScore;
        groupsMap[q.audit_group].questions.push(q);
        // If passPercentage is set at group level, keep it
        if (q.pass_percentage) {
          groupsMap[q.audit_group].passPercentage = q.pass_percentage;
        }
      });
    });

    // Calculate percentages and pass/fail
    Object.values(groupsMap).forEach((group) => {
      group.percentage =
        group.maxScore > 0
          ? Math.round((group.userScore / group.maxScore) * 100)
          : 0;
      group.passed = group.percentage >= (group.passPercentage || 0);
    });

    return Object.values(groupsMap);
  }, [questions, selectedScores, groupOrderMap, formData?.pass_percentage]);

  // 3. Form totals
  const formMaxScore = useMemo(
    () => groupScores.reduce((sum, g) => sum + g.maxScore, 0),
    [groupScores]
  );

  const formUserScore = useMemo(
    () => groupScores.reduce((sum, g) => sum + g.userScore, 0),
    [groupScores]
  );

  const formPercentage = formMaxScore
    ? Math.round((formUserScore / formMaxScore) * 100)
    : 0;

  // 4. Update user score when selecting an option
  const updateScore = (questionId: string, score: number) => {
    setSelectedScores((prev) => ({ ...prev, [questionId]: score }));
  };

  // 5. Helper: Check if a group passed
  const isGroupPassed = (groupId: string) => {
    const group = groupScores.find((g) => g.groupId === groupId);
    return group ? group.passed : false;
  };

  const assignments = useSelector(
    (state: RootState) => state.groupAssignments.data
  );
  const receivedAssignment = useSelector(
    (state: RootState) => state.formReceived.data
  );
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user);

  const allQuestions = [...auditInfoQuestions, ...stageQuestions];

  const [visibleQuestions, setVisibleQuestions] = useState<Set<string>>(
    new Set()
  );
  const [activeModal, setActiveModal] = useState<any>(null);

  const currentStage = stages[currentStageIndex];
  const resolvedOrganizationId = useMemo(() => {
    const candidates = [
      (user as any)?.organizationId,
      (user as any)?.organization_id,
      (user as any)?.organization?.id,
      (formData as any)?.organization,
      (formData as any)?.organization_id,
      (formData as any)?.organization?.id,
      (currentStage as any)?.organization,
      (currentStage as any)?.organization_id,
      (currentStage as any)?.organization?.id,
    ];

    for (const candidate of candidates) {
      const value =
        typeof candidate === "object" && candidate !== null
          ? candidate.id
          : candidate;
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return 0;
  }, [currentStage, formData, user]);
  const isFirstStage = currentStageIndex === 0;
  const isLastStage = currentStageIndex === stages.length - 1;

  const validationSchema = generateValidationSchema(allQuestions);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    getValues,
    reset,
    trigger,
  } = useForm({
    // resolver: yupResolver(validationSchema),
    defaultValues: draftData || {},
    mode: "onChange",
  });

  const goToNextStage = () => {
    if (currentStageIndex < stages.length - 1) {
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
    if (index >= 0 && index < stages.length) {
      setCurrentStageIndex(index);
    }
  };

  const getStageAssignUuid = async () => {
    try {
      const response = (await api.get(
        `${GETALLASSIGNEDSTAGESACCESSID}${user.id}/`
      )) as any;
      dispatch(fetchFormAssignments(response.data));
    } catch (error) {
      // Don't show error toast if offline (common when working with drafts)
      if (!networkService.isOffline()) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to fetch stage assignments.",
          position: "top",
        });
      }
    }
  };
  const getReceivedStageAssignUuid = async () => {
    try {
      const response = (await api.get(`${RECEIVED}${user.id}/`)) as any;
      dispatch(fetchFormReceived(response.data));
    } catch (error: any) {
      // Don't show error toast if offline (common when working with drafts)
      if (!networkService.isOffline()) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to fetch received assignments.",
          position: "top",
        });
      }
    }
  };

  const getGroupAssignments = async () => {
    // When offline, avoid API calls and just return any assignments already in Redux
    if (networkService.isOffline()) {
      return assignments || [];
    }

    try {
      const response = (await api.get(GETAUDITFORMGROUPASSINGEDUUID)) as any;
      dispatch(fetchGroupAssignments(response.data));
      return response.data;
    } catch (error: any) {
      throw error;
    }
  };

  const onSubmit = async (data: any) => {
    setSubmitting(true);

    let payload: any = {
      form: formData?.id,
      answers: [] as any[],
    };

    try {
      const extractId = (val: any) =>
        typeof val === "object" && val !== null && "id" in val ? val.id : val;

      const extractOtherTextFromValue = (val: any): string | undefined => {
        if (!Array.isArray(val)) return undefined;
        const otherItem = val.find(
          (item: any) => item?.isOther && typeof item?.text === "string",
        );
        const text = otherItem?.text?.trim();
        return text || undefined;
      };

      const extractChoiceAnswerValue = (val: any): string => {
        const ids = val
          .filter((item: any) => !item?.isOther)
          .map(extractId)
          .filter(
            (v: any) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              typeof v !== "object",
          );
        return ids.join("|");
      };

      let groupAssignmentUuid: string | undefined;

      const freshAssignments = await getGroupAssignments();
      // Use fresh assignments to find the UUID
      groupAssignmentUuid = freshAssignments.find(
        (assign: any) => assign.formId == Number(formData?.id)
      )?.assignmentUuid;

      // If still no assignment UUID found, try to get from AsyncStorage for audit forms
      if (!groupAssignmentUuid && formData?.form_type === 'audit') {
        const storedUuid = await AsyncStorage.getItem(`audit_form_${formData?.id}_uuid`);
        if (storedUuid) {
          groupAssignmentUuid = storedUuid;
        }
      }

      // For audit forms, if still no UUID found, generate a temporary one for first submission
      if (!groupAssignmentUuid && formData?.form_type === 'audit') {
        groupAssignmentUuid = uuid.v4();
      }

      // If still no assignment UUID found, throw an error
      if (!groupAssignmentUuid) {
        throw new Error("Group assignment UUID not found. Please ensure you have been assigned to this form.");
      }

      payload.group_assignment_uuid = groupAssignmentUuid;

      const handleAnswer = (meta: any, val: any) => {
        const otherText = extractOtherTextFromValue(val);
        let answerValue: string;

        if (
          Array.isArray(val) &&
          ["dropdown", "checkboxes", "multiple_choice", "audit"].includes(
            meta.question_type,
          )
        ) {
          answerValue = extractChoiceAnswerValue(val);
          if (!answerValue && !otherText) {
            return;
          }
        } else {
          answerValue = String(extractId(val));
        }

        const answer: any = {
          question_uuid: meta.question_uuid,
          question: meta.id,
          question_type: meta.question_type,
          answer: answerValue,
          group: null,
          division: null,
          sub_division: null,
          location: null,
          user: null,
        };

        if (otherText) {
          answer.other_text = otherText;
        }

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
          !payload.answers.some(
            (ans: any) => ans.question_uuid === meta.question_uuid
          )
        ) {
          payload.answers.push(answer);
        }
      };

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

      for (const [question_uuid, value] of Object.entries(data)) {
        const questionMeta = allQuestionsMap.get(question_uuid);

        if (!questionMeta) {
          continue;
        }

        if (questionMeta.question_type === "table" && Array.isArray(value)) {
          for (const row of value) {
            for (const [subQUuid, subValue] of Object.entries(row)) {
              const subMeta = allQuestionsMap.get(subQUuid);
              if (subMeta) {
                handleAnswer(subMeta, subValue);
              }
            }
          }
        } else if (questionMeta.question_type === "audit") {
          handleAnswer(questionMeta, value);
          if (questionMeta.sub_questions) {
            questionMeta.sub_questions.forEach((subQ: any) => {
              if (data[subQ.question_uuid] !== undefined) {
                handleAnswer(subQ, data[subQ.question_uuid]);
              }
            });
          }
        } else {
          handleAnswer(questionMeta, value);
        }
      }

      for (const [key, value] of Object.entries(data)) {
        if (
          !key.endsWith("_other") ||
          !value ||
          typeof value !== "string" ||
          !value.trim()
        ) {
          continue;
        }

        const questionUuid = key.replace(/_other$/, "");
        const questionMeta = allQuestionsMap.get(questionUuid);
        if (
          !questionMeta ||
          !["multiple_choice", "checkboxes", "dropdown"].includes(
            questionMeta.question_type,
          )
        ) {
          continue;
        }

        const existingAnswerIndex = payload.answers.findIndex(
          (ans: any) => ans.question_uuid === questionMeta.question_uuid,
        );
        if (existingAnswerIndex >= 0) {
          payload.answers[existingAnswerIndex].other_text = value.trim();
        } else {
          payload.answers.push({
            question_uuid: questionMeta.question_uuid,
            question: questionMeta.id,
            question_type: questionMeta.question_type,
            answer: "",
            other_text: value.trim(),
            group: null,
            division: null,
            sub_division: null,
            location: null,
            user: null,
          });
        }
      }

      // Check for offline status
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

        await offlineStorageService.storeSubmission({
          formId: Number(formData!.id),
          userId: user.id!,
          organizationId: resolvedOrganizationId,
          submissionType: 'audit',
          groupAssignmentUuid: groupAssignmentUuid,
          data: payload,
        });

        Toast.show({
          type: "info",
          text1: "You are offline",
          text2: "Your submission has been saved and will be synced later.",
          position: "top",
        });

        // Trigger background sync immediately if online (in case network state changed)
        setTimeout(async () => {
          try {
            const syncResult = await backgroundSyncService.forceSync();
            if (syncResult.syncedCount > 0) {
              // Show success message for sync
              if (syncResult.success) {
                Toast.show({
                  type: "success",
                  text1: "Sync Complete",
                  text2: "Your offline submission has been synced successfully.",
                  position: "top",
                });
              }
            }
          } catch (error) {
          }
        }, 1000);

        // If this submission came from a draft, remove the draft after storing offline
        if (draftId) {
          try {
            await offlineStorageService.removeDraft(draftId);
          } catch (draftError) {
          }
        }

        router.push("/(app)/(tabs)/todo");
        return;
      }

      // Proceed with online submission
      // console.log("📦 Final Payload:", JSON.stringify(payload, null, 2));
      const res = await api.post(SUBMIT_GROUP_ANSWER, payload);
      // console.log("✅ API Response:", res.data?.message);

      // Store the assignment_uuid for audit forms
      if (formData?.form_type === 'audit' && res.data.assignment_uuid) {
        await AsyncStorage.setItem(`audit_form_${formData?.id}_uuid`, res.data.assignment_uuid);
      }

      setTimeout(() => {
        Toast.show({
          type: "success",
          text1: "Form submitted successfully",
          position: "top",
        });
      }, 2);

      if (res?.data?.next_stage_assigning_required) {
        getStageAssignUuid();
        getReceivedStageAssignUuid();
      } else {
        router.push("/(app)/(tabs)/todo");
      }

      // If this form was resumed from a draft and submission succeeded online,
      // remove the corresponding draft so it no longer appears under Drafts.
      if (draftId) {
        try {
          await offlineStorageService.removeDraft(draftId);
        } catch (draftError) {
        }
      }
    } catch (error: any) {
      // If we hit a network error while THINKING we're online, treat it as offline submission
      const isNetworkError =
        (error?.isAxiosError && error?.message === "Network Error") ||
        (typeof error?.message === "string" && error.message.includes("Network Error"));

      let isConfirmedOffline = false;
      if (isNetworkError) {
        try {
          const refreshedStatus = await networkService.refresh();
          isConfirmedOffline =
            !refreshedStatus.isConnected ||
            refreshedStatus.isInternetReachable === false;
        } catch {
          isConfirmedOffline = networkService.isOffline();
        }
      }

      if (isNetworkError && isConfirmedOffline && formData?.id && user?.id) {
        try {
          await offlineStorageService.storeSubmission({
            formId: Number(formData.id),
            userId: user.id,
            organizationId: resolvedOrganizationId,
            submissionType: "audit",
            groupAssignmentUuid: undefined,
            data: {
              ...payload,
            },
          });

          Toast.show({
            type: "info",
            text1: "You are offline",
            text2: "Your submission has been saved and will be synced later.",
            position: "top",
          });

          if (draftId) {
            try {
              await offlineStorageService.removeDraft(draftId);
            } catch (draftError) {
            }
          }

          router.push("/(app)/(tabs)/todo");
          return;
        } catch (offlineErr) {
        }
      }

      const errorMsg =
        error?.response?.data?.error ||
        error?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        "An error occurred. Please try again.";
      Alert.alert("Submission Failed", errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Check if all required questions are filled (including visible sub-questions)
  const areAllRequiredQuestionsFilled = useCallback(
    (formValues: any) => {
      // Check top-level questions
      for (const question of allQuestions) {
        if (!question.is_required) continue;

        // Skip title_and_description questions for required validation
        if (question.question_type === 'title_and_description') continue;

        const value = formValues[question.question_uuid];

        // Check based on question type
        switch (question.question_type) {
          case "short_answer":
          case "long_answer":
            if (!value || (typeof value === "string" && value.trim() === "")) {
              return false;
            }
            break;
          case "dropdown":
          case "division":
          case "sub_division":
          case "location":
          case "user":
            if (!value || (typeof value === "object" && !value?.id)) {
              return false;
            }
            break;
          case "multiple_choice":
          case "checkboxes":
            if (!Array.isArray(value) || value.length === 0) {
              return false;
            }
            break;
          case "date":
          case "time":
          case "datetime":
            if (!value) {
              return false;
            }
            break;
          case "linear_scale":
            if (value === undefined || value === null) {
              return false;
            }
            break;
          case "upload_image":
          case "upload_video":
          case "upload_audio":
          case "upload_file":
            if (!value || (typeof value === "string" && value.split("|").filter(Boolean).length === 0)) {
              return false;
            }
            break;
          case "audit":
            if (!value) {
              return false;
            }
            break;
          case "signature":
            if (!value) {
              return false;
            }
            break;
          case "table":
            if (!Array.isArray(value) || value.length === 0) {
              return false;
            }
            // For table, check if all rows have required sub-questions filled
            for (const row of value) {
              for (const subQ of question.sub_questions || []) {
                if (subQ.is_required) {
                  const subValue = row[subQ.question_uuid];
                  if (!subValue || (typeof subValue === "string" && subValue.trim() === "")) {
                    return false;
                  }
                }
              }
            }
            break;
          default:
            if (!value) {
              return false;
            }
        }
      }

      // Also check visible logic questions (sub-questions)
      const visibleLogicQuestions = collectVisibleLogicQuestions(allQuestions, formValues);
      for (const logicQuestion of visibleLogicQuestions) {
        if (!logicQuestion.is_required) continue;
        if (logicQuestion.question_type === 'title_and_description') continue;

        const value = formValues[logicQuestion.question_uuid];
        if (isValueEmpty(value, logicQuestion.question_type)) {
          return false;
        }
      }

      return true;
    },
    [allQuestions]
  );

  return {
    currentStage,
    currentStageIndex,
    isFirstStage,
    isLastStage,
    completedStages,
    control,
    errors,
    isValid,
    isDirty,
    handleSubmit,
    onSubmit,
    goToPrevStage,
    goToNextStage,
    goToStage,
    visibleQuestions,
    activeModal,
    watch,
    setValue,
    submitting,
    groupScores,
    formMaxScore,
    formUserScore,
    formPercentage,
    updateScore,
    selectedScores,
    isGroupPassed,
    calculateGroupScore,
    trigger,
    areAllRequiredQuestionsFilled,
  };
};
