/* TextInputField.tsx */
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

interface TextInputFieldProps {
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

const TextInputField: React.FC<TextInputFieldProps> = ({
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
        <View style={styles.container}>
          {(Array.isArray(question?.reference_images) && question?.reference_images.length) || (Array.isArray(question?.reference_videos) && question?.reference_videos.length) ? (
            <Reference
              mediaUrls={[
                ...(Array.isArray(question?.reference_images) ? question?.reference_images : []).filter((url: any) => typeof url === 'string'),
                ...(Array.isArray(question?.reference_videos) ? question?.reference_videos : []).filter((url: any) => typeof url === 'string'),
              ]}
            />
          ) : null}

          <Controller
            control={control}
            name={name}
            defaultValue={undefined}
            rules={{ required: question.is_required ? "This field is required" : false }}
            render={({ field: { onChange, onBlur, value, ref } }) => {
              const shouldShowFloatingLabel = isFocused || (value && value.trim());
            // Use the value from form state (which uses uniqueId) instead of question.answers.answer
            // This ensures data isolation between different instances of the same question
            const displayValue = value;
              const visibleLogicIndexes = value && value.trim() ? getVisibleLogicIndexes([value]) : [];

              return (
                <>
                  <InputWrapper inputKey={name} container={container}>
                    <View style={styles.inputContainer}>
                      <View style={[styles.inputWrapper, hasError && styles.inputWrapperError]}>
                        <View style={[styles.borderTop, hasError && styles.borderTopError]} />
                        {shouldShowFloatingLabel && (
                          <Text style={[styles.floatingLabel, hasError && styles.floatingLabelError]}>
                            Enter the Data here...
                          </Text>
                        )}
                        <View style={[styles.borderBottom, hasError && styles.borderBottomError]} />
                        <TextInput
                          ref={ref}
                          style={[styles.input, !isEditable && styles.lockedInput]}
                          value={displayValue}
                          onFocus={() => {
                            setIsFocused(true);
                          }}
                          onChangeText={onChange}
                          onBlur={() => {
                            setIsFocused(false);
                            onBlur();
                          }}
                          editable={isEditable}
                          placeholder={!shouldShowFloatingLabel ? "Enter the Data here..." : ""}
                          placeholderTextColor="#9b9b9bff"
                        />
                      </View>
                    </View>
                  </InputWrapper>

                  {errors[name] && (
                    <Text style={styles.errorText}>
                      {String(errors[name].message || "This field is required")}
                    </Text>
                  )}

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
                </>
              );
            }}
          />
        </View>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
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
    left: 12,
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
  input: {
    ...typography.labelLarge,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingTop: 16,
    color: textColors.primary,
    backgroundColor: "transparent",
    minHeight: 50,
  },
  lockedInput: {
    backgroundColor: "#f0f0f0",
    color: "#a0a0a0",
  },
  errorText: {
    ...typography.bodySmall,
    color: textColors.error,
    marginTop: 6,
  },
});

export default TextInputField;
