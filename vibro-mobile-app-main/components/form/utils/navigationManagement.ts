import { Question } from "../types/formTypes";

/**
 * Navigation Management - Handles all auto-scrolling and navigation using question_uuid only
 * This ensures backward compatibility and consistent auto-scrolling behavior
 */

export interface QuestionMap {
  [key: string]: Question;
}

/**
 * Navigation Manager - Handles auto-scrolling and navigation operations
 * Uses question_uuid exclusively for navigation to maintain backward compatibility
 */
export class NavigationManager {
  private questionMap: QuestionMap = {};

  constructor(questions: Question[]) {
    this.buildQuestionMap(questions);
  }

  /**
   * Builds a map of questions for navigation using question_uuid
   */
  private buildQuestionMap(questions: Question[]): void {
    this.questionMap = {};
    
    questions.forEach((question) => {
      // Key by question_uuid for navigation (backward compatibility)
      this.questionMap[question.question_uuid] = question;
      
      // Also map sub-questions for navigation
      if (question.sub_questions) {
        question.sub_questions.forEach((subQ) => {
          this.questionMap[subQ.question_uuid] = subQ;
        });
      }
      
      // Also map logic questions for navigation
      if (question.logics) {
        question.logics.forEach((logic) => {
          if (logic.logic_questions) {
            logic.logic_questions.forEach((lq) => {
              this.questionMap[lq.question_uuid] = lq;
            });
          }
        });
      }
    });
  }

  /**
   * Gets a question by its UUID for navigation purposes
   */
  getQuestionByUuid(questionUuid: string): Question | undefined {
    return this.questionMap[questionUuid];
  }

  /**
   * Checks if a question exists in the navigation map
   */
  hasQuestion(questionUuid: string): boolean {
    return !!this.questionMap[questionUuid];
  }

  /**
   * Gets all question UUIDs for navigation
   */
  getAllQuestionUuids(): string[] {
    return Object.keys(this.questionMap);
  }

  /**
   * Finds the first error question UUID in visual order
   */
  findFirstErrorQuestion(
    validationErrors: Record<string, boolean>,
    allQuestions: Question[],
    visibleQuestions: Set<string>,
  ): string | null {
    // Check top-level questions first
    for (const question of allQuestions) {
      if (validationErrors[question.question_uuid]) {
        return question.question_uuid;
      }
    }

    // Check visible sub-questions (logic questions)
    for (const question of allQuestions) {
      if (question.logics) {
        for (const logic of question.logics) {
          if (logic.logic_questions) {
            for (const logicQuestion of logic.logic_questions) {
              // Only check if the logic question is visible
              if (
                visibleQuestions.has(logicQuestion.question_uuid) &&
                validationErrors[logicQuestion.question_uuid]
              ) {
                return logicQuestion.question_uuid;
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Gets the accordion ID for a question UUID
   */
  getAccordionIdForQuestion(questionUuid: string, stages: any[], auditInfo?: any): string | null {
    // Check audit info first
    if (auditInfo && auditInfo.questions) {
      const auditInfoQuestion = auditInfo.questions.find(
        (q: Question) => q.question_uuid === questionUuid
      );
      if (auditInfoQuestion) {
        return `audit-info-${auditInfo.id || 1}`;
      }
    }

    // Check stages
    for (const stage of stages) {
      const stageQuestion = stage.questions?.find(
        (q: Question) => q.question_uuid === questionUuid
      );
      if (stageQuestion) {
        return `stage-${stage.id}`;
      }
    }

    return null;
  }

  /**
   * Gets the group ID for a question UUID
   */
  getGroupIdForQuestion(questionUuid: string, stages: any[], auditInfo?: any): number | null {
    // Check audit info first
    if (auditInfo && auditInfo.questions) {
      const auditInfoQuestion = auditInfo.questions.find(
        (q: Question) => q.question_uuid === questionUuid
      );
      if (auditInfoQuestion) {
        return auditInfo.id || 1;
      }
    }

    // Check stages
    for (const stage of stages) {
      const stageQuestion = stage.questions?.find(
        (q: Question) => q.question_uuid === questionUuid
      );
      if (stageQuestion) {
        return stage.id;
      }
    }

    return null;
  }

  /**
   * Checks if a question is in audit info
   */
  isQuestionInAuditInfo(questionUuid: string, auditInfo?: any): boolean {
    if (!auditInfo || !auditInfo.questions) {
      return false;
    }
    
    return auditInfo.questions.some(
      (q: Question) => q.question_uuid === questionUuid
    );
  }

  /**
   * Updates the question map when questions change
   */
  updateQuestionMap(questions: Question[]): void {
    this.buildQuestionMap(questions);
  }
}

/**
 * Utility functions for navigation
 */

/**
 * Gets the accordion index for a given accordion ID
 */
export const getAccordionIndex = (accordionId: string, accordionsData: any[]): number => {
  return accordionsData.findIndex((acc) => acc.id === accordionId);
};

/**
 * Calculates scroll target position for a field
 */
export const calculateScrollTarget = (
  fieldY: number,
  screenHeight: number,
  fieldHeight: number,
): number => {
  // Position the field at 25% from top of screen
  const targetScreenY = screenHeight * 0.25;
  const scrollDelta = fieldY - targetScreenY;
  
  return Math.max(0, scrollDelta);
};

/**
 * Validates if a question UUID is valid for navigation
 */
export const isValidQuestionUuid = (
  questionUuid: string,
  navigationManager: NavigationManager,
): boolean => {
  return navigationManager.hasQuestion(questionUuid);
};

/**
 * Gets navigation context for a question
 */
export const getNavigationContext = (
  questionUuid: string,
  navigationManager: NavigationManager,
  stages: any[],
  auditInfo?: any,
): {
  accordionId: string | null;
  groupId: number | null;
  isInAuditInfo: boolean;
  question: Question | undefined;
} => {
  const accordionId = navigationManager.getAccordionIdForQuestion(
    questionUuid,
    stages,
    auditInfo
  );
  const groupId = navigationManager.getGroupIdForQuestion(
    questionUuid,
    stages,
    auditInfo
  );
  const isInAuditInfo = navigationManager.isQuestionInAuditInfo(
    questionUuid,
    auditInfo
  );
  const question = navigationManager.getQuestionByUuid(questionUuid);

  return {
    accordionId,
    groupId,
    isInAuditInfo,
    question,
  };
};