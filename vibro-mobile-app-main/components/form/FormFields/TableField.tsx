import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareContainerRef } from "../../KeyboardAwareContainer";
import { Question } from "../types/formTypes";
import Reference from "../utils/reference";
import FormField from "./FormField";
import FormFieldWrapper from "./FormFieldWrapper";

interface TableFieldProps {
  question: Question;
  control: any;
  errors: any;
  isCompleted?: boolean;
  isEditable?: boolean;
  hasError?: boolean; // Added for missed error navigation
  container?: React.RefObject<KeyboardAwareContainerRef>;
}

const TableField: React.FC<TableFieldProps> = ({
  question,
  control,
  errors,
  isCompleted,
  isEditable,
  hasError,
  container,
}) => {
  const minRows = question.min_value || 1;
  const maxRows = question.max_value || 10;
  const baseKey = (question as any).uniqueId || question.question_uuid;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: baseKey,
  });

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const createEmptyRow = (subQuestions?: Question[]) => {
    if (!subQuestions || subQuestions.length === 0) {
      return {};
    }
    return subQuestions.reduce((acc, subQ) => {
      const subKey = (subQ as any).uniqueId || subQ.question_uuid;
      acc[subKey] = "";
      return acc;
    }, {} as any);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({...prev, [id]: !prev[id]}));
  };

  // Initialize expanded state for rows
  useEffect(() => {
    fields.forEach(field => {
      setExpandedRows(prev => {
        if (field.id in prev) return prev;
        return {...prev, [field.id]: true};
      });
    });
  }, [fields]);

  const addRow = () => {
    if (fields.length < maxRows && question.sub_questions?.length) {
      append(createEmptyRow(question.sub_questions));
    }
  };

  const normalizeTableRows = (raw: any): any[] | null => {
    if (raw == null) return null;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"))
      ) {
        try {
          return normalizeTableRows(JSON.parse(trimmed));
        } catch {
          return null;
        }
      }
      return null;
    }

    if (Array.isArray(raw)) {
      const subQuestions = question.sub_questions || [];
      const rows = raw
        .map((row) => {
          if (row && typeof row === "object" && !Array.isArray(row)) {
            return row;
          }
          if (Array.isArray(row) && subQuestions.length) {
            const mapped: Record<string, any> = {};
            row.forEach((cell, idx) => {
              const subQ = subQuestions[idx];
              if (subQ?.question_uuid) {
                mapped[subQ.question_uuid] = cell;
              }
            });
            return Object.keys(mapped).length ? mapped : null;
          }
          return null;
        })
        .filter(Boolean);
      return rows.length > 0 ? rows : null;
    }

    if (raw && typeof raw === "object") {
      const possible =
        raw.rows ||
        raw.table_rows ||
        raw.table_values ||
        raw.data ||
        raw.answer ||
        raw.value ||
        raw.submitted_value ||
        raw.response ||
        raw.response_value ||
        raw.answer_data?.answer ||
        raw.answer_data?.value;
      if (possible) return normalizeTableRows(possible);
    }

    return null;
  };

  useEffect(() => {
    if (fields.length > 0) return;
    if (isEditable) return;

    const extractSubAnswer = (subQ: any) => {
      let v =
        subQ?.answer ??
        subQ?.value ??
        subQ?.submitted_value ??
        subQ?.response ??
        subQ?.response_value;

      if (
        (v === null || v === undefined || v === "") &&
        subQ?.answers
      ) {
        if (Array.isArray(subQ.answers) && subQ.answers.length > 0) {
          const entry = subQ.answers[0];
          v =
            entry?.answer ??
            entry?.value ??
            entry?.submitted_value ??
            entry?.other_text ??
            entry;
        } else if (typeof subQ.answers === "object") {
          v =
            subQ.answers.answer ??
            subQ.answers.value ??
            subQ.answers.submitted_value ??
            subQ.answers.other_text;
        }
      }

      return v;
    };

    const tableRows =
      normalizeTableRows((question as any).answer) ||
      normalizeTableRows((question as any).value) ||
      normalizeTableRows((question as any).submitted_value) ||
      normalizeTableRows((question as any).answers) ||
      normalizeTableRows((question as any).table_rows) ||
      normalizeTableRows((question as any).rows);

    if (tableRows && tableRows.length > 0) {
      replace(tableRows);
      return;
    }

    // Fallback: build a single row from sub-question answers (audit sent data)
    if (Array.isArray(question.sub_questions) && question.sub_questions.length) {
      const row: Record<string, any> = {};
      let hasValue = false;
      question.sub_questions.forEach((subQ: any) => {
        const subKey = subQ.uniqueId || subQ.question_uuid;
        const subVal = extractSubAnswer(subQ);
        if (
          subVal !== null &&
          subVal !== undefined &&
          (Array.isArray(subVal) ? subVal.length > 0 : String(subVal).trim() !== "")
        ) {
          row[subKey] = subVal;
          hasValue = true;
        }
      });
      if (hasValue) {
        replace([row]);
      }
    }
  }, [fields.length, isCompleted, question, replace]);

  const hasTableError = errors[baseKey] || errors[question.question_uuid] || hasError;
  const shouldShowTableQuestion = fields.length > 0;

  return (
    <FormFieldWrapper question={question} isCompleted={isCompleted}>
      {({ expanded }) => (
        <>
          {/* Reference Media */}
          {(Array.isArray(question?.reference_images) && question?.reference_images.length) ||
          (Array.isArray(question?.reference_videos) && question?.reference_videos.length) ? (
            <Reference
              mediaUrls={[
                ...(Array.isArray(question?.reference_images) ? question?.reference_images : []).filter((url: any) => typeof url === 'string'),
                ...(Array.isArray(question?.reference_videos) ? question?.reference_videos : []).filter((url: any) => typeof url === 'string'),
              ]}
            />
          ) : null}

          {/* Table with Error Container */}
          <View
            style={[
              styles.tableContainer,
              hasTableError && styles.tableErrorContainer,
            ]}
          >
            {!shouldShowTableQuestion && !isEditable ? (
              <Text style={styles.emptyTableText}>No table data</Text>
            ) : null}

            {/* Table Rows */}
            {fields.map((item, index) => (
              <View key={item.id} style={styles.rowContainer}>
                <View style={styles.rowHeader}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>Row {index + 1}</Text>
                    <TouchableOpacity onPress={() => toggleRow(item.id)}>
                      <MaterialIcons
                        name={expandedRows[item.id] ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                        size={24}
                        color="#333"
                      />
                    </TouchableOpacity>
                    {/* <Text style={styles.rowTitle}>Row {index + 1}</Text> */}
                  </View>
                  <TouchableOpacity
                    onPress={() => remove(index)}
                    disabled={isCompleted}
                  >
                    <MaterialIcons
                      name="delete"
                      size={24}
                      color={isCompleted ? "#ccc" : "red"}
                    />
                  </TouchableOpacity>
                </View>

                {question.sub_questions?.length ? (
                  <View
                    style={
                      expandedRows[item.id] ? undefined : styles.rowContentCollapsed
                    }
                  >
                    {question.sub_questions.map((subQuestion) => (
                      <FormField
                        key={`${subQuestion.id}-${index}`}
                        question={subQuestion}
                        control={control}
                        errors={errors}
                        name={`${baseKey}.${index}.${(subQuestion as any).uniqueId || subQuestion.question_uuid}`}
                        isCompleted={isCompleted}
                        isEditable={isEditable}
                        hasError={hasError} // Pass down if needed per sub-field
                        container={container}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}

            {/* Add Row Button */}
            {shouldShowTableQuestion && fields.length < maxRows && !isCompleted && (
              <TouchableOpacity style={styles.addButton} onPress={addRow}>
                <Text style={styles.addButtonText}>+ Add Row</Text>
              </TouchableOpacity>
            )}

            {/* Initial Add Row Button when no rows exist */}
            {!shouldShowTableQuestion && isEditable && fields.length < maxRows && !isCompleted && (
              <TouchableOpacity style={styles.addButton} onPress={addRow}>
                <Text style={styles.addButtonText}>+ Add Row</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Table-level Error Message */}
          {(errors[baseKey] || errors[question.question_uuid]) && (
            <Text style={styles.errorText}>
              {String(
                (errors[baseKey] || errors[question.question_uuid]).message,
              )}
            </Text>
          )}
        </>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create({
  tableContainer: {
    marginTop: 8,
  },
  tableErrorContainer: {
    borderWidth: 1,
    borderColor: "red",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFF0F0",
  },
  rowContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  rowContentCollapsed: {
    display: "none",
  },
  errorText: {
    color: "red",
    marginTop: 8,
    fontSize: 13,
  },
  emptyTableText: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 10,
  },
});

export default TableField;
