"use client"

import { useState, useRef } from "react"
import { PollsTable } from "@/components/polls/polls-table"
import { PollsHeader } from "@/components/polls/polls-header"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function PollsPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("polls", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const syncRef = useRef<(() => void) | null>(null)
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title="Polls"
          description="Create and manage polls"
        />
        <div className="p-4 md:p-6">
          <div className="space-y-6">
            <PollsHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSync={() => syncRef.current?.()}
            />
            <PollsTable searchQuery={searchQuery} onSyncRef={syncRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
