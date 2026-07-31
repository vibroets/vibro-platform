"use client"

import { FolderManagement } from "@/components/forms/folder-management"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Header} from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState } from "react"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function FormsFoldersPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  

  return (

<div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}/>
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
      <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}/>

    <div className="flex flex-col gap-4 p-4 md:p-8">
       

       <div className="pl-4 md:pl-6 flex justify-between">
        <Button variant="outline"  size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Forms
        </Button>
        </div>
         <div className="p-4 md:p-6 ">

      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold">Form Folders</h1>
      </div>

      <FolderManagement />
    </div>
    </div>
    </div>
    </div>
  )
}
