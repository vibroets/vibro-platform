import { Submission } from "@/types/sent";
import { router } from "expo-router";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface FileListProps {
  items: Submission;
  formId: any;
  formType: any;
  formTitle?: string;
  formPrefix?: string;
  onClick?: (formId: any, submissionId: any, formType: any, formTitle?: string, summaryData?: any[], submission?: any) => void;
  mainFormByTaskId?: Record<string, { main_form_location?: string }>;
}

const FileList = ({ items, formId, onClick, formType, formTitle, formPrefix, mainFormByTaskId }: FileListProps) => {

  const submissionId = items.form_submission_id ?? (items as any).submission_id ?? items.id;
  
  // Check for followup task indicators (be tolerant of format differences)
  const submissionType = String(items.submission_type ?? "").toLowerCase();
  const isTaskClose = submissionType.includes("task-close") || submissionType.includes("task close");
  const isFollowupTask =
    isTaskClose ||
    submissionType.includes("followup") ||
    items.can_reopen === true ||
    !!items.is_followup_task ||
    !!items.is_followup ||
    !!items.followup_task_id;
  
  // Prefer form prefix if configured; fallback to "NPX-{id}"
  const prefixLabel = (formPrefix || "").trim();
  const submissionIdDisplay = prefixLabel
    ? `${prefixLabel}-${submissionId}`
    : `NPX-${submissionId}`;
  const taskNameSubtitle = items.task_name || null;
  
  const isCompleted = items.is_completed;
  const rawStatus =
    (items as any).task_status ??
    (items as any).status ??
    (items as any).task?.status ??
    (items as any).task_details?.status ??
    null;
  const normalizedStatus = String(rawStatus ?? (isCompleted ? 'completed' : 'pending'))
    .toLowerCase()
    .replace(/[_\s]/g, '');

  // Check for edited data in different possible locations
  const isEdited = items.edited_by || items.edited_on || items.edited_by_sr;

  const statusMap: Record<string, { text: string; color: string; bgColor: string }> = {
    notstarted: { text: 'Not Started', color: '#92400e', bgColor: '#fef3c7' },
    notassigned: { text: 'Not Started', color: '#92400e', bgColor: '#fef3c7' },
    inprogress: { text: 'In Progress', color: '#1d4ed8', bgColor: '#dbeafe' },
    completed: { text: 'Completed', color: '#166534', bgColor: '#dcfce7' },
    edited: { text: 'Edited', color: '#ea580c', bgColor: '#ffedd5' },
    pending: { text: 'Pending', color: '#92400e', bgColor: '#fef3c7' },
  };

  const shouldUseTaskStatus = isFollowupTask && normalizedStatus !== '';
  const followupBadgeText = isTaskClose ? "Task-Close" : "Followup-Task";
  // Show Edited status if form was edited, otherwise show completed/pending status
  const statusInfo = isEdited
    ? statusMap.edited
    : (shouldUseTaskStatus
      ? (statusMap[normalizedStatus] ?? statusMap.completed)
      : (isCompleted ? statusMap.completed : statusMap.pending));
  const statusText = statusInfo.text;
  const editedByName = items.edited_by_name || items.edited_by_sr || String(items.edited_by || "") || null;
  const editedDate = items.edited_on || null;

  // Format dates (single line) - show edited time if edited, otherwise show completed time
  const rawDateValue = isEdited 
    ? items.edited_on || items.completed_on 
    : (isCompleted ? items.completed_on : items.submission_initiated_on);
  const parsedDate = rawDateValue ? new Date(rawDateValue) : null;
  const dateTimePart = parsedDate && !isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleString()
    : "";

  const completedDate = isEdited
    ? `Edited on ${dateTimePart}`
    : (isCompleted ? `Completed on ${dateTimePart}` : `Initiated on ${dateTimePart}`);

  const formattedEditedDate = editedDate
    ? `Edited on ${new Date(editedDate).toLocaleString()}`
    : null;

  const mainFormTitle = (items as any).main_form_title || formTitle || "-";
  const spawnedTaskId = (items as any).followup_task_id ?? (items as any).task_id ?? null;

  const submissionSource = String((items as any).source || "").toLowerCase();
  const sourceRef = (items as any).source_ref ?? null;

  const checkpointSummary = (items as any).checkpoint_summary ?? null;
  const followupTasksSummary = (items as any).followup_tasks_summary ?? null;
  const hasCheckpoints = checkpointSummary && checkpointSummary.total > 0;
  const hasFollowupTasks = followupTasksSummary && followupTasksSummary.total > 0;

  const navigateToTasks = (taskIds: number[], tab: 'new' | 'sent') => {
    if (taskIds && taskIds.length > 0) {
      // Navigate to FilteredTodo stack screen (not the tab) so back() returns here
      router.push({
        pathname: '/(app)/screens/FilteredTodo',
        params: { tab, filterTaskIds: taskIds.join(','), _ts: Date.now() }
      });
    } else {
      // No task IDs exist — open deviation not yet converted to a task
      Alert.alert(
        'No Task Created Yet',
        'This open deviation has not been assigned as a followup task yet. Please raise a task from the audit form to proceed.',
        [{ text: 'OK' }]
      );
    }
  };
  const sourceConfig: Record<string, { label: string; bg: string; color: string; accent: string }> = {
    planner: { label: 'Planner', bg: '#F3E8FF', color: '#6B21A8', accent: '#7C3AED' },
    task:    { label: 'Task',    bg: '#FFF7ED', color: '#C2410C', accent: '#EA580C' },
    form:    { label: 'Form',    bg: '#EFF6FF', color: '#1D4ED8', accent: '#2563EB' },
  };
  const sourceInfo = sourceConfig[submissionSource] || null;
  const accentColor = sourceInfo?.accent || '#2196f3';
  const spawnedTaskPrefix = (items as any).task_prefix || prefixLabel || "NPX";

  const getLocationText = (submission: any): string => {
    const taskId = submission?.task_id != null ? String(submission.task_id) : "";
    const taskMeta = taskId && mainFormByTaskId ? mainFormByTaskId[taskId] : undefined;
    
    const candidates = [
      taskMeta?.main_form_location,
      submission.main_form_location,
      submission.location_name,
      submission.location_title,
      submission.location,
      submission.site_name,
      submission.area_name,
      submission.plant_name,
      submission.department_name,
      submission.department?.name,
      submission.location?.name,
      submission.location?.title,
      submission.location_details?.name,
      submission.location_details?.description,
    ];
    const locationText = candidates
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value))
      .join(" ");
    return locationText || "-";
  };

  const locationText = getLocationText(items);

  // Get department info for edited by user
  const getDepartmentInfo = (editedBy: string | null) => {
    // Try to extract department info if it's in format "username, department"
    if (editedBy && editedBy.includes(',')) {
      return editedBy;
    }
    return editedBy || "N/A";
  };

  return (
    <View style={styles.item}>
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
      <View style={styles.cardInner}>
        <TouchableOpacity
          onPress={() => {
            onClick?.(formId, submissionId, formType, formTitle, items.summary, items);
          }}
          activeOpacity={0.85}
        >
          <View style={styles.cardRow1}>
            <Icon name="description" size={13} color={accentColor} />
            <Text style={styles.title} numberOfLines={1}>{submissionIdDisplay}</Text>
            {isFollowupTask && (
              <View style={styles.followupIndicator}>
                <Text style={styles.followupText}>{followupBadgeText}</Text>
              </View>
            )}
            {(items as any).is_auto_closed ? (
              <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.statusText, { color: '#DC2626' }]}>
                  Auto-Closed
                </Text>
              </View>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusText}
              </Text>
            </View>
          </View>

          {taskNameSubtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{taskNameSubtitle}</Text>
          )}
          <View style={styles.cardRow2}>
            <Text style={styles.metaDate} numberOfLines={1}>{completedDate}</Text>
            <Text style={styles.metaLocation} numberOfLines={1}>📍 {locationText}</Text>
          </View>

          {mainFormTitle && mainFormTitle !== "-" && mainFormTitle !== formTitle && (
            <Text style={styles.metaSub} numberOfLines={1}>Main Form: {mainFormTitle}</Text>
          )}

          {sourceInfo ? (
            <View style={styles.sourceRow}>
              <Text style={[styles.sourceBadge, { backgroundColor: sourceInfo.bg, color: sourceInfo.color }]}>
                {sourceInfo.label}{sourceRef ? `: ${sourceRef}` : ''}
              </Text>
            </View>
          ) : null}

          {hasCheckpoints ? (
            <View style={styles.summarySection}>
              <Text style={styles.summarySectionTitle}>Checkpoints ({checkpointSummary.total})</Text>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.summaryChipText, { color: '#166534' }]}>OK: {checkpointSummary.ok}</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: '#FEF9C3' }]}>
                  <Text style={[styles.summaryChipText, { color: '#854D0E' }]}>Corrected: {checkpointSummary.not_ok_corrected}</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.summaryChipText, { color: '#991B1B' }]}>Open: {checkpointSummary.not_ok_not_closed}</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewResponsesBtn}
                  onPress={() => onClick?.(formId, submissionId, formType, formTitle, items.summary, items)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewResponsesBtnText}>View →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {isEdited && (
            <View style={styles.editedRow}>
              <Icon name="edit" size={10} color="#f59e0b" />
              <Text style={styles.editedText}>
                Edited by {getDepartmentInfo(editedByName || null)}
              </Text>
              {formattedEditedDate && (
                <Text style={styles.editedDate}>{formattedEditedDate}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {hasFollowupTasks ? (
          <View style={styles.followupSection}>
            <Text style={styles.followupSectionTitle}>Followup Tasks ({followupTasksSummary.total})</Text>
            <View style={styles.followupBtnRow}>
              {followupTasksSummary.completed > 0 && (
                <TouchableOpacity
                  style={[styles.followupBtn, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}
                  onPress={() => navigateToTasks(followupTasksSummary?.task_ids?.completed ?? [], 'sent')}
                  activeOpacity={0.7}
                >
                  <Icon name="check-circle" size={14} color="#166534" />
                  <Text style={[styles.followupBtnText, { color: '#166534' }]}>Done ({followupTasksSummary.completed})</Text>
                  <Icon name="chevron-right" size={14} color="#166534" />
                </TouchableOpacity>
              )}
              {followupTasksSummary.in_progress > 0 && (
                <TouchableOpacity
                  style={[styles.followupBtn, { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' }]}
                  onPress={() => navigateToTasks(followupTasksSummary?.task_ids?.in_progress ?? [], 'new')}
                  activeOpacity={0.7}
                >
                  <Icon name="autorenew" size={14} color="#1D4ED8" />
                  <Text style={[styles.followupBtnText, { color: '#1D4ED8' }]}>Active ({followupTasksSummary.in_progress})</Text>
                  <Icon name="chevron-right" size={14} color="#1D4ED8" />
                </TouchableOpacity>
              )}
              {followupTasksSummary.not_started > 0 && (
                <TouchableOpacity
                  style={[styles.followupBtn, { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }]}
                  onPress={() => navigateToTasks(followupTasksSummary?.task_ids?.not_started ?? [], 'new')}
                  activeOpacity={0.7}
                >
                  <Icon name="radio-button-unchecked" size={14} color="#374151" />
                  <Text style={[styles.followupBtnText, { color: '#374151' }]}>Pending ({followupTasksSummary.not_started})</Text>
                  <Icon name="chevron-right" size={14} color="#374151" />
                </TouchableOpacity>
              )}
              {followupTasksSummary.completed === 0 && followupTasksSummary.in_progress === 0 && followupTasksSummary.not_started === 0 && (
                <View style={[styles.followupBtn, { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }]}>
                  <Icon name="radio-button-unchecked" size={14} color="#374151" />
                  <Text style={[styles.followupBtnText, { color: '#374151' }]}>Pending ({followupTasksSummary.total})</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentStrip: {
    width: 5,
    backgroundColor: '#2196f3',
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardRow1: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardRow2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
  },
  autoClosedRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginLeft: 5,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  followupIndicator: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  followupText: {
    fontSize: 10,
    color: "#4338CA",
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  metaDate: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
    marginRight: 6,
  },
  metaLocation: {
    fontSize: 12,
    color: "#475569",
    flexShrink: 1,
  },
  metaSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 3,
  },
  editedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 3,
  },
  editedText: {
    fontSize: 11,
    color: "#f59e0b",
  },
  editedDate: {
    fontSize: 11,
    color: "#64748B",
    marginLeft: 3,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  sourceBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  summarySection: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  summarySectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  summaryChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  summaryChipClickable: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: '#D1D5DB',
  },
  summaryChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  chipArrow: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    lineHeight: 13,
  },
  tapHint: {
    fontSize: 9,
    fontWeight: "400",
    color: "#94A3B8",
    fontStyle: "italic",
  },
  followupSection: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  followupSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  followupBtnRow: {
    flexDirection: 'column',
    gap: 5,
  },
  followupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  followupBtnText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  viewResponsesBtn: {
    marginLeft: "auto",
    backgroundColor: "#2196f3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewResponsesBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
});

export default FileList;
