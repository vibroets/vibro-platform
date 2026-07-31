interface Question {
  question: string;
  question_type: string;
  question_uuid: string;
  order: number;
  is_required: boolean;
  question_hint?: string;
  description?: string;
  options?: Array<{option: string; order: number}>;
  sub_questions?: Question[];
  logics?: Array<{
    logic_type: string;
    logic_value: string;
    order: number;
    logic_questions: Question[];
    follow_up: {
      title: string;
      task_close_questions: Question[];
    };
  }>;
  min_value?: number;
  max_value?: number;
  number_of_file_allowed?: number;
  require_live?: boolean;
  formula?: string;
  is_other?: boolean;
  question_sub_type?: string;
}

interface Stage {
  name: string;
  order: number;
  questions: Question[];
}

interface FormData {
  form_type: string;
  title: string;
  stages: Stage[];
}

// Utility function to display all questions by stage
export function displayAllFormQuestions(formData: FormData): void {

  formData.stages.forEach((stage, stageIndex) => {

    if (stage.questions.length === 0) {
      return;
    }

    stage.questions.forEach((question, questionIndex) => {
      displayQuestion(question, `  ${question.order}.`);
    });
  });
}

// Helper function to display a single question with all its details
function displayQuestion(question: Question, prefix: string): void {

  if (question.question_hint) {
  }

  if (question.description) {
  }

  // Display question-specific properties
  switch (question.question_type) {
    case 'table':
      if (question.min_value && question.max_value) {
      }
      if (question.sub_questions && question.sub_questions.length > 0) {
        question.sub_questions.forEach((subQ, index) => {
          displayQuestion(subQ, `     ${index + 1}.`);
        });
      }
      break;

    case 'dropdown':
    case 'multiple_choice':
    case 'checkboxes':
      if (question.options && question.options.length > 0) {
        question.options.forEach((option, index) => {
        });
        if (question.is_other) {
        }
      }
      break;

    case 'linear_scale':
      if (question.min_value && question.max_value) {
      }
      if (question.options && question.options.length > 0) {
        question.options.forEach((option, index) => {
        });
      }
      break;

    case 'upload_image':
    case 'upload_video':
    case 'upload_file':
      if (question.number_of_file_allowed) {
      }
      if (question.require_live) {
      }
      break;

    case 'formula':
      if (question.formula) {
      }
      break;

    case 'qr_code':
      if (question.question_hint) {
      }
      break;
  }

  // Display logic questions if they exist
  if (question.logics && question.logics.length > 0) {
    question.logics.forEach((logic, logicIndex) => {

      if (logic.logic_questions && logic.logic_questions.length > 0) {
        logic.logic_questions.forEach((logicQ, index) => {
          displayQuestion(logicQ, `          ${index + 1}.`);
        });
      }

      if (logic.follow_up) {
        if (logic.follow_up.task_close_questions && logic.follow_up.task_close_questions.length > 0) {
          logic.follow_up.task_close_questions.forEach((taskQ, index) => {
            displayQuestion(taskQ, `          ${index + 1}.`);
          });
        }
      }
    });
  }
}

// Function to get all question types used in the form
export function getQuestionTypes(formData: FormData): string[] {
  const types = new Set<string>();

  formData.stages.forEach(stage => {
    stage.questions.forEach(question => {
      types.add(question.question_type);

      // Add sub-question types
      if (question.sub_questions) {
        question.sub_questions.forEach(subQ => {
          types.add(subQ.question_type);
        });
      }

      // Add logic question types
      if (question.logics) {
        question.logics.forEach(logic => {
          if (logic.logic_questions) {
            logic.logic_questions.forEach(logicQ => {
              types.add(logicQ.question_type);
            });
          }
          if (logic.follow_up?.task_close_questions) {
            logic.follow_up.task_close_questions.forEach(taskQ => {
              types.add(taskQ.question_type);
            });
          }
        });
      }
    });
  });

  return Array.from(types).sort();
}

// Function to get total question count by stage
export function getQuestionCountByStage(formData: FormData): Array<{stage: string; count: number}> {
  return formData.stages.map(stage => {
    let count = stage.questions.length;

    // Count sub-questions
    stage.questions.forEach(question => {
      if (question.sub_questions) {
        count += question.sub_questions.length;
      }

      // Count logic questions
      if (question.logics) {
        question.logics.forEach(logic => {
          if (logic.logic_questions) {
            count += logic.logic_questions.length;
          }
          if (logic.follow_up?.task_close_questions) {
            count += logic.follow_up.task_close_questions.length;
          }
        });
      }
    });

    return {
      stage: stage.name,
      count: count
    };
  });
}

// Function to export questions as JSON for external use
export function exportQuestionsAsJSON(formData: FormData): string {
  const exportData = {
    form_title: formData.title,
    form_type: formData.form_type,
    total_stages: formData.stages.length,
    stages: formData.stages.map(stage => ({
      stage_name: stage.name,
      stage_order: stage.order,
      questions: stage.questions.map(q => ({
        question: q.question,
        type: q.question_type,
        required: q.is_required,
        uuid: q.question_uuid,
        order: q.order,
        hint: q.question_hint,
        description: q.description,
        options: q.options,
        sub_questions_count: q.sub_questions?.length || 0,
        logics_count: q.logics?.length || 0
      }))
    }))
  };

  return JSON.stringify(exportData, null, 2);
}
