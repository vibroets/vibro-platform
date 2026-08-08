import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { DateTimePickerAndroid, DateTimePickerEvent, default as DateTimePicker } from "@react-native-community/datetimepicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { FolderPieChartList, FolderStat } from "@/components/FolderPieChart";
import api from "../../../services";
import { PLANNER_MY_PLANNERS, TRIGGER_FOLLOWUP_TASKS, PLANNER_COLLABORATIVE_OPTION_STATS } from "../../../services/constants";
import { CLOUDINARY_NAME, CLOUDINARY_SIGN } from "../../../constants/forms";
import { uploadToCloudinary } from "../../../services/uploadToCloudinary";
import { useSelector } from "react-redux";

interface PlannerFilters {
  query: string;
  startDate: Date | null;
  endDate: Date | null;
  status: ("all" | "not_started" | "in_progress" | "completed")[];
  location: string[];
  formName: string[];
  plannerId: string[];
  folder: string[];
  sort: "default" | "newest" | "oldest" | "az";
}

const getDefaultFilters = (): PlannerFilters => ({
  query: "",
  startDate: null,
  endDate: null,
  status: ["all"],
  location: [],
  formName: [],
  plannerId: [],
  folder: [],
  sort: "default",
});

interface PlannerAssignment {
  id: number;
  order_id?: string;
  planner_name: string;
  form_id: number;
  form_title: string;
  form_type: string;
  start_date: string;
  end_date: string;
  is_completed: boolean;
  description?: string;
  assign_type: string;
  planner_shared_on: string;
  location?: number | null;
  location_name?: string | null;
  started_by?: string | null;
  started_on?: string | null;
  non_completion_reason?: string | null;
  reason_status?: string | null;
  rejection_reason?: string | null;
  rejection_questions?: any[] | null;
  rejection_answers?: any[] | null;
  extended_due_date?: string | null;
  extension_note?: string | null;
  repeat_enabled?: boolean;
  repeat_interval_days?: number;
  early_notification_days?: number;
  parent_planner_id?: number | null;
  folder_id?: number | null;
  folder_name?: string | null;
  folder_color?: string | null;
  collaborative_enabled?: boolean;
  team_leader?: number | null;
}

interface FilterModalContainerProps {
  children: React.ReactNode;
  insets: { top: number };
}

const FilterModalContainer = ({ children, insets }: FilterModalContainerProps) => {
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView
        style={styles.filterModalContainer}
        behavior="padding"
        keyboardVerticalOffset={insets.top}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={styles.filterModalContainer}>{children}</View>;
};

const PlannerScreen = () => {
  const currentUser = useSelector((state: any) => state.user);
  const [planners, setPlanners] = useState<PlannerAssignment[]>([]);
  const [filteredPlanners, setFilteredPlanners] = useState<PlannerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [reasonPlannerId, setReasonPlannerId] = useState<number | null>(null);
  const [submittingReason, setSubmittingReason] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState<string | null>(null);
  const [rejectionQuestions, setRejectionQuestions] = useState<any[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerQuestionId, setDatePickerQuestionId] = useState<string | null>(null);
  const [startDialogPlanner, setStartDialogPlanner] = useState<PlannerAssignment | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [shareDialogPlanner, setShareDialogPlanner] = useState<PlannerAssignment | null>(null);
  const [shareDialogVisible, setShareDialogVisible] = useState(false);
  const [shareUsers, setShareUsers] = useState<any[]>([]);
  const [shareGroups, setShareGroups] = useState<any[]>([]);
  const [shareLocations, setShareLocations] = useState<any[]>([]);
  const [selectedShareUsers, setSelectedShareUsers] = useState<number[]>([]);
  const [selectedShareGroups, setSelectedShareGroups] = useState<number[]>([]);
  const [selectedShareLocations, setSelectedShareLocations] = useState<number[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [shareTab, setShareTab] = useState<"users" | "groups" | "locations">("users");
  const [plannerTab, setPlannerTab] = useState<"new" | "completed">("new");

  // Filter state
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [filters, setFilters] = useState<PlannerFilters>(getDefaultFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showFormNameModal, setShowFormNameModal] = useState(false);
  const [showPlannerIdModal, setShowPlannerIdModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSortList, setShowSortList] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [formNameSearchQuery, setFormNameSearchQuery] = useState("");
  const [plannerIdSearchQuery, setPlannerIdSearchQuery] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedFormNames, setSelectedFormNames] = useState<string[]>([]);
  const [selectedPlannerIds, setSelectedPlannerIds] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<("all" | "not_started" | "in_progress" | "completed")[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [folders, setFolders] = useState<{id: number; name: string; color: string}[]>([]);
  const [folderStats, setFolderStats] = useState<FolderStat[]>([]);

  // Collaborative audit delegation state
  const [collabModalVisible, setCollabModalVisible] = useState(false);
  const [collabPlanner, setCollabPlanner] = useState<PlannerAssignment | null>(null);
  const [collabData, setCollabData] = useState<any>(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabUsers, setCollabUsers] = useState<{id: number; username: string; email: string}[]>([]);
  const [collabDelegations, setCollabDelegations] = useState<Record<number, number[]>>({});
  const [collabSubmitting, setCollabSubmitting] = useState(false);
  const [optionStats, setOptionStats] = useState<any>(null);
  const [optionStatsLoading, setOptionStatsLoading] = useState(false);
  const [showOptionStats, setShowOptionStats] = useState(false);
  const [groupViewOptionStats, setGroupViewOptionStats] = useState<any>(null);
  const [groupViewOptionStatsLoading, setGroupViewOptionStatsLoading] = useState(false);
  const [showGroupViewOptionStats, setShowGroupViewOptionStats] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [myAssignedGroups, setMyAssignedGroups] = useState<any[]>([]);
  const [collabGroupViewVisible, setCollabGroupViewVisible] = useState(false);
  const [collabGroupViewPlanner, setCollabGroupViewPlanner] = useState<PlannerAssignment | null>(null);
  const [collabGroupViewData, setCollabGroupViewData] = useState<any>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectGroupIds, setRejectGroupIds] = useState<number[]>([]);
  const [collabRefresh, setCollabRefresh] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState<number | null>(null);

  const getDaysUntilDue = (endDate: string): number => {
    const end = parseISO(endDate);
    return differenceInCalendarDays(end, new Date());
  };

  const fetchPlanners = async () => {
    try {
      console.log('[Planner] Fetching planners from:', PLANNER_MY_PLANNERS);
      const [plannersRes, foldersRes, statsRes, myGroupsRes] = await Promise.all([
        api.get<PlannerAssignment[]>(PLANNER_MY_PLANNERS),
        api.get<{id: number; name: string; color: string}[]>("/planner/folders/").catch(() => null),
        api.get<FolderStat[]>("/planner/folder-stats/").catch(() => null),
        api.get<{my_groups: any[]}>(`/planner/collaborative/my-groups/`).catch(() => null),
      ]);
      const data = plannersRes.data;
      console.log('[Planner] Raw response type:', typeof data, 'isArray:', Array.isArray(data), 'length:', Array.isArray(data) ? data.length : 'N/A');
      if (!Array.isArray(data)) {
        console.error('[Planner] Expected array but got:', JSON.stringify(data).substring(0, 200));
        setPlanners([]);
        setFilteredPlanners([]);
        return;
      }
      if (foldersRes) setFolders(foldersRes.data || []);
      if (statsRes) setFolderStats(statsRes.data || []);
      if (myGroupsRes) setMyAssignedGroups(myGroupsRes.data?.my_groups || []);
      console.log('[Planner] Fetched:', data.length, 'planners');
      const sorted = data.sort((a, b) => {
        const daysA = getDaysUntilDue(a.end_date);
        const daysB = getDaysUntilDue(b.end_date);
        return daysA - daysB;
      });
      setPlanners(sorted);
      setFilteredPlanners(sorted);
    } catch (error: any) {
      console.error("[Planner] Error fetching planners:", JSON.stringify(error, null, 2));
      const isTokenExpired = error?.data?.code === "token_not_valid" || error?.status === 401;
      const errMsg = isTokenExpired
        ? "Your session has expired. Please log in again."
        : error?.data?.error || error?.data?.detail || error?.message || "Failed to load planners";
      Alert.alert("Error", String(errMsg));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh planners when screen comes into focus (handles initial load and return from form submission)
  useFocusEffect(
    useCallback(() => {
      fetchPlanners();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlanners();
  };

  // Derive location and form name options from planners
  const locationOptions = useMemo(() => {
    return Array.from(
      new Set(
        planners
          .map(p => p.location_name)
          .filter((v): v is string => !!v && v.trim().length > 0)
          .map(v => v.trim())
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [planners]);

  const formNameOptions = useMemo(() => {
    return Array.from(
      new Set(
        planners
          .map(p => p.form_title)
          .filter((v): v is string => !!v && v.trim().length > 0)
          .map(v => v.trim())
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [planners]);

  const plannerIdOptions = useMemo(() => {
    return Array.from(
      new Set(
        planners
          .map(p => p.order_id || `PLN-${p.id}`)
          .filter((v): v is string => !!v && v.trim().length > 0)
          .map(v => v.trim())
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [planners]);

  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.query ||
      filters.location.length > 0 ||
      filters.formName.length > 0 ||
      filters.plannerId.length > 0 ||
      filters.folder.length > 0 ||
      !filters.status.includes("all") ||
      !!filters.startDate ||
      !!filters.endDate ||
      filters.sort !== "default"
    );
  }, [filters]);

  const clearAllFilters = () => {
    setFilters(getDefaultFilters());
    setSearchQuery("");
  };

  const handleDateChange =
    (type: "startDate" | "endDate") => (event: DateTimePickerEvent, date?: Date) => {
      const isSetEvent = event.type === "set" || event.type === undefined;
      const timestamp = event.nativeEvent?.timestamp;
      const pickedDate = date ?? (timestamp ? new Date(timestamp) : undefined);
      if (!pickedDate || !isSetEvent) return;
      const normalized = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
      setFilters(prev => ({ ...prev, [type]: normalized }));
    };

  const openAndroidDatePicker = (type: "startDate" | "endDate") => {
    const value = type === "startDate" ? filters.startDate || new Date() : filters.endDate || new Date();
    DateTimePickerAndroid.open({
      mode: "date",
      value,
      onChange: handleDateChange(type),
    });
  };

  const getPlannerStatus = (item: PlannerAssignment): "not_started" | "in_progress" | "completed" => {
    if (item.is_completed) return "completed";
    if (item.started_by) return "in_progress";
    return "not_started";
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

  const toDateOnly = (value?: string | number | Date | null) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Apply all filters
  useEffect(() => {
    let filtered = [...planners];

    // Tab filter: "new" = not completed, "completed" = completed
    if (plannerTab === "completed") {
      filtered = filtered.filter(p => p.is_completed);
    } else {
      filtered = filtered.filter(p => !p.is_completed);
    }

    // Search query
    const query = (filters.query || searchQuery || "").trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(p =>
        p.planner_name?.toLowerCase().includes(query) ||
        p.form_title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.order_id?.toLowerCase().includes(query)
      );
    }

    // Location filter
    if (filters.location.length > 0) {
      filtered = filtered.filter(p => {
        const loc = (p.location_name || "").toLowerCase();
        return filters.location.some(f => loc.includes(f.toLowerCase()));
      });
    }

    // Form name filter
    if (filters.formName.length > 0) {
      filtered = filtered.filter(p => {
        const formTitle = (p.form_title || "").toLowerCase();
        return filters.formName.some(f => formTitle.includes(f.toLowerCase()));
      });
    }

    // Planner ID filter
    if (filters.plannerId.length > 0) {
      filtered = filtered.filter(p => {
        const pid = (p.order_id || `PLN-${p.id}` || "").toLowerCase();
        return filters.plannerId.some(f => pid.includes(f.toLowerCase()));
      });
    }

    // Folder filter
    if (filters.folder.length > 0) {
      filtered = filtered.filter(p => {
        const pFolder = (p.folder_name || "").toLowerCase();
        return filters.folder.some(f => pFolder === f.toLowerCase());
      });
    }

    // Status filter
    if (!filters.status.includes("all")) {
      filtered = filtered.filter(p => filters.status.includes(getPlannerStatus(p)));
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(p =>
        isRangeOverlap(
          toDateOnly(p.start_date),
          toDateOnly(p.end_date),
          filters.startDate,
          filters.endDate
        )
      );
    }

    // Sort
    if (filters.sort === "newest") {
      filtered.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    } else if (filters.sort === "oldest") {
      filtered.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    } else if (filters.sort === "az") {
      filtered.sort((a, b) => (a.planner_name || "").localeCompare(b.planner_name || ""));
    } else {
      filtered.sort((a, b) => getDaysUntilDue(a.end_date) - getDaysUntilDue(b.end_date));
    }

    setFilteredPlanners(filtered);
  }, [planners, filters, searchQuery, plannerTab]);

  const getDueBadge = (endDate: string, isCompleted: boolean) => {
    if (isCompleted) return { text: "Completed", color: "#4CAF50", bg: "#E8F5E9" };
    const daysLeft = getDaysUntilDue(endDate);
    if (daysLeft < 0) {
      const overdue = Math.abs(daysLeft);
      return { text: `${overdue} day${overdue !== 1 ? "s" : ""} overdue`, color: "#DC2626", bg: "#FEE2E2" };
    }
    if (daysLeft === 0) return { text: "Due today", color: "#DC2626", bg: "#FEE2E2" };
    if (daysLeft <= 3) return { text: `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`, color: "#DC2626", bg: "#FEE2E2" };
    if (daysLeft <= 7) return { text: `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`, color: "#CA8A04", bg: "#FEF3C7" };
    return { text: `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`, color: "#16A34A", bg: "#DCFCE7" };
  };

  const isOverdue = (endDate: string): boolean => {
    return getDaysUntilDue(endDate) < 0;
  };

  const handleImageUpload = async (questionId: string) => {
    const openCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled) {
        await uploadFile(result.assets[0], questionId, "image");
      }
    };

    const openGallery = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to select photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (!result.canceled) {
        await uploadFile(result.assets[0], questionId, "image");
      }
    };

    Alert.alert("Add Image", "Choose how you want to add an image.", [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: openCamera },
      { text: "Choose from Gallery", onPress: openGallery },
    ]);
  };

  const handleVideoUpload = async (questionId: string) => {
    const openCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to record video.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
      });
      if (!result.canceled) {
        await uploadFile(result.assets[0], questionId, "video");
      }
    };

    const openGallery = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to select videos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
      });
      if (!result.canceled) {
        await uploadFile(result.assets[0], questionId, "video");
      }
    };

    Alert.alert("Add Video", "Choose how you want to add a video.", [
      { text: "Cancel", style: "cancel" },
      { text: "Record Video", onPress: openCamera },
      { text: "Choose from Gallery", onPress: openGallery },
    ]);
  };

  const uploadFile = async (asset: any, questionId: string, type: "image" | "video") => {
    try {
      setUploadingQuestionId(questionId);
      const mimeType = asset.mimeType || asset.type || (type === "video" ? "video/mp4" : "image/jpeg");
      const extension = mimeType.split("/")[1] || (type === "video" ? "mp4" : "jpg");
      const file = {
        uri: asset.uri,
        name: asset.name || `${type}_${Date.now()}.${extension}`,
        type: mimeType,
      };
      const cloudinaryUrl = await uploadToCloudinary(file, CLOUDINARY_SIGN, CLOUDINARY_NAME);
      setQuestionAnswers((prev) => ({ ...prev, [questionId]: cloudinaryUrl }));
      Alert.alert("Success", `${type === "image" ? "Image" : "Video"} uploaded successfully.`);
    } catch (error: any) {
      Alert.alert("Upload Failed", error?.message || "Failed to upload file.");
    } finally {
      setUploadingQuestionId(null);
    }
  };

  const handlePlannerPress = (item: PlannerAssignment) => {
    if (item.is_completed) {
      Alert.alert("Completed", "This planner has been completed and cannot be opened again.");
      return;
    }
    if (isOverdue(item.end_date)) {
      if (item.reason_status === 'rejected' && item.rejection_reason) {
        Alert.alert(
          "Reason Rejected by Admin",
          `Your previous reason was rejected.\n\nAdmin's feedback:\n"${item.rejection_reason}"\n\nPlease submit a new reason for not completing this planner.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Submit New Reason",
              onPress: () => {
                setReasonPlannerId(item.id);
                setReasonText("");
                setRejectionFeedback(item.rejection_reason || null);
                setRejectionQuestions(item.rejection_questions || []);
                setQuestionAnswers({});
                setReasonModalVisible(true);
              },
            },
          ]
        );
        return;
      }
      if (item.non_completion_reason && item.reason_status !== 'rejected') {
        Alert.alert(
          "Reason Already Submitted",
          `You already submitted a reason:\n\n"${item.non_completion_reason}"\n\nThis cannot be edited.`,
          [{ text: "OK", style: "default" }]
        );
        return;
      }
      Alert.alert(
        "You missed the planner",
        "The due date for this planner has passed. Click OK to register the reason for not completing it.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "OK",
            onPress: () => {
              setReasonPlannerId(item.id);
              setReasonText("");
              setReasonModalVisible(true);
            },
          },
        ]
      );
      return;
    }
    // Check if collaborative mode is enabled
    if (item.collaborative_enabled) {
      openCollaborativeFlow(item);
      return;
    }
    setStartDialogPlanner(item);
  };

  // ===== Collaborative Audit Delegation Functions =====

  const openCollaborativeFlow = async (item: PlannerAssignment) => {
    setCollabPlanner(item);
    setSelectedGroupIds(new Set());
    setCollabLoading(true);
    try {
      // Try to get existing collaborative submission
      const res = await api.get(`/planner/${item.id}/collaborative/`);
      if (res.data?.is_team_member) {
        // This user is a team member, not team leader — show their assigned groups
        setCollabGroupViewPlanner(item);
        setCollabGroupViewData(res.data);
        fetchGroupViewOptionStats(item.id);
        setCollabGroupViewVisible(true);
      } else {
        // This user is the team leader
        // If status is DRAFT, call start to transition to IN_PROGRESS + create FormSubmision
        let collabData = res.data;
        if (collabData?.status === 'draft') {
          const startRes = await api.post(`/planner/${item.id}/collaborative/start/`);
          collabData = startRes.data?.collaborative_submission || collabData;
        }
        setCollabData(collabData);
        const existingDelegations: Record<number, number[]> = {};
        (collabData?.group_delegations || []).forEach((d: any) => {
          existingDelegations[d.audit_group] = d.assigned_user_ids || [];
        });
        setCollabDelegations(existingDelegations);
        // Fetch org users for delegation
        const usersRes = await api.get(`/planner/${item.id}/collaborative/users/`);
        setCollabUsers(usersRes.data?.users || []);
        fetchOptionStats(item.id);
        setCollabModalVisible(true);
      }
    } catch (error: any) {
      if (error?.status === 404) {
        // No collaborative submission yet — start it
        await startCollaborative(item);
      } else {
        Alert.alert("Error", error?.message || "Failed to load collaborative audit");
      }
    } finally {
      setCollabLoading(false);
    }
  };

  const fetchOptionStats = async (plannerId: number) => {
    setOptionStatsLoading(true);
    try {
      const res = await api.get(PLANNER_COLLABORATIVE_OPTION_STATS(plannerId));
      setOptionStats(res.data);
    } catch {
      setOptionStats(null);
    } finally {
      setOptionStatsLoading(false);
    }
  };

  const collabRefreshData = async () => {
    if (!collabPlanner) return;
    setCollabRefresh(true);
    try {
      const res = await api.get(`/planner/${collabPlanner.id}/collaborative/`);
      if (res.data?.is_team_member) {
        setCollabGroupViewData(res.data);
      } else {
        setCollabData(res.data);
        const existingDelegations: Record<number, number[]> = {};
        (res.data?.group_delegations || []).forEach((d: any) => {
          existingDelegations[d.audit_group] = d.assigned_user_ids || [];
        });
        setCollabDelegations(existingDelegations);
        fetchOptionStats(collabPlanner.id);
      }
    } catch {
      // ignore refresh errors
    } finally {
      setCollabRefresh(false);
    }
  };

  const fetchGroupViewOptionStats = async (plannerId: number) => {
    setGroupViewOptionStatsLoading(true);
    try {
      const res = await api.get(PLANNER_COLLABORATIVE_OPTION_STATS(plannerId));
      setGroupViewOptionStats(res.data);
    } catch {
      setGroupViewOptionStats(null);
    } finally {
      setGroupViewOptionStatsLoading(false);
    }
  };

  const startCollaborative = async (item: PlannerAssignment) => {
    try {
      setCollabLoading(true);
      setSelectedGroupIds(new Set());
      const res = await api.post(`/planner/${item.id}/collaborative/start/`);
      setCollabData(res.data?.collaborative_submission);
      const existingDelegations: Record<number, number[]> = {};
      (res.data?.collaborative_submission?.group_delegations || []).forEach((d: any) => {
        existingDelegations[d.audit_group] = d.assigned_user_ids || [];
      });
      setCollabDelegations(existingDelegations);
      const usersRes = await api.get(`/planner/${item.id}/collaborative/users/`);
      setCollabUsers(usersRes.data?.users || []);
      fetchOptionStats(item.id);
      setCollabModalVisible(true);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to start collaborative audit");
    } finally {
      setCollabLoading(false);
    }
  };

  const toggleUserForGroup = (groupId: number, userId: number) => {
    setCollabDelegations((prev) => {
      const current = prev[groupId] || [];
      if (current.includes(userId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== userId) };
      }
      return { ...prev, [groupId]: [...current, userId] };
    });
  };

  const submitDelegations = async () => {
    if (!collabPlanner) return;
    try {
      setCollabSubmitting(true);
      const delegations = Object.entries(collabDelegations).map(([groupId, userIds]) => ({
        audit_group_id: parseInt(groupId),
        user_ids: userIds,
      }));
      const res = await api.post(`/planner/${collabPlanner.id}/collaborative/delegate/`, { delegations });
      setCollabData(res.data?.collaborative_submission);
      const results = res.data?.results || [];
      const errors = results.filter((r: any) => r.error);
      if (errors.length > 0) {
        Alert.alert("Partial Success", `${results.length - errors.length} group(s) delegated, ${errors.length} had errors.`);
      } else {
        Alert.alert(
          "Success",
          "Groups delegated successfully. Team members can now see their assigned groups.",
          [{ text: "OK", onPress: () => {
            setCollabModalVisible(false);
            fetchPlanners();
          }}]
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error?.data?.error || error?.message || "Failed to delegate groups");
    } finally {
      setCollabSubmitting(false);
    }
  };

  const reviewGroup = async (action: "approve" | "reject" | "approve_all", groupIds?: number[], comment?: string) => {
    if (!collabPlanner) return;
    try {
      setCollabSubmitting(true);
      const body: any = { action };
      if (groupIds) body.group_delegation_ids = groupIds;
      if (comment) body.rejection_comment = comment;
      const res = await api.post(`/planner/${collabPlanner.id}/collaborative/review/`, body);
      setCollabData(res.data?.collaborative_submission);
      setSelectedGroupIds(new Set());
      setBulkAssignUserId(null);
      const updated = res.data?.updated_groups || [];
      const successCount = updated.filter((g: any) => g.status).length;
      const errorCount = updated.filter((g: any) => g.error).length;
      if (errorCount > 0) {
        Alert.alert("Partial Success", `${successCount} group(s) ${action}d, ${errorCount} skipped (wrong status).`);
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to review groups");
    } finally {
      setCollabSubmitting(false);
    }
  };

  const bulkApprove = () => {
    if (selectedGroupIds.size === 0) return;
    reviewGroup("approve", Array.from(selectedGroupIds));
  };

  const bulkReject = () => {
    if (selectedGroupIds.size === 0) return;
    setRejectGroupIds(Array.from(selectedGroupIds));
    setRejectComment("");
    setRejectModalVisible(true);
  };

  const bulkAssign = async () => {
    if (!collabPlanner || !bulkAssignUserId || selectedGroupIds.size === 0) return;
    const sortedDelegations = [...(collabData?.group_delegations || [])].sort((a: any, b: any) => (a.group_order || 0) - (b.group_order || 0));
    const selectedGroups = sortedDelegations.filter((g: any) => selectedGroupIds.has(g.id));
    const assignableStatuses = ["unassigned", "assigned", "rejected"];
    const assignable = selectedGroups.filter((g: any) => assignableStatuses.includes(g.display_status || g.status));
    const skipped = selectedGroups.filter((g: any) => !assignableStatuses.includes(g.display_status || g.status));

    if (assignable.length === 0) {
      Alert.alert("No assignable groups", "Selected groups are all in progress, submitted, or reviewed and cannot be reassigned.");
      return;
    }

    try {
      setCollabSubmitting(true);
      const delegations = assignable.map((g: any) => ({
        audit_group_id: g.audit_group,
        user_ids: [bulkAssignUserId],
      }));
      const res = await api.post(`/planner/${collabPlanner.id}/collaborative/delegate/`, { delegations });
      setCollabData(res.data?.collaborative_submission);
      const existingDelegations: Record<number, number[]> = {};
      (res.data?.collaborative_submission?.group_delegations || []).forEach((d: any) => {
        existingDelegations[d.audit_group] = d.assigned_user_ids || [];
      });
      setCollabDelegations(existingDelegations);
      setSelectedGroupIds(new Set());
      setBulkAssignUserId(null);
      const msg = `Assigned ${assignable.length} group(s) to user.` + (skipped.length > 0 ? ` ${skipped.length} group(s) skipped (in progress/submitted/reviewed).` : "");
      Alert.alert("Bulk Assign Complete", msg);
    } catch (error: any) {
      Alert.alert("Error", error?.data?.error || error?.message || "Failed to bulk assign");
    } finally {
      setCollabSubmitting(false);
    }
  };

  const confirmReject = () => {
    if (rejectGroupIds.length === 0) return;
    reviewGroup("reject", rejectGroupIds, rejectComment.trim() || "Needs revision");
    setRejectModalVisible(false);
    setRejectComment("");
    setRejectGroupIds([]);
    setBulkAssignUserId(null);
  };

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const completeCollaborative = async () => {
    if (!collabPlanner) return;
    Alert.alert(
      "Complete Audit",
      "Are you sure you want to complete this audit? This will lock all scores and generate the final report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            try {
              setCollabSubmitting(true);
              const completeRes = await api.post(`/planner/${collabPlanner.id}/collaborative/complete/`);
              const collabData = completeRes?.data?.collaborative_submission;
              const formSubmissionId = collabData?.form_submission;
              const formId = collabData?.form_id;

              // Trigger followup tasks for this collaborative audit
              if (formSubmissionId && formId) {
                try {
                  await api.post(TRIGGER_FOLLOWUP_TASKS, {
                    form_id: formId,
                    main_form_submission_id: formSubmissionId,
                    followup_task_form_id: formId,
                  });
                } catch (triggerError: any) {
                  console.warn("Followup task trigger failed:", triggerError?.message);
                }
              }

              Alert.alert("Success", "Collaborative audit completed successfully");
              setCollabModalVisible(false);
              fetchPlanners();
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to complete audit");
            } finally {
              setCollabSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const submitMyGroup = async (delegationId: number, answers: any[]) => {
    if (!collabGroupViewPlanner) return;
    try {
      setCollabSubmitting(true);
      await api.post(`/planner/${collabGroupViewPlanner.id}/collaborative/submit-group/`, {
        group_delegation_id: delegationId,
        answers,
      });
      Alert.alert("Success", "Group submitted successfully");
      // Refresh the group view
      const res = await api.get(`/planner/${collabGroupViewPlanner.id}/collaborative/`);
      setCollabGroupViewData(res.data);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to submit group");
    } finally {
      setCollabSubmitting(false);
    }
  };

  const confirmStartPlanner = async () => {
    if (!startDialogPlanner) return;
    try {
      setIsStarting(true);
      const res = await api.post(`/planner/${startDialogPlanner.id}/start/`);
      // Use the start API response for location info, fall back to planner list data
      const plannerLocationName = res.data?.location_name || startDialogPlanner.location_name || null;
      const plannerLocationId = res.data?.location || startDialogPlanner.location || null;
      const formId = res.data?.form_id || startDialogPlanner.form_id;
      const formTitle = res.data?.form_title || startDialogPlanner.form_title;
      const formType = startDialogPlanner.form_type;
      const orderId = res.data?.order_id || startDialogPlanner.order_id || "";

      setStartDialogPlanner(null);

      const navParams: Record<string, string> = {
        formTitle: String(formTitle),
        formId: String(formId),
        formType: String(formType),
        sourceScreen: 'new',
      };
      if (plannerLocationName) navParams.plannerLocation = String(plannerLocationName);
      if (plannerLocationId) navParams.plannerLocationId = String(plannerLocationId);
      if (orderId) navParams.plannerOrderId = String(orderId);
      navParams.plannerAssignmentId = String(startDialogPlanner.id);

      router.push({
        pathname: "/(app)/(tabs)/forms/multi-stage-form",
        params: navParams,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to start planner");
    } finally {
      setIsStarting(false);
    }
  };

  const handleShareClick = async (planner: PlannerAssignment) => {
    setShareDialogPlanner(planner);
    setShareDialogVisible(true);
    setSelectedShareUsers([]);
    setSelectedShareGroups([]);
    setSelectedShareLocations([]);
    setShareTab("users");
    try {
      const [usersRes, groupsRes, locationsRes] = await Promise.all([
        api.get("/users/list"),
        api.get("/groups/"),
        api.get(`/location/${planner.location || 0}/`),
      ]);
      setShareUsers(usersRes.data || []);
      setShareGroups(groupsRes.data || []);
      setShareLocations(Array.isArray(locationsRes.data) ? locationsRes.data : [locationsRes.data]);
    } catch (error) {
      console.error("Error fetching share options:", error);
    }
  };

  const handleShareSubmit = async () => {
    if (!shareDialogPlanner) return;
    if (selectedShareUsers.length === 0 && selectedShareGroups.length === 0 && selectedShareLocations.length === 0) {
      Alert.alert("Error", "Select at least one user, group, or location");
      return;
    }
    try {
      setIsSharing(true);
      await api.post("/planner/share/", {
        planner_assignment_id: shareDialogPlanner.id,
        users: selectedShareUsers,
        groups: selectedShareGroups,
        leaders: [],
        locations: selectedShareLocations,
      });
      Alert.alert("Success", "Planner shared successfully");
      setShareDialogVisible(false);
      setShareDialogPlanner(null);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to share planner");
    } finally {
      setIsSharing(false);
    }
  };

  const submitReason = async () => {
    if (!reasonText.trim()) {
      Alert.alert("Error", "Please enter a reason");
      return;
    }
    if (!reasonPlannerId) return;
    if (rejectionQuestions.length > 0) {
      const missingRequired = rejectionQuestions.some(q => q.required && !questionAnswers[q.id]?.trim());
      if (missingRequired) {
        Alert.alert("Error", "Please answer all required questions.");
        return;
      }
    }
    setSubmittingReason(true);
    try {
      const payload: any = { reason: reasonText.trim() };
      if (rejectionQuestions.length > 0) {
        payload.answers = rejectionQuestions.map(q => ({
          question_id: q.id,
          question_title: q.title,
          question_type: q.type,
          answer: questionAnswers[q.id] || "",
        }));
      }
      await api.post(`/planner/${reasonPlannerId}/non-completion-reason/`, payload);
      Alert.alert("Success", "Reason recorded successfully");
      setReasonModalVisible(false);
      setReasonText("");
      setReasonPlannerId(null);
      setRejectionFeedback(null);
      setRejectionQuestions([]);
      setQuestionAnswers({});
      fetchPlanners();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit reason");
    } finally {
      setSubmittingReason(false);
    }
  };

  const renderPlannerItem = ({ item }: { item: PlannerAssignment }) => {
    const badge = getDueBadge(item.end_date, item.is_completed);
    const overdue = isOverdue(item.end_date) && !item.is_completed;
    const status = item.is_completed ? "Completed" : (item.started_by ? "In Progress" : "Not Started");
    return (
      <TouchableOpacity
        style={[styles.plannerCard, overdue && styles.overdueCard]}
        onPress={() => handlePlannerPress(item)}
        activeOpacity={0.85}
      >
        {/* Blue header with Planner ID + due badge */}
        <View style={styles.cardTitleBar}>
          <View style={styles.cardTitleRow}>
            <Icon name={overdue ? "error-outline" : "event-note"} size={16} color="#fff" />
            <Text style={styles.cardTitle} numberOfLines={1}>Planner ID: {item.order_id || `PLN-${item.id}`}</Text>
          </View>
          <View style={[styles.dueBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.dueBadgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardExpandedBody}>
          {/* Row 1: Planner No. (left) | WTG Location (right) */}
          <View style={styles.cardInfoRow}>
            <View style={styles.cardInfoCol}>
              <Text style={styles.cardInfoLabelLight}>PLANNER NO.</Text>
              <Text style={styles.cardInfoValueLight} numberOfLines={1}>{item.planner_name}</Text>
              {/* Folder badge + Status below Planner No */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {item.folder_name ? (
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: (item.folder_color || "#6366F1") + "20", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.folder_color || "#6366F1", marginRight: 4 }} />
                    <Text style={{ fontSize: 10, color: item.folder_color || "#6366F1", fontWeight: "600" }} numberOfLines={1}>{item.folder_name}</Text>
                  </View>
                ) : null}
                <View style={[styles.statusBadge, item.is_completed ? styles.statusCompleted : item.started_by ? styles.statusInProgress : styles.statusNotStarted]}>
                  <View style={[styles.statusDot, { backgroundColor: item.is_completed ? "#4CAF50" : item.started_by ? "#2196f3" : "#9CA3AF" }]} />
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardInfoColRight}>
              {item.location_name ? (
                <>
                  <Text style={styles.cardInfoLabelLight}>WTG LOCATION</Text>
                  <Text style={styles.cardInfoValueLight} numberOfLines={1}>{item.location_name}</Text>
                </>
              ) : null}
              {/* Share below WTG Location, right aligned */}
              {!item.is_completed && (
                <TouchableOpacity
                  style={[styles.shareButtonLight, { marginTop: 4, alignSelf: "flex-end" }]}
                  onPress={() => handleShareClick(item)}
                >
                  <Icon name="share" size={13} color="#fff" />
                  <Text style={styles.shareButtonTextLight}>Share</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {overdue && !item.non_completion_reason && item.reason_status !== 'rejected' && (
            <Text style={styles.missedCautionLight} numberOfLines={1}>
              You missed the planner. Tap to register reason.
            </Text>
          )}
          {item.reason_status === 'rejected' && item.rejection_reason && (
            <Text style={styles.rejectedCautionLight} numberOfLines={2}>
              Reason rejected. Tap to submit a new reason.
            </Text>
          )}
          {item.non_completion_reason && (
            <Text style={styles.reasonTextLight} numberOfLines={1}>
              Reason: {item.non_completion_reason}
            </Text>
          )}
          {item.extension_note && (
            <Text style={styles.extensionTextLight} numberOfLines={1}>
              Extended: {item.extension_note}
            </Text>
          )}
          {item.repeat_enabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(168,85,247,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' }}>
              <Icon name="autorenew" size={12} color="#a855f7" />
              <Text style={{ fontSize: 10, color: '#a855f7', marginLeft: 4, fontWeight: '600' }}>
                Repeats every {item.repeat_interval_days || 0} days{item.early_notification_days ? ` · notify ${item.early_notification_days}d early` : ''}
              </Text>
            </View>
          )}
          {item.collaborative_enabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' }}>
              <Icon name="groups" size={12} color="#22c55e" />
              <Text style={{ fontSize: 10, color: '#22c55e', marginLeft: 4, fontWeight: '600' }}>
                Collaborative Audit
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Folder Pie Charts - only on New tab, tap to filter by folder */}
      {plannerTab === "new" && folderStats.length > 0 && (
        <FolderPieChartList
          stats={folderStats}
          activeFolderName={filters.folder.length > 0 ? filters.folder[0] : null}
          onFolderPress={(folderId) => {
            if (folderId === null) {
              setSelectedFolders([]);
              setFilters(prev => ({ ...prev, folder: [] }));
              return;
            }
            const folder = folders.find(f => f.id === folderId);
            if (folder) {
              if (filters.folder.includes(folder.name)) {
                setSelectedFolders([]);
                setFilters(prev => ({ ...prev, folder: [] }));
              } else {
                setSelectedFolders([folder.name]);
                setFilters(prev => ({ ...prev, folder: [folder.name] }));
              }
            }
          }}
        />
      )}

      {/* Tab Navigation + Filter icon */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.plannerTab, plannerTab === "new" && styles.plannerTabActive]}
          onPress={() => setPlannerTab("new")}
          activeOpacity={0.85}
        >
          <Text style={[styles.plannerTabText, plannerTab === "new" && styles.plannerTabTextActive]}>
            NEW
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.plannerTab, plannerTab === "completed" && styles.plannerTabActive]}
          onPress={() => setPlannerTab("completed")}
          activeOpacity={0.85}
        >
          <Text style={[styles.plannerTabText, plannerTab === "completed" && styles.plannerTabTextActive]}>
            COMPLETED
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, showFilters && styles.filterChipActive]}
          onPress={() => setShowFilters(prev => !prev)}
        >
          <Icon name="tune" size={16} color={showFilters ? "#fff" : "#374151"} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF5733" />
        </View>
      ) : (
      <FlatList
        data={filteredPlanners}
        renderItem={renderPlannerItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Icon name="event-note" size={64} color="#E5E7EB" />
            <Text style={styles.emptyText}>{plannerTab === "completed" ? "No completed planners" : "No planners assigned yet"}</Text>
            <Text style={styles.emptySubtext}>
              {plannerTab === "completed" ? "Completed planners will appear here" : "Planners shared with you will appear here"}
            </Text>
          </View>
        }
      />
      )}

      {/* Filter Bottom Sheet */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <FilterModalContainer insets={insets}>
          <TouchableOpacity style={styles.filterBackdrop} onPress={() => setShowFilters(false)} activeOpacity={1} />
          <View style={[styles.filterBottomSheet, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }]}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.filterSheetHeaderBtn}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Filter</Text>
              <TouchableOpacity onPress={clearAllFilters} style={styles.filterSheetHeaderBtn}>
                <Text style={styles.filterResetText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.filterCard}>
                {/* Location */}
                <Text style={styles.filterSectionLabel}>Location</Text>
                <TouchableOpacity style={styles.filterInputRow} onPress={() => { setSelectedLocations(filters.location); setLocationSearchQuery(""); setShowLocationModal(true); }} activeOpacity={0.8}>
                  <Text style={styles.filterInputText}>
                    {filters.location.length === 0 ? "Select Location" : filters.location.length === 1 ? filters.location[0] : `${filters.location.length} locations selected`}
                  </Text>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                {/* Planner ID */}
                <Text style={styles.filterSectionLabel}>Planner ID</Text>
                <TouchableOpacity style={styles.filterInputRow} onPress={() => { setSelectedPlannerIds(filters.plannerId); setPlannerIdSearchQuery(""); setShowPlannerIdModal(true); }} activeOpacity={0.8}>
                  <Text style={styles.filterInputText}>
                    {filters.plannerId.length === 0 ? "Select Planner ID" : filters.plannerId.length === 1 ? filters.plannerId[0] : `${filters.plannerId.length} IDs selected`}
                  </Text>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                {/* Form Name */}
                <Text style={styles.filterSectionLabel}>Form Name</Text>
                <TouchableOpacity style={styles.filterInputRow} onPress={() => { setSelectedFormNames(filters.formName); setFormNameSearchQuery(""); setShowFormNameModal(true); }} activeOpacity={0.8}>
                  <Text style={styles.filterInputText}>
                    {filters.formName.length === 0 ? "Select Form" : filters.formName.length === 1 ? filters.formName[0] : `${filters.formName.length} forms selected`}
                  </Text>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                {/* Folders */}
                <Text style={styles.filterSectionLabel}>Folders</Text>
                <TouchableOpacity style={styles.filterInputRow} onPress={() => { setSelectedFolders(filters.folder); setFolderSearchQuery(""); setShowFolderModal(true); }} activeOpacity={0.8}>
                  <Text style={styles.filterInputText}>
                    {filters.folder.length === 0 ? "Select Folder" : filters.folder.length === 1 ? filters.folder[0] : `${filters.folder.length} folders selected`}
                  </Text>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                {/* Deadline */}
                <Text style={styles.filterSectionLabel}>Deadline</Text>
                <View style={styles.filterDateRow}>
                  <TouchableOpacity style={styles.filterDateButton} onPress={() => openAndroidDatePicker("startDate")}>
                    <Text style={styles.filterDateText}>{filters.startDate ? filters.startDate.toLocaleDateString() : "Start date"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterDateButton} onPress={() => openAndroidDatePicker("endDate")}>
                    <Text style={styles.filterDateText}>{filters.endDate ? filters.endDate.toLocaleDateString() : "End date"}</Text>
                  </TouchableOpacity>
                </View>

                {/* Status */}
                <Text style={styles.filterSectionLabel}>Status</Text>
                <TouchableOpacity style={styles.filterInputRow} onPress={() => { setSelectedStatus(filters.status); setShowStatusModal(true); }}>
                  <Text style={styles.filterInputText}>
                    {filters.status.includes("all") ? "All Status" : filters.status.length === 1 ? filters.status[0].replace("_", " ") : `${filters.status.length} selected`}
                  </Text>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                {/* Sort */}
                <Text style={styles.filterSectionLabel}>Sort</Text>
                <View style={[styles.filterDropdownAnchor, showSortList && styles.filterDropdownOpen]}>
                  <TouchableOpacity style={styles.filterInputRow} onPress={() => setShowSortList(prev => !prev)} activeOpacity={0.8}>
                    <Text style={styles.filterInputText}>
                      {filters.sort === "default" ? "Default" : filters.sort === "newest" ? "Newest" : filters.sort === "oldest" ? "Oldest" : "A-Z"}
                    </Text>
                    <Icon name={showSortList ? "arrow-drop-up" : "arrow-drop-down"} size={24} color="#9ca3af" />
                  </TouchableOpacity>
                  {showSortList && (
                    <View style={styles.filterDropdownList}>
                      {[
                        { value: "default", label: "Default" },
                        { value: "newest", label: "Newest" },
                        { value: "oldest", label: "Oldest" },
                        { value: "az", label: "A-Z" },
                      ].map(option => (
                        <TouchableOpacity key={option.value} style={styles.filterDropdownItem} onPress={() => { setFilters(prev => ({ ...prev, sort: option.value as PlannerFilters["sort"] })); setShowSortList(false); }}>
                          <Text style={styles.filterDropdownText}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </FilterModalContainer>
      </Modal>

      {/* Location Selection Modal */}
      <Modal visible={showLocationModal} transparent animationType="slide" onRequestClose={() => setShowLocationModal(false)}>
        <FilterModalContainer insets={insets}>
          <TouchableOpacity style={styles.filterBackdrop} onPress={() => setShowLocationModal(false)} activeOpacity={1} />
          <View style={[styles.filterBottomSheet, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }]}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setShowLocationModal(false)} style={styles.filterSheetHeaderBtn}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Select Locations</Text>
              <TouchableOpacity onPress={() => { setSelectedLocations([]); setFilters(prev => ({ ...prev, location: [] })); setShowLocationModal(false); }} style={styles.filterSheetHeaderBtn}>
                <Text style={styles.filterResetText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterSearchContainer}>
              <Icon name="search" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput style={styles.filterSearchInput} placeholder="Search locations..." placeholderTextColor="#9ca3af" value={locationSearchQuery} onChangeText={setLocationSearchQuery} />
              {locationSearchQuery.length > 0 && <TouchableOpacity onPress={() => setLocationSearchQuery("")}><Icon name="close" size={20} color="#9ca3af" /></TouchableOpacity>}
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {(locationSearchQuery ? locationOptions.filter(l => l.toLowerCase().includes(locationSearchQuery.toLowerCase())) : locationOptions).length === 0 ? (
                <Text style={styles.filterNoResults}>No locations found</Text>
              ) : (
                (locationSearchQuery ? locationOptions.filter(l => l.toLowerCase().includes(locationSearchQuery.toLowerCase())) : locationOptions).map(loc => {
                  const isSelected = selectedLocations.includes(loc);
                  return (
                    <TouchableOpacity key={loc} style={styles.filterListItem} onPress={() => setSelectedLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])} activeOpacity={0.7}>
                      <Text style={styles.filterListItemText}>{loc}</Text>
                      <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxChecked]}>
                        {isSelected && <Icon name="check" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => { setFilters(prev => ({ ...prev, location: selectedLocations })); setShowLocationModal(false); setShowFilters(false); }}>
              <Text style={styles.filterApplyButtonText}>Apply ({selectedLocations.length} selected)</Text>
            </TouchableOpacity>
          </View>
        </FilterModalContainer>
      </Modal>

      {/* Form Name Selection Modal */}
      <Modal visible={showFormNameModal} transparent animationType="slide" onRequestClose={() => setShowFormNameModal(false)}>
        <FilterModalContainer insets={insets}>
          <TouchableOpacity style={styles.filterBackdrop} onPress={() => setShowFormNameModal(false)} activeOpacity={1} />
          <View style={[styles.filterBottomSheet, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }]}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setShowFormNameModal(false)} style={styles.filterSheetHeaderBtn}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Select Forms</Text>
              <TouchableOpacity onPress={() => { setSelectedFormNames([]); setFilters(prev => ({ ...prev, formName: [] })); setShowFormNameModal(false); }} style={styles.filterSheetHeaderBtn}>
                <Text style={styles.filterResetText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterSearchContainer}>
              <Icon name="search" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput style={styles.filterSearchInput} placeholder="Search forms..." placeholderTextColor="#9ca3af" value={formNameSearchQuery} onChangeText={setFormNameSearchQuery} />
              {formNameSearchQuery.length > 0 && <TouchableOpacity onPress={() => setFormNameSearchQuery("")}><Icon name="close" size={20} color="#9ca3af" /></TouchableOpacity>}
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {(formNameSearchQuery ? formNameOptions.filter(f => f.toLowerCase().includes(formNameSearchQuery.toLowerCase())) : formNameOptions).length === 0 ? (
                <Text style={styles.filterNoResults}>No forms found</Text>
              ) : (
                (formNameSearchQuery ? formNameOptions.filter(f => f.toLowerCase().includes(formNameSearchQuery.toLowerCase())) : formNameOptions).map(form => {
                  const isSelected = selectedFormNames.includes(form);
                  return (
                    <TouchableOpacity key={form} style={styles.filterListItem} onPress={() => setSelectedFormNames(prev => prev.includes(form) ? prev.filter(f => f !== form) : [...prev, form])} activeOpacity={0.7}>
                      <Text style={styles.filterListItemText}>{form}</Text>
                      <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxChecked]}>
                        {isSelected && <Icon name="check" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => { setFilters(prev => ({ ...prev, formName: selectedFormNames })); setShowFormNameModal(false); setShowFilters(false); }}>
              <Text style={styles.filterApplyButtonText}>Apply ({selectedFormNames.length} selected)</Text>
            </TouchableOpacity>
          </View>
        </FilterModalContainer>
      </Modal>

      {/* Planner ID Selection Modal */}
      <Modal visible={showPlannerIdModal} transparent animationType="slide" onRequestClose={() => setShowPlannerIdModal(false)}>
        <FilterModalContainer insets={insets}>
          <TouchableOpacity style={styles.filterBackdrop} onPress={() => setShowPlannerIdModal(false)} activeOpacity={1} />
          <View style={[styles.filterBottomSheet, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }]}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setShowPlannerIdModal(false)} style={styles.filterSheetHeaderBtn}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Select Planner IDs</Text>
              <TouchableOpacity onPress={() => { setSelectedPlannerIds([]); setFilters(prev => ({ ...prev, plannerId: [] })); setShowPlannerIdModal(false); }} style={styles.filterSheetHeaderBtn}>
                <Text style={styles.filterResetText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterSearchContainer}>
              <Icon name="search" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput style={styles.filterSearchInput} placeholder="Search planner IDs..." placeholderTextColor="#9ca3af" value={plannerIdSearchQuery} onChangeText={setPlannerIdSearchQuery} />
              {plannerIdSearchQuery.length > 0 && <TouchableOpacity onPress={() => setPlannerIdSearchQuery("")}><Icon name="close" size={20} color="#9ca3af" /></TouchableOpacity>}
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {(plannerIdSearchQuery ? plannerIdOptions.filter(id => id.toLowerCase().includes(plannerIdSearchQuery.toLowerCase())) : plannerIdOptions).length === 0 ? (
                <Text style={styles.filterNoResults}>No planner IDs found</Text>
              ) : (
                (plannerIdSearchQuery ? plannerIdOptions.filter(id => id.toLowerCase().includes(plannerIdSearchQuery.toLowerCase())) : plannerIdOptions).map(pid => {
                  const isSelected = selectedPlannerIds.includes(pid);
                  return (
                    <TouchableOpacity key={pid} style={styles.filterListItem} onPress={() => setSelectedPlannerIds(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])} activeOpacity={0.7}>
                      <Text style={styles.filterListItemText}>{pid}</Text>
                      <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxChecked]}>
                        {isSelected && <Icon name="check" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => { setFilters(prev => ({ ...prev, plannerId: selectedPlannerIds })); setShowPlannerIdModal(false); setShowFilters(false); }}>
              <Text style={styles.filterApplyButtonText}>Apply ({selectedPlannerIds.length} selected)</Text>
            </TouchableOpacity>
          </View>
        </FilterModalContainer>
      </Modal>

      {/* Folder Selection Modal */}
      <Modal visible={showFolderModal} transparent animationType="slide" onRequestClose={() => setShowFolderModal(false)}>
        <FilterModalContainer insets={insets}>
          <TouchableOpacity style={styles.filterBackdrop} onPress={() => setShowFolderModal(false)} activeOpacity={1} />
          <View style={[styles.filterBottomSheet, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }]}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setShowFolderModal(false)} style={styles.filterSheetHeaderBtn}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Select Folders</Text>
              <TouchableOpacity onPress={() => { setSelectedFolders([]); setFilters(prev => ({ ...prev, folder: [] })); setShowFolderModal(false); }} style={styles.filterSheetHeaderBtn}>
                <Text style={styles.filterResetText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterSearchContainer}>
              <Icon name="search" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
              <TextInput style={styles.filterSearchInput} placeholder="Search folders..." placeholderTextColor="#9ca3af" value={folderSearchQuery} onChangeText={setFolderSearchQuery} />
              {folderSearchQuery.length > 0 && <TouchableOpacity onPress={() => setFolderSearchQuery("")}><Icon name="close" size={20} color="#9ca3af" /></TouchableOpacity>}
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {folders.length === 0 ? (
                <Text style={styles.filterNoResults}>No folders available</Text>
              ) : (
                (folderSearchQuery ? folders.filter(f => f.name.toLowerCase().includes(folderSearchQuery.toLowerCase())) : folders).map(folder => {
                  const isSelected = selectedFolders.includes(folder.name);
                  return (
                    <TouchableOpacity key={folder.id} style={styles.filterListItem} onPress={() => setSelectedFolders(prev => prev.includes(folder.name) ? prev.filter(f => f !== folder.name) : [...prev, folder.name])} activeOpacity={0.7}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: folder.color || "#6366F1", marginRight: 8 }} />
                        <Text style={styles.filterListItemText}>{folder.name}</Text>
                      </View>
                      <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxChecked]}>
                        {isSelected && <Icon name="check" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => { setFilters(prev => ({ ...prev, folder: selectedFolders })); setShowFolderModal(false); setShowFilters(false); }}>
              <Text style={styles.filterApplyButtonText}>Apply ({selectedFolders.length} selected)</Text>
            </TouchableOpacity>
          </View>
        </FilterModalContainer>
      </Modal>

      {/* Status Selection Modal */}
      <Modal visible={showStatusModal} transparent animationType="slide" onRequestClose={() => setShowStatusModal(false)}>
        <FilterModalContainer insets={insets}>
          <TouchableOpacity style={styles.filterBackdrop} onPress={() => setShowStatusModal(false)} activeOpacity={1} />
          <View style={[styles.filterBottomSheet, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }]}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <TouchableOpacity onPress={() => setShowStatusModal(false)} style={styles.filterSheetHeaderBtn}>
                <Icon name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.filterSheetTitle}>Select Status</Text>
              <TouchableOpacity onPress={() => { setSelectedStatus(["all"]); setFilters(prev => ({ ...prev, status: ["all"] })); setShowStatusModal(false); }} style={styles.filterSheetHeaderBtn}>
                <Text style={styles.filterResetText}>Reset</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {[
                { value: "all", label: "All Status" },
                { value: "not_started", label: "Not Started" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
              ].map(option => {
                const isSelected = selectedStatus.includes(option.value as any);
                return (
                  <TouchableOpacity key={option.value} style={styles.filterListItem} onPress={() => {
                    setSelectedStatus(prev => {
                      if (option.value === "all") return ["all"];
                      if (prev.includes(option.value as any)) {
                        const next = prev.filter(s => s !== option.value);
                        return next.length === 0 ? ["all"] : next;
                      }
                      return [...prev.filter(s => s !== "all"), option.value as any];
                    });
                  }} activeOpacity={0.7}>
                    <Text style={styles.filterListItemText}>{option.label}</Text>
                    <View style={[styles.filterCheckbox, isSelected && styles.filterCheckboxChecked]}>
                      {isSelected && <Icon name="check" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => { setFilters(prev => ({ ...prev, status: selectedStatus })); setShowStatusModal(false); setShowFilters(false); }}>
              <Text style={styles.filterApplyButtonText}>Apply ({selectedStatus.length} selected)</Text>
            </TouchableOpacity>
          </View>
        </FilterModalContainer>
      </Modal>

      <Modal
        visible={reasonModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reason for Not Completing</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for not completing this planner on time.
            </Text>
            {rejectionFeedback && (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionLabel}>Admin's Feedback:</Text>
                <Text style={styles.rejectionText}>{rejectionFeedback}</Text>
              </View>
            )}
            <ScrollView style={{ flex: 1 }}>
              {rejectionQuestions.length > 0 && (
                <View style={styles.questionsContainer}>
                  <Text style={styles.questionsTitle}>Please answer the following questions:</Text>
                  {rejectionQuestions.map((q, qIdx) => (
                    <View key={q.id} style={styles.questionItem}>
                      <Text style={styles.questionTitle}>
                        {qIdx + 1}. {q.title}
                        {q.required && <Text style={styles.requiredStar}> *</Text>}
                      </Text>

                      {/* short_answer */}
                      {q.type === "short_answer" && (
                        <TextInput
                          style={styles.questionInput}
                          value={questionAnswers[q.id] || ""}
                          onChangeText={(text) => setQuestionAnswers({ ...questionAnswers, [q.id]: text })}
                          placeholder="Your answer..."
                        />
                      )}

                      {/* long_answer */}
                      {q.type === "long_answer" && (
                        <TextInput
                          style={[styles.questionInput, styles.questionInputMultiline]}
                          multiline={true}
                          numberOfLines={3}
                          value={questionAnswers[q.id] || ""}
                          onChangeText={(text) => setQuestionAnswers({ ...questionAnswers, [q.id]: text })}
                          placeholder="Your answer..."
                          textAlignVertical="top"
                        />
                      )}

                      {/* multiple_choice */}
                      {q.type === "multiple_choice" && (q.options || []).map((opt: string, oIdx: number) => (
                        <TouchableOpacity
                          key={oIdx}
                          style={styles.choiceItem}
                          onPress={() => setQuestionAnswers({ ...questionAnswers, [q.id]: opt })}
                        >
                          <View style={[styles.radioOuter, questionAnswers[q.id] === opt && styles.radioOuterSelected]}>
                            {questionAnswers[q.id] === opt && <View style={styles.radioInner} />}
                          </View>
                          <Text style={styles.choiceText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}

                      {/* checkboxes */}
                      {q.type === "checkboxes" && (q.options || []).map((opt: string, oIdx: number) => {
                        const current = (questionAnswers[q.id] || "").split("||").filter(Boolean);
                        const isChecked = current.includes(opt);
                        return (
                          <TouchableOpacity
                            key={oIdx}
                            style={styles.choiceItem}
                            onPress={() => {
                              const newVals = isChecked
                                ? current.filter(v => v !== opt)
                                : [...current, opt];
                              setQuestionAnswers({ ...questionAnswers, [q.id]: newVals.join("||") });
                            }}
                          >
                            <View style={[styles.checkboxOuter, isChecked && styles.checkboxOuterSelected]}>
                              {isChecked && <Icon name="check" size={16} color="#fff" />}
                            </View>
                            <Text style={styles.choiceText}>{opt}</Text>
                          </TouchableOpacity>
                        );
                      })}

                      {/* dropdown */}
                      {q.type === "dropdown" && (
                        <View>
                          {(q.options || []).map((opt: string, oIdx: number) => (
                            <TouchableOpacity
                              key={oIdx}
                              style={[
                                styles.dropdownItem,
                                questionAnswers[q.id] === opt && styles.dropdownItemSelected,
                              ]}
                              onPress={() => setQuestionAnswers({ ...questionAnswers, [q.id]: opt })}
                            >
                              <Text style={[
                                styles.dropdownText,
                                questionAnswers[q.id] === opt && styles.dropdownTextSelected,
                              ]}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* date */}
                      {q.type === "date" && (
                        <View>
                          <TouchableOpacity
                            style={[styles.questionInput, { flexDirection: "row", alignItems: "center", gap: 8 }]}
                            onPress={() => {
                              setDatePickerQuestionId(q.id);
                              setShowDatePicker(true);
                            }}
                          >
                            <Text style={questionAnswers[q.id] ? styles.datePickerText : styles.datePickerPlaceholder}>
                              {questionAnswers[q.id] || "Select a date"}
                            </Text>
                            <Icon name="calendar-today" size={18} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* rating */}
                      {q.type === "rating" && (
                        <View style={styles.ratingRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                              key={star}
                              onPress={() => setQuestionAnswers({ ...questionAnswers, [q.id]: String(star) })}
                            >
                              <Icon
                                name={parseInt(questionAnswers[q.id] || "0") >= star ? "star" : "star-border"}
                                size={28}
                                color={parseInt(questionAnswers[q.id] || "0") >= star ? "#FFD700" : "#D1D5DB"}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* file_upload (image) */}
                      {q.type === "file_upload" && (
                        <View>
                          {questionAnswers[q.id] ? (
                            <View style={styles.uploadedFileContainer}>
                              <Image
                                source={{ uri: questionAnswers[q.id] }}
                                style={styles.uploadedImage}
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                style={styles.removeUploadButton}
                                onPress={() => setQuestionAnswers((prev) => ({ ...prev, [q.id]: "" }))}
                              >
                                <Icon name="close" size={18} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ) : uploadingQuestionId === q.id ? (
                            <View style={styles.uploadButton}>
                              <ActivityIndicator size="small" color="#2196f3" />
                              <Text style={styles.uploadText}>Uploading...</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={() => handleImageUpload(q.id)}
                            >
                              <Icon name="image" size={24} color="#6B7280" />
                              <Text style={styles.uploadText}>Tap to upload image</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* video_upload */}
                      {q.type === "video_upload" && (
                        <View>
                          {questionAnswers[q.id] ? (
                            <View style={styles.uploadedFileContainer}>
                              <Icon name="videocam" size={32} color="#16A34A" />
                              <Text style={styles.uploadedFileName} numberOfLines={1}>
                                Video uploaded successfully
                              </Text>
                              <TouchableOpacity
                                style={styles.removeUploadButton}
                                onPress={() => setQuestionAnswers((prev) => ({ ...prev, [q.id]: "" }))}
                              >
                                <Icon name="close" size={18} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ) : uploadingQuestionId === q.id ? (
                            <View style={styles.uploadButton}>
                              <ActivityIndicator size="small" color="#2196f3" />
                              <Text style={styles.uploadText}>Uploading...</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.uploadButton}
                              onPress={() => handleVideoUpload(q.id)}
                            >
                              <Icon name="videocam" size={24} color="#6B7280" />
                              <Text style={styles.uploadText}>Tap to upload video</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.reasonLabel}>Your Reason for Not Completing</Text>
              <TextInput
                style={styles.reasonInput}
                multiline={true}
                numberOfLines={4}
                value={reasonText}
                onChangeText={setReasonText}
                placeholder="Enter your reason here..."
                textAlignVertical="top"
              />
            </ScrollView>
            {showDatePicker && (
              <DateTimePicker
                value={(() => {
                  const current = questionAnswers[datePickerQuestionId || ""];
                  if (current) {
                    const parsed = new Date(current);
                    if (!isNaN(parsed.getTime())) return parsed;
                  }
                  return new Date();
                })()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (event.type === "set" && selectedDate && datePickerQuestionId) {
                    const yyyy = selectedDate.getFullYear();
                    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                    const dd = String(selectedDate.getDate()).padStart(2, "0");
                    const formatted = `${yyyy}-${mm}-${dd}`;
                    setQuestionAnswers((prev) => ({ ...prev, [datePickerQuestionId]: formatted }));
                  }
                  setDatePickerQuestionId(null);
                }}
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setReasonModalVisible(false);
                  setReasonText("");
                  setReasonPlannerId(null);
                  setRejectionFeedback(null);
                  setRejectionQuestions([]);
                  setQuestionAnswers({});
                }}
                disabled={submittingReason}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmitButton]}
                onPress={submitReason}
                disabled={submittingReason}
              >
                <Text style={styles.modalSubmitText}>
                  {submittingReason ? "Submitting..." : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Confirmation Dialog */}
      <Modal
        visible={!!startDialogPlanner}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStartDialogPlanner(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <Text style={styles.modalTitle}>Start Planner</Text>
            <Text style={styles.modalSubtitle}>
              You are about to start{"\n"}
              <Text style={{ fontWeight: "700" }}>{startDialogPlanner?.order_id || `PLN-${startDialogPlanner?.id}`}</Text>
              {": "}
              {startDialogPlanner?.planner_name}
            </Text>

            <View style={styles.confirmDetailRow}>
              <Icon name="description" size={18} color="#6B7280" />
              <Text style={styles.confirmDetailText}>Form: <Text style={{ fontWeight: "600" }}>{startDialogPlanner?.form_title}</Text></Text>
            </View>

            {startDialogPlanner?.location_name ? (
              <View style={styles.confirmDetailRow}>
                <Icon name="place" size={18} color="#6B7280" />
                <Text style={styles.confirmDetailText}>Location: <Text style={{ fontWeight: "600" }}>{startDialogPlanner.location_name}</Text> (locked)</Text>
              </View>
            ) : null}

            <View style={styles.confirmDetailRow}>
              <Icon name="event" size={18} color="#6B7280" />
              <Text style={styles.confirmDetailText}>End date: <Text style={{ fontWeight: "600" }}>{startDialogPlanner ? new Date(startDialogPlanner.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ""}</Text></Text>
            </View>

            <Text style={styles.confirmNote}>Clicking "Confirm & Start" will start the planner and open the form for you to fill out.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setStartDialogPlanner(null)}
                disabled={isStarting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmitButton]}
                onPress={confirmStartPlanner}
                disabled={isStarting}
              >
                <Text style={styles.modalSubmitText}>
                  {isStarting ? "Starting..." : "Confirm & Start"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Dialog */}
      <Modal
        visible={shareDialogVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShareDialogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>Share Planner</Text>
            <Text style={styles.modalSubtitle}>
              Share <Text style={{ fontWeight: "700" }}>{shareDialogPlanner?.planner_name}</Text> with users, groups, or locations.
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
              <TouchableOpacity
                style={[styles.shareTab, shareTab === "locations" && styles.shareTabActive]}
                onPress={() => setShareTab("locations")}
              >
                <Text style={[styles.shareTabText, shareTab === "locations" && styles.shareTabTextActive]}>Locations</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, maxHeight: 300 }}>
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
              {shareTab === "locations" && (
                shareLocations.length === 0 ? (
                  <Text style={styles.shareEmptyText}>No locations available</Text>
                ) : shareLocations.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={styles.shareItem}
                    onPress={() => {
                      if (selectedShareLocations.includes(l.id)) {
                        setSelectedShareLocations(selectedShareLocations.filter(id => id !== l.id));
                      } else {
                        setSelectedShareLocations([...selectedShareLocations, l.id]);
                      }
                    }}
                  >
                    <View style={[styles.checkboxOuter, selectedShareLocations.includes(l.id) && styles.checkboxOuterSelected]}>
                      {selectedShareLocations.includes(l.id) && <Icon name="check" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.shareItemText}>{l.name}</Text>
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

      {/* ===== Collaborative: Team Leader Full-Page Screen ===== */}
      <Modal
        visible={collabModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => { setCollabModalVisible(false); setSelectedGroupIds(new Set()); setShowOptionStats(false); setOptionStats(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>Collaborative Audit</Text>
            <TouchableOpacity onPress={() => { setCollabModalVisible(false); setSelectedGroupIds(new Set()); setShowOptionStats(false); setOptionStats(null); }}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {/* Body */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              Tap submitted groups to select. Assign users, then bulk approve/reject.
            </Text>
            {collabData && (
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: "#374151", fontWeight: "600" }}>
                    {collabData.completed_groups || 0}/{collabData.total_groups || 0} done
                  </Text>
                  <Text style={{ fontSize: 11, color: "#6B7280" }}>{collabData.completion_percentage || 0}%</Text>
                </View>
                <View style={{ height: 5, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${collabData.completion_percentage || 0}%`, backgroundColor: (collabData.completion_percentage || 0) === 100 ? "#4CAF50" : "#2196f3" }} />
                </View>
                {/* Option-wise overall stats */}
                {optionStatsLoading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                    <ActivityIndicator size="small" color="#2196f3" />
                    <Text style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 6 }}>Loading option stats...</Text>
                  </View>
                ) : optionStats && (() => {
                  const merged: Record<string, {count: number; failed: boolean}> = {};
                  for (const o of (optionStats.options || [])) {
                    if (o.count > 0) {
                      const key = o.option || String(o.id);
                      if (!merged[key]) merged[key] = {count: 0, failed: !!o.failed};
                      merged[key].count += o.count;
                    }
                  }
                  const entries = Object.entries(merged);
                  const total = entries.reduce((s, [, v]) => s + v.count, 0);
                  if (entries.length === 0) return null;
                  return (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {entries.map(([optName, info], idx) => {
                        const pct = total > 0 ? Math.round((info.count / total) * 100) : 0;
                        const badgeColor = info.failed ? "#EF4444" : optName?.toLowerCase().includes("ok") && !optName?.toLowerCase().includes("not") ? "#4CAF50" : "#F59E0B";
                        return (
                          <View key={`opt-${idx}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: badgeColor + "15", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badgeColor, marginRight: 4 }} />
                            <Text style={{ fontSize: 9, color: "#374151", fontWeight: "600" }}>{optName}: {info.count} ({pct}%)</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            )}
            {!collabLoading && (collabData?.group_delegations || []).length > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingHorizontal: 2 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center" }}
                  onPress={() => {
                    const allIds = new Set<number>((collabData?.group_delegations || []).map((g: any) => g.id as number));
                    if (selectedGroupIds.size === allIds.size) {
                      setSelectedGroupIds(new Set());
                    } else {
                      setSelectedGroupIds(allIds);
                    }
                  }}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: selectedGroupIds.size === (collabData?.group_delegations || []).length ? "#2196f3" : "#D1D5DB", backgroundColor: selectedGroupIds.size === (collabData?.group_delegations || []).length ? "#2196f3" : "transparent", marginRight: 6, justifyContent: "center", alignItems: "center" }}>
                    {selectedGroupIds.size === (collabData?.group_delegations || []).length && <Icon name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151" }}>
                    {selectedGroupIds.size === (collabData?.group_delegations || []).length ? "Deselect All" : "Select All"}
                  </Text>
                </TouchableOpacity>
                {selectedGroupIds.size > 0 && (
                  <Text style={{ fontSize: 11, color: "#6B7280" }}>{selectedGroupIds.size} selected</Text>
                )}
              </View>
            )}
            {collabLoading ? (
              <ActivityIndicator size="large" color="#2196f3" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                refreshControl={
                  <RefreshControl
                    refreshing={collabRefresh}
                    onRefresh={collabRefreshData}
                    tintColor="#2196f3"
                    colors={["#2196f3"]}
                  />
                }
              >
                {[...(collabData?.group_delegations || [])].sort((a: any, b: any) => (a.group_order || 0) - (b.group_order || 0)).map((group: any) => {
                  const groupId = group.audit_group;
                  const selectedUserIds = collabDelegations[groupId] || [];
                  const isSelected = selectedGroupIds.has(group.id);
                  const displayStatus = group.display_status || group.status;
                  const answered = group.answered_count || 0;
                  const total = group.total_questions || 0;
                  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
                  const statusColors: Record<string, string> = { unassigned: "#9CA3AF", assigned: "#2196f3", in_progress: "#8B5CF6", submitted: "#f59e0b", reviewed: "#4CAF50", rejected: "#ef4444" };
                  const statusColor = statusColors[displayStatus] || "#9CA3AF";
                  const canSelect = true;
                  return (
                    <View key={group.id} style={{ marginBottom: 8, borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? "#2196f3" : "#E5E7EB", borderRadius: 8, padding: 10, backgroundColor: isSelected ? "#EFF6FF" : "#fff" }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }} onPress={() => canSelect && toggleGroupSelection(group.id)}>
                          {canSelect && (
                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: isSelected ? "#2196f3" : "#D1D5DB", backgroundColor: isSelected ? "#2196f3" : "transparent", marginRight: 8, justifyContent: "center", alignItems: "center" }}>
                              {isSelected && <Icon name="check" size={12} color="#fff" />}
                            </View>
                          )}
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", flexShrink: 1 }} numberOfLines={1}>
                            {group.audit_group_name || `Group ${group.group_order}`}
                          </Text>
                        </TouchableOpacity>
                        <View style={{ backgroundColor: statusColor + "20", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, color: statusColor, fontWeight: "700" }}>{displayStatus?.toUpperCase().replace(/_/g, " ")}</Text>
                        </View>
                      </View>
                      {total > 0 && (
                        <View style={{ marginTop: 6 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                            <Text style={{ fontSize: 10, color: "#6B7280" }}>{answered}/{total} answered</Text>
                            <Text style={{ fontSize: 10, color: "#6B7280" }}>{progressPct}%</Text>
                          </View>
                          <View style={{ height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
                            <View style={{ height: "100%", width: `${progressPct}%`, backgroundColor: progressPct === 100 ? "#4CAF50" : statusColor, borderRadius: 2 }} />
                          </View>
                          {/* Per-group option-wise stats */}
                          {optionStats && (() => {
                            const groupOpts = (optionStats.per_group || []).filter((g: any) => g.audit_group_id === group.audit_group);
                            const merged: Record<string, {count: number; failed: boolean; id: number}> = {};
                            for (const g of groupOpts) {
                              for (const o of (g.options || [])) {
                                if (o.count > 0) {
                                  const key = o.option || String(o.id);
                                  if (!merged[key]) merged[key] = {count: 0, failed: !!o.failed, id: o.id};
                                  merged[key].count += o.count;
                                }
                              }
                            }
                            const entries = Object.entries(merged);
                            if (entries.length === 0) return null;
                            return (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                                {entries.map(([optName, info], idx) => {
                                  const badgeColor = info.failed ? "#EF4444" : optName?.toLowerCase().includes("ok") && !optName?.toLowerCase().includes("not") ? "#4CAF50" : "#F59E0B";
                                  return (
                                    <View key={`opt-${idx}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: badgeColor + "15", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: badgeColor, marginRight: 3 }} />
                                      <Text style={{ fontSize: 8, color: "#374151", fontWeight: "600" }}>{optName}: {info.count}</Text>
                                    </View>
                                  );
                                })}
                              </View>
                            );
                          })()}
                        </View>
                      )}
                      {displayStatus === "submitted" && group.submitted_by_name && (
                        <Text style={{ fontSize: 10, color: "#6B7280", marginTop: 4 }}>By {group.submitted_by_name}</Text>
                      )}
                      {displayStatus === "rejected" && group.rejection_comment && (
                        <Text style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }} numberOfLines={1}>Rejected: {group.rejection_comment}</Text>
                      )}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {collabUsers.map((user) => {
                          const isUserSelected = selectedUserIds.includes(user.id);
                          return (
                            <TouchableOpacity key={user.id} onPress={() => toggleUserForGroup(groupId, user.id)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: isUserSelected ? "#2196f3" : "#F3F4F6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Icon name={isUserSelected ? "check-circle" : "person-outline"} size={10} color={isUserSelected ? "#fff" : "#6B7280"} />
                              <Text style={{ fontSize: 10, color: isUserSelected ? "#fff" : "#374151", marginLeft: 3, fontWeight: "500" }}>{user.username}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        {collabUsers.length === 0 && <Text style={{ fontSize: 10, color: "#9CA3AF", fontStyle: "italic" }}>No users available</Text>}
                      </View>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                        {/* Fill/Continue button — only if current user is assigned to this group */}
                        {selectedUserIds.includes(currentUser?.id) && (displayStatus === "assigned" || displayStatus === "unassigned" || displayStatus === "rejected" || displayStatus === "in_progress") && (
                          <TouchableOpacity style={{ backgroundColor: "#2196f3", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} onPress={() => {
                            setCollabModalVisible(false);
                            const navParams: Record<string, string> = { formTitle: collabData?.form_title || "", formId: String(collabData?.form_id || collabPlanner?.form_id || ""), formType: "audit", sourceScreen: "collaborative", collaborativeSubmissionId: String(collabData?.id || ""), groupDelegationId: String(group.id), groupDelegationStatus: String(group.status || ""), auditGroupId: String(group.audit_group || ""), plannerAssignmentId: String(collabPlanner?.id || "") };
                            if (collabData?.form_submission) navParams.submissionId = String(collabData.form_submission);
                            if (collabPlanner?.location_name) navParams.plannerLocation = collabPlanner.location_name;
                            if (collabPlanner?.location) navParams.plannerLocationId = String(collabPlanner.location);
                            router.push({ pathname: "/(app)/(tabs)/forms/multi-stage-form", params: navParams });
                          }}>
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>{displayStatus === "in_progress" ? "Continue" : "Fill"}</Text>
                          </TouchableOpacity>
                        )}
                        {/* View button for in_progress groups — leader can view even if not assigned */}
                        {displayStatus === "in_progress" && !selectedUserIds.includes(currentUser?.id) && (
                          <TouchableOpacity style={{ backgroundColor: "#6366F1", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} onPress={() => {
                            setCollabModalVisible(false);
                            const navParams: Record<string, string> = { formTitle: collabData?.form_title || "", formId: String(collabData?.form_id || collabPlanner?.form_id || ""), formType: "audit", sourceScreen: "collaborative", collaborativeSubmissionId: String(collabData?.id || ""), groupDelegationId: String(group.id), groupDelegationStatus: String(group.status || ""), auditGroupId: String(group.audit_group || ""), plannerAssignmentId: String(collabPlanner?.id || "") };
                            if (collabData?.form_submission) navParams.submissionId = String(collabData.form_submission);
                            if (collabPlanner?.location_name) navParams.plannerLocation = collabPlanner.location_name;
                            if (collabPlanner?.location) navParams.plannerLocationId = String(collabPlanner.location);
                            router.push({ pathname: "/(app)/(tabs)/forms/multi-stage-form", params: navParams });
                          }}>
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>View</Text>
                          </TouchableOpacity>
                        )}
                        {/* Submitted groups: View + Approve + Reject always visible */}
                        {displayStatus === "submitted" && (
                          <>
                            <TouchableOpacity style={{ backgroundColor: "#6366F1", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} onPress={() => {
                              setCollabModalVisible(false);
                              const navParams: Record<string, string> = { formTitle: collabData?.form_title || "", formId: String(collabData?.form_id || collabPlanner?.form_id || ""), formType: "audit", sourceScreen: "collaborative", collaborativeSubmissionId: String(collabData?.id || ""), groupDelegationId: String(group.id), groupDelegationStatus: String(group.status || ""), auditGroupId: String(group.audit_group || ""), plannerAssignmentId: String(collabPlanner?.id || "") };
                              if (collabData?.form_submission) navParams.submissionId = String(collabData.form_submission);
                              if (collabPlanner?.location_name) navParams.plannerLocation = collabPlanner.location_name;
                              if (collabPlanner?.location) navParams.plannerLocationId = String(collabPlanner.location);
                              router.push({ pathname: "/(app)/(tabs)/forms/multi-stage-form", params: navParams });
                            }}>
                              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>View</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ backgroundColor: "#4CAF50", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} onPress={() => reviewGroup("approve", [group.id])} disabled={collabSubmitting}>
                              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ backgroundColor: "#ef4444", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} onPress={() => { setRejectGroupIds([group.id]); setRejectComment(""); setRejectModalVisible(true); }} disabled={collabSubmitting}>
                              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Reject</Text>
                            </TouchableOpacity>
                          </>
                        )}
                        {displayStatus === "reviewed" && (
                          <TouchableOpacity style={{ backgroundColor: "#6366F1", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }} onPress={() => {
                            setCollabModalVisible(false);
                            const navParams: Record<string, string> = { formTitle: collabData?.form_title || "", formId: String(collabData?.form_id || collabPlanner?.form_id || ""), formType: "audit", sourceScreen: "collaborative", collaborativeSubmissionId: String(collabData?.id || ""), groupDelegationId: String(group.id), groupDelegationStatus: String(group.status || ""), auditGroupId: String(group.audit_group || ""), plannerAssignmentId: String(collabPlanner?.id || "") };
                            if (collabData?.form_submission) navParams.submissionId = String(collabData.form_submission);
                            if (collabPlanner?.location_name) navParams.plannerLocation = collabPlanner.location_name;
                            if (collabPlanner?.location) navParams.plannerLocationId = String(collabPlanner.location);
                            router.push({ pathname: "/(app)/(tabs)/forms/multi-stage-form", params: navParams });
                          }}>
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>View</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
          {/* Bottom Bar */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
            {collabData && (
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: "#6B7280" }}>Status: <Text style={{ fontWeight: "600", color: "#111827" }}>{collabData.status?.replace(/_/g, " ")}</Text></Text>
                  {selectedGroupIds.size > 0 && (
                    <Text style={{ fontSize: 11, color: "#2196f3", fontWeight: "600" }}>{selectedGroupIds.size} selected</Text>
                  )}
                </View>
                {selectedGroupIds.size > 0 && (
                  <View>
                    {/* Bulk Assign: user picker + Assign button */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                      <Text style={{ fontSize: 11, color: "#374151", fontWeight: "600" }}>Bulk assign to:</Text>
                      {collabUsers.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          onPress={() => setBulkAssignUserId(bulkAssignUserId === user.id ? null : user.id)}
                          style={{ flexDirection: "row", alignItems: "center", backgroundColor: bulkAssignUserId === user.id ? "#2196f3" : "#F3F4F6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}
                        >
                          <Icon name={bulkAssignUserId === user.id ? "check-circle" : "person-outline"} size={10} color={bulkAssignUserId === user.id ? "#fff" : "#6B7280"} />
                          <Text style={{ fontSize: 10, color: bulkAssignUserId === user.id ? "#fff" : "#374151", marginLeft: 3, fontWeight: "500" }}>{user.username}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {/* Action buttons row */}
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {bulkAssignUserId && (
                        <TouchableOpacity style={{ backgroundColor: "#2196f3", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }} onPress={bulkAssign} disabled={collabSubmitting}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{collabSubmitting ? "Assigning..." : "Assign"}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={{ backgroundColor: "#4CAF50", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }} onPress={bulkApprove} disabled={collabSubmitting}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: "#ef4444", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }} onPress={bulkReject} disabled={collabSubmitting}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: "#E5E7EB", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }} onPress={() => { setSelectedGroupIds(new Set()); setBulkAssignUserId(null); }}>
                        <Text style={{ color: "#374151", fontSize: 11, fontWeight: "600" }}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 12, alignItems: "center" }} onPress={() => { setCollabModalVisible(false); setSelectedGroupIds(new Set()); }} disabled={collabSubmitting}>
                <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "#2196f3", borderRadius: 8, paddingVertical: 12, alignItems: "center" }} onPress={submitDelegations} disabled={collabSubmitting}>
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{collabSubmitting ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
              {collabData?.status === "ready_for_review" && (() => {
                const allReviewed = (collabData?.group_delegations || []).every((g: any) => g.status === "reviewed" || g.display_status === "reviewed");
                const pendingCount = (collabData?.group_delegations || []).filter((g: any) => g.status !== "reviewed" && g.display_status !== "reviewed").length;
                return (
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: allReviewed ? "#059669" : "#9CA3AF", borderRadius: 8, paddingVertical: 12, alignItems: "center" }}
                    onPress={() => {
                      if (!allReviewed) {
                        Alert.alert("Approval Pending", `${pendingCount} group(s) still need to be reviewed/approved before completing the audit.`);
                        return;
                      }
                      completeCollaborative();
                    }}
                    disabled={collabSubmitting}
                  >
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Complete</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ===== Rejection Comment Modal ===== */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ width: "85%", backgroundColor: "#fff", borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 8 }}>Reject Group{rejectGroupIds.length > 1 ? "s" : ""}</Text>
            <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Enter reason for rejection:</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827", minHeight: 80, textAlignVertical: "top" }}
              placeholder="Rejection reason..."
              value={rejectComment}
              onChangeText={setRejectComment}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 10, alignItems: "center" }} onPress={() => { setRejectModalVisible(false); setRejectComment(""); setRejectGroupIds([]); }}>
                <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "#ef4444", borderRadius: 8, paddingVertical: 10, alignItems: "center" }} onPress={confirmReject} disabled={collabSubmitting}>
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{collabSubmitting ? "Rejecting..." : "Reject"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Collaborative: Team Member Full-Page Screen ===== */}
      <Modal
        visible={collabGroupViewVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => { setCollabGroupViewVisible(false); setShowGroupViewOptionStats(false); setGroupViewOptionStats(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>My Assigned Groups</Text>
            <TouchableOpacity onPress={() => { setCollabGroupViewVisible(false); setShowGroupViewOptionStats(false); setGroupViewOptionStats(null); }}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {/* Body */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              {collabGroupViewData?.planner_name || collabGroupViewPlanner?.planner_name} — {collabGroupViewData?.form_title}
            </Text>
            {collabGroupViewData && (
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: "#374151", fontWeight: "600" }}>
                    {collabGroupViewData.completed_groups || 0}/{collabGroupViewData.total_groups || 0} done
                  </Text>
                  <Text style={{ fontSize: 11, color: "#6B7280" }}>{collabGroupViewData.completion_percentage || 0}%</Text>
                </View>
                <View style={{ height: 5, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${collabGroupViewData.completion_percentage || 0}%`, backgroundColor: (collabGroupViewData.completion_percentage || 0) === 100 ? "#4CAF50" : "#2196f3" }} />
                </View>
                {/* Option-wise overall stats */}
                {groupViewOptionStatsLoading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                    <ActivityIndicator size="small" color="#2196f3" />
                    <Text style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 6 }}>Loading option stats...</Text>
                  </View>
                ) : groupViewOptionStats && (() => {
                  const merged: Record<string, {count: number; failed: boolean}> = {};
                  for (const o of (groupViewOptionStats.options || [])) {
                    if (o.count > 0) {
                      const key = o.option || String(o.id);
                      if (!merged[key]) merged[key] = {count: 0, failed: !!o.failed};
                      merged[key].count += o.count;
                    }
                  }
                  const entries = Object.entries(merged);
                  const total = entries.reduce((s, [, v]) => s + v.count, 0);
                  if (entries.length === 0) return null;
                  return (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {entries.map(([optName, info], idx) => {
                        const pct = total > 0 ? Math.round((info.count / total) * 100) : 0;
                        const badgeColor = info.failed ? "#EF4444" : optName?.toLowerCase().includes("ok") && !optName?.toLowerCase().includes("not") ? "#4CAF50" : "#F59E0B";
                        return (
                          <View key={`opt-${idx}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: badgeColor + "15", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badgeColor, marginRight: 4 }} />
                            <Text style={{ fontSize: 9, color: "#374151", fontWeight: "600" }}>{optName}: {info.count} ({pct}%)</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            )}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {[...(collabGroupViewData?.group_delegations || [])].sort((a: any, b: any) => (a.group_order || 0) - (b.group_order || 0)).map((group: any) => {
                const displayStatus = group.display_status || group.status;
                const answered = group.answered_count || 0;
                const total = group.total_questions || 0;
                const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
                const statusColors: Record<string, string> = { assigned: "#2196f3", in_progress: "#8B5CF6", submitted: "#f59e0b", reviewed: "#4CAF50", rejected: "#ef4444" };
                const statusColor = statusColors[displayStatus] || "#9CA3AF";
                return (
                  <View key={group.id} style={{ marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", flexShrink: 1 }} numberOfLines={1}>
                        {group.audit_group_name || `Group ${group.group_order}`}
                      </Text>
                      <View style={{ backgroundColor: statusColor + "20", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, color: statusColor, fontWeight: "700" }}>{displayStatus?.toUpperCase().replace(/_/g, " ")}</Text>
                      </View>
                    </View>
                    {total > 0 && (
                      <View style={{ marginTop: 6 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={{ fontSize: 10, color: "#6B7280" }}>{answered}/{total} answered</Text>
                          <Text style={{ fontSize: 10, color: "#6B7280" }}>{progressPct}%</Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
                          <View style={{ height: "100%", width: `${progressPct}%`, backgroundColor: progressPct === 100 ? "#4CAF50" : statusColor, borderRadius: 2 }} />
                        </View>
                        {/* Per-group option-wise stats */}
                        {groupViewOptionStats && (() => {
                          const groupOpts = (groupViewOptionStats.per_group || []).filter((g: any) => g.audit_group_id === group.audit_group);
                          const merged: Record<string, {count: number; failed: boolean; id: number}> = {};
                          for (const g of groupOpts) {
                            for (const o of (g.options || [])) {
                              if (o.count > 0) {
                                const key = o.option || String(o.id);
                                if (!merged[key]) merged[key] = {count: 0, failed: !!o.failed, id: o.id};
                                merged[key].count += o.count;
                              }
                            }
                          }
                          const entries = Object.entries(merged);
                          if (entries.length === 0) return null;
                          return (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                              {entries.map(([optName, info], idx) => {
                                const badgeColor = info.failed ? "#EF4444" : optName?.toLowerCase().includes("ok") && !optName?.toLowerCase().includes("not") ? "#4CAF50" : "#F59E0B";
                                return (
                                  <View key={`opt-${idx}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: badgeColor + "15", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: badgeColor, marginRight: 3 }} />
                                    <Text style={{ fontSize: 8, color: "#374151", fontWeight: "600" }}>{optName}: {info.count}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>
                    )}
                    {displayStatus === "rejected" && group.rejection_comment && (
                      <Text style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }} numberOfLines={1}>Rejected: {group.rejection_comment}</Text>
                    )}
                    <TouchableOpacity
                      style={{ backgroundColor: "#2196f3", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", marginTop: 6 }}
                      onPress={() => {
                        setCollabGroupViewVisible(false);
                        const navParams: Record<string, string> = {
                          formTitle: collabGroupViewData?.form_title || "",
                          formId: String(collabGroupViewData?.form_id || collabGroupViewPlanner?.form_id || ""),
                          formType: "audit",
                          sourceScreen: "collaborative",
                          collaborativeSubmissionId: String(collabGroupViewData?.id || ""),
                          groupDelegationId: String(group.id),
                          groupDelegationStatus: String(group.status || ""),
                          auditGroupId: String(group.audit_group || ""),
                          plannerAssignmentId: String(collabGroupViewPlanner?.id || ""),
                        };
                        if (collabGroupViewData?.form_submission) navParams.submissionId = String(collabGroupViewData.form_submission);
                        if (collabGroupViewPlanner?.location_name) navParams.plannerLocation = collabGroupViewPlanner.location_name;
                        if (collabGroupViewPlanner?.location) navParams.plannerLocationId = String(collabGroupViewPlanner.location);
                        router.push({ pathname: "/(app)/(tabs)/forms/multi-stage-form", params: navParams });
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                        {displayStatus === "reviewed" ? "View" : displayStatus === "submitted" ? "View Submission" : displayStatus === "rejected" ? "Re-fill Group" : displayStatus === "in_progress" ? "Continue" : "Fill Group"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {(!collabGroupViewData?.group_delegations || collabGroupViewData.group_delegations.length === 0) && (
                <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, marginTop: 20 }}>No groups assigned to you yet.</Text>
              )}
            </ScrollView>
          </View>
          {/* Bottom Bar */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
            <TouchableOpacity style={{ backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 12, alignItems: "center" }} onPress={() => setCollabGroupViewVisible(false)}>
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  topRowRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  countBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  chipsContainer: {
    marginBottom: 6,
    flex: 1,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  filterChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  filterChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipsScroll: {
    paddingVertical: 2,
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  chipTextActive: {
    color: "#fff",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginBottom: 6,
    borderRadius: 8,
    overflow: "hidden",
    paddingRight: 6,
  },
  plannerTabsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginBottom: 6,
    borderRadius: 8,
    overflow: "hidden",
  },
  plannerTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  plannerTabActive: {
    borderBottomColor: "#FF5733",
  },
  plannerTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  plannerTabTextActive: {
    color: "#FF5733",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 50,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: "#111827",
  },
  plannerCard: {
    backgroundColor: "#2196f3",
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    overflow: "hidden",
  },
  cardTitleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2196f3",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 6,
  },
  cardTitleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardExpandedBody: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  cardInfoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  cardInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  cardInfoColCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cardInfoColRight: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 8,
  },
  cardInfoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardInfoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  cardInfoLabelLight: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardInfoValueLight: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  shareButtonLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196f3",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  shareButtonTextLight: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  missedCautionLight: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 6,
    fontStyle: "italic",
  },
  rejectedCautionLight: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 6,
    fontStyle: "italic",
    fontWeight: "600",
  },
  reasonTextLight: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },
  extensionTextLight: {
    fontSize: 11,
    color: "#16A34A",
    marginTop: 4,
    fontWeight: "500",
  },
  cardFormRow: {
    marginBottom: 10,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardFooterRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardDatePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  cardDateRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardShareRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  statusShareRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    justifyContent: "space-between",
  },
  cardDateText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  cardExpandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#2196f3",
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 10,
  },
  cardExpandButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196f3",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 4,
  },
  statusCompleted: {
    backgroundColor: "#DCFCE7",
  },
  statusInProgress: {
    backgroundColor: "#FEF3C7",
  },
  statusNotStarted: {
    backgroundColor: "#F3F4F6",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  shareButtonText: {
    fontSize: 12,
    color: "#2196f3",
    fontWeight: "600",
    marginLeft: 4,
  },
  idBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  idBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  overdueCard: {
    backgroundColor: "#DC2626",
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  missedCaution: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 4,
    fontStyle: "italic",
  },
  rejectedCaution: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 4,
    fontStyle: "italic",
    fontWeight: "600",
  },
  reasonContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 5,
  },
  reasonText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  extensionText: {
    fontSize: 11,
    color: "#16A34A",
    marginTop: 4,
    fontWeight: "500",
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
    maxHeight: "85%",
    flex: 1,
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
  rejectionBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: "#991B1B",
  },
  questionsContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  questionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  questionItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 8,
  },
  requiredStar: {
    color: "#DC2626",
    fontWeight: "700",
  },
  questionInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  datePickerPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: "#9CA3AF",
  },
  questionInputMultiline: {
    minHeight: 70,
  },
  choiceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  radioOuterSelected: {
    borderColor: "#2196f3",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2196f3",
  },
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxOuterSelected: {
    borderColor: "#2196f3",
    backgroundColor: "#2196f3",
  },
  choiceText: {
    fontSize: 14,
    color: "#111827",
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "#FFFFFF",
  },
  dropdownItemSelected: {
    borderColor: "#2196f3",
    backgroundColor: "#EFF6FF",
  },
  dropdownText: {
    fontSize: 14,
    color: "#111827",
  },
  dropdownTextSelected: {
    color: "#2196f3",
    fontWeight: "600",
  },
  ratingRow: {
    flexDirection: "row",
    gap: 4,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 16,
    backgroundColor: "#F9FAFB",
  },
  uploadText: {
    fontSize: 14,
    color: "#6B7280",
  },
  uploadedFileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#F0FDF4",
    position: "relative",
  },
  uploadedImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "500",
  },
  removeUploadButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(220, 38, 38, 0.8)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 8,
    marginBottom: 6,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 100,
    backgroundColor: "#F9FAFB",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 12,
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
  confirmDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  confirmDetailText: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
  },
  confirmNote: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 12,
    fontStyle: "italic",
  },
  shareTabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 8,
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
  // Filter styles
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
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
  filterModalContainer: {
    flex: 1,
  },
  filterBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  filterBottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "88%",
  },
  filterSheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 10,
  },
  filterSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterSheetHeaderBtn: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  filterResetText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
  },
  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 6,
  },
  filterInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingRight: 6,
  },
  filterInputText: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: "#111827",
    fontSize: 14,
  },
  filterDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  filterDateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
  },
  filterDateText: {
    fontSize: 14,
    color: "#111827",
  },
  filterDropdownAnchor: {
    position: "relative",
  },
  filterDropdownOpen: {
    zIndex: 60,
  },
  filterDropdownList: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 4,
    maxHeight: 190,
    backgroundColor: "#fff",
    zIndex: 70,
    elevation: 8,
  },
  filterDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  filterDropdownText: {
    fontSize: 14,
    color: "#111827",
  },
  filterSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    marginBottom: 12,
  },
  filterSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  filterListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  filterListItemText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCheckboxChecked: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  filterNoResults: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
  },
  filterApplyButton: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  filterApplyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default PlannerScreen;
