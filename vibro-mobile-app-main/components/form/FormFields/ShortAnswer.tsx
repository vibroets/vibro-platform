import React, { useEffect, useRef } from "react";
import { Controller, useWatch } from "react-hook-form";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { InputWrapper, KeyboardAwareContainerRef } from "../../KeyboardAwareContainer";
import { matchLogicCondition } from "../../../services/matchLogicCondition";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

interface ShortAnswerFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  onFocus?: (fieldName: string) => void;
  focusedInputKey?: string | null;
  hasError?: boolean;
  validationErrors?: Record<string, boolean>;
  setValue?: any;
  container?: React.RefObject<KeyboardAwareContainerRef>;
}

const ShortAnswerField: React.FC<ShortAnswerFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable,
  onFocus,
  focusedInputKey,
  hasError,
  validationErrors,
  setValue,
  container,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // Watch the field value to sync with local state
  const watchedValue = useWatch({
    control,
    name,
    defaultValue: ''
  });

  // Calculate the filtered value
  const filteredValue = question.question_sub_type === 'number' && watchedValue
    ? String(watchedValue).replace(/[^0-9.-]/g, '')
    : watchedValue || '';

  // Auto-focus when this field is highlighted due to validation error
  useEffect(() => {
    if (focusedInputKey === name && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusedInputKey, name]);

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
    <FormFieldWrapper question={question} isCompleted={isCompleted} focusedInputKey={focusedInputKey} hasError={hasError}>
      {({ expanded }) => (
        <>
          {(question as any)?.reference_images?.length ||
          (question as any)?.reference_videos?.length ? (
            <Reference
              mediaUrls={[
                ...((question as any)?.reference_images || []),
                ...((question as any)?.reference_videos || []),
              ]}
            />
          ) : null}

          <Controller
            control={control}
            name={name}
            defaultValue={undefined}
            rules={{
              required: question.is_required ? "This field is required" : false,
            }}
            render={({ field: { onChange, onBlur, value } }) => {
              // Use form state value instead of question.answers.answer to prevent data replication
              const currentValue = filteredValue;
              const shouldShowFloatingLabel = isFocused || (currentValue && currentValue !== "Enter the Data here...");
              const displayValue = currentValue === "Enter the Data here..." && !isFocused ? "" : currentValue;
              const showPlaceholderAsValue = !currentValue && !isFocused;
              let visibleLogicIndexes: number[] = [];
              if (question?.logics?.length) {
                visibleLogicIndexes = currentValue && currentValue.trim() ? getVisibleLogicIndexes([currentValue]) : [];
              }

              return (
                <>
                <View style={styles.inputContainer}>
                  <View style={[styles.inputWrapper, (errors[name] || hasError) && styles.inputWrapperError]}>
                    <View style={[styles.borderTop, (errors[name] || hasError) && styles.borderTopError]} />
                    {shouldShowFloatingLabel && (
                      <Text style={[styles.floatingLabel, (errors[name] || hasError) && styles.floatingLabelError]}>
                        Enter the Data here...
                      </Text>
                    )}
                    <View style={[styles.borderBottom, (errors[name] || hasError) && styles.borderBottomError]} />
                    <InputWrapper inputKey={name} container={container}>
                      <TextInput
                      ref={inputRef}
style={[
  styles.input,
  isCompleted && styles.completedInput,
  !isEditable && styles.lockedInput,
  {
    marginTop: -4,   // 👈 this moves the placeholder & text UP slightly
    paddingTop: 0,
    paddingBottom: 4,
    lineHeight: 18,
  },
]}
                      onFocus={() => {
                        setIsFocused(true);
                      }}
                      onChangeText={(text) => {
                        let processedText = text;
                        if (question.question_sub_type === 'number') {
                          processedText = text.replace(/[^0-9.-]/g, '');
                        }

                        // Handle logic question clearing when text changes
                        if (question?.logics?.length) {
                          // Calculate currently visible logic questions BEFORE the change
                          const currentlyVisibleLogicQuestions = new Set<string>();
                          const currentVisibleIndexes = currentValue && currentValue.trim() ? getVisibleLogicIndexes([currentValue]) : [];
                          question.logics.forEach((logic, logicIndex) => {
                            if (currentVisibleIndexes.includes(logicIndex)) {
                              logic.logic_questions?.forEach(lq => {
                                currentlyVisibleLogicQuestions.add(lq.question_uuid);
                              });
                            }
                          });

                          // Calculate which logic questions will be visible AFTER the change
                          const newVisibleLogicIndexes = processedText && processedText.trim() ? getVisibleLogicIndexes([processedText]) : [];
                          const willBeVisibleLogicQuestions = new Set<string>();
                          question.logics.forEach((logic, logicIndex) => {
                            if (newVisibleLogicIndexes.includes(logicIndex)) {
                              logic.logic_questions?.forEach(lq => {
                                willBeVisibleLogicQuestions.add(lq.question_uuid);
                              });
                            }
                          });

                          // Clear values of logic questions that will become hidden
                          // This ensures answers don't persist when text changes
                          currentlyVisibleLogicQuestions.forEach(questionUuid => {
                            if (!willBeVisibleLogicQuestions.has(questionUuid)) {
                              // This logic question was visible before but won't be after - clear its value
                              // Also clear any nested logic questions recursively
                              const logicQuestion = question.logics?.flatMap(l => l.logic_questions).find(lq => lq.question_uuid === questionUuid);
                              const logicQuestionKey = (logicQuestion as any)?.uniqueId || questionUuid;
                              setValue?.(logicQuestionKey, undefined);
                              if (logicQuestion) {
                                (logicQuestion as any).answers = undefined;
                              }
                              if (logicQuestion?.logics) {
                                const clearNestedLogic = (lq: any) => {
                                  lq.logics?.forEach((nestedLogic: any) => {
                                    nestedLogic.logic_questions?.forEach((nestedLq: any) => {
                                      const nestedKey = (nestedLq as any)?.uniqueId || nestedLq.question_uuid;
                                      setValue?.(nestedKey, undefined);
                                      (nestedLq as any).answers = undefined;
                                      clearNestedLogic(nestedLq);
                                    });
                                  });
                                };
                                clearNestedLogic(logicQuestion);
                              }
                            }
                          });
                        }

                        onChange(processedText);
                      }}
                      onBlur={() => {
                        setIsFocused(false);
                        onBlur();
                      }}
                      value={displayValue}
                      placeholder={!shouldShowFloatingLabel ? "Enter the Data here..." : ""}
                      placeholderTextColor="#9b9b9bff"
                      maxLength={question.question_sub_type === 'number' ? 255 : (question.max_value || 255)}
                      keyboardType={question.question_sub_type === 'number' ? 'numeric' : 'default'}
                      accessibilityLabel={question.question}
                      accessibilityHint={question.description || ""}
                      editable={isEditable}
                    />
                    </InputWrapper>
                  </View>
                </View>

                  {errors[name] && (
                    <Text style={styles.errorText}>{errors[name].message}</Text>
                  )}
                  {visibleLogicIndexes.length > 0 && (
                    <View>
                      {question.logics?.map(
                        (logic, logicIndex) =>
                          visibleLogicIndexes.includes(logicIndex) &&
                          logic?.logic_questions?.map((logicQuestion) => {
                            const logicQuestionKey = (logicQuestion as any).uniqueId || logicQuestion.question_uuid;
                            const logicQuestionError = !!errors[logicQuestionKey] || !!validationErrors?.[logicQuestionKey];
                            return logicQuestion.question_type === "table" ? (
                              <TableField
                                key={logicQuestionKey}
                                question={logicQuestion}
                                control={control}
                                errors={errors}
                                isCompleted={isCompleted}
                                isEditable={isEditable}
                              />
                            ) : (
                              <FormField
                                key={logicQuestionKey}
                                question={logicQuestion}
                                control={control}
                                errors={errors}
                                isCompleted={isCompleted}
                                isEditable={isEditable}
                                hasError={logicQuestionError}
                                validationErrors={validationErrors}
                                onFocus={onFocus}
                                setValue={setValue}
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
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    position: 'relative',
  },
  inputWrapper: {
    position: 'relative',
    borderLeftWidth: 1.5,
    borderLeftColor: "#ddd",
    borderRightWidth: 1.5,
    borderRightColor: "#ddd",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "#fff",
    paddingTop: 8,
  },
  inputWrapperError: {
    borderLeftColor: "red",
    borderRightColor: "red",
    borderBottomColor: "red",
    backgroundColor: "#FFF0F0",
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 3,
    right: 3,
    height: 1,
    backgroundColor: "#ddd",
  },
  borderTopError: {
    backgroundColor: "red",
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 3,
    right: 3,
    height: 1,
    backgroundColor: "#ddd",
  },
  borderBottomError: {
    backgroundColor: "red",
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
    color: 'red',
  },
  input: {
    borderWidth: 0,
    padding: 12,
    paddingTop: 16,
    fontSize: 16,
    backgroundColor: "transparent",
    minHeight: 50,
  },
  lockedInput: {
    backgroundColor: "#f0f0f0",
    color: "#a0a0a0",
  },
  completedInput: {
    backgroundColor: "#f5f5f5",
    color: "#666",
  },
  errorText: {
    color: "red",
    marginTop: 5,
    fontSize: 14,
  },
  hintText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    marginBottom: 16,
  },
});

export default ShortAnswerField;
