"use client"

import { useState, useEffect, useRef } from "react"
import { differenceInCalendarDays, parseISO } from "date-fns"

interface PlannerHistoryItem {
  id?: number;
  order_id?: string;
  location?: string | null;
  location_name?: string | null;
  not_started_count?: number;
  in_progress_count?: number;
  completed_count?: number;
  form_type?: string;
  planner_name?: string;
  form_title?: string;
  start_date?: string;
  end_date?: string;
  planner_shared_on?: string;
  is_completed?: boolean;
  assign_type?: string;
  form_id?: number;
  user?: string;
  group?: string;
  leader?: string;
  completed_by?: string;
  completed_on?: string;
  started_by?: string;
  started_on?: string;
  name?: string;
  date?: string;
  status?: string;
  uploadedBy?: string;
  description?: string;
  assignee_count?: number | string;
  non_completion_reason?: string | null;
  reason_status?: string | null;
  rejection_reason?: string | null;
  rejection_questions?: any[] | null;
  rejection_answers?: any[] | null;
  extended_due_date?: string | null;
  extension_note?: string | null;
  extended_by?: string | null;
  extended_on?: string | null;
  reason_history?: any[] | null;
  repeat_enabled?: boolean;
  repeat_interval_days?: number;
  early_notification_days?: number;
  parent_planner_id?: number | null;
  folder_id?: number | null;
  folder_name?: string | null;
  folder_color?: string | null;
  collaborative_enabled?: boolean;
  team_leader?: string | null;
  team_leader_id?: number | null;
  group_members?: string[];
  collaborative_groups?: any[];
}

interface AssigneeItem {
  task_id: number;
  task_name: string;
  assignee: string;
  assignee_location: string;
  status: string;
}

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, Eye, Download, AlertTriangle, Info, CheckCircle2, Clock, CalendarClock, Plus, X, Repeat, Folder, FolderInput, ChevronUp, ChevronDown, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import axiosInstance from "@/utils/axiosInstance"
import { useSelector } from "react-redux"
import { selectHydrated, selectUser } from "@/redux/slices/authSlice"
import GlobalLoader from "@/components/ui/globalloader"
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast"

interface PlannerHistoryProps {
  searchQuery: string;
  onPlannersMoved?: () => void;
  folderId?: number | null;
}

function FolderTableRow({
  folder,
  plannerCount,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onClick,
}: {
  folder: { id: number; name: string; color: string; order?: number }
  plannerCount: number
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onClick: () => void
}) {
  return (
    <TableRow
      className="hover:bg-blue-50 cursor-pointer border-b group"
      onClick={onClick}
    >
      <TableCell />
      <TableCell className="w-[80px]">
        <div className="flex items-center gap-1">
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              disabled={!canMoveUp}
              onClick={(e) => { e.stopPropagation(); onMoveUp() }}
              className="p-0 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              disabled={!canMoveDown}
              onClick={(e) => { e.stopPropagation(); onMoveDown() }}
              className="p-0 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <img className="h-7" src="https://img.icons8.com/fluency/48/folder-invoices--v2.png" alt="folder" />
        </div>
      </TableCell>
      <TableCell className="font-medium text-blue-600 hover:underline">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4" style={{ color: folder.color }} />
          <span>{folder.name}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-800 border-blue-200 whitespace-nowrap">
            {plannerCount} planners
          </Badge>
        </div>
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
    </TableRow>
  )
}

export function PlannerHistory({ searchQuery, onPlannersMoved, folderId }: PlannerHistoryProps) {
  const router = useRouter()
  const hydrated = useSelector(selectHydrated)
  const reduxUser = useSelector(selectUser)
  const { toast } = useToast()
  const searchTerm = searchQuery
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedPlanner, setSelectedPlanner] = useState<PlannerHistoryItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [plannerHistory, setPlannerHistory] = useState<PlannerHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [assignees, setAssignees] = useState<AssigneeItem[]>([])
  const [filteredAssignees, setFilteredAssignees] = useState<AssigneeItem[]>([])
  const [taskFilter, setTaskFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [assignedToFilter, setAssignedToFilter] = useState("")
  const [assigneeStatusFilter, setAssigneeStatusFilter] = useState("")
  const [notAssignedCount, setNotAssignedCount] = useState(0)
  const [notStartedCount, setNotStartedCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const [selectedPlanners, setSelectedPlanners] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [folders, setFolders] = useState<{id: number; name: string; color: string; order?: number}[]>([])
  const [moveFolderOpen, setMoveFolderOpen] = useState(false)
  const didFetch = useRef(false)

  // Edit planner dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editPlanner, setEditPlanner] = useState<PlannerHistoryItem | null>(null)
  const [editPlannerName, setEditPlannerName] = useState("")
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [editRepeatEnabled, setEditRepeatEnabled] = useState(false)
  const [editRepeatIntervalDays, setEditRepeatIntervalDays] = useState(50)
  const [editEarlyNotificationDays, setEditEarlyNotificationDays] = useState(3)
  const [editTeamLeaderId, setEditTeamLeaderId] = useState<string>("")
  const [orgUsers, setOrgUsers] = useState<{id: number; first_name: string; last_name: string; username: string}[]>([])

  // Extend due date dialog state
  const [extendDialogOpen, setExtendDialogOpen] = useState(false)
  const [extendPlanner, setExtendPlanner] = useState<PlannerHistoryItem | null>(null)
  const [extendDate, setExtendDate] = useState("")
  const [extendNote, setExtendNote] = useState("")
  const [isExtending, setIsExtending] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectionQuestions, setRejectionQuestions] = useState<any[]>([])
  const [reviewMode, setReviewMode] = useState<"initial" | "approve" | "reject">("initial")

  useEffect(() => {
    setFilteredAssignees(assignees.filter(assignee =>
      assignee.task_name.toLowerCase().includes(taskFilter.toLowerCase()) &&
      assignee.assignee_location.toLowerCase().includes(locationFilter.toLowerCase()) &&
      assignee.assignee.toLowerCase().includes(assignedToFilter.toLowerCase()) &&
      (assigneeStatusFilter === "" || assignee.status === assigneeStatusFilter)
    ))
    setCurrentPage(1)
  }, [assignees, taskFilter, locationFilter, assignedToFilter, assigneeStatusFilter])

  // Fetch planner history from API
  const fetchPlannerHistory = async () => {
    try {
      setLoading(true)
      const response = await axiosInstance.get("/planner/all-planners/")
      const rawItems = response.data as PlannerHistoryItem[] || []

      // Group by order_id so multiple assignments to different users show as 1 row
      const grouped: Record<string, PlannerHistoryItem[]> = {}
      rawItems.forEach((item: PlannerHistoryItem) => {
        const key = item.order_id || `id-${item.id}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(item)
      })

      const transformed: PlannerHistoryItem[] = Object.values(grouped).map((group: PlannerHistoryItem[]) => {
        const first = group[0]
        const assigneeCount = group.length
        const completedCount = group.filter(g => g.is_completed).length
        const inProgressCount = group.filter(g => !g.is_completed && (g.started_by || g.started_on)).length
        const notStartedCount = assigneeCount - completedCount - inProgressCount

        // Aggregate status: Completed if all completed, In Progress if any started, else Not Started
        let aggStatus = "Not Started"
        if (completedCount === assigneeCount) aggStatus = "Completed"
        else if (inProgressCount > 0) aggStatus = "In Progress"

        // Build assignee names list
        const assigneeNames = group.map(g => g.user || g.group || g.leader).filter(Boolean)
        const assigneeLabel = assigneeCount > 1
          ? `${assigneeCount} users`
          : (assigneeNames[0] || "Unassigned")

        return {
          id: first.id,
          order_id: first.order_id,
          location: first.location_name || first.location || null,
          planner_name: first.planner_name,
          name: first.planner_name || first.form_title || "N/A",
          start_date: first.start_date,
          date: first.planner_shared_on ? first.planner_shared_on.split('T')[0] : "N/A",
          end_date: first.end_date,
          planner_shared_on: first.planner_shared_on,
          status: aggStatus,
          assignee_count: assigneeCount,
          uploadedBy: assigneeLabel,
          not_started_count: notStartedCount,
          in_progress_count: inProgressCount,
          completed_count: completedCount,
          form_type: first.form_type,
          form_title: first.form_title,
          form_id: first.form_id,
          assign_type: first.assign_type,
          user: assigneeCount > 1 ? null : first.user,
          group: assigneeCount > 1 ? null : first.group,
          leader: assigneeCount > 1 ? null : first.leader,
          completed_by: completedCount > 0 ? `${completedCount}/${assigneeCount} done` : null,
          completed_on: first.completed_on,
          started_by: first.started_by,
          started_on: first.started_on,
          description: first.description,
          non_completion_reason: first.non_completion_reason,
          reason_status: first.reason_status,
          rejection_reason: first.rejection_reason,
          rejection_questions: first.rejection_questions,
          rejection_answers: first.rejection_answers,
          extended_due_date: first.extended_due_date,
          extension_note: first.extension_note,
          extended_by: first.extended_by,
          extended_on: first.extended_on,
          reason_history: first.reason_history || [],
          repeat_enabled: first.repeat_enabled,
          repeat_interval_days: first.repeat_interval_days,
          early_notification_days: first.early_notification_days,
          parent_planner_id: first.parent_planner_id,
          folder_id: first.folder_id,
          folder_name: first.folder_name,
          folder_color: first.folder_color,
          collaborative_enabled: first.collaborative_enabled,
          team_leader: first.team_leader,
          team_leader_id: first.team_leader_id,
          group_members: first.group_members || [],
          collaborative_groups: first.collaborative_groups || [],
        } as PlannerHistoryItem
      })
      console.log("Setting planner history:", transformed.length, "items")
      setPlannerHistory(transformed)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching planner history:", err)
      setPlannerHistory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (didFetch.current || !hydrated || !reduxUser) return
    didFetch.current = true
    fetchPlannerHistory()
  }, [hydrated, reduxUser])

  const filteredHistory = plannerHistory.filter((item) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = !term || Object.values(item).some((val) => {
      if (val == null) return false
      if (typeof val === "object") return false
      return String(val).toLowerCase().includes(term)
    })

    const matchesStatus = statusFilter === "all" || item.status === statusFilter

    const matchesFolder = folderId != null
      ? item.folder_id === folderId
      : !item.folder_id

    return matchesSearch && matchesStatus && matchesFolder
  }).sort((a, b) => {
    const getActionPriority = (item: PlannerHistoryItem): number => {
      const now = new Date()
      const endDate = item.end_date ? new Date(item.end_date) : null
      const isOverdue = endDate && endDate < now && item.status !== "Completed"
      const isPendingReview = item.reason_status === 'pending' && item.non_completion_reason
      const isRejected = item.reason_status === 'rejected'
      const isNotStarted = item.status === "Not Started"
      const isInProgress = item.status === "In Progress"

      if (isPendingReview) return 1
      if (isRejected) return 2
      if (isOverdue && isInProgress) return 3
      if (isOverdue && isNotStarted) return 4
      if (isInProgress) return 5
      if (isNotStarted) return 6
      return 7
    }
    return getActionPriority(a) - getActionPriority(b)
  })

  console.log("Planner history length:", plannerHistory.length)
  console.log("Planner history items:", plannerHistory.map(p => ({id: p.id, name: p.name, status: p.status, started_by: p.started_by})))
  console.log("Filtered history length:", filteredHistory.length)

  const fetchAssignees = async (plannerId: number) => {
    try {
      const response = await axiosInstance.get(`/planner/${plannerId}/assignees/`)
      setAssignees(response.data)
      const assigneesData = response.data
      let notAssigned = 0, notStarted = 0, inProgress = 0, completed = 0
      assigneesData.forEach((assignee: AssigneeItem) => {
        if (assignee.status === "Not Assigned") notAssigned++
        else if (assignee.status === "Not Started") notStarted++
        else if (assignee.status === "In Progress") inProgress++
        else if (assignee.status === "Completed") completed++
      })
      setNotAssignedCount(notAssigned)
      setNotStartedCount(notStarted)
      setInProgressCount(inProgress)
      setCompletedCount(completed)
    } catch (err) {
      console.error("Error fetching assignees:", err)
    }
  }

  const handleView = async (planner: PlannerHistoryItem) => {
    if (planner.id) {
      setTaskFilter("")
      setLocationFilter("")
      setAssignedToFilter("")
      setAssigneeStatusFilter("")
      setSelectedPlanner(planner)
      setCurrentPage(1)
      setIsDialogOpen(true)
      await fetchAssignees(planner.id)
    }
  }

  // Auto-refresh assignment details while the view dialog is open
  useEffect(() => {
    if (!isDialogOpen || !selectedPlanner?.id) return
    fetchAssignees(selectedPlanner.id)
    const interval = setInterval(() => {
      if (selectedPlanner.id) fetchAssignees(selectedPlanner.id)
    }, 5000)
    return () => clearInterval(interval)
  }, [isDialogOpen, selectedPlanner?.id])

  // Pagination logic
  const totalPages = Math.ceil(filteredAssignees.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredAssignees.slice(startIndex, endIndex)

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const getBadgeColor = (status: string) => {
    switch (status) {
      case "Not Assigned":
        return <Badge variant="outline" className="bg-gray-100 text-blue-800 border border-gray-300">Not Assigned</Badge>
      case "Not Started":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border border-red-300">Not Started</Badge>
      case "In Progress":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border border-yellow-300">In Progress</Badge>
      case "Completed":
        return <Badge variant="default" className="bg-green-100 text-green-800 border border-green-300">Completed</Badge>
      default:
        return null
    }
  }

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case "Not Started":
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300";
      case "In Progress":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300";
      case "Completed":
        return "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300";
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-100";
    }
  };

  const handleSelectPlanner = (plannerId: number) => {
    const newSelected = new Set(selectedPlanners)
    if (newSelected.has(plannerId)) {
      newSelected.delete(plannerId)
    } else {
      newSelected.add(plannerId)
    }
    setSelectedPlanners(newSelected)
    setSelectAll(newSelected.size === filteredHistory.length)
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPlanners(new Set())
    } else {
      setSelectedPlanners(new Set(filteredHistory.map(p => p.id).filter((id): id is number => id !== undefined)))
    }
    setSelectAll(!selectAll)
  }

  const handleDelete = async (plannerId: number) => {
    try {
      await axiosInstance.delete(`/planner/${plannerId}/delete/`)
      setPlannerHistory(plannerHistory.filter(p => p.id !== plannerId))
      toast({
        title: "Success",
        description: "Planner deleted successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete planner",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (planner: PlannerHistoryItem) => {
    setEditPlanner(planner)
    setEditPlannerName(planner.planner_name || planner.name || "")
    setEditStartDate(planner.start_date ? planner.start_date.split('T')[0] : "")
    setEditEndDate(planner.end_date ? planner.end_date.split('T')[0] : "")
    setEditDescription(planner.description || "")
    setEditRepeatEnabled(!!planner.repeat_enabled)
    setEditRepeatIntervalDays(planner.repeat_interval_days || 50)
    setEditEarlyNotificationDays(planner.early_notification_days || 3)
    setEditTeamLeaderId(planner.team_leader_id ? String(planner.team_leader_id) : "")
    // Fetch org users if collaborative planner and not already loaded
    if (planner.collaborative_enabled && orgUsers.length === 0) {
      try {
        const res = await axiosInstance.get("/users/list")
        setOrgUsers(res.data || [])
      } catch {
        // ignore
      }
    }
    setEditDialogOpen(true)
  }

  const handleUpdatePlanner = async () => {
    if (!editPlanner?.id) return
    if (!editPlannerName.trim()) {
      toast({ title: "Error", description: "Planner name is required", variant: "destructive" })
      return
    }
    if (!editStartDate || !editEndDate) {
      toast({ title: "Error", description: "Start and end dates are required", variant: "destructive" })
      return
    }
    if (new Date(editEndDate) < new Date(editStartDate)) {
      toast({ title: "Error", description: "End date must be after start date", variant: "destructive" })
      return
    }
    try {
      setIsUpdating(true)
      const payload: Record<string, any> = {
        planner_name: editPlannerName,
        start_date: editStartDate,
        end_date: editEndDate,
        description: editDescription,
        repeat_enabled: editRepeatEnabled,
        repeat_interval_days: editRepeatIntervalDays,
        early_notification_days: editEarlyNotificationDays,
      }
      // Include team_leader_id if collaborative planner and leader changed
      if (editPlanner.collaborative_enabled && editTeamLeaderId) {
        payload.team_leader_id = parseInt(editTeamLeaderId)
      }
      await axiosInstance.put(`/planner/${editPlanner.id}/update/`, payload)
      toast({ title: "Success", description: "Planner updated successfully" })
      setPlannerHistory(prev => prev.map(p => {
        if (p.id !== editPlanner.id) return p
        return {
          ...p,
          planner_name: editPlannerName,
          name: editPlannerName.trim() || p.form_title || "N/A",
          start_date: editStartDate,
          end_date: editEndDate,
          description: editDescription,
          repeat_enabled: editRepeatEnabled,
          repeat_interval_days: editRepeatIntervalDays,
          early_notification_days: editEarlyNotificationDays,
          team_leader_id: editTeamLeaderId ? parseInt(editTeamLeaderId) : p.team_leader_id,
          team_leader: editTeamLeaderId ? orgUsers.find(u => String(u.id) === editTeamLeaderId)?.username || p.team_leader : p.team_leader,
        }
      }))
      setEditDialogOpen(false)
      setEditPlanner(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update planner",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedPlanners.size === 0) return
    
    try {
      await axiosInstance.post('/planner/bulk-delete/', {
        planner_ids: Array.from(selectedPlanners)
      })
      setPlannerHistory(plannerHistory.filter(p => p.id !== undefined && !selectedPlanners.has(p.id)))
      setSelectedPlanners(new Set())
      setSelectAll(false)
      toast({
        title: "Success",
        description: "Planners deleted successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete planners",
        variant: "destructive",
      })
    }
  }

  const fetchFolders = async () => {
    try {
      const res = await axiosInstance.get("/planner/folders/")
      const sorted = (res.data || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      setFolders(sorted)
    } catch (err) {
      console.error("Failed to fetch folders:", err)
    }
  }

  useEffect(() => {
    fetchFolders()
  }, [])

  const handleFolderMove = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= folders.length) return

    const reordered = [...folders]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    const folderIds = reordered.map((f) => f.id)
    setFolders(reordered.map((f, i) => ({ ...f, order: i })))

    try {
      await axiosInstance.post("/planner/folders/reorder/", { folder_ids: folderIds })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to reorder folders",
        variant: "destructive",
      })
      fetchFolders()
    }
  }

  const handleMoveToFolder = async (folderId: number | null) => {
    if (selectedPlanners.size === 0) return
    try {
      await axiosInstance.post("/planner/move-to-folder/", {
        planner_ids: Array.from(selectedPlanners),
        folder_id: folderId,
      })
      toast({
        title: "Success",
        description: `Moved ${selectedPlanners.size} planner(s) ${folderId ? 'to folder' : 'out of folder'}`,
      })
      setSelectedPlanners(new Set())
      setSelectAll(false)
      setMoveFolderOpen(false)
      onPlannersMoved?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to move planners",
        variant: "destructive",
      })
    }
  }

  const someVisiblePlannersSelected = filteredHistory.some((p) => p.id !== undefined && selectedPlanners.has(p.id)) && !selectAll

  return (
    <div className="w-full space-y-4 flex flex-col min-h-0 flex-1">
      {selectedPlanners.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <span className="text-sm font-medium">
            {selectedPlanners.size} planner{selectedPlanners.size !== 1 ? 's' : ''} selected
          </span>
          <DropdownMenu open={moveFolderOpen} onOpenChange={setMoveFolderOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <FolderInput className="h-4 w-4 mr-2" />
                Move to Folder
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select Folder</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleMoveToFolder(null)}>
                <span className="text-muted-foreground">No Folder</span>
              </DropdownMenuItem>
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onClick={() => handleMoveToFolder(f.id)}>
                  <Folder className="h-4 w-4 mr-2" style={{ color: f.color }} />
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      )}

      <div className="rounded-md border shadow-[0_4px_10px_rgba(0,0,0,0.2)] flex-1 min-h-0 overflow-auto">
        <div>
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 bg-white z-30">
              <TableRow>
                <TableHead className="sticky top-0 z-30 w-[50px] bg-white">
                  <Checkbox
                    checked={someVisiblePlannersSelected ? "indeterminate" : selectAll}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all planners"
                  />
                </TableHead>
                <TableHead className="sticky top-0 z-30 w-[80px] bg-white whitespace-nowrap">Planner ID</TableHead>
                <TableHead className="sticky top-0 z-30 bg-white min-w-[150px]">Planner Name</TableHead>
                <TableHead className="sticky top-0 z-30 bg-white">Status</TableHead>
                <TableHead className="sticky top-0 z-30 bg-white">End Date</TableHead>
                <TableHead className="sticky top-0 z-30 bg-white">Completed By</TableHead>
                <TableHead className="sticky top-0 z-30 bg-white">Assigned To</TableHead>
                <TableHead className="sticky top-0 z-30 bg-white min-w-[100px]">Due Status</TableHead>
                <TableHead className="sticky top-0 z-30 w-[100px] bg-white">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="relative flex justify-center items-center">
                      <GlobalLoader />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredHistory.length === 0 && (folders.length === 0 || folderId != null) ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <span className="text-muted-foreground">No planners found</span>
                  </TableCell>
                </TableRow>
              ) : (
                <>
              {/* Folder rows with up/down reordering - hidden when inside a folder view or searching */}
              {!searchTerm && folderId == null && folders.map((folder, index) => (
                <FolderTableRow
                  key={folder.id}
                  folder={folder}
                  plannerCount={plannerHistory.filter(p => p.folder_id === folder.id).length}
                  canMoveUp={index > 0}
                  canMoveDown={index < folders.length - 1}
                  onMoveUp={() => handleFolderMove(index, "up")}
                  onMoveDown={() => handleFolderMove(index, "down")}
                  onClick={() => router.push(`/planner/folders/${folder.id}`)}
                />
              ))}
              {/* Planner rows */}
              {filteredHistory.map((item) => {
                  const now = new Date()
                  const endDate = item.end_date ? new Date(item.end_date) : null
                  const isOverdue = endDate && endDate < now && item.status !== "Completed"
                  const isPendingReview = item.reason_status === 'pending' && item.non_completion_reason
                  const isRejected = item.reason_status === 'rejected'
                  const needsAction = isPendingReview || isRejected || (isOverdue && item.status !== "Completed")
                  return (
                  <TableRow key={item.id} className={`hover:bg-gray-50 ${needsAction ? 'bg-orange-50/40' : ''}`}>
                    <TableCell>
                      <Checkbox
                        checked={item.id !== undefined && selectedPlanners.has(item.id)}
                        onCheckedChange={() => item.id !== undefined && handleSelectPlanner(item.id)}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground w-[80px] whitespace-nowrap">
                      {item.order_id || `PLN-${item.id}`}
                    </TableCell>
                    <TableCell
                      onClick={() => handleView(item)}
                      className="font-medium cursor-pointer hover:text-blue-600 hover:underline"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {isPendingReview && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300 whitespace-nowrap">Review Needed</Badge>
                          )}
                          {isRejected && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-100 text-red-800 border-red-300 whitespace-nowrap">Awaiting Response</Badge>
                          )}
                          {item.repeat_enabled && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-100 text-purple-800 border-purple-300 whitespace-nowrap" title={`Repeats every ${item.repeat_interval_days || 0} days${item.early_notification_days ? `, notify ${item.early_notification_days} days early` : ''}${item.parent_planner_id ? ', repeated instance' : ''}`}>
                              <Repeat className="h-2.5 w-2.5 mr-0.5" />
                              {item.repeat_interval_days || 0}d
                            </Badge>
                          )}
                          {item.collaborative_enabled && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-100 text-green-800 border-green-300 whitespace-nowrap" title={`Collaborative audit${item.team_leader ? `, Leader: ${item.team_leader}` : ''}`}>
                              <Users className="h-2.5 w-2.5 mr-0.5" />
                              Collab
                            </Badge>
                          )}
                        </div>
                        {(item.date && item.date !== "N/A") && (
                          <span className="text-[10px] text-muted-foreground">Created: {item.date}</span>
                        )}
                        {item.location && (
                          <span className="text-[10px] text-muted-foreground">Loc: {item.location}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusBadgeColor(item.status)}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.end_date ? item.end_date.split('T')[0] : 'N/A'}</span>
                        <span className="mt-1">{(() => {
                          if (!item.end_date) return <span className="text-muted-foreground">-</span>
                          const end = parseISO(item.end_date)
                          const daysLeft = differenceInCalendarDays(end, new Date())
                          if (item.status === "Completed") {
                            return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Completed</Badge>
                          }
                          if (daysLeft < 0) {
                            const overdue = Math.abs(daysLeft)
                            return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">{overdue} day{overdue !== 1 ? 's' : ''} overdue</Badge>
                          }
                          if (daysLeft === 0) {
                            return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Due today</Badge>
                          }
                          let badgeClass = "bg-green-100 text-green-800 border-green-300"
                          if (daysLeft <= 7 && daysLeft > 3) badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-300"
                          if (daysLeft <= 3) badgeClass = "bg-red-100 text-red-800 border-red-300"
                          return <Badge variant="outline" className={badgeClass}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</Badge>
                        })()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.completed_by || '-'}</span>
                        {item.completed_on && (
                          <span className="text-[10px] text-muted-foreground">{new Date(item.completed_on).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {typeof item.assignee_count === "number" && item.assignee_count > 1 ? (
                          <>
                            <Badge variant="secondary" className="text-xs w-fit">{item.assignee_count} assignees</Badge>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {item.not_started_count} not started, {item.in_progress_count} in progress, {item.completed_count} done
                            </span>
                          </>
                        ) : (
                          <>
                            <span>{item.user || item.group || item.leader || '-'}</span>
                            {item.user && <span className="text-[10px] text-muted-foreground">User</span>}
                            {item.group && <span className="text-[10px] text-muted-foreground">Group</span>}
                            {item.leader && <span className="text-[10px] text-muted-foreground">Leader</span>}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[100px]">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          if (item.status === "Completed") {
                            return <span title="Completed"><CheckCircle2 className="h-4 w-4 text-green-600" /></span>
                          }
                          if (!item.end_date) {
                            return <span title="No due date"><Clock className="h-4 w-4 text-gray-400" /></span>
                          }
                          const end = parseISO(item.end_date)
                          const daysLeft = differenceInCalendarDays(end, new Date())
                          const isOverdue = daysLeft < 0
                          const hasReason = !!item.non_completion_reason
                          const isExtended = !!item.extended_due_date && item.reason_status === 'approved'
                          const isRejected = item.reason_status === 'rejected' && !!item.rejection_reason

                          if (!isOverdue) {
                            return <span title={`On track - ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}><Clock className="h-4 w-4 text-gray-400" /></span>
                          }

                          const overdueDays = Math.abs(daysLeft)
                          const warningTitle = isExtended
                            ? `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''} - Due date extended`
                            : isRejected
                            ? `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''} - Reason rejected, awaiting new reason`
                            : `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''} - No reason provided`

                          return (
                            <>
                              <span title={warningTitle}>
                                <AlertTriangle className={`h-4 w-4 ${isExtended ? "text-orange-500" : "text-red-600"}`} />
                              </span>
                              {hasReason && (
                                <button
                                  onClick={() => {
                                    setExtendPlanner(item)
                                    setExtendDate("")
                                    setExtendNote("")
                                    setRejectReason("")
                                    setRejectionQuestions([])
                                    setReviewMode("initial")
                                    setExtendDialogOpen(true)
                                  }}
                                  title={`Reason: "${item.non_completion_reason}" - Status: ${item.reason_status || 'pending'}${item.reason_status === 'rejected' ? ' (Rejected)' : ''} - Click to review`}
                                >
                                  <Info className="h-4 w-4 text-blue-600 hover:text-blue-800" />
                                </button>
                              )}
                              {isRejected && !hasReason && (
                                <span title={`Reason rejected: "${item.rejection_reason}" - Awaiting user's new reason`}>
                                  <Info className="h-4 w-4 text-red-600" />
                                </span>
                              )}
                              {isExtended && (
                                <span title={`Extended to ${item.extended_due_date?.split('T')[0]}${item.extension_note ? ' - Note: ' + item.extension_note : ''}`}>
                                  <CalendarClock className="h-4 w-4 text-green-600" />
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleView(item)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={item.status !== "Not Started"}
                            onClick={() => item.id !== undefined && handleDelete(item.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })
              }
                </>
              )}
            </TableBody>
          </table>
        </div>
      </div>
      {selectedPlanner && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{selectedPlanner.name}</DialogTitle>
      <DialogDescription>
        Planner ID: {selectedPlanner.id}{selectedPlanner.order_id ? ` • Order: ${selectedPlanner.order_id}` : ""}
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-2"> {/* Reduced from space-y-4 */}

      {/* Planner Details Section */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <h4 className="text-sm font-medium mb-2">Planner Details</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <span className="text-muted-foreground">Form: </span>
            <span className="font-medium">{selectedPlanner.form_title || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Form Type: </span>
            <span className="font-medium">{selectedPlanner.form_type || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Location: </span>
            <span className="font-medium">{selectedPlanner.location || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Start Date: </span>
            <span className="font-medium">{selectedPlanner.start_date ? selectedPlanner.start_date.split("T")[0] : "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">End Date: </span>
            <span className="font-medium">{selectedPlanner.end_date ? selectedPlanner.end_date.split("T")[0] : "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Assign Type: </span>
            <span className="font-medium">{selectedPlanner.assign_type || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Assigned To: </span>
            <span className="font-medium">
              {selectedPlanner.user || selectedPlanner.group || selectedPlanner.leader || "Unassigned"}
            </span>
          </div>
          {selectedPlanner.group && selectedPlanner.group_members && selectedPlanner.group_members.length > 0 && (
            <div className="col-span-2 md:col-span-3">
              <span className="text-muted-foreground">Group Members: </span>
              <span className="font-medium">{selectedPlanner.group_members.join(", ")}</span>
            </div>
          )}
          {selectedPlanner.collaborative_enabled && (
            <div>
              <span className="text-muted-foreground">Collaborative: </span>
              <span className="font-medium text-green-700">Yes</span>
            </div>
          )}
          {selectedPlanner.team_leader && (
            <div>
              <span className="text-muted-foreground">Team Leader: </span>
              <span className="font-medium">{selectedPlanner.team_leader}</span>
            </div>
          )}
          {selectedPlanner.repeat_enabled && (
            <div>
              <span className="text-muted-foreground">Repeat: </span>
              <span className="font-medium">Every {selectedPlanner.repeat_interval_days || "?"} days</span>
            </div>
          )}
          {selectedPlanner.early_notification_days != null && selectedPlanner.early_notification_days > 0 && (
            <div>
              <span className="text-muted-foreground">Early Notification: </span>
              <span className="font-medium">{selectedPlanner.early_notification_days} days</span>
            </div>
          )}
          {selectedPlanner.folder_name && (
            <div>
              <span className="text-muted-foreground">Folder: </span>
              <span className="font-medium">{selectedPlanner.folder_name}</span>
            </div>
          )}
          {selectedPlanner.parent_planner_id && (
            <div>
              <span className="text-muted-foreground">Parent Planner ID: </span>
              <span className="font-medium">{selectedPlanner.parent_planner_id}</span>
            </div>
          )}
          {selectedPlanner.extended_due_date && (
            <div>
              <span className="text-muted-foreground">Extended Due Date: </span>
              <span className="font-medium">{selectedPlanner.extended_due_date.split("T")[0]}</span>
            </div>
          )}
        </div>
        {selectedPlanner.description && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">Description: </span>
            <span>{selectedPlanner.description}</span>
          </div>
        )}
      </div>

      {/* Collaborative Groups Section */}
      {selectedPlanner.collaborative_enabled && selectedPlanner.collaborative_groups && selectedPlanner.collaborative_groups.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Collaborative Audit Groups</h4>
            <span className="text-xs text-muted-foreground">
              {selectedPlanner.collaborative_groups.filter((g: any) => g.status === "submitted" || g.status === "reviewed").length}
              {" / "}{selectedPlanner.collaborative_groups.length} groups completed
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Group</TableHead>
                <TableHead className="text-xs">Assigned To</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Questions</TableHead>
                <TableHead className="text-xs">Progress</TableHead>
                <TableHead className="text-xs">Submitted By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedPlanner.collaborative_groups.map((g: any, i: number) => {
                const statusColors: Record<string, string> = {
                  unassigned: "bg-gray-100 text-gray-700",
                  assigned: "bg-blue-100 text-blue-700",
                  in_progress: "bg-purple-100 text-purple-700",
                  submitted: "bg-amber-100 text-amber-700",
                  reviewed: "bg-green-100 text-green-700",
                  rejected: "bg-red-100 text-red-700",
                };
                const statusColor = statusColors[g.status] || "bg-gray-100 text-gray-700";
                const statusLabel = g.status?.replace(/_/g, " ").toUpperCase();
                return (
                  <TableRow key={i} className="h-8">
                    <TableCell className="text-xs font-medium">
                      {g.audit_group_name || `Group ${g.group_order}`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.assigned_user_names && g.assigned_user_names.length > 0
                        ? g.assigned_user_names.join(", ")
                        : "Unassigned"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.answered_count}/{g.total_questions}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${g.progress_percentage}%`,
                              backgroundColor: g.progress_percentage === 100 ? "#22c55e" : "#3b82f6",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{g.progress_percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.submitted_by_name ? (
                        <span>{g.submitted_by_name}</span>
                      ) : g.rejection_comment ? (
                        <span className="text-red-600" title={g.rejection_comment}>Rejected</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-1"> {/* Reduced spacing */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Assignment Details</h4>

          <div className="flex gap-3 text-xs pr-4"> {/* Smaller text + tighter gap */}
            <div>
              <span className="text-muted-foreground">Count: </span>
              <span>{selectedPlanner.assignee_count}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Not Started: </span>
              <span>{notStartedCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">In Progress: </span>
              <span>{inProgressCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Completed: </span>
              <span>{completedCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Not Assigned: </span>
              <span>{notAssignedCount}</span>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>

            {/* Filter Row */}
            <TableRow><TableHead>Task</TableHead><TableHead>Location</TableHead><TableHead>Assigned To</TableHead><TableHead>Status</TableHead></TableRow>
            <TableRow className="bg-gray-50 border-b border-blue-100 h-7"><TableCell>
                <input
                  type="text"
                  placeholder="Task"
                  className="h-5 text-[11px] bg-white border border-gray-200 focus:border-blue-400 rounded px-1 w-full"
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value)}
                />
              </TableCell><TableCell>
                <input
                  type="text"
                  placeholder="Location"
                  className="h-5 text-[11px] bg-white border border-gray-200 focus:border-blue-400 rounded px-1 w-full"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </TableCell><TableCell>
                <input
                  type="text"
                  placeholder="Assigned To"
                  className="h-5 text-[11px] bg-white border border-gray-200 focus:border-blue-400 rounded px-1 w-full"
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                />
              </TableCell><TableCell>
                <select
                  className="h-5 text-[11px] bg-white border border-gray-200 focus:border-blue-400 rounded px-1 w-full"
                  value={assigneeStatusFilter}
                  onChange={(e) => setAssigneeStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Not Assigned">Not Assigned</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </TableCell></TableRow>

          </TableHeader>

          <TableBody>
            {currentItems.map((assignee, i) => (
              <TableRow key={startIndex + i} className="h-7"><TableCell className="text-xs cursor-pointer hover:underline " onClick={() => router.push(`/tasks/${assignee?.task_id}`)} >{assignee.task_name}</TableCell><TableCell className="text-xs">{assignee.assignee_location}</TableCell><TableCell className="text-xs">{assignee.assignee}</TableCell><TableCell className="text-xs">{getBadgeColor(assignee.status)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-2 text-xs">
            <div className="text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredAssignees.length)} of {filteredAssignees.length} assignees
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
        Close
      </Button>
      <Button>
        <Download className="h-4 w-4 mr-1" />
        Export Details
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      )}

      {editPlanner && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Planner</DialogTitle>
              <DialogDescription>
                Update planner name, dates and description.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="planner-name">Planner Name</Label>
                <Input
                  id="planner-name"
                  value={editPlannerName}
                  onChange={(e) => setEditPlannerName(e.target.value)}
                  placeholder="Enter planner name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              {/* Repeat Planner Settings */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="edit-repeat-enabled"
                    checked={editRepeatEnabled}
                    onCheckedChange={(checked) => setEditRepeatEnabled(checked === true)}
                  />
                  <Label htmlFor="edit-repeat-enabled" className="text-sm font-medium cursor-pointer">
                    Enable Repeat Planner
                  </Label>
                </div>
                {editRepeatEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Repeat Interval (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editRepeatIntervalDays}
                        onChange={(e) => setEditRepeatIntervalDays(Math.max(1, parseInt(e.target.value) || 0))}
                        placeholder="e.g., 50 or 100"
                        className="bg-white"
                      />
                      <p className="text-xs text-muted-foreground">Planner will auto-reassign to the same users every N days</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Early Notification (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editEarlyNotificationDays}
                        onChange={(e) => setEditEarlyNotificationDays(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="e.g., 3"
                        className="bg-white"
                      />
                      <p className="text-xs text-muted-foreground">Users will see the planner N days before the start date</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Team Leader selector for collaborative planners */}
              {editPlanner.collaborative_enabled && (
                <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-green-700" />
                    <Label className="text-sm font-medium text-green-800">
                      Collaborative Audit — Team Leader
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Change the Team Leader if the current one is unavailable. The new leader will be able to delegate audit groups to team members.
                  </p>
                  <select
                    className="w-full rounded-md border border-green-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={editTeamLeaderId}
                    onChange={(e) => setEditTeamLeaderId(e.target.value)}
                  >
                    <option value="">Select a Team Leader...</option>
                    {orgUsers.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {((u.first_name || "") + " " + (u.last_name || "")).trim() || u.username}
                      </option>
                    ))}
                  </select>
                  {editPlanner.team_leader && !editTeamLeaderId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Current leader: <span className="font-medium">{editPlanner.team_leader}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePlanner} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Review Reason Dialog - Approve (Extend) or Reject */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Non-Completion Reason</DialogTitle>
            <DialogDescription>
              Approve by extending the due date, or reject and ask the user for a new reason.
            </DialogDescription>
          </DialogHeader>
          {extendPlanner && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Planner</Label>
                <p className="text-sm font-medium">{extendPlanner.name} (#{extendPlanner.id})</p>
              </div>
              {extendPlanner.non_completion_reason && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">User's Reason</Label>
                  <div className="bg-muted rounded-md p-3 text-sm text-muted-foreground">
                    {extendPlanner.non_completion_reason}
                  </div>
                  {extendPlanner.reason_status && extendPlanner.reason_status !== 'pending' && (
                    <Badge variant="outline" className={`mt-1 ${extendPlanner.reason_status === 'approved' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                      {extendPlanner.reason_status === 'approved' ? 'Approved' : 'Rejected'}
                    </Badge>
                  )}
                </div>
              )}

              {/* Display rejection questions and user's answers */}
              {extendPlanner.rejection_questions && extendPlanner.rejection_questions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Questions & User's Answers</Label>
                  <div className="space-y-2">
                    {extendPlanner.rejection_questions.map((q: any, qIdx: number) => {
                      const answerObj = (extendPlanner.rejection_answers || []).find((a: any) => a.question_id === q.id)
                      const answer = answerObj?.answer || "No answer provided"
                      const isImage = q.type === "file_upload" && answer && answer.startsWith("http")
                      const isVideo = q.type === "video_upload" && answer && answer.startsWith("http")
                      return (
                        <div key={q.id} className="border rounded-md p-3 bg-muted/30 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-600">Q{qIdx + 1}.</span>
                            <span className="text-sm font-medium">{q.title}</span>
                            {q.required && <span className="text-red-500 text-xs">*</span>}
                          </div>
                          <div className="text-xs text-gray-500 italic">
                            Type: {q.type.replace(/_/g, " ")}
                          </div>
                          <div className="text-sm mt-1">
                            {isImage ? (
                              <a href={answer} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                <img src={answer} alt="Uploaded" className="w-16 h-16 object-cover rounded border" />
                                <span className="text-xs">View Image</span>
                              </a>
                            ) : isVideo ? (
                              <a href={answer} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                <span className="text-xs">View Video</span>
                              </a>
                            ) : (
                              <span className="text-gray-700">{answer}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {extendPlanner.extended_due_date && extendPlanner.reason_status === 'approved' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Already Extended To</Label>
                  <p className="text-sm">{extendPlanner.extended_due_date.split('T')[0]}</p>
                  {extendPlanner.extension_note && (
                    <p className="text-xs text-muted-foreground italic">"{extendPlanner.extension_note}"</p>
                  )}
                </div>
              )}

              {/* Approval Flow History Timeline */}
              {extendPlanner.reason_history && extendPlanner.reason_history.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-sm font-semibold">Approval Flow History</Label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {extendPlanner.reason_history.map((h: any, hIdx: number) => {
                      const isSubmitted = h.action === 'submitted'
                      const isRejected = h.action === 'rejected'
                      const isApproved = h.action === 'approved'
                      const dateStr = h.acted_on ? new Date(h.acted_on).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''
                      return (
                        <div key={h.id || hIdx} className={`rounded-md border p-3 text-sm ${isSubmitted ? 'bg-blue-50 border-blue-200' : isRejected ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${isSubmitted ? 'bg-blue-100 text-blue-800 border-blue-300' : isRejected ? 'bg-red-100 text-red-800 border-red-300' : 'bg-green-100 text-green-800 border-green-300'}`}>
                                {isSubmitted ? 'Submitted' : isRejected ? 'Rejected' : 'Approved'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Cycle {h.cycle_number}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{dateStr}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">By: {h.acted_by || 'Unknown'}</div>
                          {isSubmitted && h.non_completion_reason && (
                            <div className="mt-1">
                              <span className="text-xs font-medium text-gray-600">Reason: </span>
                              <span className="text-xs text-gray-700">{h.non_completion_reason}</span>
                            </div>
                          )}
                          {isSubmitted && h.rejection_answers && h.rejection_answers.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {h.rejection_answers.map((a: any, aIdx: number) => (
                                <div key={aIdx} className="text-xs">
                                  <span className="font-medium text-gray-600">{a.question_title}: </span>
                                  <span className="text-gray-700">
                                    {a.answer && a.answer.startsWith('http') ? (
                                      <a href={a.answer} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Upload</a>
                                    ) : a.answer || 'No answer'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {isRejected && h.rejection_reason && (
                            <div className="mt-1">
                              <span className="text-xs font-medium text-gray-600">Rejection Reason: </span>
                              <span className="text-xs text-gray-700">{h.rejection_reason}</span>
                            </div>
                          )}
                          {isRejected && h.rejection_questions && h.rejection_questions.length > 0 && (
                            <div className="mt-1 space-y-1">
                              <span className="text-xs font-medium text-gray-600">Questions Asked:</span>
                              {h.rejection_questions.map((q: any, qIdx: number) => (
                                <div key={qIdx} className="text-xs text-gray-700 pl-2">
                                  {qIdx + 1}. {q.title} ({q.type})
                                </div>
                              ))}
                            </div>
                          )}
                          {isApproved && h.extended_due_date && (
                            <div className="mt-1">
                              <span className="text-xs font-medium text-gray-600">Extended To: </span>
                              <span className="text-xs text-gray-700">{h.extended_due_date.split('T')[0]}</span>
                            </div>
                          )}
                          {isApproved && h.extension_note && (
                            <div className="mt-1">
                              <span className="text-xs font-medium text-gray-600">Note: </span>
                              <span className="text-xs text-gray-700 italic">"{h.extension_note}"</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action selection - initial mode */}
              {reviewMode === "initial" && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-sm font-semibold">Review Action</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 flex-1"
                      onClick={() => setReviewMode("approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setReviewMode("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Approve section - only after clicking Approve */}
              {reviewMode === "approve" && (
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-green-700">Approve & Extend Due Date</Label>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReviewMode("initial")}>
                      Back
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="extend-date" className="text-xs">New Due Date</Label>
                      <Input
                        id="extend-date"
                        type="date"
                        value={extendDate}
                        onChange={(e) => setExtendDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="extend-note" className="text-xs">Note to User</Label>
                      <Textarea
                        id="extend-note"
                        value={extendNote}
                        onChange={(e) => setExtendNote(e.target.value)}
                        placeholder="Enter a note for the user..."
                        rows={2}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isExtending || isRejecting}
                      onClick={async () => {
                        if (!extendDate || !extendNote.trim()) {
                          toast({ title: "Error", description: "Date and note are required to approve", variant: "destructive" })
                          return
                        }
                        if (!extendPlanner?.id) return
                        setIsExtending(true)
                        try {
                          await axiosInstance.post(`/planner/${extendPlanner.id}/extend-due-date/`, {
                            extended_due_date: extendDate,
                            extension_note: extendNote.trim(),
                          })
                          toast({ title: "Success", description: "Due date extended successfully" })
                          setExtendDialogOpen(false)
                          setExtendPlanner(null)
                          setExtendDate("")
                          setExtendNote("")
                          setRejectReason("")
                          setRejectionQuestions([])
                          setReviewMode("initial")
                          fetchPlannerHistory()
                        } catch (error: any) {
                          toast({ title: "Error", description: error?.response?.data?.error || "Failed to extend due date", variant: "destructive" })
                        } finally {
                          setIsExtending(false)
                        }
                      }}
                    >
                      {isExtending ? "Approving..." : "Approve & Extend"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Reject section - only after clicking Reject */}
              {reviewMode === "reject" && (
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-red-700">Reject & Ask for New Reason</Label>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReviewMode("initial")}>
                      Back
                    </Button>
                  </div>

                  {/* Question Builder */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Questions for User</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setRejectionQuestions([...rejectionQuestions, {
                            id: `q${Date.now()}`,
                            type: "short_answer",
                            title: "",
                            options: [],
                            required: false,
                          }])
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Question
                      </Button>
                    </div>

                    {rejectionQuestions.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No questions added. User will only see the rejection notice.</p>
                    )}

                    {rejectionQuestions.map((q, qIdx) => (
                      <div key={q.id} className="border rounded-md p-2 space-y-2 bg-muted/30">
                        <div className="flex items-start gap-2">
                          <Select
                            value={q.type}
                            onValueChange={(val) => {
                              const updated = [...rejectionQuestions]
                              updated[qIdx] = { ...q, type: val, options: (val === "multiple_choice" || val === "checkboxes" || val === "dropdown") ? (q.options || []) : [] }
                              setRejectionQuestions(updated)
                            }}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="short_answer">Short Answer</SelectItem>
                              <SelectItem value="long_answer">Long Answer</SelectItem>
                              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                              <SelectItem value="checkboxes">Checkboxes</SelectItem>
                              <SelectItem value="dropdown">Dropdown</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="rating">Rating</SelectItem>
                              <SelectItem value="file_upload">Upload Image</SelectItem>
                              <SelectItem value="video_upload">Upload Video</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 text-xs flex-1"
                            placeholder="Question title..."
                            value={q.title}
                            onChange={(e) => {
                              const updated = [...rejectionQuestions]
                              updated[qIdx] = { ...q, title: e.target.value }
                              setRejectionQuestions(updated)
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setRejectionQuestions(rejectionQuestions.filter((_, i) => i !== qIdx))
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Options for choice-based questions */}
                        {(q.type === "multiple_choice" || q.type === "checkboxes" || q.type === "dropdown") && (
                          <div className="space-y-1 pl-1">
                            {(q.options || []).map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="flex items-center gap-1">
                                <Input
                                  className="h-7 text-xs flex-1"
                                  placeholder={`Option ${oIdx + 1}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...rejectionQuestions]
                                    const newOpts = [...(q.options || [])]
                                    newOpts[oIdx] = e.target.value
                                    updated[qIdx] = { ...q, options: newOpts }
                                    setRejectionQuestions(updated)
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => {
                                    const updated = [...rejectionQuestions]
                                    const newOpts = (q.options || []).filter((_: string, i: number) => i !== oIdx)
                                    updated[qIdx] = { ...q, options: newOpts }
                                    setRejectionQuestions(updated)
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => {
                                const updated = [...rejectionQuestions]
                                updated[qIdx] = { ...q, options: [...(q.options || []), ""] }
                                setRejectionQuestions(updated)
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add Option
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={q.required}
                            onCheckedChange={(checked) => {
                              const updated = [...rejectionQuestions]
                              updated[qIdx] = { ...q, required: checked === true }
                              setRejectionQuestions(updated)
                            }}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isExtending || isRejecting}
                    onClick={async () => {
                      const invalidQuestions = rejectionQuestions.filter(q => !q.title?.trim())
                      if (invalidQuestions.length > 0) {
                        toast({ title: "Error", description: "All questions must have a title", variant: "destructive" })
                        return
                      }
                      if (!extendPlanner?.id) return
                      setIsRejecting(true)
                      try {
                        await axiosInstance.post(`/planner/${extendPlanner.id}/reject-reason/`, {
                          rejection_reason: "Reason rejected. Please answer the following questions.",
                          rejection_questions: rejectionQuestions,
                        })
                        toast({ title: "Success", description: "Reason rejected. User will be asked to answer the questions." })
                        setExtendDialogOpen(false)
                        setExtendPlanner(null)
                        setExtendDate("")
                        setExtendNote("")
                        setRejectReason("")
                        setRejectionQuestions([])
                        setReviewMode("initial")
                        fetchPlannerHistory()
                      } catch (error: any) {
                        toast({ title: "Error", description: error?.response?.data?.error || "Failed to reject reason", variant: "destructive" })
                      } finally {
                        setIsRejecting(false)
                      }
                    }}
                  >
                    {isRejecting ? "Rejecting..." : "Reject & Send Questions"}
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)} disabled={isExtending || isRejecting}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>
  )
}
