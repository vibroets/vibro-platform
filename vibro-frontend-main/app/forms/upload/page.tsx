"use client"


import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { FormBulkUploadForm } from "@/components/forms/form-bulkupload"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"



export default function FormBulkUploadPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "full_access", {
    redirectInsufficient: "/forms",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()

  return (

    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300 ${isSidebarOpen ? "md:pl-8" : "md:pl-12"}`}>
          <div className="pl-4 md:pl-6 ">

            <div className="space-y-6">
        <Button variant="outline"  size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
             
              <FormBulkUploadForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
