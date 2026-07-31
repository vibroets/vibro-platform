import { matchLogicCondition } from "@/services/matchLogicCondition";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Controller } from "react-hook-form";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Option, Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

interface AuditFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  allValues?: any;
  updateScore: (questionId: string | number, score: number) => void;
  hasError?: boolean;
  onFocus?: (fieldName: string) => void;
  focusedInputKey?: string | null;
  getFieldRef?: (inputKey: string) => React.RefObject<View | null> | undefined;
  validationErrors?: Record<string, boolean>;
  setValue?: any;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  container?: React.RefObject<
    import("../../../components/KeyboardAwareContainer").KeyboardAwareContainerRef
  >;
}

const AuditField: React.FC<AuditFieldProps> = ({
  question,
  control,
  errors,
  name = (question as any).uniqueId || question.question_uuid,
  isCompleted,
  isEditable = true,
  allValues,
  updateScore,
  hasError,
  onFocus,
  focusedInputKey,
  getFieldRef,
  validationErrors,
  setValue,
  defaultExpanded,
  forceExpanded,
  container,
}) => {
  const isCheckbox = question.question_type === "checkboxes";
  const hasOtherOption = question.is_other;
  const shouldForceExpand =
    !!forceExpanded ||
    !!hasError ||
    !!errors?.[name] ||
    !!validationErrors?.[name] ||
    !!validationErrors?.[question.question_uuid];

  const getVisibleLogicIndexes = (selectedValues: any[]): number[] => {
    if (!question?.logics?.length || !question?.options?.length) return [];

    const visibleLogicIndexes: number[] = [];
    const selectedOptionValues = selectedValues
      .filter((item) => item?.id)
      .map((item) => question.options.find((opt) => opt.id === item.id)?.option)
      .filter((value) => value !== undefined);

    question.logics.forEach((logic, index) => {
      const passes = selectedOptionValues.some((selectedValue) =>
        matchLogicCondition(selectedValue, logic.logic_value, logic.logic_type),
      );
      if (passes) {
        visibleLogicIndexes.push(index);
      }
    });

    return visibleLogicIndexes;
  };

  return (
    <FormFieldWrapper
      question={question}
      isCompleted={isCompleted}
      hasError={hasError}
      focusedInputKey={focusedInputKey}
      defaultExpanded={defaultExpanded}
      forceExpanded={shouldForceExpand}
    >
      {({ expanded }) => (
        <>
          {/* Reference Media - only show when expanded */}
          {expanded &&
          (question?.reference_images?.length ||
            question?.reference_videos?.length) ? (
            <Reference
              mediaUrls={[
                ...(question?.reference_images || []),
                ...(question?.reference_videos || []),
              ]}
            />
          ) : null}

          <Controller
            control={control}
            name={name}
            rules={{
              validate: (value) =>
                !question.is_required ||
                (value && (isCheckbox ? value.length > 0 : !!value)) ||
                "Please select at least one option",
            }}
            render={({ field: { onChange, value } }) => {
              const currentValue = Array.isArray(value) ? value : [];
              const deriveSelectedFromAnswers = (): any[] => {
                const answers: any = (question as any)?.answers;
                const answerData: any = (question as any)?.answer_data;
                const rawCandidates: any[] = [];

                if (Array.isArray(answers)) rawCandidates.push(...answers);
                else if (answers) rawCandidates.push(answers);

                if (answerData) rawCandidates.push(answerData);
                if ((question as any)?.answer)
                  rawCandidates.push({ answer: (question as any).answer });
                if ((question as any)?.submitted_value)
                  rawCandidates.push({ answer: (question as any).submitted_value });

                const selected: any[] = [];
                const pushById = (id: number) => {
                  const matched = question.options?.find((opt) => Number(opt.id) === id);
                  if (matched) selected.push({ id: Number(matched.id), option: matched.option });
                };
                const pushByText = (text: string) => {
                  const matched = question.options?.find(
                    (opt) => String(opt.option || "").toLowerCase() === text.toLowerCase(),
                  );
                  if (matched) selected.push({ id: Number(matched.id), option: matched.option });
                };

                for (const raw of rawCandidates) {
                  const answerId = raw?.answer_id;
                  const answer = raw?.answer;
                  if (answerId != null && !Number.isNaN(Number(answerId))) {
                    pushById(Number(answerId));
                    continue;
                  }
                  if (typeof answer === "number") {
                    pushById(Number(answer));
                    continue;
                  }
                  if (typeof answer === "string" && answer.trim()) {
                    const parts = answer.includes("|")
                      ? answer.split("|").map((v: string) => v.trim()).filter(Boolean)
                      : [answer.trim()];
                    for (const part of parts) {
                      if (!Number.isNaN(Number(part))) pushById(Number(part));
                      else pushByText(part);
                    }
                  }
                }

                return selected;
              };

              const logicSourceValue =
                currentValue.length > 0
                  ? currentValue
                  : isCompleted || !isEditable
                    ? deriveSelectedFromAnswers()
                    : currentValue;
              let visibleLogicIndexes: number[] =
                getVisibleLogicIndexes(logicSourceValue);

              const otherValue =
                currentValue.find((item: any) => item?.isOther)?.text || "";

              const handleOptionPress = (option: Option) => {
                if (isCompleted) return;

                // Single or multiple selection logic
                let newValue;
                if (isCheckbox) {
                  newValue = [...currentValue];
                  const optionIndex = newValue.findIndex(
                    (item: any) => item?.id === option.id,
                  );
                  if (optionIndex >= 0) {
                    newValue.splice(optionIndex, 1);
                  } else {
                    newValue.push({ id: option.id });
                  }
                } else {
                  newValue = [{ id: option.id }];
                }

                const selectionChanged =
                  newValue.length !== currentValue.length ||
                  !newValue.every((nv: any) =>
                    currentValue.some((cv: any) => cv?.id === nv?.id),
                  );

                onChange(newValue);

                // Whenever the selection actually changes, wipe ALL logic question data
                // (including nested logic) so that no stale photo/comment/attachment
                // data from the previous option reappears.
                if (selectionChanged && setValue) {
                  // Determine which logic questions will still be visible after this
                  // selection so we don't unregister fields the user is currently editing.
                  const visibleIndexes = getVisibleLogicIndexes(newValue);
                  const visibleKeys = new Set<string>();
                  const collectVisibleKeys = (logics: any[]) => {
                    logics?.forEach((logic: any, idx: number) => {
                      if (visibleIndexes.includes(idx)) {
                        logic.logic_questions?.forEach((lq: any) => {
                          visibleKeys.add(
                            (lq as any)?.uniqueId || lq.question_uuid,
                          );
                        });
                      }
                    });
                  };
                  collectVisibleKeys(question.logics);

                  const clearAllLogicQuestions = (logics: any[]) => {
                    logics?.forEach((logic) => {
                      logic.logic_questions?.forEach((lq: any) => {
                        const key =
                          (lq as any)?.uniqueId || lq.question_uuid;
                        setValue(key, undefined);
                        setValue(`${key}_other`, undefined);
                        (lq as any).answers = undefined;
                        if (!visibleKeys.has(key)) {
                          control?.unregister?.(key, { keepDefaultValue: false, keepValue: true });
                          control?.unregister?.(`${key}_other`, { keepDefaultValue: false, keepValue: true });
                        }
                        if (lq.logics?.length) {
                          clearAllLogicQuestions(lq.logics);
                        }
                      });
                    });
                  };
                  clearAllLogicQuestions(question.logics);
                }

                // ✅ Update score whenever user selects an option

                isCompleted
                  ? updateScore(question?.question_uuid, question?.answer?.answer)
                  : updateScore(question.question_uuid, option.score || 0);
              };

              const handleOtherTextChange = (text: string) => {
                if (isCompleted) return;

                const newValue = [...currentValue];
                const otherIndex = newValue.findIndex(
                  (item: any) => item?.isOther,
                );

                if (text.trim()) {
                  const otherItem = { isOther: true, text: text.trim() };
                  if (otherIndex >= 0) {
                    newValue[otherIndex] = otherItem;
                  } else {
                    newValue.push(otherItem);
                  }
                } else if (otherIndex >= 0) {
                  newValue.splice(otherIndex, 1);
                }
                onChange(newValue);
              };

              const isOptionSelected = (optionId: number | string) => {
                if (isCompleted && question?.answers?.answer) {
                  return optionId === Number(question.answers.answer_id);
                }
                return currentValue.some(
                  (item: any) => item?.id === optionId || item === optionId,
                );
              };

              return (
                <>
                  {/* Options - only show when expanded */}
                  {expanded && (
                    <View
                      style={[
                        styles.optionsContainer,
                        (errors[name] || hasError) &&
                          styles.optionsContainerError,
                      ]}
                    >
                      {question.options?.map((option) => (
                        <TouchableOpacity
                          disabled={isCompleted}
                          key={option.id}
                          style={[
                            styles.optionButton,
                            isOptionSelected(option.id) &&
                              styles.optionSelected,
                          ]}
                          onPress={() => handleOptionPress(option)}
                        >
                          <View style={styles.optionContent}>
                            {isCheckbox ? (
                              <MaterialIcons
                                name={
                                  isOptionSelected(option.id)
                                    ? "check-box"
                                    : "check-box-outline-blank"
                                }
                                size={24}
                                color={
                                  isOptionSelected(option.id)
                                    ? "#007AFF"
                                    : "#666"
                                }
                              />
                            ) : (
                              <MaterialIcons
                                name={
                                  isOptionSelected(option.id)
                                    ? "radio-button-checked"
                                    : "radio-button-unchecked"
                                }
                                size={24}
                                color={
                                  isOptionSelected(option.id)
                                    ? "#007AFF"
                                    : "#666"
                                }
                              />
                            )}
                            <Text style={styles.optionText}>
                              {option.option} ({option.score || 0} pts)
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}

                      {hasOtherOption && (
                        <View style={styles.otherOptionContainer}>
                          <TouchableOpacity
                            disabled={isCompleted}
                            style={[
                              styles.optionButton,
                              otherValue && styles.optionSelected,
                              styles.otherOptionButton,
                            ]}
                            onPress={() => {
                              if (!otherValue) handleOtherTextChange(" ");
                            }}
                          >
                            <View style={styles.optionContent}>
                              {isCheckbox ? (
                                <MaterialIcons
                                  name={
                                    otherValue
                                      ? "check-box"
                                      : "check-box-outline-blank"
                                  }
                                  size={24}
                                  color={otherValue ? "#007AFF" : "#666"}
                                />
                              ) : (
                                <MaterialIcons
                                  name={
                                    otherValue
                                      ? "radio-button-checked"
                                      : "radio-button-unchecked"
                                  }
                                  size={24}
                                  color={otherValue ? "#007AFF" : "#666"}
                                />
                              )}
                              <Text style={styles.optionText}>Other</Text>
                            </View>
                          </TouchableOpacity>

                          {otherValue && (
                            <TextInput
                              style={[
                                styles.otherInput,
                                errors[`${name}_other`] && styles.inputError,
                              ]}
                              placeholder="Please specify..."
                              value={otherValue}
                              onChangeText={handleOtherTextChange}
                              editable={!isCompleted}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Logic Questions - only show when expanded */}
                  {expanded && visibleLogicIndexes.length > 0 && (
                    <View>
                      {question.logics?.map(
                        (logic, logicIndex) =>
                          visibleLogicIndexes.includes(logicIndex) &&
                          logic?.logic_questions?.map((logicQuestion) => {
                            const logicQuestionKey =
                              (logicQuestion as any).uniqueId ||
                              logicQuestion.question_uuid;
                            const logicQuestionError =
                              !!errors[logicQuestionKey] ||
                              !!validationErrors?.[logicQuestionKey];
                            return logicQuestion.question_type === "table" ? (
                              <View
                                key={logicQuestionKey}
                                ref={getFieldRef?.(logicQuestionKey)}
                              >
                                <TableField
                                  question={logicQuestion}
                                  control={control}
                                  errors={errors}
                                  isCompleted={isCompleted}
                                  isEditable={isEditable}
                                />
                              </View>
                            ) : (
                              <View
                                key={logicQuestionKey}
                                ref={getFieldRef?.(logicQuestionKey)}
                              >
                                <FormField
                                  question={logicQuestion}
                                  control={control}
                                  errors={errors}
                                  isCompleted={isCompleted}
                                  isEditable={isEditable}
                                  hasError={logicQuestionError}
                                  onFocus={onFocus}
                                  focusedInputKey={focusedInputKey}
                                  validationErrors={validationErrors}
                                  setValue={setValue}
                                  container={container}
                                />
                              </View>
                            );
                          }),
                      )}
                    </View>
                  )}

                  {/* Sub Questions - only show when expanded */}
                  {expanded &&
                    question.sub_questions
                      .filter(
                        (subQues) =>
                          // Hide observation (short_answer/long_answer) and photo (upload_*) questions
                          !(
                            subQues.question_type === "short_answer" ||
                            subQues.question_type === "long_answer" ||
                            subQues.question_type.startsWith("upload_")
                          ),
                      )
                      .map((subQues) => {
                        const subQuestionKey =
                          (subQues as any).uniqueId || subQues.question_uuid;
                        const subQuestionError =
                          !!errors[subQuestionKey] ||
                          !!validationErrors?.[subQuestionKey];
                        return (
                          <View
                            key={subQuestionKey}
                            ref={getFieldRef?.(subQuestionKey)}
                          >
                            <FormField
                              question={subQues}
                              control={control}
                              errors={errors}
                              isCompleted={isCompleted}
                              isEditable={isEditable}
                              hasError={subQuestionError}
                              onFocus={onFocus}
                              focusedInputKey={focusedInputKey}
                              validationErrors={validationErrors}
                              container={container}
                            />
                          </View>
                        );
                      })}
                </>
              );
            }}
          />

          {/* Error Message - only show when expanded */}
          {expanded && errors[name] && (
            <Text style={styles.errorText}>{errors[name].message}</Text>
          )}
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  optionsContainer: { marginTop: 8 },
  optionsContainerError: {
    borderWidth: 1,
    borderColor: "red",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFF0F0",
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  optionSelected: { borderColor: "#007AFF", backgroundColor: "#F0F7FF" },
  optionContent: { flexDirection: "row", alignItems: "center" },
  optionText: { fontSize: 16, marginLeft: 12, flex: 1 },
  otherOptionContainer: { marginTop: 8 },
  otherOptionButton: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  otherInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: { borderColor: "red", backgroundColor: "#FFF0F0" },
  errorText: { color: "red", marginTop: 8, fontSize: 14 },
});

export default AuditField;
