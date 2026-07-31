"use client"

import { TaskForm } from "@/components/tasks/task-form"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState, useEffect, use } from "react"
import { useSearchParams } from "next/navigation"
import axiosInstance from "@/utils/axiosInstance"
import { useSelector } from "react-redux"
import { RootState } from "@/redux/store"
import { selectHydrated } from "@/redux/slices/authSlice"
import type { Task } from "@/data/tasks"
import GlobalLoader from "@/components/ui/globalloader"
import { useRouter } from "next/navigation"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { hydrated: accessHydrated, hasRequiredAccess } = useRequireModuleAccess("tasks", "full_access", {
    redirectInsufficient: "/tasks",
  })
  if (!accessHydrated || !hasRequiredAccess) return null

  const router = useRouter();
  const searchParams = useSearchParams()
  const hydrated = useSelector(selectHydrated)
  const resolvedParams = use(params)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const mode = searchParams.get('mode') || 'edit'

  useEffect(() => {
    if (!hydrated) return;

    const fetchTask = async () => {
      try {
        setLoading(true)
        const response = await axiosInstance.get(`/tasks/${resolvedParams.id}/`)
        console.log("Fetched task data for edit:", response.data)

        // Transform API response to Task interface
        const transformedTask: Task = {
          id: response.data.id.toString(),
          title: response.data.task_name || "Untitled",
          description: response.data.description || "",
          incharge: response.data.assigned_to_name || response.data.created_by_name || "Unassigned",
          startDate: response.data.start_date ? response.data.start_date.split('T')[0] : "",
          dueDate: response.data.end_date ? response.data.end_date.split('T')[0] : "",
          status: response.data.status === "not_assigned" ? "Not Started" :
                 response.data.status === "in_progress" ? "In Progress" :
                 response.data.status === "completed" ? "Completed" : "Not Started",
          actualEnd: response.data.actual_end ? response.data.actual_end.split('T')[0] : null,
          linkedForm: response.data.form_title || null,
        }

        setTask(transformedTask)
        setError(null)
      } catch (err: any) {
        console.error("Error fetching task for edit:", err)
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
                    <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack= {()=> router.back()} />
                    <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
                     <div className="p-4 md:p-6 ">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{mode === 'reopen' ? "Edit Reopen Task" : "Edit Task"}</h1>
        <p className="text-muted-foreground">Update task details and assignments</p>
      </div>
      <TaskForm task={task} mode={mode} />
    </div>
    </div>
    </div>
    </div>
    </div>
  )
}
