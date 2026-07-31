import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Controller } from "react-hook-form";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity
} from "react-native";
import { Question } from "../types/formTypes";
import { formatDate } from "../utils/formHelpers";
import FormFieldWrapper from "./FormFieldWrapper";

interface DateQuestionProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  hasError?: boolean;
}

const DateQuestion: React.FC<DateQuestionProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  hasError,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const getDisplayValue = (value: string) => {
    if (!value) return question.question_hint || "Select date";
    return formatDate(value);
  };

  const getIcon = () => "calendar-today" as const;

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted} hasError={hasError}>
      {({ expanded }) => (
        <>
          <Controller
            control={control}
            name={name}
            rules={{
              required: question.is_required ? "This field is required" : false,
            }}
            render={({ field: { onChange, value } }) => {
              // When completed, use the answer from question.answers, otherwise use form value
              const displayValue = isCompleted 
                ? (question.answers?.answer || value)
                : value;
              
              return (
                <>
                  <TouchableOpacity
                    style={[
                      styles.dateInput, 
                      (errors[name] || hasError) && styles.inputError,
                      isCompleted && styles.disabledInput
                    ]}
                    onPress={() => !isCompleted && setShowPicker(true)}
                    disabled={isCompleted}
                    activeOpacity={isCompleted ? 1 : 0.7}
                  >
                    <Text style={[styles.dateText, isCompleted && styles.disabledText]}>
                      {getDisplayValue(displayValue)}
                    </Text>
                    <MaterialIcons 
                      name={getIcon()} 
                      size={20} 
                      color={isCompleted ? "#bbb" : "#666"} 
                    />
                  </TouchableOpacity>

                  {showPicker && !isCompleted && (
                  <DateTimePicker
                    value={value ? new Date(value) : new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(event, selectedDate) => {
                      if (event.type === 'dismissed') {
                        setShowPicker(false);
                        return;
                      }
                      setShowPicker(false);
                      if (selectedDate) {
                        onChange(selectedDate.toISOString());
                      }
                    }}
                    minimumDate={
                      question.min_value ? new Date(question.min_value) : undefined
                    }
                    maximumDate={
                      question.max_value ? new Date(question.max_value) : undefined
                    }
                  />
                )}
              </>
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
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  required: {
    color: "red",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  dateText: {
    fontSize: 16,
    color: "#333",
  },
  disabledInput: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
    opacity: 0.7,
  },
  disabledText: {
    color: "#999",
  },
  inputError: {
    borderColor: "red",
    backgroundColor: "#FFF0F0",
  },
  errorText: {
    color: "red",
    marginTop: 5,
    fontSize: 14,
  },
});

export default DateQuestion;
