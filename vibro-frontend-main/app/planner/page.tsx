"use client"

import { PlannerHeader } from "@/components/planner/planner-header"
import { PlannerHistory } from "@/components/planner/planner-history"
import { MobilePlannerList } from "@/components/planner/mobile-planner-list"
import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function PlannerPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("planner", "view_only", {
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
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="h-screen overflow-hidden flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}/>
      <div className={`flex-1 h-screen flex flex-col overflow-hidden ${isSidebarOpen ? "md:ml-64" : ""}`}>
      <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Planner" description="Upload and manage templates for bulk assignments" step="header"/>
      <div className={`flex-1 min-h-0 overflow-hidden p-2 ${isSidebarOpen ? "md:pl-8" : "md:pl-12"}`}>
        <div className="md:pl-4 h-full flex flex-col">
          <div className="space-y-4 flex flex-col flex-1 min-h-0">
            <PlannerHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} onPlannerCreated={() => setRefreshKey(k => k + 1)} />
            {/* Mobile view */}
            <div className="md:hidden">
              <MobilePlannerList />
            </div>
            {/* Desktop view */}
            <div className="hidden md:block flex-1 min-h-0 flex flex-col">
              <PlannerHistory
                key={refreshKey}
                searchQuery={searchQuery}
                onPlannersMoved={() => setRefreshKey(k => k + 1)}
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
