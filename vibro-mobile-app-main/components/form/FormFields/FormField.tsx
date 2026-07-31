import React, { createContext, memo, useContext, useEffect, useRef } from "react";
import { View } from "react-native";
import { KeyboardAwareContainerRef } from "../../KeyboardAwareContainer";
import { useFormulaCalculation } from "../hooks/useMultiStageFormula";
import { Question } from "../types/formTypes";
import AuditField from "./AuditField";
import {
  CheckboxField,
  DateTimeField,
  DropdownField,
  FileUploadField,
  FormulaField,
  LinearScaleField,
  MultipleChoiceField,
  QRScannerField,
  ShortAnswer,
  SignatureField,
  TextareaField,
  TextInputField,
  TitleDescriptionField,
} from "./index";

// Create the FormContainerContext
export const FormContainerContext =
  createContext<React.RefObject<KeyboardAwareContainerRef> | null>(null);
interface FormFieldProps {
  question: Question;
  control: any;
  errors: any;
  name?: string;
  isCompleted?: boolean;
  allQuestions?: Question[];
  setValue?: any;
  updateScore?: any;
  hasError?: boolean;
  isEditable?: boolean;
  onFocus?: (fieldName: string) => void;
  focusedInputKey?: string | null;
  getFieldRef?: (inputKey: string) => React.RefObject<View | null> | undefined;
  visibleQuestions?: Set<string>;
  getValues?: any;
  validationErrors?: Record<string, boolean>;
  onFollowupTaskCreated?: (questionId: string, taskData: any) => void;
  container?: React.RefObject<KeyboardAwareContainerRef>;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  plannerLocationId?: string;
  plannerLocationName?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({
  question,
  control,
  errors,
  name = (question as any).uniqueId || question.question_uuid,
  isCompleted,
  allQuestions = [],
  setValue,
  updateScore,
  hasError,
  isEditable,
  onFocus,
  focusedInputKey,
  getFieldRef,
  visibleQuestions,
  getValues,
  validationErrors,
  onFollowupTaskCreated,
  container: propContainer,
  defaultExpanded,
  forceExpanded,
  plannerLocationId,
  plannerLocationName,
}) => {
  const { evaluateFormula } = useFormulaCalculation(control, [
    { questions: allQuestions || [] },
  ]);

  // Get container from context if not provided as prop
  const contextContainer = useContext(FormContainerContext);
  const container = propContainer || contextContainer;

  const isFieldValueEmpty = (value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "string") return value.trim() === "";
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  };

  // Check if field value is empty on mount/form reset to clear stale answers.
  // Avoids useWatch subscription which would cause this component to re-render
  // on every value change for this field.
  const prevFieldValueRef = useRef<any>(undefined);
  useEffect(() => {
    const current = (control._formValues || {})[name];
    const prev = prevFieldValueRef.current;
    if (
      !isFieldValueEmpty(prev) &&
      isFieldValueEmpty(current) &&
      (question as any).answers
    ) {
      (question as any).answers = undefined;
    }
    prevFieldValueRef.current = current;
  }, [name, question, control]);

  const fieldProps = {
    question,
    control,
    errors,
    name,
    isCompleted,
    allQuestions,
    evaluateFormula,
    setValue,
    updateScore,
    hasError,
    isEditable,
    onFocus,
    focusedInputKey,
    getFieldRef,
    visibleQuestions,
    getValues,
    validationErrors,
    defaultExpanded,
    forceExpanded,
    ...(plannerLocationId && { plannerLocationId }),
    ...(plannerLocationName && { plannerLocationName }),
    ...(container && { container }),
  };

  const followupProps = {
    ...fieldProps,
    onFollowupTaskCreated,
  };

  switch (question.question_type) {
    case "user":
    case "division":
    case "sub_division":
    case "location":
    case "dropdown":
      return <DropdownField {...followupProps} />;
    case "long_answer":
      return <TextareaField {...fieldProps} />;
    case "title_and_description":
      return <TitleDescriptionField {...fieldProps} />;
    // Add this case to handle title and description questions that might be incorrectly typed
    case "time":
    case "date":
    case "datetime":
      return <DateTimeField {...fieldProps} />;
    case "checkboxes":
      return <CheckboxField {...fieldProps} />;
    case "multiple_choice":
      return <MultipleChoiceField {...followupProps} />;
    case "linear_scale":
      return <LinearScaleField {...fieldProps} />;
    case "upload_image":
    case "upload_file":
    case "upload_video":
    case "upload_audio":
      return <FileUploadField {...fieldProps} />;
    case "signature":
      return <SignatureField {...fieldProps} />;
    case "qr_code":
      return <QRScannerField {...fieldProps} />;
    case "formula":
      return <FormulaField {...fieldProps} />;
    case "audit":
      return <AuditField {...fieldProps} />;
    case "short_answer":
      return <ShortAnswer {...fieldProps} />;
    default:
      return <TextInputField {...fieldProps} />;
  }
};

// Memoize FormField to prevent unnecessary re-renders in large forms (600+ questions)
// Only re-render when question data, errors, or field-specific props change
const FormField = memo(FormFieldComponent, (prevProps, nextProps) => {
  // Re-render if question changed
  if (prevProps.question.question_uuid !== nextProps.question.question_uuid)
    return false;

  // Re-render if error state changed for this specific field
  const prevError =
    prevProps.errors?.[prevProps.name || prevProps.question.question_uuid];
  const nextError =
    nextProps.errors?.[nextProps.name || nextProps.question.question_uuid];
  if (prevError !== nextError) return false;

  // Re-render if hasError prop changed
  if (prevProps.hasError !== nextProps.hasError) return false;

  // Re-render if isCompleted changed
  if (prevProps.isCompleted !== nextProps.isCompleted) return false;

  // Re-render if isEditable changed
  if (prevProps.isEditable !== nextProps.isEditable) return false;

  // Re-render if focused state changed for THIS field only
  const prevFocused = prevProps.focusedInputKey === prevProps.question.question_uuid;
  const nextFocused = nextProps.focusedInputKey === nextProps.question.question_uuid;
  if (prevFocused !== nextFocused) return false;

  // Re-render when forced expansion state changes (used by audit auto-navigation)
  if (prevProps.forceExpanded !== nextProps.forceExpanded) return false;

  // Re-render when default expanded state changes
  if (prevProps.defaultExpanded !== nextProps.defaultExpanded) return false;

  // Re-render when plannerLocationId changes (location locking)
  if (prevProps.plannerLocationId !== nextProps.plannerLocationId) return false;

  // Re-render when plannerLocationName changes (location locking)
  if (prevProps.plannerLocationName !== nextProps.plannerLocationName) return false;

  // Re-render if visibility changed (for conditional logic)
  if (prevProps.visibleQuestions !== nextProps.visibleQuestions) {
    const prevKey =
      (prevProps.question as any).uniqueId || prevProps.question.question_uuid;
    const nextKey =
      (nextProps.question as any).uniqueId || nextProps.question.question_uuid;
    const prevVisible = prevProps.visibleQuestions?.has(prevKey);
    const nextVisible = nextProps.visibleQuestions?.has(nextKey);
    if (prevVisible !== nextVisible) return false;
  }

  // Re-render if validationErrors changed for this field or any of its sub-questions
  if (prevProps.validationErrors !== nextProps.validationErrors) {
    // Check if this field's validation error changed
    const fieldKey =
      (prevProps.question as any).uniqueId || prevProps.question.question_uuid;
    if (
      prevProps.validationErrors?.[fieldKey] !==
      nextProps.validationErrors?.[fieldKey]
    ) {
      return false;
    }
    // Check if any sub-question's validation error changed
    const logics = prevProps.question.logics || [];
    for (const logic of logics) {
      for (const logicQuestion of logic.logic_questions || []) {
        const logicKey =
          (logicQuestion as any).uniqueId || logicQuestion.question_uuid;
        if (
          prevProps.validationErrors?.[logicKey] !==
          nextProps.validationErrors?.[logicKey]
        ) {
          return false;
        }
      }
    }
  }

  // Don't re-render if only allValues object reference changed but this field's value didn't
  return true;
});

export default FormField;
