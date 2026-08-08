// components/form/FormFieldWrapper.tsx
import { MaterialIcons } from "@expo/vector-icons";
import React, { createContext, useContext, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { textColors, typography } from "../../../styles/typography";
import { PreviousSubmissionAnswer } from "../hooks/usePreviousSubmissions";
import PreviousSubmissionCards from "./PreviousSubmissionCards";

export const PreviousSubmissionsContext = createContext<Record<string, PreviousSubmissionAnswer[]> | undefined>(undefined);

interface FormFieldWrapperProps {
  question: {
    question: string;
    is_required?: boolean;
    description?: string | null;
    question_hint?: any;
    question_type?: string;
    question_uuid?: string;
    id?: number;
  };
  isCompleted?: boolean;
  hasError?: boolean;
  focusedInputKey?: string | null;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  previousSubmissions?: Record<string, PreviousSubmissionAnswer[]>;
  children: (props: { expanded: boolean }) => React.ReactNode;
}

const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  question,
  isCompleted,
  hasError,
  focusedInputKey,
  defaultExpanded,
  forceExpanded = false,
  previousSubmissions,
  children,
}) => {
  // Use prop if provided, otherwise fall back to context
  const contextPreviousSubmissions = useContext(PreviousSubmissionsContext);
  const effectivePreviousSubmissions = previousSubmissions ?? contextPreviousSubmissions;

  // Audit questions should start collapsed, other question types start expanded
  const isAuditQuestion = question.question_type === "audit";
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? !isAuditQuestion,
  );
  const effectiveExpanded = expanded || forceExpanded;

  React.useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
    }
  }, [forceExpanded]);

  const toggleExpanded = () => {
    setExpanded((v) => !v);
  };

  // Audit questions always have expandable content (for collapse/expand functionality)
  // Also treat fields with explicit expansion controls as expandable, even without description text.
  const hasExplicitExpansionControl =
    defaultExpanded !== undefined || forceExpanded;
  const hasExpandableContent =
    isAuditQuestion ||
    hasExplicitExpansionControl ||
    (question.question_type === "short_answer" ||
      question.question_type === "qr_code"
      ? question.question_hint
      : question.description);
  const isTitleDescription = question.question_type === "title_and_description";
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <TouchableOpacity
        onPress={toggleExpanded}
        activeOpacity={0.8}
        disabled={!hasExpandableContent}
        style={styles.header}
      >
        <View style={styles.labelWrapper}>
          <Text
            style={[
              styles.label,
              hasError && styles.labelError,
              focusedInputKey === question.question_uuid && styles.labelFocused,
              isTitleDescription && {
                color: "#1e3a8a",  // Professional Dark Blue
                fontWeight: "bold",
                fontSize: 16       // Optional: Increase size slightly for title
              },
            ]}
          >
            {String(question.question)}
            {question.is_required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
        {hasExpandableContent && (
          <MaterialIcons
            name={effectiveExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={28}
            color={isCompleted ? "#999" : "#007AFF"}
            style={styles.arrow}
          />
        )}
      </TouchableOpacity>

      {/* PREVIOUS SUBMISSION CARDS */}
      {effectivePreviousSubmissions && question.id && (
        <PreviousSubmissionCards
          questionId={question.id}
          questionType={question.question_type}
          previousSubmissions={effectivePreviousSubmissions}
        />
      )}

      {/* DESCRIPTION OR QUESTION HINT */}
      {hasExpandableContent && effectiveExpanded && (
        (question.question_type === "short_answer" || question.question_type === "qr_code"
          ? question.question_hint
          : question.description) && (
          <Text
            style={[
              styles.description,
              isTitleDescription && { color: "#64748b"},
            ]}
          >
            {question.question_type === "short_answer" ||
              question.question_type === "qr_code"
              ? String(question.question_hint)
              : String(question.description)}
          </Text>
        )
      )}

      {/* CHILDREN (input field) - hide when collapsed if there is expandable content */}
      {(!hasExpandableContent || effectiveExpanded) &&
        children({ expanded: effectiveExpanded })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  labelWrapper: { flex: 1, marginRight: 8 },
  label: {
    ...typography.bodyLarge,
    color: textColors.primary,
  },
  labelError: {
    color: textColors.error,
  },
  labelFocused: {
    color: textColors.link,
    fontWeight: "700",
  },
  required: { color: textColors.error },
  arrow: { marginLeft: 8 },
  description: {
    ...typography.bodyMedium,
    color: textColors.secondary,
    marginTop: 4,
    marginBottom: 8,
  },
});

export default FormFieldWrapper;
