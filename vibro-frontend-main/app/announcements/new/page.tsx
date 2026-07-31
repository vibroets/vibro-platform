"use client"
import { AnnouncementForm } from "@/components/announcements/announcement-form"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function NewAnnouncementPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("announcements", "full_access", {
    redirectInsufficient: "/announcements",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push("/announcements")} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="p-4 md:p-6 ">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Create Announcement</h1>
                <p className="text-muted-foreground">Create a new announcement to share with users.</p>
              </div>
              <AnnouncementForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
