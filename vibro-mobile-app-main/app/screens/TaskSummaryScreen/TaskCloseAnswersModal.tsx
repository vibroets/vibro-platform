import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

interface TaskCloseQuestion {
  id: number;
  question: string;
  question_type?: string;
  answer?: any;
  answers?: any;
  submitted_answer?: any;
  submitted_value?: any;
}

interface TaskCloseAnswersModalProps {
  loading: boolean;
  questions: TaskCloseQuestion[];
}

const getAnswerText = (q: TaskCloseQuestion): string => {
  const direct = q.answer ?? q.submitted_answer ?? q.submitted_value;
  if (direct != null && direct !== "") return String(direct);

  const ans = q.answers as any;
  if (ans == null) return "No answer";
  if (Array.isArray(ans)) {
    if (ans.length === 0) return "No answer";
    return ans.map((a) => String(a?.answer ?? a?.value ?? a)).join(", ");
  }
  if (typeof ans === "object") {
    return String(ans.answer ?? ans.value ?? JSON.stringify(ans));
  }
  return String(ans);
};

const TaskCloseAnswersModal: React.FC<TaskCloseAnswersModalProps> = ({ loading, questions }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  if (!questions.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No task close questions found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {questions.map((q) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.question}>{q.question}</Text>
          <Text style={styles.answer}>{getAnswerText(q)}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: { padding: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyText: { color: "#6c757d" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  question: { fontSize: 15, fontWeight: "600", color: "#1f2937", marginBottom: 6 },
  answer: { fontSize: 14, color: "#374151" },
});

export default TaskCloseAnswersModal;
