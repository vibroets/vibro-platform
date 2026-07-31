import * as yup from "yup";
import { Question } from "../types/formTypes";

export const generateValidationSchema = (questions: Question[]) => {
  let schema: any = {};

  questions.forEach((question) => {
    if (question.question_type === "table") {
      // Handle table validation
      schema[question.question_uuid] = yup
        .array()
        .of(
          yup.object().shape(
            question.sub_questions.reduce((acc, subQ) => {
              acc[subQ.question_uuid] = getFieldValidation(subQ);
              return acc;
            }, {} as any)
          )
        )
        .min(question.min_value || 1)
        .max(question.max_value || 10);
    }
    if (question.question_type === "signature" && question.is_required) {
      schema[question.question_uuid] = yup
        .string()
        .required("Signature is required");
    } else {
      schema[question.question_uuid] = getFieldValidation(question);
    }
  });

  return yup.object().shape(schema);
};

const getFieldValidation = (question: Question) => {
  let validator;

  switch (question.question_type) {
    case "short_answer":
      if (question.question_sub_type === 'number') {
        validator = yup.string()
          .matches(/^[0-9.-]*$/, "Only numeric values are allowed for this field")
          .test('is-valid-number', 'Please enter a valid number', (value) => {
            if (!value || value.trim() === '') return !question.is_required;
            const numValue = parseFloat(value);
            return !isNaN(numValue);
          });
      } else {
        validator = yup.string();
      }
      break;
    case "long_answer":
      validator = yup.string();
      break;
    case "user":
    case "division":
    case "sub_division":
    case "location":
    case "dropdown":
      validator = yup.string().required();
      break;
    case "multiple_choice":
    case "checkboxes":
      validator = yup.array().min(1);
      break;
    case "date":
      validator = yup.date().required();
      break;
    case "time":
      validator = yup.string().matches(/^\d{2}:\d{2}$/);
      break;
    case "datetime":
      validator = yup.date().required();
      break;
    // case "location":
    //   validator = yup.object().shape({
    //     latitude: yup.number().required(),
    //     longitude: yup.number().required(),
    //   });
    //   break;
    // case "division":
    // case "sub_division":
    //   validator = yup.string().required();
    //   break;
    case "linear_scale":
      validator = yup.object().shape({
        [question.question_uuid]: yup
          .number()
          .required(question.is_required ? "Please select a value" : undefined)
          .min(
            question.min_value || 1,
            `Minimum value is ${question.min_value || 1}`
          )
          .max(
            question.max_value || 10,
            `Maximum value is ${question.max_value || 10}`
          ),
      });
      break;
    case "upload_image":
    case "upload_file":
      validator = yup
        .array()
        .max(question.number_of_file_allowed || 5)
        .required();
      break;
    default:
      validator = yup.string();
  }

  if (question.is_required) {
    validator = validator.required("This field is required");
  }

  return validator;
};
