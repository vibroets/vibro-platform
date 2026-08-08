
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Controller } from "react-hook-form";
import { InteractionManager, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormFieldWrapper from "./FormFieldWrapper";

interface CheckboxesQuestionProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
}

const CheckboxField: React.FC<CheckboxesQuestionProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable = true,
  hasError,
}) => {
  const coerceAnswerValue = (value: any) => {
    if (value == null) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          try {
            const normalized = trimmed
              .replace(/'/g, '"')
              .replace(/\bNone\b/g, "null")
              .replace(/\bTrue\b/g, "true")
              .replace(/\bFalse\b/g, "false");
            return JSON.parse(normalized);
          } catch {
            return value;
          }
        }
      }
      return value;
    }
    return value;
  };

  const normalizeIds = (val: any): number[] => {
    if (val == null) return [];
    const coerced = coerceAnswerValue(val);
    if (Array.isArray(coerced)) {
      return coerced
        .map((item) => {
          if (item == null) return null;
          if (typeof item === "object") {
            return item.id ?? item.option_id ?? item.value ?? item.answer_id ?? item.answer;
          }
          return item;
        })
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
    }
    if (typeof coerced === "string") {
      return coerced
        .split(/[|,]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => Number(p))
        .filter((v) => Number.isFinite(v));
    }
    const num = Number(coerced);
    return Number.isFinite(num) ? [num] : [];
  };

  const completedSelectedIds = normalizeIds(
    question?.answers?.answer_id ??
    question?.answers?.answer ??
    (question as any)?.submitted_answer ??
    (question as any)?.submitted_value ??
    (question as any)?.answer
  );

  const coerceOptions = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          try {
            const normalized = trimmed
              .replace(/'/g, '"')
              .replace(/\bNone\b/g, "null")
              .replace(/\bTrue\b/g, "true")
              .replace(/\bFalse\b/g, "false");
            const parsed = JSON.parse(normalized);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
      }
    }
    return [];
  };

  const normalizedOptions = coerceOptions((question as any)?.options) || [];

  // Check if "Other" option exists in the options
  const hasOtherOption = question.options?.some(option => option.option?.toLowerCase() === 'other') || question.is_other;

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
              validate: (value) =>
                !question.is_required ||
                (value && value.length > 0) ||
                "At least one option must be selected",
            }}
            render={({ field: { onChange, value } }) => {
              const currentValue = value || [];

              // Check if "Other" option is selected
              const otherOption = question.options?.find(opt => opt.option?.toLowerCase() === 'other');
              const isOtherSelected = otherOption ? currentValue.includes(otherOption.id) : false;

              // Get other text from a separate field or from question.answers.other_text
              const otherValue = isCompleted ? (question?.answers?.other_text || "") :
                              (currentValue.find((item: any) => item?.isOther)?.text || "");

              const optionsToShow = normalizedOptions.length
                ? normalizedOptions
                : (Array.isArray((question as any)?.answers?.answer)
                  ? (question as any).answers.answer
                  : question.options);
              const hasFieldError = errors[name] || hasError;

              const handleOtherTextChange = (text: string) => {
                if (!isEditable || isCompleted) return;

                const newValue = currentValue.filter((item: any) => !item?.isOther);
                if (text.trim()) {
                  newValue.push({ isOther: true, text: text.trim() });
                }
                onChange(newValue);
              };

              return (
                <View style={[styles.optionsContainer, hasFieldError && styles.optionsContainerError]}>
                  {optionsToShow?.map((option) => {
                    const isSelected = isCompleted
                      ? completedSelectedIds.includes(option.id)
                      : currentValue.includes(option.id);

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={styles.optionButton}
                        disabled={!isEditable}
                        onPress={() => {
                          const newValue = currentValue ? [...currentValue] : [];
                          if (isSelected) {
                            onChange(newValue.filter((id) => id !== option.id));
                          } else {
                            onChange([...newValue, option.id]);
                          }
                          InteractionManager.runAfterInteractions(() => Keyboard.dismiss());
                        }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxSelected,
                          ]}
                        >
                          {isSelected && (
                            <MaterialIcons name="check" size={16} color="white" />
                          )}
                        </View>
                        <Text style={styles.optionText}>{option.option}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Other Text Input - shows when "Other" option is selected */}
                  {isOtherSelected && (
                    <View style={styles.otherTextareaContainer}>
                      <Controller
                        control={control}
                        name={`${name}_other`}
                        rules={{
                          required: isOtherSelected ? "Please specify" : false,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <TextInput
                            style={[
                              styles.otherTextarea,
                              errors[`${name}_other`] && styles.inputError,
                            ]}
                            placeholder="Please specify..."
                            value={value || otherValue}
                            onChangeText={(text) => {
                              onChange(text);
                              handleOtherTextChange(text);
                            }}
                            editable={isEditable && !isCompleted}
                            autoCapitalize="sentences"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                          />
                        )}
                      />
                      {errors[`${name}_other`] && (
                        <Text style={styles.errorTextSmall}>
                          {errors[`${name}_other`]?.message}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />

          {errors[name] && (
            <Text style={styles.errorText}>{errors[name].message}</Text>
          )}
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  required: {
    color: "red",
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionsContainerError: {
    borderWidth: 1,
    borderColor: "red",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFF0F0",
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  optionText: {
    fontSize: 13,
    flex: 1,
  },
  otherOptionContainer: {
    marginTop: 8,
  },
  otherInputContainer: {
    marginLeft: 34,
    marginTop: 8,
  },
  otherInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  otherTextareaContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingTop: 8,
  },
  otherTextarea: {
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "red",
    backgroundColor: "#FFF0F0",
  },
  errorText: {
    color: "red",
    marginTop: 4,
    fontSize: 13,
  },
  errorTextSmall: {
    color: "red",
    marginTop: 4,
    fontSize: 12,
  },
});

export default CheckboxField;
