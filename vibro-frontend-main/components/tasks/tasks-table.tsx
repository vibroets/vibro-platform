"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Edit, Trash, BarChart, Share, Clock, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import axiosInstance from "@/utils/axiosInstance"
import hotToaster from "react-hot-toast"
import { useSelector } from "react-redux"
import { selectHydrated, selectUser } from "@/redux/slices/authSlice"
import GlobalLoader from "@/components/ui/globalloader"
import { useModuleAccess } from "@/hooks/useModuleAccess"

interface taskTableProps {
  searchQuery: string;
}

export function TasksTable({ searchQuery }: taskTableProps) {
  const router = useRouter()
  const reduxUser = useSelector(selectUser)
  const hydrated = useSelector(selectHydrated)
  const { isFullAccess } = useModuleAccess("tasks")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [filteredTasks, setFilteredTasks] = useState<any[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tasksApiCheckValue, setTasksApiCheckValue] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  // Universal filter state
  const [filterColumn, setFilterColumn] = useState<string>("")
  const [filterValue, setFilterValue] = useState<string>("")

  const filterableColumns = [
    { value: "id", label: "Task ID", type: "text" },
    { value: "title", label: "Task Title", type: "text" },
    { value: "incharge", label: "Assignee", type: "text" },
    { value: "source", label: "Source", type: "select", options: [
      { value: "planner", label: "Planner" },
      { value: "form_followup", label: "Form Follow-up" },
      { value: "form", label: "Form" },
      { value: "manual", label: "Manual" },
    ]},
    { value: "plannerId", label: "Order ID", type: "text" },
    { value: "plannerName", label: "Planner Name", type: "text" },
    { value: "location", label: "Location", type: "text" },
    { value: "startDate", label: "Start Date", type: "date" },
    { value: "dueDate", label: "Due Date", type: "date" },
    { value: "status", label: "Status", type: "select", options: [
      { value: "Not Started", label: "Not Started" },
      { value: "Reopened", label: "Reopened" },
      { value: "In Progress", label: "In Progress" },
      { value: "Completed", label: "Completed" },
      { value: "Not Assigned", label: "Not Assigned" },
    ]},
  ]

  const selectedColumn = filterableColumns.find(c => c.value === filterColumn)



  const canEdit = isFullAccess

  // Fetch tasks from API
  useEffect(() => {
    if (!hydrated || !reduxUser || !reduxUser.organization) return;
    async function fetchTasks() {
      try {
        setLoading(true);
        const response = await axiosInstance.get(`/tasks/`);
        console.log("Fetched tasks raw data:", response.data);
        const transformed = (response.data || []).map((item: any) => ({
          id: item.id.toString(),
          title: item.task_name || "Untitled",
          description: "",
          incharge: item.assignee_names?.[0]?.name?? "-",
          assigneeNames: item.assignee_names?.map((a: any) => a.name).join(", ") || "-",
          startDate: item.start_date ? item.start_date.split('T')[0] : "",
          dueDate: item.end_date ? item.end_date.split('T')[0] : "",
          status: item.status === "not_assigned" ? "Not Assigned" :
                 item.status === "in_progress" ? "In Progress" :
                 item.status === "completed" ? "Completed" :
                 (item.status === "not_started" && item.reopened_remarks) ? "Reopened" : "Not Started",
          actualEnd: null,
          linkedForm: item.form_title || null,
          formPrefix: item.form_prefix || "",
          source: item.source || "-",
          plannerId: item.planner_id || "-",
          plannerName: item.planner_name || "-",
          plannerFolderName: item.planner_folder_name || "-",
          plannerFolderColor: item.planner_folder_color || null,
          location: item.main_form_location || "-",
          taskAgeDays: item.task_age_days != null ? item.task_age_days : null,
          reopenedRemarks: item.reopened_remarks || null,
          isAutoClosed: item.is_auto_closed === true,
          isBulkImported: item.is_bulk_imported === true,
        }));
        setTasks(transformed);
        setFilteredTasks(transformed); // initialize filtered
        setTasksApiCheckValue(true);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching tasks:", err);
        if (
          err.response?.status === 403 &&
          err.response?.data?.[0]?.detail === "You do not have permission to perform this action." &&
          reduxUser &&
          reduxUser.role_details?.name?.toLowerCase() === "super_admin"
        ) {
          // Handle access denied if needed
        } else {
          // Fallback to empty
          setTasks([]);
          setFilteredTasks([]);
        }
        setTasksApiCheckValue(true);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [hydrated, reduxUser]);

  // Filter tasks when filters or tasks change
  useEffect(() => {
    let filtered = tasks.filter((task) => {
      // Global search filter - search across all columns
      const allValues = [
        task.id,
        task.formPrefix ? `${task.formPrefix}-${task.id}` : `NPX-${task.id}`,
        task.title,
        task.incharge,
        task.assigneeNames,
        task.source,
        task.plannerId,
        task.plannerName,
        task.plannerFolderName,
        task.location,
        task.startDate,
        task.dueDate,
        task.status,
        formatTaskAge(task.taskAgeDays),
      ].map(v => String(v ?? "").toLowerCase());

      const matchesSearch = !searchQuery ||
        allValues.some(v => v.includes(searchQuery.toLowerCase()));

      // Universal column filter
      let matchesColumnFilter = true;
      if (filterColumn && filterValue) {
        if (filterColumn === "plannerId") {
          // Order ID column shows both plannerId and plannerName
          const combined = `${task.plannerId} ${task.plannerName}`.toLowerCase();
          matchesColumnFilter = combined.includes(filterValue.toLowerCase());
        } else if (selectedColumn?.type === "select") {
          matchesColumnFilter = task[filterColumn] === filterValue;
        } else if (selectedColumn?.type === "date") {
          matchesColumnFilter = task[filterColumn] >= filterValue;
        } else {
          matchesColumnFilter = String(task[filterColumn] ?? "").toLowerCase().includes(filterValue.toLowerCase());
        }
      }

      return matchesSearch && matchesColumnFilter;
    });

    setFilteredTasks(filtered);
  }, [searchQuery, filterColumn, filterValue, tasks])

  const toggleRow = (id: string) => {
    if (!isFullAccess) return
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    if (!isFullAccess) return
    setSelectedRows(selectedRows.length === tasks.length ? [] : tasks.map((task) => task.id))
  }

  const getStatusBadge = (status: string, isAutoClosed?: boolean) => {
    if (isAutoClosed) {
      return (
        <div className="flex items-center gap-1 justify-center">
          <Badge variant="default" className="bg-green-100 text-green-800 border border-green-300 text-[10px] px-1.5 py-0 whitespace-nowrap">Completed</Badge>
          <Badge variant="outline" className="bg-red-100 text-red-700 border border-red-300 text-[10px] px-1.5 py-0 whitespace-nowrap">Auto-Closed</Badge>
        </div>
      )
    }
    switch (status) {
      case "Not Assigned":
        return <Badge variant="outline" className="bg-gray-100 text-blue-800 border border-gray-300 text-[10px] px-1.5 py-0 whitespace-nowrap">Not Assigned</Badge>
      case "Not Started":
        return <Badge variant="outline" className="bg-blue-100 text-gray-800 border border-blue-300 text-[10px] px-1.5 py-0 whitespace-nowrap">Not Started</Badge>
      case "Reopened":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border border-orange-300 text-[10px] px-1.5 py-0 whitespace-nowrap">Reopened</Badge>
      case "In Progress":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px] px-1.5 py-0 whitespace-nowrap">In Progress</Badge>
      case "Completed":
        return <Badge variant="default" className="bg-green-100 text-green-800 border border-green-300 text-[10px] px-1.5 py-0 whitespace-nowrap">Completed</Badge>
      default:
        return null
    }
  }

  const getImportedBadge = (isBulkImported?: boolean) => {
    if (isBulkImported) {
      return <Badge variant="outline" className="bg-cyan-100 text-cyan-800 border border-cyan-300 text-[10px] px-1.5 py-0 whitespace-nowrap ml-1">Imported</Badge>
    }
    return null
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "planner":
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 border border-purple-300">Planner</Badge>
      case "form_followup":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border border-orange-300">Form Follow-up</Badge>
      case "form":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border border-blue-300">Form</Badge>
      case "manual":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border border-gray-300">Manual</Badge>
      default:
        return <span className="text-muted-foreground">-</span>
    }
  }

  const formatTaskAge = (days: number | null) => {
    if (days == null) return "-"
    if (days === 0) return "Today"
    if (days === 1) return "1 day"
    return `${days} days`
  }

  const handleDelete = async (id: string) => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Deleting is disabled.", { duration: 2000 })
      return
    }
    setIsDeleting(true)
    try {
      await axiosInstance.delete(`/tasks/${id}/`)
      // Remove the deleted task from local state
      const updatedTasks = tasks.filter((task) => task.id !== id)
      setTasks(updatedTasks)
      setFilteredTasks(updatedTasks)
      hotToaster.success("The task has been successfully deleted.", { duration: 2000 })
    } catch (error: any) {
      console.error("Error deleting task:", error)
      hotToaster.error(`Failed to delete the task. ${error.response?.data?.message || error.message}`, { duration: 2000 })
    } finally {
      setIsDeleting(false)
    }
  }

  // const handleMarkComplete = async (id: string) => {
  //   setIsUpdating(true)
  //   try {
  //     const response = await axiosInstance.patch(`/tasks/${id}/mark_complete/`,
  //       { complete: true })

  //     const today = new Date().toISOString().split("T")[0]
  //     updateTask(id, {
  //       status: "Completed",
  //       actualEnd: today,
  //     })

  //     // Update local state
  //     const updatedTasks = tasks.map(task =>
  //       task.id === id
  //         ? { ...task, status: "Completed", actualEnd: today }
  //         : task
  //     )
  //     setTasks(updatedTasks)

  //     hotToaster.success("Task marked as completed.", { duration: 2000 })
  //   } catch (error) {
  //     console.error("Error completing task:", error)
  //     hotToaster.error("Unable to mark the task as completed.", { duration: 3000 })
  //   } finally {
  //     setIsUpdating(false)
  //   }
  // }

  const handleBulkDelete = async () => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Deleting is disabled.", { duration: 2000 })
      return
    }
    if (selectedRows.length === 0) return

    setIsDeleting(true)
    try {
      // Delete tasks one by one via API
      const deletePromises = selectedRows.map(id => axiosInstance.delete(`/tasks/${id}/`))
      await Promise.all(deletePromises)

      // Remove deleted tasks from local state
      const updatedTasks = tasks.filter((task) => !selectedRows.includes(task.id))
      setTasks(updatedTasks)
      setFilteredTasks(updatedTasks)
      setSelectedRows([])

      hotToaster.success(`${selectedRows.length} tasks have been successfully deleted.`, { duration: 2000 })
    } catch (error: any) {
      console.error("Error deleting tasks:", error)
      hotToaster.error(`Failed to delete the tasks. ${error.response?.data?.message || error.message}`, { duration: 2000 })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewTaskDetails = (id: string) =>{
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/tasks/${id}`)
  }

  return (
    <div className="space-y-4 flex-1 min-h-0 flex flex-col">
      {isFullAccess && selectedRows.length > 0 && (
        <div className="bg-muted p-2 rounded-md flex items-center justify-between">
          <span>{selectedRows.length} item(s) selected</span>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Tasks</DialogTitle>
                  <DialogDescription> 
                    Are you sure you want to delete {selectedRows.length} tasks? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { }}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Universal Filter Bar */}
      <div className="flex items-center gap-2 px-1">
        <select
          className="h-9 text-sm bg-white border border-gray-200 focus:border-blue-400 rounded-md px-3"
          value={filterColumn}
          onChange={(e) => { setFilterColumn(e.target.value); setFilterValue(""); }}
        >
          <option value="">Select column...</option>
          {filterableColumns.map(col => (
            <option key={col.value} value={col.value}>{col.label}</option>
          ))}
        </select>
        {filterColumn && selectedColumn?.type === "select" ? (
          <select
            className="h-9 text-sm bg-white border border-gray-200 focus:border-blue-400 rounded-md px-3"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          >
            <option value="">All {selectedColumn.label}s</option>
            {selectedColumn.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : filterColumn ? (
          <input
            type={selectedColumn?.type === "date" ? "date" : "text"}
            placeholder={`Filter by ${selectedColumn?.label}...`}
            className="h-9 text-sm bg-white border border-gray-200 focus:border-blue-400 rounded-md px-3 flex-1 max-w-xs"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        ) : null}
        {filterColumn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterColumn(""); setFilterValue(""); }}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        )}
      </div>

      <div className="rounded-md border shadow-[0_4px_10px_rgba(0,0,0,0.2)] flex-1 min-h-0 overflow-auto">
            <table className="min-w-full caption-bottom text-xs table-fixed">
              <colgroup>
                <col className="w-[40px]" />
                <col className="w-[80px]" />
                <col className="w-[180px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[60px]" />
                <col className="w-[90px]" />
                <col className="w-[50px]" />
              </colgroup>
              <TableHeader className="sticky top-0 bg-white z-30">
                <TableRow>
                  <TableHead className="sticky top-0 z-30 w-[50px] bg-white text-center">
                    <Checkbox
                      checked={selectedRows.length === filteredTasks.length && filteredTasks.length > 0}
                      disabled={!isFullAccess}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Task ID</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Task Title</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Assignee</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Source</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Order ID</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Location</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Duration</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Age</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white text-center">Status</TableHead>
                  {/* <TableHead className="sticky top-0 z-30 bg-white">Actual End</TableHead> */}
                  <TableHead className="sticky top-0 z-30 w-[60px] bg-white text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {filteredTasks.length === 0 && tasksApiCheckValue ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No tasks found. Create a new task to get started.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8">
                  <div className="relative flex justify-center items-center">
                    <GlobalLoader />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task) => {
                const isDueToday = task.dueDate === today;
                return (
                <TableRow key={task.id}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedRows.includes(task.id)}
                      disabled={!isFullAccess}
                      onCheckedChange={() => toggleRow(task.id)}
                      aria-label={`Select row ${task.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>{task.formPrefix ? `${task.formPrefix}-${task.id}` : `NPX-${task.id}`}</span>
                      {getImportedBadge(task.isBulkImported)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-center">
                    <Button
                      variant="link"
                      className="p-0 h-auto font-medium"
                      onClick={() => handleViewTaskDetails(task.id)}
                    >
                      {task.title}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">{task.incharge}</TableCell>
                  <TableCell className="text-center">{getSourceBadge(task.source)}</TableCell>
                  <TableCell className="text-xs text-center">
                    {task.plannerId !== "-" ? (
                      <div>
                        <div className="text-muted-foreground">{task.plannerId}</div>
                        <div>{task.plannerName}</div>
                      </div>
                    ) : task.formPrefix ? (
                      <div className="text-muted-foreground">{task.formPrefix}-{task.id}</div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-center">{task.location}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-center">
                    <div>{task.startDate}</div>
                    <div className={isDueToday ? 'text-red-500' : 'text-muted-foreground'}>{task.dueDate}</div>
                  </TableCell>
                  <TableCell className="text-xs text-center">{formatTaskAge(task.taskAgeDays)}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(task.status, task.isAutoClosed)}</TableCell>
                  {/* <TableCell>{task.actualEnd || "-"}</TableCell> */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}`)}>
                          <BarChart className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                router.push(`/tasks/share?taskId=${task.id}`)
                              }}
                            >
                              <Share className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            {task.status !== "Completed" && (
                              <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}?tab=mark_complete`)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}/edit`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}?tab=extend`)}>
                              <Clock className="mr-2 h-4 w-4" />
                              Extend Due Date
                            </DropdownMenuItem>
                              {/* <DialogTrigger asChild> */}
                                <DropdownMenuItem onSelect={(e) => {
                                  e.preventDefault();
                                  setIsDialogOpen(true); // open the dialog manually
                                }}>
                                  <Trash className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              {/* </DialogTrigger> */}
                               <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-6 w-6 text-destructive" />
                                    Delete Task</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to delete this task? This action cannot be undone.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => {
                                    setIsDialogOpen(false); // close the dialog
                                  }}>
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleDelete(task.id)}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>
    </div>
  )
}
