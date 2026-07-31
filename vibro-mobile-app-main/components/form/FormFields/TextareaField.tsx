/* TextareaField.tsx */
import React from "react";
import { Controller } from "react-hook-form";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { matchLogicCondition } from "../../../services/matchLogicCondition";
import { textColors, typography } from "../../../styles/typography";
import { InputWrapper, KeyboardAwareContainerRef } from "../../KeyboardAwareContainer";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

interface TextareaFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
  onFocus?: (fieldName: string) => void;
  container?: React.RefObject<KeyboardAwareContainerRef>;
}

const TextareaField: React.FC<TextareaFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable,
  hasError,
  onFocus,
  container,
}) => {
  const [characterCount, setCharacterCount] = React.useState(0);
  const [isFocused, setIsFocused] = React.useState(false);

  const getVisibleLogicIndexes = (selectedValues: any[]): number[] => {
    if (!question?.logics?.length) return [];

    const visibleLogicIndexes: number[] = [];

    question.logics.forEach((logic, index) => {
      const passes = selectedValues.some((selectedValue) =>
        matchLogicCondition(
          selectedValue,
          logic.logic_value,
          logic.logic_type,
          logic.comparison
        )
      );
      if (passes) {
        visibleLogicIndexes.push(index);
      }
    });

    return visibleLogicIndexes;
  };

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted} hasError={hasError}>
      {() => (
        <Controller
          control={control}
          name={name}
          defaultValue={undefined}
          rules={{
            required: question.is_required ? "This field is required" : false,
          }}
          render={({ field: { onChange, onBlur, value } }) => {
            const hasFieldError = errors[name] || hasError;
            // For editable forms use the current form value as the source of truth;
            // only fall back to question.answers.answer in read-only/completed views.
            const currentValue = (isCompleted || !isEditable)
              ? (question?.answers?.answer ?? value ?? "")
              : (value ?? "");
            const shouldShowFloatingLabel = isFocused || (currentValue && currentValue.trim());
            // Use the value from form state (which uses uniqueId) instead of question.answers.answer
            // This ensures data isolation between different instances of the same question
            const displayValue = currentValue;
            const visibleLogicIndexes = currentValue && currentValue.trim() ? getVisibleLogicIndexes([currentValue]) : [];

            return (
              <View style={[styles.fieldContainer, hasFieldError && styles.fieldErrorContainer]}>
                {question?.reference_images?.length || question?.reference_videos?.length ? (
                  <Reference
                    mediaUrls={[
                      ...(question?.reference_images || []),
                      ...(question?.reference_videos || []),
                    ]}
                  />
                ) : null}

                <InputWrapper inputKey={name} container={container}>
                  <View style={styles.inputContainer}>
                    <View style={[styles.inputWrapper, hasFieldError && styles.inputWrapperError]}>
                      <View style={[styles.borderTop, hasFieldError && styles.borderTopError]} />
                      {shouldShowFloatingLabel && (
                        <Text style={[styles.floatingLabel, hasFieldError && styles.floatingLabelError]}>
                          Enter the Data here...
                        </Text>
                      )}
                      <View style={[styles.borderBottom, hasFieldError && styles.borderBottomError]} />
                      <TextInput
                        style={[
                          styles.textarea,
                          {
                            height: question.question_type === "long_answer" ? 150 : 80,
                            fontWeight: isCompleted ? "400" : "normal",
                          },
                        ]}
                        onFocus={() => {
                          setIsFocused(true);
                        }}
                        onChangeText={(text) => {
                          onChange(text);
                          setCharacterCount(text.length);
                        }}
                        onBlur={() => {
                          setIsFocused(false);
                          onBlur();
                        }}
                        value={displayValue}
                        placeholder={!shouldShowFloatingLabel ? "Enter the Data here..." : ""}
                        placeholderTextColor="#9b9b9bff"
                        multiline
                        numberOfLines={question.question_type === "long_answer" ? 4 : 3}
                        textAlignVertical="top"
                        editable={isEditable}
                      />
                    </View>
                  </View>
                </InputWrapper>

                <View style={styles.footer}>
                  {hasFieldError ? (
                    <Text style={styles.errorText}>
                      {errors[name]?.message || "This field is required"}
                    </Text>
                  ) : (
                    question.question_hint && (
                      <Text style={styles.hintText}>{question.question_hint}</Text>
                    )
                  )}
                </View>

                {visibleLogicIndexes.length > 0 && (
                  <View>
                    {question.logics?.map(
                      (logic, logicIndex) =>
                        visibleLogicIndexes.includes(logicIndex) &&
                        logic?.logic_questions?.map((logicQuestion) => {
                          // Use uniqueId for error checking and key generation
                          const uniqueId = (logicQuestion as any).uniqueId || logicQuestion.question_uuid;
                          const logicQuestionError = !!errors[uniqueId] || hasError;
                          return logicQuestion.question_type === "table" ? (
                            <TableField
                              key={uniqueId}
                              question={logicQuestion}
                              control={control}
                              errors={errors}
                              isCompleted={isCompleted}
                              isEditable={isEditable}
                            />
                          ) : (
                            <FormField
                              key={uniqueId}
                              question={logicQuestion}
                              control={control}
                              errors={errors}
                              isCompleted={isCompleted}
                              isEditable={isEditable}
                              hasError={logicQuestionError}
                            />
                          );
                        })
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  fieldContainer: { marginTop: 8 },
  fieldErrorContainer: {
    borderWidth: 1,
    borderColor: textColors.error,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFF0F0",
  },
  inputContainer: {
    position: 'relative',
  },
  inputWrapper: {
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: "#ddd",
    borderRightWidth: 1,
    borderRightColor: "#ddd",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "#fff",
    paddingTop: 8,
  },
  inputWrapperError: {
    borderLeftColor: textColors.error,
    borderRightColor: textColors.error,
    borderBottomColor: textColors.error,
    backgroundColor: "#FFF0F0",
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "#ddd",
  },
  borderTopError: {
    backgroundColor: textColors.error,
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "#ddd",
  },
  borderBottomError: {
    backgroundColor: textColors.error,
  },
  floatingLabel: {
    position: 'absolute',
    left: 14,
    top: -8,
    paddingHorizontal: 4,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    zIndex: 1,
    backgroundColor: "#fff",
  },
  floatingLabelError: {
    color: textColors.error,
  },
  textarea: {
    ...typography.labelLarge,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 16,
    paddingTop: 20,
    backgroundColor: "transparent",
    textAlignVertical: "top",
    color: textColors.primary,
  },
  lockedInput: {
    backgroundColor: "#f0f0f0",
    color: "#a0a0a0",
  },
  inputError: {
    borderColor: textColors.error,
    backgroundColor: "#FFF0F0",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  errorText: {
    ...typography.bodySmall,
    color: textColors.error,
    flex: 1
  },
  hintText: {
    ...typography.caption,
    color: textColors.tertiary,
    fontStyle: "italic",
    flex: 1
  },
});

export default TextareaField;