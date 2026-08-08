/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import {
  Animated,
  Dimensions,
  InteractionManager,
  Keyboard,
  PanResponder,
  StyleSheet,
  Text,
  View
} from "react-native";
import { matchLogicCondition } from "../../../services/matchLogicCondition";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";
import TableField from "./TableField";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_MARGIN = 30;
const SLIDER_WIDTH = SCREEN_WIDTH - SLIDER_MARGIN * 2;
const THUMB_SIZE = 28;
const TRACK_HEIGHT = 4;

interface LinearScaleFieldProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean; // Added hasError prop for error highlighting
  validationErrors?: Record<string, boolean>;
  onFocus?: (fieldName: string) => void;
  setValue?: any;
  container?: React.RefObject<import("../../KeyboardAwareContainer").KeyboardAwareContainerRef>;
}

const LinearScaleField: React.FC<LinearScaleFieldProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable = true,
  hasError,
  validationErrors,
  onFocus,
  setValue,
  container,
}) => {
  const minValue = question.min_value || 1;
  const maxValue = question.max_value || 10;
  const submittedValue = isCompleted ? Number(question.answers.answer) : null;
  const [sliderLayout, setSliderLayout] = useState({
    x: 0,
    width: SLIDER_WIDTH,
  });
  const thumbPosition = useRef(new Animated.Value(0)).current;
  const sliderRef = useRef<View>(null);
  const isDragging = useRef(false);

  const calculateValue = (position: number) => {
    const percentage = position / sliderLayout.width;
    const value = minValue + Math.round(percentage * (maxValue - minValue));
    return Math.min(Math.max(value, minValue), maxValue);
  };

  const calculatePosition = (value: number) => {
    return ((value - minValue) / (maxValue - minValue)) * sliderLayout.width;
  };

  const updateThumbPosition = (value: number) => {
    const position = calculatePosition(value);
    thumbPosition.setValue(position);
  };

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
      {({ expanded }) => (
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
            name={name}
            rules={{
              required: question.is_required ? "This field is required" : false,
            }}
            render={({ field: { onChange, value } }) => {
              const currentValue = isCompleted
                ? submittedValue || minValue
                : value?.[name] || minValue;

              let visibleLogicIndexes: number[] = isCompleted
                ? getVisibleLogicIndexes(
                    question?.answers?.answer
                      ? [Number(question.answers.answer)]
                      : []
                  )
                : getVisibleLogicIndexes([currentValue]);

              useEffect(() => {
                updateThumbPosition(currentValue);
              }, [currentValue]);

              const handleValueChange = (newValue: number) => {
                // Calculate currently visible logic questions BEFORE the change
                const currentlyVisibleLogicQuestions = new Set<string>();
                question.logics?.forEach((logic, logicIndex) => {
                  if (visibleLogicIndexes.includes(logicIndex)) {
                    logic.logic_questions?.forEach(lq => {
                      currentlyVisibleLogicQuestions.add(lq.question_uuid);
                    });
                  }
                });

                // Calculate which logic questions will be visible AFTER the change
                const newVisibleLogicIndexes = getVisibleLogicIndexes([newValue]);
                const willBeVisibleLogicQuestions = new Set<string>();
                question.logics?.forEach((logic, logicIndex) => {
                  if (newVisibleLogicIndexes.includes(logicIndex)) {
                    logic.logic_questions?.forEach(lq => {
                      willBeVisibleLogicQuestions.add(lq.question_uuid);
                    });
                  }
                });

                // Clear values of logic questions that will become hidden
                // This ensures answers don't persist when switching slider values
                currentlyVisibleLogicQuestions.forEach(questionUuid => {
                  if (!willBeVisibleLogicQuestions.has(questionUuid)) {
                    // This logic question was visible before but won't be after - clear its value
                    // Also clear any nested logic questions recursively
                    const logicQuestion = question.logics?.flatMap(l => l.logic_questions).find(lq => lq.question_uuid === questionUuid);
                    const logicQuestionKey = (logicQuestion as any)?.uniqueId || questionUuid;
                    setValue?.(logicQuestionKey, undefined);
                    if (logicQuestion?.logics) {
                      const clearNestedLogic = (lq: any) => {
                        lq.logics?.forEach((nestedLogic: any) => {
                          nestedLogic.logic_questions?.forEach((nestedLq: any) => {
                            const nestedKey = (nestedLq as any)?.uniqueId || nestedLq.question_uuid;
                            setValue?.(nestedKey, undefined);
                            clearNestedLogic(nestedLq);
                          });
                        });
                      };
                      clearNestedLogic(logicQuestion);
                    }
                  }
                });

                onChange({ [name]: newValue });
              };

              const panResponder = PanResponder.create({
                onStartShouldSetPanResponder: () => isEditable,
                onMoveShouldSetPanResponder: () => isEditable,
                onPanResponderGrant: (evt) => {
                  if (!isEditable) return;
                  isDragging.current = true;
                  const touchX = evt.nativeEvent.locationX;
                  const newValue = calculateValue(touchX);
                  thumbPosition.setValue(touchX);
                  handleValueChange(newValue);
                  InteractionManager.runAfterInteractions(() => Keyboard.dismiss());
                },
                onPanResponderMove: (evt, gestureState) => {
                  if (!isDragging.current || !isEditable) return;
                  const newPosition = Math.min(
                    Math.max(gestureState.moveX - sliderLayout.x, 0),
                    sliderLayout.width
                  );
                  const newValue = calculateValue(newPosition);
                  thumbPosition.setValue(newPosition);
                  handleValueChange(newValue);
                },
                onPanResponderRelease: () => {
                  isDragging.current = false;
                },
                onPanResponderTerminate: () => {
                  isDragging.current = false;
                },
              });

              // Determine if the field has an error
              const isFieldError = !!errors[name] || hasError;

              return (
                <>
                  <View style={styles.sliderContainer}>
                    {/* End labels */}
                    {question.options?.length >= 2 && (
                      <View style={styles.labelsContainer}>
                        <Text style={styles.endLabel}>
                          {question.options[0].option}
                        </Text>
                        <Text style={styles.endLabel}>
                          {question.options[1].option}
                        </Text>
                      </View>
                    )}

                    {/* Slider */}
                    <View
                      ref={sliderRef}
                      style={[
                        styles.sliderTrack,
                        isFieldError && styles.errorInput, // Apply error styling
                      ]}
                      onLayout={(event) => {
                        const { x, width } = event.nativeEvent.layout;
                        setSliderLayout({ x: x + SLIDER_MARGIN, width });
                        updateThumbPosition(currentValue);
                      }}
                      {...(isEditable ? panResponder.panHandlers : {})}
                    >
                      <View style={styles.trackLine} />

                      <View style={styles.ticksContainer}>
                        {Array.from({ length: maxValue - minValue + 1 }).map(
                          (_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.tick,
                                {
                                  left: `${(i / (maxValue - minValue)) * 100}%`,
                                  backgroundColor:
                                    i === currentValue - minValue
                                      ? "#007AFF"
                                      : "#999",
                                },
                              ]}
                            />
                          )
                        )}
                      </View>

                      {/* Thumb */}
                      <Animated.View
                        style={[
                          styles.thumb,
                          {
                            transform: [{ translateX: thumbPosition }],
                            shadowColor: "#007AFF",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 3,
                          },
                        ]}
                      />
                    </View>

                    {/* Value display */}
                    <View style={styles.valueContainer}>
                      <Text style={styles.valueText}>{minValue}</Text>
                      <View style={styles.selectedValueContainer}>
                        <Text style={styles.selectedValueText}>{currentValue}</Text>
                      </View>
                      <Text style={styles.valueText}>{maxValue}</Text>
                    </View>
                  </View>
                  {visibleLogicIndexes.length > 0 && (
                    <View>
                      {question.logics?.map(
                        (logic, logicIndex) =>
                          visibleLogicIndexes.includes(logicIndex) &&
                          logic?.logic_questions?.map((logicQuestion) => {
                            // Pass hasError based on logicQuestion validation (check both errors and validationErrors)
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
                                // hasError={logicQuestionError} // Pass hasError to TableField
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
                                container={container}
                              />
                            );
                          })
                      )}
                    </View>
                  )}

                  {(errors[name] || hasError) && (
                    <Text style={styles.errorText}>
                      {errors[name]?.message || "This field is required"}
                    </Text>
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
  container: {
    marginBottom: 20,
    paddingHorizontal: SLIDER_MARGIN,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
    color: "#333",
  },
  required: {
    color: "red",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  sliderContainer: {
    marginTop: 8,
    paddingHorizontal: SLIDER_MARGIN,
  },
  labelsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  endLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  sliderTrack: {
    height: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "#fff",
  },
  errorInput: {
    borderColor: "red",
    borderWidth: 2,
    backgroundColor: "#FFF0F0", // Light red background for error state
  },
  trackLine: {
    height: TRACK_HEIGHT,
    backgroundColor: "#E0E0E0",
    borderRadius: TRACK_HEIGHT / 2,
    position: "absolute",
    left: 0,
    right: 0,
  },
  ticksContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 20,
    top: "50%",
    marginTop: -10,
  },
  tick: {
    position: "absolute",
    width: 2,
    height: 8,
    borderRadius: 1,
    top: 6,
    marginLeft: -1,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    top: "50%",
    marginTop: -THUMB_SIZE / 2,
    zIndex: 2,
  },
  valueContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  valueText: {
    fontSize: 14,
    color: "#666",
  },
  selectedValueContainer: {
    minWidth: 40,
    alignItems: "center",
  },
  selectedValueText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  errorText: {
    color: "red",
    marginTop: 6,
    fontSize: 13,
  },
});

export default LinearScaleField;
