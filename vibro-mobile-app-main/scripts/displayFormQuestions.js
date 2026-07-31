#!/usr/bin/env node

/**
 * Script to display all form questions organized by stage
 * Usage: node scripts/displayFormQuestions.js
 */

const fs = require('fs');
const path = require('path');

// Import the display utility (we'll need to create a JS version or use ts-node)
const formData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'answer.json'), 'utf8'));


// Helper function to display questions (inline version since we can't import TS directly)
function displayAllFormQuestions(formData) {

  formData.stages.forEach((stage, stageIndex) => {

    if (stage.questions.length === 0) {
      return;
    }

    stage.questions.forEach((question, questionIndex) => {
      displayQuestion(question, `  ${question.order}.`);
    });
  });
}

function displayQuestion(question, prefix) {
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

// Call the display function
displayAllFormQuestions(formData);

// Display question types summary
const questionTypes = new Set();
formData.stages.forEach(stage => {
  stage.questions.forEach(question => {
    questionTypes.add(question.question_type);
    if (question.sub_questions) {
      question.sub_questions.forEach(subQ => {
        questionTypes.add(subQ.question_type);
      });
    }
    if (question.logics) {
      question.logics.forEach(logic => {
        if (logic.logic_questions) {
          logic.logic_questions.forEach(logicQ => {
            questionTypes.add(logicQ.question_type);
          });
        }
        if (logic.follow_up?.task_close_questions) {
          logic.follow_up.task_close_questions.forEach(taskQ => {
            questionTypes.add(taskQ.question_type);
          });
        }
      });
    }
  });
});

formData.stages.forEach(stage => {
  let count = stage.questions.length;

  stage.questions.forEach(question => {
    if (question.sub_questions) {
      count += question.sub_questions.length;
    }
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
});
