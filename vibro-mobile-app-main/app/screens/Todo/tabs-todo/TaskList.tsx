import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface TaskListProps {
  item: any;
  onTaskPress?: (task: any) => void;
  onSharePress?: (task: any) => void;
}

const formatDateTime = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const getFormTypeBadgeColors = (formType?: string | null) => {
  const normalized = String(formType || "").toLowerCase();
  if (normalized.includes("audit")) {
    return { bg: "#FEF3C7", text: "#92400E" };
  }
  if (normalized.includes("location")) {
    return { bg: "#DBEAFE", text: "#1E40AF" };
  }
  return { bg: "#DCFCE7", text: "#166534" };
};

const getSourceBadgeColors = (source?: string | null) => {
  switch (String(source || '').toLowerCase()) {
    case 'planner':
      return { bg: '#F3E8FF', text: '#6B21A8', label: 'Planner', accent: '#7C3AED' };
    case 'form_followup':
      return { bg: '#FFF7ED', text: '#9A3412', label: 'Follow-up', accent: '#F97316' };
    case 'form':
      return { bg: '#EFF6FF', text: '#1E40AF', label: 'Task', accent: '#3B82F6' };
    case 'manual':
      return { bg: '#F3F4F6', text: '#374151', label: 'Manual', accent: '#64748B' };
    default:
      return null;
  }
};

const TaskList = ({ item, onTaskPress, onSharePress }: TaskListProps) => {
  const getAssignedLabels = (task: any): string[] => {
    const labels: string[] = [];
    const seen = new Set<string>();

    const pushLabel = (value: any) => {
      const text = String(value || "").trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      labels.push(text);
    };

    const assignedUsers = Array.isArray(task?.assigned_users) ? task.assigned_users : [];
    assignedUsers.forEach((entry: any) => {
      if (typeof entry === "string") return pushLabel(entry);
      if (typeof entry === "object" && entry) {
        pushLabel(entry.name || entry.username || entry.email);
      }
    });

    const assigneeNames = Array.isArray(task?.assignee_names) ? task.assignee_names : [];
    assigneeNames.forEach((entry: any) => {
      if (typeof entry === "string") return pushLabel(entry);
      if (typeof entry === "object" && entry) {
        pushLabel(entry.name || entry.username || entry.email);
      }
    });

    const assignedGroups = Array.isArray(task?.assigned_groups) ? task.assigned_groups : [];
    assignedGroups.forEach((entry: any) => {
      if (typeof entry === "string") return pushLabel(entry);
      if (typeof entry === "object" && entry) {
        pushLabel(entry.name || entry.group_name);
      }
    });

    return labels;
  };

  const assignedUsers = getAssignedLabels(item);
  const startDateTime = formatDateTime(item.actual_start_date_time);
  const formTypeLabel = item.task_form_type_label || null;
  const mainFormTitle = item.main_form_title || null;
  const followupFormTitle = item.task_name || item.form_title || null;
  const isFollowup = !!item.derived_status;
  const badgeColors = getFormTypeBadgeColors(formTypeLabel);

  const isDirectTask = String(item.source || '').toLowerCase() === 'form' && !!item.id;
  const displayTitle = (isDirectTask && followupFormTitle) ? followupFormTitle : (mainFormTitle || followupFormTitle || 'Untitled Task');
  const parentQuestion = item.parent_question || null;
  const sourceBadge = getSourceBadgeColors(item.source);
  const taskAgeDays = item.task_age_days != null ? item.task_age_days : null;
  const formatTaskAge = (days: number | null) => {
    if (days == null) return "-";
    if (days === 0) return "Today";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  const isReopened = !!item.reopened_remarks;
  const submissionId = item.submission_id != null ? String(item.submission_id) : null;
  const originSubmissionId = item.origin_submission_id != null ? String(item.origin_submission_id) : submissionId;
  const followupTaskId = item.followup_task_id != null ? String(item.followup_task_id) : null;

  // Determine which ID badge to show: planner_id for planner tasks,
  // task ID with prefix for direct task assignments (source=form),
  // form ID for direct form assignments without task context,
  // main_form_id for followup tasks,
  // or submission ID as final fallback
  const plannerId = item.planner_id ? String(item.planner_id) : null;
  const formIdForBadge = item.assigned_form_id || (item.form != null ? String(item.form) : null);
  const mainFormIdForBadge = item.main_form_id || null;
  const taskPrefixId = item.form_prefix ? `${item.form_prefix}-${item.id}` : null;
  const isDirectTaskAssignment = String(item.source || '').toLowerCase() === 'form' && !!item.id;
  const idBadge = (() => {
    if (plannerId) {
      return { label: 'Planner', value: plannerId, color: '#7C3AED', bgColor: '#F5F3FF', icon: 'badge' as const };
    }
    // For tasks assigned via the task module (source=form), show task ID with prefix
    if (isDirectTaskAssignment && taskPrefixId) {
      return { label: 'Task', value: taskPrefixId, color: '#3B82F6', bgColor: '#EFF6FF', icon: 'assignment' as const };
    }
    if (formIdForBadge) {
      return { label: 'Form', value: `#${formIdForBadge}`, color: '#F97316', bgColor: '#FFF7ED', icon: 'description' as const };
    }
    if (mainFormIdForBadge) {
      return { label: 'Main Form', value: `#${mainFormIdForBadge}`, color: '#F97316', bgColor: '#FFF7ED', icon: 'description' as const };
    }
    if (originSubmissionId) {
      return { label: 'Submission', value: `#${originSubmissionId}`, color: '#0D9488', bgColor: '#F0FDFA', icon: 'receipt' as const };
    }
    return null;
  })();

  const deadlineInfo = (() => {
    const endDateValue = item.end_date || item.deadline;
    if (!endDateValue) return null;
    const endDate = new Date(endDateValue);
    if (Number.isNaN(endDate.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    let color = "#94A3B8";
    let bgColor = "#F1F5F9";
    let label = "";
    if (diffDays < 0) {
      color = "#EF4444";
      bgColor = "#FEE2E2";
      label = `Deadline: Overdue by ${Math.abs(diffDays)}d`;
    } else if (diffDays === 0) {
      color = "#F59E0B";
      bgColor = "#FEF3C7";
      label = "Deadline: Due today";
    } else if (diffDays <= 3) {
      color = "#F59E0B";
      bgColor = "#FEF3C7";
      label = `Deadline: Due in ${diffDays}d`;
    } else {
      color = "#64748B";
      bgColor = "#F1F5F9";
      label = `Deadline: ${endDate.toLocaleDateString()}`;
    }
    return { color, bgColor, label, dateStr: endDate.toLocaleDateString() };
  })();

  const statusText = item.status || item.derived_status || "";
  const statusNormalized = String(statusText).toLowerCase().replace(/[\s_]+/g, "");
  const statusColor =
    statusNormalized.includes("completed")
      ? { bg: "#DCfce7", text: "#166534" }
      : statusNormalized.includes("progress") || statusNormalized.includes("pending")
      ? { bg: "#DBEAFE", text: "#1D4ED8" }
      : { bg: "#FEF3C7", text: "#92400E" };

  const accentColor = sourceBadge?.accent || '#2196f3';

  return (
    <TouchableOpacity
      onPress={() => {
        onTaskPress?.(item);
      }}
      style={styles.container}
      activeOpacity={0.85}
    >
      {/* Colored accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

      <View style={styles.cardInner}>
        {/* Compact header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Icon name="assignment" size={13} color={accentColor} />
            <Text style={styles.headerId} numberOfLines={1}>
              {item.form_prefix ? `${item.form_prefix}-${item.id}` : `NPX-${item.id}`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {sourceBadge ? (
              <View style={[styles.tagBadge, { backgroundColor: sourceBadge.bg }]}>
                <Text style={[styles.tagBadgeText, { color: sourceBadge.text }]}>{sourceBadge.label}</Text>
              </View>
            ) : null}
            {formTypeLabel ? (
              <View style={[styles.tagBadge, { backgroundColor: badgeColors.bg }]}>
                <Text style={[styles.tagBadgeText, { color: badgeColors.text }]}>{formTypeLabel}</Text>
              </View>
            ) : null}
            {statusText ? (
              <View style={[styles.tagBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.tagBadgeText, { color: statusColor.text }]}>
                  {String(statusText).replace(/_/g, " ")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>{displayTitle}</Text>

          {/* Parent question */}
          {parentQuestion ? (
            <View style={styles.questionBox}>
              <Icon name="help-outline" size={11} color="#64748B" />
              <Text style={styles.questionText}>{parentQuestion}</Text>
            </View>
          ) : null}

          {/* Meta two-column grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Icon name="place" size={11} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>{item.main_form_location || "-"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="schedule" size={11} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>{startDateTime || "-"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="hourglass-empty" size={11} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>{formatTaskAge(taskAgeDays)}</Text>
            </View>
            {submissionId ? (
              <View style={styles.metaItem}>
                <Icon name="receipt" size={11} color="#64748B" />
                <Text style={styles.metaText} numberOfLines={1}>{item.form_prefix ? `${item.form_prefix}-${submissionId}` : `#${submissionId}`}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Icon name="person" size={11} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>{assignedUsers.length > 0 ? assignedUsers.join(', ') : "-"}</Text>
            </View>
          </View>

          {/* Deadline + ID badge row */}
          {(deadlineInfo || idBadge) ? (
            <View style={styles.deadlinePlannerRow}>
              {deadlineInfo ? (
                <View style={[styles.deadlineRow, { backgroundColor: deadlineInfo.bgColor }]}>
                  <Icon name="timer" size={12} color={deadlineInfo.color} />
                  <Text style={[styles.deadlineText, { color: deadlineInfo.color }]} numberOfLines={1}>
                    {deadlineInfo.label}
                  </Text>
                </View>
              ) : null}
              {idBadge ? (
                <View style={[styles.plannerIdRow, { backgroundColor: idBadge.bgColor }]}>
                  <Icon name={idBadge.icon} size={12} color={idBadge.color} />
                  <Text style={[styles.plannerIdText, { color: idBadge.color }]} numberOfLines={1}>
                    {idBadge.label}: {idBadge.value}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {item.has_started && item.remaining_stages && item.remaining_stages.length > 0 && (
            <View style={styles.metaItem}>
              <Icon name="layers" size={11} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>{item.remaining_stages.map((stage: any) => stage.name).join(', ')}</Text>
            </View>
          )}

          {/* Reopened + Auto-Closed + Share */}
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              {isReopened ? (
                <View style={styles.reopenedBadge}>
                  <Icon name="undo" size={11} color="#EF4444" />
                  <Text style={styles.reopenedBadgeText}>Reopened</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.footerRight}>
              {item.is_auto_closed ? (
                <View style={styles.autoClosedBadge}>
                  <Icon name="cancel" size={11} color="#DC2626" />
                  <Text style={styles.autoClosedBadgeText}>Auto-Closed</Text>
                </View>
              ) : null}
              {onSharePress ? (
                <TouchableOpacity style={styles.shareBtn} onPress={() => onSharePress(item)}>
                  <Icon name="share" size={12} color="#2196f3" />
                  <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentStrip: {
    width: 4,
    backgroundColor: '#2196f3',
  },
  cardInner: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tagBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reopenedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reopenedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
  },
  questionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  questionText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 4,
    flex: 1,
    lineHeight: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 3,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    flexShrink: 1,
  },
  deadlinePlannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 1,
  },
  plannerIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F3FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 1,
  },
  plannerIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    flexShrink: 1,
  },
  deadlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoClosedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  autoClosedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  shareBtnText: {
    fontSize: 11,
    color: '#2196f3',
    fontWeight: '600',
  },
});

export default TaskList;
