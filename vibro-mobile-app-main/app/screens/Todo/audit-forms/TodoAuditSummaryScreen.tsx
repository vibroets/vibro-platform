import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AuditScoreInfo } from "../../../../components/form/types/formTypes";

interface TodoAuditSummaryScreenProps {
  groupScores: AuditScoreInfo[];
  formMaxScore: number;
  formUserScore: number;
  passPercentage: number;
  selectedScores: Record<string, number>;
}

const TodoAuditSummaryScreen: React.FC<TodoAuditSummaryScreenProps> = ({
  groupScores,
  formMaxScore,
  formUserScore,
  passPercentage,
  selectedScores,
}) => {
  const formPercentage = useMemo(() => {
    return formMaxScore > 0 ? Math.round((formUserScore / formMaxScore) * 100) : 0;
  }, [formMaxScore, formUserScore]);

  const isFormPassed = formPercentage >= passPercentage;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Audit Summary</Text>
        <View style={[styles.overallScore, isFormPassed ? styles.passed : styles.failed]}>
          <Text style={styles.overallScoreText}>
            {formPercentage}% ({formUserScore}/{formMaxScore})
          </Text>
          <Text style={styles.passFailText}>
            {isFormPassed ? "PASSED" : "FAILED"}
          </Text>
        </View>
      </View>

      <View style={styles.groupScoresContainer}>
        {groupScores.map((group) => (
          <View key={group.groupId} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group.groupTitle}</Text>
              <View style={[styles.groupScore, group.passed ? styles.passed : styles.failed]}>
                <Text style={styles.groupScoreText}>
                  {group.percentage}%
                </Text>
              </View>
            </View>

            <View style={styles.groupDetails}>
              <Text style={styles.scoreDetail}>
                Score: {group.userScore}/{group.maxScore}
              </Text>
              <Text style={styles.passPercentageDetail}>
                Pass Threshold: {group.passPercentage}%
              </Text>
            </View>

            {group.questions.length > 0 && (
              <View style={styles.questionsBreakdown}>
                <Text style={styles.breakdownTitle}>Question Scores:</Text>
                {group.questions.map((question: any) => {
                  const score = selectedScores[question.id] || 0;
                  const maxScore = question.max_score || 0;
                  return (
                    <View key={question.id} style={styles.questionScore}>
                      <Text style={styles.questionText} numberOfLines={1}>
                        {question.question}
                      </Text>
                      <Text style={styles.questionScoreText}>
                        {score}/{maxScore}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Audit completed with {isFormPassed ? "satisfactory" : "unsatisfactory"} results.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  overallScore: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 120,
  },
  passed: {
    backgroundColor: "#d4edda",
    borderColor: "#c3e6cb",
    borderWidth: 1,
  },
  failed: {
    backgroundColor: "#f8d7da",
    borderColor: "#f5c6cb",
    borderWidth: 1,
  },
  overallScoreText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  passFailText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 4,
  },
  groupScoresContainer: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  groupScore: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 60,
    alignItems: "center",
  },
  groupScoreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  groupDetails: {
    marginBottom: 12,
  },
  scoreDetail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  passPercentageDetail: {
    fontSize: 14,
    color: "#666",
  },
  questionsBreakdown: {
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    paddingTop: 12,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  questionScore: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  questionText: {
    fontSize: 14,
    color: "#555",
    flex: 1,
    marginRight: 12,
  },
  questionScoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default TodoAuditSummaryScreen;
