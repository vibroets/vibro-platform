import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_LOCATION_TASKS_FILTER } from "@/constants/forms";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import Card from "@/components/Card";
import { DraftData, offlineStorageService } from "@/services/offlineStorageService";
import { RootState } from "@/store";
import type { TodoFilters } from "../todo-tabs";
import { extractLocationSearchText, hasLocationQuestion } from "./locationFilterUtils";

interface SelectedForm {
  formId: string;
  taskId: string;
  submissionId?: string;
  formTitle?: string;
  formType?: string;
  sourceScreen?: string;
  draftId?: string;
}

interface DraftTodoProps {
  onFormSelect?: (formData: SelectedForm) => void;
  filters?: TodoFilters;
  draftFilters?: TodoFilters;
  onLocationOptionsChange?: (options: string[]) => void;
  onMainFormOptionsChange?: (options: string[]) => void;
  onTaskIdOptionsChange?: (options: string[]) => void;
  onResponseIdOptionsChange?: (options: string[]) => void;
  onQuestionOptionsChange?: (options: string[]) => void;
}

interface DraftItemProps {
  draft: DraftData;
  onResume: (draft: DraftData) => void;
  onDelete: (draftId: string) => void;
}

const DraftItem: React.FC<DraftItemProps> = ({ draft, onResume, onDelete }) => {
  const handleDelete = () => {
    Alert.alert(
      "Delete Draft",
      "Are you sure you want to delete this draft? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(draft.id) },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    // Format as: 23 Nov 2025, 10:45
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate().toString().padStart(2, "0");
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  return (
    <View style={styles.draftItem}>
      <View style={styles.draftContent}>
        <View style={styles.draftHeader}>
          <Text style={styles.draftTitle} numberOfLines={1}>
            {draft.formTitle}
          </Text>
          <Text style={styles.draftDate}>{formatDate(draft.timestamp)}</Text>
        </View>
        <View style={styles.draftMeta}>
          <Text style={styles.draftProgress}>
            {`Stage ${draft.currentStageIndex + 1} • ${draft.completedStages.length} completed`}
          </Text>
        </View>
      </View>
      <View style={styles.draftActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.resumeButton]}
          onPress={() => onResume(draft)}
        >
          <MaterialIcons name="play-arrow" size={20} color="white" />
          <Text style={styles.actionButtonText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
        >
          <MaterialIcons name="delete" size={20} color="white" />
        </TouchableOpacity>
    </View>
    </View>
  );
};

const DraftTodo = ({
  onFormSelect,
  filters,
  draftFilters,
  onLocationOptionsChange,
  onMainFormOptionsChange,
  onTaskIdOptionsChange,
  onResponseIdOptionsChange,
  onQuestionOptionsChange,
}: DraftTodoProps) => {
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = useSelector((state: RootState) => state.user);

  const loadDrafts = useCallback(async () => {
    try {
      if (!user?.id) return;

      // Load drafts from both database and local storage
      const allDrafts = await offlineStorageService.getAllDraftsWithDatabase(user.id);
      const todoDrafts = allDrafts
        .filter(draft => draft.sourceScreen?.startsWith('todo'))
        .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

      setDrafts(todoDrafts);
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
  }, [loadDrafts]);

  const handleResumeDraft = useCallback((draft: DraftData) => {
    if (onFormSelect) {
      onFormSelect({
        formId: draft.formId.toString(),
        taskId: draft.taskId?.toString() || '',
        draftId: draft.id,
        formTitle: draft.formTitle,
        formType: draft.formType === 'audit' ? 'audit' : 'todo',
        sourceScreen: 'todo'
      });
    }
  }, [onFormSelect]);

  const handleDeleteDraft = useCallback(async (draftId: string) => {
    try {
      await offlineStorageService.removeDraft(draftId);
      await loadDrafts(); // Refresh the list
    } catch (error) {
      Alert.alert("Error", "Failed to delete draft. Please try again.");
    }
  }, [loadDrafts]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Refresh drafts whenever this screen gains focus (e.g., after saving a draft)
  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts])
  );

  const normalizedFilters = useMemo(() => {
    const query = (filters?.query || "").trim().toLowerCase();
    const locations = filters?.location || [];
    const mainForms = filters?.mainForm || [];
    const formTypes = filters?.formType || ["all"];
    const taskTypes = filters?.taskType || ["all"];
    const taskIds = filters?.taskId || [];
    const responseIds = filters?.responseId || [];
    const questions = filters?.question || [];
    const reopened = filters?.reopened || false;
    const aging = filters?.aging || "all";
    const statuses = filters?.status || ["all"];
    const toDateOnly = (value?: number | Date | null) => {
      if (!value) return null;
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };
    return {
      query,
      locations,
      mainForms,
      formTypes,
      taskTypes,
      taskIds,
      responseIds,
      questions,
      reopened,
      aging,
      statuses,
      startDate: filters?.startDate ? toDateOnly(filters.startDate) : null,
      endDate: filters?.endDate ? toDateOnly(filters.endDate) : null,
      sort: filters?.sort ?? "default",
      toDateOnly,
    };
  }, [filters]);

  const normalizedDraftFilters = useMemo(() => {
    const src = draftFilters || filters;
    if (!src) return normalizedFilters;
    const query = (src.query || "").trim().toLowerCase();
    const locations = src.location || [];
    const mainForms = src.mainForm || [];
    const formTypes = src.formType || ["all"];
    const taskTypes = src.taskType || ["all"];
    const taskIds = src.taskId || [];
    const responseIds = src.responseId || [];
    const questions = src.question || [];
    const reopened = src.reopened || false;
    const aging = src.aging || "all";
    const statuses = src.status || ["all"];
    const toDateOnly = (value?: number | Date | null) => {
      if (!value) return null;
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };
    return {
      query,
      locations,
      mainForms,
      formTypes,
      taskTypes,
      taskIds,
      responseIds,
      questions,
      reopened,
      aging,
      statuses,
      startDate: src.startDate ? toDateOnly(src.startDate) : null,
      endDate: src.endDate ? toDateOnly(src.endDate) : null,
      sort: src.sort ?? "default",
      toDateOnly,
    };
  }, [draftFilters, filters, normalizedFilters]);

  const getDraftLocationText = (draft: DraftData) => {
    const formData = draft.formData || {};
    const candidates = [
      formData.location_name,
      formData.location_title,
      formData.location,
      formData.site_name,
      formData.area_name,
      formData.plant_name,
      formData.department_name,
      formData.department?.name,
      formData.location?.name,
      formData.location?.title,
    ];

    const directLocationText = candidates
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).toLowerCase())
      .join(" ");
    const questionLocationText = extractLocationSearchText(formData);

    return [directLocationText, questionLocationText].filter(Boolean).join(" ");
  };

  const filteredDrafts = useMemo(() => {
    const {
      query,
      locations,
      mainForms,
      formTypes,
      taskTypes,
      taskIds,
      responseIds,
      reopened,
      startDate,
      endDate,
      statuses,
      toDateOnly,
      sort,
    } = normalizedFilters;
    if (taskTypes.includes("followup")) {
      return [] as DraftData[];
    }
    const filtered = drafts.filter((draft) => {
      const title = String(draft.formTitle || "");
      if (query && !title.toLowerCase().includes(query)) {
        return false;
      }

      if (locations.length > 0) {
        const locationText = getDraftLocationText(draft);
        const matchesAnyLocation = locations.some((loc) => {
          const lowerLoc = loc.toLowerCase();
          return (
            (!!locationText && locationText.includes(lowerLoc)) ||
            title.toLowerCase().includes(lowerLoc)
          );
        });
        if (!matchesAnyLocation) {
          return false;
        }
      }

      if (mainForms.length > 0) {
        const draftMainForm = String(
          draft?.formData?.main_form_title || draft.formTitle || ""
        )
          .trim()
          .toLowerCase();
        const matchesAnyMainForm = mainForms.some((mf) => {
          const lowerMf = mf.toLowerCase();
          return draftMainForm.includes(lowerMf);
        });
        if (!matchesAnyMainForm) {
          return false;
        }
      }

      if (!formTypes.includes("all")) {
        const draftTypeRaw = String(draft?.formType || "").toLowerCase();
        const normalizedDraftType = draftTypeRaw.includes("audit")
          ? "audit"
          : "standard";
        if (!formTypes.includes(normalizedDraftType)) {
          return false;
        }
      }

      if (taskIds.length > 0) {
        const prefix = (draft as any)?.form_prefix || "NPX";
        const draftTaskId = `${prefix}-${draft?.taskId || ""}`;
        if (!taskIds.includes(draftTaskId)) {
          return false;
        }
      }

      if (reopened) return false;

      const draftDate = toDateOnly(draft.timestamp);
      if ((startDate || endDate) && !draftDate) {
        return false;
      }
      if (startDate && draftDate && draftDate < startDate) return false;
      if (endDate && draftDate && draftDate > endDate) return false;

      if (status !== "all" && status !== "pending") {
        return false;
      }

      return true;
    });

    if (sort === "default") return filtered;

    const getDraftTitle = (draft: DraftData) => String(draft.formTitle || "").toLowerCase();

    const sorted = [...filtered];
    if (sort === "newest") {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sort === "oldest") {
      sorted.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sort === "az") {
      sorted.sort((a, b) => getDraftTitle(a).localeCompare(getDraftTitle(b)));
    }

    return sorted;
  }, [drafts, normalizedFilters]);

  const getCrossFilteredDrafts = useCallback(
    (exclude: "location" | "mainForm" | "taskId" | "responseId" | "question") => {
      const {
        locations,
        mainForms,
        formTypes,
        taskTypes,
        taskIds,
        reopened,
        startDate,
        endDate,
        toDateOnly,
      } = normalizedDraftFilters;

      if (taskTypes.includes("followup")) return [];

      return drafts.filter((draft) => {
        const title = String(draft.formTitle || "");

        if (exclude !== "location" && locations.length > 0) {
          const locationText = getDraftLocationText(draft);
          const matchesAnyLocation = locations.some((loc) => {
            const lowerLoc = loc.toLowerCase();
            return (!!locationText && locationText.includes(lowerLoc)) || title.toLowerCase().includes(lowerLoc);
          });
          if (!matchesAnyLocation) return false;
        }

        if (exclude !== "mainForm" && mainForms.length > 0) {
          const draftMainForm = String(draft?.formData?.main_form_title || draft.formTitle || "").trim().toLowerCase();
          const matchesAnyMainForm = mainForms.some((mf) => draftMainForm.includes(mf.toLowerCase()));
          if (!matchesAnyMainForm) return false;
        }

        if (!formTypes.includes("all")) {
          const draftTypeRaw = String(draft?.formType || "").toLowerCase();
          const normalizedDraftType = draftTypeRaw.includes("audit") ? "audit" : "standard";
          if (!formTypes.includes(normalizedDraftType)) return false;
        }

        if (exclude !== "taskId" && taskIds.length > 0) {
          const prefix = (draft as any)?.form_prefix || "NPX";
          const draftTaskId = `${prefix}-${draft?.taskId || ""}`;
          if (!taskIds.includes(draftTaskId)) return false;
        }

        if (reopened) return false;

        const draftDate = toDateOnly(draft.timestamp);
        if ((startDate || endDate) && !draftDate) return false;
        if (startDate && draftDate && draftDate < startDate) return false;
        if (endDate && draftDate && draftDate > endDate) return false;

        return true;
      });
    },
    [drafts, normalizedDraftFilters]
  );

  useEffect(() => {
    const crossFiltered = getCrossFilteredDrafts("location");
    const options = Array.from(
      new Set(
        crossFiltered
          .filter((draft) => hasLocationQuestion(draft.formData || {}))
          .map((draft) => String(draft.formTitle || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onLocationOptionsChange?.(options);
  }, [getCrossFilteredDrafts, onLocationOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredDrafts("mainForm");
    const options = Array.from(
      new Set(
        crossFiltered
          .map((draft) =>
            String(draft?.formData?.main_form_title || draft.formTitle || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onMainFormOptionsChange?.(options);
  }, [getCrossFilteredDrafts, onMainFormOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredDrafts("taskId");
    const options = Array.from(
      new Set(
        crossFiltered
          .map((draft) => {
            const prefix = (draft as any)?.form_prefix || "NPX";
            return `${prefix}-${draft?.taskId || ""}`;
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onTaskIdOptionsChange?.(options);
  }, [getCrossFilteredDrafts, onTaskIdOptionsChange]);

  useEffect(() => {
    onResponseIdOptionsChange?.([]);
  }, [onResponseIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredDrafts("question");
    const optionSet = new Set<string>();
    crossFiltered.forEach((draft) => {
      const formQuestions = (draft as any)?.formData?.questions || (draft as any)?.questions || [];
      if (Array.isArray(formQuestions)) {
        formQuestions.forEach((q: any) => {
          const qText = String(q?.question || q?.text || q?.title || "").trim();
          if (qText) optionSet.add(qText);
        });
      }
    });
    onQuestionOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredDrafts, onQuestionOptionsChange]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="description" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Draft Tasks Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your saved task drafts will appear here. Start filling out a task and save it as a draft to continue later.
      </Text>
    </View>
  );

  const renderDraftItem = ({ item }: { item: DraftData }) => (
    <DraftItem
      draft={item}
      onResume={handleResumeDraft}
      onDelete={handleDeleteDraft}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading drafts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        <Card title="Task Drafts">
          <FlatList
            data={filteredDrafts}
            keyExtractor={(item) => item.id}
            renderItem={renderDraftItem}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            contentContainerStyle={filteredDrafts.length === 0 ? styles.emptyListContainer : undefined}
            showsVerticalScrollIndicator={false}
          />
        </Card>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    margin: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  draftItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  draftContent: {
    flex: 1,
  },
  draftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  draftTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  draftDate: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  draftMeta: {
    marginBottom: 12,
  },
  draftProgress: {
    fontSize: 14,
    color: "#666",
  },
  draftActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: "center",
  },
  resumeButton: {
    backgroundColor: "#007AFF",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});

export default DraftTodo;
