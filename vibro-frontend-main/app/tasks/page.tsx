"use client"
import { TasksTable } from "@/components/tasks/tasks-table"
import { TasksHeader } from "@/components/tasks/tasks-header"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState, useEffect } from "react"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function TasksPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("tasks", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  
  useEffect(() => {
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [])
  
  if (!hydrated || !hasRequiredAccess) return null
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  return (

    <div className="h-screen overflow-hidden flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`flex-1 h-screen flex flex-col overflow-hidden ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Tasks" description="Assign and track tasks across your team" step="header" />
        <div className={`flex-1 min-h-0 overflow-hidden p-4 ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="h-full flex flex-col gap-4">
            <TasksHeader searchQuery={searchQuery}
              setSearchQuery={setSearchQuery} />
            <TasksTable searchQuery={searchQuery} />
          </div>
        </div>
      </div>
    </div>
  )
}
