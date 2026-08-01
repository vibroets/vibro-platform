import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AppState, type AppStateStatus } from "react-native";
import Toast from "react-native-toast-message";
import uuid from "react-native-uuid";
import { useDispatch, useSelector } from "react-redux";
import { fetchFormAssignments } from "../../../Redux/actions/formAssignmentActions";
import { fetchFormReceived } from "../../../Redux/actions/formReceivedActions";
import { fetchGroupAssignments } from "../../../Redux/actions/groupAssignmentAction";
import api from "../../../services";
import { backgroundSyncService } from "../../../services/backgroundSyncService";
import {
  GETALLASSIGNEDSTAGESACCESSID,
  GETAUDITFORMGROUPASSINGEDUUID,
  RECEIVED,
  SUBMIT_GROUP_ANSWER,
  PLANNER_COLLABORATIVE_SUBMIT_GROUP,
} from "../../../services/constants";
import { matchLogicCondition } from "../../../services/matchLogicCondition";
import { networkService } from "../../../services/networkService";
import { offlineStorageService } from "../../../services/offlineStorageService";
import { RootState } from "../../../store";
import {
  AuditScoreInfo,
  Form,
  Logic,
  Question,
  Stage,
  SubmissionsDetail,
} from "../types/formTypes";
import { generateValidationSchema } from "../utils/validationSchemas";
import { FormStateManager, QuestionWithUniqueId, getFormKey, FormState, isValueEmpty, validateRequiredQuestions, countMissingRequiredFields } from "../utils/formStateManagement";
import { NavigationManager, getAccordionIndex, calculateScrollTarget, isValidQuestionUuid, getNavigationContext } from "../utils/navigationManagement";

const getFormValueForQuestion = (question: Question, formValues: any) => {
  const uniqueId = (question as any).uniqueId;
  if (
    uniqueId &&
    formValues &&
    Object.prototype.hasOwnProperty.call(formValues, uniqueId)
  ) {
    return formValues[uniqueId];
  }
  return formValues?.[question.question_uuid];
};

/**
 * Get visible logic indexes for a question based on current form values
 * This determines which sub-questions (logic_questions) should be visible
 */
export const getVisibleLogicIndexesForQuestion = (
  question: Question,
  formValues: any,
): number[] => {


  if (!question?.logics?.length) {
    return [];
  }

  const visibleLogicIndexes: number[] = [];
  const currentValue = getFormValueForQuestion(question, formValues);

  // Skip if no value selected for parent question
  if (currentValue === undefined || currentValue === null) {
    return [];
  }

  // Handle different question types to extract selected option values
  let selectedOptionValues: (string | number)[] = [];

  switch (question.question_type) {
    case "short_answer":
    case "long_answer":
      // For text fields, use the value directly
      if (
        currentValue &&
        typeof currentValue === "string" &&
        currentValue.trim()
      ) {
        selectedOptionValues = [currentValue.trim()];
      }
      break;
    case "dropdown":
      // For dropdown, find the option by ID
      if (question.options?.length) {
        const selectedOption = question.options.find(
          (opt) => opt.id === currentValue,
        );
        if (selectedOption) {
          selectedOptionValues = [selectedOption.option];
        }
      }
      break;
    case "multiple_choice":
    case "checkboxes":

      // Handle multiple possible formats for multiple choice values
      if (Array.isArray(currentValue)) {
        // Array format: [{id: optionId}] or [optionId] or [optionText]
        selectedOptionValues = currentValue
          .filter((item: any) => item !== null && item !== undefined)
          .map((item: any) => {
            if (typeof item === "object" && item?.id !== undefined) {
              // Format: [{id: optionId}]
              const foundOption = question.options?.find(
                (opt) => opt.id === item.id,
              );
              return foundOption ? foundOption.option : item.id;
            } else if (typeof item === "number" || typeof item === "string") {
              // Format: [optionId] or [optionText]
              if (question.options?.length) {
                const foundOption = question.options.find(
                  (opt) => opt.id === item || opt.option === item,
                );
                return foundOption ? foundOption.option : item;
              }
              return item;
            }
            return item;
          });
      } else if (
        typeof currentValue === "number" ||
        typeof currentValue === "string"
      ) {
        // Single value format: optionId or optionText
        if (question.options?.length) {
          const foundOption = question.options.find(
            (opt) => opt.id === currentValue || opt.option === currentValue,
          );
          selectedOptionValues = foundOption
            ? [foundOption.option]
            : [currentValue];
        } else {
          selectedOptionValues = [currentValue];
        }
      } else {
        selectedOptionValues = [currentValue];
      }
      break;
    case "audit":
      // For audit questions, value is stored as [{ id: optionId }] or just the optionId
      // But logic_value is stored as option text, so we need to extract option text
      if (Array.isArray(currentValue)) {
        // Value is array like [{ id: optionId }]
        selectedOptionValues = currentValue
          .filter((item: any) => item?.id)
          .map((item: any) => {
            // Find the option text that matches this ID
            const foundOption = question.options?.find(
              (opt) => opt.id === item.id,
            );
            return foundOption ? foundOption.option : item.id;
          });
      } else {
        // Value might be the option ID directly - find the option text
        if (question.options?.length) {
          const foundOption = question.options.find(
            (opt) => opt.id === currentValue,
          );
          selectedOptionValues = foundOption
            ? [foundOption.option]
            : [currentValue];
        } else {
          selectedOptionValues = [currentValue];
        }
      }
      break;
    case "linear_scale":
      // For linear scale, use the numeric value
      if (
        typeof currentValue === "object" &&
        currentValue?.[question.question_uuid] !== undefined
      ) {
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
        logic.comparison,
      ),
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
  formValues: any,
): Question[] => {
  const visibleLogicQuestions: Question[] = [];
  const addedUuids = new Set<string>(); // Track added question keys to avoid duplicates

  const addQuestion = (question: Question) => {
    const questionKey = getFormKey(question as any);
    if (!addedUuids.has(questionKey)) {
      addedUuids.add(questionKey);
      visibleLogicQuestions.push(question);
    }
  };

  const collectFromQuestion = (question: Question) => {
    const currentValue = getFormValueForQuestion(question, formValues);
    const hasValue =
      currentValue !== undefined &&
      currentValue !== null &&
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
      const visibleLogicIndexes = getVisibleLogicIndexesForQuestion(
        question,
        formValues,
      );

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

export const hasAuditFollowUpTasks = (
  stages: Stage[] | undefined,
  auditInfo?: Stage,
): boolean => {
  const auditInfoQuestions = auditInfo?.questions || [];
  const stageQuestions = (stages || []).flatMap(
    (stage: any) => stage?.questions || [],
  );
  return [...auditInfoQuestions, ...stageQuestions].some((q: any) =>
    (q?.logics || []).some(
      (logic: any) => logic?.follow_up || logic?.followup_toggle,
    ),
  );
};

export const useAuditForm = (
  stages: Stage[] | any,
  submissionsDetail?: SubmissionsDetail,
  formData?: Form,
  auditInfo?: Stage,
  draftData?: any,
  draftId?: string,
  sourceScreen?: string,
  onClose?: () => void,
  onFormSubmissionIdSet?: (id: number | undefined) => void | Promise<void>,
  plannerAssignmentId?: string,
  collaborativeSubmissionId?: string,
  groupDelegationId?: string,
) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [formSubmissionId, setFormSubmissionId] = useState<number | undefined>(
    undefined,
  );
  const submitInFlightRef = useRef(false);
  const lastSubmitPayloadRef = useRef<any | null>(null);
  const queuedBackgroundSubmissionIdRef = useRef<string | null>(null);
  const isQueueingBackgroundSubmissionRef = useRef(false);
  const shouldForceSyncAfterSubmitRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Create a map of question_uuid to groupId for handling modified keys
  // Use stage index to differentiate questions with same UUID in different stages
  const questionToGroupMap = useMemo(() => {
    const map: Record<string, string> = {};
    stages.forEach((stage: Stage, stageIndex: number) => {
      const groupId = `stage-${stageIndex}`;
      stage.questions.forEach((q) => {
        // Use unique key to allow same question_uuid in different stages
        map[`${groupId}_${q.question_uuid}`] = groupId;
        // Also store for backward compatibility
        map[q.question_uuid] = groupId;
        // For sub_questions
        if (q.sub_questions) {
          q.sub_questions.forEach((subQ) => {
            map[`${groupId}_${subQ.question_uuid}`] = groupId;
            map[subQ.question_uuid] = groupId;
          });
        }
        // For logic_questions
        if (q.logics) {
          q.logics.forEach((logic) => {
            if (logic.logic_questions) {
              logic.logic_questions.forEach((lq) => {
                map[`${groupId}_${lq.question_uuid}`] = groupId;
                map[lq.question_uuid] = groupId;
              });
            }
          });
        }
      });
    });
    // For audit info
    if (auditInfo?.questions) {
      const auditInfoId = "audit-info";
      auditInfo.questions.forEach((q) => {
        map[`${auditInfoId}_${q.question_uuid}`] = auditInfoId;
        map[q.question_uuid] = auditInfoId;
        if (q.sub_questions) {
          q.sub_questions.forEach((subQ) => {
            map[`${auditInfoId}_${subQ.question_uuid}`] = auditInfoId;
            map[subQ.question_uuid] = auditInfoId;
          });
        }
        if (q.logics) {
          q.logics.forEach((logic) => {
            if (logic.logic_questions) {
              logic.logic_questions.forEach((lq) => {
                map[`${auditInfoId}_${lq.question_uuid}`] = auditInfoId;
                map[lq.question_uuid] = auditInfoId;
              });
            }
          });
        }
      });
    }
    return map;
  }, [stages, auditInfo]);

  // Include both audit info questions and stage questions
  const auditInfoQuestions = useMemo(
    () => (auditInfo?.questions || []).filter((q: any) => q != null),
    [auditInfo?.questions],
  );
  const stageQuestions = useMemo(
    () =>
      (stages || []).flatMap((stage: any) =>
        (stage?.questions || []).filter((q: any) => q != null),
      ),
    [stages],
  );

  // Create a Set to eliminate true duplicates (same question_uuid AND same group)
  // But keep questions with same question_uuid in different groups
  const questions: Question[] = useMemo(() => {
    const questionSet = new Set<string>();
    const uniqueQuestions: Question[] = [];

    // Add audit info questions first
    auditInfoQuestions.forEach((q: Question) => {
      const groupId = "audit-info";
      const uniqueKey = `${groupId}_${q.question_uuid}`;
      if (!questionSet.has(uniqueKey)) {
        questionSet.add(uniqueKey);
        // Create a deep copy to ensure complete isolation
        const isolatedQuestion = JSON.parse(JSON.stringify(q));
        (isolatedQuestion as any)._stageIndex = -1;
        (isolatedQuestion as any)._groupId = groupId;
        // Set uniqueId for data isolation
        (isolatedQuestion as any).uniqueId = `${groupId}_${q.question_uuid}`;
        uniqueQuestions.push(isolatedQuestion);
      }
    });

    // Add stage questions - keep questions even if same question_uuid exists in different stages
    stages.forEach((stage: any, stageIndex: number) => {
      stage.questions.forEach((q: Question) => {
        const groupId = `stage-${stageIndex}`;
        const uniqueKey = `${groupId}_${q.question_uuid}`;
        if (!questionSet.has(uniqueKey)) {
          questionSet.add(uniqueKey);
          // Create a deep copy to ensure complete isolation
          const isolatedQuestion = JSON.parse(JSON.stringify(q));
          (isolatedQuestion as any)._stageIndex = stageIndex;
          (isolatedQuestion as any)._groupId = groupId;
          // Set uniqueId for data isolation
          (isolatedQuestion as any).uniqueId = `${groupId}_${q.question_uuid}`;
          uniqueQuestions.push(isolatedQuestion);
        }
      });
    });

    return uniqueQuestions;
  }, [auditInfoQuestions, stageQuestions]);

  // Add uniqueId to sub-questions and logic questions to prevent state sharing between groups
  questions.forEach((q) => {
    if (q.sub_questions) {
      q.sub_questions.forEach((subQ) => {
        // Create deep copy for sub-questions too
        const isolatedSubQ = JSON.parse(JSON.stringify(subQ));
        const groupId = (q as any)._groupId;
        (isolatedSubQ as any).uniqueId =
          `${groupId}_${q.question_uuid}_${subQ.question_uuid}`;
        (isolatedSubQ as any)._groupId = groupId;
        // Replace the original sub-question with the isolated one
        const originalIndex = q.sub_questions.indexOf(subQ);
        if (originalIndex !== -1) {
          q.sub_questions[originalIndex] = isolatedSubQ;
        }
      });
    }
    if (q.logics) {
      q.logics.forEach((logic) => {
        if (logic.logic_questions) {
          logic.logic_questions.forEach((lq) => {
            // Create deep copy for logic questions too
            const isolatedLQ = JSON.parse(JSON.stringify(lq));
            const groupId = (q as any)._groupId;
            (isolatedLQ as any).uniqueId =
              `${groupId}_${q.question_uuid}_${lq.question_uuid}`;
            (isolatedLQ as any)._groupId = groupId;
            // Replace the original logic question with the isolated one
            const originalIndex = logic.logic_questions.indexOf(lq);
            if (originalIndex !== -1) {
              logic.logic_questions[originalIndex] = isolatedLQ;
            }
          });
        }
      });
    }
  });

  // Create a draft data mapping that isolates data by uniqueId
  const draftDataByUniqueId = useMemo(() => {
    const mapping: Record<string, any> = {};
    if (!draftData) return mapping;
    
    // Map each question's uniqueId to its draft data
    questions.forEach((q) => {
      const uniqueId = (q as any).uniqueId;
      if (!uniqueId) return;
      if (draftData[uniqueId] !== undefined) {
        mapping[uniqueId] = draftData[uniqueId];
        return;
      }
      if (draftData[q.question_uuid] !== undefined) {
        mapping[uniqueId] = draftData[q.question_uuid];
      }
    });
    return mapping;
  }, [draftData, questions]);

  // Initialize question-specific state using uniqueIds for proper isolation
  const [questionStates, setQuestionStates] = useState<Record<string, any>>(
    () => {
      const initialStates: Record<string, any> = {};
      questions.forEach((q) => {
        const uniqueId = (q as any).uniqueId;
        if (uniqueId) {
          // Use uniqueId for state key and get draft data from our isolated mapping
          const draftValue = draftDataByUniqueId[uniqueId];
          initialStates[uniqueId] = {
            score: 0,
            value: draftValue,
          };
        }
      });
      return initialStates;
    },
  );

  // Create map from question_uuid and uniqueId to question for submission processing
  const questionMap = useMemo(() => {
    const map: Record<string, Question> = {};
    questions.forEach((q) => {
      // Key by question_uuid (for backward compatibility and auto-scrolling)
      map[q.question_uuid] = q;
      // Also key by uniqueId (for multi-group support and data isolation)
      const uniqueId = (q as any).uniqueId;
      if (uniqueId) {
        map[uniqueId] = q;
      }
      if (q.sub_questions) {
        q.sub_questions.forEach((subQ) => {
          // Key by question_uuid for auto-scrolling
          map[subQ.question_uuid] = subQ;
          // Key by uniqueId for data isolation
          const subQUniqueId = (subQ as any).uniqueId;
          if (subQUniqueId) {
            map[subQUniqueId] = subQ;
          }
        });
      }
      if (q.logics) {
        q.logics.forEach((logic) => {
          if (logic.logic_questions) {
            logic.logic_questions.forEach((lq) => {
              // Key by question_uuid for auto-scrolling
              map[lq.question_uuid] = lq;
              // Key by uniqueId for data isolation
              const lqUniqueId = (lq as any).uniqueId;
              if (lqUniqueId) {
                map[lqUniqueId] = lq;
              }
            });
          }
        });
      }
    });
    return map;
  }, [questions]);

  const getInitialScores = useCallback(() => {
    if (!draftData) return {};
    const scores: Record<string, number> = {};
    const allQuestionsForScore = [...auditInfoQuestions, ...stageQuestions];

    for (const q of allQuestionsForScore) {
      if (q.question_type === "audit") {
        const uniqueId = (q as any).uniqueId;
        const draftValue =
          (uniqueId && draftData[uniqueId] !== undefined
            ? draftData[uniqueId]
            : undefined) ?? draftData[q.question_uuid];
        if (draftValue === undefined) continue;
        // Handle audit question values that can be arrays [{id: optionId}], objects {id: optionId}, or direct optionId
        let selectedOptionId: any;

        if (Array.isArray(draftValue) && draftValue.length > 0) {
          // Value is stored as an array of selected options [{id: optionId}, ...]
          const firstSelected = draftValue[0];
          if (typeof firstSelected === "object" && firstSelected?.id) {
            selectedOptionId = firstSelected.id;
          } else {
            selectedOptionId = firstSelected;
          }
        } else if (typeof draftValue === "object" && draftValue?.id) {
          // Value is stored as {id: optionId}
          selectedOptionId = draftValue.id;
        } else if (typeof draftValue === "object" && draftValue !== null) {
          // It's an object but doesn't have id - try to find an id-like property
          selectedOptionId =
            draftValue.id || draftValue.optionId || draftValue.value;
        } else {
          // Value is stored as direct optionId
          selectedOptionId = draftValue;
        }

        const selectedOption = q.options?.find(
          (opt: any) => String(opt.id) === String(selectedOptionId),
        );
        if (selectedOption) {
          scores[q.id] = selectedOption.score || 0;
        }
      }
    }
    return scores;
  }, [draftData, auditInfoQuestions, stageQuestions]);

  const getAuditScoreFromDraftValue = useCallback(
    (question: Question, draftValue: any): number => {
      if (!question?.options?.length) return 0;
      if (draftValue === undefined || draftValue === null) return 0;

      let selectedOptionId: any;
      if (Array.isArray(draftValue) && draftValue.length > 0) {
        const firstSelected = draftValue[0];
        if (typeof firstSelected === "object" && firstSelected?.id) {
          selectedOptionId = firstSelected.id;
        } else {
          selectedOptionId = firstSelected;
        }
      } else if (typeof draftValue === "object" && draftValue?.id) {
        selectedOptionId = draftValue.id;
      } else if (typeof draftValue === "object" && draftValue !== null) {
        selectedOptionId =
          draftValue.id || draftValue.optionId || draftValue.value;
      } else {
        selectedOptionId = draftValue;
      }

      const selectedOption = question.options.find(
        (opt: any) => String(opt.id) === String(selectedOptionId),
      );
      return selectedOption?.score || 0;
    },
    [],
  );

  const [selectedScores, setSelectedScores] = useState<Record<string, number>>(
    () => {
      // Since we removed selectedScores from _calculatedScores to reduce payload size,
      // we now always recalculate from draft form data
      return getInitialScores();
    },
  );

  // Recalculate selectedScores when draftData loads or when questions become available
  useEffect(() => {
    if (
      draftData &&
      (auditInfoQuestions.length > 0 || stageQuestions.length > 0)
    ) {
      const recalculatedScores = getInitialScores();
      setSelectedScores(recalculatedScores);
    }
  }, [draftData, auditInfoQuestions, stageQuestions, getInitialScores]);

  // Recalculate questionStates (used for group scores) when draft data becomes available
  useEffect(() => {
    if (!draftData) return;
    if (auditInfoQuestions.length === 0 && stageQuestions.length === 0) return;

    setQuestionStates((prev) => {
      let changed = false;
      const next = { ...prev };

      questions.forEach((q) => {
        if (q.question_type !== "audit") return;
        const uniqueId = (q as any).uniqueId;
        if (!uniqueId) return;

        const draftValue =
          draftDataByUniqueId[uniqueId] ?? draftData[q.question_uuid];
        if (draftValue === undefined) return;

        const score = getAuditScoreFromDraftValue(q, draftValue);
        const current = prev[uniqueId] || {};

        if (current.score !== score || current.value !== draftValue) {
          next[uniqueId] = {
            ...current,
            value: draftValue,
            score: score,
          };
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [
    draftData,
    draftDataByUniqueId,
    questions,
    auditInfoQuestions.length,
    stageQuestions.length,
    getAuditScoreFromDraftValue,
  ]);

  // Calculate group score using question-specific states
  const calculateGroupScore = useCallback(
    (questions: Question[]): number => {
      return questions
        .filter((q) => q.question_type === "audit")
        .reduce((sum, q) => {
          const uniqueId = (q as any).uniqueId;
          const questionState = questionStates[uniqueId];
          return sum + (questionState?.score || 0);
        }, 0);
    },
    [questionStates],
  );

  useEffect(() => {
    // Only run if submissionsDetail exists and is completed
    if (submissionsDetail?.is_completed && formData?.audit_group) {
      // Update question-specific states with scores from submissionsDetail
      const newQuestionStates = { ...questionStates };

      // Loop through all groups and questions
      formData.audit_group.forEach((group) => {
        group.questions.forEach((question) => {
          if (question.question_type === "audit" && question.answers?.answer) {
            // Find the selected option's score
            const selectedOption = question.options?.find(
              (opt) => String(opt.id) === String(question.answers.answer),
            );
            const score = selectedOption?.score || 0;

            // Find the question by question_uuid and get its uniqueId
            const questionObj = questions.find(
              (q) => q.question_uuid === question.question_uuid,
            );
            if (questionObj) {
              const uniqueId = (questionObj as any).uniqueId;
              if (uniqueId) {
                newQuestionStates[uniqueId] = {
                  ...newQuestionStates[uniqueId],
                  score: score,
                };
              }
            }
          }
        });
      });

      setQuestionStates(newQuestionStates);
    }
  }, [submissionsDetail, formData, questions]);

  // 1. Helper: Get max score for a single question
  const getMaxScoreForQuestion = (question: Question) => {
    if (!question.options || question.options.length === 0) return 0;
    return Math.max(...question.options.map((opt: any) => opt.score || 0));
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

  // 2. Group questions and calculate scores using question-specific states
  const groupScores: AuditScoreInfo[] = useMemo(() => {
    const groupsMap: Record<string, AuditScoreInfo> = {};

    // Process all questions (including duplicates across groups) using uniqueIds
    questions.forEach((q) => {
      if (!q.audit_group) return;

      // Calculate max score from options: max achievable by selecting one option
      // Don't rely on stored max_score — it may be sum of all option scores instead of max
      const opts = q.options || [];
      const maxScore = opts.length > 0
        ? Math.max(...opts.map(o => Number(o.score) || 0))
        : (q.max_score || 0);
      // Get user score from question-specific state using uniqueId
      const uniqueId = (q as any).uniqueId;
      const userScore = questionStates[uniqueId]?.score || 0;

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
          passPercentage: formData?.pass_percentage || 0,
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

    // Calculate percentages and pass/fail
    Object.values(groupsMap).forEach((group) => {
      group.percentage =
        group.maxScore > 0
          ? Math.round((group.userScore / group.maxScore) * 100)
          : 0;
      group.passed = group.percentage >= (group.passPercentage || 0);
    });

    return Object.values(groupsMap);
  }, [questions, questionStates, groupOrderMap, formData?.pass_percentage]);

  // 3. Form totals
  const formMaxScore = useMemo(
    () => groupScores.reduce((sum, g) => sum + g.maxScore, 0),
    [groupScores],
  );

  const formUserScore = useMemo(
    () => groupScores.reduce((sum, g) => sum + g.userScore, 0),
    [groupScores],
  );

  const formPercentage = formMaxScore
    ? Math.round((formUserScore / formMaxScore) * 100)
    : 0;

  // 4. Update user score when selecting an option using question-specific state
  const updateScore = (questionUuid: string, score: number) => {
    const question = questionMap[questionUuid];
    if (question) {
      const uniqueId = (question as any).uniqueId;
      if (uniqueId) {
        setQuestionStates((prev) => ({
          ...prev,
          [uniqueId]: {
            ...prev[uniqueId],
            score: score,
          },
        }));
      }
    }
  };

  // 5. Helper: Check if a group passed
  const isGroupPassed = (groupId: string) => {
    const group = groupScores.find((g) => g.groupId === groupId);
    return group ? group.passed : false;
  };

  const assignments = useSelector(
    (state: RootState) => state.groupAssignments.data,
  );
  const receivedAssignment = useSelector(
    (state: RootState) => state.formReceived.data,
  );
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user);
  const resolvedOrganizationId = useMemo(() => {
    const candidates = [
      (user as any)?.organizationId,
      (user as any)?.organization_id,
      (typeof (user as any)?.organization === "number" ? (user as any).organization : null),
      (user as any)?.organization?.id,
      (formData as any)?.organization,
      (formData as any)?.organization_id,
      (formData as any)?.organization?.id,
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
  }, [formData, user]);

  const queueBackgroundSubmission = useCallback(
    async (payloadToQueue: any, options?: { notifyUser?: boolean }) => {
      try {
        if (!formData?.id || !user?.id) return null;
        if (queuedBackgroundSubmissionIdRef.current) {
          return queuedBackgroundSubmissionIdRef.current;
        }
        if (isQueueingBackgroundSubmissionRef.current) {
          return null;
        }

        isQueueingBackgroundSubmissionRef.current = true;

        const submissionId = await offlineStorageService.storeSubmission({
          formId: Number(formData.id),
          userId: user.id,
          organizationId: resolvedOrganizationId,
          submissionType: "audit",
          groupAssignmentUuid: payloadToQueue?.group_assignment_uuid,
          data: {
            ...payloadToQueue,
          },
        });

        queuedBackgroundSubmissionIdRef.current = submissionId;
        if (options?.notifyUser) {
          Toast.show({
            type: "info",
            text1: "Submission saved",
            text2: "We saved your form and will sync it as soon as possible.",
            position: "top",
          });
        }
        return submissionId;
      } catch (error: any) {
        return null;
      } finally {
        isQueueingBackgroundSubmissionRef.current = false;
      }
    },
    [formData?.id, user?.id, resolvedOrganizationId],
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
        lastSubmitPayloadRef.current &&
        !queuedBackgroundSubmissionIdRef.current &&
        !isQueueingBackgroundSubmissionRef.current
      ) {
        const queuedId = await queueBackgroundSubmission(
          lastSubmitPayloadRef.current,
        );
        if (queuedId) {
          queuedBackgroundSubmissionIdRef.current = queuedId;
        }
      }

      if (comingActive && queuedBackgroundSubmissionIdRef.current) {
        // Avoid forcing sync while an online submission is still in-flight (duplication risk).
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

  const allQuestions = [...auditInfoQuestions, ...stageQuestions];

  const [visibleQuestions, setVisibleQuestions] = useState<Set<string>>(
    new Set(),
  );
  const [activeModal, setActiveModal] = useState<any>(null);

  const currentStage = stages[currentStageIndex];
  const isFirstStage = currentStageIndex === 0;
  const isLastStage = currentStageIndex === stages.length - 1;

  const validationSchema = generateValidationSchema(allQuestions);

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
    // resolver: yupResolver(validationSchema),
    defaultValues: (() => {
      const values: any = {};
      questions.forEach((q: any) => {
        const uniqueId = (q as any).uniqueId;
        if (uniqueId) {
          // Use uniqueId as the form field key for data isolation
          // Use our isolated draft data mapping to prevent data replication
          values[uniqueId] = draftDataByUniqueId[uniqueId];
        }
      });
      return values;
    })(),
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  // Avoid subscribing to formState proxy (errors, isValid, isDirty) directly,
  // which would cause the hook and entire audit screen to re-render on every
  // form state change. Use refs and a state variable synced via watch instead.
  const formStateRef = useRef(formState);
  formStateRef.current = formState;
  const [errors, setErrorsState] = useState<Record<string, any>>({});
  const isDirtyRef = useRef(false);
  const isDirty = isDirtyRef.current;

  // Initialize visible questions once when questions are available
  // Use a simpler approach that doesn't cause infinite loops
  const visibleQuestionsRef = useRef<Set<string>>(new Set());

  // Calculate initial visible questions when questions change
  const initialVisibleQuestions = useMemo(() => {
    const newVisibleQuestions = new Set<string>();

    // Process all questions to find visible logic questions and follow-up tasks
    allQuestions.forEach((question: Question) => {
      // Add main questions (they're always visible)
      newVisibleQuestions.add(question.question_uuid);

      // For logic questions, we'll handle visibility dynamically when values change
      // For now, just add main questions to avoid complexity
    });

    return newVisibleQuestions;
  }, [allQuestions]);

  // Update visible questions when form values change (debounced to avoid UI lag)
  useEffect(() => {
    let debounceTimer: any = null;
    
    const recalculateVisibility = (currentValues: any) => {
      const updatedVisibleQuestions = new Set<string>();

      // Always include main questions using their uniqueIds
      allQuestions.forEach((question: Question) => {
        const uniqueId = (question as any).uniqueId;
        if (uniqueId) {
          updatedVisibleQuestions.add(uniqueId);
        }
      });

      // Add logic questions based on current form values
      const visibleLogicQuestions = collectVisibleLogicQuestions(
        allQuestions,
        currentValues,
      );
      visibleLogicQuestions.forEach((logicQuestion: Question) => {
        const uniqueId = (logicQuestion as any).uniqueId;
        if (uniqueId) {
          updatedVisibleQuestions.add(uniqueId);
        }
      });

      // CRITICAL: Add followup tasks that should be visible
      allQuestions.forEach((question: Question) => {
        if (question.logics) {
          const visibleLogicIndexes = getVisibleLogicIndexesForQuestion(
            question,
            currentValues,
          );
          visibleLogicIndexes.forEach((logicIndex) => {
            const logic = question.logics[logicIndex];

            if (logic?.follow_up && logic.followup_toggle) {
              const followupTaskUuid = `followup-${logic.id}`;
              updatedVisibleQuestions.add(followupTaskUuid);
            }
          });
        }
      });

      // Check if there are actual changes
      const hasChanges =
        updatedVisibleQuestions.size !== visibleQuestionsRef.current.size ||
        ![...updatedVisibleQuestions].every((uuid) =>
          visibleQuestionsRef.current.has(uuid),
        );

      if (hasChanges) {
        visibleQuestionsRef.current = updatedVisibleQuestions;
        setVisibleQuestions(updatedVisibleQuestions);
      }

      // Sync errors state only when errors actually change
      const currentErrors = formStateRef.current.errors;
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

      // Track dirtiness via ref (no re-render)
      isDirtyRef.current = formStateRef.current.isDirty;
    };

    const subscription = watch((currentValues, { name, type }) => {
      // Debounce: wait 300ms after last change before recalculating
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        recalculateVisibility(currentValues);
      }, 300);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [watch, allQuestions]);

  // Set initial visible questions when available
  useEffect(() => {
    if (
      initialVisibleQuestions.size > 0 &&
      visibleQuestionsRef.current.size === 0
    ) {
      visibleQuestionsRef.current = initialVisibleQuestions;
      setVisibleQuestions(initialVisibleQuestions);
    }
  }, [initialVisibleQuestions]);
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
    // console.log("stage index ::", index)
    if (index >= 0 && index < stages.length) {
      setCurrentStageIndex(index);
      // if (!completedStages.includes(index)) {
      //   setCompletedStages([...completedStages, index]);
      // }
    }
  };

  const getStageAssignUuid = async () => {
    try {
      const response = (await api.get(
        `${GETALLASSIGNEDSTAGESACCESSID}${user.id}/`,
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
      // Only log as an error when we are actually online
      throw error;
    }
  };

  // ... (rest of the imports)

  // ... (inside useAuditForm hook)

  const onSubmit = async (data: any) => {
    setSubmitting(true);
    let payload: any = {
      form: formData?.id,
      answers: [] as any[],
    };
    if (plannerAssignmentId) {
      payload.planner_assignment_id = Number(plannerAssignmentId);
    }
    submitInFlightRef.current = true;
    lastSubmitPayloadRef.current = null;
    queuedBackgroundSubmissionIdRef.current = null;
    isQueueingBackgroundSubmissionRef.current = false;
    shouldForceSyncAfterSubmitRef.current = false;

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

      // Collaborative mode uses group_delegation_id, skip GroupAssignment UUID lookup
      if (sourceScreen !== "collaborative") {
        // Always try to load fresh group assignments first
        const freshAssignments = await getGroupAssignments();

        // Use fresh assignments to find the UUID
        groupAssignmentUuid = freshAssignments.find(
          (assign: any) => assign.formId == Number(formData?.id),
        )?.assignmentUuid;

        // If still no assignment UUID found, try to get from AsyncStorage for audit forms
        if (!groupAssignmentUuid && formData?.form_type === "audit") {
          const storedUuid = await AsyncStorage.getItem(
            `audit_form_${formData?.id}_uuid`,
          );
          if (storedUuid) {
            groupAssignmentUuid = storedUuid;
          }
        }

        // For audit forms, if still no UUID found, generate a temporary one for first submission
        if (!groupAssignmentUuid && formData?.form_type === "audit") {
          groupAssignmentUuid = uuid.v4();
        }

        // If still no assignment UUID found, throw an error
        if (!groupAssignmentUuid) {
          throw new Error(
            "Group assignment UUID not found. Please ensure you have been assigned to this form.",
          );
        }

        payload.group_assignment_uuid = groupAssignmentUuid;
      }

      // Include form_submission_id when editing an existing sent submission (overwrites instead of duplicating)
      if (submissionsDetail?.id && sourceScreen === "sent") {
        payload.form_submission_id = Number(submissionsDetail.id);
      }

      const handleAnswer = (meta: any, val: any) => {
        const isEmptyForSubmit = (value: any, questionType: string) => {
          if (value === undefined || value === null) return true;
          switch (questionType) {
            case "short_answer":
            case "long_answer":
            case "qr_code":
              return String(value).trim() === "";
            case "dropdown":
            case "division":
            case "sub_division":
            case "location":
            case "user":
              return typeof value === "object" ? !value?.id : value === "";
            case "multiple_choice":
            case "checkboxes":
            case "audit":
              return !Array.isArray(value) || value.length === 0;
            case "date":
            case "time":
            case "datetime":
              return !value;
            case "linear_scale":
              return value === "" || value === undefined || value === null;
            case "upload_image":
            case "upload_video":
            case "upload_audio":
            case "upload_file":
              return (
                !value ||
                (typeof value === "string" &&
                  value.split("|").filter(Boolean).length === 0)
              );
            case "signature":
              return !value;
            case "title_and_description":
              return true;
            default:
              return value === "";
          }
        };

        if (isEmptyForSubmit(val, meta.question_type)) {
          return;
        }

        let answerValue;
        let otherText = extractOtherTextFromValue(val);

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
        } else if (
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
          question: Number(meta.id) || meta.id,
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
            (ans: any) => ans.question_uuid === meta.question_uuid,
          )
        ) {
          payload.answers.push(answer);
        }
      };

      const handleTableAnswer = (meta: any, rows: any[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const answer: any = {
          question_uuid: meta.question_uuid,
          question: meta.id,
          question_type: meta.question_type,
          answer: JSON.stringify(rows),
          group: null,
          division: null,
          sub_division: null,
          location: null,
          user: null,
        };
        if (
          !payload.answers.some(
            (ans: any) => ans.question_uuid === meta.question_uuid,
          )
        ) {
          payload.answers.push(answer);
        }
      };

      // Get currently visible logic questions based on final form values
      const visibleLogicQuestions = collectVisibleLogicQuestions(
        allQuestions,
        data,
      );

      for (const [dataKey, value] of Object.entries(data)) {
        const questionMeta =
          questionMap[dataKey] ||
          questions.find(
            (q: any) => q.uniqueId === dataKey
          );

        if (!questionMeta) {
          continue;
        }

        if (questionMeta.question_type === "table" && Array.isArray(value)) {
          handleTableAnswer(questionMeta, value);
          for (const row of value) {
            for (const [subKey, subValue] of Object.entries(row)) {
              const subMeta = questionMap[subKey];
              if (subMeta) {
                handleAnswer(subMeta, subValue);
              }
            }
          }
        } else if (questionMeta.question_type === "audit") {
          handleAnswer(questionMeta, value);
          if (questionMeta.sub_questions) {
            questionMeta.sub_questions.forEach((subQ: any) => {
              // Use uniqueId for sub-questions to ensure data isolation
              const subDataKey = subQ.uniqueId || subQ.question_uuid;
              if (data[subDataKey] !== undefined) {
                handleAnswer(subQ, data[subDataKey]);
              }
            });
          }
        } else {
          handleAnswer(questionMeta, value);
        }
      }

      // Handle "Other" text fields stored under `${questionKey}_other`
      for (const [key, value] of Object.entries(data)) {
        if (
          !key.endsWith("_other") ||
          !value ||
          typeof value !== "string" ||
          !value.trim()
        ) {
          continue;
        }

        const questionKey = key.replace(/_other$/, "");
        const questionMeta = questionMap[questionKey];
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

      // Keep a best-effort snapshot for background queueing (updated later once summary is added).
      lastSubmitPayloadRef.current = payload;

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
        await queueBackgroundSubmission(payload, { notifyUser: true });

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
                  text2:
                    "Your offline submission has been synced successfully.",
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

        // For audit forms submitted from todo, go back to previous page instead of forms tab
        if (sourceScreen === "todo" || sourceScreen === "sent") {
          onClose?.();
        } else {
          router.replace("/(app)/(tabs)/forms");
        }
        return;
      }

      // Add audit score summary to payload
      const formOverallStatus =
        formPercentage >= (formData?.pass_percentage || 0)
          ? "passed"
          : "failed";
      const formCriticalFailed = groupScores.some(
        (group) => group.critical && !group.passed,
      )
        ? 1
        : 0;

      const groupsStatus = groupScores.map((group) => ({
        group_id: group.groupId,
        status: group.passed ? "passed" : "failed",
        group_percentage: group.percentage,
        group_score: group.userScore,
      }));

      // Keep total group score for backward compatibility
      const totalGroupScore = groupScores.reduce(
        (sum, group) => sum + group.userScore,
        0,
      );

      payload.form_overall_status = formOverallStatus;
      payload.form_overall_score = formPercentage;
      payload.form_critical_failed = formCriticalFailed;
      payload.groups_status = groupsStatus;
      payload.group_score = totalGroupScore;

      lastSubmitPayloadRef.current = payload;

      payload.answers.forEach((answer: any, index: number) => {
        if (answer.division) console.log(`     Division: ${answer.division}`);
        if (answer.sub_division)
        if (answer.location) console.log(`     Location: ${answer.location}`);
        if (answer.user) console.log(`     User: ${answer.user}`);
      });
// Add share_response: false to prevent backend auto-sharing during submission
      payload.share_response = false;

      let res: any;
      if (sourceScreen === "collaborative" && plannerAssignmentId && groupDelegationId) {
        const collabPayload: any = {
          group_delegation_id: Number(groupDelegationId),
          answers: payload.answers,
        };
        try {
          res = await api.post(
            PLANNER_COLLABORATIVE_SUBMIT_GROUP(plannerAssignmentId),
            collabPayload,
          );
        } catch (conflictError: any) {
          const conflictStatus = conflictError?.status || conflictError?.response?.status;
          const conflictData = conflictError?.data || conflictError?.response?.data;
          if (conflictStatus === 409) {
            const conflicts = conflictData?.conflicts || [];
            const conflictMessages = conflicts.map((c: any) =>
              `"${c.question_text}" — answered by ${c.answered_by}`
            ).join('\n');

            Alert.alert(
              'Answers Conflict',
              `${conflicts.length} question(s) were already answered by teammates while you were filling the form:\n\n${conflictMessages}\n\nYour submission was not saved. The form will refresh with the latest answers.`,
              [{
                text: 'OK',
                onPress: () => {
                  // Stay on the form — the polling mechanism in AudiFormScreen
                  // will pick up the latest answers from teammates on the next cycle.
                  // Don't call onClose() here — it bypasses forceClose()/hasClosedRef
                  // and can cause double navigation / frozen back button.
                },
              }],
            );
            return;
          }
          throw conflictError;
        }
      } else {
        res = await api.post(SUBMIT_GROUP_ANSWER, payload);
      }

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
      // console.log("✅ API Response:", res.data?.message);
      // console.log("📋 Full API Response:", JSON.stringify(res.data, null, 2));

      // Store the assignment_uuid for audit forms
      if (formData?.form_type === "audit" && res.data.assignment_uuid) {
        await AsyncStorage.setItem(
          `audit_form_${formData?.id}_uuid`,
          res.data.assignment_uuid,
        );
      }
      // For audit forms, update the formSubmissionId if we got one from the response
      if (formData?.form_type === "audit" && res.data?.form_submission_id) {
        setFormSubmissionId(res.data.form_submission_id);
        // Fire followup trigger without awaiting so it doesn't block navigation
        if (onFormSubmissionIdSet) {
          try {
            const result = onFormSubmissionIdSet(res.data.form_submission_id) as void | Promise<void>;
            if (result instanceof Promise) {
              result.catch((triggerErr) => {
                console.error("Followup trigger error (non-fatal):", triggerErr);
              });
            }
          } catch (triggerErr) {
            console.error("Followup trigger error (non-fatal):", triggerErr);
          }
        }
      } else if (formData?.form_type === "audit") {
      }

      // Show success toast
      setTimeout(() => {
        Toast.show({
          type: "success",
          text1: "Form submitted successfully",
          position: "top",
        });
      }, 2);

      // Navigate away
      if (res?.data?.next_stage_assigning_required) {
        setSubmitting(false);
        getStageAssignUuid();
        getReceivedStageAssignUuid();
      } else {
        setSubmitting(false);
        // Mark submission as completed - AudiFormScreen's useEffect watches this
        // and calls forceClose() exactly once (guarded), which calls onClose or
        // falls back to router navigation per sourceScreen. Don't also call
        // onClose/router.replace here directly, or the screen gets navigated
        // away from twice, corrupting the navigation stack.
        setSubmissionCompleted(true);
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
        (typeof error?.message === "string" &&
          error.message.includes("Network Error"));

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
        // console.log(
        //   "🌐 Network error during audit submit – falling back to offline storage",
        // );
        try {
          if (
            queuedBackgroundSubmissionIdRef.current ||
            isQueueingBackgroundSubmissionRef.current
          ) {
            Toast.show({
              type: "info",
              text1: "Submission saved",
              text2: "Your form is already queued and will sync later.",
              position: "top",
            });

            if (draftId) {
              try {
                await offlineStorageService.removeDraft(draftId);
              } catch (draftError) {
              }
            }

            // For audit forms submitted from todo, go back to previous page instead of forms tab
            if (sourceScreen === "todo") {
              onClose?.();
            } else {
              router.replace("/(app)/(tabs)/forms");
            }
            return;
          }

          await queueBackgroundSubmission(
            {
              ...payload,
              group_assignment_uuid: payload.group_assignment_uuid,
            },
            { notifyUser: true },
          );

          if (draftId) {
            try {
              await offlineStorageService.removeDraft(draftId);
            } catch (draftError) {

            }
          }

          // For audit forms submitted from todo, go back to previous page instead of forms tab
          if (sourceScreen === "todo") {
            onClose?.();
          } else {
            router.replace("/(app)/(tabs)/forms");
          }
          return;
        } catch (offlineErr) {
        }
      }

      const errData = error?.data || error?.response?.data;
      const backendErrorText =
        errData?.error ||
        (typeof errData === "string"
          ? errData
          : JSON.stringify(errData || "").slice(0, 200)) ||
        error?.error ||
        error?.message ||
        JSON.stringify(error).slice(0, 200) ||
        "An error occurred. Please try again.";
      console.error("Audit submit error:", error);
      console.error("Audit submit error response data:", errData);
      Alert.alert("Submission Failed", backendErrorText);
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);

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
  };

  // Check if all required questions are filled (including visible sub-questions)
  const areAllRequiredQuestionsFilled = useCallback(
    (formValues: any) => {
      // Build a values map that supports both uniqueId and question_uuid lookups.
      const valuesForValidation: Record<string, any> = {};
      Object.keys(formValues).forEach((key) => {
        const question = questionMap[key];
        if (question) {
          valuesForValidation[question.question_uuid] = formValues[key];
          const uniqueId = (question as any).uniqueId;
          if (uniqueId) {
            valuesForValidation[uniqueId] = formValues[key];
          }
        }
      });
      return validateRequiredQuestions(
        valuesForValidation,
        allQuestions,
        visibleQuestions,
      );
    },
    [allQuestions, visibleQuestions, questionMap],
  );

  return {
    currentStage,
    currentStageIndex,
    isFirstStage,
    isLastStage,
    completedStages,
    control,
    errors,
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
    isGroupPassed,
    calculateGroupScore,
    trigger,
    areAllRequiredQuestionsFilled,
    setFormSubmissionId,
    formSubmissionId, // Return the hook's internal formSubmissionId state
    reset,
    submissionCompleted,
  };
};
