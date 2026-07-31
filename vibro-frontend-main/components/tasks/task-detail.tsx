"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, addDays } from "date-fns"
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Share2,
  Trash2,
  Users,
  BarChart4,
  PieChart,
  ArrowLeft,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import type { Task } from "@/data/tasks"
import { updateTask, deleteTask } from "@/data/tasks"
import axiosInstance from "@/utils/axiosInstance"
import { TaskTimeline } from "@/components/TaskTimeline"
import { showWarningToast } from "@/utils/hotToastsUtils"
import hotToaster from "react-hot-toast";
import { useModuleAccess } from "@/hooks/useModuleAccess"


interface TaskLog {
  id: number
  task: number
  task_name: string
  task_action: string
  action_by: string
  action_by_name: string
  action_to: string | null
  action_to_name: string | null
  action_date_time: string
  form_name?: string
}

interface TaskDetailProps {
  task: Task
}

export function TaskDetail({ task }: TaskDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isFullAccess } = useModuleAccess("tasks")
  const canEdit = isFullAccess
  const [activeTab, setActiveTab] = useState("details")

  const [logs, setLogs] = useState<TaskLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [status, setStatus] = useState(task.status)
  const [inCharge, setInCharge] = useState(task.incharge)
  const [dueDate, setDueDate] = useState(task.dueDate)
  const [extendDate, setExtendDate] = useState<Date | undefined>(undefined)
  const [reassignTo, setReassignTo] = useState("")
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)
  const [isReopening, setIsReopening] = useState(false)
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: number, first_name: string, last_name: string } | null>(null)
  const today = new Date().toISOString().split('T')[0];
  const isDueToday = task.dueDate === today;

  // Check if we should open a specific tab or dialog based on URL params
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "report") {
      setActiveTab("report")
      return
    }
    if (tab === "activity") {
      setActiveTab("activity")
      return
    }

    if (!canEdit) return

    if (tab === "extend") {
      setShowExtendDialog(true)
    } else if (tab === "mark_complete") {
      setShowCompleteDialog(true)
    } else if (tab === "reassign") {
      setShowReassignDialog(true)
    }
  }, [searchParams, canEdit])

  // Reset selected user when reassign dialog closes
  useEffect(() => {
    if (!showReassignDialog) {
      setSelectedUser(null)
    }
  }, [showReassignDialog])

  // Fetch users for reassign dialog
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setUsersLoading(true)
        const response = await axiosInstance.get("/users/list")
        setUsers(response.data)
      } catch (error) {
        console.error("Error fetching users:", error)
      } finally {
        setUsersLoading(false)
      }
    }

    fetchUsers()
  }, [])

  // Fetch task logs
  useEffect(() => {
    fetchLogs()
  }, [task.id])

  // Set extend date to current due date when dialog opens
  useEffect(() => {
    if (showExtendDialog) {
      setExtendDate(task.dueDate ? new Date(task.dueDate) : undefined)
    }
  }, [showExtendDialog, task.dueDate])

  const fetchLogs = async () => {
    try {
      setLogsLoading(true)
      const response = await axiosInstance.get(`/task-audit-logs/${task.id}/`);
      const data = response.data;
      setLogs(data)
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLogsLoading(false)
    }
  }

  const getStatusBadge = (status: Task["status"]) => {
    switch (status) {
      case "Not Assigned":
        return <Badge className="bg-gray-200 text-blue-800 border-gray-300">Not Assigned</Badge>
      case "Not Started":
        return <Badge className="bg-gray-200 text-gray-800 border-gray-300">Not Started</Badge>
      case "In Progress":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">In Progress</Badge>
      case "Completed":
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>
            {task.isAutoClosed && (
              <Badge className="bg-red-100 text-red-700 border-red-300">Auto-Closed</Badge>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const handleMarkComplete = async () => {
    if (!canEdit) {
      hotToaster.error("You have view-only access. This action is disabled.", { duration: 2000 })
      return
    }
    setIsCompleting(true)
    try {
      const response = await axiosInstance.patch(`/tasks/${task.id}/mark_complete/`,
        { complete: true })

      const today = new Date().toISOString().split("T")[0]
      updateTask(task.id, {
        status: "Completed",
        actualEnd: today,
      })
      setStatus("Completed")
      setShowCompleteDialog(false)
      hotToaster.success("Task marked as completed.", { duration: 2000 });
      router.refresh()
    } catch (error) {
      console.error("Error completing task:", error)
      hotToaster.error("Unable to mark the task as completed.", { duration: 3000 });
    } finally {
      fetchLogs();
      setIsCompleting(false)
    }
  }

  const handleDelete = async () => {
    if (!canEdit) {
      hotToaster.error("You have view-only access. Deleting is disabled.", { duration: 2000 })
      return
    }
    setIsDeleting(true)
    try {
      await axiosInstance.delete(`/tasks/${task.id}/`)

      deleteTask(task.id)

      hotToaster.success("Task deleted", { duration: 2000 })

      router.push("/tasks")
      router.refresh()
    } catch (error) {
      console.error("Error deleting task:", error)
      hotToaster.error("Failed to delete the task. Please try again.", { duration: 3000 })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExtendDueDate = async () => {
    if (!canEdit) {
      hotToaster.error("You have view-only access. This action is disabled.", { duration: 2000 })
      return
    }
    if (!extendDate) return

    setIsExtending(true)
    try {
      const response = await axiosInstance.patch(`/tasks/${task.id}/extend_due_date/`, {
        end_date: extendDate.toISOString()
      })

      const newDueDate = format(extendDate, "yyyy-MM-dd")
      setDueDate(newDueDate)
      updateTask(task.id, { dueDate: newDueDate })

      hotToaster.success(`Due date extended: The due date has been extended to ${format(extendDate, "PPP")}.`, { duration: 2000 });

      setShowExtendDialog(false)
    } catch (error) {
      console.error("Error extending due date:", error)
      hotToaster.error("Failed to extend the due date. Please try again.", { duration: 3000 })
    } finally {
      fetchLogs();
      setIsExtending(false)
    }
  }

  const handleReassign = async () => {
    if (!canEdit) {
      hotToaster.error("You have view-only access. This action is disabled.", { duration: 2000 })
      return
    }
    if (!selectedUser) return

    setIsReassigning(true)
    try {
      const response = await axiosInstance.patch(`/task-assignees/${parseInt(task.id)}/`,
        {
          assigned_user: selectedUser.id
        })
      console.log("Reassign response:", response.data)

      const newInCharge = `${selectedUser.first_name} ${selectedUser.last_name}`
      setInCharge(newInCharge)
      updateTask(task.id, { incharge: newInCharge })
      hotToaster.success(`Task reassigned to ${newInCharge}.`, { duration: 2000 });
      setShowReassignDialog(false)

      setSelectedUser(null)

    } catch (error) {
      console.error("Error reassigning task:", error)
      showWarningToast("Failed to reassign the task. Please try again.", "error")
    } finally {
      fetchLogs();
      setIsReassigning(false)
    }
  }


  const handleReopenTask = () => {
    if (!canEdit) {
      hotToaster.error("You have view-only access. This action is disabled.", { duration: 2000 })
      return
    }
    if (status !== "Completed") return
    router.push(`/tasks/${task.id}/edit?mode=reopen`)
  }

  const handleShare = () => {
    if (!canEdit) {
      hotToaster.error("You have view-only access. Sharing is disabled.", { duration: 2000 })
      return
    }
    router.push(`/tasks/share?taskId=${task.id}`);
  }

  const handleExport = (format: string) => {
    toast({
      title: "Export started",
      description: `Exporting task report as ${format.toUpperCase()}...`,
    })

    // Simulate download delay
    setTimeout(() => {
      toast({
        title: "Export complete",
        description: `Task report has been exported as ${format.toUpperCase()}.`,
      })
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">Task ID: {task.id}</p>
            {task.isBulkImported && (
              <Badge className="bg-cyan-100 text-cyan-800 border border-cyan-300 text-[10px]">Imported</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/tasks/${task.id}/edit`)} disabled={status === "Completed"}>
              <FileText className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}
          {canEdit && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Task</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this task? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { }}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  <div className="mt-1">{getStatusBadge(status)}</div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Incharge</h3>
                  <p className="mt-1">{inCharge}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Start Date</h3>
                  <p className="mt-1">{task.startDate}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Due Date</h3>
                  <p className={`mt-1 ${isDueToday ? 'text-red-500' : ''}`}>{dueDate}</p>
                </div>
                {task.actualEnd && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Actual End Date</h3>
                    <p className="mt-1">{task.actualEnd}</p>
                  </div>
                )}
                {task.createdBy && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Created By :</h3>
                    <div className="p-2  flex items-center gap-3 mt-1">
                      {/* Avatar with initials */}
                      <div className="w-9 h-9 rounded-full bg-blue-300 flex items-center justify-center text-blue-700 font-normal text-lg">
                        {task.createdBy
                          ?.split(" ")
                          .map(word => word[0])
                          .join("")
                          .toUpperCase()}
                      </div>

                      {/* Text */}
                      <div>
                        <h3 className="text-md font-normal text-gray-800">
                          {task.createdBy}
                        </h3>
                        <p className="capitalize text-gray-500 text-md font-normal">{task.createdByDesignation}</p>
                      </div>
                    </div>
                  </div>
                )}
                {task.createdOn && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Created On</h3>
                    <p className="mt-1">{task.createdOn}</p>
                  </div>
                )}
                {task.linkedForm && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Assigned Form</h3>
                    <button
                      className="mt-1 underline text-left flex items-center gap-1"
                      onClick={() => router.push(`/forms/${task.formid}`)}
                    >
                      {task.linkedForm}
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {task.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                  <p className="mt-1 whitespace-pre-line">{task.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2 ">
                  <CardTitle className="text-base">Mark as Complete</CardTitle>
                  <CardDescription>Update the task status</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowCompleteDialog(true)}
                    disabled={status === "Completed" || isCompleting}
                    className="w-full"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Complete
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Extend Due Date</CardTitle>
                  <CardDescription>Change the deadline</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setShowExtendDialog(true)} className="w-full" disabled={status === "Completed"}>
                    <Clock className="mr-2 h-4 w-4" />
                    Extend Due Date
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {status === "Completed" ? "Reopen Task" : "Reassign Task"}
                  </CardTitle>
                  <CardDescription>
                    {status === "Completed" ? "Reopen this completed task" : "Change person in charge"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => status === "Completed" ? handleReopenTask() : setShowReassignDialog(true)}
                    className="w-full"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {status === "Completed" ? "Reopen" : "Reassign"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Task Activity</CardTitle>
              <CardDescription>View the timeline of task actions and updates</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">Loading activity...</div>
              ) : logsError ? (
                <div className="text-center py-8 text-red-500">{logsError}</div>
              ) : (
                <TaskTimeline logs={logs} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>Task Report</CardTitle>
              <CardDescription>View task completion statistics and export reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Completion Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md">
                      <div className="flex flex-col items-center">
                        <PieChart className="h-16 w-16 text-primary mb-2" />
                        <p className="text-muted-foreground">Status chart will appear here</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md">
                      <div className="flex flex-col items-center">
                        <BarChart4 className="h-16 w-16 text-primary mb-2" />
                        <p className="text-muted-foreground">Timeline chart will appear here</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Extend Due Date Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Due Date</DialogTitle>
            <DialogDescription>Select a new due date for this task.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !extendDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {extendDate ? format(extendDate, "PPP") : <span>Pick a new date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={extendDate}
                  onSelect={setExtendDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendDueDate} disabled={!extendDate || isExtending}>
              {isExtending ? "Extending..." : "Extend Due Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Task Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
            <DialogDescription>Select a new person to be in charge of this task.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {usersLoading ? (
              <div className="flex items-center justify-center h-16">
                <span className="text-gray-500">Loading users...</span>
              </div>
            ) : (
              <Select onValueChange={(value) => {
                const user = users.find(u => u.id.toString() === value)
                if (user) {
                  setSelectedUser(user)
                }
              }} value={selectedUser?.id.toString()}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new assignee">
                    {selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : "Select new assignee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-52 overflow-y-auto">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.first_name} {user.last_name} - {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={!selectedUser || isReassigning}>
              {isReassigning ? "Reassigning..." : "Reassign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Complete Confirmation Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Task as Complete</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this task as completed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkComplete} disabled={isCompleting}>
              {isCompleting ? "Marking Complete..." : "Mark Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
