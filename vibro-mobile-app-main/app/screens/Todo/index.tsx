import SearchBar from "@/components/SearchBar";
import { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import TodoTabs, { TodoFilters } from "./todo-tabs";
import TodoFormScreen from "./TodoFormScreen";

interface SelectedForm {
  formId: string;
  taskId: string;
  submissionId?: string;
  formTitle?: string;
  formType?: string;
  sourceScreen?: string;
  draftId?: string;
  mode?: string; // Add mode parameter for task close questions
  isTaskCloseQuestions?: boolean; // Special flag for task close questions
}

const getDefaultFilters = (): TodoFilters => ({
  query: "",
  startDate: null,
  endDate: null,
  status: ["all"],
  location: [],
  mainForm: [],
  formType: ["all"],
  taskType: ["all"],
  taskId: [],
  responseId: [],
  question: [],
  reopened: false,
  aging: "all",
  sort: "default",
});

const normalizeStatus = (status: any): TodoFilters["status"] => {
  if (Array.isArray(status)) {
    if (status.includes("all")) return ["all"];
    const valid = status.filter((s: any) => s === "not_started" || s === "pending" || s === "in_progress" || s === "completed");
    return valid.length > 0 ? valid : ["all"];
  }
  if (status === "not_started") return ["not_started"];
  if (status === "pending") return ["pending"];
  if (status === "in_progress") return ["pending"]; // in_progress maps to pending in new tab
  if (status === "completed") return ["all"]; // completed goes to sent tab, show all there
  return ["all"];
};

let cachedTodoFilters: TodoFilters | null = null;

const Todo = () => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [selectedForm, setSelectedForm] = useState<SelectedForm | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [filters, setFilters] = useState<TodoFilters>(() => {
    const base = cachedTodoFilters || getDefaultFilters();
    return { ...base, status: normalizeStatus(base.status) };
  });
  const [draftFilters, setDraftFilters] = useState<TodoFilters>(filters);
  const [searchKey, setSearchKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterPopup, setActiveFilterPopup] = useState<string | null>(null);
  const [popupSearchQuery, setPopupSearchQuery] = useState("");
  const [locationOptionsByTab, setLocationOptionsByTab] = useState<Record<string, string[]>>({});
  const [mainFormOptionsByTab, setMainFormOptionsByTab] = useState<Record<string, string[]>>({});
  const [taskIdOptionsByTab, setTaskIdOptionsByTab] = useState<Record<string, string[]>>({});
  const [responseIdOptionsByTab, setResponseIdOptionsByTab] = useState<Record<string, string[]>>({});
  const [questionOptionsByTab, setQuestionOptionsByTab] = useState<Record<string, string[]>>({});

  useEffect(() => {
    cachedTodoFilters = filters;
  }, [filters]);

  // Apply filterStatus / filterTaskIds / filterSubmissionId params from Forms Sent chips
  useEffect(() => {
    const filterStatus = params.filterStatus as string | undefined;
    const filterTaskIds = params.filterTaskIds as string | undefined;
    const filterSubmissionId = params.filterSubmissionId as string | undefined;

    if (!filterStatus && !filterTaskIds && !filterSubmissionId) return;

    // Clear cache so stale filters don't override incoming params
    cachedTodoFilters = null;

    setFilters((prev) => {
      const next = { ...prev };
      if (filterStatus) next.status = normalizeStatus(filterStatus);
      if (filterTaskIds) next.taskId = filterTaskIds.split(',').filter(Boolean);
      if (filterSubmissionId) next.responseId = [filterSubmissionId];
      return next;
    });
    setDraftFilters((prev) => {
      const next = { ...prev };
      if (filterStatus) next.status = normalizeStatus(filterStatus);
      if (filterTaskIds) next.taskId = filterTaskIds.split(',').filter(Boolean);
      if (filterSubmissionId) next.responseId = [filterSubmissionId];
      return next;
    });
  }, [params.filterStatus, params.filterTaskIds, params.filterSubmissionId, params._ts]);

  // Check for form opening parameters from URL
  useEffect(() => {
    // Skip if we already have a selectedForm or if params are empty
    if (selectedForm || !params.openForm) {
      return;
    }

    // Only process if we have all required params
    const formId = params.formId as string;
    const taskId = params.taskId as string;

    if (!formId || !taskId) {
      return;
    }

    setSelectedForm({
      formId: formId,
      taskId: taskId,
      submissionId: params.submissionId as string,
      draftId: params.draftId as string,
      sourceScreen: params.sourceScreen as string,
      formType: (params.formType as string) || 'todo',
      mode: params.mode as string
    });
  }, [params.formId, params.taskId, params.submissionId, params.draftId, params.sourceScreen, params.mode, params.openForm, selectedForm]);

  const handleSearch = (query: string) => {
    const results = query
      ? ["Task 1", "Task 2", "Task 3"].filter((item) =>
          item.toLowerCase().includes(query.toLowerCase())
        )
      : [];
    setSearchResults(results);
    setFilters((prev) => ({ ...prev, query }));
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setFilters((prev) => ({ ...prev, query: "" }));
  };

  const handleFormSelect = (formData: SelectedForm) => {
    setSelectedForm(formData);
  };

  const handleNavigateToTaskClose = (taskId: string) => {
    setSelectedForm({
      formId: 'task-close-questions',
      taskId: taskId,
      sourceScreen: 'task-summary',
      formType: 'todo',
      mode: 'task-close-questions',
      isTaskCloseQuestions: true
    });
  };

  const handleFormClose = () => {
    if (selectedForm?.sourceScreen === 'sent') {
      setActiveTabIndex(2);
    }
    setSelectedForm(null);
  };

  const handleDateChange =
    (type: "startDate" | "endDate") => (event: DateTimePickerEvent, date?: Date) => {
      const isSetEvent = event.type === "set" || event.type === undefined;
      const timestamp = event.nativeEvent?.timestamp;
      const pickedDate = date ?? (timestamp ? new Date(timestamp) : undefined);
      if (!pickedDate || !isSetEvent) return;
      const normalized = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
      setDraftFilters((prev) => ({ ...prev, [type]: normalized }));
    };

  const openAndroidDatePicker = (type: "startDate" | "endDate") => {
    const value = type === "startDate" ? draftFilters.startDate || new Date() : draftFilters.endDate || new Date();
    DateTimePickerAndroid.open({
      mode: "date",
      value,
      onChange: handleDateChange(type),
    });
  };

  const clearAllFilters = () => {
    setSearchResults([]);
    const defaults = getDefaultFilters();
    setDraftFilters(defaults);
    setFilters(defaults);
    setSearchKey((prev) => prev + 1);
  };

  const formattedStartDate = useMemo(
    () => (draftFilters.startDate ? draftFilters.startDate.toLocaleDateString() : "Start date"),
    [draftFilters.startDate]
  );
  const formattedEndDate = useMemo(
    () => (draftFilters.endDate ? draftFilters.endDate.toLocaleDateString() : "End date"),
    [draftFilters.endDate]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.query ||
      filters.location.length > 0 ||
      filters.mainForm.length > 0 ||
      !filters.formType.includes("all") ||
      !!filters.startDate ||
      !!filters.endDate ||
      !filters.status.includes("all") ||
      !filters.taskType.includes("all") ||
      filters.taskId.length > 0 ||
      filters.responseId.length > 0 ||
      filters.question.length > 0 ||
      filters.reopened ||
      filters.aging !== "all" ||
      filters.sort !== "default"
    );
  }, [filters]);

  const activeTabKey = useMemo(() => {
    if (activeTabIndex === 1) return "draft";
    if (activeTabIndex === 2) return "sent";
    if (activeTabIndex === 3) return "receive";
    return "new";
  }, [activeTabIndex]);

  const activeLocationOptions = useMemo(() => locationOptionsByTab[activeTabKey] || [], [locationOptionsByTab, activeTabKey]);
  const activeMainFormOptions = useMemo(() => mainFormOptionsByTab[activeTabKey] || [], [mainFormOptionsByTab, activeTabKey]);
  const activeTaskIdOptions = useMemo(() => taskIdOptionsByTab[activeTabKey] || [], [taskIdOptionsByTab, activeTabKey]);
  const activeResponseIdOptions = useMemo(() => responseIdOptionsByTab[activeTabKey] || [], [responseIdOptionsByTab, activeTabKey]);
  const activeQuestionOptions = useMemo(() => questionOptionsByTab[activeTabKey] || [], [questionOptionsByTab, activeTabKey]);
  const sheetBottomPadding = useMemo(() => {
    const basePadding = height < 700 ? 8 : 12;
    return insets.bottom > 0 ? insets.bottom + basePadding : basePadding;
  }, [height, insets.bottom]);

  const makeOptionsHandler = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Record<string, string[]>>>) =>
      (tabKey: string, options: string[]) => {
        setter((prev) => {
          const prevOptions = prev[tabKey] || [];
          const sameLength = prevOptions.length === options.length;
          const sameValues = sameLength && prevOptions.every((value, index) => value === options[index]);
          if (sameValues) return prev;
          return { ...prev, [tabKey]: options };
        });
      },
    []
  );

  const handleLocationOptionsChange = useCallback(makeOptionsHandler(setLocationOptionsByTab), [makeOptionsHandler]);
  const handleMainFormOptionsChange = useCallback(makeOptionsHandler(setMainFormOptionsByTab), [makeOptionsHandler]);
  const handleTaskIdOptionsChange = useCallback(makeOptionsHandler(setTaskIdOptionsByTab), [makeOptionsHandler]);
  const handleResponseIdOptionsChange = useCallback(makeOptionsHandler(setResponseIdOptionsByTab), [makeOptionsHandler]);
  const handleQuestionOptionsChange = useCallback(makeOptionsHandler(setQuestionOptionsByTab), [makeOptionsHandler]);

  const toggleArrayValue = (key: keyof TodoFilters, value: any, allValue?: string) => {
    setDraftFilters((prev) => {
      const current = prev[key] as any as string[];
      if (allValue && value === allValue) {
        return { ...prev, [key]: [allValue] } as TodoFilters;
      }
      if (current.includes(value)) {
        const next = current.filter((v) => v !== value);
        return { ...prev, [key]: next.length > 0 ? next : (allValue ? [allValue] : []) } as TodoFilters;
      }
      const withoutAll = allValue ? current.filter((v) => v !== allValue) : current;
      return { ...prev, [key]: [...withoutAll, value] } as TodoFilters;
    });
  };

  const getSelectionSummary = (selected: string[], options: string[], allLabel: string = "All"): string => {
    if (selected.length === 0) return allLabel;
    if (selected.length === 1 && selected[0] === "all") return allLabel;
    if (options.length > 0 && selected.length === options.length) return allLabel;
    if (selected.length <= 2) return selected.join(", ");
    return `${selected.length} selected`;
  };

  const openFilterPopup = (popup: string) => {
    setPopupSearchQuery("");
    setActiveFilterPopup(popup);
  };

  const closeFilterPopup = () => {
    setPopupSearchQuery("");
    setActiveFilterPopup(null);
  };

  const getSearchedOptions = (options: string[]): string[] => {
    const q = popupSearchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  };

  const isDynamicFilter = activeFilterPopup === "location" || activeFilterPopup === "mainForm" || activeFilterPopup === "taskId" || activeFilterPopup === "responseId" || activeFilterPopup === "question";

  // If a form is selected, show the form screen
  if (selectedForm) {
    return (
      <View style={styles.container}>
        <TodoFormScreen
          formId={selectedForm.formId}
          taskId={selectedForm.taskId}
          submissionId={selectedForm.submissionId}
          draftId={selectedForm.draftId}
          formType={selectedForm.formType}
          sourceScreen={selectedForm.sourceScreen}
          mode={selectedForm.mode}
          onClose={handleFormClose}
          onNavigateToTaskClose={handleNavigateToTaskClose}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchGrow}>
          <SearchBar key={searchKey} placeholder="Task name" onSearch={handleSearch} onClear={handleClearSearch} />
        </View>
        <TouchableOpacity
          style={[styles.filterIconButton, showFilters && styles.filterIconButtonActive]}
          onPress={() => {
            setDraftFilters(filters);
            setShowFilters(true);
          }}
        >
          <Icon name="filter-list" size={22} color={showFilters ? "#fff" : "#111827"} />
        </TouchableOpacity>
        {hasActiveFilters && (
          <TouchableOpacity style={styles.resetButton} onPress={clearAllFilters}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Main Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowFilters(false)}
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { paddingBottom: sheetBottomPadding }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.sheetHeaderButton}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={() => clearAllFilters()} style={styles.sheetHeaderButton}>
                <Text style={styles.resetText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScrollContent}
            >
              <View style={styles.twoColRow}>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Location</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("location")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {getSelectionSummary(draftFilters.location, activeLocationOptions, "All Locations")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Main Form</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("mainForm")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {getSelectionSummary(draftFilters.mainForm, activeMainFormOptions, "All Forms")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Task ID</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("taskId")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {getSelectionSummary(draftFilters.taskId, activeTaskIdOptions, "All Task IDs")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Response ID</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("responseId")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {getSelectionSummary(draftFilters.responseId, activeResponseIdOptions, "All Response IDs")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Question</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("question")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {getSelectionSummary(draftFilters.question, activeQuestionOptions, "All Questions")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Status</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("status")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {draftFilters.status.includes("all") ? "All" : getSelectionSummary(draftFilters.status, [], "All")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Task Type</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("taskType")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {draftFilters.taskType.includes("all") ? "All Types" : getSelectionSummary(draftFilters.taskType, [], "All")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Form Type</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("formType")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {draftFilters.formType.includes("all") ? "All Forms" : getSelectionSummary(draftFilters.formType, [], "All")}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Aging</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("aging")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {draftFilters.aging === "all" ? "All" : draftFilters.aging === "today" ? "Today" : draftFilters.aging === "1-7" ? "1-7 days" : draftFilters.aging === "8-30" ? "8-30 days" : "30+ days"}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.sectionLabel}>Sort</Text>
                  <TouchableOpacity style={styles.filterPickerBtn} onPress={() => openFilterPopup("sort")} activeOpacity={0.8}>
                    <Text style={styles.filterPickerText} numberOfLines={1}>
                      {draftFilters.sort === "default" ? "Default" : draftFilters.sort === "newest" ? "Newest" : draftFilters.sort === "oldest" ? "Oldest" : "A-Z"}
                    </Text>
                    <Icon name="arrow-drop-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Deadline</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity style={styles.dateButton} onPress={() => openAndroidDatePicker("startDate")}>
                  <Text style={styles.filterValue}>{formattedStartDate}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateButton} onPress={() => openAndroidDatePicker("endDate")}>
                  <Text style={styles.filterValue}>{formattedEndDate}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelWrap}>
                  <Icon name="undo" size={16} color={draftFilters.reopened ? "#EF4444" : "#9ca3af"} />
                  <Text style={[styles.toggleLabel, draftFilters.reopened && styles.toggleLabelActive]}>
                    Show Reopened Only
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleSwitch, draftFilters.reopened && styles.toggleSwitchActive]}
                  onPress={() => setDraftFilters((prev) => ({ ...prev, reopened: !prev.reopened }))}
                >
                  <View style={[styles.toggleKnob, draftFilters.reopened && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                setFilters(draftFilters);
                setShowFilters(false);
              }}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Individual Filter Selection Popup */}
      <Modal
        visible={activeFilterPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={closeFilterPopup}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <View style={styles.popupHeader}>
              <Text style={styles.popupTitle}>
                {activeFilterPopup === "location" ? "Select Location" :
                 activeFilterPopup === "mainForm" ? "Select Main Form" :
                 activeFilterPopup === "taskId" ? "Select Task ID" :
                 activeFilterPopup === "responseId" ? "Select Response ID" :
                 activeFilterPopup === "question" ? "Select Question" :
                 activeFilterPopup === "status" ? "Select Status" :
                 activeFilterPopup === "taskType" ? "Select Task Type" :
                 activeFilterPopup === "formType" ? "Select Form Type" :
                 activeFilterPopup === "aging" ? "Select Aging" :
                 activeFilterPopup === "sort" ? "Select Sort" : "Select"}
              </Text>
              <TouchableOpacity onPress={closeFilterPopup} style={styles.popupCloseBtn}>
                <Icon name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {isDynamicFilter && (
              <View style={styles.popupSearchContainer}>
                <Icon name="search" size={18} color="#9ca3af" style={styles.popupSearchIcon} />
                <TextInput
                  style={styles.popupSearchInput}
                  placeholder="Search..."
                  placeholderTextColor="#9ca3af"
                  value={popupSearchQuery}
                  onChangeText={setPopupSearchQuery}
                  autoCorrect={false}
                />
                {popupSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setPopupSearchQuery("")} style={styles.popupSearchClear}>
                    <Icon name="close" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <ScrollView style={styles.popupScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {activeFilterPopup === "location" && (() => {
                const searched = getSearchedOptions(activeLocationOptions);
                if (activeLocationOptions.length === 0) return <Text style={styles.emptyText}>No locations available</Text>;
                if (searched.length === 0) return <Text style={styles.emptyText}>No matches found</Text>;
                return searched.map((option) => {
                  const selected = draftFilters.location.includes(option);
                  return (
                    <TouchableOpacity key={option} style={styles.popupItem} onPress={() => toggleArrayValue("location", option)}>
                      <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                        {selected && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={styles.popupItemText} numberOfLines={2}>{option}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
              {activeFilterPopup === "mainForm" && (() => {
                const searched = getSearchedOptions(activeMainFormOptions);
                if (activeMainFormOptions.length === 0) return <Text style={styles.emptyText}>No forms available</Text>;
                if (searched.length === 0) return <Text style={styles.emptyText}>No matches found</Text>;
                return searched.map((option) => {
                  const selected = draftFilters.mainForm.includes(option);
                  return (
                    <TouchableOpacity key={option} style={styles.popupItem} onPress={() => toggleArrayValue("mainForm", option)}>
                      <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                        {selected && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={styles.popupItemText} numberOfLines={2}>{option}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
              {activeFilterPopup === "taskId" && (() => {
                const searched = getSearchedOptions(activeTaskIdOptions);
                if (activeTaskIdOptions.length === 0) return <Text style={styles.emptyText}>No task IDs available</Text>;
                if (searched.length === 0) return <Text style={styles.emptyText}>No matches found</Text>;
                return searched.map((option) => {
                  const selected = draftFilters.taskId.includes(option);
                  return (
                    <TouchableOpacity key={option} style={styles.popupItem} onPress={() => toggleArrayValue("taskId", option)}>
                      <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                        {selected && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={styles.popupItemText} numberOfLines={1}>{option}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
              {activeFilterPopup === "responseId" && (() => {
                const searched = getSearchedOptions(activeResponseIdOptions);
                if (activeResponseIdOptions.length === 0) return <Text style={styles.emptyText}>No response IDs available</Text>;
                if (searched.length === 0) return <Text style={styles.emptyText}>No matches found</Text>;
                return searched.map((option) => {
                  const selected = draftFilters.responseId.includes(option);
                  return (
                    <TouchableOpacity key={option} style={styles.popupItem} onPress={() => toggleArrayValue("responseId", option)}>
                      <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                        {selected && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={styles.popupItemText} numberOfLines={1}>{option}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
              {activeFilterPopup === "question" && (() => {
                const searched = getSearchedOptions(activeQuestionOptions);
                if (activeQuestionOptions.length === 0) return <Text style={styles.emptyText}>No questions available</Text>;
                if (searched.length === 0) return <Text style={styles.emptyText}>No matches found</Text>;
                return searched.map((option) => {
                  const selected = draftFilters.question.includes(option);
                  return (
                    <TouchableOpacity key={option} style={styles.popupItem} onPress={() => toggleArrayValue("question", option)}>
                      <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                        {selected && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={styles.popupItemText} numberOfLines={3}>{option}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
              {activeFilterPopup === "status" && [
                { value: "all", label: "All" },
                { value: "not_started", label: "Not Started" },
                { value: "pending", label: "In Progress" },
              ].map((option) => {
                const selected = (draftFilters.status as string[]).includes(option.value);
                return (
                  <TouchableOpacity key={option.value} style={styles.popupItem} onPress={() => toggleArrayValue("status", option.value, "all")}>
                    <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                      {selected && <Icon name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.popupItemText}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {activeFilterPopup === "taskType" && [
                { value: "all", label: "All Types" },
                { value: "normal", label: "Normal" },
                { value: "followup", label: "Followup" },
              ].map((option) => {
                const selected = (draftFilters.taskType as string[]).includes(option.value);
                return (
                  <TouchableOpacity key={option.value} style={styles.popupItem} onPress={() => toggleArrayValue("taskType", option.value, "all")}>
                    <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                      {selected && <Icon name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.popupItemText}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {activeFilterPopup === "formType" && [
                { value: "all", label: "All Forms" },
                { value: "standard", label: "Standard" },
                { value: "audit", label: "Audit" },
              ].map((option) => {
                const selected = (draftFilters.formType as string[]).includes(option.value);
                return (
                  <TouchableOpacity key={option.value} style={styles.popupItem} onPress={() => toggleArrayValue("formType", option.value, "all")}>
                    <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                      {selected && <Icon name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.popupItemText}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {activeFilterPopup === "aging" && [
                { value: "all", label: "All" },
                { value: "today", label: "Today" },
                { value: "1-7", label: "1-7 days" },
                { value: "8-30", label: "8-30 days" },
                { value: "30+", label: "30+ days" },
              ].map((option) => {
                const selected = draftFilters.aging === option.value;
                return (
                  <TouchableOpacity key={option.value} style={styles.popupItem} onPress={() => setDraftFilters((prev) => ({ ...prev, aging: option.value as TodoFilters["aging"] }))}>
                    <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                      {selected && <Icon name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.popupItemText}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {activeFilterPopup === "sort" && [
                { value: "default", label: "Default" },
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "az", label: "A-Z" },
              ].map((option) => {
                const selected = draftFilters.sort === option.value;
                return (
                  <TouchableOpacity key={option.value} style={styles.popupItem} onPress={() => setDraftFilters((prev) => ({ ...prev, sort: option.value as TodoFilters["sort"] }))}>
                    <View style={[styles.checkboxOuter, selected && styles.checkboxOuterSelected]}>
                      {selected && <Icon name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.popupItemText}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.popupDoneBtn} onPress={closeFilterPopup}>
              <Text style={styles.popupDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <TodoTabs
        onFormSelect={handleFormSelect}
        initialTabIndex={activeTabIndex}
        onTabChange={setActiveTabIndex}
        filters={filters}
        draftFilters={draftFilters}
        onLocationOptionsChange={handleLocationOptionsChange}
        onMainFormOptionsChange={handleMainFormOptionsChange}
        onTaskIdOptionsChange={handleTaskIdOptionsChange}
        onResponseIdOptionsChange={handleResponseIdOptionsChange}
        onQuestionOptionsChange={handleQuestionOptionsChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchGrow: {
    flex: 1,
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  filterIconButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  modalContainer: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
  },
  sheetScrollContent: {
    paddingBottom: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetHeaderButton: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  resetText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  colItem: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 6,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingRight: 6,
    minHeight: 38,
  },
  inputText: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: "#111827",
    fontSize: 13,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
  },
  filterValue: {
    fontSize: 13,
    color: "#111827",
  },
  dropdownAnchor: {
    position: "relative",
  },
  dropdownOpen: {
    zIndex: 60,
  },
  dropdownList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 220,
    backgroundColor: "#fff",
    zIndex: 70,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  emptyDropdownText: {
    padding: 12,
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 8,
  },
  checkItemText: {
    fontSize: 13,
    color: "#111827",
    flex: 1,
  },
  checkboxOuter: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOuterSelected: {
    borderColor: "#2196f3",
    backgroundColor: "#2196f3",
  },
  doneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2196f3",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
  },
  toggleLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  toggleLabelActive: {
    color: "#EF4444",
  },
  toggleSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    justifyContent: "center",
    padding: 2,
  },
  toggleSwitchActive: {
    borderColor: "#EF4444",
    backgroundColor: "#EF4444",
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#d1d5db",
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: {
    backgroundColor: "#fff",
    transform: [{ translateX: 18 }],
  },
  applyBtn: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  filterPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 6,
    minHeight: 38,
    backgroundColor: "#fff",
  },
  filterPickerText: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: "#111827",
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  popupContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    width: "100%",
    maxHeight: "70%",
    overflow: "hidden",
  },
  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  popupCloseBtn: {
    padding: 4,
  },
  popupScroll: {
    maxHeight: 300,
  },
  popupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  popupItemText: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
  },
  popupDoneBtn: {
    backgroundColor: "#2196f3",
    paddingVertical: 13,
    alignItems: "center",
  },
  popupDoneBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  emptyText: {
    padding: 24,
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  popupSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  popupSearchIcon: {
    marginRight: 6,
  },
  popupSearchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  popupSearchClear: {
    padding: 4,
  },
});

export default Todo;
