// @ts-nocheck
"use client"

import { FormDetail } from "@/components/forms/form-detail"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState, useEffect } from "react"
import { boolean } from "mathjs"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"


export default function FormDetailPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const params = useParams()
  const searchParams = useSearchParams();
  const rawId = params.id as string
  const idSegments = rawId.split("-")          // ["form", "1"]
  const formId = idSegments[idSegments.length - 1]
  const status = searchParams.get("status"); // "failed"
  const plannerLocation = searchParams.get("planner_location") || null
  const plannerOrderId = searchParams.get("planner_order_id") || null
  console.log("Form ID:", formId)
  console.log("status in the form view ::", status)
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [folderId, setFolderId] = useState<number | null>(null)  // ✅ lifted state

  const hasFolder = folderId !== null

  useEffect(() => {
    if (folderId) {
      console.log("✅ folderId updated in [id] page >>", folderId);
    }
  }, [folderId]);


  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      {/* <div className="md:ml-64 transition-all duration-300"> */}
      <div className={`transition-all duration-300  ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>

        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          onBack={() => router.push(hasFolder ? `/forms/folders/${folderId}` : "/forms")}

        />

        <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-10"}`}>
          <FormDetail id={formId} onFolderId={setFolderId} status={status} plannerLocation={plannerLocation} plannerOrderId={plannerOrderId} />
        </div>
      </div>
    </div>
  )
}
