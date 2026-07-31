import api from './index';
import { SecureStoreService } from './secureStore';

interface AuditAssignmentConfig {
  selectedQuestions: string[];
  selectedUsers: number[];
  selectedGroups: number[];
}

interface Question {
  question_uuid: string;
  question: string;
  logics?: Logic[];
}

interface Logic {
  id?: number;
  follow_up?: any;
  logic_questions?: Question[];
}

/**
 * Performs bulk assignment of tasks for audit forms after form submission
 * @param formId The ID of the audit form
 * @param formData The audit form data containing auditGroups and auditInfo
 * @param triggerResponse Optional: Response from trigger API containing created task IDs
 * @param submissionId Optional: Submission ID to query tasks if triggerResponse doesn't contain task IDs
 * @returns Promise<void>
 */
export const performAuditBulkAssignment = async (
  formId: string,
  formData: any,
  triggerResponse?: any,
  submissionId?: string
): Promise<void> => {
  try {
    // Retrieve saved audit assignment configuration
    const configString = await SecureStoreService.get(`audit_bulk_assignments_${formId}`);

    if (!configString) {
      return;
    }

    const config: AuditAssignmentConfig = JSON.parse(configString);

    if (config.selectedQuestions.length === 0 || (config.selectedUsers.length === 0 && config.selectedGroups.length === 0)) {
      return;
    }

    let allTasks: any[] = [];
    let taskIds: number[] = [];

    // Method 1: Try to get tasks from trigger response (preferred method)
    if (triggerResponse && triggerResponse.data && triggerResponse.data.tasks && triggerResponse.data.tasks.length > 0) {

      // Get full task details for each task ID since trigger response has limited info
      const fullTasksPromises = triggerResponse.data.tasks.map(async (task: any) => {
        try {
          const taskResponse = await api.get(`/tasks/${task.task_id || task.id}/`);
          return taskResponse.data;
        } catch (error) {
          return null;
        }
      });

      const fullTasks = await Promise.all(fullTasksPromises);
      allTasks = fullTasks.filter(task => task !== null);
    }
    // Method 2: Fallback - Query tasks by submission ID (if available and no trigger response)
    else if (submissionId) {
      try {
        const tasksResponse = await api.get(`/tasks/?submission=${submissionId}`);
        allTasks = tasksResponse.data.results || [];
      } catch (error) {
      }
    }

      // Filter tasks to only include those from selected questions for audit forms
      if (allTasks.length > 0) {
      // For audit forms, collect questions from both audit_info and audit_groups
      const auditInfoQuestions = (formData.auditInfo as any)?.questions || [];
      const auditGroupQuestions = (formData.auditGroups || []).flatMap((group: any) => group?.questions || []);
      const allAuditQuestions = [...auditInfoQuestions, ...auditGroupQuestions];

      // Create a map of follow-up details for selected questions
      const selectedQuestionFollowUps: { [key: string]: any[] } = {};

      allAuditQuestions.forEach((question: Question) => {
        if (config.selectedQuestions.includes(question.question_uuid)) {
          const followUps: any[] = [];

          // Check direct logics for follow-up tasks
          if (question.logics) {
            question.logics.forEach((logic: Logic) => {
              if (logic.follow_up) {
                followUps.push({
                  ...logic.follow_up,
                  logicId: logic.id,
                  parentQuestionUuid: question.question_uuid
                });
              }
              // Check logic questions (subquestions) for follow-up tasks
              if (logic.logic_questions) {
                logic.logic_questions.forEach((logicQuestion: Question) => {
                  if (logicQuestion.logics) {
                    logicQuestion.logics.forEach((subLogic: Logic) => {
                      if (subLogic.follow_up) {
                        followUps.push({
                          ...subLogic.follow_up,
                          logicId: subLogic.id,
                          parentQuestionUuid: question.question_uuid
                        });
                      }
                    });
                  }
                });
              }
            });
          }

          if (followUps.length > 0) {
            selectedQuestionFollowUps[question.question_uuid] = followUps;
          }
        }
      });

      // Filter tasks that match selected question follow-ups
      const filteredTasks: any[] = [];

      const matchesFollowUpTask = (task: any, followUp: any) => {
        const taskLogicId = Number(
          task?.logic_followup_id ?? task?.logicId ?? task?.followup_logic_id,
        );
        const followUpLogicId = Number(followUp?.logicId ?? followUp?.logic_followup_id);
        if (
          Number.isFinite(taskLogicId) &&
          Number.isFinite(followUpLogicId) &&
          taskLogicId === followUpLogicId
        ) {
          return true;
        }

        const hasAssignedForm = followUp?.assign_form != null;
        const titleMatch = task?.task_name === followUp?.title || task?.task_name === followUp?.task_name;
        const descriptionMatch = task?.description === followUp?.description;
        const formMatch = hasAssignedForm
          ? (task?.form === followUp?.assign_form ||
              task?.followup_task_form_id === followUp?.assign_form)
          : true;

        return titleMatch && descriptionMatch && formMatch;
      };

      allTasks.forEach((task: any) => {
        let isFromSelectedQuestion = false;

        // Check if this task matches any follow-up from selected questions
        for (const questionUuid of config.selectedQuestions) {
          const followUps = selectedQuestionFollowUps[questionUuid];
          if (followUps) {
            for (const followUp of followUps) {
              if (matchesFollowUpTask(task, followUp)) {
                isFromSelectedQuestion = true;
                break;
              }
            }
          }
          if (isFromSelectedQuestion) break;
        }

        if (isFromSelectedQuestion) {
          filteredTasks.push(task);
        }
      });

      taskIds = filteredTasks.map(task => task.task_id || task.id);
    }

    if (taskIds.length === 0) {
      return;
    }

    // Create task sharing assignments for each task
    const assignmentPromises: Promise<any>[] = [];

    taskIds.forEach((taskId: number) => {
      // Share task with selected users and groups
      const sharePayload = {
        users: config.selectedUsers,
        groups: config.selectedGroups,
      };

      assignmentPromises.push(
        api.post(`/tasks/${taskId}/share/`, sharePayload)
      );
    });

    // Execute all assignments
    await Promise.all(assignmentPromises);
    // Clean up the saved audit configuration after successful assignment
    await SecureStoreService.remove(`audit_bulk_assignments_${formId}`);

  } catch (error) {
    throw error;
  }
};

/**
 * Checks if there are saved audit assignment configurations for a form
 * @param formId The ID of the audit form
 * @returns Promise<boolean>
 */
export const hasSavedAuditAssignments = async (formId: string): Promise<boolean> => {
  try {
    const configString = await SecureStoreService.get(`audit_bulk_assignments_${formId}`);
    return !!configString;
  } catch (error) {
    return false;
  }
};
