import { Question } from "../types/formTypes";

/**
 * Form State Management - Handles all form state operations using uniqueId only
 * This ensures complete data isolation between questions with same UUID in different groups
 */

export interface FormState {
  [key: string]: {
    score: number;
    value: any;
  };
}

/**
 * Extended Question interface with uniqueId property
 */
export interface QuestionWithUniqueId extends Question {
  uniqueId?: string;
}

/**
 * Creates a unique ID for a question based on its group/stage context
 */
export const createUniqueId = (question: Question, groupId: string): string => {
  return `${groupId}_${question.question_uuid}`;
};

/**
 * Gets the form key to use for React Hook Form operations
 * Always uses uniqueId for data operations to ensure isolation
 */
export const getFormKey = (question: QuestionWithUniqueId): string => {
  return question.uniqueId || question.question_uuid;
};

/**
 * Manages question states using uniqueId for complete isolation
 */
export class FormStateManager {
  private state: FormState = {};

  constructor(initialState?: FormState) {
    if (initialState) {
      this.state = { ...initialState };
    }
  }

  /**
   * Updates the score for a question using uniqueId
   */
  updateScore(uniqueId: string, score: number): void {
    this.state[uniqueId] = {
      ...this.state[uniqueId],
      score: score,
    };
  }

  /**
   * Gets the score for a question using uniqueId
   */
  getScore(uniqueId: string): number {
    return this.state[uniqueId]?.score || 0;
  }

  /**
   * Updates the value for a question using uniqueId
   */
  updateValue(uniqueId: string, value: any): void {
    this.state[uniqueId] = {
      ...this.state[uniqueId],
      value: value,
    };
  }

  /**
   * Gets the value for a question using uniqueId
   */
  getValue(uniqueId: string): any {
    return this.state[uniqueId]?.value;
  }

  /**
   * Gets all question states
   */
  getAllStates(): FormState {
    return { ...this.state };
  }

  /**
   * Calculates group score using uniqueId-based states
   */
  calculateGroupScore(questionIds: string[]): number {
    return questionIds.reduce((sum, uniqueId) => {
      return sum + (this.state[uniqueId]?.score || 0);
    }, 0);
  }

  /**
   * Resets all states
   */
  reset(): void {
    this.state = {};
  }

  /**
   * Initializes states from draft data
   */
  initializeFromDraft(draftData: Record<string, any>, questions: QuestionWithUniqueId[]): void {
    questions.forEach((question) => {
      const uniqueId = question.uniqueId;
      if (uniqueId && draftData[question.question_uuid]) {
        this.state[uniqueId] = {
          score: 0, // Score will be calculated separately
          value: draftData[question.question_uuid],
        };
      }
    });
  }
}

/**
 * Utility functions for form state management
 */

/**
 * Checks if a value is empty based on question type
 */
export const isValueEmpty = (value: any, questionType: string): boolean => {
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

/**
 * Validates if all required questions are filled
 */
export const validateRequiredQuestions = (
  formValues: Record<string, any>,
  questions: Question[],
  visibleQuestions: Set<string>,
): boolean => {
  // Check top-level questions
  for (const question of questions) {
    if (!question.is_required) continue;
    if (question.question_type === "title_and_description") continue;

    const uniqueId = getFormKey(question);
    const value = formValues[uniqueId];

    if (isValueEmpty(value, question.question_type)) {
      return false;
    }
  }

  // Check visible logic questions (sub-questions)
  for (const question of questions) {
    if (question.logics) {
      for (const logic of question.logics) {
        if (logic.logic_questions) {
          for (const logicQuestion of logic.logic_questions) {
            if (!logicQuestion.is_required) continue;
            if (logicQuestion.question_type === "title_and_description") continue;

            // Only check if the logic question is visible
            if (visibleQuestions.has(logicQuestion.question_uuid)) {
              const uniqueId = getFormKey(logicQuestion);
              const value = formValues[uniqueId];

              if (isValueEmpty(value, logicQuestion.question_type)) {
                return false;
              }
            }
          }
        }
      }
    }
  }

  return true;
};

/**
 * Counts missing required fields
 */
export const countMissingRequiredFields = (
  formValues: Record<string, any>,
  questions: Question[],
  visibleQuestions: Set<string>,
): number => {
  let count = 0;

  // Check top-level questions
  for (const question of questions) {
    if (!question.is_required) continue;
    if (question.question_type === "title_and_description") continue;

    const uniqueId = getFormKey(question);
    const value = formValues[uniqueId];

    if (isValueEmpty(value, question.question_type)) {
      count++;
    }
  }

  // Check visible logic questions (sub-questions)
  for (const question of questions) {
    if (question.logics) {
      for (const logic of question.logics) {
        if (logic.logic_questions) {
          for (const logicQuestion of logic.logic_questions) {
            if (!logicQuestion.is_required) continue;
            if (logicQuestion.question_type === "title_and_description") continue;

            // Only check if the logic question is visible
            if (visibleQuestions.has(logicQuestion.question_uuid)) {
              const uniqueId = getFormKey(logicQuestion);
              const value = formValues[uniqueId];

              if (isValueEmpty(value, logicQuestion.question_type)) {
                count++;
              }
            }
          }
        }
      }
    }
  }

  return count;
};