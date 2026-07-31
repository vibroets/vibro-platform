"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { PollForm } from "@/components/polls/poll-form"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function EditPollPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("polls", "full_access", {
    redirectInsufficient: "/polls",
    redirectNoAccess: "/dashboard",
  })
  const params = useParams()
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
          title="Edit Poll"
          description="Update poll details and questions"
          onBack={() => router.push("/polls")}
        />
        <div className="p-4 md:p-6">
          <PollForm pollId={params.id as string} />
        </div>
      </div>
    </div>
  )
}
