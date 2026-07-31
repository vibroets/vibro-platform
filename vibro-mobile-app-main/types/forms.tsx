import { FormType } from "@/components/form/types/formTypes";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export interface NavigationProps {
  navigation: NativeStackNavigationProp<any>;
}

export interface ItemType {
  form?: FormType
  id: string;
  title?: string;
  name?: string;
}

export interface ItemsProps {
  items: ItemType;
  onClick?: (id: string) => void;
}

export type QuestionType =
  | "short_answer"
  | "long_answer"
  | "dropdown"
  | "checkbox"
  | "radio";
export type InputType = "text" | "textarea" | "dropdown" | "checkbox" | "radio";

export interface QuestionValidation {
  pattern?: {
    value: RegExp;
    message: string;
  };
  minLength?: {
    value: number;
    message?: string;
  };
  maxLength?: {
    value: number;
    message?: string;
  };
  requiredMessage?: string;
  custom?: (value: any, allValues?: any, fieldName?: string) => true | string;
}

// export interface Question {
//   id: string;
//   question: string;
//   question_type: QuestionType;
//   input_type: InputType;
//   is_required: boolean;
//   options?: string[];
//   validation?: QuestionValidation;
// }

export interface Stage {
  id: number;
  name: string;
  order: number;
  created_at: string;
  updated_at: string | null;
  form: number;
  questions: Question[];
}

export interface Question {
  id: number;
  question_uuid: string;
  question: string;
  description: string | null;
  critical: boolean;
  formula: string | null;
  question_type: string;
  question_sub_type: string | null;
  question_hint: string | null;
  order: number;
  is_required: boolean;
  require_live: boolean;
  number_of_file_allowed: number | null;
  min_value: number | null;
  max_value: number | null;
  max_score: number | null;
  is_logic_question: boolean;
  is_task_close_question: boolean;
  is_audit_info_question: boolean;
  is_other: boolean;
  form: number;
  stage: number;
  audit_info: any | null; // Adjust type as needed if structure is known
  audit_group: any | null; // Adjust type as needed if structure is known
  parent_question: number | null;
  sub_questions: Question[];
  options: Option[];
  logics: Logic[];
}

export interface Option {
  id: number;
  created_at: string;
  updated_at: string | null;
  option: string;
  score: number;
  failed: boolean;
  order: number;
  question: number;
  stage: number;
  audit_info: any | null; // Adjust type as needed if structure is known
  audit_group: any | null; // Adjust type as needed if structure is known
  form: number;
  name?: string;
  username?: string
}

export interface Logic {
  id: number;
  created_at: string;
  updated_at: string | null;
  logic_type: string;
  logic_value: string;
  notification: boolean;
  email: string | null;
  order: number;
  user: any | null; // Adjust type as needed if structure is known
  group: any | null; // Adjust type as needed if structure is known
  form: number;
  stage: number;
  audit_info: any | null; // Adjust type as needed if structure is known
  audit_group: any | null; // Adjust type as needed if structure is known
  question: number;
  logic_questions: Question[];
  follow_up: FollowUp | null;
}

export interface FollowUp {
  task_close_questions: Question[];
  title: string;
  deadline: number;
  assign_to: string;
  logic: number;
  assign_form: any | null; // Adjust type as needed if structure is known
  user: any | null; // Adjust type as needed if structure is known
  group: any | null; // Adjust type as needed if structure is known
  form: number;
  stage: number;
  audit_info: any | null; // Adjust type as needed if structure is known
  audit_group: any | null; // Adjust type as needed if structure is known
  question: number;
}
  export interface MultiStageFormProps {
    stages: Stage[];
    stageLen?: number;
    onSubmit: (data: any) => void;
  }

export type FieldRendererProps = {
  control: any;
  question: Question;
  stageOrder: number;
  errors: any;
  isEnabled: boolean;
};
