import api from './index';
import { SecureStoreService } from './secureStore';

interface AssignmentConfig {
  selectedStages: number[];
  selectedQuestions: string[];
  selectedUsers: number[];
  selectedGroups: number[];
}

interface Stage {
  id: number;
  name: string;
  questions: Question[];
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

interface ParentQuestionWithFollowUp {
  question_uuid: string;
  question: string;
  stageName: string;
  stageId: number;
}

/**
 * Performs bulk assignment of tasks after form submission
 * @param formId The ID of the form
 * @param formData The form data containing stages information
 * @param triggerResponse Optional: Response from trigger API containing created task IDs
 * @param submissionId Optional: Submission ID to query tasks if triggerResponse doesn't contain task IDs
 * @returns Promise<void>
 */
export const performBulkAssignment = async (
  formId: string,
  formData: any,
  triggerResponse?: any,
  submissionId?: string
): Promise<void> => {
  try {
    // Retrieve saved assignment configuration using stage-specific key
    const currentStageId = formData?.currentStageId;
    const configKey = currentStageId
      ? `bulk_assignments_${formId}_${currentStageId}`
      : `bulk_assignments_${formId}`;
    const configString = await SecureStoreService.get(configKey);

    if (!configString) {
      return;
    }

    const config: AssignmentConfig = JSON.parse(configString);

    if (config.selectedQuestions.length === 0 || (config.selectedUsers.length === 0 && config.selectedGroups.length === 0)) {
      return;
    }

    let allTasks: any[] = [];
    let taskIds: number[] = [];

    // Method 1: Try to get tasks from trigger response
    if (triggerResponse && triggerResponse.tasks) {

      // Get full task details for each task ID since trigger response has limited info
      const fullTasksPromises = triggerResponse.tasks.map(async (task: any) => {
        try {
          const taskResponse = await api.get(`/tasks/${task.task_id}/`);
          return taskResponse.data;
        } catch (error) {
          return null;
        }
      });

      const fullTasks = await Promise.all(fullTasksPromises);
      allTasks = fullTasks.filter(task => task !== null);
    }
    // Method 2: Query tasks by submission ID (if available)
    else if (submissionId) {
      try {
        const tasksResponse = await api.get(`/tasks/?submission=${submissionId}`);
        allTasks = tasksResponse.data.results || [];
      } catch (error) {
      }
    }

      // Filter tasks to only include those from selected questions
      if (allTasks.length > 0) {
      const { stages: stagesData, currentStageId } = formData;
      const currentStage = stagesData.find((stage: Stage) => stage.id === currentStageId);

      if (!currentStage) {
        throw new Error('Current stage not found');
      }

      // Create a map of follow-up details for selected questions
      const selectedQuestionFollowUps: { [key: string]: any[] } = {};

      currentStage.questions?.forEach((question: Question) => {
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
              // Check logic questions for follow-up tasks
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
    // Method 3: Fallback - extract from form config (if task_close_questions has IDs) - DEPRECATED
    else {
      const { stages: stagesData, currentStageId } = formData;
      const currentStage = stagesData.find((stage: Stage) => stage.id === currentStageId);

      if (!currentStage) {
        throw new Error('Current stage not found');
      }

      // Collect all follow-up tasks from selected parent questions
      const followUpTasks: any[] = [];

      // Find selected parent questions and extract their follow-up tasks
      currentStage.questions?.forEach((question: Question) => {
        if (config.selectedQuestions.includes(question.question_uuid)) {
          // Check direct logics for follow-up tasks
          if (question.logics) {
            question.logics.forEach((logic: Logic) => {
              if (logic.follow_up && logic.follow_up.task_close_questions) {
                followUpTasks.push(...logic.follow_up.task_close_questions);
              }
              // Check logic questions for follow-up tasks
              if (logic.logic_questions) {
                logic.logic_questions.forEach((logicQuestion: Question) => {
                  if (logicQuestion.logics) {
                    logicQuestion.logics.forEach((subLogic: Logic) => {
                      if (subLogic.follow_up && subLogic.follow_up.task_close_questions) {
                        followUpTasks.push(...subLogic.follow_up.task_close_questions);
                      }
                    });
                  }
                });
              }
            });
          }
        }
      });

      // Remove duplicates based on question id
      const uniqueTasks = followUpTasks.filter((task, index, self) =>
        index === self.findIndex(t => t.id === task.id)
      );

      taskIds = uniqueTasks.map(task => task.id);
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
    // Clean up the saved configuration after successful assignment
    await SecureStoreService.remove(configKey);

  } catch (error) {
    throw error;
  }
};

/**
 * Checks if there are saved assignment configurations for a form
 * @param formId The ID of the form
 * @returns Promise<boolean>
 */
export const hasSavedAssignments = async (formId: string, stageId?: string): Promise<boolean> => {
  try {
    const configKey = stageId
      ? `bulk_assignments_${formId}_${stageId}`
      : `bulk_assignments_${formId}`;
    const configString = await SecureStoreService.get(configKey);
    return !!configString;
  } catch (error) {
    return false;
  }
};
