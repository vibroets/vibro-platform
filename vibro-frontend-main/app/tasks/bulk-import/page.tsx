"use client"
import { TaskBulkImport } from "@/components/tasks/task-bulk-import"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function BulkImportPage() {
          const { hydrated, hasRequiredAccess } = useRequireModuleAccess("tasks", "full_access", {
            redirectInsufficient: "/tasks",
          })
          if (!hydrated || !hasRequiredAccess) return null

          const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()
  return (

    <div className="min-h-screen">
              <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
              <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
                <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push("/tasks")} />
                <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
                 <div className="pl-4 md:pl-6 ">
    <div className="space-y-6">
      
      <TaskBulkImport />
    </div>
    </div>
    </div>
    </div>
    </div>
  )
}
