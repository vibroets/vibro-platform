import Accordion from "@/components/Accordion";
import { ALL_LOCATION_TASKS_FILTER } from "@/constants/forms";
import api, { get as apiGet } from "@/services";
import { USER_COMPLETED_TASKS } from "@/services/constants";
import { RootState } from "@/store";
import { SubmissionData } from "@/types/sent";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useSelector } from "react-redux";
import FileList from "../../../(app)/(tabs)/forms/ListItems/SentListItems/FileList";
import type { TodoFilters } from "../todo-tabs";
import { extractLocationSearchText, hasLocationQuestion } from "./locationFilterUtils";

const SLOW_REFRESH_LOADER_DELAY_MS = 400;

interface SelectedForm {
  formId: string;
  taskId: string;
  submissionId?: string;
  formTitle?: string;
  formType?: string;
  sourceScreen?: string;
}

interface SentTodoProps {
  onFormSelect?: (formData: SelectedForm) => void;
  filters?: TodoFilters;
  draftFilters?: TodoFilters;
  onLocationOptionsChange?: (options: string[]) => void;
  onMainFormOptionsChange?: (options: string[]) => void;
  onTaskIdOptionsChange?: (options: string[]) => void;
  onResponseIdOptionsChange?: (options: string[]) => void;
  onQuestionOptionsChange?: (options: string[]) => void;
}

type SentTabKey = "form" | "task_close";
type MainFormTaskMeta = {
  id: string;
  title: string;
  form_type?: string;
  prefix?: string;
  main_form_location?: string;
};

const MAIN_FORM_BY_TASK_CACHE: Record<string, MainFormTaskMeta> = {};
const NO_MAIN_FORM_TASK_IDS = new Set<string>();


export default function SentTodo({
  onFormSelect,
  filters,
  draftFilters,
  onLocationOptionsChange,
  onMainFormOptionsChange,
  onTaskIdOptionsChange,
  onResponseIdOptionsChange,
  onQuestionOptionsChange,
}: SentTodoProps) {
  const user = useSelector((state: RootState) => state.user);
  const [loading, setLoading] = useState<boolean>(false);
  const [sentData, setSentData] = useState<SubmissionData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [accordionRowHeight, setAccordionRowHeight] = useState(70);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SentTabKey>("form");
  const [mainFormByTaskId, setMainFormByTaskId] = useState<Record<string, MainFormTaskMeta>>(MAIN_FORM_BY_TASK_CACHE);
  const isFocused = useIsFocused();
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTaskCloseSubmission = (submission: SubmissionData["submissions"][number]) => {
    const submissionType = String(submission.submission_type ?? "").toLowerCase();
    return submissionType.includes("task-close") || submissionType.includes("task close");
  };

  const isFollowupSubmission = (submission: SubmissionData["submissions"][number]) => {
    const submissionType = String(submission.submission_type ?? "").toLowerCase();
    return (
      submissionType.includes("followup") ||
      submission.can_reopen === true ||
      !!submission.is_followup_task ||
      !!submission.is_followup ||
      !!submission.followup_task_id ||
      !!(submission as any).task_id
    );
  };

  const isOnlyTaskCloseSubmission = (submission: SubmissionData["submissions"][number], groupFormId: string) => {
    if (!isTaskCloseSubmission(submission)) return false;
    const taskIdRaw = (submission as any)?.task_id ?? (submission as any)?.followup_task_id;
    if (!taskIdRaw) return true;
    const mainForm = mainFormByTaskId[String(taskIdRaw)];
    if (!mainForm?.id) return true;
    return String(mainForm.id) === String(groupFormId);
  };

  const getSubmissionTime = (submission?: SubmissionData["submissions"][number]) => {
    if (!submission) return 0;
    const raw = submission.completed_on || submission.submission_initiated_on || "";
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

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

  const getNormalizedFormType = useCallback((raw?: string) => {
    const normalized = String(raw || "").toLowerCase();
    if (normalized.includes("audit")) return "audit" as const;
    return "standard" as const;
  }, []);

  const getEffectiveFormTypeFromGroup = useCallback(
    (group: SubmissionData) => {
      const candidates: string[] = [];
      const push = (value: any) => {
        const text = String(value || "").trim();
        if (text) candidates.push(text);
      };

      push(group?.form?.form_type);
      push((group as any)?.form_type);
      push((group as any)?.form?.form_type);

      (group?.submissions || []).forEach((submission: any) => {
        push(submission?.form_type);
        push(submission?.form?.form_type);
        push(submission?.form_details?.form_type);
      });

      const normalizedValues = candidates.map((value) => value.toLowerCase());
      if (normalizedValues.some((value) => value.includes("audit"))) return "audit" as const;
      if (normalizedValues.some((value) => value.includes("standard"))) return "standard" as const;
      return getNormalizedFormType(candidates[0]);
    },
    [getNormalizedFormType]
  );

  const applyGroupSort = useCallback(
    (groups: SubmissionData[]) => {
      const sort = normalizedFilters.sort;
      if (sort === "default") return groups;

      const getGroupStartTime = (group: SubmissionData) => {
        const times = (group.submissions || [])
          .map((submission: any) => {
            const raw =
              submission.start_date ||
              submission.submission_initiated_on ||
              submission.completed_on ||
              submission.created_on ||
              submission.created_at;
            const time = new Date(raw || 0).getTime();
            return Number.isFinite(time) ? time : 0;
          })
          .filter((time) => time > 0);
        return times.length ? Math.max(...times) : 0;
      };

      const getGroupTitle = (group: SubmissionData) => String(group.form?.title || "").toLowerCase();

      const sorted = [...groups];
      if (sort === "newest") {
        sorted.sort((a, b) => getGroupStartTime(b) - getGroupStartTime(a));
      } else if (sort === "oldest") {
        sorted.sort((a, b) => getGroupStartTime(a) - getGroupStartTime(b));
      } else if (sort === "az") {
        sorted.sort((a, b) => getGroupTitle(a).localeCompare(getGroupTitle(b)));
      }

      return sorted;
    },
    [normalizedFilters.sort]
  );

  const getSubmissionLocationText = (submission: any) => {
    const taskId = submission?.task_id != null ? String(submission.task_id) : "";
    const taskMeta = taskId ? mainFormByTaskId[taskId] : undefined;
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

    const directLocationText = candidates
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).toLowerCase())
      .join(" ");
    const questionLocationText = extractLocationSearchText(submission);

    return [directLocationText, questionLocationText].filter(Boolean).join(" ");
  };

  const submissionHasLocationData = useCallback((submission: any) => {
    if (hasLocationQuestion(submission)) return true;
    const taskId = submission?.task_id != null ? String(submission.task_id) : "";
    const taskMeta = taskId ? mainFormByTaskId[taskId] : undefined;

    const directCandidates = [
      taskMeta?.main_form_location,
      submission?.main_form_location,
      submission?.location_name,
      submission?.location_title,
      submission?.location,
      submission?.site_name,
      submission?.area_name,
      submission?.plant_name,
      submission?.department_name,
      submission?.department?.name,
      submission?.location?.name,
      submission?.location?.title,
      submission?.location_details?.name,
      submission?.location_details?.description,
    ];

    return directCandidates.some(
      (value) => typeof value === "string" && value.trim().length > 0
    );
  }, [mainFormByTaskId]);

  const filterSubmissions = useCallback(
    (submissions: SubmissionData["submissions"]) => {
      const { locations, startDate, endDate, toDateOnly, taskTypes, taskIds, responseIds, reopened } =
        normalizedFilters;
      return submissions.filter((submission) => {
        if (locations.length > 0) {
          const locationText = getSubmissionLocationText(submission);
          const taskOrFormTitle = String(
            submission.task_name || (submission as any).form_title || ""
          ).toLowerCase();
          const matchesAnyLocation = locations.some((loc) => {
            const lowerLoc = loc.toLowerCase();
            return (
              (!!locationText && locationText.includes(lowerLoc)) ||
              taskOrFormTitle.includes(lowerLoc)
            );
          });
          if (!matchesAnyLocation) {
            return false;
          }
        }

        if (!taskTypes.includes("all")) {
          const isFollowup = isFollowupSubmission(submission);
          if (taskTypes.includes("followup") && !isFollowup) return false;
          if (taskTypes.includes("normal") && isFollowup) return false;
        }

        if (taskIds.length > 0) {
          const prefix = (submission as any)?.form_prefix || "NPX";
          const submissionTaskId = `${prefix}-${submission?.task_id || ""}`;
          if (!taskIds.includes(submissionTaskId)) {
            return false;
          }
        }

        if (responseIds.length > 0) {
          const prefix = (submission as any)?.form_prefix || "NPX";
          const subId = submission?.submission_id != null ? String(submission.submission_id) : (submission?.id != null ? String(submission.id) : "");
          const responseIdStr = subId ? `${prefix}-${subId}` : "";
          if (!responseIdStr || !responseIds.includes(responseIdStr)) {
            return false;
          }
        }

        if (reopened && !(submission as any)?.reopened_remarks) return false;

        const dateValue = submission.completed_on || submission.submission_initiated_on;
        const dateOnly = toDateOnly(dateValue);
        if ((startDate || endDate) && !dateOnly) return false;
        if (startDate && dateOnly && dateOnly < startDate) return false;
        if (endDate && dateOnly && dateOnly > endDate) return false;
        return true;
      });
    },
    [normalizedFilters, submissionHasLocationData]
  );

  const getCrossFilteredSubmissions = useCallback(
    (exclude: "location" | "mainForm" | "taskId" | "responseId" | "question") => {
      const {
        locations,
        mainForms,
        taskTypes,
        taskIds,
        responseIds,
        reopened,
        startDate,
        endDate,
        toDateOnly,
      } = normalizedDraftFilters;

      const allSubs: any[] = [];
      sentData.forEach((item) => {
        (item.submissions || []).forEach((sub: any) => allSubs.push({ sub, group: item }));
      });

      return allSubs.filter(({ sub }) => {
        if (exclude !== "location" && locations.length > 0) {
          const locationText = getSubmissionLocationText(sub);
          const taskOrFormTitle = String(sub.task_name || (sub as any).form_title || "").toLowerCase();
          const matchesAnyLocation = locations.some((loc) => {
            const lowerLoc = loc.toLowerCase();
            return (!!locationText && locationText.includes(lowerLoc)) || taskOrFormTitle.includes(lowerLoc);
          });
          if (!matchesAnyLocation) return false;
        }

        if (!taskTypes.includes("all")) {
          const isFollowup = isFollowupSubmission(sub);
          if (taskTypes.includes("followup") && !isFollowup) return false;
          if (taskTypes.includes("normal") && isFollowup) return false;
        }

        if (exclude !== "taskId" && taskIds.length > 0) {
          const prefix = (sub as any)?.form_prefix || "NPX";
          const submissionTaskId = `${prefix}-${sub?.task_id || ""}`;
          if (!taskIds.includes(submissionTaskId)) return false;
        }

        if (exclude !== "responseId" && responseIds.length > 0) {
          const prefix = (sub as any)?.form_prefix || "NPX";
          const subId = sub?.submission_id != null ? String(sub.submission_id) : (sub?.id != null ? String(sub.id) : "");
          const responseIdStr = subId ? `${prefix}-${subId}` : "";
          if (!responseIdStr || !responseIds.includes(responseIdStr)) return false;
        }

        if (reopened && !(sub as any)?.reopened_remarks) return false;

        const dateValue = sub.completed_on || sub.submission_initiated_on;
        const dateOnly = toDateOnly(dateValue);
        if ((startDate || endDate) && !dateOnly) return false;
        if (startDate && dateOnly && dateOnly < startDate) return false;
        if (endDate && dateOnly && dateOnly > endDate) return false;

        if (exclude !== "mainForm" && mainForms.length > 0) {
          const groupTitle = String((sub as any)?.form_title || (sub as any)?.form?.title || "").toLowerCase();
          const taskId = sub?.task_id != null ? String(sub.task_id) : "";
          const taskMeta = taskId ? mainFormByTaskId[taskId] : undefined;
          const mainFormTitle = String(taskMeta?.title || "").toLowerCase();
          const matchesAnyMainForm = mainForms.some((mf) => groupTitle.includes(mf.toLowerCase()) || mainFormTitle.includes(mf.toLowerCase()));
          if (!matchesAnyMainForm) return false;
        }

        return true;
      });
    },
    [normalizedDraftFilters, sentData, submissionHasLocationData, mainFormByTaskId]
  );


  const getCompletedTasks = useCallback(async (showLoader = true, delayedLoader = false) => {
    let didShowLoader = false;
    try {
      if (showLoader) {
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
      }
      const response = await api.get(`${USER_COMPLETED_TASKS}${user.id}/`);

      let rawData = response?.data;
      if (rawData && typeof rawData === "object" && !Array.isArray(rawData) && rawData.data) {
        rawData = rawData.data;
      }
      if (rawData && typeof rawData === "object" && !Array.isArray(rawData) && rawData.results) {
        rawData = rawData.results;
      }

      if (!Array.isArray(rawData)) {
        setSentData([]);
        return;
      }

      const rawTaskCloseGroups = rawData.filter((item: any) => item?.group_type === "task_close");
      const transformedData: SubmissionData[] = rawData.map((item: any) => {
        const submissions = (item.sent || item.submissions || []).slice().sort((a: any, b: any) => {
          return getSubmissionTime(b) - getSubmissionTime(a);
        });

        return {
          form: {
            id: item.id,
            title: item.title || "Unknown Form",
            form_type: item.form_type || "standard",
            prefix: item.prefix || item.form_prefix || item.form?.prefix || "",
          },
          submissions,
          group_type: item.group_type,
        };
      });

      const sortedData = [...transformedData].sort((a, b) => {
        const dateA = Math.max(...a.submissions.map(getSubmissionTime), 0);
        const dateB = Math.max(...b.submissions.map(getSubmissionTime), 0);
        return dateB - dateA;
      });

      setSentData(sortedData);
    } catch (error: any) {
    } finally {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
      if (showLoader && didShowLoader) setLoading(false);
    }
  }, [user.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await getCompletedTasks();
    setRefreshing(false);
  }, [getCompletedTasks]);

  useEffect(() => {
    getCompletedTasks(true);
  }, [getCompletedTasks]);

  useFocusEffect(
    useCallback(() => {
      getCompletedTasks(true, true);
      return () => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
          loaderTimeoutRef.current = null;
        }
      };
    }, [getCompletedTasks])
  );

  const formGroups = useMemo(() => {
    const { query, statuses, formTypes } = normalizedFilters;
    if (!statuses.includes("all")) {
      return [] as SubmissionData[];
    }

    const groups = sentData
      .filter((item) => item.group_type !== "task_close")
      .map((item) => {
        const title = String(item.form.title || "");
        if (!formTypes.includes("all")) {
          const normalizedItemFormType = getEffectiveFormTypeFromGroup(item);
          if (!formTypes.includes(normalizedItemFormType)) {
            return null;
          }
        }
        const filteredSubs = filterSubmissions(item.submissions);
        if (filteredSubs.length === 0) return null;

        if (query) {
          const groupMatches = title.toLowerCase().includes(query);
          const anySubmissionMatches = filteredSubs.some((submission: any) => {
            const submissionTitle = String(
              submission?.task_name ||
                submission?.form_title ||
                (submission as any)?.form?.title ||
                ""
            ).toLowerCase();
            return submissionTitle.includes(query);
          });
          if (!groupMatches && !anySubmissionMatches) {
            return null;
          }
        }
        return {
          ...item,
          submissions: filteredSubs,
        };
      })
      .filter((item): item is SubmissionData => item !== null);
    return applyGroupSort(groups);
  }, [sentData, normalizedFilters, filterSubmissions, applyGroupSort, mainFormByTaskId]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredSubmissions("location");
    const optionSet = new Set<string>();
    crossFiltered.forEach(({ sub }) => {
      if (!submissionHasLocationData(sub)) return;
      const taskId = sub?.task_id != null ? String(sub.task_id) : "";
      const taskMeta = taskId ? mainFormByTaskId[taskId] : undefined;
      const candidates = [
        taskMeta?.main_form_location,
        sub?.main_form_location,
        sub?.location_name,
        sub?.location_title,
        sub?.location,
        sub?.site_name,
        sub?.area_name,
        sub?.plant_name,
        sub?.department_name,
        sub?.department?.name,
        sub?.location?.name,
        sub?.location?.title,
        sub?.location_details?.name,
        sub?.location_details?.description,
      ];
      candidates
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .forEach((value) => optionSet.add(value));
    });
    onLocationOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredSubmissions, onLocationOptionsChange, submissionHasLocationData, mainFormByTaskId]);

  const taskCloseGroups = useMemo(() => {
    const { query, statuses, mainForms, formTypes } = normalizedFilters;
    if (!statuses.includes("all")) {
      return [] as SubmissionData[];
    }

    const groups = sentData
      .filter((item) => item.group_type === "task_close")
      .map((item) => {
        const title = String(item.form.title || "");
        if (!formTypes.includes("all")) {
          const normalizedItemFormType = getEffectiveFormTypeFromGroup(item);
          if (!formTypes.includes(normalizedItemFormType)) {
            return null;
          }
        }
        const taskCloseSubs = item.submissions.filter((submission: any) =>
          isOnlyTaskCloseSubmission(submission, String(item.form.id))
        );
        const resolvedSubs = taskCloseSubs.length > 0 ? taskCloseSubs : item.submissions;
        const filteredSubs = filterSubmissions(resolvedSubs);
        if (filteredSubs.length === 0) return null;

        if (query || mainForms.length > 0) {
          const groupTitle = title.toLowerCase();
          const matchesText = (text: string) => {
            if (query && !text.includes(query)) return false;
            if (mainForms.length > 0) {
              const matchesAnyMainForm = mainForms.some((mf) => text.includes(mf.toLowerCase()));
              if (!matchesAnyMainForm) return false;
            }
            return true;
          };

          const groupMatches = matchesText(groupTitle);
          const anySubmissionMatches = filteredSubs.some((submission: any) => {
            const submissionTitle = String(
              submission?.task_name ||
                submission?.form_title ||
                (submission as any)?.form?.title ||
                ""
            ).toLowerCase();
            return matchesText(submissionTitle);
          });

          if (!groupMatches && !anySubmissionMatches) {
            return null;
          }
        }
        return {
          ...item,
          submissions: filteredSubs,
        };
      })
      .filter((item): item is SubmissionData => item !== null);
    return applyGroupSort(groups);
  }, [sentData, normalizedFilters, filterSubmissions, applyGroupSort]);

  const followupFormIds = useMemo(
    () =>
      new Set(
        formGroups
          .filter((item) => item.submissions.some(isFollowupSubmission))
          .map((item) => item.form.id)
      ),
    [formGroups]
  );

  const filteredSentData = useMemo(
    () => formGroups.filter((item) => followupFormIds.has(item.form.id)),
    [formGroups, followupFormIds]
  );

  const followupDisplayData = useMemo(() => {
    const { mainForms, formTypes } = normalizedFilters;
    const grouped: Record<string, SubmissionData> = {};

    for (const item of filteredSentData) {
      for (const submission of item.submissions || []) {
        const taskId = (submission as any)?.task_id != null ? String((submission as any).task_id) : "";
        const mainFormData = taskId ? mainFormByTaskId[taskId] : undefined;

        const groupId = mainFormData?.id || String(item.form.id);
        const groupTitle = mainFormData?.title || item.form.title;
        const groupPrefix = mainFormData?.prefix || item.form.prefix || "";

        if (!grouped[groupId]) {
          grouped[groupId] = {
            form: {
              id: groupId,
              title: groupTitle,
              form_type: mainFormData?.form_type || item.form.form_type,
              prefix: groupPrefix,
            },
            submissions: [],
            group_type: item.group_type,
          };
          (grouped[groupId] as any).__source_form_types = [];
        }

        grouped[groupId].submissions.push(submission);
        (grouped[groupId] as any).__source_form_types.push(item.form.form_type);
      }
    }

    let groups = Object.values(grouped).map((g) => ({
      ...g,
      submissions: [...g.submissions].sort((a, b) => getSubmissionTime(b as any) - getSubmissionTime(a as any)),
    }));

    if (mainForms.length > 0) {
      groups = groups.filter((g) =>
        mainForms.some((mf) =>
          String(g.form.title || "").toLowerCase().includes(mf.toLowerCase())
        )
      );
    }
    if (!formTypes.includes("all")) {
      groups = groups.filter((g) => {
        const sources = Array.isArray((g as any).__source_form_types)
          ? ((g as any).__source_form_types as any[])
          : [];
        const normalizedSourceTypes = sources.map((value) => getNormalizedFormType(String(value || "")));
        if (normalizedSourceTypes.length > 0) {
          return normalizedSourceTypes.some((type) => formTypes.includes(type));
        }
        return formTypes.includes(getEffectiveFormTypeFromGroup(g));
      });
    }

    groups.sort((a, b) => {
      const dateA = Math.max(...a.submissions.map(getSubmissionTime), 0);
      const dateB = Math.max(...b.submissions.map(getSubmissionTime), 0);
      return dateB - dateA;
    });

    return applyGroupSort(groups);
  }, [filteredSentData, mainFormByTaskId, applyGroupSort, normalizedFilters]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredSubmissions("mainForm");
    const optionSet = new Set<string>();
    crossFiltered.forEach(({ sub, group }) => {
      const title = String(group?.form?.title || "").trim();
      if (title) optionSet.add(title);
      const taskId = sub?.task_id != null ? String(sub.task_id) : "";
      const taskMeta = taskId ? mainFormByTaskId[taskId] : undefined;
      const metaTitle = String(taskMeta?.title || "").trim();
      if (metaTitle) optionSet.add(metaTitle);
    });
    onMainFormOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredSubmissions, mainFormByTaskId, onMainFormOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredSubmissions("taskId");
    const optionSet = new Set<string>();
    crossFiltered.forEach(({ sub }) => {
      const prefix = sub?.form_prefix || "NPX";
      const taskId = `${prefix}-${sub?.task_id || ""}`;
      if (sub?.task_id) optionSet.add(taskId);
    });
    onTaskIdOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredSubmissions, onTaskIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredSubmissions("responseId");
    const optionSet = new Set<string>();
    crossFiltered.forEach(({ sub }) => {
      const prefix = sub?.form_prefix || "NPX";
      const subId = sub?.submission_id != null ? String(sub.submission_id) : (sub?.id != null ? String(sub.id) : "");
      if (subId) {
        optionSet.add(`${prefix}-${subId}`);
      }
    });
    onResponseIdOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredSubmissions, onResponseIdOptionsChange]);

  useEffect(() => {
    const crossFiltered = getCrossFilteredSubmissions("question");
    const optionSet = new Set<string>();
    const seenGroups = new Set<string>();
    crossFiltered.forEach(({ group }) => {
      const groupKey = String(group?.form?.id || "");
      if (seenGroups.has(groupKey)) return;
      seenGroups.add(groupKey);
      const formQuestions = (group as any)?.form?.questions || (group as any)?.form?.form_questions || [];
      if (Array.isArray(formQuestions)) {
        formQuestions.forEach((q: any) => {
          const qText = String(q?.question || q?.text || q?.title || "").trim();
          if (qText) optionSet.add(qText);
        });
      }
    });
    onQuestionOptionsChange?.(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
  }, [getCrossFilteredSubmissions, onQuestionOptionsChange]);

  useEffect(() => {
    let cancelled = false;

    const resolveMainFormsByTask = async () => {
      const taskIds = Array.from(
        new Set(
          sentData
            .flatMap((item) => item.submissions || [])
            .map((s: any) => (s?.task_id != null ? String(s.task_id) : ""))
            .filter(
              (id) =>
                id &&
                (
                  !mainFormByTaskId[id] ||
                  !String(mainFormByTaskId[id]?.main_form_location || "").trim()
                ) &&
                !NO_MAIN_FORM_TASK_IDS.has(id)
            )
        )
      );

      if (taskIds.length === 0) return;

      const updates: Record<string, MainFormTaskMeta> = {};
      const taskToMainForm: Record<string, string> = {};
      const taskLocationByTaskId: Record<string, string> = {};

      const taskDetailResponses = await Promise.all(
        taskIds.map(async (taskId) => {
          try {
            const taskDetails: any = await apiGet(`/tasks/${taskId}/`);
            const rawMainFormId = taskDetails?.followup_task_form_id;
            const mainFormId = typeof rawMainFormId === "object" ? rawMainFormId?.id : rawMainFormId;
            return {
              taskId,
              mainFormId: mainFormId ? String(mainFormId) : null,
              mainFormLocation:
                typeof taskDetails?.main_form_location === "string" &&
                taskDetails.main_form_location.trim()
                  ? String(taskDetails.main_form_location).trim()
                  : "",
            };
          } catch {
            return { taskId, mainFormId: null, mainFormLocation: "" };
          }
        })
      );

      for (const row of taskDetailResponses) {
        if (row.mainFormLocation) {
          taskLocationByTaskId[row.taskId] = row.mainFormLocation;
        }
        if (row.mainFormId) {
          taskToMainForm[row.taskId] = row.mainFormId;
        } else {
          NO_MAIN_FORM_TASK_IDS.add(row.taskId);
        }
      }

      const uniqueMainFormIds = Array.from(new Set(Object.values(taskToMainForm)));
      const formMetaById: Record<string, { title: string; form_type?: string; prefix?: string }> = {};

      if (uniqueMainFormIds.length > 0) {
        try {
          const batchResponse: any = await api.get(`/form/batch-metadata/?ids=${uniqueMainFormIds.join(',')}`);
          const batchData = batchResponse?.data ?? batchResponse;
          if (batchData && typeof batchData === 'object') {
            for (const fid of Object.keys(batchData)) {
              const meta = batchData[fid];
              if (meta && meta.title) {
                formMetaById[fid] = {
                  title: meta.title,
                  form_type: meta.form_type ? String(meta.form_type) : undefined,
                  prefix: meta.prefix ? String(meta.prefix) : undefined,
                };
              }
            }
          }
        } catch {
          // Fallback: leave formMetaById empty
        }
      }

      for (const taskId of Object.keys(taskToMainForm)) {
        const formId = taskToMainForm[taskId];
        const meta = formMetaById[formId];
        if (!meta) continue;
        updates[taskId] = {
          id: formId,
          title: meta.title,
          form_type: meta.form_type,
          prefix: meta.prefix,
          main_form_location: taskLocationByTaskId[taskId],
        };
      }

      for (const taskId of Object.keys(taskLocationByTaskId)) {
        if (updates[taskId] || !mainFormByTaskId[taskId]) continue;
        updates[taskId] = {
          ...mainFormByTaskId[taskId],
          main_form_location: taskLocationByTaskId[taskId],
        };
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        Object.assign(MAIN_FORM_BY_TASK_CACHE, updates);
        setMainFormByTaskId((prev) => ({ ...prev, ...updates }));
      }

      // Log sample data for debugging
      console.log("Todo Sent - Sample submission:", sentData[0]?.submissions[0]);
      console.log("Todo Sent - mainFormByTaskId:", mainFormByTaskId);
    };

    if (!isFocused) return;
    resolveMainFormsByTask();
    return () => {
      cancelled = true;
    };
  }, [sentData, mainFormByTaskId, isFocused]);

  const mapFormTypeLabel = (formType?: string) => {
    const normalized = String(formType || "").toLowerCase();
    if (normalized.includes("audit")) return "Audit";
    if (normalized.includes("location")) return "Location";
    return "Standard";
  };

  const switchTab = (tab: SentTabKey) => {
    setActiveTab(tab);
    setExpandedKey(null);
  };

  const getItemKey = (item: SubmissionData, section: "form" | "task_close") =>
    `${section}-${item.form.id}`;

  const resolveExpandedItem = () => {
    if (!expandedKey) return null;
    if (expandedKey.startsWith("task_close-")) {
      const id = expandedKey.replace("task_close-", "");
      return taskCloseGroups.find((item) => String(item.form.id) === id) || null;
    }
    const id = expandedKey.replace("form-", "");
    return followupDisplayData.find((item) => String(item.form.id) === id) || null;
  };

  const routeFormsFileList = (formId: any, submissionId: any, formType: any, formTitle?: string, summaryData?: any[], submission?: any) => {
    const submissionData = submission;
    const taskId = submissionData?.task_id ? String(submissionData.task_id) : String(submissionId);
    const isTaskClose = submissionData ? isTaskCloseSubmission(submissionData) : false;
    const isFollowupLike = submissionData ? (isFollowupSubmission(submissionData) || isTaskClose) : false;

    if (isFollowupLike && submissionData?.task_id) {
      const params: Record<string, string> = {
        taskId: String(submissionData.task_id),
        submissionId: String(submissionId),
        canReopen: submissionData?.can_reopen ? 'true' : 'false',
        isTaskClose: isTaskClose ? 'true' : 'false'
      };

      if (!isTaskClose) {
        params.formId = formId || '';
      }

      router.push({
        pathname: "/(app)/screens/Todo/sent-task-summary",
        params
      });
      return;
    }

    if (onFormSelect) {
      onFormSelect({
        formId,
        taskId,
        submissionId: String(submissionId),
        formTitle,
        formType,
        sourceScreen: 'sent'
      });
    }
  };

  const renderItem = ({
    item,
    index,
    sectionType,
    measureHeight = true,
  }: {
    item: SubmissionData;
    index: number;
    sectionType: "form" | "task_close";
    measureHeight?: boolean;
  }) => {
    const itemKey = getItemKey(item, sectionType);
    const submissions = item.submissions || [];
    const hasOnlyNormalTasks =
      submissions.length > 0 &&
      submissions.every(
        (submission) =>
          !isFollowupSubmission(submission) && !isTaskCloseSubmission(submission),
      );
    const headerTitle =
      (hasOnlyNormalTasks ? submissions[0]?.task_name : null) || item.form.title;
    return (
      <View
        onLayout={(e) => {
          if (!measureHeight || index !== 0) return;
          const height = e.nativeEvent.layout.height;
          if (height > 0 && Math.abs(height - accordionRowHeight) > 2) {
            setAccordionRowHeight(height);
          }
        }}
      >
        <Accordion
          title={headerTitle}
          headerRight={
            <View style={[styles.formTypeBadge, getFormTypeBadgeStyle(item.form.form_type)]}>
              <Text style={[styles.formTypeBadgeText, getFormTypeTextStyle(item.form.form_type)]}>
                {mapFormTypeLabel(item.form.form_type)}
              </Text>
            </View>
          }
          containerStyle={styles.accordionContainer}
          headerStyle={styles.accordionHeader}
          iconColor="#fff"
          expanded={expandedKey === itemKey}
          onPress={(isExpanded) => {
            setExpandedKey(isExpanded ? itemKey : null);
          }}
        >
          {item.submissions.map((submission: any, subIndex: number) => {
            const baseId = submission.form_submission_id ?? submission.id ?? `${item.form.id}-${subIndex}`;
            const taskKey = submission.task_id ?? submission.followup_task_id ?? subIndex;
            const uniqueKey = `${baseId}-${taskKey}`;
            return (
              <FileList
                key={uniqueKey}
                items={submission}
                formId={item.form.id}
                formType={item.form?.form_type}
                formTitle={item.form.title}
                formPrefix={item.form.prefix}
                onClick={routeFormsFileList}
                mainFormByTaskId={mainFormByTaskId}
              />
            );
          })}
        </Accordion>
      </View>
    );
  };

  const renderExpandedSubmissions = (item: SubmissionData, sectionType: "form" | "task_close") => {
    const itemKey = getItemKey(item, sectionType);
    const submissions = item.submissions || [];
    const hasOnlyNormalTasks =
      submissions.length > 0 &&
      submissions.every(
        (submission) =>
          !isFollowupSubmission(submission) && !isTaskCloseSubmission(submission),
      );
    const headerTitle =
      (hasOnlyNormalTasks ? submissions[0]?.task_name : null) || item.form.title;
    return (
      <View style={styles.expandedCard}>
        <TouchableOpacity
          style={[styles.expandedAccordionHeader, styles.accordionHeader]}
          onPress={() => setExpandedKey(null)}
          activeOpacity={0.8}
        >
          <Text style={styles.expandedAccordionTitle}>{headerTitle}</Text>
          <View style={styles.expandedHeaderRight}>
            <View style={[styles.formTypeBadge, getFormTypeBadgeStyle(item.form.form_type)]}>
              <Text style={[styles.formTypeBadgeText, getFormTypeTextStyle(item.form.form_type)]}>
                {mapFormTypeLabel(item.form.form_type)}
              </Text>
            </View>
            <Icon name="keyboard-arrow-down" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <ScrollView style={styles.expandedListScroll} contentContainerStyle={styles.expandedListContent}>
          {item.submissions.map((submission: any, subIndex: number) => {
            const baseId = submission.form_submission_id ?? submission.id ?? `${item.form.id}-${subIndex}`;
            const taskKey = submission.task_id ?? submission.followup_task_id ?? subIndex;
            const uniqueKey = `${baseId}-${taskKey}`;
            return (
              <FileList
                key={uniqueKey}
                items={submission}
                formId={item.form.id}
                formType={item.form?.form_type}
                formTitle={item.form.title}
                formPrefix={item.form.prefix}
                onClick={routeFormsFileList}
                mainFormByTaskId={mainFormByTaskId}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2196f3" />
      ) : (
        <View style={styles.content}>
          <View style={styles.tabsRow}>
            <TouchableTab
              label="Followup + Task Close"
              active={activeTab === "form"}
              onPress={() => switchTab("form")}
            />
            <TouchableTab
              label="Only Task Close"
              active={activeTab === "task_close"}
              onPress={() => switchTab("task_close")}
            />
          </View>
          {expandedKey && resolveExpandedItem() ? (
            <View style={[styles.sectionCard, styles.fullSectionCard]}>
              <View style={styles.sectionHeaderCard}>
                <Text style={styles.sectionTitle}>
                  {expandedKey.startsWith("task_close-")
                    ? "Only Task Close Question Submission"
                    : "Followup Form with Task close Question"}
                </Text>
              </View>
              <View style={styles.fullListContainer}>
                {renderExpandedSubmissions(
                  resolveExpandedItem()!,
                  expandedKey.startsWith("task_close-") ? "task_close" : "form",
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.sectionCard, styles.fullSectionCard]}>
              {activeTab === "form" ? (
                <>
                  <View style={styles.sectionHeaderCard}>
                    <Text style={styles.sectionTitle}>Followup Form with Task close Question</Text>
                  </View>
                  <View style={styles.fullListContainer}>
                    <FlatList
                      data={followupDisplayData}
                      keyExtractor={(item) => item.form.id}
                      renderItem={({ item, index }) => renderItem({ item, index, sectionType: "form" })}
                      refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                      }
                      showsVerticalScrollIndicator
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No completed tasks available.</Text>
                      }
                      nestedScrollEnabled
                      removeClippedSubviews={false}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.sectionHeaderCard}>
                    <Text style={styles.sectionTitle}>Only Task Close Question Submission</Text>
                  </View>
                  <View style={styles.fullListContainer}>
                    <FlatList
                      data={taskCloseGroups}
                      keyExtractor={(item) => `task-close-${item.form.id}`}
                      renderItem={({ item, index }) => renderItem({ item, index, sectionType: "task_close" })}
                      refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                      }
                      showsVerticalScrollIndicator
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No completed task close submissions.</Text>
                      }
                      nestedScrollEnabled
                      removeClippedSubviews={false}
                    />
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function getFormTypeBadgeStyle(formType?: string) {
  const normalized = String(formType || "").toLowerCase();
  if (normalized.includes("audit")) return { backgroundColor: "#FEF3C7" };
  if (normalized.includes("location")) return { backgroundColor: "#DBEAFE" };
  return { backgroundColor: "#DCFCE7" };
}

function getFormTypeTextStyle(formType?: string) {
  const normalized = String(formType || "").toLowerCase();
  if (normalized.includes("audit")) return { color: "#92400E" };
  if (normalized.includes("location")) return { color: "#1E40AF" };
  return { color: "#166534" };
}

function TouchableTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.tabWrap, active ? styles.tabWrapActive : null]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  content: {
    flex: 1,
  },
  tabsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tabWrap: {
    flex: 1,
    marginHorizontal: 3,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabWrapActive: {
    backgroundColor: "#2196f3",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2196f3",
    textAlign: "center",
  },
  tabTextActive: {
    color: "#fff",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  fullSectionCard: {
    flex: 1,
  },
  sectionHeaderCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 5,
    height: 28,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  fullListContainer: {
    flex: 1,
  },
  expandedCard: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e1e8f7",
    backgroundColor: "#fff",
  },
  expandedAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  expandedAccordionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    marginRight: 8,
  },
  expandedHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  formTypeBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 4,
  },
  formTypeBadgeText: {
    fontSize: 8,
    fontWeight: "700",
  },
  expandedListScroll: {
    maxHeight: "100%",
  },
  expandedListContent: {
    padding: 10,
    paddingBottom: 14,
  },
  accordionContainer: {
    marginBottom: 5,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  accordionHeader: {
    backgroundColor: "#2196f3",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  emptyText: {
    padding: 15,
    textAlign: "center",
    color: "gray",
    fontStyle: "italic",
  },
});

