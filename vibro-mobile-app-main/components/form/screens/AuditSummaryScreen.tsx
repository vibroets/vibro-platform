import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AuditScoreInfo } from "../types/formTypes";

interface AuditSummaryProps {
  groupScores: AuditScoreInfo[];
  formMaxScore: number;
  formUserScore: number;
  passPercentage: number;
  auditsummarydata?: any;
}

const AuditSummaryScreen: React.FC<AuditSummaryProps> = ({
  groupScores,
  formMaxScore,
  formUserScore,
  passPercentage,
  auditsummarydata,
}) => {
  const [expanded, setExpanded] = useState(false);

  const useAuditSummary = auditsummarydata && auditsummarydata.summarydata && auditsummarydata.summarydata.length > 0;

  const totalFormPassPercentage = useAuditSummary
    ? (isNaN(parseFloat(auditsummarydata.form_overall_score)) ? (formUserScore && formMaxScore ? Math.round((formUserScore / formMaxScore) * 100) : 0) : parseFloat(auditsummarydata.form_overall_score))
    : (formUserScore && formMaxScore ? Math.round((formUserScore / formMaxScore) * 100) : 0);

  const criticalItemsFailed = useAuditSummary
    ? (isNaN(parseInt(auditsummarydata.form_critical_failed)) ? (() => {
        let failed = 0;
        groupScores.forEach((group) => {
          group.questions.forEach((question) => {
            if (question.question_type === "audit" && question.critical) {
              const score = group.userScore || 0;
              const maxScore = group.maxScore || 0;
              const questionPercentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
              if (questionPercentage <= passPercentage) {
                failed += 1;
              }
            }
          });
        });
        return failed;
      })() : parseInt(auditsummarydata.form_critical_failed))
    : (() => {
        let failed = 0;
        groupScores.forEach((group) => {
          group.questions.forEach((question) => {
            if (question.question_type === "audit" && question.critical) {
              const score = group.userScore || 0;
              const maxScore = group.maxScore || 0;
              const questionPercentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
              if (questionPercentage <= passPercentage) {
                failed += 1;
              }
            }
          });
        });
        return failed;
      })();

  const isFormPassed = useAuditSummary
    ? auditsummarydata.form_overall_status === 'passed' || auditsummarydata.form_overall_status === 'PASS'
    : criticalItemsFailed === 0 && totalFormPassPercentage >= passPercentage;

  const tableData = useAuditSummary
    ? auditsummarydata.summarydata.map((summary: any) => ({
        group: summary.group_name,
        score: summary.group_percentage === '' || isNaN(parseFloat(summary.group_percentage)) ? 0 : parseFloat(summary.group_percentage),
        actualScore: isNaN(parseFloat(summary.group_score)) ? 0 : parseFloat(summary.group_score),
        status: summary.groups_status === 'passed' || summary.groups_status === 'PASS' ? 'PASS' : 'FAIL'
      }))
    : groupScores.map((group) => ({
        group: group.groupTitle,
        score: group.percentage,
        actualScore: group.userScore,
        status: group.percentage !== 0 ? (group.passed ? 'PASS' : 'FAIL') : '-'
      }));

  // console.log("Critical Items Failed:", criticalItemsFailed);
  // console.log("formFailed:", isFormPassed);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
      >
        <Text style={styles.headerTitle}>Summary</Text>
      </TouchableOpacity>

      {/* Body */}
        <View style={styles.body}>
          {/* Overall Result */}
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Overall Status</Text>
            <Text
              style={[
                styles.resultValue,
                { color: isFormPassed ? "green" : "red" },
              ]}
            >
              {isFormPassed ? "PASS" : "FAIL"}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Score</Text>
              <Text style={styles.resultValue}>
                {useAuditSummary ? `${totalFormPassPercentage}%` : `${totalFormPassPercentage}% (${formUserScore}/${formMaxScore})`}
              </Text>
            </View>
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Critical Items Failed</Text>
              <Text style={styles.resultValue}>{criticalItemsFailed}</Text>
            </View>
          </View>

          {/* Table */}
          <View style={styles.table}>
            {/* Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>
                Group
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>
                Score
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>
                Status
              </Text>
            </View>

            {/* Rows */}
            {tableData.map((item: { group: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; score: number; status: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, index: React.Key | null | undefined) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.group}</Text>
                <Text style={styles.tableCell}>
                  {item.score >= 0 ? `${(item as any).actualScore?.toFixed(2)} (${item.score.toFixed(1)}%)` : `${(item as any).actualScore?.toFixed(2)}`}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      color: item.status === 'PASS' ? "green" : item.status === 'FAIL' ? "red" : "#333",
                      fontWeight: "600",
                    },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            ))}
          </View>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#2196f3",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  body: {
    padding: 14,
    backgroundColor: "#f9f9f9",
  },
  resultCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    elevation: 2,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultBox: {
    flex: 1,
    marginHorizontal: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    elevation: 2,
  },
  resultLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  table: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tableHeader: {
    backgroundColor: "#f1f1f1",
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  tableHeaderText: {
    fontWeight: "bold",
    fontSize: 14,
  },
});

export default AuditSummaryScreen;
