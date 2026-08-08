import { MaterialIcons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PreviousSubmissionAnswer } from "../hooks/usePreviousSubmissions";

interface PreviousSubmissionCardsProps {
  questionId?: number;
  questionType?: string;
  previousSubmissions?: Record<string, PreviousSubmissionAnswer[]>;
}

const getAnswerDisplay = (answer: string, otherText?: string | null): string => {
  if (!answer) return "—";
  // For multiple choice / checkboxes, answer may be pipe-separated option IDs or text
  // Just return the raw answer text; the backend stores option text or IDs
  if (otherText) {
    return `${answer} (${otherText})`;
  }
  return answer;
};

const getCardColor = (answer: string): { bg: string; border: string; text: string } => {
  const lower = (answer || "").toLowerCase().trim();
  // Positive/OK answers → green
  if (["ok", "pass", "passed", "yes", "good", "complete", "completed", "done", "satisfactory"].includes(lower)) {
    return { bg: "#E8F5E9", border: "#4CAF50", text: "#2E7D32" };
  }
  // Negative answers → red
  if (["fail", "failed", "no", "not ok", "notok", "unsatisfactory", "rejected", "critical"].includes(lower)) {
    return { bg: "#FFEBEE", border: "#F44336", text: "#C62828" };
  }
  // Neutral → blue
  return { bg: "#E3F2FD", border: "#2196F3", text: "#1565C0" };
};

const formatDate = (isoDate?: string | null): string => {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

const PreviousSubmissionCards: React.FC<PreviousSubmissionCardsProps> = ({
  questionId,
  questionType,
  previousSubmissions,
}) => {
  const [showModal, setShowModal] = useState(false);

  if (!questionId || !previousSubmissions) return null;

  const answers = previousSubmissions[String(questionId)];
  if (!answers || answers.length === 0) return null;

  // Skip non-answerable question types
  const nonAnswerableTypes = ["title_and_description", "formula", "table", "followup_task"];
  if (questionType && nonAnswerableTypes.includes(questionType)) return null;

  const inlineAnswers = answers.slice(0, 5);

  // Get color for a single answer
  const getDotColor = (answer: string): string => {
    const lower = (answer || "").toLowerCase().trim();
    if (["ok", "pass", "passed", "yes", "good", "complete", "completed", "done", "satisfactory"].includes(lower)) {
      return "#4CAF50";
    }
    if (["fail", "failed", "no", "not ok", "notok", "unsatisfactory", "rejected", "critical"].includes(lower)) {
      return "#F44336";
    }
    return "#2196F3";
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="history" size={12} color="#666" />
        <View style={styles.dotsRow}>
          {inlineAnswers.map((item, idx) => (
            <View
              key={`dot-${item.submission_id}-${idx}`}
              style={[styles.dot, { backgroundColor: getDotColor(item.answer) }]}
            />
          ))}
        </View>
        <Text style={styles.chipText}>
          {answers.length} previous {answers.length === 1 ? "answer" : "answers"}
        </Text>
        <MaterialIcons name="chevron-right" size={12} color="#999" />
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Previous Submissions</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {answers.map((item, idx) => {
                const display = getAnswerDisplay(item.answer, item.other_text);
                const colors = getCardColor(item.answer);
                const dateStr = formatDate(item.completed_on || item.submitted_on);

                return (
                  <View
                    key={`detail-${item.submission_id}-${idx}`}
                    style={[styles.detailCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                  >
                    <View style={styles.detailCardHeader}>
                      <MaterialIcons name="person" size={14} color={colors.text} />
                      <Text style={[styles.detailSubmittedBy, { color: colors.text }]}>
                        {item.submitted_by || "Unknown"}
                      </Text>
                      {dateStr ? (
                        <Text style={[styles.detailDate, { color: colors.text }]}>
                          {"  ·  "}{dateStr}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.detailAnswer, { color: colors.text }]}>
                      {display}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalBody: {
    padding: 16,
  },
  detailCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailSubmittedBy: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 4,
  },
  detailDate: {
    fontSize: 14,
  },
  detailAnswer: {
    fontSize: 17,
    fontWeight: "700",
  },
});

export default memo(PreviousSubmissionCards);
