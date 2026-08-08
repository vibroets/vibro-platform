import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Controller } from "react-hook-form";
import {
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity
} from "react-native";
import { Question } from "../types/formTypes";
import { formatDate, formatDateTime, formatTime } from "../utils/formHelpers";
import FormFieldWrapper from "./FormFieldWrapper";

interface DateQuestionProps {
  question: Question;
  control: any;
  errors: any;
  name: string;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
}

const DateTimeField: React.FC<DateQuestionProps> = ({
  question,
  control,
  errors,
  name,
  isCompleted,
  isEditable = true,
  hasError,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">(
    question.question_type === "time" ? "time" : "date"
  );
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const getDisplayValue = (value: string) => {
    if (!value) return question.question_hint || "Select";

    switch (question.question_type) {
      case "date":
        return formatDate(value);
      case "time":
        return formatTime(value);
      case "datetime":
        return formatDateTime(value);
      default:
        return formatDate(value);
    }
  };

  const handlePickerChange = (
    selectedDate: Date | undefined,
    onChange: (value: string) => void,
    value?: string
  ) => {
    setShowPicker(false);

    if (!selectedDate) return;

    if (question.question_type === "datetime" && pickerMode === "date") {
      // For datetime, first show date picker then time picker
      const newDate = new Date(selectedDate);
      if (value) {
        const existing = new Date(value);
        newDate.setHours(existing.getHours(), existing.getMinutes());
      }
      setTempDate(newDate);
      setPickerMode("time");
      setShowPicker(true);
      return;
    }

    if (question.question_type === "datetime" && pickerMode === "time") {
      // Combine date and time
      if (tempDate) {
        const combined = new Date(tempDate);
        combined.setHours(selectedDate.getHours(), selectedDate.getMinutes());
        onChange(combined.toISOString());
      }
      setShowPicker(false);
      setPickerMode("date");
      setTempDate(null);
      return;
    }

    // For date or time only
    onChange(selectedDate.toISOString());
    setShowPicker(false);
  };

  const getPickerMode = () => {
    if (question.question_type === "datetime") {
      return pickerMode;
    }
    return question.question_type === "time" ? "time" : "date";
  };

  const getIcon = () => {
    switch (question.question_type) {
      case "date":
        return "calendar-today";
      case "time":
        return "access-time";
      case "datetime":
        return "event";
      default:
        return "calendar-today";
    }
  };

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
                      !isEditable && styles.disabledInput
                    ]}
                    onPress={() => {
                      if (isEditable) {
                        Keyboard.dismiss();
                        setShowPicker(true);
                      }
                    }}
                    disabled={!isEditable}
                    activeOpacity={!isEditable ? 1 : 0.7}
                  >
                    <Text style={[styles.dateText, !isEditable && styles.disabledText]}>
                      {getDisplayValue(displayValue)}
                    </Text>
                    <MaterialIcons 
                      name={getIcon()} 
                      size={20} 
                      color={!isEditable ? "#bbb" : "#666"} 
                    />
                  </TouchableOpacity>

                  {showPicker && isEditable && (
                  <DateTimePicker
                    value={
                      question.question_type === "datetime" && pickerMode === "time" && tempDate
                        ? tempDate
                        : value ? new Date(value) : new Date()
                    }
                    mode={getPickerMode()}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(event, selectedDate) => {
                      if (event.type === 'dismissed') {
                        setShowPicker(false);
                        setPickerMode("date");
                        setTempDate(null);
                        return;
                      }
                      handlePickerChange(selectedDate, onChange, value);
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
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  required: {
    color: "red",
  },
  description: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  inputText: {
    fontSize: 14,
    color: "#333",
  },
  /* Styles for the date/time picker touchable and text */
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  dateText: {
    fontSize: 14,
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
    marginTop: 4,
    fontSize: 13,
  },
});

export default DateTimeField;
