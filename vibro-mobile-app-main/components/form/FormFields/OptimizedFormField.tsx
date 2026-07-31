import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { useFormulaCalculation } from "../hooks/useMultiStageFormula";
import { Question } from "../types/formTypes";
import {
  CheckboxField,
  DateTimeField,
  DropdownField,
  FileUploadField,
  FormulaField,
  LinearScaleField,
  MultipleChoiceField,
  QRScannerField,
  SignatureField,
  TextareaField,
  TextInputField,
} from "./index";
import AuditField from "./AuditField";

interface OptimizedFormFieldProps {
  question: Question;
  control: any;
  errors: any;
  name?: string;
  isCompleted?: boolean;
  allValues?: any;
  allQuestions?: Question[];
  setValue?: any;
  updateScore?: any;
  shouldFocus?: boolean;
  onFocus?: () => void;
}

const OptimizedFormField: React.FC<OptimizedFormFieldProps> = ({
  question,
  control,
  errors,
  name = question.question_uuid,
  isCompleted,
  allValues = {},
  allQuestions = [],
  setValue,
  updateScore,
  shouldFocus = false,
  onFocus,
}) => {
  const fieldRef = useRef<View>(null);
  
  const { evaluateFormula } = useFormulaCalculation(control, [
    { questions: allQuestions || [] },
  ]);

  // Auto-focus on required field if needed
  useEffect(() => {
    if (shouldFocus && fieldRef.current && onFocus) {
      // Scroll to this field and trigger focus
      setTimeout(() => {
        onFocus();
      }, 100);
    }
  }, [shouldFocus, onFocus]);

  const fieldProps = {
    question,
    control,
    errors,
    name,
    isCompleted,
    allValues,
    allQuestions,
    evaluateFormula,
    setValue,
    updateScore,
  };

  const renderField = () => {
    switch (question.question_type) {
      case "user":
      case "division":
      case "sub_division":
      case "location":
      case "dropdown":
        return <DropdownField {...fieldProps} />;
      case "long_answer":
      case "title_and_description":
        return <TextareaField {...fieldProps} />;
      case "time":
      case "date":
      case "datetime":
        return <DateTimeField {...fieldProps} />;
      case "checkboxes":
        return <CheckboxField {...fieldProps} />;
      case "multiple_choice":
        return <MultipleChoiceField {...fieldProps} />;
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
      default:
        return <TextInputField {...fieldProps} />;
    }
  };

  return (
    <View 
      ref={fieldRef}
      nativeID={question.question_uuid}
      style={[
        styles.container,
        shouldFocus && styles.focusedContainer,
        question.is_required && !allValues[name] && styles.requiredContainer,
      ]}
    >
      {renderField()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  focusedContainer: {
    borderColor: "#007AFF",
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#F0F7FF",
  },
  requiredContainer: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
    paddingLeft: 8,
  },
});

export default OptimizedFormField;
