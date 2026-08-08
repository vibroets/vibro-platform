// src/components/FormFields/FormulaField.tsx
import React, { useEffect } from "react";
import { Controller, useWatch } from "react-hook-form";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormFieldWrapper from "./FormFieldWrapper";
import {
  buildFormulaValueMap,
  getFormulaDisplayText,
} from "../utils/formulaHelpers";

interface FormulaFieldProps {
  question: Question;
  control: any;
  errors: any;
  name?: string;
  allValues?: any;
  allQuestions?: Question[];
  evaluateFormula: (formula: string, values: any) => string;
  setValue: any;
  isCompleted?: boolean;
  hasError?: boolean;
}

const FormulaField: React.FC<FormulaFieldProps> = ({
  question,
  control,
  errors,
  name = question.question_uuid,
  allValues,
  allQuestions = [],
  evaluateFormula,
  setValue,
  isCompleted,
  hasError,
}) => {
  const watchedValue = useWatch({ control, name, defaultValue: "" });

  useEffect(() => {
    if (question.formula) {
      const allFormValues = control._formValues || {};
      const normalizedValues = buildFormulaValueMap(allQuestions, allFormValues);
      const result = evaluateFormula(question.formula, normalizedValues);
      const currentValue = normalizedValues?.[name];
      if (result !== currentValue) {
        setValue(name, result);
      }
    }
  }, [watchedValue, allQuestions, question.formula, name, evaluateFormula, control, setValue]);

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted}>
      {() => (
        <>
          {question?.reference_images?.length ||
          question?.reference_videos?.length ? (
            <Reference
              mediaUrls={[
                ...(question?.reference_images || []),
                ...(question?.reference_videos || []),
              ]}
            />
          ) : null}

          <Controller
            control={control}
            render={({ field: { value } }) => (
              <TextInput
                style={[styles.input, styles.formulaInput, (errors[name] || hasError) && styles.inputError]}
                value={isCompleted ? question?.answers?.answer : value}
                editable={false}
                placeholder="Calculated automatically"
              />
            )}
            name={name}
            defaultValue=""
          />
          {question.formula && (
            <Text style={styles.formulaText}>
              Formula: {getFormulaDisplayText(question.formula, allQuestions)}
            </Text>
          )}
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  required: {
    color: "red",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
  },
  formulaInput: {
    backgroundColor: "#f5f5f5",
  },
  inputError: {
    borderColor: "red",
    backgroundColor: "#FFF0F0",
  },
  formulaText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});

export default FormulaField;
