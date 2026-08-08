import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { textColors, typography } from "../../../styles/typography";
import { AuditScoreInfo, Question } from "../types/formTypes";

interface AuditAccordionProps {
  title: string;
  children: React.ReactNode;
  isCompleted?: boolean;
  questions?: Question[];
  groupScore?: number;
  passPercentage?: number;
  groupScores: AuditScoreInfo[];
  auditGroupId?: number;
  accordionId?: string;
  initialExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  containerRef?: any;
  onMeasure?: (params: { accordionId: string; layout: { height: number; y: number }; isExpanded: boolean }) => void;
  auditsummarydata?: any;
}

const AuditAccordion: React.FC<AuditAccordionProps> = ({
  title,
  children,
  isCompleted,
  questions = [],
  groupScore = 0,
  passPercentage = 0,
  groupScores,
  auditGroupId,
  accordionId,
  initialExpanded = true,
  isExpanded,
  onToggle,
  containerRef,
  onMeasure,
  auditsummarydata,
}) => {

  // Expand logic
  const [localExpanded, setLocalExpanded] = useState(initialExpanded);
  const expanded = isExpanded !== undefined ? isExpanded : localExpanded;
  const handleToggle = onToggle ? onToggle : () => setLocalExpanded(prev => !prev);

  // Only update local state in uncontrolled mode when initialExpanded actually changes
  // This prevents unnecessary resets when component re-renders due to score updates
  const prevInitialExpandedRef = useRef(initialExpanded);
  useEffect(() => {
    if (isExpanded === undefined && prevInitialExpandedRef.current !== initialExpanded) {
      // Only update local state if we're in uncontrolled mode AND initialExpanded actually changed
      setLocalExpanded(initialExpanded);
      prevInitialExpandedRef.current = initialExpanded;
    }
  }, [initialExpanded, isExpanded]);


  // Score calculation - use auditsummarydata data when available (for sent forms)
  const auditSubmissionData = useMemo(() => {
    if (auditsummarydata?.summarydata) {
      // Find the group data that matches this accordion
      // Try matching by group name first, then by order
      const groupData = auditsummarydata.summarydata.find((group: any) => {
        // Match by group name if available
        if (group.group_name === title) return true;
        // Or match by order (assuming the order in summarydata matches accordion order)
        return false; // For now, rely on exact name match
      });
      return groupData;
    }
    return null;
  }, [auditsummarydata, title]);

  const totalMaxScore = useMemo(() => {
    return questions
      .filter((q) => q.question_type === "audit")
      .reduce((sum, q) => {
        // Calculate max score from options: max achievable score by selecting one option
        // Don't rely on stored max_score field — it may be sum of all option scores instead of max
        const options = q.options || [];
        const maxFromOptions = options.length > 0
          ? Math.max(...options.map(o => Number(o.score) || 0))
          : (q.max_score || 0);
        return sum + maxFromOptions;
      }, 0);
  }, [questions]);

  // Use auditsummarydata if available, otherwise use calculated values
  const actualScore = auditSubmissionData ? parseFloat(auditSubmissionData.group_score) : groupScore;
  const percentage = auditSubmissionData ? parseFloat(auditSubmissionData.group_percentage) : (totalMaxScore > 0 ? (groupScore / totalMaxScore) * 100 : 0);
  const displayMaxScore = auditSubmissionData ? actualScore : totalMaxScore; // For sent forms, show actual score as max score

  const isAuditQuestion = questions.some((q) => q.question_type === "audit");

  let criticalItemsFailed = 0;

  // For sent forms, critical items failed is a form-level count, not per group
  if (auditsummarydata) {
    criticalItemsFailed = parseInt(auditsummarydata.form_critical_failed) || 0;
  } else {
    // For active forms, calculate per group
    groupScores
      .filter((g) => Number(g.groupId) === auditGroupId)
      .forEach((group) => {
        group.questions.forEach((question) => {
          if (question.question_type === "audit" && question.critical) {
            const score = group.userScore || 0;
            const maxScore = group.maxScore || 0;
            const questionPercentage =
              maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

            if (questionPercentage < (question.pass_percentage || passPercentage)) {
              criticalItemsFailed += 1;
            }
          }
        });
      });
  }

  // 🔥 Register accordion position with parent
  const accordionRef = useRef<View>(null);

  useEffect(() => {
    if (accordionRef.current && containerRef?.current && accordionId) {
      containerRef.current._registerAccordionRef(
        accordionId,
        accordionRef
      );
    }
  }, [accordionId]);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (!accordionId || !onMeasure) return;
    const { height, y } = event.nativeEvent.layout;
    onMeasure({
      accordionId,
      layout: { height, y },
      isExpanded: expanded,
    });
  };

  return (
    <View ref={accordionRef} style={styles.accordionItem} onLayout={handleLayout}>
      {/* Header */}
      <TouchableOpacity
        style={[styles.header, styles.activeHeader]}
        onPress={handleToggle}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{title}</Text>

          {isCompleted && (
            <MaterialIcons
              name="check-circle"
              size={20}
              color="#fff"
              style={{ marginLeft: 6 }}
            />
          )}
        </View>

        <MaterialIcons
          name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>

      {/* Score Summary */}
      {isAuditQuestion && (
        <View style={styles.scoreContainer}>
          <View style={styles.scoreTextContainer}>
            <Text style={styles.scoreText}>Score Percentage :</Text>
            <Text style={styles.scoreText}>{percentage.toFixed(1)}%</Text>
          </View>

          <View style={styles.scoreTextContainer}>
            <Text style={styles.scoreText}>Score:</Text>
            <Text style={styles.scoreText}>
              {auditSubmissionData ? actualScore.toFixed(2) : `${groupScore} / ${totalMaxScore}`}
            </Text>
          </View>

          <View style={styles.scoreTextContainer}>
            <Text style={styles.scoreText}>Critical Items Failed:</Text>
            <Text style={styles.scoreText}>{criticalItemsFailed}</Text>
          </View>
        </View>
      )}

      {/* Content */}
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  accordionItem: {
    marginBottom: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    maxWidth: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#2196f3",
    minHeight: 40,
  },
  activeHeader: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: textColors.white,
    flex: 1,
    flexWrap: "wrap",
    paddingRight: 8,
  },
  scoreContainer: {
    backgroundColor: "#f8f9fa",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  scoreTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  scoreText: {
    ...typography.bodyMedium,
    color: textColors.primary,
  },
  content: {
    padding: 8,
    width: "100%",
  },
});

export default AuditAccordion;
