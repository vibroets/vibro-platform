"use client"
//@ts-nocheck
import { AnnouncementDetail } from "@/components/announcements/announcement-detail"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useRouter } from "next/navigation"
import { useState, use } from "react"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("announcements", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()
  const { id } = use(params)

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push("/announcements")} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="px-4 md:px-6 py-2 ">

            <AnnouncementDetail id={id} />
          </div>
        </div>
      </div>
    </div>


  )
}
