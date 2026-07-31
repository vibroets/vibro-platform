import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface TitleDescriptionProps {
  question: {
    question: string;
    is_required?: boolean;
    description?: string | null;
    question_hint?: any;
    question_type?: string;
    question_uuid?: string;
  };
  hasError?: boolean;
  focusedInputKey?: string | null;
}

const TitleDescription: React.FC<TitleDescriptionProps> = ({
  question,
  hasError,
  focusedInputKey,
}) => {
  const hasDescription = question.question_type === 'short_answer' || question.question_type === 'qr_code'
    ? question.question_hint
    : question.description;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, hasError && styles.labelError, focusedInputKey === question.question_uuid && styles.labelFocused]}>
        {question.question}
        {question.is_required && <Text style={styles.required}> *</Text>}
      </Text>
      {hasDescription && (
        <Text style={styles.description}>
          {question.question_type === 'short_answer' || question.question_type === 'qr_code'
            ? question.question_hint
            : question.description}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  labelError: {
    color: "red",
  },
  labelFocused: {
    color: "#007AFF",
    fontWeight: "700",
  },
  required: { color: "red" },
  description: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
});

export default TitleDescription;
