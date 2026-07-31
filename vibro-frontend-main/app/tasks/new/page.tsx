"use client"

import { TaskForm } from "@/components/tasks/task-form"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function NewTaskPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("tasks", "full_access", {
    redirectInsufficient: "/tasks",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter();
  return (

    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
        title="Assign New Task"
        description="Create and assign tasks to team members"
        step="header"
          onBack={() => router.back()} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="pl-4 md:pl-6 ">
            <div className="container py-6 space-y-6">
              <TaskForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
