"use client"
import { AnnouncementForm } from "@/components/announcements/announcement-form"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, use } from "react"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
    const { hydrated, hasRequiredAccess } = useRequireModuleAccess("announcements", "full_access", {
      redirectInsufficient: "/announcements",
    })
    if (!hydrated || !hasRequiredAccess) return null

    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const router = useRouter()
    const { id } = use(params)
  
  return (

     <div className="min-h-screen">
          <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
          <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
            <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push(`/announcements/${id}`)} />
            <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
             <div className="p-4 md:p-6 ">
    <div className="space-y-6">
     
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Announcement</h1>
        <p className="text-muted-foreground">Make changes to your announcement.</p>
      </div>
      <AnnouncementForm id={id} />
    </div>
    </div>
    </div>
    </div>
    </div>
  )
}
