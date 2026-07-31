import { ALL_LOCATION_TASKS_FILTER } from "@/constants/forms";
import { RootState } from "@/Redux/reducer/rootReducer";
import * as Api from "@/services";
import { TASKASSIGNEDFORM } from "@/services/constants";
import { SecureStoreKeys, SecureStoreService } from "@/services/secureStore";
import { useIsFocused } from "@react-navigation/native";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useSelector } from "react-redux";
import type { TodoFilters } from "../todo-tabs";
import { extractLocationSearchText, hasLocationQuestion } from "./locationFilterUtils";
import TaskList from "./TaskList";

const SLOW_REFRESH_LOADER_DELAY_MS = 400;

interface SelectedForm {
  formId: string;
  taskId: string;
  submissionId?: string;
  formTitle?: string;
  formType?: string;
  sourceScreen?: string;
}

interface NewTodoProps {
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

const TASK_DETAILS_CACHE: Record<string, any> = {};
const TASK_DETAILS_INFLIGHT: Record<string, Promise<any>> = {};

const NewTodo = ({
  setIndex,
  onFormSelect,
  filters,
  draftFilters,
  onLocationOptionsChange,
  onMainFormOptionsChange,
  onTaskIdOptionsChange,
  onResponseIdOptionsChange,
  onQuestionOptionsChange,
}: NewTodoProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();
  const isFetchingRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user = useSelector((state: RootState) => state.user);

  const [shareTask, setShareTask] = useState<any>(null);
  const [shareDialogVisible, setShareDialogVisible] = useState(false);
  const [shareUsers, setShareUsers] = useState<any[]>([]);
  const [shareGroups, setShareGroups] = useState<any[]>([]);
  const [selectedShareUsers, setSelectedShareUsers] = useState<number[]>([]);
  const [selectedShareGroups, setSelectedShareGroups] = useState<number[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareTab, setShareTab] = useState<"users" | "groups">("users");

  const isUserAssignedToTask = (task: any): boolean => {
    const assignedRaw =
      (Array.isArray(task?.assigned_users) && task.assigned_users) ||
      (Array.isArray(task?.assignee_names) && task.assignee_names) ||
      [];

    if (!assignedRaw.length) return true; // Don't hide if backend doesn't provide assignees

    const userId = user?.id;
    const userEmail = String(user?.email || "").trim().toLowerCase();
    const userUsername = String(user?.username || "").trim().toLowerCase();
    const userFullName = `${String(user?.first_name || "").trim()} ${String(user?.last_name || "").trim()}`.trim().toLowerCase();

    return assignedRaw.some((entry: any) => {
      if (entry == null) return false;
      if (typeof entry === "number" && userId != null) return entry === userId;
      if (typeof entry === "string") {
        const value = entry.trim().toLowerCase();
        return (
          (userId != null && value === String(userId)) ||
          (userEmail && value === userEmail) ||
          (userUsername && value === userUsername) ||
          (userFullName && value === userFullName)
        );
      }
      if (typeof entry === "object") {
        const entryId = entry.id ?? entry.user_id ?? entry.assignee_id;
        const entryEmail = String(entry.email || entry.username || "").trim().toLowerCase();
        const entryName = String(entry.name || "").trim().toLowerCase();
        return (
          (userId != null && entryId === userId) ||
          (userEmail && entryEmail === userEmail) ||
          (userUsername && entryEmail === userUsername) ||
          (userFullName && entryName === userFullName)
        );
      }
      return false;
    });
  };

  const getMainFormId = (task: any): string | null => {
    const raw = task?.followup_task_form_id;
    if (!raw) return null;
    if (typeof raw === "object") return raw?.id ? String(raw.id) : null;
    return String(raw);
  };

  const getMainFormTitleFromTask = (task: any): string | null => {
    const raw = task?.followup_task_form_id;
    if (typeof raw === "object" && typeof raw?.title === "string" && raw.title.trim()) {
      return raw.title.trim();
    }
    const direct =
      task?.followup_task_form_title ||
      task?.main_form_title ||
      task?.followup_main_form_title;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    return null;
  };

  const getTaskFormType = (task: any): string => {
    const raw =
      task?.form_type ||
      task?.assigned_form_type ||
      task?.followup_task_form_id?.form_type ||
      task?.form?.form_type ||
      task?.form_details?.form_type ||
      "";
    const normalized = String(raw).toLowerCase();
    if (normalized.includes("audit")) return "Audit";
    if (normalized.includes("location")) return "Location";
    if (normalized.includes("standard")) return "Standard";
    return raw ? String(raw) : "Standard";
  };

  const getTaskFormTypeKey = (task: any): string => {
    const raw =
      task?.task_form_type_label ||
      task?.form_type ||
      task?.assigned_form_type ||
      task?.followup_task_form_id?.form_type ||
      task?.form?.form_type ||
      task?.form_details?.form_type ||
      "";
    const normalized = String(raw).toLowerCase();
    if (normalized.includes("audit")) return "audit";
    if (normalized.includes("standard")) return "standard";
    if (normalized.includes("todo")) return "todo";
    return normalized || "standard";
  };

  const getActualStartDateTime = (task: any, taskDetails?: any): string | null => {
    const candidates: string[] = [];

    const pushIfValid = (value: any) => {
      if (!value) return;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) candidates.push(String(value));
    };

    pushIfValid(task?.actual_start_date);
    pushIfValid(task?.started_on);
    pushIfValid(task?.started_at);
    pushIfValid(taskDetails?.actual_start_date);
    pushIfValid(taskDetails?.started_on);
    pushIfValid(taskDetails?.started_at);

    const tracking = [
      ...(Array.isArray(task?.tracking_records) ? task.tracking_records : []),
      ...(Array.isArray(taskDetails?.tracking_records) ? taskDetails.tracking_records : []),
    ];
    tracking.forEach((r: any) => pushIfValid(r?.actual_start_date));

    const activityLogs = Array.isArray(taskDetails?.activity_logs) ? taskDetails.activity_logs : [];
    const followupStartLogs = activityLogs.filter((log: any) => {
      const action = String(log?.action || "").toLowerCase().replace(/\s+/g, "_");
      return action === "followup_started" || action === "started";
    });
    followupStartLogs.forEach((log: any) => pushIfValid(log?.created_at));

    if (!candidates.length) return null;

    candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return candidates[0] || null;
  };

  const getTaskDetails = async (taskId: string) => {
    if (TASK_DETAILS_CACHE[taskId]) return TASK_DETAILS_CACHE[taskId];
    if (taskId in TASK_DETAILS_INFLIGHT) return TASK_DETAILS_INFLIGHT[taskId];

    TASK_DETAILS_INFLIGHT[taskId] = (async () => {
      try {
        const data = (await Api.get(`/tasks/${taskId}/`)) as any;
        TASK_DETAILS_CACHE[taskId] = data;
        return data;
      } catch {
        TASK_DETAILS_CACHE[taskId] = {};
        return {};
      } finally {
        delete TASK_DETAILS_INFLIGHT[taskId];
      }
    })();

    return TASK_DETAILS_INFLIGHT[taskId];
  };

  const fetchTasks = async ({ delayedLoader = false }: { delayedLoader?: boolean } = {}) => {
    if (!isFocused || isFetchingRef.current) return;
    isFetchingRef.current = true;
    let didShowLoader = false;
    // Check authentication status
    try {
      const authInfo = (await SecureStoreService?.get(SecureStoreKeys.AUTH_INFO)) as any;
    } catch (authError) {
    }

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

      const response = (await Api.get(TASKASSIGNEDFORM)) as any;

      // For debugging, show all tasks first to see what's available
      const allTasks = (response || []);
      console.log(`[TodoNew] API returned ${allTasks.length} tasks`);
      allTasks.forEach((task: any, i: number) => {
        console.log(`[TodoNew] Task[${i}]: id=${task.id}, derived_status=${task.derived_status}, status=${task.status}, source=${task.source}, form=${task.form}, followup_task_form_id=${JSON.stringify(task.followup_task_form_id)}, planner_id=${task.planner_id}, submission_id=${task.submission_id}, origin_submission_id=${task.origin_submission_id}, start_date=${task.start_date}, end_date=${task.end_date}, assigned_users=${JSON.stringify(task.assigned_users)}, assignee_names=${JSON.stringify(task.assignee_names)}, task_name=${task.task_name || task.form_title}, ALL_KEYS=${Object.keys(task).join(',')}`);
      });

      const isWithinTaskDateWindow = (task: any): boolean => {
        const currentDate = new Date();
        const currentDateOnly = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
        );

        if (task.start_date) {
          const taskStartDate = new Date(task.start_date);
          const taskStartDateOnly = new Date(
            taskStartDate.getFullYear(),
            taskStartDate.getMonth(),
            taskStartDate.getDate(),
          );
          if (currentDateOnly < taskStartDateOnly) {
            return false;
          }
        }

        if (task.end_date) {
          const taskEndDate = new Date(task.end_date);
          const taskEndDateOnly = new Date(
            taskEndDate.getFullYear(),
            taskEndDate.getMonth(),
            taskEndDate.getDate(),
          );
          if (currentDateOnly > taskEndDateOnly) {
            return false;
          }
        }

        return true;
      };

      const activeTasks = allTasks.filter((task: any) => {
        // Follow-up tasks should stay stored, but disappear from New once their deadline window is over.
        if (task.derived_status) {
          // For follow-up tasks, show only if current user is an assignee
          if (!isUserAssignedToTask(task)) {
            console.log(`[TodoNew] FILTERED OUT task ${task.id}: not assigned to current user. assigned_users=${JSON.stringify(task.assigned_users)}, assignee_names=${JSON.stringify(task.assignee_names)}`);
            return false;
          }
          const followupStatus = String(task.derived_status || task.status || '').toLowerCase();
          // In NEW tab, hide completed followup tasks
          if (followupStatus === 'completed') {
            console.log(`[TodoNew] FILTERED OUT task ${task.id}: followup completed`);
            return false;
          }
          if (!isWithinTaskDateWindow(task)) {
            console.log(`[TodoNew] FILTERED OUT task ${task.id}: outside date window. start_date=${task.start_date}, end_date=${task.end_date}`);
            return false;
          }
          console.log(`[TodoNew] INCLUDED task ${task.id}: followup task, status=${followupStatus}`);
          return true;
        }

        if (!isWithinTaskDateWindow(task)) {
          console.log(`[TodoNew] FILTERED OUT task ${task.id}: outside date window. start_date=${task.start_date}, end_date=${task.end_date}`);
          return false;
        }
        console.log(`[TodoNew] INCLUDED task ${task.id}: regular task, status=${task.status}`);
        return true;
      });

      // Remove duplicates (in case API returns duplicates)
      const uniqueTasks = activeTasks.filter((task: any, index: number, self: any[]) =>
        index === self.findIndex((t: any) => t.id === task.id)
      );
      if (activeTasks.length !== uniqueTasks.length) {
        console.log(`[TodoNew] Removed ${activeTasks.length - uniqueTasks.length} duplicate tasks`);
      }

      // Sort tasks: followup tasks first (by creation date, newest first), then regular tasks
      const sortedTasks = uniqueTasks.sort((a: any, b: any) => {
        // Check if task is a followup task (has derived_status)
        const aIsFollowup = !!a.derived_status;
        const bIsFollowup = !!b.derived_status;

        // Followup tasks come first
        if (aIsFollowup && !bIsFollowup) return -1;
        if (!aIsFollowup && bIsFollowup) return 1;

        // Within the same type (both followup or both regular), sort by creation date (newest first)
        const aDate = new Date(a.created_on || a.start_date || 0);
        const bDate = new Date(b.created_on || b.start_date || 0);
        return bDate.getTime() - aDate.getTime(); // Newest first
      });

      sortedTasks.forEach((task: any, index: number) => {
        const startDate = task.start_date ? new Date(task.start_date).toLocaleDateString() : 'No start date';
        const endDate = task.end_date ? new Date(task.end_date).toLocaleDateString() : 'No end date';
      });

      sortedTasks.forEach((task: any) => {
      });
      
      const enrichedTasks = await Promise.all(
        sortedTasks.map(async (task: any) => {
          const mainFormId = getMainFormId(task);
          const isFollowupTask = !!task?.derived_status;
          let mainFormTitle = getMainFormTitleFromTask(task);
          let taskFormTypeLabel = getTaskFormType(task);
          let taskDetails: any = null;

          // Use form metadata from task response instead of fetching full form
          if (mainFormId) {
            if (!mainFormTitle) {
              mainFormTitle = task?.followup_form_title || null;
            }
            const mainFormType = task?.followup_form_type || "";
            if (mainFormType) {
              const normalized = String(mainFormType).toLowerCase();
              if (normalized.includes("audit")) taskFormTypeLabel = "Audit";
              else if (normalized.includes("location")) taskFormTypeLabel = "Location";
              else if (normalized.includes("standard")) taskFormTypeLabel = "Standard";
            }
          }

          const assignedFormId = task?.form != null ? String(task.form) : null;
          let assignedFormHasLocationQuestion = false;
          if (assignedFormId) {
            assignedFormHasLocationQuestion = !!task?.has_location_question;

            // Update form type label from the assigned form's metadata
            const assignedFormType = task?.assigned_form_type || task?.form_type || "";
            if (assignedFormType) {
              const normalizedAssigned = String(assignedFormType).toLowerCase();
              if (normalizedAssigned.includes("audit")) taskFormTypeLabel = "Audit";
              else if (normalizedAssigned.includes("location")) taskFormTypeLabel = "Location";
              else if (normalizedAssigned.includes("standard")) taskFormTypeLabel = "Standard";
            }
          }

          const mainFormHasLocationQuestion = mainFormId
            ? !!task?.has_location_question
            : false;

          const initialStartDate = getActualStartDateTime(task);
          if (!initialStartDate || isFollowupTask) {
            const taskId = String(task.id);
            taskDetails = await getTaskDetails(taskId);
          }

          // Extract form IDs from taskDetails as fallbacks for followup tasks
          const fallbackFormId = taskDetails?.form != null ? String(taskDetails.form) : null;
          const fallbackFollowupFormId = taskDetails?.followup_task_form_id;
          const fallbackMainFormId = fallbackFollowupFormId
            ? (typeof fallbackFollowupFormId === "object"
              ? (fallbackFollowupFormId?.id ? String(fallbackFollowupFormId.id) : null)
              : String(fallbackFollowupFormId))
            : null;

          const finalAssignedFormId = assignedFormId || fallbackFormId;
          const finalMainFormId = mainFormId || fallbackMainFormId;

          if (isFollowupTask) {
            console.log(`[TodoNew] Followup task ${task.id}: assignedFormId=${assignedFormId}, fallbackFormId=${fallbackFormId}, finalAssignedFormId=${finalAssignedFormId}, mainFormId=${mainFormId}, fallbackMainFormId=${fallbackMainFormId}, finalMainFormId=${finalMainFormId}, taskDetailsKeys=${taskDetails ? Object.keys(taskDetails).join(',') : 'null'}`);
          }

          return {
            ...task,
            main_form_title: mainFormTitle,
            main_form_location:
              taskDetails?.main_form_location ||
              task?.main_form_location ||
              null,
            task_form_type_label: taskFormTypeLabel,
            assigned_form_id: finalAssignedFormId,
            main_form_id: finalMainFormId,
            actual_start_date_time: getActualStartDateTime(task, taskDetails),
            has_location_question:
              assignedFormHasLocationQuestion || mainFormHasLocationQuestion,
          };
        })
      );

      setTasks(enrichedTasks);
      console.log(`[TodoNew] Final: ${enrichedTasks.length} tasks set to state. IDs: [${enrichedTasks.map(t => t.id).join(', ')}]`);
    } catch (error: any) {
      console.log(`[TodoNew] fetchTasks ERROR: ${error?.message || error?.status || 'unknown'}`);

      // Show user-friendly error message for different error types
      if (error?.status === 500) {
      } else if (error?.status === 401) {
      } else if (error?.status === 403) {
      }

      // Show error in UI
      setTasks([]); // Ensure empty state
    } finally {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
      if (didShowLoader) setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [isFocused]);

  // 🔄 AUTO-REFRESH: Refresh tasks whenever this tab/screen comes into focus
  // This ensures updated task statuses are displayed when user returns from TaskSummaryScreen
  useFocusEffect(
    useCallback(() => {
      // Clear cache to ensure fresh data after starting a task
      Object.keys(TASK_DETAILS_CACHE).forEach(key => delete TASK_DETAILS_CACHE[key]);
      fetchTasks({ delayedLoader: true });

      return () => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
          loaderTimeoutRef.current = null;
        }
      };
    }, [isFocused])
  );

  // Listen for stage submission events to refresh NEW tab
  useEffect(() => {
    const handleStageSubmitted = (event: any) => {
      if (!isFocused) return;
      // Refresh the NEW tab to show updated task status (e.g., completed tasks, remaining stages)
      fetchTasks();
    };

    const handleTaskStatusChanged = (event: any) => {
      if (!isFocused) return;
      // Add a small delay to ensure the backend has processed the change
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        if (!isFocused) return;
        fetchTasks().then(() => {
        }).catch((error) => {
        });
      }, 500);
    };

    // Add event listeners for custom events
    if (window.addEventListener) {
      window.addEventListener('todoStageSubmitted', handleStageSubmitted);
      window.addEventListener('taskStatusChanged', handleTaskStatusChanged);
    }

    // Cleanup
    return () => {
      if (window.removeEventListener) {
        window.removeEventListener('todoStageSubmitted', handleStageSubmitted);
        window.removeEventListener('taskStatusChanged', handleTaskStatusChanged);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [isFocused]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  }, []);

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

  const matchesStatus = (task: any, statuses: TodoFilters["status"]) => {
    if (statuses.includes("all")) return true;
    const effectiveStatus = String(task.status || task.derived_status || "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_");
    const compactStatus = effectiveStatus.replace(/_/g, "");
    const hasStarted = task.has_started === true;
    const isCompleted = compactStatus.includes("completed");
    const isExplicitNotStarted =
      compactStatus === "notstarted" ||
      compactStatus === "notassigned";
    const isPending =
      !isExplicitNotStarted &&
      !isCompleted &&
      (compactStatus === "pending" ||
        compactStatus === "inprogress" ||
        (hasStarted && !isCompleted));
    const isNotStarted =
      (isExplicitNotStarted || task.has_started === false) &&
      !isPending &&
      !isCompleted;

    if (statuses.includes("not_started") && isNotStarted) return true;
    if (statuses.includes("pending") && isPending) return true;
    return false;
  };

  const isRangeOverlap = (
    itemStart: Date | null,
    itemEnd: Date | null,
    filterStart: Date | null,
    filterEnd: Date | null
  ) => {
    if (!filterStart && !filterEnd) return true;
    const start = itemStart || itemEnd;
    const end = itemEnd || itemStart;
    if (!start || !end) return false;
    if (filterStart && end < filterStart) return false;
    if (filterEnd && start > filterEnd) return false;
    return true;
  };

  const getLocationText = (task: any) => {
    const candidates = [
      task.location_name,
      task.location_title,
      task.location,
      task.site_name,
      task.area_name,
      task.plant_name,
      task.department_name,
      task.department?.name,
      task.location?.name,
      task.location?.title,
    ];

    const directLocationText = candidates
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).toLowerCase())
      .join(" ");
    const questionLocationText = extractLocationSearchText(task);

    return [directLocationText, questionLocationText].filter(Boolean).join(" ");
  };

  const filteredTasks = useMemo(() => {
    const {
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
      startDate,
      endDate,
      statuses,
      toDateOnly,
      sort,
    } = normalizedFilters;
    const filtered = tasks.filter((task) => {
      const title = String(task.task_name || task.form_title || "");
      if (query && !title.toLowerCase().includes(query)) {
        return false;
      }

      if (locations.length > 0) {
        const locationText = getLocationText(task);
        const taskNameText = title.toLowerCase();
        const matchesAnyLocation = locations.some((loc) => {
          const lowerLoc = loc.toLowerCase();
          return (
            (!!locationText && locationText.includes(lowerLoc)) ||
            taskNameText.includes(lowerLoc)
          );
        });
        if (!matchesAnyLocation) {
          return false;
        }
      }

      if (mainForms.length > 0) {
        const taskMainForm = String(task.main_form_title || "").trim().toLowerCase();
        const matchesAnyMainForm = mainForms.some((mf) => {
          const lowerMf = mf.toLowerCase();
          return taskMainForm.includes(lowerMf);
        });
        if (!matchesAnyMainForm) {
          return false;
        }
      }

      if (!formTypes.includes("all")) {
        const rawFormType = String(
          task?.task_form_type_label ||
            task?.form_type ||
            task?.assigned_form_type ||
            task?.form?.form_type ||
            ""
        ).toLowerCase();
        const normalizedTaskFormType = rawFormType.includes("audit")
          ? "audit"
          : "standard";
        if (!formTypes.includes(normalizedTaskFormType)) {
          return false;
        }
      }

      if (!taskTypes.includes("all")) {
        const isFollowup = !!task.derived_status;
        if (taskTypes.includes("followup") && !isFollowup) return false;
        if (taskTypes.includes("normal") && isFollowup) return false;
      }

      if (reopened && !task.reopened_remarks) return false;

      if (aging !== "all") {
        const days = task.task_age_days != null ? task.task_age_days : null;
        if (days == null) return false;
        if (aging === "today" && days !== 0) return false;
        if (aging === "1-7" && (days < 1 || days > 7)) return false;
        if (aging === "8-30" && (days < 8 || days > 30)) return false;
        if (aging === "30+" && days < 31) return false;
      }

      if (questions.length > 0) {
        const taskQuestion = String(task.parent_question || "").trim();
        if (!taskQuestion || !questions.includes(taskQuestion)) return false;
      }

      if (taskIds.length > 0) {
        const prefix = task?.form_prefix || "NPX";
        const taskIdStr = `${prefix}-${task.id}`;
        const rawIdStr = String(task.id);
        if (!taskIds.includes(taskIdStr) && !taskIds.includes(rawIdStr)) {
          return false;
        }
      }

      if (responseIds.length > 0) {
        const subId = task.submission_id != null ? String(task.submission_id) : "";
        const mainSubId = task.main_form_submission_id != null ? String(task.main_form_submission_id) : "";
        const prefix = task?.form_prefix || "NPX";
        const responseIdStr = subId ? `${prefix}-${subId}` : "";
        // Match prefixed format (used by filter UI) OR raw submission ID (used by Forms Sent chip navigation)
        const matchesPrefixed = !!responseIdStr && responseIds.includes(responseIdStr);
        const matchesRaw = responseIds.some(r => r === subId || r === mainSubId);
        if (!matchesPrefixed && !matchesRaw) {
          return false;
        }
      }

      const taskStart = toDateOnly(task.start_date) || toDateOnly(task.created_on);
      const taskEnd = toDateOnly(task.end_date) || taskStart;
      if (!isRangeOverlap(taskStart, taskEnd, startDate, endDate)) {
        return false;
      }

      if (!matchesStatus(task, statuses)) {
        return false;
      }

      return true;
    });

    if (sort === "default") return filtered;

    const getTaskStartTime = (task: any) => {
      const raw = task.start_date || task.actual_start_date_time || task.created_on || task.end_date;
      const time = new Date(raw || 0).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const getTaskTitle = (task: any) => String(task.task_name || task.form_title || "").toLowerCase();

    const sorted = [...filtered];
    if (sort === "newest") {
      sorted.sort((a, b) => getTaskStartTime(b) - getTaskStartTime(a));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => getTaskStartTime(a) - getTaskStartTime(b));
    } else if (sort === "az") {
      sorted.sort((a, b) => getTaskTitle(a).localeCompare(getTaskTitle(b)));
    }

    return sorted;
  }, [tasks, normalizedFilters]);

  // Cross-filtering: filter tasks by all active filters EXCEPT the specified category
  const getCrossFilteredTasks = (exclude: "location" | "mainForm" | "taskId" | "responseId" | "question") => {
    const {
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
      startDate,
      endDate,
      statuses,
      toDateOnly,
    } = normalizedDraftFilters;

    return tasks.filter((task) => {
      const title = String(task.task_name || task.form_title || "");
      if (query && !title.toLowerCase().includes(query)) return false;

      if (exclude !== "location" && locations.length > 0) {
        const locationText = getLocationText(task);
        const taskNameText = title.toLowerCase();
        const matchesAnyLocation = locations.some((loc) => {
          const lowerLoc = loc.toLowerCase();
          return (
            (!!locationText && locationText.includes(lowerLoc)) ||
            taskNameText.includes(lowerLoc)
          );
        });
        if (!matchesAnyLocation) return false;
      }

      if (exclude !== "mainForm" && mainForms.length > 0) {
        const taskMainForm = String(task.main_form_title || "").trim().toLowerCase();
        const matchesAnyMainForm = mainForms.some((mf) => taskMainForm.includes(mf.toLowerCase()));
        if (!matchesAnyMainForm) return false;
      }

      if (!formTypes.includes("all")) {
        const rawFormType = String(
          task?.task_form_type_label ||
            task?.form_type ||
            task?.assigned_form_type ||
            task?.form?.form_type ||
            ""
        ).toLowerCase();
        const normalizedTaskFormType = rawFormType.includes("audit") ? "audit" : "standard";
        if (!formTypes.includes(normalizedTaskFormType)) return false;
      }

      if (!taskTypes.includes("all")) {
        const isFollowup = !!task.derived_status;
        if (taskTypes.includes("followup") && !isFollowup) return false;
        if (taskTypes.includes("normal") && isFollowup) return false;
      }

      if (reopened && !task.reopened_remarks) return false;

      if (aging !== "all") {
        const days = task.task_age_days != null ? task.task_age_days : null;
        if (days == null) return false;
        if (aging === "today" && days !== 0) return false;
        if (aging === "1-7" && (days < 1 || days > 7)) return false;
        if (aging === "8-30" && (days < 8 || days > 30)) return false;
        if (aging === "30+" && days < 31) return false;
      }

      if (exclude !== "question" && questions.length > 0) {
        const taskQuestion = String(task.parent_question || "").trim();
        if (!taskQuestion || !questions.includes(taskQuestion)) return false;
      }

      if (exclude !== "taskId" && taskIds.length > 0) {
        const prefix = task?.form_prefix || "NPX";
        const taskIdStr = `${prefix}-${task.id}`;
        if (!taskIds.includes(taskIdStr)) return false;
      }

      if (exclude !== "responseId" && responseIds.length > 0) {
        const subId = task.submission_id != null ? String(task.submission_id) : "";
        const prefix = task?.form_prefix || "NPX";
        const responseIdStr = subId ? `${prefix}-${subId}` : "";
        if (!responseIdStr || !responseIds.includes(responseIdStr)) return false;
      }

      const taskStart = toDateOnly(task.start_date) || toDateOnly(task.created_on);
      const taskEnd = toDateOnly(task.end_date) || taskStart;
      if (!isRangeOverlap(taskStart, taskEnd, startDate, endDate)) return false;

      if (!matchesStatus(task, statuses)) return false;

      return true;
    });
  };

  useEffect(() => {
    const crossFiltered = getCrossFilteredTasks("location");
    const options = Array.from(
      new Set(
        crossFiltered
          .filter((task: any) => task?.has_location_question)
          .flatMap((task: any) => [
            task?.main_form_location,
            task?.location_name,
            task?.location_title,
            task?.site_name,
            task?.area_name,
            task?.plant_name,
            task?.department_name,
            task?.location?.name,
            task?.location?.title,
            task?.location_details?.name,
            task?.location_details?.description,
          ])
          .map((value: any) => String(value || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onLocationOptionsChange?.(options);
  }, [tasks, normalizedDraftFilters, onLocationOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredTasks("mainForm");
    const options = Array.from(
      new Set(
        crossFiltered
          .map((task: any) => String(task?.main_form_title || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onMainFormOptionsChange?.(options);
  }, [tasks, normalizedDraftFilters, onMainFormOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredTasks("taskId");
    const options = Array.from(
      new Set(
        crossFiltered
          .map((task: any) => {
            const prefix = task?.form_prefix || "NPX";
            return `${prefix}-${task?.id}`;
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onTaskIdOptionsChange?.(options);
  }, [tasks, normalizedDraftFilters, onTaskIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredTasks("responseId");
    const options = Array.from(
      new Set(
        crossFiltered
          .map((task: any) => {
            const subId = task?.submission_id != null ? String(task.submission_id) : "";
            if (!subId) return "";
            const prefix = task?.form_prefix || "NPX";
            return `${prefix}-${subId}`;
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    onResponseIdOptionsChange?.(options);
  }, [tasks, normalizedDraftFilters, onResponseIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredTasks("question");
    const options = Array.from(
      new Set(
        crossFiltered
          .map((task: any) => task?.parent_question)
          .filter((q: any) => q && String(q).trim())
      )
    ).sort((a, b) => a.localeCompare(b));
    onQuestionOptionsChange?.(options);
  }, [tasks, normalizedDraftFilters, onQuestionOptionsChange]);

  const handleTaskPress = async (task: any) => {
    // Check if this is a follow-up task (has derived_status)
    if (task.derived_status) {
      try {
        const taskResponse = await Api.get(`/tasks/${task.id}/`);
        const taskDetails = taskResponse as any;
        // Followup task form should come from task.form (or assigned_form_id if provided)
        const followupFormId =
          taskDetails.form?.toString() ||
          taskDetails.assigned_form_id?.toString() ||
          task.form?.toString();
        const mainFormId = taskDetails.followup_task_form_id?.toString() || task.followup_task_form_id?.toString();
        // Always navigate to TaskSummaryScreen, even if formId is undefined
        // TaskSummaryScreen will handle the case where formId is not available
        router.push({
          pathname: '/(app)/screens/TaskSummaryScreen',
          params: {
            taskId: task.id.toString(),
            formId: followupFormId,
            mainFormId: mainFormId,
            returnTab: 'new'
          }
        });
      } catch (error) {
        // Fallback to original logic
        const followupFormId =
          task.form?.toString() ||
          task.assigned_form_id?.toString();
        const mainFormId = task.followup_task_form_id?.toString();
        if (!followupFormId) {
          Alert.alert('Error', 'No form is associated with this task');
          return;
        }
        router.push({
          pathname: '/(app)/screens/TaskSummaryScreen',
          params: {
            taskId: task.id.toString(),
            formId: followupFormId,
            mainFormId: mainFormId,
            returnTab: 'new'
          }
        });
      }
    } else {
      // Regular task - navigate to TaskSummaryScreen for start/complete flow
      const formId = task.form?.toString() || task.assigned_form_id?.toString();
      router.push({
        pathname: '/(app)/screens/TaskSummaryScreen',
        params: {
          taskId: task.id.toString(),
          formId: formId,
          returnTab: 'new'
        }
      });
    }
  };

  const handleShareClick = async (task: any) => {
    setShareTask(task);
    setShareDialogVisible(true);
    setSelectedShareUsers([]);
    setSelectedShareGroups([]);
    setShareTab("users");
    try {
      const [usersRes, groupsRes] = await Promise.all([
        Api.get("/users/list") as any,
        Api.get("/groups/") as any,
      ]);
      setShareUsers(usersRes?.data || usersRes || []);
      setShareGroups(groupsRes?.data || groupsRes || []);
    } catch (error) {
      console.error("Error fetching share options:", error);
    }
  };

  const handleShareSubmit = async () => {
    if (!shareTask) return;
    if (selectedShareUsers.length === 0 && selectedShareGroups.length === 0) {
      Alert.alert("Error", "Select at least one user or group");
      return;
    }
    try {
      setIsSharing(true);
      await Api.post(`/tasks/${shareTask.id}/share/`, {
        users: selectedShareUsers,
        groups: selectedShareGroups,
      });
      Alert.alert("Success", "Task shared successfully");
      setShareDialogVisible(false);
      setShareTask(null);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to share task");
    } finally {
      setIsSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assigned Tasks</Text>
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TaskList item={item} onTaskPress={handleTaskPress} onSharePress={handleShareClick} />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            You do not have any assigned forms.
          </Text>
        }
      />

      {/* Share Dialog */}
      <Modal
        visible={shareDialogVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShareDialogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Task</Text>
            <Text style={styles.modalSubtitle}>
              Share{" "}
              <Text style={{ fontWeight: "700" }}>
                {shareTask?.form_prefix ? `${shareTask.form_prefix}-${shareTask.id}` : `NPX-${shareTask?.id}`}
              </Text>{" "}
              with users or groups.
            </Text>

            {/* Share tabs */}
            <View style={styles.shareTabContainer}>
              <TouchableOpacity
                style={[styles.shareTab, shareTab === "users" && styles.shareTabActive]}
                onPress={() => setShareTab("users")}
              >
                <Text style={[styles.shareTabText, shareTab === "users" && styles.shareTabTextActive]}>Users</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareTab, shareTab === "groups" && styles.shareTabActive]}
                onPress={() => setShareTab("groups")}
              >
                <Text style={[styles.shareTabText, shareTab === "groups" && styles.shareTabTextActive]}>Groups</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {shareTab === "users" && (
                shareUsers.length === 0 ? (
                  <Text style={styles.shareEmptyText}>No users available</Text>
                ) : shareUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.shareItem}
                    onPress={() => {
                      if (selectedShareUsers.includes(u.id)) {
                        setSelectedShareUsers(selectedShareUsers.filter(id => id !== u.id));
                      } else {
                        setSelectedShareUsers([...selectedShareUsers, u.id]);
                      }
                    }}
                  >
                    <View style={[styles.checkboxOuter, selectedShareUsers.includes(u.id) && styles.checkboxOuterSelected]}>
                      {selectedShareUsers.includes(u.id) && <Icon name="check" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.shareItemText}>{u.name || u.username || `${u.first_name || ""} ${u.last_name || ""}`.trim()}</Text>
                  </TouchableOpacity>
                ))
              )}
              {shareTab === "groups" && (
                shareGroups.length === 0 ? (
                  <Text style={styles.shareEmptyText}>No groups available</Text>
                ) : shareGroups.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.shareItem}
                    onPress={() => {
                      if (selectedShareGroups.includes(g.id)) {
                        setSelectedShareGroups(selectedShareGroups.filter(id => id !== g.id));
                      } else {
                        setSelectedShareGroups([...selectedShareGroups, g.id]);
                      }
                    }}
                  >
                    <View style={[styles.checkboxOuter, selectedShareGroups.includes(g.id) && styles.checkboxOuterSelected]}>
                      {selectedShareGroups.includes(g.id) && <Icon name="check" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.shareItemText}>{g.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShareDialogVisible(false)}
                disabled={isSharing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmitButton]}
                onPress={handleShareSubmit}
                disabled={isSharing}
              >
                <Text style={styles.modalSubmitText}>
                  {isSharing ? "Sharing..." : "Share"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 50,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  shareTabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 12,
  },
  shareTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  shareTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2196f3",
  },
  shareTabText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  shareTabTextActive: {
    color: "#2196f3",
    fontWeight: "700",
  },
  shareEmptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 20,
  },
  shareItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  shareItemText: {
    fontSize: 14,
    color: "#111827",
    marginLeft: 8,
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOuterSelected: {
    borderColor: "#2196f3",
    backgroundColor: "#2196f3",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelButton: {
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitButton: {
    backgroundColor: "#2196f3",
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default NewTodo;




