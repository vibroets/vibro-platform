"use client"

import { useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { PollDetail } from "@/components/polls/poll-detail"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function PollPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("polls", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title="Poll Details"
          description="View and manage poll details"
          onBack={() => router.push("/polls")}
        />
        <div className="p-4 md:p-6">
          <PollDetail pollId={params.id as string} initialTab={searchParams.get("tab") || undefined} />
        </div>
      </div>
    </div>
  )
}
