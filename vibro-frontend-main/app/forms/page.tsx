// @ts-nocheck

"use client"

import { FormsHeader } from "@/components/forms/forms-header"
import { FormsTable } from "@/components/forms/forms-table"
import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import { XCircle } from "lucide-react"; // optional icon for friendly alert
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function FormsPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const currentuser = useSelector(selectUser);
  const [searchQuery, setSearchQuery] = useState("")
  const [formType, setFormType] = useState<string | null>("")
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  console.log("Current User Role in Forms Page:", currentuser);
  const isEndUser = currentuser?.role_details?.name === "end_user";
  const issuperadmincheckk = currentuser?.role == '1';
  console.log("Superadmin Check in Forms Page:", issuperadmincheckk);
  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Forms" description="Create and manage digital forms for data collection" step="header" />

        <div className={`flex flex-col gap-4 transition-all duration-300 ${isSidebarOpen ? "md:px-4" : ""}`}>
          <div className="px-4 md:px-6 space-y-4">

            {isEndUser  ? (
              <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-4">
                <XCircle className="w-12 h-12 text-gray-500 mx-auto" />
                <h1 className="text-2xl font-semibold text-gray-800">
                  Oops! You don’t have access to this page.
                </h1>
                <p className="text-gray-600">
                  please contact your administrator.
                </p>
              </div>
            ) : (
              <>
                <FormsHeader
                  isOpen={isSidebarOpen}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedFormType={selectedFormType}
                  setSelectedFormType={setSelectedFormType}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  formType={formType}
                  setFormType={setFormType}
                />
                <FormsTable
                  searchQuery={searchQuery}
                  selectedFormType={selectedFormType}
                  setSelectedFormType={setSelectedFormType}
                  dateRange={dateRange}
                  formType={formType}
                  setFormType={setFormType}
                />
              </>
            )}

          </div>
        </div>
      </div>

      
    </div>
  )
}
