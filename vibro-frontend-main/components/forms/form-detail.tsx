"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, set, isSameDay, isThisWeek, isThisMonth } from "date-fns"
import { useTabStore } from "@/utils/tabStore"
import { useFormStore } from "@/utils/formStore"

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DesktopTimePicker } from "@mui/x-date-pickers/DesktopTimePicker";
import { duration, TextField } from "@mui/material";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, ClockIcon, Loader } from "lucide-react";
import FormShareModal from "./FormShareModal";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ClipboardList,
  MapPin,
  Share,
  Edit,
  Trash,
  Copy,
  Eye,
  Download,
  FileText,
  Calendar as CalendarIcon,
  Users,
  Filter,
  Search,
  CheckCircle,
  CheckCheck,
  XCircle,
  Upload,
  UserPlus,
  ArrowLeft,
  Loader2,
  Calculator,
  CheckSquare,
  CircleChevronDown,
  Clock,
  FileIcon,
  ImageIcon,
  Layers,
  QrCode,
  Ruler,
  RefreshCw,
  TableIcon,
  Type,
  User,
  VideoIcon,
  Undo2,
} from "lucide-react"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { answer, submissions as sub } from "./mock"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
// import CancelScheduleSendIcon from '@mui/icons-material/CancelScheduleSend';
import { RootState } from "@/redux/store";  // adjust path as per your project
import { useSelector } from "react-redux";
import { useParams, useRouter } from "next/navigation"
import axiosInstance from "@/utils/axiosInstance"
import ConfirmModalBox from "../ui/confirm-modalbox"
import { Switch } from "@/components/ui/switch"
import { generateFormResponsesPDF } from "@/utils/pdfGenerator"
import hotToaster from "react-hot-toast";
import QuestionEditor from "./question-editor"
import { FormCreator } from "./form-creator"
import { FormCreatorv1 } from "./form-creatorv1"
import GlobalLoader from "../ui/globalloader"
import { showWarningToast } from "@/utils/hotToastsUtils"
import { duplexPair } from "stream"
import { useExcelJobStore } from "@/utils/excelJobStore"
import { selectUser } from "@/redux/slices/authSlice"
interface FormDetailProps {
  id: number | string
  folderIdCheck?: number | string | null
  // onFolderId?: (folderId: number) => void
  onFolderId?: (id: number) => void
  status?: string
  plannerLocation?: string | null
  plannerOrderId?: string | null
}

interface Stage {
  id: number;
  name: string;
  questions: Question[];
}

interface Question {
  id: number;
  order: number;
  question: string;
  answers: Answer | null;
  question_type: string;
  sub_questions?: Question[];
  logics?: {
    logic_questions?: Question[];
    [key: string]: any;
  }[];
}

interface Answer {
  answer: string | null;
}


export function FormDetail({ id, onFolderId, status, plannerLocation, plannerOrderId }: FormDetailProps) {
  const ReduxUserInfo = useSelector(selectUser)
  console.log("ReduxUserInfo in FormDetail>>", ReduxUserInfo)
  const { isFullAccess } = useModuleAccess("forms")
  const router = useRouter()
  const params = useParams();
  const currentFormId = params.id;
  const formId = params.id as string
  const isFailed = status === "failed"
  const [viewResponseDialogOpen, setViewResponseDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedResponses, setSelectedResponses] = useState<any[]>([])
  const [selectedResponse, setSelectedResponse] = useState<any>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date>()
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFilter, setDateFilter] = useState<Date>()
  const [locationFilter, setLocationFilter] = useState<string>("")
  const [userFilter, setUserFilter] = useState<string>("")
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false)
  const [formData, setFormData] = useState<any>()
  const [viewformData, setViewFormData] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<"unshareOne" | "unshareAll" | "unshareSelected" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | "">("");
  const [search, setSearch] = useState("")
  const [submissionsByDay, setSubmissionsByDay] = useState<any[]>([]);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState("day");

  // Followup table state
  const [followupTableData, setFollowupTableData] = useState<{ headers: string[]; rows: any[][] }>({ headers: [], rows: [] });
  const [followupTableLoading, setFollowupTableLoading] = useState(false);
  const [followupSearch, setFollowupSearch] = useState("");
  const [followupStatusFilter, setFollowupStatusFilter] = useState<string>("all");
  const [followupSourceFilter, setFollowupSourceFilter] = useState<string>("all");
  const [followupImportedFilter, setFollowupImportedFilter] = useState<string>("all");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [responseStatusData, setResponseStatusData] = useState<any[]>([]);
  const [followupStatusData, setFollowupStatusData] = useState<any[]>([]);
  const [totalFollowups, setTotalFollowups] = useState(0);

  // Bulk import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importUsers, setImportUsers] = useState<any[]>([]);
  const [importGroups, setImportGroups] = useState<any[]>([]);
  const [importSelectedUsers, setImportSelectedUsers] = useState<number[]>([]);
  const [importSelectedGroups, setImportSelectedGroups] = useState<number[]>([]);

  const [nameFilter, setNameFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [formSharedOnFilter, setFormSharedOnFilter] = useState("");

  // Repeat schedule state variables
  const [repeatType, setRepeatType] = useState("None")
  const [endDate, setEndDate] = useState<Date>()
  const [schedules, setSchedules] = useState<any[]>([
    { id: 1, type: "Day" }
  ])
  const [startTimeDay, setStartTimeDay] = useState<Date | null>(null)
  const [endTimeDay, setEndTimeDay] = useState<Date | null>(null)
  const [startDayWeek, setStartDayWeek] = useState<string>("Monday")
  const [endDayWeek, setEndDayWeek] = useState<string>("Friday")
  const [startTimeWeek, setStartTimeWeek] = useState<Date | null>(null)
  const [endTimeWeek, setEndTimeWeek] = useState<Date | null>(null)
  const [startDayMonth, setStartDayMonth] = useState<string>("1st")
  const [endDayMonth, setEndDayMonth] = useState<string>("31st")
  const [startTimeMonth, setStartTimeMonth] = useState<Date | null>(null)
  const [endTimeMonth, setEndTimeMonth] = useState<Date | null>(null)
  const [startTimeFirstCheckIn, setStartTimeFirstCheckIn] = useState<Date | null>(null)
  const [endTimeFirstCheckIn, setEndTimeFirstCheckIn] = useState<string>("30 Mins")
  const [endRepetition, setEndRepetition] = useState<string>("Never")

  const [currentDate] = useState<Date>(new Date())

  const mainFormStageIds = useMemo(() => {
    if (!viewformData) return new Set<number>()

    if (viewformData.form_type === "audit") {
      const ids = new Set<number>()
      if (viewformData.audit_info?.id != null) {
        ids.add(Number(viewformData.audit_info.id))
      }
      ;(viewformData.audit_group ?? []).forEach((group: any) => {
        if (group?.id != null) {
          ids.add(Number(group.id))
        }
      })
      return ids
    }

    return new Set((viewformData.stages ?? []).map((stage: any) => Number(stage.id)))
  }, [viewformData])

  const submissionsToShow = useMemo(() => {
    if (!viewformData || submissions.length === 0) return submissions
    if (mainFormStageIds.size === 0) return submissions

    return submissions.filter((submission: any) => {
      const stageId = submission?.submission_initiated_stage
      if (stageId == null || stageId === "") return true
      return mainFormStageIds.has(Number(stageId))
    })
  }, [submissions, viewformData, mainFormStageIds])

  useEffect(() => {
    if (selectedResponses.length === 0) return
    setSelectedResponses((prevSelected) =>
      prevSelected.filter((id) => submissionsToShow.some((submission) => submission.id === id)),
    )
  }, [submissionsToShow])

  const [idResFilter, setResIdFilter] = useState("");
  const [disabledstatus, setdisabledstatus] = useState(true);
  const [resFromDateFilter, setResFromDateFilter] = useState<string | undefined>(undefined);
  const [resToDateFilter, setResToDateFilter] = useState<string | undefined>(undefined);
  const [resinitiatedByFilterColumn, setResInitiatedByFilterColumn] = useState("");
  const [resdesignationFilter, setResDesignationFilter] = useState("");
  const [resdepartmentFilter, setResDepartmentFilter] = useState("");
  const [reslocationFilter, setResLocationFilter] = useState("");
  const [resownerFilter, setResOwnerFilter] = useState("");
  const [restaskFilter, setResTaskFilter] = useState("all"); // for task completion column

  const token = useSelector((state: RootState) => state.auth.tokens?.refresh);

  const [pdfdownloading, setPdfDownloading] = useState(false);



  // const [folderIdCheck, setFolderIdCheck] = useState<number | null>(null);

  // Function to delete a schedule
  const deleteSchedule = (scheduleId: number) => {
    setSchedules(schedules.filter((schedule) => schedule.id !== scheduleId))
  }

  // Function to add a new schedule
  const addSchedule = () => {
    const newId = schedules.length > 0 ? Math.max(...schedules.map((s) => s.id)) + 1 : 1
    setSchedules([...schedules, { id: newId, type: "Day" }])
  }

  // Function to get dynamic text for schedule type
  const getDynamicText = (type: string): string => {
    switch (type) {
      case "Day":
        return "Repeats every day"
      case "Week":
        return `Repeats weekly from ${startDayWeek} to ${endDayWeek}`
      case "Month":
        return `Repeats monthly from ${startDayMonth} to ${endDayMonth}`
      case "FirstCheckIn":
        return `Repeats on first check-in`
      default:
        return "No repeat schedule set"
    }
  }

  // Function to handle saving schedules (placeholder for backend integration)
  const handleSaveSchedules = () => {
    console.log("Saving schedules:", {
      formId: id,
      schedules,
      startTimeDay,
      endTimeDay,
      startDayWeek,
      endDayWeek,
      startTimeWeek,
      endTimeWeek,
      startDayMonth,
      endDayMonth,
      startTimeMonth,
      endTimeMonth,
      startTimeFirstCheckIn,
      endTimeFirstCheckIn,
      endRepetition,
      endDate,
    })
    hotToaster.success("Schedules saved successfully!");
  }

  const handleSave = async () => {
    try {
      await axiosInstance.post(`/form/`, formData);
      hotToaster.success("Form saved successfully");
    } catch (err) {
      console.error("Failed to save form", err);
      hotToaster.error("Failed to save form");
    }
  };

  console.log("FormDetail - currentFormId >> ", currentFormId)

  const activeTab = useTabStore((state) => state.activeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const setPrefetchedForm = useFormStore((state: any) => state.setPrefetchedForm);

  const [viewSelectedResponses, setViewSelectedResponses] = useState<any[]>([]);
  const [currentResponseIndex, setCurrentResponseIndex] = useState<number>(0);

  const canEdit = isFullAccess
  const isSuperAdmin =
    Boolean(ReduxUserInfo?.is_superadmin) ||
    ReduxUserInfo?.role_details?.name?.toLowerCase() === "super_admin"

  const uniqueUsers = filteredUsers
  console.log("uniqueUsers>>>************", uniqueUsers);

  const uniqueFilteredUsers = filteredUsers.filter(

    (value, index, self) =>
      index === self.findIndex((t) => t.user_id === value.user_id)
  );
  const filteredUsersform = users.filter((user) => {
    const searchLower = search.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase() === searchLower) ||
      user.phone?.toLowerCase().includes(searchLower)
    );
  });




  function mapApiResponseToFormData(api: any): any {
    return {
      title: api.title,
      type: api.form_type,
      captureGPS: api.GPS,
      allowSharing: api.share_response,
      passPercentage: api.pass_percentage ?? 70,
      responseIdPrefix: api.prefix,
      allowEditing: api.allow_editing,
      enableStageReEditing: api.can_edit_previous_state,
      triggerEmailNotifications: false, // not in API
      autoShareResponses: api.auto_share_response,
      autoShareWith: null, // not in API
      folderId: api.folder,
      stages: api.stages.map((s: any, index: number) => ({
        index,
        id: String(s.id),
        uuid: s.stage_uuid,
        // activeStage: s.stage_uuid,
        title: s.name,
        questions: s.questions.map((q: any) => ({
          id: String(q.id),
          type: q.question_type,
          title: q.question,
          description: q.description ?? "",
          required: q.is_required,
          maxFiles: q.number_of_file_allowed ?? 1,
          requiresLive: q.require_live ?? false,
          options: q.options?.map((o: any) => o.option) ?? [],
          maxScore: q.max_score ?? undefined,
          formula: q.formula,
          critical: q.critical ?? false,
          hint: q.question_hint ?? "",
          // subQuestions: q.sub_questions,
          tableSubQuestions: [],
          conditionalLogics: q.logics?.map((l: any) => ({
            enabled: true,
            logic_type: l.logic_type,
            comparision: l.comparison,
            logic_value: l.logic_value,
            targetQuestionId: undefined,
            subQuestions: l.logic_questions?.map((subQ: any) => ({
              id: String(subQ.id),
              type: subQ.question_type,
              title: subQ.question,
              description: subQ.description ?? "",
              required: subQ.is_required,
              maxFiles: subQ.number_of_file_allowed ?? 1,
              requiresLive: subQ.require_live ?? false,
              options: subQ.options?.map((o: any) => o.option) ?? [],
              maxScore: subQ.max_score ?? undefined,
              formula: subQ.formula,
              critical: subQ.critical ?? false,
              hint: subQ.question_hint ?? "",
              subQuestions: [],         // nested sub-sub questions if needed
              tableSubQuestions: [],
              conditionalLogics: [],
              referenceImages: [],
              referenceVideos: [],
              referenceImageEnabled: false,
              referenceVideoEnabled: false,
              attachments: []
            })) ?? [],
            follow_up: l.follow_up ?? null,
            notification: l.notification ?? null
          })) ?? [],
          referenceImages: [],
          referenceVideos: [],
          referenceImageEnabled: false,
          referenceVideoEnabled: false,
          attachments: []
        }))
      })),
      requiresApproval: false,
      logics: []
    }
  }


  function mapAuditApiResponseToFormData(api: any): any {
    const mapQuestions = (questions: any[]): any[] => {
      return questions.map((q: any) => {
        const mapped = {
          id: String(q.id),
          type: q.question_type,
          title: q.question,
          description: q.description ?? "",
          required: q.is_required,
          requiresLive: q.require_live ?? false,
          options: q.options?.map((o: any) => o.option) ?? [],
          // Added auditOptions for audit-type questions
          auditOptions: q.question_type === "audit"
            ? q.options?.map((o: any) => ({
              option: o.option,
              score: o.score ?? 0,
            })) ?? []
            : undefined,

          maxScore: q.max_score ?? undefined,
          formula: q.formula,
          critical: q.critical ?? false,
          hint: q.question_hint ?? "",
          subQuestions: q.sub_questions ? mapQuestions(q.sub_questions) : [],
          tableSubQuestions: [],
          conditionalLogics: q.logics?.map((l: any) => ({
            enabled: true,
            logic_type: l.logic_type,
            comparision: l.comparison,
            logic_value: l.logic_value,
            targetQuestionId: undefined,
            subQuestions: mapQuestions(l.logic_questions ?? []),
            follow_up: l.follow_up ?? null,
            notification: l.notification ?? null
          })) ?? [],
          referenceImages: [],
          referenceVideos: [],
          referenceImageEnabled: false,
          referenceVideoEnabled: false,
          attachments: []
        };

        // ✅ Only attach maxFiles if it's an upload type
        if (q.question_type === "upload_image" || q.question_type === "upload_file") {
          (mapped as any).maxFiles = q.number_of_file_allowed ?? 1;
        }
        console.log("Mapped question:", mapped);
        return mapped;
      });
    };


    const stages = api.stages?.map((s: any, index: number) => ({
      index,
      id: String(s.id),
      uuid: s.stage_uuid,
      title: s.name,
      questions: mapQuestions(s.questions)
    })) ?? [];

    const auditInfoStage = api.audit_info ? {
      index: stages.length,
      id: String(api.audit_info.id),
      uuid: "",
      title: api.audit_info.name,
      questions: mapQuestions(api.audit_info.questions)
    } : null;

    const auditGroupStages = (api.audit_group ?? []).map((group: any, idx: number) => ({
      index: stages.length + (auditInfoStage ? 1 : 0) + idx,
      id: String(group.id),
      uuid: "",
      title: group.name,
      questions: mapQuestions(group.questions)
    }));

    return {
      title: api.title,
      type: api.form_type,
      captureGPS: api.GPS,
      allowSharing: api.share_response,
      passPercentage: api.pass_percentage ?? 70,
      responseIdPrefix: api.prefix ?? "",
      allowEditing: api.allow_editing,
      enableStageReEditing: api.can_edit_previous_state,
      triggerEmailNotifications: false,
      autoShareResponses: api.auto_share_response,
      autoShareWith: null,
      folderId: api.folder,
      stages: [
        ...stages,
        ...(auditInfoStage ? [auditInfoStage] : []),
        ...auditGroupStages
      ],
      requiresApproval: false,
      logics: []
    };
  }


  const mapStandardQuestionsForEditor = (stages: any[]) => {
    return stages.map((stage) => ({
      ...stage,
      questions: stage.questions.map((q: any) => ({
        ...q,
        title: q.question,         // map 'question' → 'title'
        type: q.question_type,     // map 'question_type' → 'type'
        // Normalize options
        options: (q.options ?? []).map((opt: any) => opt.option ?? ""),
        // Normalize conditional logic sub-questions
        conditionalLogics: (q.logics ?? []).map((logic: any) => ({
          condition: logic.logic_value,
          subQuestions: (logic.logic_questions ?? []).map((sub: any) => ({
            ...sub,
            title: sub.question,
            type: sub.question_type,
            options: (sub.options ?? []).map((opt: any) => opt.option ?? "")
          }))
        }))
      }))
    }));
  };

  const mapAuditQuestions = (groups: any[]) => {
    return groups.map((group) => ({
      ...group,
      questions: group.questions.map((q: any) => ({
        ...q,
        id: q.id,
        title: q.question,
        type: q.question_type,
        description: q.description,
        maxScore: q.max_score,
        critical: q.critical,

        // ✅ Keep options in auditOptions format
        auditOptions: (q.options ?? []).map((opt: any) => ({
          option: opt.option,
          score: opt.score,
        })),

        // Sub-questions
        subQuestions: (q.sub_questions ?? []).map((sub: any) => ({
          ...sub,
          id: sub.id,
          title: sub.question,
          type: sub.question_type,
          description: sub.description,
          maxScore: sub.max_score,
          auditOptions: (sub.options ?? []).map((opt: any) => ({
            option: opt.option,
            score: opt.score,
          })),
        })),

        // Conditional logics
        conditionalLogics: (q.logics ?? []).map((logic: any) => ({
          condition: logic.logic_value,
          logicType: logic.logic_type,
          subQuestions: (logic.logic_questions ?? []).map((sub: any) => ({
            ...sub,
            id: sub.id,
            title: sub.question,
            type: sub.question_type,
            description: sub.description,
            maxScore: sub.max_score,
            auditOptions: (sub.options ?? []).map((opt: any) => ({
              option: opt.option,
              score: opt.score,
            })),
          })),
        })),
      })),
    }));
  };

  const fetchFormDetails = async (formId: number | string) => {
    setViewFormData(null)
    setLoading(true)
    try {
      const viewRes = await axiosInstance.get(`/form/${formId}/`)

      setViewFormData(viewRes.data)
      // ✅ send folderId up
      if (viewRes.data?.folder && onFolderId) {
        onFolderId(viewRes.data.folder)
      }
      // Defer submissions & schedule; fetched on-demand
      setRepeatType("None")
    } catch (err: any) {
      setFormData({
        id: formId,
        title: "Sample Form",
        form_type: "standard",
        prefix: "HSC",
        GPS: true,
        share_response: false,
        allow_editing: true,
        pass_percentage: 80,
        max_score: 100,
        created_by: "Unknown User",
        created_at: "2025-07-28T10:51:59.563332Z",
      })
      setSubmissions([
        {
          "id": 12,
          "form": 78,
          "submission_initiated_stage": 149,
          "submission_initiated_on": "2025-07-28T10:52:32.973526Z",
          "submission_initiated_by": 85,
          "is_completed": false,
          "completed_by": null,
          "completed_on": null
        },
        {
          "id": 13,
          "form": 78,
          "submission_initiated_stage": 150,
          "submission_initiated_on": "2025-07-29T10:52:32.973526Z",
          "submission_initiated_by": 85,
          "is_completed": false,
          "completed_by": null,
          "completed_on": null
        },
        {
          "id": 14,
          "form": 78,
          "submission_initiated_stage": 151,
          "submission_initiated_on": "2025-07-30T10:52:32.973526Z",
          "submission_initiated_by": 85,
          "is_completed": false,
          "completed_by": null,
          "completed_on": null
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchSubmissionsAndSchedule = async (formId: number | string) => {
    try {
      const submissionsRes = await axiosInstance.post(`/form/submissions/`, { forms: [formId] })
      setSubmissions(submissionsRes.data)
      setRepeatType(submissionsRes.data.repeatSchedule || "None")
    } catch (error) {
      console.error("Failed to load submissions:", error)
    }
  }

  useEffect(() => {
    if (status !== "failed") {
      fetchFormDetails(id);
    }
  }, [status, id]);


  useEffect(() => {
    if (isFailed) return;
    console.log("Fetching 1")
    // if (activeTab !== "recipients") return;
    console.log("Fetching users for recipients tab")
    fetchUsers();
  }, [id, activeTab, isFailed]);

  // Load submissions only when needed (responses/repeat/analytics)
  useEffect(() => {
    if (!id) return;
    const needsSubmissions = activeTab === "responses" || activeTab === "repeat" || activeTab === "analytics";
    if (needsSubmissions) {
      fetchSubmissionsAndSchedule(id)
    }
  }, [activeTab, id])

  // Fetch followup table data when analytics tab is active
  const fetchFollowupTable = async () => {
    if (!id) return;
    setFollowupTableLoading(true);
    try {
      const submissionIds = submissions.map((s: any) => s.id).join(",");
      const response = await axiosInstance.get(
        `/forms/${id}/submissions/followup-table${submissionIds ? `?submission_ids=${submissionIds}` : ""}`
      );
      setFollowupTableData({ headers: response.data.headers, rows: response.data.rows });
      setResponseStatusData(response.data.response_status_data || []);
      setFollowupStatusData(response.data.followup_status_data || []);
      setTotalFollowups(response.data.total_followups || 0);
    } catch (error) {
      console.error("Error fetching followup table data:", error);
    } finally {
      setFollowupTableLoading(false);
    }
  };

  useEffect(() => {
    if (!id || activeTab !== "analytics") return;
    fetchFollowupTable();
  }, [activeTab, id, submissions.length]);

  const downloadFollowupExcel = async () => {
    if (!id) return;
    try {
      const submissionIds = submissions.map((s: any) => s.id).join(",");
      const url = `/forms/${id}/submissions/followup-table?download=excel${submissionIds ? `&submission_ids=${submissionIds}` : ""}`;
      const response = await axiosInstance.get(url, { responseType: "blob" });
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const contentDisposition = response.headers["content-disposition"];
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || `form_${id}_responses_followup.xlsx`;
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error downloading followup Excel:", error);
    }
  };

  const downloadImportTemplate = async () => {
    if (!id) return;
    try {
      const response = await axiosInstance.get(`/forms/${id}/import-template`, { responseType: "blob" });
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const contentDisposition = response.headers["content-disposition"];
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || `import_template_form_${id}.xlsx`;
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error downloading template:", error);
      hotToaster.error("Failed to download template.");
    }
  };

  const fetchImportUsersGroups = async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        axiosInstance.get("/users/list"),
        axiosInstance.get("/groups/"),
      ]);
      setImportUsers(usersRes.data || []);
      setImportGroups(groupsRes.data || []);
    } catch (error) {
      console.error("Error fetching users/groups for import:", error);
    }
  };

  const handleBulkImport = async () => {
    if (!importFile || !id) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (importSelectedUsers.length > 0) {
        formData.append("assign_user_ids", importSelectedUsers.join(","));
      }
      if (importSelectedGroups.length > 0) {
        formData.append("assign_group_ids", importSelectedGroups.join(","));
      }
      const response = await axiosInstance.post(
        `/forms/${id}/import-responses-followup`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      hotToaster.success(
        `Import successful: ${response.data.created_submissions} responses, ${response.data.created_answers} answers, ${response.data.created_tasks} tasks` +
        (response.data.total_errors > 0 ? ` (${response.data.total_errors} warnings)` : "")
      );
      setImportDialogOpen(false);
      setImportFile(null);
      setImportSelectedUsers([]);
      setImportSelectedGroups([]);
      fetchFollowupTable();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Import failed.";
      hotToaster.error(msg);
    } finally {
      setImportLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get(`/form/assignments/recipients/${id}/`);
      setUsers(response.data);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message || "Something went wrong while fetching users.";

      if (errorMsg === "Unable to retrieve recipients") {
        hotToaster.custom(
          "No Recipients Found\nThis form is not shared with any users yet."
        );
      } else {
        hotToaster.error(errorMsg);
      }
    }
  };

  // useEffect(() => {
  //   if (searchTerm.trim() === "") {
  //     setFilteredUsers(users);
  //   } else {
  //     const lowerSearch = searchTerm.toLowerCase();
  //     const filtered = users.filter((user) =>
  //       `${user.username} ${user.form_shared_on ?? ""} ${user.department ?? ""}`
  //         .toLowerCase()
  //         .includes(lowerSearch)
  //     );
  //     setFilteredUsers(filtered);
  //   }
  // }, [searchTerm, users]);


  useEffect(() => {
    let filtered = users;

    // 🔍 global search
    if (searchTerm.trim() !== "") {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((u) =>
        `${u.username ?? ""} ${u.form_shared_on ?? ""} ${u.department ?? ""} ${u.designation ?? ""}`
          .toLowerCase()
          .includes(lowerSearch)
      );
    }

    // 🎯 column filters
    if (nameFilter.trim() !== "") {
      filtered = filtered.filter((u) =>
        u.username?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    if (designationFilter.trim() !== "") {
      filtered = filtered.filter((u) =>
        u.designation?.toLowerCase().includes(designationFilter.toLowerCase())
      );
    }

    if (departmentFilter.trim() !== "") {
      filtered = filtered.filter((u) =>
        u.department?.toLowerCase().includes(departmentFilter.toLowerCase())
      );
    }

    if (formSharedOnFilter.trim() !== "") {
      filtered = filtered.filter((u) =>
        u.form_shared_on &&
        format(new Date(u.form_shared_on), "yyyy-MM-dd HH:mm")
          .toLowerCase()
          .includes(formSharedOnFilter.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, nameFilter, designationFilter, departmentFilter, formSharedOnFilter]);


  useEffect(() => {
    if (shareDialogOpen && !isFailed) {
      const fetchUsersExcludingShared = async () => {
        try {
          // Fetch already shared users to exclude them
          const sharedResponse = await axiosInstance.get(`/form/assignments/recipients/${id}/`);
          const sharedUserIds = sharedResponse.data.map((user: any) => user.user_id);

          // Fetch all users and filter out already shared ones
          const allUsersResponse = await axiosInstance.get("/users/list");
          const filteredUsers = allUsersResponse.data.filter((user: any) => !sharedUserIds.includes(user.id));
          setUsers(filteredUsers);
        } catch (error) {
          console.error("Failed to fetch users:", error);
        }
      };
      fetchUsersExcludingShared();
    }
  }, [shareDialogOpen, id, isFailed]);

  useEffect(() => {
    if (!isFailed) return;

    const fetchFailedFormData = async () => {
      try {
        const res = await axiosInstance.get(`/form-payload-files/${id}/`);
        // ⚠️ Do NOT overwrite state logic — only override formData safely
        setFormData((prev: any) => ({ ...prev, ...res.data }));
        setViewFormData(res.data)
        setLoading(false)
      } catch (err) {
        console.error("Failed to load failed form data", err);
      }
    };

    fetchFailedFormData();
  }, [isFailed, id]);

  useEffect(() => {
    if (submissions) {
      const processSubmissions = () => {
        const now = new Date();
        const submissionsByTime: { [key: string]: number } = {};

        submissions.forEach((submission) => {
          if (!submission.submission_initiated_on) return;
          const submissionDate = new Date(submission.submission_initiated_on);

          if (analyticsTimeRange === 'day') {
            if (isSameDay(submissionDate, now)) {
              const hour = format(submissionDate, 'HH:00');
              if (submissionsByTime[hour]) {
                submissionsByTime[hour]++;
              } else {
                submissionsByTime[hour] = 1;
              }
            }
          }

          if (analyticsTimeRange === 'week') {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            if (submissionDate >= lastWeek && submissionDate <= now) {
              const dayOfWeek = format(submissionDate, 'EEEE');
              if (submissionsByTime[dayOfWeek]) {
                submissionsByTime[dayOfWeek]++;
              } else {
                submissionsByTime[dayOfWeek] = 1;
              }
            }
          }

          if (analyticsTimeRange === 'month') {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            if (submissionDate >= lastMonth && submissionDate <= now) {
              const dayOfMonth = format(submissionDate, 'do');
              if (submissionsByTime[dayOfMonth]) {
                submissionsByTime[dayOfMonth]++;
              } else {
                submissionsByTime[dayOfMonth] = 1;
              }
            }
          }
        });

        const formattedData = Object.keys(submissionsByTime).map((key) => ({
          date: key,
          count: submissionsByTime[key],
        }));
        setSubmissionsByDay(formattedData);
      };
      processSubmissions();
    }
  }, [submissions, analyticsTimeRange]);


  const handleDeleteForm = () => {
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    try {
      const response = await axiosInstance.delete(`/form/delete/${currentFormId}`);
      setDeleteDialogOpen(false);
      hotToaster.success("Form has been deleted successfully!", { duration: 2000 });

      router.push(`/forms/${viewformData?.folder ? `folders/${viewformData.folder}` : ""}`);
    } catch (err: any) {
      hotToaster.error(
        "Error Deleting Form\n" + err.response?.data?.detail ||
        "Failed to delete form. Please try again.", { duration: 2000 }
      );
      setDeleteDialogOpen(false);
    }
  }

  console.log("View form data:", viewformData);

  //   const handleDuplicateForm = () => {
  //     console.log("Duplicating form:", id)
  //     // In a real app, you would call an API to duplicate the form
  //     router.push("/forms")
  //   }

  const handleDuplicateForm = async () => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/forms/${id}/edit?mode=duplicate`)
  };

  // const handleDuplicateForm = async () => {
  //   try {
  //     // 1. Get original form
  //     const formRes = await axiosInstance.get(`/form/${id}/`);
  //     const formData = formRes.data;

  //     // 2. Clean top-level fields
  //     const clonePayload: any = {
  //       form_type: formData.form_type,
  //       title: formData.title + " Copy",
  //       folder: formData.folder,
  //       prefix: formData.prefix,
  //       GPS: formData.GPS,
  //       share_response: formData.share_response,
  //       allow_editing: formData.allow_editing,
  //       can_edit_previous_state: formData.can_edit_previous_state,
  //       auto_share_response: formData.auto_share_response,
  //       pass_percentage: formData.pass_percentage,
  //       max_score: formData.max_score,
  //       form_admin: formData.form_admin,
  //       stages: formData.stages.map((stage: any) => ({
  //         name: stage.name,
  //         stage_uuid: stage.stage_uuid,
  //         order: stage.order,
  //         stage_access: stage.stage_access || [],
  //         questions: stage.questions.map((q: any) => ({
  //           question: q.question,
  //           question_type: q.question_type,
  //           question_uuid: q.question_uuid,
  //           order: q.order,
  //           is_required: q.is_required,
  //           min_value: q.min_value,
  //           max_value: q.max_value,
  //         })),
  //       }))
  //     };

  //     console.log("Clone Payload ::", clonePayload);

  //     // 3. Send clone request
  //     await axiosInstance.put(`/form/clone/${id}`, clonePayload);

  //     alert("Form cloned successfully!");
  //   } catch (error) {
  //     console.error("Error cloning form:", error);
  //   }
  // };

  const handleEditForm = () => {
    window.dispatchEvent(new Event("route-loader-start"));
    if (viewformData) {
      setPrefetchedForm(String(id), viewformData)
    }
    router.push(`/forms/${id}/edit?status=${status}`)
  }

  const handlePreviewForm = () => {
    console.log("Previewing form:", id)
    // In a real app, you would open a preview dialog or navigate to a preview page
  }

  const toggleResponseSelection = (responseId: string) => {
    setSelectedResponses((prev) =>
      prev.includes(responseId) ? prev.filter((id) => id !== responseId) : [...prev, responseId],
    )
  }

  const toggleAllResponses = () => {
    setSelectedResponses((prev) => (prev.length === submissionsToShow.length ? [] : submissionsToShow.map((r) => r.id)))
  }

  const toggleRecipientSelection = (recipientId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(recipientId) ? prev.filter((id) => id !== recipientId) : [...prev, recipientId],
    )
  }



  const handleBulkDeleteResponses = () => {
    if (selectedResponses.length === 0) return
    setBulkDeleteDialogOpen(true)
  }

  const confirmBulkDeleteResponses = () => {
    console.log("Deleting responses:", selectedResponses)
    setSelectedResponses([])
    setBulkDeleteDialogOpen(false)
  }

  const handleBulkAssignResponses = () => {
    if (selectedResponses.length === 0) return
    setBulkAssignDialogOpen(true)
  }

  const handleViewMultipleResponses = () => {
    if (selectedResponses.length === 0) return;
    setViewSelectedResponses([...selectedResponses]);
    setCurrentResponseIndex(0);
    getResponseForSubmission(selectedResponses[0], true);
  };

  const handlePrevResponse = () => {
    if (currentResponseIndex > 0) {
      const prevIndex = currentResponseIndex - 1;
      setCurrentResponseIndex(prevIndex);
      getResponseForSubmission(viewSelectedResponses[prevIndex], true);
    }
  };

  const handleNextResponse = () => {
    if (currentResponseIndex < viewSelectedResponses.length - 1) {
      const nextIndex = currentResponseIndex + 1;
      setCurrentResponseIndex(nextIndex);
      getResponseForSubmission(viewSelectedResponses[nextIndex], true);
    }
  };

  const confirmBulkAssignResponses = () => {
    console.log("Assigning responses:", selectedResponses)
    setSelectedResponses([])
    setBulkAssignDialogOpen(false)
  }

  const handleRemoveRecipients = () => {
    if (selectedRecipients.length === 0) return
    console.log("Removing recipients:", selectedRecipients)
    setSelectedRecipients([])
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAssignUsers = async () => {
    if (selectedUsers.length === 0) {
      showWarningToast("No Users Selected\nPlease select at least one user.");
      return;
    }

    try {
      await axiosInstance.post("/form/assignments/", {
        assign_type: "user",
        form: id, // 'id' from your form detail params
        user: selectedUsers,
      });

      hotToaster.success("Form Assigned Successfully", { duration: 2000 });
      setShareDialogOpen(false);
      setSelectedUsers([]);
      fetchUsers();
    } catch (error: any) {
      hotToaster.error(
        "Failed to Assign\n" + error?.response?.data?.message ||
        "Something went wrong."
      );
    }
  };


  // async function downLoadPdf() {
  //   try {
  //     const response = await axiosInstance.get(`/forms/${id}/submissions/pdf/download`, {
  //       responseType: 'blob', // important!
  //     });

  //     // Create a URL for the blob
  //     const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));

  //     // Open in a new tab
  //     const link = document.createElement('a');
  //     link.href = url;
  //     link.setAttribute('download', `submission_${id}.pdf`); // file name
  //     document.body.appendChild(link);
  //     link.click();
  //     link.remove();

  //     // Optionally, revoke the URL to free memory
  //     window.URL.revokeObjectURL(url);
  //   } catch (error) {
  //     console.error('Error downloading PDF:', error);
  //   }
  // }





  // async function downLoadPdf() {
  //   const response = await getResponseForSubmission(submissions[0]?.id, false);
  //   // Add timeout mechanism
  //   const PDF_TIMEOUT = 30000; // 30 seconds timeout

  //   const timeoutPromise = new Promise((_, reject) => {
  //     setTimeout(() => {
  //       reject(new Error('PDF generation timed out. Please try again.'));
  //     }, PDF_TIMEOUT);
  //   });

  //   try {
  //     // Show loading state
  //     setLoading(true);
  //     console.log("Starting PDF generation...");

  //     // Prepare form data for PDF
  //     const formInfo = {
  //       title: viewformData?.title || formData?.title || `Form ${id}`,
  //       form_type: viewformData?.form_type || formData?.form_type || 'standard',
  //       created_by: viewformData?.form_admin_display || formData?.created_by || 'N/A',
  //       created_at: viewformData?.created_at || formData?.created_at || new Date().toISOString(),
  //     };

  //     console.log("Form info prepared:", formInfo);

  //     // Use selectedResponse if available (contains detailed form structure)
  //     // Otherwise fallback to submissions for bulk download
  //     let responsesForPDF: any[] = [];

  //     if (response && response.stages) {
  //       console.log("Using selectedResponse for PDF");
  //       // Single detailed response with full form structure
  //       responsesForPDF = [{
  //         id: response.id || response.submission || 'N/A',
  //         submission_initiated_on: response.submissionsDetail?.submission_initiated_on,
  //         submission_initiated_by: response.submissionsDetail?.submission_initiated_by,
  //         initiator_designation: response.submissionsDetail?.initiator_designation,
  //         initiator_department: response.submissionsDetail?.initiator_department,
  //         initiator_location: response.submissionsDetail?.initiator_location,
  //         current_owner: response.submissionsDetail?.current_owner,
  //         is_completed: response.submissionsDetail?.is_completed,
  //         stages: response.stages, // Detailed form structure with questions and answers
  //       }];
  //     } else if (submissions && submissions.length > 0) {
  //       console.log("Using submissions for PDF, count:", submissions.length);
  //       // Multiple submissions - use basic info
  //       responsesForPDF = submissions.map((submission: any) => ({
  //         id: submission.id,
  //         submission_initiated_on: submission.submission_initiated_on,
  //         submission_initiated_by: submission.submission_initiated_by,
  //         initiator_designation: submission.initiator_designation,
  //         initiator_department: submission.initiator_department,
  //         initiator_location: submission.initiator_location,
  //         current_owner: submission.current_owner,
  //         is_completed: submission.is_completed,
  //         stage_details: submission.stage_details,
  //       }));
  //     } else {
  //       console.error("No response data available");
  //       throw new Error('No response data available for PDF generation');
  //     }

  //     console.log("Responses prepared for PDF:", responsesForPDF.length);

  //     // Generate PDF using frontend utility with timeout
  //     console.log("Calling PDF generator...");
  //     await Promise.race([
  //       generateFormResponsesPDF(responsesForPDF, formInfo, id),
  //       timeoutPromise
  //     ]);
  //     console.log("PDF generation completed successfully");

  //     Swal.fire({
  //       icon: "success",
  //       title: "PDF Generated",
  //       text: "Form responses PDF has been downloaded successfully!",
  //       timer: 2000,
  //       showConfirmButton: false,
  //     });

  //   } catch (error) {
  //     console.error("Error generating PDF:", error);
  //     Swal.fire({
  //       icon: "error",
  //       title: "Generation Failed",
  //       text: error instanceof Error ? error.message : "Failed to generate PDF. Please try again.",
  //       timer: 3000,
  //       showConfirmButton: false,
  //     });
  //   } finally {
  //     console.log("Resetting loading state");
  //     setLoading(false);
  //   }
  // }
  // const downloadExcel = async () => {
  //   try {
  //     setPdfDownloading(true);
  //     if (!selectedResponses || selectedResponses.length === 0) {
  //       showWarningToast(
  //         "No responses selected\nPlease select at least one response to download."
  //       );
  //       return;
  //     }

  //     const idsParam = selectedResponses.join(',');

  //     const response = await axiosInstance.get(
  //       `/forms/${id}/submissions/excel?submission_ids=${idsParam}`,
  //       { responseType: 'blob' } // important for Excel
  //     );

  //     const url = window.URL.createObjectURL(
  //       new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  //     );

  //     const link = document.createElement('a');
  //     link.href = url;
  //     link.setAttribute('download', `submissions_formid-${id}.xlsx`);
  //     document.body.appendChild(link);
  //     link.click();
  //     link.remove();

  //     window.URL.revokeObjectURL(url);
  //     setPdfDownloading(false);
  //   } catch (error) {
  //     console.error("Error downloading Excel:", error);
  //     hotToaster.error(
  //       "An error occurred while downloading the Excel file(s)."
  //     );
  //   }
  // };



  //send excel to email
  // const downloadAndSendExcelEmail = async () => {
  //   try {
  //     setPdfDownloading(true);

  //     if (!selectedResponses || selectedResponses.length === 0) {
  //       showWarningToast(
  //         "No responses selected\nPlease select at least one response to send."
  //       );
  //       return;
  //     }

  //     const idsParam = selectedResponses.join(',');
  //     console.log("Sending Excel via Email for IDs:", idsParam);

  //     const response = await axiosInstance.get(
  //       `/forms/${id}/submissions/excel?submission_ids=${idsParam}&email=vasanthkrml@gmail.com`
  //     );

  //     console.log("Email Response:", response.data);

  //     hotToaster.success(response.data.message, { duration: 2000 });

  //   } catch (error) {
  //     console.error("Error sending Excel via email:", error);
  //     hotToaster.error("Failed to send Excel report via email.");
  //   } finally {
  //     setPdfDownloading(false);
  //   }
  // };



  const downloadAndSendExcelEmail = async (email: string | number | boolean) => {
    try {
      setPdfDownloading(true);

      if (!selectedResponses || selectedResponses.length === 0) {
        showWarningToast(
          "No responses selected\nPlease select at least one response to send."
        );
        return;
      }

      const idsParam = selectedResponses.join(',');
      console.log("Sending Excel via Email for IDs:", idsParam);

      const response = await axiosInstance.get(
        `/forms/${id}/submissions/excel?submission_ids=${idsParam}&email=${encodeURIComponent(email)}`
      );

      console.log("Email Response:", response.data);

      hotToaster.success(response.data.message, { duration: 2000 });

      const trackingId = response.data?.tracking_id;
      if (!trackingId) return;

      // --- POLLING ---
      const pollStatus = async () => {
        try {
          const statusResp = await axiosInstance.get(
            `/reports/excel/${trackingId}/status`
          );
          const status = statusResp.data?.status;

          if (status === "QUEUED" || status === "RUNNING") {
            return setTimeout(pollStatus, 15000);
          }

          if (status === "SUCCESS" || status === "FAILED") {
            // === ADD TO ZUSTAND ===
            useExcelJobStore.getState().addJob({
              id: trackingId,
              status,
              type: "excel",
              message: statusResp.data?.message ||
                (status === "SUCCESS"
                  ? "Excel emailed successfully"
                  : "Excel generation failed"),
              timestamp: new Date().toISOString(),
              filename: statusResp.data.filename
            });

            // optional toast
            if (status === "SUCCESS") {
              hotToaster.success("Excel emailed successfully!");
            } else {
              hotToaster.error("Excel generation failed.");
            }
          }

        } catch (err) {
          console.error("Polling error", err);
        }
      };

      pollStatus();

    } catch (error) {
      console.error("Error sending Excel via email:", error);
      hotToaster.error("Failed to send Excel report via email.");
    } finally {
      setPdfDownloading(false);
    }
  };

  const downloadAndSendCSVFollowupEmail = async (email: string | number | boolean) => {
    try {
      setPdfDownloading(true);

      if (!selectedResponses || selectedResponses.length === 0) {
        showWarningToast(
          "No responses selected\nPlease select at least one response to send."
        );
        return;
      }

      const idsParam = selectedResponses.join(',');
      console.log("Sending CSV+Followup via Email for IDs:", idsParam);

      const response = await axiosInstance.get(
        `/forms/${id}/submissions/csv-followup?submission_ids=${idsParam}&email=${encodeURIComponent(email)}`
      );

      console.log("Email Response:", response.data);

      hotToaster.success(response.data.message, { duration: 2000 });

      const trackingId = response.data?.tracking_id;
      if (!trackingId) return;

      const pollStatus = async () => {
        try {
          const statusResp = await axiosInstance.get(
            `/reports/excel/${trackingId}/status`
          );
          const status = statusResp.data?.status;

          if (status === "QUEUED" || status === "RUNNING") {
            return setTimeout(pollStatus, 15000);
          }

          if (status === "SUCCESS" || status === "FAILED") {
            useExcelJobStore.getState().addJob({
              id: trackingId,
              status,
              type: "excel",
              message: statusResp.data?.message ||
                (status === "SUCCESS"
                  ? "CSV+Followup emailed successfully"
                  : "CSV+Followup generation failed"),
              timestamp: new Date().toISOString(),
              filename: statusResp.data.filename
            });

            if (status === "SUCCESS") {
              hotToaster.success("CSV+Followup emailed successfully!");
            } else {
              hotToaster.error("CSV+Followup generation failed.");
            }
          }

        } catch (err) {
          console.error("Polling error", err);
        }
      };

      pollStatus();

    } catch (error) {
      console.error("Error sending CSV+Followup via email:", error);
      hotToaster.error("Failed to send CSV+Followup report via email.");
    } finally {
      setPdfDownloading(false);
    }
  };



  // const downLoadPdf = async () => {
  //   try {
  //     setPdfDownloading(true);
  //     if (!selectedResponses || selectedResponses.length === 0) {
  //       showWarningToast(
  //         "No responses selected\nPlease select at least one response to download."
  //       );
  //       return;
  //     }

  //     const idsParam = selectedResponses.join(',');

  //     const response = await axiosInstance.get(
  //       `/forms/${id}/submissions/pdf/download?submission_ids=${idsParam}`,
  //       { responseType: 'blob' }
  //     );

  //     // Create blob URL
  //     const url = window.URL.createObjectURL(
  //       new Blob([response.data], { type: 'application/pdf' })
  //     );

  //     // Download
  //     const link = document.createElement('a');
  //     link.href = url;
  //     link.setAttribute('download', `submissions_formid-${id}.pdf`);
  //     document.body.appendChild(link);
  //     link.click();
  //     link.remove();

  //     window.URL.revokeObjectURL(url);
  //     setPdfDownloading(false);
  //   } catch (error) {
  //     setPdfDownloading(false);
  //     console.error('Error downloading PDFs:', error);
  //     hotToaster.error("An error occurred while downloading the PDF(s).");
  //   }
  // };


  const emailPdf = async (email: string | number | boolean) => {
    try {
      setPdfDownloading(true);

      if (!selectedResponses || selectedResponses.length === 0) {
        showWarningToast(
          "No responses selected\nPlease select at least one response to email."
        );
        return;
      }

      const idsParam = selectedResponses.join(',');

      const { data } = await axiosInstance.get(
        `/forms/${id}/submissions/pdf/download?submission_ids=${idsParam}&email=${encodeURIComponent(email)}`
      );

      const trackingId = data.tracking_id;
      if (!trackingId) {
        hotToaster.error("Invalid response from server.");
        setPdfDownloading(false);
        return;
      }

      hotToaster.success(
        "PDF is being generated and will be emailed shortly."
      );

      // ---- POLLING ----
      const pollStatus = async () => {
        try {
          const res = await axiosInstance.get(
            `/reports/pdf/${trackingId}/status`
          );

          const job = res.data;

          if (job.status === "QUEUED" || job.status === "RUNNING") {
            return setTimeout(pollStatus, 15000);
          }

          if (job.status === "SUCCESS" || job.status === "FAILED") {

            // ✅ Add notification to Zustand
            useExcelJobStore.getState().addJob({
              id: trackingId,
              type: "pdf",
              status: job.status,
              message:
                job.message ||
                (job.status === "SUCCESS"
                  ? "PDF emailed successfully"
                  : "PDF generation failed"),
              timestamp: new Date().toISOString(),
              filename: job.filename,
            });

            if (job.status === "SUCCESS") {
              hotToaster.success("PDF has been sent to your email.");
            } else {
              hotToaster.error(
                job.message || "PDF generation failed."
              );
            }

            setPdfDownloading(false);
          }
        } catch (err) {
          console.error("Polling error", err);
          setPdfDownloading(false);
        }
      };

      pollStatus();

    } catch (error) {
      setPdfDownloading(false);
      console.error("Error emailing PDF:", error);
      hotToaster.error("An error occurred while sending the PDF by email.");
    }
  };

  const handleUnshareUser = async (recipientId: string): Promise<void> => {
    try {
      setFetching(true);
      const response = await axiosInstance.delete(`/form/assignments/recipients/${id}/${recipientId}/`);

      hotToaster.success("Form Unshared Successfully", { duration: 2000 });
      setFilteredUsers((prevList) =>
        prevList.filter((user) => user.user_id !== recipientId)
      );
    } catch (error) {
      console.error("Error fetching form data:", error);
      hotToaster.error("Failed to Unshare User", { duration: 2000 });
    }
  }

  const handleUnshareAll = async (): Promise<void> => {
    try {
      setFetching(true);
      const response = await axiosInstance.delete(`/form/assignments/recipients/${id}/`);
      hotToaster.success("Form Unshared from all users Successfully", { duration: 2000 });
      setFilteredUsers([]);
    }
    catch (error) {
      console.error("Error unsharing from all users:", error);
    }
  }

  const handleUnshareSelected = async (): Promise<void> => {
    try {
      setFetching(true);
      await axiosInstance.post(`/form/unassignment/`, {
        form: id,
        assign_type: "user",
        user: selectedRecipientIds,
      });
      hotToaster.success("Form Unshared from selected users Successfully",{duration:2000});
      setFilteredUsers((prevList) =>
        prevList.filter((user) => !selectedRecipientIds.includes(user.user_id))
      );
      setSelectedRecipientIds([]);
    }
    catch (error) {
      console.error("Error unsharing from selected users:", error);
      hotToaster.error("Failed to unshare from selected users");
    } finally {
      setFetching(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Complete":
        return <Badge className="bg-green-500">Complete</Badge>
      case "Partial":
        return <Badge variant="secondary">Partial</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getRecipientTypeIcon = (type: string) => {
    switch (type) {
      case "user":
        return <UserPlus className="h-4 w-4" />
      case "group":
        return <Users className="h-4 w-4" />
      case "location":
        return <MapPin className="h-4 w-4" />
      default:
        return <UserPlus className="h-4 w-4" />
    }
  }

  // Helper to map backend fields to frontend display
  const getFormType = (type: string) => {
    if (type === "location") return "Location-based Form"
    if (type === "audit") return "Audit Form"
    return "Standard Form"
  }

  const getResponseForSubmission = async (submissionId: number | string, opendialog: boolean = true) => {
    try {
      setFetching(true);
      const response = await axiosInstance.get(`/form/response/${id}/${submissionId}`);
      setSelectedResponse(response.data);
      if (opendialog) {
        setViewResponseDialogOpen(true);
      }
      return response.data;
    } catch (error) {
      console.error("Error fetching form data:", error);
      setSelectedResponse(answer); // Fallback to sample data
      setViewResponseDialogOpen(true);
    } finally {
      setFetching(false);
    }
  }

  if (loading || !viewformData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen pb-20">
        <div className="relative flex justify-center items-center">
          <GlobalLoader />
        </div>
      </div>
    );
  }


  let mappedStages: any[] = [];
  let isAuditForm = false;

  if (viewformData?.form_type === "standard" || viewformData?.form_type === "location") {
    mappedStages = mapStandardQuestionsForEditor(viewformData.stages || []);
  } else if (viewformData?.form_type === "audit") {
    mappedStages = mapAuditQuestions(viewformData.audit_group || []);
    isAuditForm = true;
  }

  // const mappedStages = mapStandardQuestionsForEditor(viewformData?.stages || []);
  // console.log("Mapped Stages for Editor:", mappedStages);

  return (
    <div className="space-y-6">
      {/* <div className=" ">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div> */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {formData?.title || viewformData?.title || "Loading..."}
          </h1>
          <p className="text-muted-foreground">
            Created by {viewformData?.form_admin_display ?? "N/A"} on {viewformData?.created_at ? viewformData.created_at.slice(0, 10) : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mr-4">
          <Button variant="outline" onClick={downloadImportTemplate} disabled={isFailed}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          {isSuperAdmin && (
            <Button variant="outline" onClick={() => { fetchImportUsersGroups(); setImportDialogOpen(true) }} disabled={isFailed}>
              <Upload className="mr-2 h-4 w-4" />
              Import Responses
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={handleEditForm}
              disabled={viewformData?.is_archived}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => setShareDialogOpen(true)}
              disabled={viewformData?.is_archived || isFailed}
              className={isFailed ? "pointer-events-none opacity-50" : ""}>
              <Share className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="outline" onClick={handleDuplicateForm}
                disabled={isFailed}
                className={isFailed ? "pointer-events-none opacity-50" : ""}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button variant="outline" onClick={handleDeleteForm}
                disabled={isFailed}
                className={isFailed ? "pointer-events-none opacity-50" : ""}>
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {activeTab === "analytics" && (
            <Button
              variant="outline"
              size="icon"
              onClick={fetchFollowupTable}
              disabled={followupTableLoading}
              className="h-9 w-9 rounded-md border-slate-200 hover:bg-slate-100"
            >
              <RefreshCw className={`h-4 w-4 text-slate-600 ${followupTableLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger
            value="view"
            className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md"
          >
            View
          </TabsTrigger>
          <TabsTrigger
            value="responses"
            disabled={isFailed}
            className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md"
          >
            Responses
          </TabsTrigger>
          <TabsTrigger
            value="repeat"
            disabled={isFailed}
            className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md"
          >
            Repeat
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            disabled={isFailed}
            className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md"
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="recipients"
            disabled={isFailed}
            className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md"
          >
            Manage Recipients
          </TabsTrigger>
        </TabsList>

        {viewformData?.is_archived && (
          <div className="my-3 p-4 bg-yellow-100  border-l-4 border-yellow-500 text-yellow-700">
            <AlertCircle className="inline-block mr-2 text-red-500" />
            This form is disabled for sharing and editing. A newer version is available.
          </div>
        )
        }

        {/* View Tab */}
        <TabsContent value="view" className="space-y-6">

          {/* <FormCreator id={formId} isEditing /> */}
          <FormCreatorv1 id={formId} isEditing prefetchedData={viewformData} plannerLocation={plannerLocation} plannerOrderId={plannerOrderId} />
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search responses..."
                  className="w-full sm:w-[250px] pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => {
                  setResFromDateFilter(undefined);
                  setResToDateFilter(undefined);
                  setResIdFilter("");
                  setResInitiatedByFilterColumn("");
                  setResDesignationFilter("");
                  setResDepartmentFilter("");
                  setResLocationFilter("");
                  setResOwnerFilter("");
                  setSearchQuery("");
                  setResTaskFilter("all");
                }}
              >
                Clear Filters

              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Export Dropdown */}
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10" disabled={selectedResponses.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      {pdfdownloading ? "Downloading..." : "Download"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 mt-1 min-w-[140px]">
                    <DropdownMenuItem
                      className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer"
                      onClick={() => {
                        // downloadExcel()
                        downloadAndSendExcelEmail(ReduxUserInfo?.email??"")
                      }}
                    >

                      <Download className="h-4 w-4" />

                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer"
                      onClick={() => {
                        downloadAndSendCSVFollowupEmail(ReduxUserInfo?.email??"")
                      }}
                    >
                      <Download className="h-4 w-4" />
                      CSV + Followup
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer"
                      // onClick={downLoadPdf}
                      onClick={() => emailPdf(ReduxUserInfo?.email??"")}
                    >
                      <Download className="h-4 w-4" />
                      PDF
                      {/* download */}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isSuperAdmin && (
                <>
                  <Button variant="outline" size="sm" className="h-10" onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Responses
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={handleBulkDeleteResponses}
                    disabled={selectedResponses.length === 0}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete Selected
                  </Button>
                </>
              )}
              <Button
                variant="default"
                size="sm"
                className="h-10"
                onClick={handleViewMultipleResponses}
                disabled={selectedResponses.length === 0}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Selected
              </Button>
              {/* <Button
    variant="outline"
    size="sm"
    className="h-10"
    onClick={handleBulkAssignResponses}
    disabled={selectedResponses.length === 0}
  >
    <UserPlus className="mr-2 h-4 w-4" />
    Reassign Selected
  </Button> */}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedResponses.length === submissionsToShow.length && submissionsToShow.length > 0}
                        onCheckedChange={toggleAllResponses}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Submission Date</TableHead>
                    <TableHead>Initiated By</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Current Owner</TableHead>
                    <TableHead>Task Completion</TableHead>
                    <TableHead className="flex items-center gap-1">Actions</TableHead>
                  </TableRow>

                  {/* 🔹 Column Filter Row */}
                  <TableRow className="bg-gray-50">
                    <TableCell></TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter ID"
                        value={idResFilter}
                        onChange={(e) => setResIdFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-[180px] h-8 text-xs justify-start text-left font-normal overflow-hidden whitespace-nowrap"
                          >
                            {resFromDateFilter || resToDateFilter ? (
                              `${resFromDateFilter || 'From'} to ${resToDateFilter || 'To'}`
                            ) : (
                              'Select dates'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">From Date</Label>
                              <Input
                                type="date"
                                value={resFromDateFilter || ""}
                                onChange={(e) => setResFromDateFilter(e.target.value)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">To Date</Label>
                              <Input
                                type="date"
                                value={resToDateFilter || ""}
                                onChange={(e) => setResToDateFilter(e.target.value)}
                                className="w-full"
                              />
                            </div>
                            {(resFromDateFilter || resToDateFilter) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setResFromDateFilter(undefined);
                                  setResToDateFilter(undefined);
                                }}
                                className="w-full text-red-500"
                              >
                                Clear Dates
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter Initiated By"
                        value={resinitiatedByFilterColumn}
                        onChange={(e) => setResInitiatedByFilterColumn(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter Designation"
                        value={resdesignationFilter}
                        onChange={(e) => setResDesignationFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter Department"
                        value={resdepartmentFilter}
                        onChange={(e) => setResDepartmentFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter Location"
                        value={reslocationFilter}
                        onChange={(e) => setResLocationFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        placeholder="Filter Owner"
                        value={resownerFilter}
                        onChange={(e) => setResOwnerFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={restaskFilter} onValueChange={setResTaskFilter}>
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="not_completed">Not Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : submissionsToShow.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10">
                        No submissions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Render submissions normally
                    submissionsToShow
                      .sort((a, b) => b.id - a.id)
                      .filter((s) =>
                        s.id.toString().includes(idResFilter) &&
                        (!resFromDateFilter || s.submission_initiated_on?.slice(0, 10) >= resFromDateFilter) &&
                        (!resToDateFilter || s.submission_initiated_on?.slice(0, 10) <= resToDateFilter) &&
                        (String(s.submission_initiated_by || "").toLowerCase().includes(resinitiatedByFilterColumn.toLowerCase())) &&
                        (resdesignationFilter === "" || (s.initiator_designation?.toLowerCase().includes(resdesignationFilter.toLowerCase()))) &&
                        (resdepartmentFilter === "" || (s.initiator_department?.toLowerCase().includes(resdepartmentFilter.toLowerCase()))) &&
                        (reslocationFilter === "" || (s.initiator_location?.toLowerCase().includes(reslocationFilter.toLowerCase()))) &&
                        (resownerFilter === "" || (s.current_owner?.toLowerCase().includes(resownerFilter.toLowerCase()))) &&
                        (restaskFilter === "all" || (restaskFilter === "completed" ? s.is_completed : !s.is_completed)) &&
                        s.id.toString().includes(searchQuery) &&
                        (viewformData?.form_type !== 'audit' || s.is_completed)
                      )
                      .map((response) => (
                        <TableRow key={response.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedResponses.includes(response.id)}
                              onCheckedChange={() => toggleResponseSelection(response.id)}
                              aria-label={`Select response ${response.id}`}
                            />
                          </TableCell>
                          <TableCell
                            className="font-medium cursor-pointer hover:text-blue-600"
                            onClick={() => getResponseForSubmission(response.id, true)}
                          >
                            {response.id}
                          </TableCell>
                          <TableCell>{viewformData?.prefix ? `${viewformData.prefix}` : `N/A`}</TableCell>
                          <TableCell>{response.submission_initiated_on ? format(new Date(response.submission_initiated_on), "PPPpp") : "NA"}</TableCell>
                          <TableCell>{response.submission_initiated_by || "NA"}</TableCell>
                          <TableCell>{response.initiator_designation || "NA"}</TableCell>
                          <TableCell>{response.initiator_department || "NA"}</TableCell>
                          <TableCell>{response.initiator_location || "NA"}</TableCell>
                          <TableCell>{response.current_owner || "NA"}</TableCell>
                          <TableCell>
                            {response.is_completed ? (
                              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                                Completed
                              </span>
                            ) : (
                              (() => {
                                const pendingStage = response.stage_details?.find(
                                  (stage: { stage_name: string; order: number; is_completed: boolean }) =>
                                    !stage.is_completed
                                );
                                return pendingStage ? (
                                  <div className="flex flex-col items-center">
                                    <span className="px-2  py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
                                      Pending
                                    </span>
                                    <span>{pendingStage.stage_name}</span>
                                  </div>
                                ) : (
                                  <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
                                    Pending
                                  </span>
                                );
                              })()
                            )}
                          </TableCell>
                          <TableCell className="ml-auto">
                            <div className="flex items-center gap-1">
                              <Button onClick={() => getResponseForSubmission(response.id, true)} variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>

              </Table>
            </CardContent>
          </Card>

        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">

          {/* Metric summary row + refresh */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <Card className="order-1 md:order-1 relative overflow-hidden border-none bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-blue-100 font-semibold">Total Responses</p>
                  <p className="text-2xl font-bold mt-1">
                    {followupTableLoading ? "-" : responseStatusData.reduce((acc, d) => acc + (d.count || 0), 0)}
                  </p>
                </div>
                <ClipboardList className="h-8 w-8 text-blue-100 opacity-80" />
              </CardContent>
            </Card>
            <Card className="order-2 md:order-2 relative overflow-hidden border-none bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-100 font-semibold">OK Responses</p>
                  <p className="text-2xl font-bold mt-1">
                    {followupTableLoading ? "-" : (responseStatusData.find((d) => d.name === "OK")?.count || 0)}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-100 opacity-80" />
              </CardContent>
            </Card>
            <Card className="order-3 md:order-3 relative overflow-hidden border-none bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-100 font-semibold">Corrected Responses</p>
                  <p className="text-2xl font-bold mt-1">
                    {followupTableLoading ? "-" : responseStatusData.filter((d) => d.name?.toLowerCase().includes("corrected")).reduce((acc, d) => acc + (d.count || 0), 0)}
                  </p>
                </div>
                <CheckCheck className="h-8 w-8 text-amber-100 opacity-80" />
              </CardContent>
            </Card>
            <Card className="order-4 md:order-4 relative overflow-hidden border-none bg-gradient-to-br from-rose-500 to-orange-600 text-white shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-rose-100 font-semibold">NC Triggered</p>
                  <p className="text-2xl font-bold mt-1">
                    {followupTableLoading ? "-" : totalFollowups}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-rose-100 opacity-80" />
              </CardContent>
            </Card>
            <Card className="order-5 md:order-5 relative overflow-hidden border-none bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-orange-100 font-semibold">Pending Followups</p>
                  <p className="text-2xl font-bold mt-1">
                    {followupTableLoading ? "-" : (totalFollowups - (followupStatusData.find((d) => d.name?.toLowerCase() === "completed")?.count || 0))}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-100 opacity-80" />
              </CardContent>
            </Card>
            <Card className="order-6 md:order-6 relative overflow-hidden border-none bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100 font-semibold">Completed Followups</p>
                  <p className="text-2xl font-bold mt-1">
                    {followupTableLoading ? "-" : (followupStatusData.find((d) => d.name?.toLowerCase() === "completed")?.count || 0)}
                  </p>
                </div>
                <CheckSquare className="h-8 w-8 text-cyan-100 opacity-80" />
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Response Status Chart */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">Response Status</CardTitle>
                <CardDescription className="text-xs text-slate-500">Distribution across all responses</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {followupTableLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : responseStatusData.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">No response data available.</div>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={responseStatusData}
                          dataKey="count"
                          nameKey="name"
                          cx="40%"
                          cy="50%"
                          outerRadius={55}
                          innerRadius={30}
                          paddingAngle={2}
                          labelLine={false}
                          label={(entry: any) => `${entry.percentage}%`}
                        >
                          {responseStatusData.map((entry, idx) => {
                            const colors = ['#059669', '#dc2626', '#d97706', '#2563eb', '#7c3aed', '#64748b'];
                            return <Cell key={idx} fill={colors[idx % colors.length]} stroke="#fff" strokeWidth={1} />;
                          })}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ fontSize: 11, borderRadius: 4 }}
                          formatter={(value: any, _name: any, props: any) => {
                            const p = props?.payload;
                            return [`${value} (${p?.percentage}%)`, p?.name];
                          }}
                        />
                        <Legend
                          verticalAlign="middle"
                          align="right"
                          layout="vertical"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11, lineHeight: '16px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Followup Task Status Chart */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">Followup Task Status</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {totalFollowups} NC triggered · status breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {followupTableLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : followupStatusData.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">No followup tasks triggered.</div>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={followupStatusData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
                        <RechartsTooltip
                          contentStyle={{ fontSize: 11, borderRadius: 4 }}
                          formatter={(value: any, _name: any, props: any) => {
                            const p = props?.payload;
                            return [`${value} (${p?.percentage}%)`, p?.name];
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={16}>
                          {followupStatusData.map((entry, idx) => {
                            const colors = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#64748b'];
                            return <Cell key={idx} fill={colors[idx % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Followup Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-700">Responses with Followup Data</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Detailed response data with followup task information.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadFollowupExcel}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search responses..."
                    value={followupSearch}
                    onChange={(e) => setFollowupSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={followupStatusFilter} onValueChange={setFollowupStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={followupSourceFilter} onValueChange={setFollowupSourceFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="Form">Form</SelectItem>
                    <SelectItem value="Planner">Planner</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={followupImportedFilter} onValueChange={setFollowupImportedFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Imported" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Yes">Imported</SelectItem>
                    <SelectItem value="No">App Flow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {followupTableLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading followup data...</span>
                </div>
              ) : followupTableData.rows.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No data available.
                </div>
              ) : (
                <div className="overflow-auto max-h-[600px] rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        {followupTableData.headers.map((header, idx) => (
                          <TableHead key={idx} className="whitespace-nowrap text-xs font-medium">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followupTableData.rows
                        .filter((row) => {
                          const statusIdx = followupTableData.headers.indexOf("Status");
                          const sourceIdx = followupTableData.headers.indexOf("Source Type");
                          const importedIdx = followupTableData.headers.indexOf("Imported");
                          const matchesStatus = followupStatusFilter === "all" || (statusIdx >= 0 && row[statusIdx] === followupStatusFilter);
                          const matchesSource = followupSourceFilter === "all" || (sourceIdx >= 0 && row[sourceIdx] === followupSourceFilter);
                          const matchesImported = followupImportedFilter === "all" || (importedIdx >= 0 && row[importedIdx] === followupImportedFilter);
                          const matchesSearch = !followupSearch ||
                            row.some((cell) => String(cell ?? "").toLowerCase().includes(followupSearch.toLowerCase()));
                          return matchesStatus && matchesSource && matchesImported && matchesSearch;
                        })
                        .map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            {row.map((cell, cellIdx) => {
                              const headerName = followupTableData.headers[cellIdx];
                              if (headerName === "Imported") {
                                const val = String(cell ?? "");
                                return (
                                  <TableCell key={cellIdx} className="whitespace-nowrap text-xs text-center">
                                    {val === "Yes" ? (
                                      <span className="inline-flex items-center rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 px-2 py-0.5 text-[10px] font-medium">Imported</span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                );
                              }
                              // Detect image URLs in cell content
                              const cellStr = String(cell ?? "");
                              const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico|heic|heif)(\?.*)?$/i;
                              const urlParts = cellStr.includes(";") ? cellStr.split(";").map(s => s.trim()) : [cellStr];
                              const hasImageUrls = urlParts.some(p => imageExtensions.test(p) && (p.startsWith("http://") || p.startsWith("https://")));
                              if (hasImageUrls) {
                                const imageUrls = urlParts.filter(p => imageExtensions.test(p) && (p.startsWith("http://") || p.startsWith("https://")));
                                const nonImageParts = urlParts.filter(p => !(imageExtensions.test(p) && (p.startsWith("http://") || p.startsWith("https://"))));
                                return (
                                  <TableCell key={cellIdx} className="whitespace-nowrap text-xs max-w-[300px]">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {imageUrls.map((url, imgIdx) => (
                                        <button
                                          key={imgIdx}
                                          onClick={() => setImagePreviewUrl(url)}
                                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-xs"
                                          title="Click to preview image"
                                        >
                                          <ImageIcon className="h-3 w-3" />
                                          Image {imageUrls.length > 1 ? imgIdx + 1 : ""}
                                        </button>
                                      ))}
                                      {nonImageParts.filter(Boolean).map((part, pIdx) => (
                                        <span key={`t-${pIdx}`}>{part}</span>
                                      ))}
                                    </div>
                                  </TableCell>
                                );
                              }
                              return (
                              <TableCell key={cellIdx} className="whitespace-nowrap text-xs max-w-[300px] overflow-hidden text-ellipsis">
                                {cellStr}
                              </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image Preview Dialog */}
          <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => { if (!open) setImagePreviewUrl(null); }}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-2">
              <DialogHeader className="pb-0">
                <DialogTitle className="text-sm">Image Preview</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="max-w-full max-h-[70vh] object-contain rounded"
                  />
                )}
              </div>
              <div className="flex justify-end pt-1">
                <a
                  href={imagePreviewUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Open in new tab
                </a>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Manage Recipients Tab */}
        <TabsContent value="recipients" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search recipients..."
                  className="w-full sm:w-[250px] pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 bg-red-500 text-white hover:bg-red-300 hover:text-red-600 transition-colors"
                onClick={() => {
                  setActionType("unshareSelected");
                  setShowModal(true);
                }}
                disabled={selectedRecipientIds.length === 0}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                UNSHARE SELECTED
              </Button>
              {/* <Button
                variant="outline"
                size="sm"
                className="h-10 bg-red-500 text-white hover:bg-red-300 hover:text-red-600 transition-colors"
                onClick={() => {
                  setActionType("unshareAll");
                  setShowModal(true);
                }}
                disabled={filteredUsers.length === 0}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                UNSHARE FROM ALL
              </Button> */}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedRecipientIds.length === uniqueFilteredUsers.length && uniqueFilteredUsers.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRecipientIds(uniqueFilteredUsers.map(user => user.user_id));
                          } else {
                            setSelectedRecipientIds([]);
                          }
                        }}
                        aria-label="Select all recipients"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Form shared on</TableHead>
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {/* 🔹 Filter Row */}
                  <TableRow className="bg-gray-50">
                    <TableCell></TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter name"
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter designation"
                        value={designationFilter}
                        onChange={(e) => setDesignationFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Filter department"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={formSharedOnFilter}
                        onChange={(e) => setFormSharedOnFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                      {formSharedOnFilter && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setFormSharedOnFilter("")}
                          className="text-xs text-red-500 px-2"
                        >
                          ✕
                        </Button>
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* 🔹 Data Rows */}
                  {uniqueFilteredUsers.length > 0 ? (
                    uniqueFilteredUsers.map((recipient, index) => (
                      <TableRow key={`${recipient.user_id}-${index}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRecipientIds.includes(recipient.user_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRecipientIds(prev => [...prev, recipient.user_id]);
                              } else {
                                setSelectedRecipientIds(prev => prev.filter(id => id !== recipient.user_id));
                              }
                            }}
                            aria-label={`Select recipient ${recipient.username}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{recipient.username}</TableCell>
                        <TableCell>{recipient.designation || ""}</TableCell>
                        <TableCell>{recipient.department || ""}</TableCell>
                        <TableCell>
                          {recipient.form_shared_on
                            ? format(new Date(recipient.form_shared_on), "yyyy-MM-dd HH:mm")
                            : ""}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-red-500 w-auto p-2 bg-gray-200 hover:bg-gray-400 hover:text-white transition-colors"
                            onClick={() => {
                              setActionType("unshareOne");
                              setShowModal(true);
                              setSelectedUserId(recipient.user_id);
                            }}
                          >
                            <Undo2 className="h-4 w-4" />UNSHARE
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No recipients found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {showModal && (
            <ConfirmModalBox
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              onConfirm={() => {
                if (actionType === "unshareOne") {
                  handleUnshareUser(selectedUserId);
                } else if (actionType === "unshareAll") {
                  handleUnshareAll();
                } else if (actionType === "unshareSelected") {
                  handleUnshareSelected();
                }
                setShowModal(false);
              }}
              title={`Confirm ${actionType === "unshareOne" ? "Unshare" : actionType === "unshareSelected" ? "Unshare Selected" : "Unshare All"}`}
              description={`Are you sure you want to ${actionType === "unshareOne" ? "unshare this form from the selected user" : actionType === "unshareSelected" ? "unshare this form from the selected users" : "unshare this form from all users"}? This action cannot be undone.`}
              button={actionType === "unshareOne" ? "Unshare User" : actionType === "unshareSelected" ? "Unshare Selected" : "Unshare All"}
            />
          )}
        </TabsContent>

        {/* Repeat Tab */}
        <TabsContent value="repeat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Repeat Schedule</CardTitle>
              <CardDescription>
                Set a schedule for when this form should be completed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Repeat Type</Label>
                <Select value={repeatType} onValueChange={setRepeatType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select repeat type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Day">Day</SelectItem>
                    <SelectItem value="Week">Week</SelectItem>
                    <SelectItem value="Month">Month</SelectItem>
                    <SelectItem value="FirstCheckIn">On First Check-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {schedules.map((schedule, index) => (
                <div key={schedule.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{getDynamicText(schedule.type)}</p>
                    <Button variant="ghost" size="sm" onClick={() => deleteSchedule(schedule.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>

                  {schedule.type === "Day" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={startTimeDay}
                            onChange={setStartTimeDay}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={endTimeDay}
                            onChange={setEndTimeDay}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                    </div>
                  )}

                  {schedule.type === "Week" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Day</Label>
                        <Select value={startDayWeek} onValueChange={setStartDayWeek}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select start day" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>End Day</Label>
                        <Select value={endDayWeek} onValueChange={setEndDayWeek}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select end day" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={startTimeWeek}
                            onChange={setStartTimeWeek}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={endTimeWeek}
                            onChange={setEndTimeWeek}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                    </div>
                  )}

                  {schedule.type === "Month" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Day</Label>
                        <Select value={startDayMonth} onValueChange={setStartDayMonth}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select start day" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}`).map(day => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>End Day</Label>
                        <Select value={endDayMonth} onValueChange={setEndDayMonth}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select end day" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}`).map(day => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={startTimeMonth}
                            onChange={setStartTimeMonth}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={endTimeMonth}
                            onChange={setEndTimeMonth}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                    </div>
                  )}

                  {schedule.type === "FirstCheckIn" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DesktopTimePicker
                            value={startTimeFirstCheckIn}
                            onChange={setStartTimeFirstCheckIn}
                            slotProps={{ textField: { fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Select value={endTimeFirstCheckIn} onValueChange={setEndTimeFirstCheckIn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select end time" />
                          </SelectTrigger>
                          <SelectContent>
                            {["30 Mins", "1 Hour", "2 Hours", "End of Day"].map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {repeatType !== "None" && (
                <Button variant="outline" onClick={addSchedule}>
                  Add Another Schedule
                </Button>
              )}

              <div className="space-y-2">
                <Label>End Repetition</Label>
                <RadioGroup value={endRepetition} onValueChange={setEndRepetition} className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Never" id="never" />
                    <Label htmlFor="never">Never</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="On" id="on" />
                    <Label htmlFor="on">On</Label>
                  </div>
                  {endRepetition === "On" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-[240px] justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </RadioGroup>
              </div>
            </CardContent>
            <div className="flex justify-end p-6">
              <Button onClick={handleSaveSchedules}>Save Schedules</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={viewResponseDialogOpen} onOpenChange={(open) => {
        setViewResponseDialogOpen(open);
        if (!open) {
          setViewSelectedResponses([]);
          setCurrentResponseIndex(0);
        }
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Response {viewSelectedResponses.length > 0 ? `(${currentResponseIndex + 1} of ${viewSelectedResponses.length})` : ''}</DialogTitle>
            <DialogDescription>
              View the details of this response, including answers and metadata.
            </DialogDescription>
          </DialogHeader>

          {
            fetching ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                <span className="ml-2">Loading response...</span>
              </div>
            ) : (
              <Card>
                <CardContent className="space-y-4">

                  {/* Handle different structures for standard vs audit forms */}
                  {(() => {
                    const isAuditForm = selectedResponse?.form_type === 'audit';
                    const stagesToRender: any[] = [];

                    if (isAuditForm) {
                      // For audit forms, render audit_info first, then audit_group
                      if (selectedResponse?.audit_info) {
                        stagesToRender.push({
                          id: selectedResponse.audit_info.id,
                          name: selectedResponse.audit_info.name,
                          questions: selectedResponse.audit_info.questions || []
                        });
                      }
                      if (selectedResponse?.audit_group) {
                        selectedResponse.audit_group.forEach((group: any) => {
                          stagesToRender.push({
                            id: group.id,
                            name: group.name,
                            questions: group.questions || []
                          });
                        });
                      }
                    } else {
                      // For standard forms, use stages
                      stagesToRender.push(...(selectedResponse?.stages || []));
                    }

                    return stagesToRender.map((stage: any, stageIndex: number) => (
                      <div key={stage?.id} className="border-t pt-4">
                        <div className="text-sm text-gray-600 mb-2">
                          Section {stageIndex + 1} of {stagesToRender.length}
                        </div>
                        <h2 className="text-lg font-semibold text-primary mb-2">
                          {stage?.name || `Section ${stageIndex + 1}`}
                        </h2>

                        {stage?.questions
                          ?.map((question: any, questionIndex: number) => (
                            <div
                              key={question?.id}
                              className="mb-3 p-3 border rounded bg-muted"
                            >
                              {/* Main Question */}
                              <h4 className="text-sm font-medium text-muted-foreground">
                                Q{question?.order || questionIndex + 1}: {question?.question || 'No question text'}
                              </h4>

                              <div className="mt-1 text-sm">
                                <span className="font-medium">Answer:</span>{" "}
                                {['signature', 'upload_image'].includes(question?.question_type ?? '') ? (
                                  question.answers?.answer && question.answers.answer !== 'undefined' && typeof question.answers.answer === 'string' && question.answers.answer.trim() ? (
                                    <>
                                      {(question.answers.answer as string)
                                        .split('|')
                                        .filter(Boolean) // remove empty strings
                                        .map((url, idx) => (
                                          <img
                                            key={idx}
                                            src={url}
                                            alt={`Uploaded content ${idx + 1}`}
                                            className="mt-2 max-w-xs border rounded"
                                          />
                                        ))}
                                    </>
                                  ) : (
                                    <span className="text-gray-500"> - </span>
                                  )
                                ) : question?.question_type === 'upload_video' ? (
                                  question.answers?.answer && question.answers.answer !== 'undefined' && typeof question.answers.answer === 'string' && question.answers.answer.trim() ? (
                                    <>
                                      {(question.answers.answer as string)
                                        .split('|')
                                        .filter(Boolean)
                                        .map((url, idx) => (
                                          <video
                                            key={idx}
                                            controls
                                            src={url}
                                            className="mt-2 max-w-xs border rounded"
                                          />
                                        ))}
                                    </>
                                  ) : (
                                    <span className="text-gray-500"> - </span>
                                  )
                                ) : question?.question_type === 'audit' ? (
                                  <div className="mt-2 space-y-2">
                                    {/* Display main answer for audit questions */}
                                    <div className="text-sm font-medium">
                                      {question.answers?.answer && question.answers.answer !== 'undefined' && typeof question.answers.answer === 'string' && question.answers.answer.trim() ? question.answers.answer : <span className="text-gray-500"> - </span>}
                                    </div>
                                    {/* Display sub-questions for audit */}
                                    {question.sub_questions && question.sub_questions.filter((subQ: any) => subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim()).length > 0 && (
                                      <div className="mt-2 space-y-2">
                                        {question.sub_questions.filter((subQ: any) => subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim()).map((subQ: any) => (
                                          <div key={subQ.id} className="p-2 border rounded bg-background">
                                            <div className="text-sm font-medium">{subQ.question}</div>
                                            <div className="text-muted-foreground border border-gray-200 rounded p-2 mt-1">
                                              {['signature', 'upload_image'].includes(subQ?.question_type ?? '') ? (
                                                <>
                                                  {(subQ.answers.answer as string)
                                                    .split('|')
                                                    .filter(Boolean)
                                                    .map((url, idx) => (
                                                      <img
                                                        key={idx}
                                                        src={url}
                                                        alt={`Uploaded content ${idx + 1}`}
                                                        className="mt-2 max-w-xs border rounded"
                                                      />
                                                    ))}
                                                </>
                                              ) : subQ?.question_type === 'upload_video' ? (
                                                <>
                                                  {(subQ.answers.answer as string)
                                                    .split('|')
                                                    .filter(Boolean)
                                                    .map((url, idx) => (
                                                      <video
                                                        key={idx}
                                                        controls
                                                        src={url}
                                                        className="mt-2 max-w-xs border rounded"
                                                      />
                                                    ))}
                                                </>
                                              ) : (
                                                subQ.answers.answer
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : question?.question_type === 'table' ? (
                                  <div className="mt-2 space-y-2">
                                    {question.sub_questions
                                      ?.map((subQ: any) => (
                                        <div key={subQ.id} className="p-2 border rounded bg-background">
                                          <div className="text-sm font-medium">{subQ.question}</div>
                                          <div className="text-muted-foreground border border-gray-200 rounded p-2 mt-1">
                                            {['signature', 'upload_image'].includes(subQ?.question_type ?? '') ? (
                                              subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim() ? (
                                                <>
                                                  {(subQ.answers.answer as string)
                                                    .split('|')
                                                    .filter(Boolean)
                                                    .map((url, idx) => (
                                                      <img
                                                        key={idx}
                                                        src={url}
                                                        alt={`Uploaded content ${idx + 1}`}
                                                        className="mt-2 max-w-xs border rounded"
                                                      />
                                                    ))}
                                                </>
                                              ) : (
                                                <span className="text-gray-500"> - </span>
                                              )
                                            ) : subQ?.question_type === 'upload_video' ? (
                                              subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim() ? (
                                                <>
                                                  {(subQ.answers.answer as string)
                                                    .split('|')
                                                    .filter(Boolean)
                                                    .map((url, idx) => (
                                                      <video
                                                        key={idx}
                                                        controls
                                                        src={url}
                                                        className="mt-2 max-w-xs border rounded"
                                                      />
                                                    ))}
                                                </>
                                              ) : (
                                                <span className="text-gray-500"> - </span>
                                              )
                                            ) : (
                                              subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim() ? subQ.answers.answer : <span className="text-gray-500"> - </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  (() => {
                                    const answer = question.answers?.answer;
                                    if (answer && answer !== 'undefined') {
                                      if (Array.isArray(answer)) {
                                        return answer.join(', ');
                                      } else if (typeof answer === 'string' && answer.trim()) {
                                        return answer;
                                      }
                                    }
                                    return <span className="text-gray-500"> - </span>;
                                  })()
                                )}
                              </div>

                              {/* Logic Sub-Questions */}
                              {question?.logics?.map((logic: any) =>
                                logic.logic_questions
                                  ?.map((subQ: any) => (
                                    <div
                                      key={subQ.id}
                                      className="mt-3 ml-4 p-2 border rounded bg-background"
                                    >
                                      <div className="text-sm font-medium">{subQ.question}</div>
                                      <div className="text-muted-foreground border border-gray-200 rounded p-2 mt-1">
                                        {['signature', 'upload_image'].includes(subQ?.question_type ?? '') ? (
                                          subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim() ? (
                                            <>
                                              {(subQ.answers.answer as string)
                                                .split('|')
                                                .filter(Boolean)
                                                .map((url, idx) => (
                                                  <img
                                                    key={idx}
                                                    src={url}
                                                    alt={`Uploaded content ${idx + 1}`}
                                                    className="mt-2 max-w-xs border rounded"
                                                  />
                                                ))}
                                            </>
                                          ) : (
                                            <span className="text-gray-500"> - </span>
                                          )
                                        ) : subQ?.question_type === 'upload_video' ? (
                                          subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim() ? (
                                            <video
                                              controls
                                              src={subQ.answers.answer as string}
                                              className="mt-2 max-w-xs border rounded"
                                            />
                                          ) : (
                                            <span className="text-gray-500"> - </span>
                                          )
                                        ) : (
                                          subQ.answers?.answer && subQ.answers.answer !== 'undefined' && typeof subQ.answers.answer === 'string' && subQ.answers.answer.trim() ? subQ.answers.answer : <span className="text-gray-500"> - </span>
                                        )}
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          ))}
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            )
          }

          <DialogFooter>
            <Button variant="destructive" onClick={() => setViewResponseDialogOpen(false)}>Close</Button>
            {viewSelectedResponses.length > 0 && currentResponseIndex > 0 && (
              <Button onClick={handlePrevResponse}>Prev</Button>
            )}
            {viewSelectedResponses.length > 0 && currentResponseIndex < viewSelectedResponses.length - 1 && (
              <Button onClick={handleNextResponse}>Next</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog for sharing the form */}
      <FormShareModal
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        formId={formId}
        onSave={() => {
          // Refresh data after sharing
          fetchUsers();
        }}
      />

      {/* Dialog for confirming form deletion */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the form
              and all its responses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for confirming bulk response deletion */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Responses</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the selected responses? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBulkDeleteResponses}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for bulk assigning responses */}
      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Responses</DialogTitle>
            <DialogDescription>
              Reassign the selected responses to another user.
            </DialogDescription>
          </DialogHeader>
          {/* Add user selection form here */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmBulkAssignResponses}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for bulk import responses with followup data */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Responses with Followup Data</DialogTitle>
            <DialogDescription>
              Upload an Excel file in the same format as the &quot;Responses with Followup Data&quot; table.
              Response ID, Source ID, and Followup Response Submission ID columns can be blank. Rows with &quot;NC Closure Task&quot; in the Follow up action Title will be auto-assigned to the selected users/groups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Download template */}
            <div className="flex items-center justify-between bg-slate-50 border rounded-md p-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Download Template</p>
                <p className="text-xs text-slate-500 mt-0.5">Get the Excel template with correct headers, a sample row, and instructions.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadImportTemplate}
              >
                <Download className="h-4 w-4 mr-1" />
                Template
              </Button>
            </div>

            {/* File upload */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Excel File</Label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full text-sm border rounded-md p-2 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {importFile && (
                <p className="text-xs text-slate-500 mt-1">Selected: {importFile.name}</p>
              )}
            </div>

            {/* NC Closure Task assignment */}
            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">NC Closure Task Assignment</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select users/groups to auto-assign tasks where the Follow up action Title contains &quot;NC Closure Task&quot;.
                </p>
              </div>

              {/* Users selection */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Assign to Users</Label>
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {importUsers.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 text-center">Loading users...</p>
                  ) : (
                    importUsers.map((u: any) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={importSelectedUsers.includes(u.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setImportSelectedUsers([...importSelectedUsers, u.id]);
                            } else {
                              setImportSelectedUsers(importSelectedUsers.filter((x) => x !== u.id));
                            }
                          }}
                        />
                        <span>{u.first_name} {u.last_name} ({u.username})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Groups selection */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Assign to Groups</Label>
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {importGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 text-center">Loading groups...</p>
                  ) : (
                    importGroups.map((g: any) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={importSelectedGroups.includes(g.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setImportSelectedGroups([...importSelectedGroups, g.id]);
                            } else {
                              setImportSelectedGroups(importSelectedGroups.filter((x) => x !== g.id));
                            }
                          }}
                        />
                        <span>{g.name || g.group_name || `Group ${g.id}`}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={!importFile || importLoading}
            >
              {importLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
