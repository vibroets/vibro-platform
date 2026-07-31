"use client"
import { ReceiptHistory } from "@/components/announcements/receipt-history"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, use } from "react"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function ReceiptHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("announcements", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const { id } = use(params)
  const searchParams = useSearchParams();
  const viewReceiptHistory = searchParams.get("view") === "directview_history";

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Receipt History" description="Track announcement delivery and read receipts" step="header" onBack={() => viewReceiptHistory ? router.push("/announcements/") : router.push(`/announcements/${id}`)} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="px-4 md:px-6 ">
            <div className="space-y-6">

              <ReceiptHistory id={id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
