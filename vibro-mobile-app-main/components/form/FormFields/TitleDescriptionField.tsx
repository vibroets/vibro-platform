import React from "react";
import FormFieldWrapper from "./FormFieldWrapper";

interface TitleDescriptionFieldProps {
  question: {
    question: string;
    is_required?: boolean;
    description?: string | null;
    question_hint?: any;
    question_type?: string;
    question_uuid?: string;
  };
  isCompleted?: boolean;
  hasError?: boolean;
  focusedInputKey?: string | null;
}

const TitleDescriptionField: React.FC<TitleDescriptionFieldProps> = ({
  question,
  isCompleted,
  hasError,
  focusedInputKey,
}) => {
  return (
    <FormFieldWrapper
      question={question}
      isCompleted={isCompleted}
      hasError={hasError}
      focusedInputKey={focusedInputKey}
    >
      {() => null}
    </FormFieldWrapper>
  );
};

export default TitleDescriptionField;
