"use client"

import { Checkbox } from "@/components/ui/checkbox"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Swal from "sweetalert2"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ClipboardList,
  MapPin,
  Plus,
  Trash,
  Copy,
  MoveUp,
  MoveDown,
  Save,
  Eye,
  X,
  ArrowLeft,
  ArrowRight,
  Settings,
  TableIcon,
  FileText,
  Calendar,
  Clock,
  ImageIcon,
  Calculator,
  Type,
  CheckSquare,
  Star,
  Layers,
  User,
  VideoIcon,
  FileIcon,
  PencilIcon,
  QrCode,
  QrCodeIcon,
  CircleChevronDown,
  Circle,
  Scale,
  Ruler,
  MoveUpIcon,
  MoveDownIcon,
  CopyIcon,
  MessageSquareText,
  CircleX,
  SquarePen,
  GripVertical,
  Upload,
} from "lucide-react"
import hotToaster from "react-hot-toast";
import { useFormStore } from "@/utils/formStore";
// Removed invalid import and example usage of RulerDimensionLine


import { Textarea } from "@/components/ui/textarea"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import axiosInstance from "@/utils/axiosInstance"
import axios from "axios"
import ConditionalQuestion from "./conditional-question"
import TablePreview from "./table-preview"
import { create, all } from "mathjs";
import QuestionEditor from "./question-editor"
import { replaceFormulaQuestionRefs, resolveFormulaQuestionRef } from "./formula-utils"
import SubQuestionsEditor from "./sub-question-editor"
import { JSX } from "react/jsx-runtime"
import LogicFollowUpAccordion from "./logic-follow-up"
import { LogicNotificationAccordion } from "./logic-notification"
import AuditPreview from "./audit-question-preview"
import StageAccessEditor from "./stage-access"
import ConditionalLogicModal from "./conditional-logic-modal"
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice"
import BackConfirmDialog from "../ui/BackConfirmDialog"
import React from "react"
import AutoShareModal from "./AutoShareModal"
import { showWarningToast } from "@/utils/hotToastsUtils"
import { BulkImportModal } from "./bulk-import-modal"
import { BulkEditModal } from "./bulk-edit-modal"


// import { console } from "inspector"

// Set up mathjs with uppercase function support if needed
const math = create(all, {});
math.import({
  SUM: (...args: number[]) => math.sum(args),
  MUL: (...args: number[]) => math.prod(args),
  SQRT: (x: number) => math.sqrt(x),
  AVG: (...args: number[]) => math.mean(args),
  MIN: (...args: number[]) => math.min(args),
  MAX: (...args: number[]) => math.max(args),
});

interface FormCreatorProps {
  id?: string
  isEditing?: boolean
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  step: string
  setStep: React.Dispatch<React.SetStateAction<string>>
  setIsInEditCheck: (val: string) => void
  setFormId: (val: string) => void
  prefetchedData?: any // optional, to skip refetch during navigation from view
  status?: string
}



type FormType = "standard" | "location" | "audit"
export type QuestionType =
  | ""
  | "table"
  | "title_and_description"
  | "long_answer"
  | "date"
  | "time"
  | "datetime"
  | "signature"
  | "formula"
  | "short_answer"
  | "text"
  | "multiple_choice"
  | "checkboxes"
  | "rating"
  | "checkbox"
  | "linear_scale"
  | "location"
  | "user"
  | "upload_image"
  | "upload_video"
  | "upload_file"
  | "qr_code"
  | "division"
  | "sub_division"
  | "dropdown"
  | "audit"

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  restrictEdit?: boolean;
  valueType?: "text" | "number"
  options?: string[];
  auditOptions?: {
    option: string,
    score: number,
    order: number,
  }[];
  maxScore?: number;
  conditionalLogics?: Array<{
    id?: string | number;
    enabled: boolean;
    logic_type?: "is" | "is_not";
    comparision?: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "lessthan_or_equalto" | "greaterthan_or_equalto" | "blank" | "between";
    logic_value?: string;
    targetQuestionId?: string;
    subQuestions?: Question[];
    follow_up: FollowUp,
    notification: Notification
  }>;
  cameraOnly?: boolean;
  formula?: any;
  offlineEnabled?: boolean;
  attachments?: { name: string; type: string; url: string }[];
  subQuestions?: Question[]; // Add this field for nested sub-questions
  tableSubQuestions?: Question[]; // Add this field for nested sub-questions
  requiresLive?: boolean; // ✅ Add this
  maxFiles?: number;
  fullName?: string;
  hint?: string;
  from?: number;
  to?: number;
  leftLabel?: string;
  rightLabel?: string;
  previewAnswer?: string | number; // For preview purposes
  tablePreviewAnswers?: any[]; // For preview purposes
  observation?: string,
  critical?: boolean,
  referenceImageEnabled?: boolean;
  referenceImages?: (string | File | null)[];
  referenceVideos?: (File | string)[];
  referenceVideoEnabled?: boolean;
}

export interface Stage {
  index?: number
  id: string
  originalId?: string
  title: string
  questions: Question[]
  whoShouldFill?: "user" | "group" | "previous_stage" | "organization" | "role"
  users?: any[] // List of user IDs
  groups?: any[] // List of group IDs
  requiresApproval?: boolean
  remarks?: string,
  allow_stage?: string | null // For "previous_stage" access type
}

const createClientStageId = () => `stage-${Math.random().toString(36).slice(2, 10)}`;

const normalizeStageIds = (stages: Stage[]): Stage[] => {
  const seen = new Map<string, number>();
  const originalToClient = new Map<string, string>();

  const normalized = stages.map((stage) => {
    const baseId = stage.id ?? createClientStageId();
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    const originalId = stage.originalId ?? baseId;
    const uniqueId = count === 0 ? baseId : `${baseId}__${count}`;

    if (!originalToClient.has(originalId)) {
      originalToClient.set(originalId, uniqueId);
    }

    return {
      ...stage,
      id: uniqueId,
      originalId,
    };
  });

  return normalized.map((stage) => {
    if (!stage.allow_stage) return stage;
    const mapped = originalToClient.get(stage.allow_stage) ?? stage.allow_stage;
    return mapped === stage.allow_stage ? stage : { ...stage, allow_stage: mapped };
  });
};

const resolveStageServerId = (stage: Stage) => stage.originalId ?? stage.id;

// Sortable Stage Component
function SortableStage({ stage, index, activeStage, setActiveStage, handleDeleteStage, formData }: {
  stage: Stage;
  index: number;
  activeStage: string | null;
  setActiveStage: (id: string) => void;
  handleDeleteStage: (id: string) => void;
  formData: FormData;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-2 rounded-md cursor-pointer flex justify-between items-center ${activeStage === stage.id ? "bg-primary text-primary-foreground" : "hover:bg-muted border-2 border-gray-300"
        }`}
      onClick={() => setActiveStage(stage.id)}
    >
      <div className="flex items-center gap-2 flex-1">
        <div
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="truncate">{stage.title}</span>
      </div>
      {
        formData.stages.length > 1 &&
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 ${activeStage === stage.id ? "text-primary-foreground hover:text-primary-foreground" : ""
            }`}
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteStage(stage.id)
          }}
        >
          <Trash className="h-4 w-4" />
        </Button>
      }
    </div>
  );
}

const resolveAllowStageServerId = (clientId: string | null | undefined, stages: Stage[]): string | null => {
  if (!clientId) return null;
  const target = stages.find((s) => s.id === clientId);
  if (!target) return clientId;
  return resolveStageServerId(target);
};

const getApiTriggerEmailNotifications = (api: any): boolean => {
  const value =
    api?.trigger_email_notifications ??
    api?.triggerEmailNotifications ??
    api?.trigger_email_notification ??
    api?.triggerEmailNotification;
  return Boolean(value);
};

export interface FormData {
  id?: string | number
  title: string
  type: FormType
  captureGPS: boolean
  allowSharing: boolean
  passPercentage: number
  responseIdPrefix: string
  allowEditing: boolean
  maxScore?: number
  enableStageReEditing: boolean
  triggerEmailNotifications: boolean
  autoShareResponses: boolean
  autoShareWith: "user" | "group" | "location" | null
  folderId: string | null
  folderName: string | null
  stages: Stage[],
  requiresApproval: boolean
  logics: Logic[]
  autoShareUsers?: string[]
  autoShareGroups?: string[]
  autoShareLocations?: string[]
}

interface Folder {
  id: string;
  name: string;
  description: string;
}

interface AutoShareLocationLeaderOption {
  id: string;
  name: string;
}

type FollowUpQuestion = {
  question_uuid: string;
  question_type: QuestionType
  question: string;
  hint?: string;
  order: number;
  valueType?: "text" | "number";
  requiresLive?: boolean;
  maxFiles?: number;
  is_required: boolean;
  options?: string[];
};

type FollowUp = {
  enabled?: boolean;
  followup_toggle?: boolean;
  title: string;
  description?: string;
  deadline: number;
  assign_to: "form_submitter";
  assign_form?: string;
  assignFormUser?: string;
  assignFormSubmitter?: boolean;
  assignUsers?: string[];
  assignGroups?: string[];
  task_close_questions: FollowUpQuestion[];
};

type Notification = {
  enabled: boolean;
  users: string[];
  groups: string[];
  emails: string;
};

type Logic = {
  logic_type: "is" | "is_not";
  logic_value: string;
  order: number;
  notification: Notification;
  follow_up: FollowUp;
  logic_questions: any[]; // adapt to your sub-question type
};

const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (item == null) return null;
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (typeof item === "object") {
        const record = item as Record<string, unknown>;
        const nestedId = record.id ?? record.user_id ?? record.group_id ?? record.location_id ?? record.role_id;
        return nestedId == null ? null : String(nestedId);
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
};

const normalizeIntegerIdArray = (value: unknown): number[] =>
  normalizeIdArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));

const getAutoShareRecipientsFromApi = (api: any) => {
  const autoShareConfig = api.auto_share_config ?? {};

  const autoShareUsers = normalizeIdArray(
    autoShareConfig.users ??
    api.auto_share_user_ids ??
    api.auto_share_users ??
    api.share_user_ids ??
    api.shared_user_ids ??
    api.users
  );
  const autoShareGroups = normalizeIdArray(
    autoShareConfig.groups ??
    api.auto_share_group_ids ??
    api.auto_share_groups ??
    api.share_group_ids ??
    api.shared_group_ids ??
    api.groups
  );
  const autoShareLocations = normalizeIdArray(
    autoShareConfig.location_leaders ??
    api.auto_share_location_role_ids ??
    api.auto_share_location_roles ??
    api.auto_share_locations ??
    api.share_location_role_ids ??
    api.shared_location_role_ids ??
    api.location_roles ??
    api.locations
  );

  let autoShareWith: FormData["autoShareWith"] = null;
  if (autoShareUsers.length > 0) autoShareWith = "user";
  else if (autoShareGroups.length > 0) autoShareWith = "group";
  else if (autoShareLocations.length > 0) autoShareWith = "location";

  return {
    autoShareUsers,
    autoShareGroups,
    autoShareLocations,
    autoShareWith,
  };
};

const getAutoSharePayloadFields = (formData: FormData) => ({
  auto_share_response: formData.autoShareResponses,
  auto_share_config: {
    users: normalizeIntegerIdArray(formData.autoShareUsers ?? []),
    groups: normalizeIntegerIdArray(formData.autoShareGroups ?? []),
    location_leaders: normalizeIntegerIdArray(formData.autoShareLocations ?? []),
  },
});


export function FormCreator({ id, formData,
  setFormData,
  step,
  setStep,
  setIsInEditCheck,
  setFormId,
  prefetchedData,
  status }: FormCreatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname()
  const isInEditCheck = pathname.split("/").pop()
  const pagemode = searchParams.get("mode");
  const folderIdFromUrl = searchParams.get("folderId");
  const isDuplicate = pagemode === "duplicate";
  const isEditing = !!id
  const userinfo = useSelector(selectUser);
  const adminid = userinfo?.id || null;
  // State for multi-step form creation
  // const [step, setStep] = useState<"type" | "header" | "stages">(isEditing ? "header" : "type")
  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [folderDescription, setFolderDescription] = useState("")
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<Record<string, QuestionType | "">>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [autoShareLocationLeaders, setAutoShareLocationLeaders] = useState<AutoShareLocationLeaderOption[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [questionTypesObj, setQuestionTypesObj] = useState<any[]>([]);
  const [questionTypes, setQuestionTypes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stageAddedMsg, setStageAddedMsg] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [conditionalLogicAttention, setConditionalLogicAttention] = useState<string | null>(null);
  const [newlyCreatedFolderId, setNewlyCreatedFolderId] = useState<string | null>(null);

  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFormData((prev) => {
        const oldIndex = prev.stages.findIndex((stage) => stage.id === active.id);
        const newIndex = prev.stages.findIndex((stage) => stage.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newStages = arrayMove(prev.stages, oldIndex, newIndex);
          return {
            ...prev,
            stages: newStages,
          };
        }
        
        return prev;
      });
    }
  };

  // const [conditionalLogicModalOpen, setConditionalLogicModalOpen] = useState<null | string>(null);
  const [conditionalLogicModalOpen, setConditionalLogicModalOpen] = useState<null | { questionId: string, logicIndex: number }>(null);
  const [cloneDuplicatePayload, setCloneDuplicatePayload] = useState<any>(null);

  const [showBackDialog, setShowBackDialog] = useState(false);
  // const [isFormDirty, setIsFormDirty] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const { isFormDirty, setIsFormDirty } = useFormStore();
  const [isNoneSelected, setIsNoneSelected] = useState(false);

  const [selectedRefImageForView, setSelectedRefImageForView] = useState<string | null>(null);
  const [selectedRefVideoForView, setSelectedRefVideoForView] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ type: "image" | "video"; url: string } | null>(null);
  const [allForms, setAllForms] = useState<any[]>([]);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);
  const [webcamQuestionId, setWebcamQuestionId] = useState<string | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isFormTypeSelected, setIsFormTypeSelected] = useState(false);

  const user = useSelector(selectUser);
  const organizationId = user?.organization;

  const isFailed = status === "failed"

  const isMobileDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const stopWebcamStream = () => {
    setWebcamStream((prev) => {
      prev?.getTracks().forEach((track) => track.stop());
      return null;
    });
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const openWebcamModal = (questionId: string) => {
    setWebcamError(null);
    setWebcamQuestionId(questionId);
    setIsWebcamModalOpen(true);
  };

  const closeWebcamModal = () => {
    setIsWebcamModalOpen(false);
    setWebcamQuestionId(null);
    setWebcamError(null);
    stopWebcamStream();
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !webcamQuestionId || !activeStage) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) return;

    const file = new File([blob], `reference-${Date.now()}.jpg`, { type: "image/jpeg" });

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("upload_preset", "vibro-gallery-upload");
    uploadData.append("folder", "form_references");
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      uploadData
    );
    const uploadedImageUrls = [response.data.secure_url];
    const existing =
      formData.stages
        .find((s) => s.id === activeStage)
        ?.questions.find((q) => q.id === webcamQuestionId)
        ?.referenceImages || [];
    handleQuestionUpdate(activeStage, webcamQuestionId, "referenceImages", [...existing, ...uploadedImageUrls]);
    closeWebcamModal();
  };

  useEffect(() => {
    if (!isWebcamModalOpen) {
      stopWebcamStream();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setWebcamError("Webcam is not supported in this browser.");
      return;
    }

    let cancelled = false;
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setWebcamStream(stream);
      } catch (error) {
        setWebcamError("Camera access was denied. Please allow permission and try again.");
      }
    };

    startWebcam();
    return () => {
      cancelled = true;
    };
  }, [isWebcamModalOpen]);

  useEffect(() => {
    if (!videoRef.current || !webcamStream) return;
    videoRef.current.srcObject = webcamStream;
    videoRef.current.play().catch(() => undefined);
  }, [webcamStream]);



  useEffect(() => {
    if (isFormTypeSelected || isEditing) {
      const fetchAllForms = async () => {
        try {
          const response = await axiosInstance.get(`/forms/organization/${organizationId}/`);
          setAllForms(response.data.forms);
        } catch (error) {
          console.error("Error fetching forms:", error);
        }
      };

      fetchAllForms();
    }
  }, [isFormTypeSelected, isEditing, organizationId]);


  const [showUserModal, setShowUserModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false)
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false)

  useEffect(() => {
    if (folderIdFromUrl && folders.length > 0) {
      // Ensure types match (convert folder.id to string)
      const found = folders.find(f => String(f.id) === String(folderIdFromUrl));

      if (found) {
        handleFormDataChange("folderId", String(found.id));
        setIsNoneSelected(false);
      } else {
        // If folderIdFromUrl not in list → reset to none
        handleFormDataChange("folderId", null);
        setIsNoneSelected(true);
      }
    }
  }, [folderIdFromUrl, folders, step]);

  const handleBack = () => {
    // if (isEditing) {
    setShowBackDialog(true); // show modal
    // } else {
    // setStep("type"); 
    // }
  };

  const handleCancel = () => setShowBackDialog(false);
  const handleConfirm = () => {
    setShowBackDialog(false);
    router.push("/forms");
  };

  function getDuplicateTitle(originalTitle: string): string {
    // If the title already has "Copy" at the end, increment the number
    const copyRegex = /(.*?)( Copy(?: \((\d+)\))?)$/;
    const match = originalTitle.match(copyRegex);

    if (match) {
      const baseTitle = match[1].trim();
      const currentNumber = match[3] ? parseInt(match[3], 10) : 1;
      return `${baseTitle} Copy (${currentNumber + 1})`;
    }

    // If no "Copy" yet, add it for the first time
    return `${originalTitle} Copy`;
  }

  const mapOptionsForClone = (options: any[]) => {
    return options.map(o => ({
      option: o.option,
      score: o.score,
      failed: o.failed,
      order: o.order,
    }));
  };

  const mapLogicQuestionsForClone = (questions: any[]) => {
    return questions.map(q => ({
      question: q.question,
      question_type: q.question_type,
      question_uuid: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order: q.order,
      is_required: q.is_required,
      min_value: q.min_value,
      max_value: q.max_value,
    }));
  }

  const mapLogicsForClone = (logics: any[]) => {
    return logics.map(l => ({
      logic_type: l.logic_type,
      comparison: l.comparison,
      logic_value: l.logic_value,
      notification: l.notification,
      email: l.email,
      order: l.order,
      logic_questions: l.logic_questions ? mapLogicQuestionsForClone(l.logic_questions) : [],
    }));
  };



  const mapQuestionsForClone = (questions: any[]): any[] => {
    return questions.map(q => ({
      question: q.question,
      question_type: q.question_type,
      question_uuid: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order: q.order,
      is_required: q.is_required,
      min_value: q.min_value,
      max_value: q.max_value,
      max_score: q.max_score,
      critical: q.critical,
      is_other: q.is_other,
      formula: q.formula,
      question_hint: q.question_hint,
      options: q.options ? mapOptionsForClone(q.options) : [],
      sub_questions: q.sub_questions ? mapQuestionsForClone(q.sub_questions) : [],
      logics: q.logics ? mapLogicsForClone(q.logics) : [],
    }));
  };


  const fetchFormData = async (id: any) => {
    try {
      let response
      if (isFailed) {
        response = await axiosInstance.get(`/form-payload-files/${id}/`)
      } else {
        response = await axiosInstance.get(`/form/${id}/`);
      }
      const formData = response?.data;
      let mapped: FormData;
      if (response?.data?.form_type === "audit") {
        mapped = mapAuditApiResponseToFormData(response?.data);
        console.log("mapped audit form ::", mapped)
      } else {
        mapped = mapApiResponseToFormData(response?.data);
      }


      setFormData(mapped);
      if (mapped.stages.length > 0) {
        setActiveStage(mapped.stages[0].id); // ✅ use uuid
      }

      let duplicateconvertedPayload: any;
      const duplicateAutoShareConfig = {
        auto_share_response: formData.auto_share_response,
        auto_share_config: {
          users: normalizeIntegerIdArray(formData.auto_share_config?.users ?? formData.auto_share_users),
          groups: normalizeIntegerIdArray(formData.auto_share_config?.groups ?? formData.auto_share_groups),
          location_leaders: normalizeIntegerIdArray(
            formData.auto_share_config?.location_leaders ??
            formData.auto_share_location_leaders ??
            formData.auto_share_location_roles ??
            formData.auto_share_locations
          ),
        },
      };

      if (formData.form_type === "audit") {
        duplicateconvertedPayload = {
          form_type: formData.form_type,
          title: getDuplicateTitle(formData.title),
          folder: formData.folder,
          prefix: formData.prefix,
          GPS: formData.GPS,
          share_response: formData.share_response,
          allow_editing: formData.allow_editing,
          can_edit_previous_state: formData.can_edit_previous_state,
          ...duplicateAutoShareConfig,
          pass_percentage: formData.pass_percentage,
          trigger_email_notifications: getApiTriggerEmailNotifications(formData),
          max_score: formData.max_score,
          form_admin: formData.form_admin,
          audit_info: formData.audit_info ? {
            name: formData.audit_info.name,
            questions: mapQuestionsForClone(formData.audit_info.questions || []),
          } : null,
          audit_group: (formData.audit_group || []).map((group: any) => ({
            name: group.name,
            questions: mapQuestionsForClone(group.questions || []),
          })),
        };
      } else {
        duplicateconvertedPayload = {
          form_type: formData.form_type,
          title: getDuplicateTitle(formData.title),
          folder: formData.folder,
          prefix: formData.prefix,
          GPS: formData.GPS,
          share_response: formData.share_response,
          allow_editing: formData.allow_editing,
          can_edit_previous_state: formData.can_edit_previous_state,
          ...duplicateAutoShareConfig,
          pass_percentage: formData.pass_percentage,
          trigger_email_notifications: getApiTriggerEmailNotifications(formData),
          max_score: formData.max_score,
          form_admin: formData.form_admin,
          stages: formData.stages.map((stage: any) => ({
            name: stage.name,
            stage_uuid: stage.stage_uuid,
            order: stage.order,
            stage_access: stage.stage_access || [],
            questions: mapQuestionsForClone(stage.questions || []),
          }))
        };
      }

      setCloneDuplicatePayload(duplicateconvertedPayload);


    } catch (error) {
      console.error("Error fetching form data:", error);
    }
  };

  // Helper to map stage_access into UI-friendly fields
  const mapStageAccess = (stageAccess: any[]) => {
    const users: number[] = [];
    const groups: number[] = [];
    let whoShouldFill: "organization" | "role" | "previous_stage" | "user" | null = null;
    let allow_stage: string | null = null;

    stageAccess?.forEach((a) => {
      switch (a.access_type) {
        case "user":
          if (a.allow_user) {
            users.push(a.allow_user);
            whoShouldFill = "user";   // ✅ force toggle to open
          }
          break;
        case "group":
          if (a.allow_group) {
            groups.push(a.allow_group);
            whoShouldFill = "user";   // ✅ force toggle to open
          }
          break;
        case "organization":
          whoShouldFill = "organization";
          break;
        case "role":
          whoShouldFill = "role";
          break;
        case "previous_stage":
          whoShouldFill = "previous_stage";
          allow_stage = a.allow_stage;
          break;
      }
    });

    return { users, groups, whoShouldFill, allow_stage };
  };



  function mapApiResponseToFormData(api: any): FormData {
    const autoShareRecipients = getAutoShareRecipientsFromApi(api);
    const baseStages: Stage[] = (api.stages ?? []).map((s: any, index: number) => {
      const { users, groups, whoShouldFill, allow_stage } = mapStageAccess(s.stage_access);

      return {
        index,
        id: s.stage_uuid,
        originalId: s.stage_uuid,
        uuid: s.stage_uuid,
        title: s.name,
        users,
        groups,
        whoShouldFill,
        allow_stage,
        questions: s.questions.map((q: any) => {
          let tableSubQuestions: any[] = [];
          if (q.question_type === "table" && q.sub_questions?.length) {
            tableSubQuestions = q.sub_questions.map((subQ: any) => ({
              id: subQ.question_uuid ?? String(subQ.id),
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
              subQuestions: [],
              tableSubQuestions: [],
              conditionalLogics: [],
              referenceImages: subQ.reference_images ?? [],
              referenceVideos: subQ.reference_videos ?? [],
              referenceImageEnabled: (subQ.reference_images?.length ?? 0) > 0,
              referenceVideoEnabled: (subQ.reference_videos?.length ?? 0) > 0,
              attachments: []
            }));
          }

          return {
            id: q.question_uuid,
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
            valueType: q.question_sub_type ?? undefined,
            tableSubQuestions,
            conditionalLogics: q.logics?.map((l: any) => ({
              id: l.id,
              enabled: true,
              logic_type: l.logic_type,
              comparision: l.comparison,
              logic_value: l.logic_value,
              targetQuestionId: undefined,
              subQuestions: l.logic_questions?.map((subQ: any) => ({
                id: subQ.question_uuid ?? String(subQ.id),
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
                valueType: subQ.question_sub_type ?? undefined,
                subQuestions: [],
                tableSubQuestions: [],
                conditionalLogics: [],
                referenceImages: [],
                referenceVideos: [],
                referenceImageEnabled: false,
                referenceVideoEnabled: false,
                attachments: []
              })) ?? [],
              follow_up: l.follow_up
                ? {
                  ...l.follow_up,
                  enabled: true,
                  followup_toggle: l.follow_up.followup_toggle ?? true,
                  assign_form: l.follow_up.assign_form ? l.follow_up.assign_form.toString() : "",
                  assignUsers: l.follow_up.assign_user_ids ? l.follow_up.assign_user_ids.map((id: any) => String(id)) : [],
                  assignGroups: l.follow_up.assign_group_ids ? l.follow_up.assign_group_ids.map((id: any) => String(id)) : [],
                  task_close_questions: (l.follow_up.task_close_questions ?? []).map((tcq: any) => ({
                    ...tcq,
                    hint: tcq.hint ?? tcq.question_hint ?? "",
                  })),
                }
                : {
                  enabled: false,
                  followup_toggle: false,
                  title: "",
                  description: "",
                  deadline: 0,
                  assign_to: "form_submitter",
                  assignFormUser: "",
                  assignFormSubmitter: false,
                  assignUsers: [],
                  assignGroups: [],
                  task_close_questions: [],
                },
              notification: l.notification ?? null
            })) ?? [],
            referenceImages: q.reference_images ?? [],
            referenceVideos: q.reference_videos ?? [],
            referenceImageEnabled: (q.reference_images?.length ?? 0) > 0,
            referenceVideoEnabled: (q.reference_videos?.length ?? 0) > 0,
            attachments: []
          };
        })
      };
    });

    const rawStageRefToClientId = new Map<string, string>();
    (api.stages ?? []).forEach((rawStage: any, index: number) => {
      const clientStageId = baseStages[index]?.id ? String(baseStages[index].id) : null;
      if (!clientStageId) return;

      if (rawStage?.stage_uuid) {
        rawStageRefToClientId.set(String(rawStage.stage_uuid), clientStageId);
      }
      if (rawStage?.id !== undefined && rawStage?.id !== null) {
        rawStageRefToClientId.set(String(rawStage.id), clientStageId);
      }

      const firstQuestionUuid = rawStage?.questions?.[0]?.question_uuid;
      if (typeof firstQuestionUuid === "string") {
        const match = firstQuestionUuid.match(/^q(\d+)/);
        if (match?.[1]) {
          rawStageRefToClientId.set(`ts:${match[1]}`, clientStageId);
        }
      }
    });

    const resolveAllowStageClientId = (allowStage: string | null | undefined) => {
      if (!allowStage) return null;
      const value = String(allowStage);

      const direct = rawStageRefToClientId.get(value);
      if (direct) return direct;

      const legacyTimestamp = value.match(/^stage(\d+)(?:-|$)/)?.[1];
      if (legacyTimestamp) {
        const byTimestamp = rawStageRefToClientId.get(`ts:${legacyTimestamp}`);
        if (byTimestamp) return byTimestamp;
      }

      return value;
    };

    const validStageIds = new Set(baseStages.map((s) => String(s.id)));
    baseStages.forEach((stage) => {
      if (stage.whoShouldFill !== "previous_stage") return;
      if (!stage.allow_stage) return;

      const resolved = resolveAllowStageClientId(stage.allow_stage);
      if (resolved && validStageIds.has(String(resolved))) {
        stage.allow_stage = String(resolved);
      }
    });

    baseStages.forEach((stage) => {
      if (stage.whoShouldFill !== "previous_stage") return;
      if (stage.allow_stage) return;

      const stageIndex = stage.index; // ✅ local variable

      if (typeof stageIndex !== "number") return;

      const previousStage = baseStages.find((s) => {
        const sIndex = s.index;
        return typeof sIndex === "number" && sIndex === stageIndex - 1;
      });

      if (previousStage) {
        stage.allow_stage = previousStage.id;
      }
    });

    return {
      title: api.title,
      type: api.form_type,
      captureGPS: api.GPS,
      allowSharing: api.share_response,
      passPercentage: api.pass_percentage ?? 70,
      responseIdPrefix: api.prefix,
      allowEditing: api.allow_editing,
      enableStageReEditing: api.can_edit_previous_state,
      triggerEmailNotifications: getApiTriggerEmailNotifications(api),
      autoShareResponses: api.auto_share_response,
      autoShareWith: autoShareRecipients.autoShareWith,
      folderId: api.folder ? String(api.folder) : null,
      folderName: api.folder_name || null,
      stages: normalizeStageIds(baseStages),
      requiresApproval: false,
      logics: [],
      autoShareUsers: autoShareRecipients.autoShareUsers,
      autoShareGroups: autoShareRecipients.autoShareGroups,
      autoShareLocations: autoShareRecipients.autoShareLocations,
    };
  }

  // function mapApiResponseToFormData(api: any): FormData {
  //   const baseStages: Stage[] = (api.stages ?? []).map((s: any, index: number) => {
  //     const { users, groups, whoShouldFill, allow_stage } =
  //       mapStageAccess(s.stage_access);

  //     return {
  //       index,                              // 🔑 used for previous_stage fix
  //       id: s.stage_uuid,                   // backend UUID
  //       originalId: s.stage_uuid,
  //       uuid: s.stage_uuid,
  //       title: s.name,
  //       users,
  //       groups,
  //       whoShouldFill,
  //       allow_stage,                        // backend sends OLD uuid here
  //       questions: s.questions.map((q: any) => {
  //         let tableSubQuestions: any[] = [];

  //         if (q.question_type === "table" && q.sub_questions?.length) {
  //           tableSubQuestions = q.sub_questions.map((subQ: any) => ({
  //             id: subQ.question_uuid ?? String(subQ.id),
  //             type: subQ.question_type,
  //             title: subQ.question,
  //             description: subQ.description ?? "",
  //             required: subQ.is_required,
  //             maxFiles: subQ.number_of_file_allowed ?? 1,
  //             requiresLive: subQ.require_live ?? false,
  //             options: subQ.options?.map((o: any) => o.option) ?? [],
  //             maxScore: subQ.max_score ?? undefined,
  //             formula: subQ.formula,
  //             critical: subQ.critical ?? false,
  //             hint: subQ.question_hint ?? "",
  //             subQuestions: [],
  //             tableSubQuestions: [],
  //             conditionalLogics: [],
  //             referenceImages: subQ.reference_images ?? [],
  //             referenceVideos: subQ.reference_videos ?? [],
  //             referenceImageEnabled:
  //               (subQ.reference_images?.length ?? 0) > 0,
  //             referenceVideoEnabled:
  //               (subQ.reference_videos?.length ?? 0) > 0,
  //             attachments: []
  //           }));
  //         }

  //         return {
  //           id: q.question_uuid,
  //           type: q.question_type,
  //           title: q.question,
  //           description: q.description ?? "",
  //           required: q.is_required,
  //           maxFiles: q.number_of_file_allowed ?? 1,
  //           requiresLive: q.require_live ?? false,
  //           options: q.options?.map((o: any) => o.option) ?? [],
  //           maxScore: q.max_score ?? undefined,
  //           formula: q.formula,
  //           critical: q.critical ?? false,
  //           hint: q.question_hint ?? "",
  //           valueType: q.question_sub_type ?? undefined,
  //           tableSubQuestions,
  //           conditionalLogics: q.logics?.map((l: any) => ({
  //             id: l.id,
  //             enabled: true,
  //             logic_type: l.logic_type,
  //             comparision: l.comparison,
  //             logic_value: l.logic_value,
  //             targetQuestionId: undefined,
  //             subQuestions: l.logic_questions?.map((subQ: any) => ({
  //               id: subQ.question_uuid ?? String(subQ.id),
  //               type: subQ.question_type,
  //               title: subQ.question,
  //               description: subQ.description ?? "",
  //               required: subQ.is_required,
  //               maxFiles: subQ.number_of_file_allowed ?? 1,
  //               requiresLive: subQ.require_live ?? false,
  //               options: subQ.options?.map((o: any) => o.option) ?? [],
  //               maxScore: subQ.max_score ?? undefined,
  //               formula: subQ.formula,
  //               critical: subQ.critical ?? false,
  //               hint: subQ.question_hint ?? "",
  //               valueType: subQ.question_sub_type ?? undefined,
  //               subQuestions: [],
  //               tableSubQuestions: [],
  //               conditionalLogics: [],
  //               referenceImages: [],
  //               referenceVideos: [],
  //               referenceImageEnabled: false,
  //               referenceVideoEnabled: false,
  //               attachments: []
  //             })) ?? [],
  //             follow_up: l.follow_up
  //               ? {
  //                 ...l.follow_up,
  //                 enabled: true,
  //                 followup_toggle: l.follow_up.followup_toggle ?? true,
  //                 assign_form: l.follow_up.assign_form
  //                   ? l.follow_up.assign_form.toString()
  //                   : "",
  //                 assignUsers: l.follow_up.assign_user_ids
  //                   ? l.follow_up.assign_user_ids.map((id: any) =>
  //                     String(id)
  //                   )
  //                   : [],
  //                 assignGroups: l.follow_up.assign_group_ids
  //                   ? l.follow_up.assign_group_ids.map((id: any) =>
  //                     String(id)
  //                   )
  //                   : []
  //               }
  //               : {
  //                 enabled: false,
  //                 followup_toggle: false,
  //                 title: "",
  //                 description: "",
  //                 deadline: 0,
  //                 assign_to: "form_submitter",
  //                 assignFormUser: "",
  //                 assignFormSubmitter: false,
  //                 assignUsers: [],
  //                 assignGroups: [],
  //                 task_close_questions: []
  //               },
  //             notification: l.notification ?? null
  //           })) ?? [],
  //           referenceImages: q.reference_images ?? [],
  //           referenceVideos: q.reference_videos ?? [],
  //           referenceImageEnabled:
  //             (q.reference_images?.length ?? 0) > 0,
  //           referenceVideoEnabled:
  //             (q.reference_videos?.length ?? 0) > 0,
  //           attachments: []
  //         };
  //       })
  //     };
  //   });

  //   // 🔥🔥🔥 THE ACTUAL FIX (order-based, backend-safe)
  //   baseStages.forEach((stage) => {
  //     if (stage.whoShouldFill !== "previous_stage") return;

  //     const stageIndex = stage.index; // ✅ local variable

  //     if (typeof stageIndex !== "number") return;

  //     const previousStage = baseStages.find((s) => {
  //       const sIndex = s.index;
  //       return typeof sIndex === "number" && sIndex === stageIndex - 1;
  //     });

  //     if (previousStage) {
  //       stage.allow_stage = previousStage.id;
  //     }
  //   });


  //   return {
  //     title: api.title,
  //     type: api.form_type,
  //     captureGPS: api.GPS,
  //     allowSharing: api.share_response,
  //     passPercentage: api.pass_percentage ?? 70,
  //     responseIdPrefix: api.prefix,
  //     allowEditing: api.allow_editing,
  //     enableStageReEditing: api.can_edit_previous_state,
  //     triggerEmailNotifications: false,
  //     autoShareResponses: api.auto_share_response,
  //     autoShareWith: null,
  //     folderId: api.folder ? String(api.folder) : null,
  //     folderName: api.folder_name || null,
  //     stages: normalizeStageIds(baseStages),
  //     requiresApproval: false,
  //     logics: []
  //   };
  // }



  function mapAuditApiResponseToFormData(api: any): FormData {
    const autoShareRecipients = getAutoShareRecipientsFromApi(api);
    const mapQuestions = (questions: any[]): any[] => {
      return questions.map((q: any) => {
        let tableSubQuestions: any[] = [];
        if (q.question_type === "table" && q.sub_questions?.length) {
          tableSubQuestions = q.sub_questions.map((subQ: any) => ({
            id: subQ?.question_uuid ?? String(subQ.id),
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
            subQuestions: [],
            tableSubQuestions: [],
            conditionalLogics: [],
            referenceImages: subQ.reference_images ?? [],
            referenceVideos: subQ.reference_videos ?? [],
            referenceImageEnabled: (subQ.reference_images?.length ?? 0) > 0,
            referenceVideoEnabled: (subQ.reference_videos?.length ?? 0) > 0,
            attachments: []
          }));
        }

        const mapped = {
          id: q?.question_uuid ?? String(q.id),
          type: q.question_type,
          title: q.question,
          description: q.description ?? "",
          required: q.is_required,
          requiresLive: q.require_live ?? false,
          options: q.options?.map((o: any) => o.option) ?? [],
          auditOptions: q.question_type === "audit"
            ? q.options?.map((o: any) => ({ option: o.option, score: o.score ?? 0 })) ?? []
            : undefined,
          maxScore: q.max_score ?? undefined,
          formula: q.formula,
          critical: q.critical ?? false,
          hint: q.question_hint ?? "",
          valueType: q.question_sub_type ?? undefined,
          subQuestions: q.sub_questions ? mapQuestions(q.sub_questions) : [],
          tableSubQuestions,
          conditionalLogics: q.logics?.map((l: any) => ({
            id: l.id,
            enabled: true,
            logic_type: l.logic_type,
            comparision: l.comparison,
            logic_value: l.logic_value,
            targetQuestionId: undefined,
            subQuestions: mapQuestions(l.logic_questions ?? []),
            follow_up: l.follow_up
              ? {
                ...l.follow_up,
                enabled: true,
                followup_toggle: l.follow_up.followup_toggle ?? true,
                assign_form: l.follow_up.assign_form ? l.follow_up.assign_form.toString() : "",
                assignUsers: l.follow_up.assign_user_ids ? l.follow_up.assign_user_ids.map((id: any) => String(id)) : [],
                assignGroups: l.follow_up.assign_group_ids ? l.follow_up.assign_group_ids.map((id: any) => String(id)) : [],
                task_close_questions: (l.follow_up.task_close_questions ?? []).map((tcq: any) => ({
                  ...tcq,
                  hint: tcq.hint ?? tcq.question_hint ?? "",
                })),
              }
              : {
                enabled: false,
                followup_toggle: false,
                title: "",
                description: "",
                deadline: 0,
                assign_to: "form_submitter",
                assignFormUser: "",
                assignFormSubmitter: false,
                assignUsers: [],
                assignGroups: [],
                task_close_questions: [],
              },
            notification: l.notification ?? null
          })) ?? [],
          referenceImages: q.reference_images ?? [],
          referenceVideos: q.reference_videos ?? [],
          referenceImageEnabled: (q.reference_images?.length ?? 0) > 0,
          referenceVideoEnabled: (q.reference_videos?.length ?? 0) > 0,
          attachments: []
        };

        if (q.question_type === "upload_image" || q.question_type === "upload_file") {
          (mapped as any).maxFiles = q.number_of_file_allowed ?? 1;
        }

        return mapped;
      });
    };

    const stagesFromApi: Stage[] = (api.stages ?? []).map((s: any, index: number) => {
      const stageOriginalId = s.stage_uuid ? String(s.stage_uuid) : `stage-${String(s.id ?? index)}`;
      return {
        index,
        id: stageOriginalId,
        originalId: stageOriginalId,
        uuid: s.stage_uuid,
        title: s.name,
        questions: mapQuestions(s.questions)
      };
    });

    const auditInfoStage = api.audit_info ? {
      index: stagesFromApi.length,
      id: api.audit_info.group_uuid ? String(api.audit_info.group_uuid) : `stage-${String(api.audit_info.id ?? stagesFromApi.length)}`,
      originalId: api.audit_info.group_uuid ? String(api.audit_info.group_uuid) : `stage-${String(api.audit_info.id ?? stagesFromApi.length)}`,
      uuid: api.audit_info.group_uuid,
      title: api.audit_info.name,
      questions: mapQuestions(api.audit_info.questions)
    } : null;

    const auditGroupStages = (api.audit_group ?? []).map((group: any, idx: number) => {
      const groupOriginalId = group.group_uuid ? String(group.group_uuid) : `stage-${String(group.id ?? idx)}`;
      return {
        index: stagesFromApi.length + (auditInfoStage ? 1 : 0) + idx,
        id: groupOriginalId,
        originalId: groupOriginalId,
        uuid: group.group_uuid,
        title: group.name,
        questions: mapQuestions(group.questions)
      };
    });

    const combinedStages = [
      ...stagesFromApi,
      ...(auditInfoStage ? [auditInfoStage] : []),
      ...auditGroupStages
    ];

    return {
      title: api.title,
      type: api.form_type,
      captureGPS: api.GPS,
      allowSharing: api.share_response,
      passPercentage: api.pass_percentage ?? 70,
      responseIdPrefix: api.prefix ?? "",
      allowEditing: api.allow_editing,
      enableStageReEditing: api.can_edit_previous_state,
      triggerEmailNotifications: getApiTriggerEmailNotifications(api),
      autoShareResponses: api.auto_share_response,
      autoShareWith: autoShareRecipients.autoShareWith,
      folderId: api.folder ? String(api.folder) : null,
      folderName: api.folder_name || null,
      stages: normalizeStageIds(combinedStages),
      requiresApproval: false,
      logics: [],
      autoShareUsers: autoShareRecipients.autoShareUsers,
      autoShareGroups: autoShareRecipients.autoShareGroups,
      autoShareLocations: autoShareRecipients.autoShareLocations,
    };
  }



  useEffect(() => {
    if (prefetchedData) {
      const fd = prefetchedData;
      const mapped = fd.form_type === "audit" ? mapAuditApiResponseToFormData(fd) : mapApiResponseToFormData(fd);
      setFormData(mapped);
      if (mapped.stages.length > 0) {
        setActiveStage(mapped.stages[0].id);
      }
      return;
    }
    if (isEditing && id) {
      fetchFormData(id)
    }
  }, [id, isEditing, prefetchedData])


  useEffect(() => {
    if (formData.folderId && formData.folderName) {
      const exists = folders.some(f => String(f.id) === String(formData.folderId));
      if (!exists) {
        setFolders(prev => [
          ...prev,
          {
            id: String(formData.folderId),
            name: formData.folderName || "Unknown Folder",
            description: "", // or API-provided description
          }
        ]);
      }
    }
  }, [formData.folderId, formData.folderName, folders]);


  // Form data state
  // const [formData, setFormData] = useState<FormData>(() => {
  //   if (isEditing && id) {
  //     fetchFormData(id)
  //     return {
  //       title: "",
  //       type: "standard",
  //       captureGPS: false,
  //       allowSharing: true,
  //       passPercentage: 70,
  //       maxScore: 100,
  //       responseIdPrefix: "",
  //       allowEditing: false,
  //       enableStageReEditing: false,
  //       triggerEmailNotifications: false,
  //       autoShareResponses: false,
  //       autoShareWith: null,
  //       folderId: null,
  //       stages: [],
  //       requiresApproval: false,
  //       logics: []
  //     }
  //   }

  //   return {
  //     title: "",
  //     type: "standard",
  //     captureGPS: false,
  //     allowSharing: true,
  //     passPercentage: 70,
  //     responseIdPrefix: "",
  //     allowEditing: false,
  //     enableStageReEditing: false,
  //     triggerEmailNotifications: false,
  //     autoShareResponses: false,
  //     autoShareWith: null,
  //     folderId: null,
  //     stages: [],
  //     requiresApproval: false,
  //     logics: [
  //       {
  //         logic_type: "is",
  //         logic_value: "",
  //         order: 1,
  //         follow_up: {
  //           title: "",
  //           deadline: 0,
  //           assign_to: "form_submitter",
  //           task_close_questions: [],
  //         },
  //         logic_questions: [],
  //         notification: {
  //           enabled: false,
  //           users: [],
  //           groups: [],
  //           emails: "",
  //         },
  //       },
  //     ],
  //   }
  // })


  const getEmptyFormData = (): FormData => ({
    title: "",
    type: "standard",
    captureGPS: false,
    allowSharing: true,
    passPercentage: 70,
    responseIdPrefix: "",
    allowEditing: false,
    enableStageReEditing: false,
    triggerEmailNotifications: false,
    autoShareResponses: false,
    autoShareWith: null,
    autoShareUsers: [],
    autoShareGroups: [],
    autoShareLocations: [],
    folderId: null,
    folderName: null,
    stages: [],
    requiresApproval: false,
    logics: [
      {
        logic_type: "is",
        logic_value: "",
        order: 1,
        follow_up: {
          title: "",
          deadline: 0,
          assign_to: "form_submitter",
          task_close_questions: [],
        },
        logic_questions: [],
        notification: {
          enabled: false,
          users: [],
          groups: [],
          emails: "",
        },
      },
    ],
  });


  const [initialFormData, setInitialFormData] = useState<FormData>(formData); // after loading defaults



  useEffect(() => {
    if (isFormTypeSelected || isEditing) {
      const fetchUsers = async () => {
        try {
          const response = await axiosInstance.get("/users/list");
          setUsers(response.data);
        } catch (error) {
          console.error("Error while fetching users:", error);
        }

      };

      const fetchGroups = async () => {
        try {
          const response = await axiosInstance.get("/groups/");
          setGroups(response.data);
        } catch (error) {
          console.error("Error fetching groups:", error);
        }
      };

      fetchUsers();
      fetchGroups();
      fetchFolders();
      // fetchQuestionTypes();
      fetchLocations();
      fetchAutoShareLocationLeaders();
      fetchDivisions();
    }
  }, [isFormTypeSelected, isEditing, organizationId]);

  // Utility function to walk all questions and sub-questions, collecting error info
  function validateQuestions(stages: Stage[]) {
    const errors: Record<string, boolean> = {};

    function checkQuestion(q: Question) {
      if (!q.title || !q.title.trim()) {
        errors[q.id] = true;
      }

      // Check options for required question types
      if (['multiple_choice', 'checkboxes', 'dropdown', 'linear_scale'].includes(q.type)) {
        if (!q.options || q.options.length === 0 || q.options.some(o => !o || o.trim() === '')) {
          errors[q.id + '_options'] = true;
        }
      }
      // Check options for audit questions (option text + numeric score required)
      if (q.type === "audit") {
        const auditOptions = q.auditOptions ?? [];
        const hasMissingOptionText = auditOptions.length === 0 || auditOptions.some(opt => !opt?.option || !opt.option.trim());
        const hasInvalidScore = auditOptions.length === 0 || auditOptions.some(opt => opt?.score === null || opt?.score === undefined || Number.isNaN(Number(opt.score)));
        if (hasMissingOptionText || hasInvalidScore) {
          errors[q.id + "_options"] = true;
        }
      }

      // Check normal sub-questions
      if (q.subQuestions && Array.isArray(q.subQuestions)) {
        q.subQuestions.forEach(checkQuestion);
      }
      // Check sub-questions in conditional logics
      if (q.conditionalLogics && Array.isArray(q.conditionalLogics)) {
        q.conditionalLogics.forEach(logic => {
          if (logic.subQuestions && Array.isArray(logic.subQuestions)) {
            logic.subQuestions.forEach(checkQuestion);
          }
        });
      }
      if (q.tableSubQuestions && Array.isArray(q.tableSubQuestions)) {
        q.tableSubQuestions.forEach(checkQuestion);
      }
    }

    stages.forEach(stage => {
      stage.questions.forEach(checkQuestion);
    });

    return errors;
  }

  function findParentQuestionIdOfConditionalSubQ(
    stages: Stage[],
    subQId: string
  ): string | null {
    for (const stage of stages) {
      for (const question of stage.questions) {
        if (question.conditionalLogics && Array.isArray(question.conditionalLogics)) {
          for (const logic of question.conditionalLogics) {
            if (logic.subQuestions && Array.isArray(logic.subQuestions)) {
              if (logic.subQuestions.some(subQ => subQ.id === subQId)) {
                return question.id;
              }
            }
          }
        }
      }
    }
    return null;
  }

  // Validate the form data before saving
  const validateFormData = () => {


    // ✅ Step 0: Validate the main form title
    if (!formData.title || !formData.title.trim()) {
      Swal.fire({
        icon: "error",
        title: "Form title is required.",
        text: "Please enter a title for the form before proceeding.",
        timer: 2500,
        showConfirmButton: false,
      }).then(() => {
        setTimeout(() => {
          const el = document.getElementById("title");
          if (el) {
            el.scrollIntoView({
              behavior: "smooth", // ✅ smooth scroll animation
              block: "center",
            });
            if (typeof (el as any).focus === "function") {
              setTimeout(() => el.focus(), 500); // focus after scroll finishes
            }
          }
        }, 300);
      });

      return false;
    }

    // 1. Validate all questions and sub-questions (including conditional logic).
    const errors = validateQuestions(formData.stages);
    setValidationErrors(errors);

    // Helper: robust scroll + focus with retries to handle async stage switch/render
    const focusAndScrollWithRetry = (
      elementId: string,
      attempts: number[] = [50, 160, 300, 500, 800, 1200]
    ) => {
      const tryOnce = (idx: number) => {
        setTimeout(() => {
          const el = document.getElementById(elementId) as HTMLElement | null;
          if (el) {
            const rect = el.getBoundingClientRect();
            const targetY = rect.top + window.pageYOffset - Math.max(0, (window.innerHeight / 2) - (rect.height / 2));
            // Smooth, stable window scroll with re-application after layout settles
            window.scrollTo({ top: targetY, behavior: "smooth" });
            setTimeout(() => window.scrollTo({ top: targetY, behavior: "smooth" }), 200);
            setTimeout(() => window.scrollTo({ top: targetY, behavior: "smooth" }), 600);
            // Focus without scrolling
            try {
              (el as any).focus?.({ preventScroll: true });
            } catch {
              (el as any).focus?.();
            }
            return;
          }
          if (idx + 1 < attempts.length) tryOnce(idx + 1);
        }, attempts[idx]);
      };
      tryOnce(0);
    };

    // 2. Check for options errors first
    const hasOptionsErrors = Object.keys(errors).some(key => key.endsWith('_options'));
    if (hasOptionsErrors) {
      const optionsErrorIds = Object.keys(errors).filter(key => key.endsWith('_options'));
      const firstOptionsErrorId = optionsErrorIds[0];
      const questionId = firstOptionsErrorId.replace('_options', '');

      formData.stages.forEach(stage => {
        if (stage.questions.some(q => q.id === questionId)) {
          setActiveStage(stage.id);
        }
      });

      Swal.fire({
        icon: "error",
        title: "Please fill all options before proceeding.",
        timer: 2500,
        showConfirmButton: false,
      }).then(() => {
        focusAndScrollWithRetry(`question-title-input-${questionId}`);
      });
      return false;
    }

    // 3. If any other errors found:
    if (Object.keys(errors).length > 0) {
      // Find the first error id.
      const firstErrorId = Object.keys(errors)[0];

      // Find if this error is a conditional logic sub-question.
      let foundInConditional = null;
      let parentQuestionId: string | null = null;
      let targetStageId: string | null = null;

      formData.stages.forEach(stage => {
        stage.questions.forEach(q => {
          if (q.conditionalLogics && Array.isArray(q.conditionalLogics)) {
            q.conditionalLogics.forEach(logic => {
              if (logic.subQuestions && Array.isArray(logic.subQuestions)) {
                if (logic.subQuestions.find(subQ => subQ.id === firstErrorId)) {
                  foundInConditional = q.id;
                  parentQuestionId = q.id;
                  targetStageId = stage.id;
                }
              }
            });
          }
          // Also check top-level question, normal sub-questions and table sub-questions
          if (q.id === firstErrorId) {
            targetStageId = stage.id;
          }
          if (!targetStageId && q.subQuestions && Array.isArray(q.subQuestions)) {
            if (q.subQuestions.some(subQ => subQ.id === firstErrorId)) {
              targetStageId = stage.id;
            }
          }
          if (!targetStageId && q.tableSubQuestions && Array.isArray(q.tableSubQuestions)) {
            if (q.tableSubQuestions.some(subQ => subQ.id === firstErrorId)) {
              targetStageId = stage.id;
            }
          }
        });
      });

      if (foundInConditional) {
        // 3a. Instead of opening the modal, highlight the Add Conditional Logic button for this question.
        setConditionalLogicAttention(parentQuestionId);
        // Ensure we are on the correct stage before scrolling
        if (targetStageId) setActiveStage(targetStageId);

        // Defer navigation until after the alert closes

        Swal.fire({
          icon: "error",
          title: "sub question details missing",
          text: "Open conditional logic and fill the required sub-questions.",
          timer: 2500,
          showConfirmButton: false,
        }).then(() => {
          // Re-center again after modal closes (modal close can trigger layout/scroll changes)
          // Navigate to the parent (main) question's title input instead of the logic button
          focusAndScrollWithRetry(`question-title-input-${parentQuestionId}`);
        });
        return false; // Validation failed
      } else {
        // 3b. Not a conditional logic sub-question; focus the first error input as before.
        // Ensure we switch to the stage that contains the error so the element exists in DOM
        if (targetStageId) setActiveStage(targetStageId);
        // Defer navigation until after the alert closes
        Swal.fire({
          icon: "error",
          title: "Please fill all question titles before proceeding.",
          timer: 2500,
          showConfirmButton: false,
        }).then(() => {
          // Re-center after Swal closes to counter any scroll caused by modal teardown
          focusAndScrollWithRetry(`question-title-input-${firstErrorId}`);
        });
        return false; // Validation failed
      }
    }

    return true; // No validation errors
  };


  const handlePreviewClick = () => {
    console.log("Validating form data before preview...");
    if (validateFormData()) {
      // If no validation errors, open preview dialog.
      console.log("Form data is valid, opening preview dialog...");
      setPreviewDialogOpen(true);
    }
  };

  const handleSaveFormWithValidation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // stops browser default scrolling

    if (validateFormData()) {
      await handleSaveForm();
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await axiosInstance.get("/folders/organization/");
      setFolders(response.data); // adjust based on your API response structure
    } catch (error) {
      console.error("Error fetching folders:", error);
    }

  };

  const fetchLocations = async () => {
    try {
      const response = await axiosInstance.get("/location/");
      setLocations(response.data); // adjust based on your API response structure
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const fetchAutoShareLocationLeaders = async () => {
    try {
      const response = await axiosInstance.get("/location-leaders/list/");
      const currentOrganizationId = organizationId != null ? Number(organizationId) : null;
      const leaderOptions = (Array.isArray(response.data) ? response.data : [])
        .filter((leader: any) => {
          if (currentOrganizationId == null) return true;
          const leaderOrganizationId =
            typeof leader?.organization === "number"
              ? leader.organization
              : leader?.organization?.id;

          return leaderOrganizationId == null || Number(leaderOrganizationId) === currentOrganizationId;
        })
        .map((leader: any) => {
          const leaderId = leader?.id;
          const leaderUser = leader?.user ?? {};
          const fullName = `${leaderUser.first_name ?? ""} ${leaderUser.last_name ?? ""}`.trim();
          const email = leaderUser.email ? String(leaderUser.email).trim() : "";
          const locationName =
            leaderUser.location_details?.name ??
            leaderUser.location_details?.description ??
            leaderUser.location?.name ??
            leaderUser.location?.description ??
            (typeof leaderUser.location === "string" ? leaderUser.location : "");
          const primaryLabel = fullName || email || `Leader ${leaderId}`;
          const labelParts = [primaryLabel];

          if (locationName) labelParts.push(locationName);
          if (email && email !== primaryLabel) labelParts.push(email);

          return {
            id: String(leaderId),
            name: labelParts.join(" - "),
          };
        })
        .filter((leader: AutoShareLocationLeaderOption) => Boolean(leader.id));

      setAutoShareLocationLeaders(leaderOptions);
    } catch (error) {
      console.error("Error fetching location leaders for auto-share:", error);
    }
  };

  const fetchDivisions = async () => {
    try {
      const response = await axiosInstance.get("/division/");
      setDivisions(response.data); // adjust based on your API response structure
    } catch (error) {
      console.error("Error fetching divisions:", error);
    }
  };

  // const fetchQuestionTypes = async () => {
  //   try {
  //     const response = await axiosInstance.get("/form/question-types/");
  //     let temp = [...response.data, { value: "audit", label: "Audit" }]

  //     setQuestionTypesObj(temp);
  //     setQuestionTypes(temp?.map((type: any) => type?.value) || []);
  //   } catch (error) {
  //     console.error("Error fetching folders:", error);
  //   }
  // };
  useEffect(() => {
    if (
      conditionalLogicModalOpen &&
      conditionalLogicModalOpen.logicIndex !== undefined
    ) {
      // Delay until after render
      const timeout = setTimeout(() => {
        const el = document.getElementById(
          `logic-${conditionalLogicModalOpen.logicIndex}`
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50); // 50ms delay

      return () => clearTimeout(timeout);
    }
  }, [conditionalLogicModalOpen]);

  // 🔑 depends on folders too


  const fetchQuestionTypes = async () => {
    try {
      const response = await axiosInstance.get("/form/question-types/");
      let temp = [...response.data, { value: "audit", label: "Audit" }];

      setQuestionTypesObj(temp);
      setQuestionTypes(temp?.map((type: any) => type?.value) || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  };

  const fetchQuestionTypesLS = async () => {
    try {
      const response = await axiosInstance.get("/form/question-types/");

      setQuestionTypesObj(response.data);
      setQuestionTypes(response.data?.map((type: any) => type?.value) || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  };

  // useEffect to trigger the function
  useEffect(() => {
    if (isFormTypeSelected || isEditing) {
      if (formData.type === "audit") {
        fetchQuestionTypes();
      } else if (formData.type === "standard" || formData.type === "location") {
        fetchQuestionTypesLS();
      }
    }
  }, [formData.type, isFormTypeSelected, isEditing]);


  const CreateFolders = async () => {
    setIsCreating(true)
    try {
      const payload = {
        name: folderName,
        description: folderDescription,
      }
      const response = await axiosInstance.post("/folder/", payload)
      const createdFolder = response.data;
      hotToaster.success("Folder Created Successfully");

      await fetchFolders()
      // Set the newly created folder as selected
      // make sure your API returns the created folder object
      console.log("Created Folder:", createdFolder);
      const folderIdStr = String(createdFolder.id);
      handleFormDataChange("folderId", folderIdStr);
      setNewlyCreatedFolderId(folderIdStr);

      setShowFolderDialog(false);
      setFolderName("");
      setFolderDescription("");
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const apiMessage: string = error.response.data.error ?? "Something went wrong"

        // “Already exists” case
        if (apiMessage.toLowerCase().includes("exists")) {
          showWarningToast("Oops!\n" + apiMessage);
        } else {
          // Any other API‐reported error
          hotToaster.error("Error Creating Folder" + apiMessage);

        }
      } else {
        // Network or totally unexpected
        console.error("Error creating folders:", error)
        hotToaster.error(
          "Network Error\nCould not reach server. Please check your connection."
        );
      }
    } finally {
      setIsCreating(false)

    }
  }


  // Handle form type selection
  const handleTypeSelect = (type: FormType) => {

    if (type === "audit") {
      const newStage: Stage[] = [
        {
          id: `auditgrp${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          originalId: `auditgrp${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: "Audit Info",
          requiresApproval: false, // Default to not require approval
          questions: [
            {
              id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: "title_and_description",
              title: "Audit Guidelines",
              description: "",
              required: true,
              subQuestions: [],
            },
            {
              id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: "location",
              title: "Audited Location",
              required: true,
              subQuestions: [],
            }
          ],
        },
        {
          id: `auditgrp1${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          originalId: `auditgrp1${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: "Group 1",
          requiresApproval: false, // Default to not require approval
          questions: [
            {
              id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: "audit",
              title: "",
              description: "",
              required: true,
              subQuestions: [],
              maxFiles: 1
            },
          ],
        },
      ]
      setFormData((prev) => ({
        ...prev,
        stages: newStage,
        type,
      }))
      setActiveStage(newStage[0].id)
    }
    else if (type === "location") {
      const newStage: Stage[] = [
        {
          id: `locationgrp1`,
          originalId: `locationgrp1`,
          title: "Stage 1",
          requiresApproval: false, // Default to not require approval
          questions: [
            {
              id: `locationgrp-q2`,
              type: "location",
              title: "Location",
              required: true,
              subQuestions: [],
              restrictEdit: true, // Prevent editing of location
            },
            {
              id: `locationgrp-q1`,
              type: "short_answer",
              title: "",
              description: "",
              required: true,
              subQuestions: [],
            }
          ],
        },
      ]
      setFormData((prev) => ({
        ...prev,
        stages: newStage,
        type,
      }))
      setActiveStage(newStage[0].id)
    }
    else {
      setFormData((prev) => ({ ...prev, type }))
    }
    setStep("header")
  }

  const handlesetdialog = () => {
    setShowFolderDialog(true);
  }
  // Handle form data changes
  const handleFormDataChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (!isFormDirty) {
      setIsFormDirty(true);
    }
  };


  const assignStageIndexes = (stages: Stage[]): Stage[] =>
    stages.map((stage, idx) => ({ ...stage, index: idx }));

  const handleAddStage = (title?: string) => {
    if (!validateFormData()) return; // Prevent adding stage if validation fails

    const isFirstStage = formData.stages.length === 0;

    const newStageId = `stage${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newStage: Stage = {
      id: newStageId,
      originalId: newStageId,
      title: title || `Stage ${formData.stages.length + 1}`,
      requiresApproval: false, // Default new stages to not require approval
      questions: formData.type === "standard" ? [
        {
          id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: isFirstStage ? "short_answer" : "short_answer",
          title: title || "",
          description: "",
          required: false,
          subQuestions: [],
          // Initialize with an empty array
        }
      ] : formData.type === "audit" ? [
        {
          id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "audit",
          title: "",
          description: "",
          required: true,
          subQuestions: [],
          maxFiles: 1
        }
      ] : [
        {
          id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "short_answer",
          title: "",
          description: "",
          required: false,
          subQuestions: [], // Initialize with an empty array
        }
      ]
    };

    setFormData((prev) => {
      const updatedStages = [...prev.stages, newStage];
      return {
        ...prev,
        stages: assignStageIndexes(updatedStages),
      }
    });

    setActiveStage(newStage.id);

    setSelectedQuestionTypes((prev) => ({
      ...prev,
      [newStage.id]: "",
    }));
    // Show message
    setStageAddedMsg(true);

    // Hide message after 2 seconds
    setTimeout(() => setStageAddedMsg(false), 3000);
  };

  const handleDuplicateStage = (stageId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId);
    if (!stage) return;

    const duplicatedStageId = `stage${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newStage: Stage = {
      ...stage,
      id: duplicatedStageId,
      originalId: duplicatedStageId,
      title: `${stage.title} (Copy)`,
      questions: stage.questions.map((q) => ({
        ...q,
        id: `q${Math.random().toString(36).substring(2, 15)}`,
        subQuestions: q.subQuestions?.map((subQ) => ({
          ...subQ,
          id: `sub-q${Math.random().toString(36).substring(2, 15)}`,
        })) || [],
      })),
    };

    setFormData((prev) => {
      const updatedStages = [...prev.stages, newStage];
      return {
        ...prev,
        stages: assignStageIndexes(updatedStages),
      }
    });

    setActiveStage(newStage.id);
  };

  // Delete a stage
  const handleDeleteStage = (stageId: string) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.filter((stage) => stage.id !== stageId),
    }))

    if (formData.stages.length === 1) {
      setActiveStage(null)
      return
    }

    if (activeStage === stageId) {
      setActiveStage(formData.stages[0]?.id || null)
    }
  }

  // Update stage title
  const handleStageUpdate = (stageId: string, field: keyof Stage, value: any) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => (stage.id === stageId ? { ...stage, [field]: value } : stage)),
    }))
  }



  const handleAddNewQuestionGroup = (stageId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId)
    if (!stage) return

    const newGroupStageId = `stage${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newStage: Stage = {
      ...stage,
      id: newGroupStageId,
      originalId: newGroupStageId,
      title: `Group ${formData.stages.length}`,
      questions: [
        {
          title: "",
          type: "audit",
          id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          required: false,
          subQuestions: [],
          maxFiles: 1
        }
      ],
    }

    setFormData((prev) => ({
      ...prev,
      stages: [...prev.stages, newStage],
    }))

    setActiveStage(newStage.id)
  }


  // Add a question to a stage
  const handleAddQuestion = (stageId: string, type: QuestionType) => {
    if (!validateFormData()) return; // Prevent adding if validation fails

    const newQuestion: Question = {
      id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      title: "",
      required: false,
      subQuestions: [], // Initialize with an empty array
    };

    if (type === "multiple_choice" || type === "checkboxes" || type === "dropdown" || type === "linear_scale") {
      newQuestion.options = ["", ""] // Initialize with two empty strings to show 2 option fields by default
    }

    if (type === "linear_scale") {
      newQuestion.from = 1
      newQuestion.to = 5
    }

    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId ? { ...stage, questions: [...stage.questions, newQuestion] } : stage,
        // stage.id === stageId ? { ...stage, questions: [newQuestion] } : stage,
      ),
    }))
  }

  const handleAddSubQuestion = (stageId: string, parentQuestionId: string, type: QuestionType, title?: string) => {

    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? {
                  ...q,
                  subQuestions: [
                    ...(q.subQuestions || []),
                    {
                      id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      type,
                      title: title || "",
                      required: false,
                    },
                  ],
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };


  // Duplicate a sub question
  const handleDuplicateSubQuestion = (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? {
                  ...q,
                  subQuestions: q.subQuestions
                    ? [
                      ...q.subQuestions,
                      ...q.subQuestions
                        .filter((subQ) => subQ.id === subQuestionId)
                        .map((subQ) => ({
                          ...subQ,
                          id: `sub-q${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2, 8)}`,
                          title: `${subQ.title} (Copy)`,
                        })),
                    ]
                    : [],
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };


  const handleUpdateSubQuestion = (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string,
    field: keyof Question,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? {
                  ...q,
                  subQuestions: q.subQuestions?.map((subQ) =>
                    subQ.id === subQuestionId ? { ...subQ, [field]: value } : subQ
                  ),
                }
                : q
            ),
          }
          : stage
      ),
    }));

    // Live error clearing for sub-questions
    if (field === "title") {
      if (value && value.trim()) {
        clearValidationError(subQuestionId);
      }
    }
  };


  const handleDeleteSubQuestion = (stageId: string, parentQuestionId: string, subQuestionId: string) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? {
                  ...q,
                  subQuestions: q.subQuestions?.filter((subQ) => subQ.id !== subQuestionId),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const clearValidationError = (questionId: string) => {
    setValidationErrors((prev) => {
      if (!prev[questionId]) return prev;
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  // Update your handleQuestionUpdate like this:
  const handleQuestionUpdate = (stageId: string, questionId: string, field: keyof Question, value: any) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId ? { ...q, [field]: value } : q
            ),
          }
          : stage,
      ),
    }));

    // If the user is updating the title and it's now valid, clear the error
    if (field === "title") {
      if (value && value.trim()) {
        clearValidationError(questionId);
      }
    }
  };

  // Delete a question
  const handleDeleteQuestion = (stageId: string, questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId ? { ...stage, questions: stage.questions.filter((q) => q.id !== questionId) } : stage,
      ),
    }))
  }

  // Duplicate a question
  // const handleDuplicateQuestion = (stageId: string, questionId: string) => {
  //   const stage = formData.stages.find((s) => s.id === stageId)
  //   if (!stage) return

  //   const question = stage.questions.find((q) => q.id === questionId)
  //   if (!question) return

  //   const newQuestion: Question = {
  //     ...question,
  //     id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  //     title: `${question.title} (Copy)`,
  //     // Regenerate UUIDs for regular sub-questions
  //     subQuestions: question.subQuestions?.map((subQ) => ({
  //       ...subQ,
  //       id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  //     })) || [],
  //     // Regenerate UUIDs for conditional logic sub-questions
  //     conditionalLogics: question.conditionalLogics?.map((logic) => ({
  //       ...logic,
  //       subQuestions: logic.subQuestions?.map((subQ) => ({
  //         ...subQ,
  //         id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  //       })) || [],
  //     })) || [],
  //   }

  //   setFormData((prev) => ({
  //     ...prev,
  //     stages: prev.stages.map((s) => (s.id === stageId ? { ...s, questions: [...s.questions, newQuestion] } : s)),
  //   }))
  // }

  const handleDuplicateQuestion = (stageId: string, questionId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId)
    if (!stage) return

    const question = stage.questions.find((q) => q.id === questionId)
    if (!question) return

    // Extract the base title (remove any "(Copy)" or "(Copy n)" at the end)
    const baseTitle = question.title.replace(/\s*\(Copy(?: \d+)?\)$/i, "")

    // Count how many existing copies already exist
    const existingCopies = stage.questions.filter((q) =>
      q.title.match(new RegExp(`^${baseTitle}\\s*\\(Copy(?: \\d+)?\\)$`, "i"))
    ).length

    // Determine new title based on existing copies
    const newTitle =
      existingCopies === 0
        ? `${baseTitle} (Copy)`
        : `${baseTitle} (Copy ${existingCopies + 1})`

    const newQuestion: Question = {
      ...question,
      id: `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: newTitle,
      subQuestions:
        question.subQuestions?.map((subQ) => ({
          ...subQ,
          id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })) || [],
      conditionalLogics:
        question.conditionalLogics?.map((logic) => ({
          ...logic,
          subQuestions:
            logic.subQuestions?.map((subQ) => ({
              ...subQ,
              id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            })) || [],
        })) || [],
    }

    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((s) =>
        s.id === stageId
          ? { ...s, questions: [...s.questions, newQuestion] }
          : s
      ),
    }))
  }

  // Helper function to reset question fields when type changes
  const resetQuestionFieldsForType = (question: Question, newType: QuestionType): Partial<Question> => {
    const resetFields: Partial<Question> = {
      type: newType,
    }

    // Clear conditional logics when changing types (logic values reference options that may not exist in new type)
    resetFields.conditionalLogics = []

    // Reset options and type-specific fields based on new type
    if (newType === "short_answer") {
      // Short answer doesn't use options - clear them
      resetFields.options = undefined
    } else if (newType === "linear_scale") {
      // Linear scale uses options for labels (different structure) and has from/to
      // Clear old options and reset scale range
      resetFields.options = undefined
      resetFields.from = 1
      resetFields.to = 5
    } else if (newType === "dropdown" || newType === "checkboxes" || newType === "multiple_choice") {
      // Reset options to array with two empty strings for option-based question types
      // This ensures the UI always shows at least 2 empty option fields for the user to fill
      resetFields.options = ["", ""]
    } else {
      // For other types (division, location, time, upload_image, title_and_description, etc.)
      // Clear options as they don't use them
      resetFields.options = undefined
    }

    return resetFields
  }


  // Move question up
  const handleMoveQuestionUp = (stageId: string, questionId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId)
    if (!stage) return

    const questionIndex = stage.questions.findIndex((q) => q.id === questionId)
    if (questionIndex <= 0) return

    const newQuestions = [...stage.questions]
    const temp = newQuestions[questionIndex]
    newQuestions[questionIndex] = newQuestions[questionIndex - 1]
    newQuestions[questionIndex - 1] = temp

    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((s) => (s.id === stageId ? { ...s, questions: newQuestions } : s)),
    }))
  }

  // Move question down
  const handleMoveQuestionDown = (stageId: string, questionId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId)
    if (!stage) return

    const questionIndex = stage.questions.findIndex((q) => q.id === questionId)
    if (questionIndex >= stage.questions.length - 1) return

    const newQuestions = [...stage.questions]
    const temp = newQuestions[questionIndex]
    newQuestions[questionIndex] = newQuestions[questionIndex + 1]
    newQuestions[questionIndex + 1] = temp

    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((s) => (s.id === stageId ? { ...s, questions: newQuestions } : s)),
    }))
  }

  const handleMoveSubQuestionUp = (stageId: string, questionId: string, subQuestionId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId)
    if (!stage) return
    const question = stage.questions.find((q) => q.id === questionId)
    if (!question || !question.conditionalLogics) return
    for (const logic of question.conditionalLogics) {
      const subQuestions = logic.subQuestions || []
      const subQIndex = subQuestions.findIndex((subQ) => subQ.id === subQuestionId)
      if (subQIndex > 0) {
        const newSubQuestions = [...subQuestions]
        const temp = newSubQuestions[subQIndex]
        newSubQuestions[subQIndex] = newSubQuestions[subQIndex - 1]
        newSubQuestions[subQIndex - 1] = temp
        logic.subQuestions = newSubQuestions
        setFormData((prev) => ({
          ...prev,
          stages: prev.stages.map((s) => ({ ...s, questions: [...s.questions] })),
        }))
        break
      }
    }
  }

  const handleMoveSubQuestionDown = (stageId: string, questionId: string, subQuestionId: string) => {
    const stage = formData.stages.find((s) => s.id === stageId)
    if (!stage) return
    const question = stage.questions.find((q) => q.id === questionId)
    if (!question || !question.conditionalLogics) return
    for (const logic of question.conditionalLogics) {
      const subQuestions = logic.subQuestions || []
      const subQIndex = subQuestions.findIndex((subQ) => subQ.id === subQuestionId)
      if (subQIndex >= 0 && subQIndex < subQuestions.length - 1) {
        const newSubQuestions = [...subQuestions]
        const temp = newSubQuestions[subQIndex]
        newSubQuestions[subQIndex] = newSubQuestions[subQIndex + 1]
        newSubQuestions[subQIndex + 1] = temp
        logic.subQuestions = newSubQuestions
        setFormData((prev) => ({
          ...prev,
          stages: prev.stages.map((s) => ({ ...s, questions: [...s.questions] })),
        }))
        break
      }
    }
  }

  const addOptionToParentQuestion = (stageId: string, questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  options: [
                    ...(q.options || []),
                    `Option ${(q.options?.length || 0) + 1}`,
                  ],
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const addOptionToSubQuestion = (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? {
                  ...q,
                  subQuestions: q.subQuestions?.map((subQ) =>
                    subQ.id === subQuestionId
                      ? {
                        ...subQ,
                        options: [
                          ...(subQ.options || []),
                          `Option ${(subQ.options?.length || 0) + 1}`,
                        ],
                      }
                      : subQ
                  ),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };


  const handleUpdateOption = (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string | null,
    optionIndex: number,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? subQuestionId
                  ? {
                    ...q,
                    subQuestions: q.subQuestions?.map((subQ) =>
                      subQ.id === subQuestionId
                        ? {
                          ...subQ,
                          options: subQ.options?.map((opt, idx) =>
                            idx === optionIndex ? value : opt
                          ),
                        }
                        : subQ
                    ),
                  }
                  : {
                    ...q,
                    options: q.options?.map((opt, idx) =>
                      idx === optionIndex ? value : opt
                    ),
                  }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const handleReorderOptions = (stageId: string, questionId: string, fromIndex: number, toIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) => {
              if (q.id === questionId && q.options) {
                const newOptions = [...q.options];
                const [movedOption] = newOptions.splice(fromIndex, 1);
                newOptions.splice(toIndex, 0, movedOption);
                return { ...q, options: newOptions };
              }
              return q;
            }),
          }
          : stage
      ),
    }));
  };

  const handleReorderAuditOptions = (stageId: string, questionId: string, fromIndex: number, toIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) => {
              if (q.id === questionId && q.auditOptions) {
                const newOptions = [...q.auditOptions];
                const [movedOption] = newOptions.splice(fromIndex, 1);
                newOptions.splice(toIndex, 0, movedOption);
                return { ...q, auditOptions: newOptions };
              }
              return q;
            }),
          }
          : stage
      ),
    }));
  };

  const deleteOptionFromParentQuestion = (
    stageId: string,
    questionId: string,
    optionIndex: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  options: q.options?.filter((_, idx) => idx !== optionIndex),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };


  const deleteOptionFromSubQuestion = (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string,
    optionIndex: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === parentQuestionId
                ? {
                  ...q,
                  subQuestions: q.subQuestions?.map((subQ) =>
                    subQ.id === subQuestionId
                      ? {
                        ...subQ,
                        options: subQ.options?.filter(
                          (_, idx) => idx !== optionIndex
                        ),
                      }
                      : subQ
                  ),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };



  // Toggle conditional logic
  const handleToggleConditionalLogic = (stageId: string, questionId: string, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: enabled
                    ? [
                      {
                        enabled: true,
                        logic_type: "is",
                        comparision: "equals",
                        logic_value: "",
                        subQuestions: [],
                        // Default Notification object
                        notification: {
                          enabled: false,
                          users: [],
                          groups: [],
                          emails: "",
                        },
                        // Default FollowUp object
                        follow_up: {
                          enabled: false,
                          followup_toggle: false,
                          title: "",
                          description: "",
                          deadline: 0,
                          assign_to: "form_submitter",
                          assignFormUser: "",
                          assignFormSubmitter: false,
                          assignUsers: [],
                          assignGroups: [],
                          task_close_questions: [],
                        }
                      },
                    ]
                    : [],
                }
                : q,
            ),
          }
          : stage,
      ),
    }));
  };

  const handleAddConditionalLogic = (stageId: string, questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: [
                    ...(q.conditionalLogics || []),
                    {
                      enabled: true,
                      logic_type: "is",
                      comparision: "equals",
                      logic_value: "",
                      subQuestions: [],
                      // Default Notification object
                      notification: {
                        enabled: false,
                        users: [],
                        groups: [],
                        emails: "",
                      },
                      // Default FollowUp object
                      follow_up: {
                        enabled: false,
                        title: "",
                        description: "",
                        deadline: 0,
                        assign_to: "form_submitter",
                        assignFormUser: "",
                        assignFormSubmitter: false,
                        assignUsers: [],
                        assignGroups: [],
                        task_close_questions: [],
                      }
                    },
                  ],
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const handleRemoveConditionalLogic = (stageId: string, questionId: string, logicIdx: number) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: (q.conditionalLogics || []).filter((_, idx) => idx !== logicIdx),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const handleRemoveAllConditionalLogicsALL = (stageId: string, questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: [], // ❗ Clear the entire array
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const handleDuplicateConditionalLogic = (stageId: string, questionId: string, logicIdx: number) => {
    setFormData((prev) => {
      const question = prev.stages
        .find(s => s.id === stageId)
        ?.questions.find(q => q.id === questionId);
      
      if (!question || !question.conditionalLogics) return prev;

      const logicToDuplicate = question.conditionalLogics[logicIdx];
      
      // Deep clone the logic object
      const duplicatedLogic = JSON.parse(JSON.stringify(logicToDuplicate));
      
      return {
        ...prev,
        stages: prev.stages.map((stage) =>
          stage.id === stageId
            ? {
              ...stage,
              questions: stage.questions.map((q) =>
                q.id === questionId
                  ? {
                    ...q,
                    conditionalLogics: [
                      ...(q.conditionalLogics || []),
                      duplicatedLogic
                    ],
                  }
                  : q
              ),
            }
            : stage
        ),
      };
    });
  };


  const handleUpdateConditionalLogic = (
    stageId: string,
    questionId: string,
    logicIdx: number,
    field: string,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map((q) =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: (q.conditionalLogics || []).map((logic, idx) =>
                    idx === logicIdx
                      ? {
                        ...logic,
                        [field]: value,
                      }
                      : logic
                  ),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };


  const [selectedOption, setSelectedOption] = useState<string>("");
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [tempFormula, setTempFormula] = useState("");





  const transformFormDataToPayload = (formData: FormData) => {
    return {
      form_type: formData.type,
      title: formData.title,
      folder: formData.folderId || null,
      prefix: formData.responseIdPrefix,
      GPS: formData.captureGPS,
      share_response: formData.allowSharing,
      allow_editing: formData.allowEditing,
      can_edit_previous_state: formData.enableStageReEditing,
      ...getAutoSharePayloadFields(formData),
      trigger_email_notifications: formData.triggerEmailNotifications,
      form_admin: userinfo?.id || null, // Assuming a fixed value (replace with dynamic admin ID if needed)
      stages: formData.stages.map((stage, stageIndex) => {
        const stageUuid = resolveStageServerId(stage);
        return ({
          name: stage.title,
          order: stageIndex + 1,
          stage_uuid: stageUuid,
          stage_access:
            stageIndex === 0
              ? [
                {
                  access_type: "organization",
                  allow_user: null,
                  allow_group: null,
                  allow_stage: null,
                  allow_organization: null,
                  allow_role: null
                }
              ]
              : [
                ...(stage.users?.map((userId) => ({
                  access_type: "user",
                  allow_user: userId,
                  allow_group: null,
                  allow_stage: null,
                  allow_organization: null,
                  allow_role: null,
                  stage_approvals: stage.requiresApproval || false,  // ADD THIS
                })) ?? []),

                ...(stage.groups?.map((groupId) => ({
                  access_type: "group",
                  allow_user: null,
                  allow_group: groupId,
                  allow_stage: null,
                  allow_organization: null,
                  allow_role: null
                })) ?? []),

                ...(stage.whoShouldFill === "organization"
                  ? [
                    {
                      access_type: "organization",
                      allow_user: null,
                      allow_group: null,
                      allow_stage: null,
                      allow_organization: null,
                      allow_role: null,
                      stage_approvals: stage.requiresApproval || false,  // ADD THIS
                    }
                  ]
                  : []),

                ...(stage.whoShouldFill === "role"
                  ? [
                    {
                      access_type: "role",
                      allow_user: null,
                      allow_group: null,
                      allow_stage: null,
                      allow_organization: null,
                      allow_role: null
                    }
                  ]
                  : []),

                ...(stage.whoShouldFill === "previous_stage"
                  ? [
                    {
                      access_type: "previous_stage", // if "stage" means previous stage completers, still using org access
                      allow_user: null,
                      allow_group: null,
                      allow_stage: resolveAllowStageServerId(stage.allow_stage, formData.stages),
                      allow_organization: null,
                      allow_role: null
                    }
                  ]
                  : [])
              ],


          questions: stage.questions.map((question, questionIndex) => ({
            // ...question,
            question_uuid: question.id,
            question: question.title,
            question_type: question.type,
            question_sub_type: question.type === "multiple_choice" || question.type === "dropdown" || question.type === "checkboxes" || question.type === "short_answer" ? question.valueType : undefined,
            description: question.description || undefined,
            question_hint: question.type === "short_answer" || question.type === "qr_code" || question.type === "long_answer" ? question.hint : undefined,
            order: questionIndex + 1,
            requiresApproval: stage.requiresApproval || false,
            number_of_file_allowed: question.type === "upload_image" || question.type === "upload_file" ? question.maxFiles : undefined,
            require_live: question.type === "upload_image" || question.type === "upload_video" ? question.requiresLive : undefined,
            is_required: question.required,
            min_value: question.type === "linear_scale" ? question.from : undefined,
            max_value: question.type === "linear_scale" ? question.to : undefined,
            reference_images: question.referenceImages,
            reference_videos: question.referenceVideos,
            // value_type: question.valueType,
            logics: question.conditionalLogics
              ? question.conditionalLogics.map((logic, logicIndex) => { // Changed to explicit return
                return ({ // Explicit return statement
                  logic_type: logic.logic_type,
                  comparison: logic.comparision,
                  logic_value: logic.logic_value,
                  notification: logic.notification?.enabled ?? false,
                  followup_toggle: logic.follow_up?.enabled ?? false,
                  logic_questions: logic.subQuestions?.map((subQuestion, subQuestionIndex) => ({
                    question_uuid: subQuestion.id,
                    question: subQuestion.title,
                    question_type: subQuestion.type,
                    require_live: subQuestion.type === "upload_image" || subQuestion.type === "upload_video" ? subQuestion.requiresLive : undefined,
                    number_of_file_allowed:
                      subQuestion.type === "upload_image" || subQuestion.type === "upload_file"
                        ? subQuestion.maxFiles
                        : undefined,
                    question_sub_type:
                      subQuestion.type === "multiple_choice" || subQuestion.type === "checkboxes" || question.type
                        === "short_answer"
                        ? subQuestion.valueType
                        : undefined,
                    description: subQuestion.description ?? undefined,
                    question_hint:
                      subQuestion.type === "short_answer" || subQuestion.type === "long_answer"
                        ? "Question Hint"
                        : undefined,
                    order: subQuestionIndex + 1,
                    is_required: subQuestion.required,
                    is_other:
                      subQuestion.type === "multiple_choice" || subQuestion.type === "checkboxes"
                        ? false
                        : undefined,
                    options: subQuestion.options?.map((subOption, subOptionIndex) => ({
                      option: subOption,
                      order: subOptionIndex + 1,
                    })),
                  })),
                  // ✅ Follow-up logic: send object if enabled, undefined if not
                  follow_up: logic.follow_up?.enabled
                    ? {
                      followup_toggle: logic.follow_up?.followup_toggle ?? true,
                      title: logic.follow_up?.title || "",
                      description: logic.follow_up?.description || "",
                      deadline: logic.follow_up?.deadline || 0,
                      assign_to: logic.follow_up?.assign_to || "",
                      assign_form: logic.follow_up?.assign_form || null,
                      assignFormSubmitter: logic.follow_up?.assignFormSubmitter ?? false,
                      assignUsers: logic.follow_up?.assignUsers ?? [],
                      assignGroups: logic.follow_up?.assignGroups ?? [],
                      task_close_questions: (logic.follow_up?.task_close_questions ?? [])
                        .filter((tcq: any) => tcq.question && tcq.question.trim() !== "")
                        .map((tcq: any) => ({
                        question_uuid: `close-${tcq.question_type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`,
                        question_type: tcq.question_type,
                        question: tcq.question,
                        question_hint: tcq.hint || "",
                        description: tcq.description || "",
                        valueType: tcq.valueType || tcq.question_sub_type || "text",
                        require_live: tcq.requiresLive ?? tcq.require_live ?? false,
                        number_of_file_allowed: tcq.maxFiles ?? tcq.number_of_file_allowed ?? 1,
                        is_required: tcq.is_required || false,
                        min_value: tcq.question_type === "linear_scale"
                          ? (typeof tcq.from === "number" ? tcq.from : tcq.min_value)
                          : undefined,
                        max_value: tcq.question_type === "linear_scale"
                          ? (typeof tcq.to === "number" ? tcq.to : tcq.max_value)
                          : undefined,
                        options: tcq.question_type === "linear_scale"
                          ? (Array.isArray(tcq.options) && tcq.options.length > 0
                              ? tcq.options
                              : (typeof tcq.from === "number" && typeof tcq.to === "number" && tcq.to >= tcq.from
                                  ? Array.from({ length: tcq.to - tcq.from + 1 }, (_, i) => String(tcq.from + i))
                                  : undefined))
                              ?.map((opt: any, optIndex: number) => {
                                const value =
                                  typeof opt === "string"
                                    ? opt
                                    : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                                return {
                                  option: value,
                                  order: optIndex + 1,
                                };
                              })
                          : ["multiple_choice", "dropdown", "checkboxes"].includes(tcq.question_type)
                            ? tcq.options?.map((opt: any, optIndex: number) => {
                                const value =
                                  typeof opt === "string"
                                    ? opt
                                    : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                                return {
                                  option: value,
                                  order: optIndex + 1,
                                };
                              })
                            : undefined,
                        order: tcq.order || 1,
                      })),

                    }
                    : {
                      followup_toggle: false,
                      title: "",
                      description: "",
                      deadline: 0,
                      assign_to: "",
                      assignUsers: [],
                      assignGroups: [],
                      task_close_questions: [],
                    },
                });
              })
              : [],
            sub_questions: question.subQuestions?.map((subQ, subQIndex) => ({
              question_uuid: subQ.id,
              question: subQ.title,
              question_type: subQ.type,
              description: subQ.description ?? undefined,
              question_hint: subQ.hint ?? undefined,
              is_required: subQ.required,
              order: subQIndex + 1,
              options: subQ.options?.map((opt, i) => ({
                option: opt,
                order: i + 1,
              })),
            })),
            formula: question.formula,
            is_other: question.type === "multiple_choice" || question.type === "checkboxes" ? false : undefined,
            options: ["multiple_choice", "dropdown", "checkboxes"].includes(question.type)
              ? question.options?.map((option, optionIndex) => ({
                option,
                order: optionIndex + 1,
              }))
              : undefined,
          })),
        });
      }),
      // Check if any stage requires approval, fallback to form-level requiresApproval
      requires_approval: formData.stages.some((stage) => stage.requiresApproval) || formData.requiresApproval
    };
  };



  // const transformFormDataToPayload_Audit = (formData: FormData) => {
  //   return {
  //     form_type: formData.type,
  //     title: formData.title,
  //     folder: formData.folderId || 13,
  //     prefix: formData.responseIdPrefix,
  //     GPS: formData.captureGPS,
  //     share_response: formData.autoShareResponses,
  //     allow_editing: formData.allowEditing,
  //     can_edit_previous_state: formData.enableStageReEditing,
  //     auto_share_response: formData.autoShareResponses,
  //     pass_percentage: formData.passPercentage || null,
  //     max_score: 100, // Assuming a fixed value
  //     form_admin: 25, // Assuming a fixed value (replace with dynamic admin ID if needed)
  //     audit_info: formData.stages.map((stage, stageIndex) => ({
  //       name: stage.title,
  //       order: stageIndex + 1,
  //       stage_access: {
  //         access_type: "organization", // Replace with dynamic value if needed
  //         allow_group: null,
  //         allow_stage: null,
  //         allow_user: null,
  //       },
  //       questions: stage.questions.map((question, questionIndex) => ({
  //         ...question,
  //         question_uuid: question.id,
  //         question: question.title,
  //         question_type: question.type,
  //         question_sub_type: question.type === "multiple_choice" || question.type === "dropdown" || question.type === "checkboxes" || question.type === "short_answer" ? question.valueType : undefined,
  //         description: question.description || undefined,
  //         question_hint: question.type === "short_answer" || question.type === "qr_code" || question.type === "long_answer" ? question.hint : undefined,
  //         order: questionIndex + 1,
  //         number_of_file_allowed: question.type === "upload_image" || question.type === "upload_file" ? question.maxFiles : undefined,
  //         require_live: question.type === "upload_image" || question.type === "upload_video" ? question.requiresLive : undefined,
  //         is_required: question.required,
  //         min_value: question.type === "linear_scale" ? question.from : undefined,
  //         max_value: question.type === "linear_scale" ? question.to : undefined,
  //         // value_type: question.valueType,
  //         logics: question.conditionalLogics
  //           ? question.conditionalLogics.map((logic, logicIndex) => ({
  //             ...logic,
  //             logic_questions: logic.subQuestions?.map((subQuestion, subQuestionIndex) => ({
  //               question_uuid: subQuestion.id,
  //               question: subQuestion.title,
  //               question_type: subQuestion.type,
  //               question_sub_type:
  //                 subQuestion.type === "multiple_choice" || subQuestion.type === "checkboxes" || question.type === "short_answer"
  //                   ? subQuestion.valueType
  //                   : undefined,
  //               description: subQuestion.description ?? undefined,
  //               question_hint:
  //                 subQuestion.type === "short_answer" || subQuestion.type === "long_answer"
  //                   ? "Question Hint"
  //                   : undefined,
  //               order: subQuestionIndex + 1,
  //               is_required: subQuestion.required,
  //               is_other:
  //                 subQuestion.type === "multiple_choice" || subQuestion.type === "checkboxes"
  //                   ? false
  //                   : undefined,
  //               options: subQuestion.options?.map((subOption, subOptionIndex) => ({
  //                 option: subOption,
  //                 order: subOptionIndex + 1,
  //               })),
  //             })),
  //             subQuestions: undefined
  //           }))
  //           : [],
  //         formula: question.formula,
  //         is_other: question.type === "multiple_choice" || question.type === "checkboxes" ? false : undefined,
  //         options: question.options?.map((option, optionIndex) => ({
  //           option: option,
  //           order: optionIndex + 1,
  //         })),

  //       })),
  //     })),
  //     requires_approval: formData.requiresApproval
  //   };
  // };


  const transformFormDataToPayload_Audit = (formData: FormData) => {

    const auditInfoStage = formData.stages[0]; // Always use the first stage as audit_info
    const stripNumbering = (value: string) => value.replace(/^\d+\.(?:\d+\.?)*\s*/, "").trim()
    const auditGroupStages = formData.stages.slice(1).map((stage, groupIndex) => ({
      ...stage,
      title: `${groupIndex + 1}. ${stripNumbering(stage.title) || stage.title}`,
      questions: stage.questions.map((question, questionIndex) => ({
        ...question,
        title: `${groupIndex + 1}.${questionIndex + 1} ${stripNumbering(question.title) || question.title}`,
      })),
    }));

    const totalMaxScore = formData.stages.reduce(
      (acc, stage) =>
        acc +
        stage.questions.reduce(
          (acc1, question) => {
            // For audit questions, calculate max score from options (max of option scores)
            if (question.type === "audit" && question.auditOptions?.length) {
              return acc1 + Math.max(...question.auditOptions.map(o => Number(o.score) || 0), 0);
            }
            return acc1 + (typeof question.maxScore === "number" ? question.maxScore : 0);
          },
          0
        ),
      0
    );

    const transformQuestion = (question: Question, questionIndex: number, stage: any) => {
      const payload: any = {
        question_uuid: question.id,
        question: question.title,
        question_type: question.type,
        question_sub_type:
          ["multiple_choice", "dropdown", "checkboxes", "short_answer"].includes(question.type)
            ? question.valueType
            : undefined,
        description: question.description || undefined,
        question_hint:
          ["short_answer", "qr_code", "long_answer"].includes(question.type)
            ? question.hint
            : undefined,
        order: questionIndex + 1,
        requiresApproval: stage.requiresApproval || false,
        number_of_file_allowed: ["upload_image", "upload_file"].includes(question.type)
          ? question.maxFiles
          : undefined,
        require_live: ["upload_image", "upload_video", "audit"].includes(question.type)
          ? question.requiresLive
          : undefined,
        is_required: question.required,
        critical: question.critical ?? false,
        min_value: question.type === "linear_scale" ? question.from : undefined,
        max_value: question.type === "linear_scale" ? question.to : undefined,
        reference_images: question.referenceImages,
        reference_videos: question.referenceVideos,
        logics: question.conditionalLogics?.map((logic, logicIndex) => ({
          logic_type: logic.logic_type,
          comparison: logic.comparision,
          logic_value: logic.logic_value,
          notification: logic.notification?.enabled ?? false,
          logic_questions: logic.subQuestions?.map((sq, sqIndex) => ({
            question_uuid: sq.id,
            question: sq.title,
            question_type: sq.type,
            require_live: ["upload_image", "upload_video"].includes(sq.type) ? sq.requiresLive : undefined,
            number_of_file_allowed:
              ["upload_image", "upload_file"].includes(sq.type)
                ? sq.maxFiles
                : undefined,
            question_sub_type:
              ["multiple_choice", "checkboxes", "short_answer"].includes(sq.type)
                ? sq.valueType
                : undefined,
            description: sq.description || undefined,
            question_hint:
              ["short_answer", "long_answer"].includes(sq.type) ? sq.hint : undefined,
            order: sqIndex + 1,
            is_required: sq.required,
            is_other: ["multiple_choice", "checkboxes"].includes(sq.type) ? false : undefined,
            options: sq.options?.map((o, oIndex) => ({
              option: o,
              order: oIndex + 1,
            })),
          })),
          follow_up: logic.follow_up?.enabled
            ? {
              followup_toggle: logic.follow_up?.followup_toggle ?? true,
              title: logic.follow_up?.title || "",
              description: logic.follow_up?.description || "",
              deadline: logic.follow_up?.deadline || 0,
              assign_to: logic.follow_up?.assign_to || "",
              assign_form: logic.follow_up?.assign_form || null,
              assignFormSubmitter: logic.follow_up?.assignFormSubmitter ?? false,
              assignUsers: logic.follow_up?.assignUsers ?? [],
              assignGroups: logic.follow_up?.assignGroups ?? [],
              task_close_questions: (logic.follow_up?.task_close_questions ?? [])
                .filter((tcq: any) => tcq.question && tcq.question.trim() !== "")
                .map((tcq: any) => ({
                question_uuid: `close-${tcq.question_type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`,
                question_type: tcq.question_type,
                question: tcq.question,
                question_hint: tcq.hint || "",
                description: tcq.description || "",
                valueType: tcq.valueType || tcq.question_sub_type || "text",
                requiresLive: tcq.requiresLive ?? tcq.require_live ?? false,
                maxFiles: tcq.maxFiles ?? tcq.number_of_file_allowed ?? 1,
                is_required: tcq.is_required || false,
                min_value: typeof tcq.from === "number" ? tcq.from : tcq.min_value,
                max_value: typeof tcq.to === "number" ? tcq.to : tcq.max_value,
                options: tcq.question_type === "linear_scale"
                  ? (Array.isArray(tcq.options) && tcq.options.length > 0
                      ? tcq.options
                      : (typeof tcq.from === "number" && typeof tcq.to === "number" && tcq.to >= tcq.from
                          ? Array.from({ length: tcq.to - tcq.from + 1 }, (_, i) => String(tcq.from + i))
                          : undefined))
                      ?.map((opt: any, optIndex: number) => {
                        const value =
                          typeof opt === "string"
                            ? opt
                            : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                        return {
                          option: value,
                          order: optIndex + 1,
                        };
                      })
                  : ["multiple_choice", "dropdown", "checkboxes"].includes(tcq.question_type)
                    ? tcq.options?.map((opt: any, optIndex: number) => {
                        const value =
                          typeof opt === "string"
                            ? opt
                            : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                        return {
                          option: value,
                          order: optIndex + 1,
                        };
                      })
                    : undefined,
                order: tcq.order || 1,
              })),


            }
            : {
              followup_toggle: false,
              title: logic.follow_up?.title || "",
              description: logic.follow_up?.description || "",
              deadline: logic.follow_up?.deadline || 0,
              assign_to: logic.follow_up?.assign_to || "",
              assignUsers: logic.follow_up?.assignUsers ?? [],
              assignGroups: logic.follow_up?.assignGroups ?? [],
              task_close_questions: (logic.follow_up?.task_close_questions ?? [])
                .filter((tcq: any) => tcq.question && tcq.question.trim() !== "")
                .map((tcq: any) => ({
                question_uuid: `close-${tcq.question_type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`,
                question_type: tcq.question_type,
                question: tcq.question,
                hint: tcq.hint || "",
                valueType: tcq.valueType || tcq.question_sub_type || "text",
                requiresLive: tcq.requiresLive ?? tcq.require_live ?? false,
                maxFiles: tcq.maxFiles ?? tcq.number_of_file_allowed ?? 1,
                is_required: tcq.is_required || false,
                min_value: typeof tcq.from === "number" ? tcq.from : tcq.min_value,
                max_value: typeof tcq.to === "number" ? tcq.to : tcq.max_value,
                options: tcq.question_type === "linear_scale"
                  ? (Array.isArray(tcq.options) && tcq.options.length > 0
                      ? tcq.options
                      : (typeof tcq.from === "number" && typeof tcq.to === "number" && tcq.to >= tcq.from
                          ? Array.from({ length: tcq.to - tcq.from + 1 }, (_, i) => String(tcq.from + i))
                          : undefined))
                      ?.map((opt: any, optIndex: number) => {
                        const value =
                          typeof opt === "string"
                            ? opt
                            : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                        return {
                          option: value,
                          order: optIndex + 1,
                        };
                      })
                  : ["multiple_choice", "dropdown", "checkboxes"].includes(tcq.question_type)
                    ? tcq.options?.map((opt: any, optIndex: number) => {
                        const value =
                          typeof opt === "string"
                            ? opt
                            : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                        return {
                          option: value,
                          order: optIndex + 1,
                        };
                      })
                    : undefined,
                order: tcq.order || 1,
              })),


            },
        })) ?? [],
        sub_questions: question.subQuestions?.map((subQ, subQIndex) => ({
          question_uuid: subQ.id,
          question: subQ.title,
          question_type: subQ.type,
          description: subQ.description ?? undefined,
          question_hint: subQ.hint ?? undefined,
          is_required: subQ.required,
          order: subQIndex + 1,
          options: subQ.options?.map((opt, i) => ({
            option: opt,
            order: i + 1,
          })),
        })),
        formula: question.formula,
        is_other: ["multiple_choice", "checkboxes"].includes(question.type) ? false : undefined,
        options: question.options?.map((option, optionIndex) => ({
          option: option,
          order: optionIndex + 1,
        })),
      };

      // Special audit handling
      if (question.type === "audit") {
        // max_score = max achievable score by selecting one option (not sum of all option scores)
        const auditOpts = question.auditOptions || [];
        payload.max_score = auditOpts.length > 0
          ? Math.max(...auditOpts.map(o => Number(o.score) || 0))
          : 0;
        payload.options = auditOpts.map((opt, idx) => ({
          option: opt.option,
          score: opt.score,
          order: idx + 1,
        }));
        payload.sub_questions = [
          {
            question_uuid: `${question.id}-observation`,
            question: `Observations #${questionIndex + 1} (${stage.title})`,
            question_type: "long_answer",
            order: 1,
            is_required: false,
          },
          {
            question_uuid: `${question.id}-photo`,
            question: `Photo #${questionIndex + 1} (${stage.title})`,
            question_type: "upload_image",
            order: 2,
            is_required: false,
            require_live: question.requiresLive || false,
            number_of_file_allowed: question.maxFiles || 1,
          },
        ];
      }

      return payload;
    };


    return {
      form_type: formData.type,
      title: formData.title,
      folder: formData.folderId || null,
      prefix: formData.responseIdPrefix,
      GPS: formData.captureGPS,
      share_response: formData.allowSharing,
      allow_editing: formData.allowEditing,
      can_edit_previous_state: formData.enableStageReEditing,
      ...getAutoSharePayloadFields(formData),
      pass_percentage: formData.passPercentage || null,
      trigger_email_notifications: formData.triggerEmailNotifications,
      max_score: totalMaxScore,
      form_admin: userinfo?.id || null,
      audit_info: auditInfoStage ? {
        name: auditInfoStage.title,
        questions: auditInfoStage.questions.map(transformQuestion),
        group_uuid: resolveStageServerId(auditInfoStage),
      } : null,
      audit_group: auditGroupStages.map((stage, idx) => ({
        group_uuid: resolveStageServerId(stage),
        name: stage.title,
        order: idx + 1,
        questions: stage.questions.map((question, questionIndex) => transformQuestion(question, questionIndex, stage)),
      })),
      requires_approval: formData.stages.some((stage) => stage.requiresApproval) || formData.requiresApproval,
    };
  };




  const transformFormDataToPayload_Location = (formData: FormData) => {
    return {
      form_type: formData.type,
      title: formData.title,
      folder: formData.folderId || null,
      prefix: formData.responseIdPrefix,
      GPS: formData.captureGPS,
      share_response: formData.allowSharing,
      allow_editing: formData.allowEditing,
      can_edit_previous_state: formData.enableStageReEditing,
      ...getAutoSharePayloadFields(formData),
      pass_percentage: formData.passPercentage || null,
      trigger_email_notifications: formData.triggerEmailNotifications,
      max_score: 100, // Assuming a fixed value
      form_admin: userinfo?.id || null, // Assuming a fixed value (replace with dynamic admin ID if needed)
      stages: formData.stages.map((stage, stageIndex) => {
        const stageUuid = resolveStageServerId(stage);
        return ({
          name: stage.title,
          order: stageIndex + 1,
          stage_uuid: stageUuid,
          stage_access:
            stageIndex === 0
              ? [
                {
                  access_type: "organization",
                  allow_user: null,
                  allow_group: null,
                  allow_stage: null,
                  allow_organization: null,
                  allow_role: null
                }
              ]
              : [
                ...(stage.users?.map((userId) => ({
                  access_type: "user",
                  allow_user: userId,
                  allow_group: null,
                  allow_stage: null,
                  allow_organization: null,
                  allow_role: null
                })) ?? []),

                ...(stage.groups?.map((groupId) => ({
                  access_type: "group",
                  allow_user: null,
                  allow_group: groupId,
                  allow_stage: null,
                  allow_organization: null,
                  allow_role: null
                })) ?? []),

                ...(stage.whoShouldFill === "organization"
                  ? [
                    {
                      access_type: "organization",
                      allow_user: null,
                      allow_group: null,
                      allow_stage: null,
                      allow_organization: null,
                      allow_role: null
                    }
                  ]
                  : []),

                ...(stage.whoShouldFill === "role"
                  ? [
                    {
                      access_type: "role",
                      allow_user: null,
                      allow_group: null,
                      allow_stage: null,
                      allow_organization: null,
                      allow_role: null
                    }
                  ]
                  : []),

                ...(stage.whoShouldFill === "previous_stage"
                  ? [
                    {
                      access_type: "previous_stage", // if "stage" means previous stage completers, still using org access
                      allow_user: null,
                      allow_group: null,
                      allow_stage: resolveAllowStageServerId(stage.allow_stage, formData.stages),
                      allow_organization: null,
                      allow_role: null
                    }
                  ]
                  : [])
              ],

          questions: stage.questions.map((question, questionIndex) => ({
            ...question,
            question_uuid: question.id,
            question: question.title,
            question_type: question.type,
            question_sub_type: question.type === "multiple_choice" || question.type === "dropdown" || question.type === "checkboxes" || question.type === "short_answer" ? question.valueType : undefined,
            description: question.description || undefined,
            question_hint: question.type === "short_answer" || question.type === "qr_code" || question.type === "long_answer" ? question.hint : undefined,
            order: questionIndex + 1,
            requiresApproval: stage.requiresApproval || false,
            number_of_file_allowed: question.type === "upload_image" || question.type === "upload_file" ? question.maxFiles : undefined,
            require_live: question.type === "upload_image" || question.type === "upload_video" ? question.requiresLive : undefined,
            is_required: question.required,
            min_value: question.type === "linear_scale" ? question.from : undefined,
            max_value: question.type === "linear_scale" ? question.to : undefined,
            reference_images: question.referenceImages,
            reference_videos: question.referenceVideos,
            // value_type: question.valueType,
            logics: question.conditionalLogics
              ? question.conditionalLogics.map((logic, logicIndex) => ({
                logic_type: logic.logic_type,
                comparison: logic.comparision,
                logic_value: logic.logic_value,
                notification: logic.notification?.enabled ?? false,
                logic_questions: logic.subQuestions?.map((subQuestion, subQuestionIndex) => ({
                  question_uuid: subQuestion.id,
                  question: subQuestion.title,
                  question_type: subQuestion.type,
                  require_live: subQuestion.type === "upload_image" || subQuestion.type === "upload_video" ? subQuestion.requiresLive : undefined,
                  number_of_file_allowed:
                    subQuestion.type === "upload_image" || subQuestion.type === "upload_file"
                      ? subQuestion.maxFiles
                      : undefined,
                  question_sub_type:
                    subQuestion.type === "multiple_choice" || subQuestion.type === "checkboxes" || question.type ===
                      "short_answer"
                      ? subQuestion.valueType
                      : undefined,
                  description: subQuestion.description ?? undefined,
                  question_hint:
                    subQuestion.type === "short_answer" || subQuestion.type === "long_answer"
                      ? "Question Hint"
                      : undefined,
                  order: subQuestionIndex + 1,
                  is_required: subQuestion.required,
                  is_other:
                    subQuestion.type === "multiple_choice" || subQuestion.type === "checkboxes"
                      ? false
                      : undefined,
                  options: subQuestion.options?.map((subOption, subOptionIndex) => ({
                    option: subOption,
                    order: subOptionIndex + 1,
                  })),
                })),
                follow_up: logic.follow_up?.enabled
                  ? {
                    followup_toggle: logic.follow_up?.followup_toggle ?? true,
                    title: logic.follow_up?.title || "",
                    description: logic.follow_up?.description || "",
                    deadline: logic.follow_up?.deadline || 0,
                    assign_to: logic.follow_up?.assign_to || "",
                    assign_form: logic.follow_up?.assign_form || null,
                    assignFormSubmitter: logic.follow_up?.assignFormSubmitter ?? false,
                    assignUsers: logic.follow_up?.assignUsers ?? [],
                    assignGroups: logic.follow_up?.assignGroups ?? [],
                    task_close_questions: (logic.follow_up?.task_close_questions ?? [])
                      .filter((tcq: any) => tcq.question && tcq.question.trim() !== "")
                      .map((tcq: any) => ({
                      question_uuid: `close-${tcq.question_type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`,
                      question_type: tcq.question_type,
                      question: tcq.question,
                      question_hint: tcq.hint || "",
                      description: tcq.description || "",
                      valueType: tcq.valueType || tcq.question_sub_type || "text",
                      requiresLive: tcq.requiresLive ?? tcq.require_live ?? false,
                      maxFiles: tcq.maxFiles ?? tcq.number_of_file_allowed ?? 1,
                      is_required: tcq.is_required || false,
                      min_value: typeof tcq.from === "number" ? tcq.from : tcq.min_value,
                      max_value: typeof tcq.to === "number" ? tcq.to : tcq.max_value,
                      options: tcq.question_type === "linear_scale"
                        ? (Array.isArray(tcq.options) && tcq.options.length > 0
                            ? tcq.options
                            : (typeof tcq.from === "number" && typeof tcq.to === "number" && tcq.to >= tcq.from
                                ? Array.from({ length: tcq.to - tcq.from + 1 }, (_, i) => String(tcq.from + i))
                                : undefined))
                            ?.map((opt: any, optIndex: number) => {
                              const value =
                                typeof opt === "string"
                                  ? opt
                                  : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                              return {
                                option: value,
                                order: optIndex + 1,
                              };
                            })
                        : ["multiple_choice", "dropdown", "checkboxes"].includes(tcq.question_type)
                          ? tcq.options?.map((opt: any, optIndex: number) => {
                              const value =
                                typeof opt === "string"
                                  ? opt
                                  : opt?.option ?? opt?.value ?? opt?.label ?? opt?.name ?? "";
                              return {
                                option: value,
                                order: optIndex + 1,
                              };
                            })
                          : undefined,
                      order: tcq.order || 1,
                    })),

                  }
                  : undefined,
              }))
              : [],
            sub_questions: question.subQuestions?.map((subQ, subQIndex) => ({
              question_uuid: subQ.id,
              question: subQ.title,
              question_type: subQ.type,
              description: subQ.description ?? undefined,
              question_hint: subQ.hint ?? undefined,
              is_required: subQ.required,
              order: subQIndex + 1,
              options: subQ.options?.map((opt, i) => ({
                option: opt,
                order: i + 1,
              })),
            })),
            formula: question.formula,
            is_other: question.type === "multiple_choice" || question.type === "checkboxes" ? false : undefined,
            options: ["multiple_choice", "dropdown", "checkboxes"].includes(question.type)
              ? question.options?.map((option, optionIndex) => ({
                option,
                order: optionIndex + 1,
              }))
              : undefined,
          })),
        });
      }),
      // Check if any stage requires approval, fallback to form-level requiresApproval
      requires_approval: formData.stages.some((stage) => stage.requiresApproval) || formData.requiresApproval
    };
  };



  // Save form
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<any | null>(null)
  const beginBackgroundSave = useFormStore((state: any) => state.beginBackgroundSave)
  const endBackgroundSave = useFormStore((state: any) => state.endBackgroundSave)
  const PAYLOAD_THRESHOLD_BYTES = 256 * 1024 // 0.25 MB

  const buildSavePayload = () => {
    let payload: any
    if (formData.type === "standard") {
      payload = transformFormDataToPayload(formData)
    } else if (formData.type === "location") {
      payload = transformFormDataToPayload_Location(formData)
    } else {
      payload = transformFormDataToPayload_Audit(formData)
    }
    return payload
  }

  const handleSaveForm = async () => {
    const payload = buildSavePayload()
    const estimatedSize = new TextEncoder().encode(JSON.stringify(payload)).length
    if (estimatedSize > PAYLOAD_THRESHOLD_BYTES) {
      setPendingPayload(payload)
      setShowBackgroundPrompt(true)
    } else {
      await executeSave('foreground', payload)
    }
  }

  const executeSave = async (mode: 'background' | 'foreground', preparedPayload?: any) => {

    setIsSaving(true);
    try {

      const payload = preparedPayload ?? buildSavePayload();
      const savePayload = isDuplicate
        ? { ...payload, title: getDuplicateTitle(payload.title) }
        : payload;



      const config = { timeout: 900000 };

      const savePromise =
        isFailed
          ? savePayload?.id
            ? axiosInstance.put(`/form/edit/${savePayload.id}/`, savePayload, config) // update failed form
            : axiosInstance.post("/form/", savePayload, config) // create new form from failed payload
          : isDuplicate
            ? axiosInstance.put(`/form/clone/${id}`, savePayload, config)
            : id
              ? axiosInstance.put(`/form/edit/${id}/`, savePayload, config)
              : axiosInstance.post("/form/", savePayload, config);



      if (mode === 'background') {
        if (id) beginBackgroundSave(String(id))
        const toastId = hotToaster.loading("Saving form in background...");
        window.dispatchEvent(new Event("route-loader-start"));
        const destination = formData.folderId ? `/forms/folders/${formData.folderId}` : "/forms";
        router.push(destination);
        savePromise
          .then((response) => {
            try {
              const minimal = {
                id: response?.data?.id ?? id,
                parentId: id ?? response?.data?.id, // original form (216)
                title: response?.data?.title ?? formData?.title ?? "",
              };
              sessionStorage.setItem('formData', JSON.stringify(minimal));
            } catch (_) { }
            const successMsg = (isDuplicate
              ? "Form duplicated successfully!"
              : id
                ? "Form updated successfully!"
                : "Form saved successfully!") + "\nPlease refresh the page to see the latest changes.";
            hotToaster.success(successMsg, { id: toastId, duration: 2000 });
          })
          .catch((error) => {
            const errorMessage = error?.response?.data?.detail || "Failed to save form.";
            hotToaster.error(errorMessage, { id: toastId, duration: 4000 });
          })
          .finally(() => { if (id) endBackgroundSave(String(id)); setTimeout(() => setIsSaving(false), 300); });
        return;
      }

      // Foreground: await and continue existing flow to Share screen
      const response = await savePromise;

      if (isFailed) {
        console.log("need to implement the status changing api call")
        const res = await axiosInstance.put(`form-payload-files/${id}/update-status/`, {
          form: response?.data?.id,
          status: "success",
        })
        console.log("upadted successfully ::", res.data)
      }

      if (response.status === 200 || response.status === 201) {
        Swal.fire({
          icon: "success",
          title: isDuplicate
            ? "Form Duplicated Successfully!"
            : id
              ? "Form Updated Successfully!"
              : "Form Saved Successfully!",
          timer: 2000,
          showConfirmButton: false,
        });
        try {
          const minimal = {
            id: response?.data?.id ?? id,
            title: response?.data?.title ?? formData?.title ?? "",
          };
          sessionStorage.setItem('formData', JSON.stringify(minimal));
        } catch (_) { }
        window.dispatchEvent(new Event("route-loader-start"));
        const redirectId = String(response?.data?.id ?? id ?? "");
        if (redirectId) {
          router.push(`/forms/share?id=${redirectId}`)
        } else {
          router.push("/forms/share")
        }
      } else {
        throw new Error("Unexpected response status");
      }
    } catch (error: any) {
      console.error("Error saving form:", error);
      console.error("Form save validation response:", error.response?.data);
      if (error.response?.data?.audit_group) {
        console.error("Audit group errors (first 3):", JSON.stringify(error.response.data.audit_group.slice(0, 3), null, 2));
      }
      if (error.response?.data?.audit_info) {
        console.error("Audit info errors:", JSON.stringify(error.response.data.audit_info, null, 2));
      }
      if (error.response?.data?.stages) {
        console.error("Stage errors (first 3):", JSON.stringify(error.response.data.stages.slice(0, 3), null, 2));
      }
      const rawErr = error.response?.data;
      let errorMessage = "Failed to save form. Please try again.";
      if (rawErr) {
        if (typeof rawErr === 'string') {
          errorMessage = rawErr;
        } else if (rawErr.detail) {
          errorMessage = rawErr.detail;
        } else if (rawErr.non_field_errors) {
          errorMessage = Array.isArray(rawErr.non_field_errors) ? rawErr.non_field_errors.join(', ') : String(rawErr.non_field_errors);
        } else if (rawErr.error) {
          errorMessage = typeof rawErr.error === 'string' ? rawErr.error : JSON.stringify(rawErr.error);
        } else {
          // Flatten DRF field-level errors
          const parts: string[] = [];
          for (const [field, msgs] of Object.entries(rawErr)) {
            const text = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
            parts.push(`${field}: ${text}`);
          }
          if (parts.length) errorMessage = parts.join('; ');
        }
      }
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const timeoutMessage = "Form saving is taking longer than expected and will continue in the background. You can safely return to the previous page.";
      Swal.fire({
        icon: isTimeout ? "info" : "error",
        title: isTimeout
          ? "Form Saving in Progress"
          : isDuplicate
            ? "Failed to Duplicate Form"
            : id
              ? "Failed to Update Form"
              : "Failed to Save Form",
        text: isTimeout ? timeoutMessage : errorMessage,
        timer: isTimeout ? undefined : 2000,
        showConfirmButton: isTimeout,
        allowOutsideClick: !isTimeout,
      }).then((result) => {
        if (isTimeout && result.isConfirmed) {
          router.push("/forms");
        }
      });
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };


  // Discard form
  const handleDiscard = () => {
    setDiscardDialogOpen(true)
  }

  const handlediaDiscard = () => {
    setDiscardDialogOpen(true)
  }

  const confirmDiscard = () => {
    router.push("/forms")
  }

  // Get question type icon
  const getQuestionTypeIcon = (type: QuestionType): JSX.Element => {
    switch (type) {
      case "table":
        return <TableIcon className="h-4 w-4" />;
      case "title_and_description":
        return <FileText className="h-4 w-4" />;
      case "long_answer":
        return <FileText className="h-4 w-4" />;
      case "date":
        return <Calendar className="h-4 w-4" />;
      case "time":
        return <Clock className="h-4 w-4" />;
      case "datetime":
        return <Calendar className="h-4 w-4" />;
      case "signature":
        return <FileText className="h-4 w-4" />;
      case "formula":
        return <Calculator className="h-4 w-4" />;
      case "short_answer":
        return <Type className="h-4 w-4" />;
      case "text":
        return <Type className="h-4 w-4" />;
      case "multiple_choice":
        return <CheckSquare className="h-4 w-4" />;
      case "checkboxes":
        return <CheckSquare className="h-4 w-4" />;
      case "location":
        return <MapPin className="h-4 w-4" />;
      case "user":
        return <User className="h-4 w-4" />;
      case "upload_image":
        return <ImageIcon className="h-4 w-4" />;
      case "upload_video":
        return <VideoIcon className="h-4 w-4" />;
      case "linear_scale":
        return <Ruler className="h-4 w-4" />;
      case "upload_file":
        return <FileIcon className="h-4 w-4" />;
      case "qr_code":
        return <QrCode className="h-4 w-4" />;
      case "division":
        return <Layers className="h-4 w-4" />;
      case "sub_division":
        return <Layers className="h-4 w-4" />;
      case "dropdown":
        return <CircleChevronDown className="h-4 w-4" />;
      case "audit":
        return <CircleChevronDown className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Get question type label
  const getQuestionTypeLabel = (type: QuestionType) => {
    return questionTypesObj.find((q) => q.value === type)?.label || "Unknown Type"
  }


  const getComparisonText = (comparison: string | undefined): string => {
    switch (comparison) {
      case "greater_than":
        return "greater than";
      case "less_than":
        return "less than";
      case "greaterthan_or_equalto":
        return "greater than or equal to";
      case "lessthan_or_equalto":
        return "less than or equal to";
      case "blank":
        return "blank";
      case "between":
        return "between";
      default:
        return "";
    }
  };




  const isLogicMet = (logic: any, value: any): boolean => {
    if (!logic?.enabled) return true;

    const { logic_type, comparision = "equals", logic_value } = logic;

    const condition = logic_type; // "is" | "is_not"
    const comparison = comparision || "equals";
    const expected = logic_value ?? "";

    const parsedValue = parseFloat(String(value));
    const parsedExpected = parseFloat(expected);

    let comparisonResult = false;

    switch (comparison) {
      case "equals":
        comparisonResult = String(value) === String(expected);
        break;
      case "not_equals":
        comparisonResult = String(value) !== String(expected);
        break;
      case "contains":
        comparisonResult = String(value).includes(String(expected));
        break;
      case "not_contains":
        comparisonResult = !String(value).includes(String(expected));
        break;
      case "greater_than":
        comparisonResult = parsedValue > parsedExpected;
        break;
      case "less_than":
        comparisonResult = parsedValue < parsedExpected;
        break;
      case "greaterthan_or_equalto":
        comparisonResult = parsedValue >= parsedExpected;
        break;
      case "lessthan_or_equalto":
        comparisonResult = parsedValue <= parsedExpected;
        break;
      case "blank":
        comparisonResult = typeof value === "string" && value.trim() === "";
        break;
      case "between":
        const [min, max] = expected.split(",").map(Number);
        comparisonResult = parsedValue >= min && parsedValue <= max;
        break;
      default:
        comparisonResult = String(value) === String(expected);
        break;
    }

    const finalResult = condition === "is" ? comparisonResult : !comparisonResult;

    return finalResult;
  };


  const handleNotificationChange = (
    stageId: string,
    questionId: string,
    logicIdx: number,
    changes: Partial<Notification>
  ) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.map(stage =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map(q =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: (q.conditionalLogics || []).map((logic, idx) =>
                    idx === logicIdx
                      ? {
                        ...logic,
                        notification: {
                          ...logic.notification,
                          ...changes,
                        },
                      }
                      : logic
                  ),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };

  const handleFollowUpChange = (
    stageId: string,
    questionId: string,
    logicIdx: number,
    changes: Partial<FollowUp>
  ) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.map(stage =>
        stage.id === stageId
          ? {
            ...stage,
            questions: stage.questions.map(q =>
              q.id === questionId
                ? {
                  ...q,
                  conditionalLogics: (q.conditionalLogics || []).map((logic, idx) =>
                    idx === logicIdx
                      ? {
                        ...logic,
                        follow_up: {
                          ...logic.follow_up,
                          ...changes, assign_form: changes.assign_form !== undefined ? changes.assign_form :
                            logic.follow_up?.assign_form,
                        },
                      }
                      : logic
                  ),
                }
                : q
            ),
          }
          : stage
      ),
    }));
  };


  // Render form type selection
  if (step === "type") {
    return (
      <div className="space-y-6">
        <div>
          {/* <h1 className="text-2xl font-bold tracking-tight">Create New Form</h1> */}
          <p className="text-muted-foreground">Select the type of form you want to create</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card
            className="cursor-pointer border shadow-[0_4px_20px_rgba(0,0,0,0.4)] rounded-2xl hover:shadow-lg hover:border-primary transition-all duration-200"
            onClick={() => { handleTypeSelect("standard"), setIsFormTypeSelected(true) }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Standard Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a general-purpose form for collecting information, feedback, or data.
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border shadow-[0_4px_20px_rgba(0,0,0,0.4)] rounded-2xl hover:shadow-lg hover:border-primary transition-all duration-200"
            onClick={() => { handleTypeSelect("location"), setIsFormTypeSelected(true) }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Location-based Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a form that captures location data and is associated with specific locations.
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border shadow-[0_4px_20px_rgba(0,0,0,0.4)] rounded-2xl hover:shadow-lg hover:border-primary transition-all duration-200"
            onClick={() => { handleTypeSelect("audit"), setIsFormTypeSelected(true) }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Audit Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a form for conducting audits with pass/fail criteria and scoring.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }


  function sumTableSubQValues(questions: Question[], ref: string) {
    for (const q of questions) {
      if (q.type === "table" && q.subQuestions) {
        const subQ = resolveFormulaQuestionRef(ref, q.subQuestions);
        if (subQ && Array.isArray(q.tablePreviewAnswers) && q.tablePreviewAnswers.length > 0) {
          // Sum all numeric values for this subQ across all items/rows
          return q.tablePreviewAnswers.reduce((sum: number, row: any) => {
            const val = row[subQ.id];
            const num = typeof val === "number" ? val : parseFloat(String(val));
            return sum + (!isNaN(num) ? num : 0);
          }, 0);
        }
      }
    }
    return null;
  }

  const FormulaPreview: React.FC<{ formula?: string, questions: Question[] }> = ({ formula, questions }) => {
    const result = useMemo(() => {
      if (!formula) return "";
      let expr = replaceFormulaQuestionRefs(formula, questions, (question) => {
        if (question.previewAnswer !== undefined && question.previewAnswer !== "") {
          return String(question.previewAnswer);
        }

        const tableSubQSum = sumTableSubQValues(questions, String(question.id));
        if (tableSubQSum !== null && tableSubQSum !== undefined) {
          return String(tableSubQSum);
        }

        return "0";
      }, {
        preserveHash: false,
      });
      expr = expr.replace(/\[([A-Za-z0-9_]+)\]/g, "0");
      expr = expr.replace(/([A-Z]+)\(\s*\)/g, "$1(0)");
      try {
        return math.evaluate(expr);
      } catch {
        return "Invalid formula";
      }
    }, [
      formula,
      questions.map(q => q.previewAnswer).join(","),
      JSON.stringify(questions.filter(q => q.type === "table").map(q => q.tablePreviewAnswers))
    ]);
    return <Input disabled value={result} />;
  };

  function getReferencedTitles(questions: Question[]): Set<string> {
    const referenced = new Set<string>();
    questions.forEach(q => {
      if (q.type === "formula" && q.formula) {
        const matches = q.formula.match(/#(.+?)(?=[+\-*/,\)\s]|$)/g);
        if (matches) {
          matches.forEach((ref: any) => referenced.add(ref.replace("#", "")));
        }
      }
    });
    return referenced;
  }

  function flattenQuestionsForFormula(questions: Question[]): Question[] {
    const result: Question[] = [];
    questions.forEach(q => {
      result.push(q);
      // Only include subQuestions if this is a table
      if (q.type === "table" && q.subQuestions && q.subQuestions.length) {
        result.push(...q.subQuestions);
      }
    });
    return result;
  }


  // ss
  const handleToggleStageUser = (userId: any) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === activeStage
          ? {
            ...stage,
            users: stage.users?.includes(userId)
              ? stage.users.filter((id: any) => id !== userId)
              : [...(stage.users || []), userId],
          }
          : stage
      ),
    }));
  };

  const handleToggleStageGroup = (groupId: any) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === activeStage
          ? {
            ...stage,
            groups: stage.groups?.includes(groupId)
              ? stage.groups.filter((id: any) => id !== groupId)
              : [...(stage.groups || []), groupId],
          }
          : stage
      ),
    }));
  };


  // Render form header
  if (step === "header") {


    return (
      <>

        <BackConfirmDialog
          open={showBackConfirm}
          onConfirm={() => {
            setFormData(getEmptyFormData());
            setIsFormDirty(false);
            // router.push("/forms");
            setStep("type");
            setShowBackConfirm(false);
          }}
          onCancel={() => setShowBackConfirm(false)}
        />

        <div className="space-y-6 bg-neutral-100">
          <Card className="border-t-8 rounded-t-2xl border-gray-500  shadow-[0_0_8px_4px_rgba(0,0,0,0.2)]">            <CardHeader>
            <CardTitle>Form Details</CardTitle>
          </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <Label htmlFor="title">
                    Form Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData?.title ?? ""}
                    onChange={(e) => handleFormDataChange("title", e.target.value)}
                    placeholder="Enter form title"
                    className="mt-1"
                  />
                </div>

                {/* Response ID Prefix + Folder side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Response ID Prefix */}
                  <div>
                    <Label htmlFor="responseIdPrefix">Response ID Prefix</Label>
                    <Input
                      id="responseIdPrefix"
                      value={formData?.responseIdPrefix ?? ""}
                      onChange={(e) =>
                        handleFormDataChange("responseIdPrefix", e.target.value)
                      }
                      placeholder="e.g., SAFETY, AUDIT, etc."
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This prefix will be added to all response IDs for this form (e.g., SAFETY-001)
                    </p>
                  </div>

                  {/* Folder */}
                  <div>
                    <Label htmlFor="folder">Folder</Label>
                    <Select
                      value={
                        newlyCreatedFolderId
                          ? newlyCreatedFolderId
                          : isNoneSelected
                            ? "none"
                            : formData.folderId || ""
                      }
                      onValueChange={(value) => {
                        if (value === "__create__") {
                          handlesetdialog();
                          return;
                        }
                        if (value === "none") {
                          setIsNoneSelected(true);
                          handleFormDataChange("folderId", null);
                          setNewlyCreatedFolderId(null);
                        } else {
                          setIsNoneSelected(false);
                          handleFormDataChange("folderId", value);
                          setNewlyCreatedFolderId(null); // clear newly created ID if user selects another
                        }
                      }}
                    >
                      <SelectTrigger id="folder" className="mt-1">
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                      <SelectContent className="overflow-y-auto max-h-60">
                        <SelectItem value="__create__">+ Create New Folder</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={String(folder.id)}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  </div>
                </div>

                {/* Pass Percentage (only for audit) */}
                {formData.type === "audit" && (
                  <div>
                    <Label htmlFor="passPercentage">Pass Percentage</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="passPercentage"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.passPercentage ?? 0}
                        onChange={(e) =>
                          handleFormDataChange(
                            "passPercentage",
                            e.target.value === "" ? null : Number.parseInt(e.target.value)
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum percentage required to pass the audit
                    </p>
                  </div>
                )}
              </div>


              <Separator />

              <div className="bg-muted/30 border border-border rounded-xl p-6">
                <h3 className="text-lg font-medium mb-4">Form Settings</h3>
                <div className="border-b border-gray-200 my-4"></div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="captureGPS" className="cursor-pointer">
                        Capture GPS Location
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Record the GPS coordinates when the form is submitted
                      </p>
                    </div>
                    <Switch
                      id="captureGPS"
                      checked={formData.captureGPS}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("captureGPS", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowSharing" className="cursor-pointer">
                        Allow Sharing
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow users to share this form with others
                      </p>
                    </div>
                    <Switch
                      id="allowSharing"
                      checked={formData.allowSharing}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("allowSharing", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowEditing" className="cursor-pointer">
                        Allow Editing of Submitted Responses
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow users to edit their responses after submission
                      </p>
                    </div>
                    <Switch
                      id="allowEditing"
                      checked={formData.allowEditing}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("allowEditing", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableStageReEditing" className="cursor-pointer">
                        Enable Stage Re-editing
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow users to go back and edit previous stages
                      </p>
                    </div>
                    <Switch
                      id="enableStageReEditing"
                      checked={formData.enableStageReEditing}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("enableStageReEditing", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="triggerEmailNotifications" className="cursor-pointer">
                        Trigger Email Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Send email notifications when form is submitted
                      </p>
                    </div>
                    <Switch
                      id="triggerEmailNotifications"
                      checked={formData.triggerEmailNotifications}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("triggerEmailNotifications", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="requiresApproval" className="cursor-pointer">
                        Requires Approval
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Admin needs to approve the form to share
                      </p>
                    </div>
                    <Switch
                      id="requiresApproval"
                      checked={formData.requiresApproval}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("requiresApproval", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="autoShareResponses" className="cursor-pointer">
                        Auto-share Responses
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically share responses with specified users or groups
                      </p>
                    </div>
                    <Switch
                      id="autoShareResponses"
                      checked={formData.autoShareResponses}
                      onCheckedChange={(checked) =>
                        handleFormDataChange("autoShareResponses", checked)
                      }
                    />
                  </div>

                  {/* {formData.autoShareResponses && (
                    <div>
                      <Label htmlFor="autoShareWith">Auto-share With</Label>
                      <Select
                        value={formData.autoShareWith || ""}
                        onValueChange={(value) =>
                          handleFormDataChange("autoShareWith", value || null)
                        }
                      >
                        <SelectTrigger id="autoShareWith" className="mt-1">
                          <SelectValue placeholder="Select who to share with" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="group">Group</SelectItem>
                          <SelectItem value="location">Location Leader</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )} */}


                </div>
                {/* Render the detailed card only when toggle is enabled */}
                {formData.autoShareResponses && (
                  <li className="flex flex-col gap-3 border rounded-md p-3 bg-gray-50">
                    <h3 className="text-base font-semibold">Automatically share responses to:</h3>

                    {/* Users */}
                    <div className="flex justify-between items-center">
                      <span>Users</span>
                      <Button variant="outline" size="sm" onClick={() => setShowUserModal(true)}>
                        <SquarePen />
                        Edit
                      </Button>
                    </div>
                    {(formData.autoShareUsers ?? []).length > 0 ? (
                      <span className="text-sm text-gray-600">
                        {(formData.autoShareUsers ?? [])
                          .map((id) => {
                            const u = users.find((x) => x.id === Number(id));
                            return u ? `${u.first_name} ${u.last_name}`.trim() || u.username : id;
                          })
                          .join(" | ")}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}

                    {/* Groups */}
                    <div className="flex justify-between items-center">
                      <span>Groups</span>
                      <Button variant="outline" size="sm" onClick={() => setShowGroupModal(true)}>
                        <SquarePen />
                        Edit
                      </Button>
                    </div>
                    {(formData.autoShareGroups ?? []).length > 0 ? (
                      <span className="text-sm text-gray-600">
                        {(formData.autoShareGroups ?? [])
                          .map((id) => {
                            const g = groups.find((x) => x.id === Number(id));
                            return g?.name || id;
                          })
                          .join(" | ")}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}

                    {/* Location Leaders */}
                    <div className="flex justify-between items-center">
                      <span>Location Leaders</span>
                      <Button variant="outline" size="sm" onClick={() => setShowLocationModal(true)}>
                        <SquarePen />
                        Edit
                      </Button>
                    </div>
                    {(formData.autoShareLocations ?? []).length > 0 ? (
                      <ul className="text-sm text-gray-600">
                        {(formData.autoShareLocations ?? []).map((id) => {
                          const leader = autoShareLocationLeaders.find((x) => x.id === String(id))
                          return <li key={id}>{leader?.name || id}</li>
                        })}
                      </ul>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </li>
                )}
              </div>
              <div>
                <AutoShareModal
                  title="Users"
                  isOpen={showUserModal}
                  onClose={() => setShowUserModal(false)}
                  items={users.map((u) => ({
                    id: u.id.toString(),
                    name: `${u.first_name} ${u.last_name}`.trim() || u.username,
                  }))}
                  selected={formData.autoShareUsers ?? []}
                  onChange={(newSelected) => handleFormDataChange("autoShareUsers", newSelected)}
                />


                <AutoShareModal
                  title="Groups"
                  isOpen={showGroupModal}
                  onClose={() => setShowGroupModal(false)}
                  items={groups}
                  selected={formData.autoShareGroups ?? []}
                  onChange={(newSelected) => handleFormDataChange("autoShareGroups", newSelected)}
                />

                <AutoShareModal
                  title="Location Leaders"
                  isOpen={showLocationModal}
                  onClose={() => setShowLocationModal(false)}
                  items={autoShareLocationLeaders}
                  selected={formData.autoShareLocations ?? []}
                  onChange={(newSelected) => handleFormDataChange("autoShareLocations", newSelected)}
                />
              </div>



              {/* <Separator /> */}

              {/* <div className="space-y-4">
                <h3 className="text-lg font-medium">Form Link</h3>
                <div className="flex items-center gap-2">
                  <Input value="https://vipro.app/forms/123456" readOnly className="bg-muted" />
                  <Button variant="outline" size="icon">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link to allow users to access the form directly
                </p>
              </div> */}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

              {/* Questions editor */}
              <div className="md:col-span-4 space-y-4">
                {activeStage && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      className="text-white bg-teal-600 hover:bg-teal-700 transition shadow-lg"
                      onClick={() => setBulkImportModalOpen(true)}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Bulk Import
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-lg"
                      onClick={() => setBulkEditModalOpen(true)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                )}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="conditional-logic">
                    <AccordionTrigger
                      className="py-2 px-3 border border-gray-300 rounded-lg bg-gray-200 hover:bg-blue-200 hover:no-underline "
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>Manage {formData.type === "audit" ? "Group" : "Stage"}</span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="space-y-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{formData.type === "audit" ? "Groups" : "Stages"}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {formData.stages.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No {formData.type === "audit" ? "group" : "stage"} added yet</p>
                            ) : (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext
                                  items={formData.stages.map((s) => s.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {formData.stages.map((stage, index) => (
                                    <SortableStage
                                      key={stage.id || `stage-${index}`}
                                      stage={stage}
                                      index={index}
                                      activeStage={activeStage}
                                      setActiveStage={setActiveStage}
                                      handleDeleteStage={handleDeleteStage}
                                      formData={formData}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                            )}
                            <Button variant="outline" className="w-full mt-2 hover:bg-blue-200" onClick={() => handleAddStage(formData.type === "audit" ? `Group ${formData.stages.length}` : "")}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add {formData.type === "audit" ? "Group" : "Stage"}
                            </Button>
                          </CardContent>
                        </Card>

                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                {!activeStage ? (
                  <Card className="border-t-8 rounded-t-2xl border-blue-600 shadow-lg">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Stage Selected</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Select a stage from the sidebar or create a new one to start adding questions
                      </p>
                      <Button onClick={() => handleAddStage()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Stage
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card className="border-t-8 rounded-t-2xl border-blue-600 shadow-[0_-4px_8px_rgba(0,0,0,0.1),_4px_0_8px_rgba(0,0,0,0.2),_-4px_0_8px_rgba(0,0,0,0.2)]">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                          {isEditing && (
                            <div className="text-sm text-gray-600 mb-2">
                              {formData.type === "audit" ? "Group" : "Stage"} {formData.stages.find((s) => s.id === activeStage)?.index! + 1} of {formData.stages.length}
                            </div>)}
                          <CardTitle className="text-lg">
                            {formData?.title && (
                              <>
                                <span className="text-gray-500 text-xl">{formData.title}</span>
                                <br />
                                <div className="my-1 mt-2 pb-2"></div>
                              </>
                            )}
                            {formData.type === "audit" ? "Group" : "Stage"} Settings
                          </CardTitle>
                          <CardDescription>Configure the current {formData.type === "audit" ? "group" : "stage"}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            className={"hover:bg-blue-200  transition"}

                            onClick={() => handleDuplicateStage(activeStage)}
                          >
                            Duplicate
                          </Button>
                          <Button
                            variant="destructive"
                            className={"hover:bg-blue-200  transition"}
                            disabled={
                              formData.type === "audit" &&
                              activeStage === formData.stages[0]?.id
                            }
                            onClick={() => handleDeleteStage(activeStage)}
                          >
                            Delete
                          </Button>
                          {
                            formData.type == "audit" &&
                            <Button
                              variant="secondary"
                              onClick={() => handleAddNewQuestionGroup(activeStage)}
                            >
                              Add Question Group
                            </Button>
                          }
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="stageTitle">{formData.type === "audit" ? "Group" : "Stage"} Title</Label>
                            <Input
                              id="stageTitle"
                              value={formData.stages.find((s) => s.id === activeStage)?.title || ""}
                              onChange={(e) => handleStageUpdate(activeStage, "title", e.target.value)}
                              className="mt-1 border border-gray-300"
                            />
                          </div>
                        </div>

                        {
                          ["standard", "location"].includes(formData.type) &&
                          formData.stages.findIndex((s) => s.id === activeStage) > 0 && (
                            <StageAccessEditor
                              formType={formData.type}
                              currentStage={formData.stages.find((s) => s.id === activeStage)}
                              onStageUpdate={(field, value) => handleStageUpdate(activeStage, field, value)}
                              allUsers={users}
                              allGroups={groups}
                              toggleStageUser={handleToggleStageUser}
                              toggleStageGroup={handleToggleStageGroup}
                              userPopoverOpen={userPopoverOpen}
                              setUserPopoverOpen={setUserPopoverOpen}
                              groupPopoverOpen={groupPopoverOpen}
                              setGroupPopoverOpen={setGroupPopoverOpen}
                              previousStages={
                                (() => {
                                  const currentStage = formData.stages.find((s) => s.id === activeStage);
                                  if (!currentStage || typeof currentStage.index !== "number") return [];
                                  return formData.stages.filter(stage => (typeof stage.index === "number" ? stage.index : -1) < (currentStage.index ?? -1));
                                })()
                              }
                            />
                          )
                        }

                      </CardContent>

                      {
                        activeStage &&
                        formData.stages.find((s) => s.id === activeStage)?.questions.length === 0 &&
                        <div>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Add Question Type</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Select
                              value={selectedQuestionTypes[activeStage || ""] || ""}
                              onValueChange={(value) => {
                                setSelectedQuestionTypes((prev) => ({
                                  ...prev,
                                  [activeStage || '']: value as QuestionType,
                                }));
                                if (activeStage) {
                                  handleAddQuestion(activeStage, value as QuestionType)
                                }
                              }}
                              disabled={!activeStage}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a question type" />
                              </SelectTrigger>
                              <SelectContent>
                                {questionTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {getQuestionTypeLabel(type as QuestionType)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </CardContent>
                        </div>
                      }


                    </Card>

                    <div className="space-y-4 rounded-xl border border-gray-100 shadow-[0_0_15px_1px_rgba(0,0,0,0.4)]">
                      {formData.stages
                        .find((s) => s.id === activeStage)
                        ?.questions.map((question, index) => (
                          <Card key={question.id || `question-${index}`}>

                            <div className="space-y-4 rounded-xl border-b border-gray-300 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Question Type</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <Select

                                  value={question.type || ""}
                                  onValueChange={(value: QuestionType) => {
                                    // setSelectedQuestionTypes((prev) => ({
                                    //   ...prev,
                                    //   [activeStage || '']: value as QuestionType,
                                    // }));
                                    // if (activeStage) {
                                    //   handleAddQuestion(activeStage, value as QuestionType)
                                    // }
                                    setFormData((prev) => {
                                      const currentQuestion = prev.stages
                                        .find((s) => s.id === activeStage)
                                        ?.questions.find((q) => q.id === question.id)

                                      if (!currentQuestion) return prev

                                      // Reset fields based on new type
                                      const resetFields = resetQuestionFieldsForType(currentQuestion, value)

                                      return {
                                        ...prev,
                                        stages: prev.stages.map((stage) =>
                                          stage.id === activeStage
                                            ? {
                                              ...stage,
                                              questions: stage.questions.map((q) =>
                                                q.id === question.id
                                                  ? { ...q, ...resetFields }
                                                  : q
                                              ),
                                            }
                                            : stage,
                                        ),
                                      }
                                    })
                                  }}
                                  disabled={
                                    !activeStage ||
                                    question.restrictEdit
                                    // Removed the location restriction to allow Location type for first question
                                  }
                                >
                                  <SelectTrigger className="border border-gray-300 ">
                                    <SelectValue placeholder="Select a question type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {questionTypes.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {getQuestionTypeLabel(type as QuestionType)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </CardContent>
                            </div>

                            {
                              question.type && <>
                                <CardHeader className="pb-2 pt-0 flex flex-row items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {getQuestionTypeIcon(question.type)}
                                    <CardTitle className="text-base">{getQuestionTypeLabel(question.type)}</CardTitle>
                                    {question.required && (
                                      <Badge variant="outline" className="ml-2">
                                        Required
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleMoveQuestionUp(activeStage, question.id)}
                                      disabled={index === 0}
                                    >
                                      <MoveUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleMoveQuestionDown(activeStage, question.id)}
                                      disabled={
                                        index === formData.stages.find((s) => s.id === activeStage)?.questions.length! - 1
                                      }
                                    >
                                      <MoveDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDuplicateQuestion(activeStage, question.id)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={
                                        getReferencedTitles(
                                          formData.stages.find((s) => s.id === activeStage)?.questions || []
                                        ).has(question.title)
                                        // ||
                                        // (
                                        //   formData.type === "audit" &&
                                        //   activeStage === formData.stages[0]?.id &&
                                        //   (
                                        //     // Disable only the default title_and_description or location questions in first stage
                                        //     question.id === formData.stages[0]?.questions.find(
                                        //       q => q.type === "title_and_description"
                                        //     )?.id ||
                                        //     question.id === formData.stages[0]?.questions.find(
                                        //       q => q.type === "location"
                                        //     )?.id
                                        //   )
                                        // )
                                      }


                                      onClick={() => handleDeleteQuestion(activeStage, question.id)}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      // size="icon"
                                      className="text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition shadow-lg"
                                      onClick={() => handleAddQuestion(activeStage, question.type as QuestionType)}
                                    >
                                      Add Question
                                      {/* <Plus className="h-4 w-4" /> */}
                                    </Button>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4">

                                  <QuestionEditor
                                    validationError={validationErrors[question.id] || false}
                                    validationErrors={validationErrors}
                                    questions={flattenQuestionsForFormula(formData.stages.find((s) => s.id === activeStage)?.questions || [])}
                                    question={question}
                                    stageId={activeStage ?? ""}
                                    questionTypes={questionTypes}
                                    questionTypesObj={questionTypesObj}
                                    handleQuestionUpdate={handleQuestionUpdate}
                                    handleAddSubQuestion={handleAddSubQuestion}
                                    handleUpdateSubQuestion={handleUpdateSubQuestion}
                                    handleDeleteSubQuestion={handleDeleteSubQuestion}
                                    handleDuplicateSubQuestion={handleDuplicateSubQuestion}
                                    handleUpdateOption={handleUpdateOption}
                                    addOptionToParentQuestion={addOptionToParentQuestion}
                                    addOptionToSubQuestion={addOptionToSubQuestion}
                                    deleteOptionFromParentQuestion={deleteOptionFromParentQuestion}
                                    deleteOptionFromSubQuestion={deleteOptionFromSubQuestion}
                                    handleMoveQuestionUp={handleMoveQuestionUp}
                                    handleMoveQuestionDown={handleMoveQuestionDown}
                                    handleDuplicateQuestion={handleDuplicateQuestion}
                                    handleReorderOptions={handleReorderOptions}
                                    handleReorderAuditOptions={handleReorderAuditOptions}
                                    MoveUpIcon={MoveUp}
                                    MoveDownIcon={MoveDown}
                                    CopyIcon={Copy}
                                    getQuestionTypeIcon={getQuestionTypeIcon}
                                  />


                                  {/* <div className="space-y-4">
                                    {question.type !== "title_and_description" && question.type !== "audit" && (

                                      <div className="flex items-center justify-between">
                                        <Label htmlFor={`question-${question.id}-required`} className="cursor-pointer">
                                          Required
                                        </Label>
                                        <Switch
                                          id={`question-${question.id}-required`}
                                          checked={question.required}
                                          onCheckedChange={(checked) =>
                                            handleQuestionUpdate(activeStage, question.id, "required", checked)
                                          }
                                        />
                                      </div>
                                    )} */}
                                  <div className="space-y-4">
                                    {question.type !== "title_and_description" && (
                                      <>
                                        {/* Required Toggle */}
                                        <div className="flex items-center justify-between">
                                          <Label htmlFor={`question-${question.id}-required`} className="cursor-pointer">
                                            Required
                                          </Label>
                                          <Switch
                                            id={`question-${question.id}-required`}
                                            checked={question.required}
                                            onCheckedChange={(checked) =>
                                              handleQuestionUpdate(activeStage, question.id, "required", checked)
                                            }
                                          />
                                        </div>
                                        {question.type !== "location" && (
                                          <>
                                            {/* Enable Reference Image Toggle */}
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`reference-image-toggle-${question.id}`} className="cursor-pointer">
                                                Enable Reference Image
                                              </Label>
                                              <Switch
                                                id={`reference-image-toggle-${question.id}`}
                                                checked={question.referenceImageEnabled ?? false}
                                                onCheckedChange={(checked) =>
                                                  handleQuestionUpdate(activeStage, question.id, "referenceImageEnabled", checked)
                                                }
                                              />
                                            </div>



                                            {/* Reference Image Upload */}
                                            {question.referenceImageEnabled && (
                                              <div className="mt-2">
                                                <Label>Reference Image</Label>
                                                <div className="flex gap-2 mt-2 w-full">
                                                  {/* Gallery Upload */}
                                                  <label
                                                    htmlFor={`reference-image-upload-${question.id}`}
                                                    className="flex-1"
                                                  >
                                                    <div className="border-2 border-dotted border-black rounded-md py-6 px-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition w-full"
                                                    >
                                                      <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                                                      <p className="text-xs text-muted-foreground text-center">Gallery</p>
                                                      <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG</p>
                                                    </div>
                                                  </label>

                                                  {/* Camera Upload */}
                                                  <label
                                                    htmlFor={isMobileDevice ? `reference-camera-upload-${question.id}` : undefined}
                                                    className="flex-1"
                                                    onClick={(e) => {
                                                      if (!isMobileDevice) {
                                                        e.preventDefault();
                                                        openWebcamModal(question.id);
                                                      }
                                                    }}
                                                  >
                                                    <div className="border-2 border-dotted border-black rounded-md py-6 px-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition w-full"
                                                    >
                                                      <svg className="h-6 w-6 text-muted-foreground mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                      </svg>
                                                      <p className="text-xs text-muted-foreground text-center">Camera</p>
                                                      <p className="text-xs text-muted-foreground mt-0.5">Live Photo</p>
                                                    </div>
                                                  </label>
                                                </div>


                                                {/* Hidden file inputs */}
                                                <input
                                                  type="file"
                                                  id={`reference-image-upload-${question.id}`}
                                                  accept="image/*"
                                                  multiple
                                                  onChange={async (e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length > 0) {
                                                      const uploadedImageUrls = await Promise.all(
                                                        files.map(async (file) => {
                                                          const formData = new FormData();
                                                          formData.append("file", file);
                                                          formData.append("upload_preset", "vibro-gallery-upload");
                                                          formData.append("folder", "form_references");
                                                          const response = await axios.post(
                                                            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                                                            formData
                                                          );
                                                          return response.data.secure_url;
                                                        })
                                                      );
                                                      const existing = question.referenceImages || [];
                                                      handleQuestionUpdate(activeStage, question.id, "referenceImages", [...existing, ...uploadedImageUrls]);
                                                    }
                                                  }}
                                                  className="hidden"
                                                />

                                                <input
                                                  type="file"
                                                  id={`reference-camera-upload-${question.id}`}
                                                  accept="image/*"
                                                  capture="environment"
                                                  onChange={async (e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length > 0) {
                                                      const uploadedImageUrls = await Promise.all(
                                                        files.map(async (file) => {
                                                          const formData = new FormData();
                                                          formData.append("file", file);
                                                          formData.append("upload_preset", "vibro-gallery-upload");
                                                          formData.append("folder", "form_references");
                                                          const response = await axios.post(
                                                            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                                                            formData
                                                          );
                                                          return response.data.secure_url;
                                                        })
                                                      );
                                                      const existing = question.referenceImages || [];
                                                      handleQuestionUpdate(activeStage, question.id, "referenceImages", [...existing, ...uploadedImageUrls]);
                                                    }
                                                  }}
                                                  className="hidden"
                                                />

                                                <div className="mt-2 flex items-center gap-4">
                                                  {(question.referenceImages?.length ?? 0) > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-4">
                                                      {(question.referenceImages ?? []).map((img, index) => (
                                                        <div key={index} className="relative">
                                                          <img
                                                            src={
                                                              typeof img === "string"
                                                                ? img
                                                                : img instanceof File
                                                                  ? URL.createObjectURL(img)
                                                                  : ""
                                                            }
                                                            alt={`Preview ${index}`}
                                                            className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                                            onClick={() =>
                                                              setSelectedRefImageForView(
                                                                typeof img === "string"
                                                                  ? img
                                                                  : img instanceof File
                                                                    ? URL.createObjectURL(img)
                                                                    : ""
                                                              )
                                                            }
                                                          />

                                                          <button
                                                            type="button"
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-600"
                                                            onClick={() => {
                                                              const updated = [...(question.referenceImages || [])];
                                                              updated.splice(index, 1);
                                                              handleQuestionUpdate(activeStage, question.id, "referenceImages", updated);
                                                            }}
                                                          >
                                                            ×
                                                          </button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}


                                            {/* Enable Reference Video Toggle */}
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`reference-video-toggle-${question.id}`} className="cursor-pointer">
                                                Enable Reference Video
                                              </Label>
                                              <Switch
                                                id={`reference-video-toggle-${question.id}`}
                                                checked={question.referenceVideoEnabled ?? false}
                                                onCheckedChange={(checked) =>
                                                  handleQuestionUpdate(activeStage, question.id, "referenceVideoEnabled", checked)
                                                }
                                              />
                                            </div>

                                            {/* Reference Video Upload */}
                                            {question.referenceVideoEnabled && (
                                              <div className="mt-2">
                                                <Label htmlFor={`reference-video-upload-${question.id}`}>Reference Video</Label>
                                                <label htmlFor={`reference-video-upload-${question.id}`}>
                                                  <div className="border-2 border-dotted border-black rounded-md py-2 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition">
                                                    <VideoIcon className="h-8 w-8 text-muted-foreground mb-0" />
                                                    <p className="text-xs text-muted-foreground text-center">Tap to upload a video</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Only videos (MP4, WebM)</p>
                                                    <p className="text-xs text-destructive mt-1">Max file size: 10MB</p>
                                                  </div>
                                                </label>

                                                <input
                                                  type="file"
                                                  id={`reference-video-upload-${question.id}`}
                                                  accept="video/mp4,video/webm"
                                                  multiple
                                                  onChange={async (e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    const maxSizeMB = 10;
                                                    const maxSizeBytes = maxSizeMB * 1024 * 1024;

                                                    const validFiles = files.filter((file) => {
                                                      if (file.size <= maxSizeBytes) return true;
                                                      setVideoUploadError(`"${file.name}" is larger than 10MB. Please select a video within the allowed size.`);
                                                      return false;
                                                    });

                                                    if (validFiles.length > 0) {
                                                      const uploadedVideoUrls = await Promise.all(
                                                        validFiles.map(async (file) => {
                                                          const formData = new FormData();
                                                          formData.append("file", file);
                                                          formData.append("upload_preset", "vibro-gallery-upload");
                                                          formData.append("folder", "form_references"); // Optional: specify a folder
                                                          const response = await axios.post(
                                                            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
                                                            formData
                                                          );
                                                          return response.data.secure_url;
                                                        })
                                                      );
                                                      const existing = question.referenceVideos || [];
                                                      handleQuestionUpdate(activeStage, question.id, "referenceVideos", [...existing, ...uploadedVideoUrls]);
                                                      setVideoUploadError(null); // Clear error if valid file is uploaded
                                                    }
                                                  }}

                                                  className="hidden"
                                                />
                                                {videoUploadError && (
                                                  <p className="text-sm text-destructive mt-2">{videoUploadError}</p>
                                                )}

                                                <div className="mt-2 flex flex-wrap gap-4">
                                                  {(question.referenceVideos ?? []).map((video, index) => (
                                                    <div key={index} className="relative">
                                                      <video
                                                        src={typeof video === "string" ? video : URL.createObjectURL(video)}
                                                        className="w-32 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                                        onClick={() =>
                                                          setSelectedRefVideoForView(
                                                            typeof video === "string"
                                                              ? video
                                                              : URL.createObjectURL(video)
                                                          )
                                                        }
                                                      />
                                                      <button
                                                        type="button"
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-600"
                                                        onClick={() => {
                                                          const updated = [...(question.referenceVideos || [])];
                                                          updated.splice(index, 1);
                                                          handleQuestionUpdate(activeStage, question.id, "referenceVideos", updated);
                                                        }}
                                                      >
                                                        ×
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {selectedRefImageForView && (
                                              <div
                                                className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
                                                onClick={() => setSelectedRefImageForView(null)}
                                              >
                                                <div className="relative">
                                                  <img
                                                    src={selectedRefImageForView}
                                                    alt="Selected Preview"
                                                    className="max-w-[90vw] max-h-[90vh] rounded shadow-lg"
                                                  />
                                                  <button
                                                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg shadow hover:bg-red-600"
                                                    onClick={() => setSelectedRefImageForView(null)}
                                                  >
                                                    ×
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            {selectedRefVideoForView && (
                                              <Dialog open onOpenChange={() => setSelectedRefVideoForView(null)}>
                                                <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col items-center justify-center">
                                                  <DialogHeader>
                                                    <DialogTitle>Preview Video</DialogTitle>
                                                  </DialogHeader>
                                                  <video
                                                    src={selectedRefVideoForView}
                                                    controls
                                                    autoPlay
                                                    className="max-w-full max-h-[80vh] rounded-lg shadow-lg"
                                                  />
                                                </DialogContent>
                                              </Dialog>
                                            )}


                                          </>
                                        )}


                                      </>
                                    )}
                                  </div>



                                  {(
                                    question.type === "short_answer" ||
                                    question.type === "dropdown" ||
                                    question.type === "multiple_choice" ||
                                    question.type === "audit" ||
                                    question.type === "linear_scale"
                                  ) && (
                                      <>
                                        {question.conditionalLogics && question.conditionalLogics.length > 0 && (
                                          <div className="border p-4 rounded-lg bg-gray-50">
                                            <div className="flex flex-row items-center justify-between mb-2">
                                              <Label className="text-md" >Logic</Label>
                                              <Button
                                                className=" bg-gray-500 hover:bg-red-300 transition w-9"
                                                onClick={() => handleRemoveAllConditionalLogicsALL(activeStage, question.id)}

                                              >
                                                <Trash className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            {question.conditionalLogics?.map((logic, idx) => (
                                              <React.Fragment key={idx}>
                                                <div className="border mt-2 p-3 rounded-lg bg-white flex items-center justify-between cursor-pointer "
                                                  onClick={() => setConditionalLogicModalOpen({ questionId: question.id, logicIndex: idx })}                                                  >
                                                  <div className="flex items-center space-x-2 "
                                                  >

                                                    {/* <span className="bg-gray-200 px-2 py-1 rounded text-sm font-medium"> */}
                                                    <span className="bg-blue-600 px-2 py-1 rounded text-sm font-medium text-white">
                                                      Logic {idx + 1}
                                                    </span>
                                                    <span className="text-sm ">
                                                      If answer {" "}
                                                      <span className="font-semibold">
                                                        {logic.logic_type === "is" ? "is" : "is not"}{" "}
                                                        {getComparisonText(logic.comparision)}
                                                        {" "}
                                                        {logic.logic_value}
                                                      </span>{" "}
                                                      then  <span className="inline-flex  items-start gap-1 font-semibold">
                                                        <MessageSquareText className="w-4 h-4 relative top-[2px] text-red-600" />
                                                        <span className="text-red-600 underline">Ask Questions</span>                                                      </span>
                                                    </span>
                                                  </div>
                                                  <div>
                                                    <Button
                                                      className="text-gray-800 bg-white hover:bg-blue-300 transition w-9 mr-1"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDuplicateConditionalLogic(activeStage, question.id, idx)
                                                      }}
                                                    >
                                                      <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                      className="text-gray-800 bg-white hover:bg-red-300 transition w-9"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveConditionalLogic(activeStage, question.id, idx)
                                                      }}

                                                    >
                                                      <CircleX className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </React.Fragment>
                                            ))}
                                          </div>
                                        )}

                                        <div className="mt-2">
                                          <Button
                                            id={`conditional-logic-btn-${question.id}`}
                                            variant="secondary"
                                            style={{ backgroundColor: "teal", color: "white" }}
                                            onClick={() => {
                                              if (!validateFormData()) return;
                                              // If no logic yet, add one immediately
                                              if (!question.conditionalLogics || question.conditionalLogics.length === 0) {
                                                handleAddConditionalLogic(activeStage, question.id);
                                                // open modal at first logic (index 0)
                                                setConditionalLogicModalOpen({ questionId: question.id, logicIndex: 0 });
                                              } else {
                                                // open modal at first existing logic
                                                setConditionalLogicModalOpen({ questionId: question.id, logicIndex: 0 });
                                              }
                                            }}
                                          >
                                            Add Conditional Logic
                                          </Button>
                                          {conditionalLogicAttention === question.id && (
                                            <p className="mt-2 text-sm text-red-600">
                                              sub question details missing
                                            </p>
                                          )}
                                        </div>

                                      </>
                                    )}
                                </CardContent>
                              </>
                            }

                          </Card>
                        ))}

                      {formData.stages.find((s) => s.id === activeStage)?.questions.length === 0 && (
                        <Card>

                          <CardContent className="flex flex-col items-center justify-center py-8">
                            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Questions Added</h3>
                            <p className="text-sm text-muted-foreground text-center mb-4">
                              Select a question type from the sidebar to add questions to this stage
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {formData.stages.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="conditional-logic">
                  <AccordionTrigger
                    className="py-2 px-3 border border-gray-300 rounded-lg bg-gray-200 hover:bg-blue-200 hover:no-underline "
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Manage {formData.type === "audit" ? "Group" : "Stage"}</span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{formData.type === "audit" ? "Groups" : "Stages"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {formData.stages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No {formData.type === "audit" ? "group" : "stage"} added yet</p>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext
                                items={formData.stages.map((s) => s.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {formData.stages.map((stage, index) => (
                                  <SortableStage
                                    key={stage.id || `stage-${index}`}
                                    stage={stage}
                                    index={index}
                                    activeStage={activeStage}
                                    setActiveStage={setActiveStage}
                                    handleDeleteStage={handleDeleteStage}
                                    formData={formData}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          )}
                          <Button variant="outline" className="w-full mt-2 hover:bg-blue-200" onClick={() => handleAddStage(formData.type === "audit" ? `Group ${formData.stages.length}` : "")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add {formData.type === "audit" ? "Group" : "Stage"}
                          </Button>
                        </CardContent>
                      </Card>

                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {formData.stages.length > 0 && (
              <><div className="flex justify-center w-min-full">
                {stageAddedMsg && (
                  <p className="text-blue-600 "> {formData.type === "audit" ? "Group" : "Stage"} {formData.stages.length} added successfully!</p>
                )}</div>
                <div className="flex justify-center w-min-full">

                  <Button variant="outline" className="w-auto text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition" onClick={() => handleAddStage(formData.type === "audit" ? `Group ${formData.stages.length}` : "")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add {formData.type === "audit" ? "Group" : "Stage"}
                  </Button>
                </div></>
            )}



            <div className="flex justify-end">

              <div className="flex gap-2">
                <Button variant="outline" className="hover:bg-blue-200" onClick={() => handlePreviewClick()}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button variant="outline" onClick={handleDiscard}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveFormWithValidation}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Save className="mr-2 h-4 w-4 animate-spin" />
                      {isDuplicate
                        ? "Duplicating..."
                        : isEditing
                          ? "Updating..."
                          : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isDuplicate
                        ? "Duplicate Form"
                        : isEditing
                          ? "Update Form"
                          : "Save Form"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isSaving && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white px-6 py-4 rounded shadow-md flex items-center space-x-3">
                  <svg
                    className="w-5 h-5 animate-spin text-blue-500"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  <span>
                    {isDuplicate
                      ? "Duplicating form, please wait..."
                      : id
                        ? "Updating form, please wait..."
                        : "Saving form, please wait..."}
                  </span>
                </div>
              </div>
            )}

            {/* Webcam Capture Dialog */}
            <Dialog open={isWebcamModalOpen} onOpenChange={(open) => { if (!open) closeWebcamModal(); }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Capture Photo</DialogTitle>
                  <DialogDescription>Use your webcam to take a reference image.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  {webcamError ? (
                    <p className="text-sm text-destructive">{webcamError}</p>
                  ) : (
                    <div className="w-full overflow-hidden rounded-md border bg-black">
                      <video ref={videoRef} className="w-full h-auto" autoPlay playsInline muted />
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeWebcamModal}>
                    Cancel
                  </Button>
                  <Button onClick={handleCapturePhoto} disabled={!!webcamError || !webcamStream}>
                    Capture Photo
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>


            {/* Preview Dialog */}
            <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Form Preview</DialogTitle>
                  <DialogDescription>Preview how your form will appear to users</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{formData.title}</h2>
                    {formData.type === "location" && (
                      <Badge variant="outline" className="mb-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        Location-based
                      </Badge>
                    )}
                    {formData.type === "audit" && (
                      <Badge variant="outline" className="mb-2">
                        <ClipboardList className="h-3 w-3 mr-1" />
                        Audit Form
                      </Badge>
                    )}
                  </div>

                  <Tabs defaultValue={formData.stages[0]?.id || `stage-tab-0`}>
                    <TabsList className="mb-1">
                      {formData.stages.map((stage, index) => {
                        const tabValue = stage.id || `stage-tab-${index}`;
                        return (
                          <TabsTrigger key={tabValue} value={tabValue}>
                            {stage.title}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {formData.stages.map((stage, stageIndex) => {
                      const tabValue = stage.id || `stage-tab-${stageIndex}`;
                      return (
                        <TabsContent key={tabValue} value={tabValue} className="space-y-6" style={{
                          border: '2px solid lightgray',
                          padding: 15,
                          borderRadius: 10
                        }}>
                          {stage.questions.map((question, questionIndex) => (
                            <div key={question.id || `question-preview-${stageIndex}-${questionIndex}`} className="space-y-2">
                              {question.type === "title_and_description" ? (
                                <div className="space-y-3">
                                  <h3 className="text-xl font-semibold">{question.title}</h3>
                                  {question.description && <p className="text-muted-foreground">{question.description}</p>}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Label>
                                    {question.title}
                                    {question.required && <span className="text-destructive ml-1">*</span>}
                                  </Label>
                                  <hr />

                                  {question.type === "text" && <Input placeholder={question.description} />}
                                  {question.description && <p className="text-muted-foreground pt-1 pb-2 outline outline-1 outline-gray-300 rounded px-3">{question.description}</p>}

                                  {question.referenceImageEnabled && (
                                    <div className="pt-2">
                                      <Label className="mb-1 block">Reference Image</Label>

                                      {question.referenceImages && question.referenceImages.length > 0 ? (
                                        <div className="flex gap-2 flex-wrap">
                                          {/* Images */}
                                          {question.referenceImages.map((img, index) => (
                                            <div key={index} className="relative inline-block">
                                              <img
                                                src={
                                                  typeof img === "string"
                                                    ? img
                                                    : img instanceof File
                                                      ? URL.createObjectURL(img)
                                                      : ""
                                                }
                                                alt={`Reference ${index}`}
                                                className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:opacity-80"
                                                onClick={() =>
                                                  setPreviewMedia({
                                                    type: "image",
                                                    url:
                                                      typeof img === "string"
                                                        ? img
                                                        : img instanceof File
                                                          ? URL.createObjectURL(img)
                                                          : "",
                                                  })
                                                }
                                              />
                                            </div>
                                          ))}

                                        </div>
                                      ) : (
                                        <div className="border-2 border-dotted border-gray-300 rounded-md p-6 flex flex-col items-center justify-center text-center max-w-xs">
                                          <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                          <p className="text-sm text-muted-foreground">No image uploaded</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {question.referenceVideoEnabled && (
                                    <div className="pt-2">
                                      <Label className="mb-1 block">Reference Video</Label>

                                      {question.referenceVideos && question.referenceVideos.length > 0 ? (
                                        <div className="flex gap-2 flex-wrap">
                                          {/* Videos */}
                                          {question.referenceVideos.map((video, index) => (
                                            <div key={index} className="relative inline-block">
                                              <video
                                                src={
                                                  typeof video === "string"
                                                    ? video
                                                    : video instanceof File
                                                      ? URL.createObjectURL(video)
                                                      : ""
                                                }
                                                className="w-32 h-20 object-cover rounded-md border cursor-pointer hover:opacity-80"
                                                onClick={() =>
                                                  setPreviewMedia({
                                                    type: "video",
                                                    url:
                                                      typeof video === "string"
                                                        ? video
                                                        : video instanceof File
                                                          ? URL.createObjectURL(video)
                                                          : "",
                                                  })
                                                }
                                              />
                                            </div>
                                          ))}

                                        </div>
                                      ) : (
                                        <div className="border-2 border-dotted border-gray-300 rounded-md p-6 flex flex-col items-center justify-center text-center max-w-xs">
                                          <VideoIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                          <p className="text-sm text-muted-foreground">No video uploaded</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {previewMedia && (
                                    <Dialog open onOpenChange={() => setPreviewMedia(null)}>
                                      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col items-center justify-center">
                                        <DialogHeader>
                                          <DialogTitle>Preview</DialogTitle>
                                        </DialogHeader>

                                        {previewMedia.type === "image" ? (
                                          <img
                                            src={previewMedia.url}
                                            alt="Preview"
                                            className="max-w-full max-h-[80vh] rounded-lg shadow-lg"
                                          />
                                        ) : (
                                          <video
                                            src={previewMedia.url}
                                            controls
                                            autoPlay
                                            className="max-w-full max-h-[80vh] rounded-lg shadow-lg"
                                          />
                                        )}
                                      </DialogContent>
                                    </Dialog>
                                  )}






                                  {question.type === "audit" && (
                                    <div>
                                      <AuditPreview
                                        key={question.id}
                                        question={question}
                                        previewAnswer={question.previewAnswer}
                                        onChangePreviewAnswer={value =>
                                          handleQuestionUpdate(stage.id, question.id, "previewAnswer", value)
                                        }
                                        allQuestions={stage.questions}
                                      />
                                      {question.conditionalLogics?.map((logic, idx) =>
                                        isLogicMet(logic, question.previewAnswer) &&
                                        logic.subQuestions?.map((subQ) => (
                                          <div key={`subq-${subQ.id}`}>
                                            <ConditionalQuestion subQ={subQ} />
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}


                                  {question.type === "short_answer" && (
                                    <div>
                                      {/* <Input
                                      value={question.previewAnswer ?? ""}
                                      onChange={e => handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)}
                                    /> */}
                                      <Input
                                        type={question.valueType === "number" ? "number" : "text"}
                                        value={question.previewAnswer ?? ""}
                                        onChange={e => handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)}
                                      />

                                      {/* {question.conditionalLogics?.map((logic, idx) =>
                                      isLogicMet(logic, question.previewAnswer) &&
                                      logic.subQuestions?.map((subQ) => (
                                        <div key={subQ.id}>
                                          <ConditionalQuestion subQ={subQ} />
                                        </div>
                                      ))
                                    )} */}

                                      {question.conditionalLogics?.map((logic, idx) => {
                                        const logicMatch = isLogicMet(logic, question.previewAnswer);

                                        return logicMatch &&
                                          logic.subQuestions?.map((subQ) => {
                                            return (
                                              <div key={subQ.id}>
                                                <ConditionalQuestion subQ={subQ} />
                                              </div>
                                            );
                                          });
                                      })}
                                    </div>
                                  )}


                                  {question.type === "dropdown" && (
                                    <div>
                                      <Label className="text-white mb-1 block">{question.description}</Label>
                                      <Select
                                        value={question.previewAnswer?.toString() || ""}
                                        onValueChange={(value) => {
                                          handleQuestionUpdate(stage.id, question.id, "previewAnswer", value);
                                        }}
                                      >

                                        <SelectTrigger className="bg-white text-black">
                                          <SelectValue placeholder="Select an option" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(question.options || []).map((option, index) => (
                                            <SelectItem key={index} value={option.toString()}>
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>


                                      {question.conditionalLogics?.map((logic, idx) => {
                                        const logicMatch = isLogicMet(logic, question.previewAnswer);

                                        return logicMatch &&
                                          logic.subQuestions?.map((subQ) => {
                                            return (
                                              <div key={subQ.id}>
                                                <ConditionalQuestion subQ={subQ} />
                                              </div>
                                            );
                                          });
                                      })}
                                    </div>
                                  )}


                                  {question.type === "multiple_choice" && question.options && (
                                    <div className="space-y-2">
                                      {/* Track selected value */}
                                      <input
                                        type="hidden"
                                        value={selectedOption}
                                        onChange={() => { }}
                                      />
                                      {question.options?.map((option, index) => (
                                        <div key={index} className="flex items-center  space-x-2">
                                          <input
                                            type="radio"
                                            id={`option-${index}`}
                                            name={question.id}
                                            value={option}
                                            // onChange={(e) => setSelectedOption(e.target.value)}
                                            onChange={(e) => {
                                              handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value);
                                            }}
                                          />
                                          <Label htmlFor={`option-${index}`} className="text-lg">{option}</Label>
                                        </div>
                                      ))}

                                      {/* Show "Other" text input if selected */}
                                      {selectedOption?.toLowerCase() === "other" && (
                                        <div className="mt-2  ">
                                          <input
                                            type="text"
                                            placeholder="Other"
                                            className="border rounded mt-4 px-2 py-1 text-sm w-full"
                                          />
                                        </div>
                                      )}
                                      {question.conditionalLogics?.map((logic, idx) => {
                                        const logicMatch = isLogicMet(logic, question.previewAnswer);

                                        return logicMatch &&
                                          logic.subQuestions?.map((subQ) => {
                                            return (
                                              <div key={subQ.id}>
                                                <ConditionalQuestion subQ={subQ} />
                                              </div>
                                            );
                                          });
                                      })}
                                    </div>
                                  )}


                                  {question.type === "audit" && question.options && (
                                    <div className="space-y-2">
                                      {/* Track selected value */}
                                      <input
                                        type="hidden"
                                        value={selectedOption}
                                        onChange={() => { }}
                                      />
                                      {question.options.map((option, index) => (
                                        <div key={index} className="flex items-center  space-x-2">
                                          <input
                                            type="radio"
                                            id={`option-${index}`}
                                            name={question.id}
                                            value={option}
                                            onChange={(e) => {
                                              handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value);
                                            }}
                                          />
                                          <Label htmlFor={`option-${index}`} className="text-lg">{option}</Label>
                                        </div>
                                      ))}

                                      {/* Show "Other" text input if selected */}
                                      {selectedOption?.toLowerCase() === "other" && (
                                        <div className="mt-2  ">
                                          <input
                                            type="text"
                                            placeholder="Other"
                                            className="border rounded mt-4 px-2 py-1 text-sm w-full"
                                          />
                                        </div>
                                      )}
                                      {question.conditionalLogics?.map((logic, idx) =>
                                        isLogicMet(logic, question.previewAnswer) &&
                                        logic.subQuestions?.map((subQ) => (
                                          <div key={subQ.id}>
                                            <ConditionalQuestion subQ={subQ} />
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}


                                  {question.type === "linear_scale" && (
                                    <div className="w-full mt-4">
                                      {/* Left and Right Labels */}
                                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                                        <span>{question.leftLabel || ""}</span>
                                        <span>{question.rightLabel || ""}</span>
                                      </div>

                                      {/* Radio Scale with line */}
                                      <div className="relative w-full">
                                        {/* Horizontal Line */}
                                        <div className="absolute top-[6px] left-0 right-0 h-[2px] bg-gray-300 z-0" />

                                        {/* Radio Buttons */}
                                        <div className="flex items-center justify-between relative z-10">
                                          {Array.from(
                                            { length: (question.to ?? 4) - (question.from ?? 0) + 1 },
                                            (_, i) => (question.from ?? 0) + i
                                          ).map((value) => (
                                            <label key={value} className="flex flex-col items-center text-sm">
                                              <input
                                                type="radio"
                                                name={`linear-${question.id}`}
                                                value={value}
                                                className="form-radio text-blue-600 w-4 h-4"
                                                onChange={(e) =>
                                                  handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)
                                                }
                                              // checked={question.selectedValue === value}
                                              />
                                              <span className="mt-1">{value}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>

                                      {question.conditionalLogics?.map((logic, idx) =>
                                        isLogicMet(logic, question.previewAnswer) &&
                                        logic.subQuestions?.map((subQ) => (
                                          <div key={subQ.id}>
                                            <ConditionalQuestion subQ={subQ} />
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}


                                  {question.type === "location" && (
                                    <div>
                                      <Label htmlFor={`question-${question.id}-select`}></Label>
                                      <select
                                        className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                                        value={question.previewAnswer}
                                        onChange={(e) => handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)}
                                      >
                                        <option value="">- Select Location -</option>
                                        {
                                          locations.map(l => <option key={l.id} value={l.id}>{l?.description || "NA"}</option>)
                                        }
                                      </select>
                                    </div>
                                  )}


                                  {question.type === "long_answer" && <Textarea placeholder={question.description} />}

                                  {question.type === "checkboxes" && question.options && (
                                    <div className="space-y-4">
                                      {question.options.map((option, index) => (
                                        <div key={index} className="flex items-center space-x-2">
                                          <Checkbox id={`checkboxes-${index}`} />
                                          <Label htmlFor={`checkboxes-${index}`}>{option}</Label>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {question.type === "user" && (
                                    <div>
                                      <Label htmlFor={`question-${question.id}-select`}></Label>
                                      <select
                                        // id={`question-${user.id}-select`}
                                        // value={question.title} // or question.value, depending on your structure
                                        // onChange={(e) =>
                                        // handleQuestionUpdate(activeStage, user.id, "title", e.target.value)
                                        // }
                                        className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                                      >
                                        <option value="">Select User</option>
                                        <option value="User1">User 1</option>
                                        <option value="User2">User 2</option>
                                        <option value="User3">User 3</option>
                                      </select>
                                    </div>
                                  )}

                                  {question.type === "division" && (
                                    <div>
                                      <Label htmlFor={`question-${question.id}-select`}></Label>
                                      <select
                                        className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                                      >
                                        <option value="">- Select Division -</option>
                                        {
                                          divisions.map(l => <option key={l.id} value={l.id}>{l?.description || "NA"}</option>)
                                        }
                                      </select>
                                    </div>
                                  )}

                                  {question.type === "sub_division" && (
                                    <div>
                                      <Label htmlFor={`question-${question.id}-select`}></Label>
                                      <select
                                        className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                                      >
                                        <option value="">- Select Sub-Division -</option>
                                        <option value="Sub-Division1">Sub-Division 1</option>
                                        <option value="Sub-Division2">Sub-Division 2</option>
                                        <option value="Sub-Division3">Sub-Division 3</option>
                                      </select>
                                    </div>
                                  )}

                                  {question.type === "date" && <Input type="date" />}

                                  {question.type === "time" && <Input type="time" />}

                                  {question.type === "datetime" && <Input type="datetime-local" />}

                                  {question.type === "upload_image" && (
                                    <div className="border-2 border-black border-dotted rounded-md p-6 flex flex-col items-center justify-center">
                                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                      <p className="text-sm text-muted-foreground text-center">
                                        {question.cameraOnly
                                          ? "Take a photo"
                                          : "Tap to upload a picture"}
                                        <br />
                                        {question.maxFiles && (
                                          <span className="text-xs text-muted-foreground">
                                            Up to {question.maxFiles} image{question.maxFiles > 1 ? "s" : ""}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  )}

                                  {question.type === "upload_video" && (
                                    <div className="border border-black border-dotted  rounded-md p-6 flex flex-col items-center justify-center">
                                      <VideoIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                      <p className="text-sm text-muted-foreground text-center">
                                        {question.requiresLive
                                          ? "Record a video"
                                          : "Tap to upload a video"}
                                        <br />
                                      </p>
                                    </div>
                                  )}

                                  {question.type === "upload_file" && (
                                    <div className="border border-black border-dotted rounded-md p-6 flex flex-col items-center justify-center">
                                      <FileIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                      <p className="text-sm text-muted-foreground text-center">
                                        Tap to upload a file
                                        <br />
                                        {question.maxFiles && (
                                          <span className="text-xs text-muted-foreground">
                                            Up to {question.maxFiles} file{question.maxFiles > 1 ? "s" : ""}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  )}


                                  {question.type === "signature" && (
                                    <div className="space-y-3">
                                      {/* Signature Pad UI */}
                                      <div className="border-2 border-dotted border-gray-300 rounded-md h-16 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition">
                                        <div className="flex items-center gap-2 text-primary">
                                          <PencilIcon className="h-4 w-4" />
                                          <span className="text-sm font-medium">Tap to sign</span>
                                        </div>
                                      </div>
                                      {/* Full Name Field */}
                                      <div>
                                        <Label htmlFor={`question-${question.id}-fullname`} className="text-sm">
                                          Full Name
                                        </Label>
                                        <Input
                                          id={`question-${question.id}-fullname`}
                                          placeholder="Enter full name"
                                          className="mt-1"
                                        // value={question.fullName || ""}
                                        // onChange={(e) =>
                                        //   handleQuestionUpdate(activeStage, question.id, "fullName", e.target.value)
                                        // }
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Name field is optional if this is submitter's signature.
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {question.type === "qr_code" && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-3 border rounded-md px-4 py-2">
                                        <div
                                          className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary
                   hover:bg-primary hover:text-white transition-colors duration-200 cursor-pointer"
                                        >                                        <QrCodeIcon className="h-5 w-5" />
                                        </div>
                                        <div className="h-6 w-px bg-gray-300" />
                                        <input
                                          id={`question-${question.id}-hint`}
                                          type="text"
                                          value={question.hint || ""}
                                          readOnly
                                          className="flex-1 bg-transparent border-none outline-none text-sm pl-1"
                                        />
                                      </div>
                                    </div>
                                  )}


                                  {question.type === "table" && (
                                    <TablePreview
                                      question={question}
                                      items={question.tablePreviewAnswers || []}
                                      onItemsChange={(newItems) =>
                                        handleQuestionUpdate(stage.id, question.id, "tablePreviewAnswers", newItems)
                                      }
                                    />
                                  )}

                                  {question.type === "formula" && (
                                    <div className="space-y-2">
                                      <FormulaPreview formula={question.formula} questions={stage.questions} />
                                    </div>
                                  )}

                                </div>
                              )}
                            </div>
                          ))}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                    Close Preview
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Discard Dialog */}
            <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have unsaved changes. Are you sure you want to discard them?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => confirmDiscard()}>Discard</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>


            {/* Background Save Prompt */}
            <AlertDialog open={showBackgroundPrompt} onOpenChange={setShowBackgroundPrompt}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save in background?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Saving can take a while for large forms. You can continue to the forms list while we save in the background, and we'll notify you when it's done. Or stay on this page and wait for the result.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => executeSave('foreground', pendingPayload)}>Stay and wait</AlertDialogCancel>
                  <AlertDialogAction onClick={() => executeSave('background', pendingPayload)}>Run in background</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          </div>


        </div>
        <div>
          <div></div>
          <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="folderName" className="text-right">
                    Folder Name
                  </Label>
                  <Input
                    id="folderName"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="folderName" className="text-right">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={folderDescription}
                    onChange={(e) => setFolderDescription(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={CreateFolders} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Save className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Folder
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {showFormulaModal && (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white w-[500px] rounded-lg shadow-lg p-6 relative">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Edit Formula</h2>
                  <button onClick={() => setShowFormulaModal(false)} className="text-xl font-bold">×</button>
                </div>

                {/* Formula Input */}
                <textarea
                  value={tempFormula}
                  onChange={(e) => setTempFormula(e.target.value)}
                  placeholder="Type # to add questions to your formula. E.g. sum(#1, #2) + avg(#3, #4) + #5% * 100"
                  className="w-full border border-gray-300 p-2 rounded text-sm h-20 resize-none"
                />

                {/* Tabs */}
                <div className="mt-4 flex border-b">
                  <button className="px-4 py-2 text-sm border-b-2 border-teal-500 text-teal-500">Calculator</button>
                  <button className="px-4 py-2 text-sm text-gray-400">Questions</button>
                  <button className="ml-auto text-sm text-red-500" onClick={() => setTempFormula("")}>
                    Clear All
                  </button>
                </div>

                {/* Calculator Pad */}
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  {["sum", "avg", "7", "8", "9", "/", "(", ")", "4", "5", "6", "*", "%", ",", "1", "2", "3", "-", "←", ".", "0", "+"].map((btn) => (
                    <button
                      key={btn}
                      // onClick={() => handleCalcButtonClick(btn)}
                      className="border p-2 rounded hover:bg-gray-100 text-sm"
                    >
                      {btn}
                    </button>
                  ))}
                </div>

                {/* Save Button */}
                <button
                  onClick={() => {
                    // handleQuestionUpdate(activeStage, question.id, "formula", tempFormula);
                    setShowFormulaModal(false);
                  }}
                  className="w-full mt-6 py-2 bg-gray-800 text-white rounded"
                >
                  SAVE
                </button>
              </div>
            </div>
          )}

        </div>

        {(() => {
          const stage = formData.stages.find((s) => s.id === activeStage);
          if (!stage) return null;
          const question = stage.questions.find(
            (q) => q.id === conditionalLogicModalOpen?.questionId
          ); if (!question) return null;

          if (!activeStage || !question) return null;




          const isSaveDisabled = question.conditionalLogics?.some(logic =>
            !logic.logic_value || logic.logic_value.trim() === '' ||
            !logic.subQuestions || logic.subQuestions.length === 0 ||
            logic.subQuestions?.some(subQ => !subQ.title || subQ.title.trim() === '')
          ) ?? false;

          return (
            <ConditionalLogicModal
              open={!!conditionalLogicModalOpen}
              onOpenChange={(open) =>
                setConditionalLogicModalOpen(
                  open ? conditionalLogicModalOpen : null
                )
              }
              hasConditionalLogic={!!question.conditionalLogics && question.conditionalLogics.length > 0}
              onToggleConditionalLogic={(enabled) =>
                handleToggleConditionalLogic(activeStage ?? "", question.id, enabled)
              }
              isSaveDisabled={isSaveDisabled}
              onRemoveAllConditionalLogics={() => handleRemoveAllConditionalLogicsALL(activeStage, question.id)}
            >
              {question.conditionalLogics && question.conditionalLogics.length > 0 && (
                <div>
                  {question.conditionalLogics.map((logic, idx) => {
                    const followUp = logic.follow_up || {};
                    const notification = logic.notification || { enabled: false, users: [], groups: [], emails: [] };

                    return (
                      <div
                        id={`logic-${idx}`}
                        className="mt-4 border-l rounded-lg p-4 mb-4 bg-white"
                        key={idx}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-lg">Logic {idx + 1}</Label>
                          <div className="flex gap-2">
                            <Button
                              className="bg-blue-500 hover:bg-blue-300 transition"
                              onClick={() => handleDuplicateConditionalLogic(activeStage, question.id, idx)}
                            >
                              Duplicate
                            </Button>
                            <Button
                              // variant="outline"
                              // size="sm"
                              className="bg-red-500 hover:bg-red-300 transition"
                              onClick={() => handleRemoveConditionalLogic(activeStage, question.id, idx)}
                            // disabled={question?.conditionalLogics?.length === 1}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        {/* {
                          question.type === "short_answer" && (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div>
                                <Label htmlFor={`logic-${question.id}-${idx}-type`}>Condition</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(activeStage, question.id, idx, "logic_type", value)
                                  }
                                >
                                  <SelectTrigger id={`logic-${question.id}-${idx}-type`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`logic-${question.id}-${idx}-value`}>Value</Label>
                                <Input
                                  id={`logic-${question.id}-${idx}-value`}
                                  value={logic.logic_value}
                                  onChange={(e) =>
                                    handleUpdateConditionalLogic(activeStage, question.id, idx, "logic_value", e.target.value)
                                  }
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )
                        } */}

                        {
                          question.type === "short_answer" && (
                            <div
                              className={`grid ${question.valueType === "number" ? "grid-cols-3" : "grid-cols-2"
                                } gap-2 mb-4`}
                            >
                              {/* Common: Condition type (Is / Is Not) */}
                              <div>
                                <Label htmlFor={`logic-${question.id}-${idx}-type`}>Condition</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(activeStage, question.id, idx, "logic_type", value)
                                  }
                                >
                                  <SelectTrigger id={`logic-${question.id}-${idx}-type`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Conditional Rendering Based on Value Type */}
                              {question.valueType === "number" ? (
                                <>
                                  {/* Comparison Operator (less than, greater than, etc.) */}
                                  <div>
                                    <Label htmlFor={`logic-${question.id}-${idx}-comparison`}>Comparison</Label>
                                    <Select
                                      value={logic.comparision}
                                      onValueChange={(value) =>
                                        handleUpdateConditionalLogic(activeStage, question.id, idx, "comparision", value)
                                      }
                                    >
                                      <SelectTrigger id={`logic-${question.id}-${idx}-comparison`} className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="less_than">Less Than</SelectItem>
                                        <SelectItem value="lessthan_or_equalto">Less Than or Equal To</SelectItem>
                                        <SelectItem value="equals">Equal To</SelectItem>
                                        <SelectItem value="greater_than">Greater Than</SelectItem>
                                        <SelectItem value="greaterthan_or_equalto">Greater Than or Equal To</SelectItem>
                                        <SelectItem value="blank">Blank</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Numeric Value Input */}
                                  <div>
                                    <Label htmlFor={`logic-${question.id}-${idx}-value`}>Value</Label>
                                    <Input
                                      id={`logic-${question.id}-${idx}-value`}
                                      type="number"
                                      value={logic.logic_value}
                                      onChange={(e) =>
                                        handleUpdateConditionalLogic(
                                          activeStage,
                                          question.id,
                                          idx,
                                          "logic_value",
                                          e.target.value
                                        )
                                      }
                                      className="mt-1"
                                    />
                                  </div>
                                </>
                              ) : (
                                // Default: text-based value input (like before)
                                <div>
                                  <Label htmlFor={`logic-${question.id}-${idx}-value`}>Value</Label>
                                  <Input
                                    id={`logic-${question.id}-${idx}-value`}
                                    value={logic.logic_value}
                                    onChange={(e) =>
                                      handleUpdateConditionalLogic(activeStage, question.id, idx, "logic_value", e.target.value)
                                    }
                                    className="mt-1"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        }



                        {
                          question.type === "multiple_choice" && (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div>
                                <Label htmlFor={`question-${question.id}-condition`}>Condition</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_type",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`question-${question.id}-value`}>Value</Label>
                                <Select
                                  value={logic.logic_value || ""}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_value",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-value`} className="mt-1">
                                    <SelectValue placeholder="Select a value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(question.options || [])
                                      .filter(option => option && option.trim() !== "")
                                      .map((option, idx) => (
                                        <SelectItem key={idx} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>


                            </div>
                          )
                        }

                        {
                          question.type === "audit" && (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div>
                                <Label htmlFor={`question-${question.id}-condition`}>Condition</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_type",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`question-${question.id}-value`}>Value</Label>
                                <Select
                                  value={logic.logic_value || ""}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_value",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-value`} className="mt-1">
                                    <SelectValue placeholder="Select a value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(question.auditOptions || []).map((opt, idx) => (
                                      <SelectItem key={idx} value={opt.option}>
                                        {opt.option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>


                            </div>
                          )
                        }

                        {
                          question.type === "linear_scale" && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              <div>
                                <Label htmlFor={`question-${question.id}-condition`}>If answer</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_type",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>


                              </div>
                              <div>
                                <Label htmlFor={`question-${question.id}-condition`}>Condition</Label>
                                <Select
                                  value={logic.comparision}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "comparision",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="less_than">Less Than</SelectItem>
                                    <SelectItem value="lessthan_or_equalto">Less Than or equal to</SelectItem>
                                    <SelectItem value="equals">Equal to</SelectItem>
                                    <SelectItem value="greater_than">Greater Than</SelectItem>
                                    <SelectItem value="greaterthan_or_equalto">Greater Than or equal to</SelectItem>
                                    <SelectItem value="blank">Blank</SelectItem>
                                  </SelectContent>
                                </Select>


                              </div>

                              <div>
                                <Label htmlFor={`question-${question.id}-condition`}>Value</Label>
                                <Select
                                  value={logic.logic_value}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_value",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {
                                      Array.from({ length: (question.to ?? 0) - (question.from ?? 0) + 1 }, (_, i) => (question.from ?? 0) + i).map((value) => (
                                        <SelectItem key={value} value={`${value}`}>{value}</SelectItem>
                                      ))
                                    }
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                          )
                        }


                        {
                          question.type === "dropdown" && (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div>
                                <Label htmlFor={`question-${question.id}-condition`}>Condition</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_type",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`question-${question.id}-value`}>Value</Label>
                                <Select
                                  value={logic.logic_value || ""}
                                  onValueChange={(value) =>
                                    handleUpdateConditionalLogic(
                                      activeStage,
                                      question.id,
                                      idx,
                                      "logic_value",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`question-${question.id}-value`} className="mt-1">
                                    <SelectValue placeholder="Select a value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(question.options || [])
                                      .filter(option => option && option.trim() !== "" && option.toLowerCase() !== "other")
                                      .map((option, idx) => (
                                        <SelectItem key={idx} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>


                            </div>
                          )
                        }


                        {/* Sub-questions editor for this logic */}
                        <SubQuestionsEditor
                          subQuestions={logic.subQuestions || []}
                          validationErrors={validationErrors}
                          parentQuestionId={question.id}
                          stageId={activeStage}
                          questionTypes={questionTypes}
                          questionTypesObj={questionTypesObj}
                          handleAddSubQuestion={(stageId, parentQuestionId, type) =>
                            handleUpdateConditionalLogic(
                              stageId,
                              parentQuestionId,
                              idx,
                              "subQuestions",
                              [
                                ...(logic.subQuestions || []),
                                {
                                  id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                  type,
                                  title: "",
                                  required: false,
                                },
                              ]
                            )
                          }
                          handleUpdateSubQuestion={
                            (stageId, parentQuestionId, subQuestionId, field, value) => {
                              const updatedSubQs = (logic.subQuestions || []).map((subQ) =>
                                subQ.id === subQuestionId ? { ...subQ, [field]: value } : subQ
                              );
                              handleUpdateConditionalLogic(stageId, parentQuestionId, idx, "subQuestions", updatedSubQs);
                              if (field === "title") {
                                if (value && value.trim()) {
                                  clearValidationError(subQuestionId);
                                }
                              }
                            }
                          }
                          handleDeleteSubQuestion={
                            (stageId, parentQuestionId, subQuestionId) => {
                              const updatedSubQs = (logic.subQuestions || []).filter((subQ) => subQ.id !== subQuestionId);
                              handleUpdateConditionalLogic(stageId, parentQuestionId, idx, "subQuestions", updatedSubQs);
                            }
                          }
                          addOptionToSubQuestion={addOptionToSubQuestion}
                          handleUpdateOption={handleUpdateOption}
                          getQuestionTypeIcon={getQuestionTypeIcon}
                          getQuestionTypeLabel={getQuestionTypeLabel}
                          deleteOptionFromSubQuestion={deleteOptionFromSubQuestion}
                          CopyIcon={CopyIcon}
                          handleMoveQuestionUp={handleMoveQuestionUp}
                          handleMoveQuestionDown={handleMoveQuestionDown}
                          handleMoveSubQuestionUp={(stageId, parentQuestionId, subQuestionId) =>
                            handleMoveSubQuestionUp(activeStage, parentQuestionId, subQuestionId)
                          }
                          handleMoveSubQuestionDown={(stageId, parentQuestionId, subQuestionId) =>
                            handleMoveSubQuestionDown(activeStage, parentQuestionId, subQuestionId)
                          }
                          MoveDownIcon={MoveDownIcon}
                          MoveUpIcon={MoveUpIcon}
                          handleDuplicateQuestion={handleDuplicateQuestion}
                          handleDuplicateSubQuestion={
                            (stageId, parentQuestionId, subQuestionId) => {
                              const duplicatedSubQs = (logic.subQuestions || []).filter((subQ) =>
                                subQ.id === subQuestionId
                              ).map((subQ) => ({
                                ...subQ,
                                id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                title: `${subQ.title} (Copy)`,
                              }));
                              const updatedSubQs = [...(logic.subQuestions || []), ...duplicatedSubQs];
                              handleUpdateConditionalLogic(stageId, parentQuestionId, idx, "subQuestions", updatedSubQs);
                            }
                          }
                        />
                        <LogicNotificationAccordion
                          enabled={notification.enabled}
                          setEnabled={v => handleNotificationChange(activeStage, question.id, idx, { enabled: v })}
                          users={users}
                          groups={groups}
                          selectedUsers={notification.users}
                          setSelectedUsers={v => handleNotificationChange(activeStage, question.id, idx, { users: v })}
                          selectedGroups={notification.groups}
                          setSelectedGroups={v => handleNotificationChange(activeStage, question.id, idx, { groups: v })}
                          emails={notification.emails}
                          setEmails={v => handleNotificationChange(activeStage, question.id, idx, { emails: v })}
                        />

                        <LogicFollowUpAccordion
                          followup_toggle={followUp.followup_toggle ?? false}
                          setFollowupToggle={(v: boolean) => handleFollowUpChange(activeStage, question.id, idx, { followup_toggle: v, enabled: v })}
                          title={followUp.title}
                          setTitle={(v: string) => handleFollowUpChange(activeStage, question.id, idx, { title: v })}
                          description={followUp.description || ""}
                          setDescription={(v: string) => handleFollowUpChange(activeStage, question.id, idx, { description: v })}
                          deadline={followUp.deadline}
                          setDeadline={(v: number) => handleFollowUpChange(activeStage, question.id, idx, { deadline: v })}
                          users={users}
                          groups={groups}
                          assign_form={followUp.assign_form || ""}
                          setAssign_form={(v: string) => handleFollowUpChange(activeStage, question.id, idx, { assign_form: v })}
                          allForms={allForms}
                          // assignFormUser={followUp.assignFormUser || ""}
                          // setAssignFormUser={(v: string) => handleFollowUpChange(activeStage, question.id, idx, { assignFormUser: v })}
                          assignFormSubmitter={!!followUp.assignFormSubmitter}
                          setAssignFormSubmitter={(v: boolean) => handleFollowUpChange(activeStage, question.id, idx, { assignFormSubmitter: v })}
                          assignUsers={followUp.assignUsers || []}
                          setAssignUsers={(v) =>
                            handleFollowUpChange(activeStage, question.id, idx, {
                              assignUsers: typeof v === "function"
                                ? v(followUp.assignUsers || [])
                                : v,
                            })
                          }
                          assignGroups={followUp.assignGroups || []}
                          setAssignGroups={(v) =>
                            handleFollowUpChange(activeStage, question.id, idx, {
                              assignGroups: typeof v === "function"
                                ? v(followUp.assignGroups || [])
                                : v,
                            })
                          }
                          closeQuestions={Array.isArray(followUp.task_close_questions)
                            ? followUp.task_close_questions
                            : []}
                          setCloseQuestions={(v) =>
                            handleFollowUpChange(activeStage, question.id, idx, {
                              task_close_questions:
                                typeof v === "function"
                                  ? v(Array.isArray(followUp.task_close_questions) ? followUp.task_close_questions : [])
                                  : v,
                            })
                          }
                          questionTypes={questionTypes}
                          questionTypesObj={questionTypesObj}
                          formId={typeof formData.id === "number" ? formData.id : Number(formData.id) || 0}
                          stageId={activeStage}
                          questionId={question.id}
                          logicId={logic.id ?? 0}
                        />
                      </div>
                    )
                  })}
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleAddConditionalLogic(activeStage, question.id)}
                    >
                      Add Another Logic
                    </Button>
                  </div>
                </div>
              )}
              {/* FULL LOGIC CONTROLS END */}
            </ConditionalLogicModal>
          );
        })()}

        <BulkImportModal
          open={bulkImportModalOpen}
          onOpenChange={setBulkImportModalOpen}
          formData={formData}
          setFormData={setFormData}
          activeStage={activeStage}
          questionTypes={questionTypes}
          questionTypesObj={questionTypesObj}
          users={users}
          groups={groups}
          allForms={allForms}
          formId={typeof formData.id === "number" ? formData.id : Number(formData.id) || 0}
        />

        <BulkEditModal
          open={bulkEditModalOpen}
          onOpenChange={setBulkEditModalOpen}
          formData={formData}
          setFormData={setFormData}
          questionTypes={questionTypes}
          questionTypesObj={questionTypesObj}
          users={users}
          groups={groups}
          allForms={allForms}
          formId={typeof formData.id === "number" ? formData.id : Number(formData.id) || 0}
        />

      </>
    )
  }

  return null
}
