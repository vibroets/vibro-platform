"use client"


import { PlannerUploadForm } from "@/components/planner/planner-upload-form"
import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"



export default function PlannerUploadPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("planner", "full_access", {
    redirectInsufficient: "/planner",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()

  useEffect(() => {
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [])

  return (

    <div className="h-screen overflow-hidden flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`flex-1 h-screen flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`flex-1 min-h-0 overflow-hidden p-4 transition-all duration-300 ${isSidebarOpen ? "md:pl-8" : "md:pl-12"}`}>
          <div className="h-full flex flex-col pl-4 md:pl-6 overflow-hidden">
            <div className="space-y-6 flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <h1 className="text-2xl font-bold pl-4 md:pl-6">Bulk Import Planners</h1>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <PlannerUploadForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
