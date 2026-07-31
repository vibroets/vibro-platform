"use client"

import { TaskDetail } from "@/components/tasks/task-detail"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import axiosInstance from "@/utils/axiosInstance"
import { useSelector } from "react-redux"
import { RootState } from "@/redux/store"
import type { Task } from "@/data/tasks"
import GlobalLoader from "@/components/ui/globalloader"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"


export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("tasks", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const router = useRouter();
  const resolvedParams = use(params)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    if (!hydrated) return;

    const fetchTask = async () => {
      try {
        setLoading(true)
        const response = await axiosInstance.get(`/tasks/${resolvedParams.id}/`)
        console.log("Fetched individual task data:", response.data)

        const assignee = response.data.assignees?.[0];
        // Transform API response to Task interface
        const transformedTask: Task = {
          id: response.data.id.toString(),
          title: response.data.task_name || "Untitled",
          description: response.data.description || "",
          incharge: assignee?.assigned_user_name ?? assignee?.assigned_group_name ?? "Unassigned",
          startDate: response.data.start_date ? response.data.start_date.split('T')[0] : "",
          dueDate: response.data.end_date ? response.data.end_date.split('T')[0] : "",
          status: response.data.status === "not_assigned" ? "Not Assigned" :
            response.data.status === "in_progress" ? "In Progress" :
              response.data.status === "completed" ? "Completed" : "Not Started",
          actualEnd: response.data.actual_end ? response.data.actual_end.split('T')[0] : null,
          linkedForm: response.data.form_title || null,
          createdBy: response.data.created_by_name || "Unknown",
          createdOn: response.data.created_on ? response.data.created_on.split('T')[0] : "Unknown",
          formid: response.data.form ? response.data.form.toString() : null,
          isAutoClosed: response.data.is_auto_closed === true,
          isBulkImported: response.data.is_bulk_imported === true,
        }

        setTask(transformedTask)
        setError(null)
      } catch (err: any) {
        console.error("Error fetching task:", err)
        if (err.response?.status === 404) {
          setError("Task not found")
        } else {
          setError("Failed to load task")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTask()
  }, [resolvedParams.id, hydrated])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GlobalLoader />
      </div>
    )
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>
  }

  if (!task) {
    return <div className="min-h-screen flex items-center justify-center">Task not found</div>
  }

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push("/tasks") } />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="pl-4 md:pl-6 ">
            <TaskDetail task={task} />
          </div>
        </div>
      </div>
    </div>
  )
}
