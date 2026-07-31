import Accordion from "@/components/Accordion";
import { ALL_LOCATION_TASKS_FILTER } from "@/constants/forms";
import api from "@/services";
import { RECEIVED, TASKASSIGNEDFORM, GETFORMSUBMISSIONDETAILS } from "@/services/constants";
import { RootState } from "@/store";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { Received, ReceivedData } from "@/types/received";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import FileList from "../../../(app)/(tabs)/forms/ListItems/ReceivedListItems/FileList";
import { router } from "expo-router";
import type { TodoFilters } from "../todo-tabs";
import { extractLocationSearchText, hasLocationQuestion } from "./locationFilterUtils";

const SLOW_REFRESH_LOADER_DELAY_MS = 400;

interface SelectedForm {
  formId: string;
  taskId: string;
  submissionId?: string;
  stageId?: string;
  formTitle?: string;
  formType?: string;
  sourceScreen?: string;
  stageAssignmentUuid?: string;
}

interface ReceiveTodoProps {
  setIndex?: (index: number) => void;
  onFormSelect?: (formData: SelectedForm) => void;
  filters?: TodoFilters;
  draftFilters?: TodoFilters;
  onLocationOptionsChange?: (options: string[]) => void;
  onMainFormOptionsChange?: (options: string[]) => void;
  onTaskIdOptionsChange?: (options: string[]) => void;
  onResponseIdOptionsChange?: (options: string[]) => void;
  onQuestionOptionsChange?: (options: string[]) => void;
}

export default function ReceiveTodo({
  setIndex,
  onFormSelect,
  filters,
  draftFilters,
  onLocationOptionsChange,
  onMainFormOptionsChange,
  onTaskIdOptionsChange,
  onResponseIdOptionsChange,
  onQuestionOptionsChange,
}: ReceiveTodoProps) {
  const user = useSelector((state: RootState) => state.user);
  const [receivedData, setReceivedData] = useState<ReceivedData[]>([]);
  const [tasksData, setTasksData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getReceivedTodos = async ({ delayedLoader = false }: { delayedLoader?: boolean } = {}) => {
    let didShowLoader = false;
    try {
      if (delayedLoader) {
        if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = setTimeout(() => {
          didShowLoader = true;
          setLoading(true);
        }, SLOW_REFRESH_LOADER_DELAY_MS);
      } else {
        didShowLoader = true;
        setLoading(true);
      }
      const response = await api.get(`${RECEIVED}${user.id}/`);
      let rawData = response.data;

      try {
        const taskResponse = await api.get('/user/assigned-tasks/');
        const fetchedTasksData = taskResponse.data || [];
        setTasksData(fetchedTasksData); // Store tasks data for later use
        // Get form IDs that have active todo workflows (tasks with remaining stages)
        const todoWorkflowFormIds = new Set(
          fetchedTasksData
            .filter((task: any) => task.remaining_stages && task.remaining_stages.length > 0)
            .map((task: any) => String(task.form))
        );
        // Check which todo workflow forms are actually in the received data
        const receivedFormIds = new Set(rawData.map((item: any) => String(item.form?.id)));
        const missingTodoForms = Array.from(todoWorkflowFormIds).filter(id => !receivedFormIds.has(id));
        if (missingTodoForms.length > 0) {
        }

        // For TODO received screen, we want to show ONLY forms that are part of todo workflows
        // This is the opposite of the regular received forms screen which filters them out
        const beforeFilterCount = rawData.length;
        rawData = rawData.filter((item: any) => {
          const formId = String(item.form?.id);
          const shouldInclude = todoWorkflowFormIds.has(formId);
          if (shouldInclude) {
          }
          return shouldInclude;
        });
      } catch (taskError) {
        // Continue without filtering if task fetch fails
      }

      // Filter to show only items that have pending stage submissions
      // This ensures we only show stages that are actually assigned to this user and pending
      const beforePendingFilterCount = rawData.length;
      rawData = rawData.filter((item: any) => item.is_stage_submission_pending === true);

      // Debug final filtered data
      if (rawData.length > 0) {
      } else {
      }

      const grouped: { [formId: string]: ReceivedData } = {};

      rawData.forEach((item: any) => {
        // Skip if no form_submission_id
        if (!item.form_submission_id) return;

        const form = item.form;
        const formId = String(form.id);

        if (!grouped[formId]) {
          grouped[formId] = {
            id: formId,
            title: form.title,
            form_type: form.form_type,
            received: [],
          };
        }

        grouped[formId].received.push({
          id: String(item.form_submission_id),
          submission_initiated_on: item.created_on || item.created_at || form.created_at,
          submission_initiated_stage: item.stage_order,
          submission_initiated_by: form.created_by,
          is_completed: !item.is_form_submission_pending,
          completed_by: null,
          completed_on: null,

          is_form_submission_pending: item.is_form_submission_pending,
          is_stage_submission_pending: item.is_stage_submission_pending,
          stage_assignment_id: item.stage_assignment_id,
          stage_assignment_uuid: item.assignment_uuid,
          stage_id: item.stage_id,
          stage_name: item.stage_name,
          stage_order: item.stage_order,
          form_submission_id: item.form_submission_id,
          task_id: item.task_id, // Include the task_id for proper task submission
        });
      });

      const finalData = Object.values(grouped);
      setReceivedData(finalData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch received todos");
    } finally {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
      if (didShowLoader) setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await getReceivedTodos();
    setRefreshing(false);
  }, []);

  // Listen for stage submission events to refresh RECEIVED tab
  useEffect(() => {
    const handleStageSubmitted = (event: any) => {
      // Refresh immediately
      getReceivedTodos();

      // Also refresh after a delay in case backend takes time to process stage assignments
      setTimeout(() => {
        getReceivedTodos();
      }, 3000); // 3 second delay

      // And one more refresh after a longer delay
      setTimeout(() => {
        getReceivedTodos();
      }, 8000); // 8 second delay
    };

    // Add event listener for custom event
    if (window.addEventListener) {
      window.addEventListener('todoStageSubmitted', handleStageSubmitted);
    }

    // Cleanup
    return () => {
      if (window.removeEventListener) {
        window.removeEventListener('todoStageSubmitted', handleStageSubmitted);
      }
    };
  }, []);

  useEffect(() => {
    getReceivedTodos();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getReceivedTodos({ delayedLoader: true });
      return () => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
          loaderTimeoutRef.current = null;
        }
      };
    }, [])
  );

  const handleTaskPress = (formId: string, submissionId: string, stageId: string, formTitle?: string) => {
    if (onFormSelect) {
      // Find the task ID from tasksData that corresponds to this form
      let taskId: string | undefined;
      let stageAssignmentUuid: string | undefined;
      let resolvedFormType: string | undefined;

      // Find the task that matches this form
      const matchingTask = tasksData.find((task: any) => String(task.form) === formId);
      if (matchingTask) {
        taskId = String(matchingTask.id);
        const rawType =
          matchingTask?.form_type ||
          matchingTask?.assigned_form_type ||
          matchingTask?.form?.form_type ||
          matchingTask?.form_details?.form_type ||
          "";
        const normalized = String(rawType).toLowerCase();
        if (normalized.includes("audit")) resolvedFormType = "audit";
        else if (normalized.includes("standard")) resolvedFormType = "standard";
      }

      // Find the stage assignment UUID from the received data
      const formData = receivedData.find(item => item.id === formId);
      if (formData && formData.received) {
        const receivedItem = formData.received.find(received =>
          received.id === submissionId && String(received.stage_id) === stageId
        );
        if (receivedItem) {
          stageAssignmentUuid = receivedItem.stage_assignment_uuid;
        }
      }

      onFormSelect({
        formId,
        taskId: taskId || submissionId, // Use actual task ID if available, fallback to submissionId
        submissionId: submissionId, // Pass submissionId separately so the form screen can use it
        stageId: stageId, // Pass stageId so the form screen can navigate to the correct stage
        formTitle,
        formType: resolvedFormType || 'todo',
        sourceScreen: 'todo-receive',
        stageAssignmentUuid: stageAssignmentUuid // Include the stage assignment UUID
      });
    }
  };

  // const handleFormClose = () => {
  //   // Close form and go back to task list
  //   setSelectedTask(null);
  //   // Refresh tasks to get updated status
  //   fetchTasks();
  // };

  // // If a task is selected, show the form data screen
  // if (selectedTask) {
  //   return (
  //     <TodoFormDataScreen selectedTask={selectedTask} />
  //   );
  // }

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
    const toDateOnly = (value?: string | number | Date | null) => {
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
    const toDateOnly = (value?: string | number | Date | null) => {
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

  const getReceivedLocationText = (received: any) => {
    const candidates = [
      received.location_name,
      received.location_title,
      received.location,
      received.site_name,
      received.area_name,
      received.plant_name,
      received.department_name,
      received.department?.name,
      received.location?.name,
      received.location?.title,
    ];

    const directLocationText = candidates
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).toLowerCase())
      .join(" ");
    const questionLocationText = extractLocationSearchText(received);

    return [directLocationText, questionLocationText].filter(Boolean).join(" ");
  };

  const filteredReceivedData = useMemo(() => {
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
    if (!statuses.includes("all") && !statuses.includes("pending")) {
      return [] as ReceivedData[];
    }
    if (taskTypes.includes("followup")) {
      return [] as ReceivedData[];
    }

    const filtered = receivedData
      .map((group) => {
        const title = String(group.title || "");
        if (query && !title.toLowerCase().includes(query)) {
          return null;
        }
        if (mainForms.length > 0) {
          const matchesAnyMainForm = mainForms.some((mf) => {
            const lowerMf = mf.toLowerCase();
            return title.toLowerCase().includes(lowerMf);
          });
          if (!matchesAnyMainForm) {
            return null;
          }
        }
        if (!formTypes.includes("all")) {
          const groupFormType = String(group.form_type || "").toLowerCase();
          const normalizedGroupFormType = groupFormType.includes("audit")
            ? "audit"
            : "standard";
          if (!formTypes.includes(normalizedGroupFormType)) {
            return null;
          }
        }

        const filteredReceived = (group.received || []).filter((received) => {
          if (taskIds.length > 0) {
            const prefix = (received as any)?.form_prefix || "NPX";
            const receivedTaskId = `${prefix}-${(received as any)?.task_id || ""}`;
            if (!taskIds.includes(receivedTaskId)) {
              return false;
            }
          }
          if (responseIds.length > 0) {
            const prefix = (received as any)?.form_prefix || "NPX";
            const subId = (received as any)?.form_submission_id != null ? String((received as any).form_submission_id) : ((received as any)?.submission_id != null ? String((received as any).submission_id) : "");
            const responseIdStr = subId ? `${prefix}-${subId}` : "";
            if (!responseIdStr || !responseIds.includes(responseIdStr)) {
              return false;
            }
          }
          if (reopened && !(received as any)?.reopened_remarks) return false;
          if (locations.length > 0) {
            const locationText = extractLocationSearchText(received);
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

          const dateValue =
            received.submission_initiated_on ||
            received.completed_on ||
            (received as any).created_on;
          const dateOnly = toDateOnly(dateValue);
          if ((startDate || endDate) && !dateOnly) return false;
          if (startDate && dateOnly && dateOnly < startDate) return false;
          if (endDate && dateOnly && dateOnly > endDate) return false;
          return true;
        });

        if (filteredReceived.length === 0) return null;
        return {
          ...group,
          received: filteredReceived,
        };
      })
      .filter((group): group is ReceivedData => group !== null);

    if (sort === "default") return filtered;

    const getGroupStartTime = (group: ReceivedData) => {
      const times = (group.received || [])
        .map((received: any) => {
          const raw =
            received.submission_initiated_on ||
            received.completed_on ||
            received.created_on ||
            received.created_at;
          const time = new Date(raw || 0).getTime();
          return Number.isFinite(time) ? time : 0;
        })
        .filter((time) => time > 0);
      return times.length ? Math.max(...times) : 0;
    };

    const getGroupTitle = (group: ReceivedData) => String(group.title || "").toLowerCase();

    const sorted = [...filtered];
    if (sort === "newest") {
      sorted.sort((a, b) => getGroupStartTime(b) - getGroupStartTime(a));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => getGroupStartTime(a) - getGroupStartTime(b));
    } else if (sort === "az") {
      sorted.sort((a, b) => getGroupTitle(a).localeCompare(getGroupTitle(b)));
    }

    return sorted;
  }, [receivedData, normalizedFilters]);

  const getCrossFilteredReceived = useCallback(
    (exclude: "location" | "mainForm" | "taskId" | "responseId" | "question") => {
      const {
        locations,
        mainForms,
        formTypes,
        taskTypes,
        taskIds,
        responseIds,
        reopened,
        startDate,
        endDate,
        toDateOnly,
      } = normalizedDraftFilters;

      if (taskTypes.includes("followup")) return [];

      const allReceived: { received: any; group: ReceivedData }[] = [];
      receivedData.forEach((group) => {
        (group.received || []).forEach((received: any) => {
          allReceived.push({ received, group });
        });
      });

      return allReceived.filter(({ received, group }) => {
        const title = String(group.title || "");

        if (exclude !== "mainForm" && mainForms.length > 0) {
          const matchesAnyMainForm = mainForms.some((mf) => title.toLowerCase().includes(mf.toLowerCase()));
          if (!matchesAnyMainForm) return false;
        }

        if (!formTypes.includes("all")) {
          const groupFormType = String(group.form_type || "").toLowerCase();
          const normalizedGroupFormType = groupFormType.includes("audit") ? "audit" : "standard";
          if (!formTypes.includes(normalizedGroupFormType)) return false;
        }

        if (exclude !== "taskId" && taskIds.length > 0) {
          const prefix = received?.form_prefix || "NPX";
          const receivedTaskId = `${prefix}-${received?.task_id || ""}`;
          if (!taskIds.includes(receivedTaskId)) return false;
        }

        if (exclude !== "responseId" && responseIds.length > 0) {
          const prefix = received?.form_prefix || "NPX";
          const subId = received?.form_submission_id != null ? String(received.form_submission_id) : (received?.submission_id != null ? String(received.submission_id) : "");
          const responseIdStr = subId ? `${prefix}-${subId}` : "";
          if (!responseIdStr || !responseIds.includes(responseIdStr)) return false;
        }

        if (reopened && !received?.reopened_remarks) return false;

        if (exclude !== "location" && locations.length > 0) {
          const locationText = extractLocationSearchText(received);
          const matchesAnyLocation = locations.some((loc) => {
            const lowerLoc = loc.toLowerCase();
            return (!!locationText && locationText.includes(lowerLoc)) || title.toLowerCase().includes(lowerLoc);
          });
          if (!matchesAnyLocation) return false;
        }

        const dateValue = received.submission_initiated_on || received.completed_on || received.created_on;
        const dateOnly = toDateOnly(dateValue);
        if ((startDate || endDate) && !dateOnly) return false;
        if (startDate && dateOnly && dateOnly < startDate) return false;
        if (endDate && dateOnly && dateOnly > endDate) return false;

        return true;
      });
    },
    [receivedData, normalizedDraftFilters]
  );

  useEffect(() => {
    const crossFiltered = getCrossFilteredReceived("location");
    const optionSet = new Set<string>();
    const seenGroups = new Set<string>();
    crossFiltered.forEach(({ received, group }) => {
      if (!hasLocationQuestion(received)) return;
      const groupKey = String(group.title || "");
      if (seenGroups.has(groupKey)) return;
      seenGroups.add(groupKey);
      const label = String(group.title || "").trim();
      if (label) optionSet.add(label);
    });
    onLocationOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredReceived, onLocationOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredReceived("mainForm");
    const optionSet = new Set<string>();
    const seenGroups = new Set<string>();
    crossFiltered.forEach(({ group }) => {
      const groupKey = String(group.title || "");
      if (seenGroups.has(groupKey)) return;
      seenGroups.add(groupKey);
      const title = String(group.title || "").trim();
      if (title) optionSet.add(title);
    });
    onMainFormOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredReceived, onMainFormOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredReceived("taskId");
    const optionSet = new Set<string>();
    crossFiltered.forEach(({ received }) => {
      const prefix = received?.form_prefix || "NPX";
      const taskId = `${prefix}-${received?.task_id || ""}`;
      if (received?.task_id) optionSet.add(taskId);
    });
    onTaskIdOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredReceived, onTaskIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredReceived("responseId");
    const optionSet = new Set<string>();
    crossFiltered.forEach(({ received }) => {
      const prefix = received?.form_prefix || "NPX";
      const subId = received?.form_submission_id != null ? String(received.form_submission_id) : (received?.submission_id != null ? String(received.submission_id) : "");
      if (subId) {
        optionSet.add(`${prefix}-${subId}`);
      }
    });
    onResponseIdOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredReceived, onResponseIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredReceived("question");
    const optionSet = new Set<string>();
    const seenGroups = new Set<string>();
    crossFiltered.forEach(({ group }) => {
      const groupKey = String(group.title || "");
      if (seenGroups.has(groupKey)) return;
      seenGroups.add(groupKey);
      const formQuestions = (group as any)?.questions || (group as any)?.form_questions || [];
      if (Array.isArray(formQuestions)) {
        formQuestions.forEach((q: any) => {
          const qText = String(q?.question || q?.text || q?.title || "").trim();
          if (qText) optionSet.add(qText);
        });
      }
    });
    onQuestionOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredReceived, onQuestionOptionsChange]);

  const renderItem = ({ item }: { item: ReceivedData }) => {
    if (!item.received || item.received.length === 0) return null;
    return (
      <Accordion
        title={item.title}
        containerStyle={styles.accordionContainer}
        headerStyle={styles.accordionHeader}
        iconColor="#6200ee"
        expanded={false}
        onPress={(expanded) => console.log("Accordion expanded:", expanded)}
      >
        {item.received
          .filter(
            (received: Received) =>
              received.is_stage_submission_pending === true
          )
          .map(
            (received: Received) =>
              <FileList
                key={received.form_submission_id}
                items={received}
                formId={item.id}
                formTitle={item.title}
                onClick={handleTaskPress}
              />
          )}
      </Accordion>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#6200ee" />
      ) : (
        <FlatList
          data={filteredReceivedData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tasks in progress.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  accordionContainer: {
    marginBottom: 10,
  },
  accordionHeader: {
    backgroundColor: "#e3f2fd",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    padding: 15,
    textAlign: "center",
    color: "gray",
    fontStyle: "italic",
  },
});
