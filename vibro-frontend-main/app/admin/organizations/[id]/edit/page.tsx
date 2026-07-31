"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { OrganizationForm } from "@/components/admin/organization-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Upload, UserPlus } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import GlobalLoader from "@/components/ui/globalloader"

export default function EditOrganizationPage() {
  const params = useParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const orgId = params.id as string
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)


  useEffect(() => {
    // Simulate loading organization data
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  return (

    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex flex-col gap-4 p-4 md:p-8">
          <div className="pl-4 md:pl-6 ">
            <div className="space-y-6">
              <Button variant="outline" size="sm" className="mr-2" onClick={() => router.push("/admin?tab=organization")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {/* <div className="flex items-center"> */}

              <div className="flex items-center justify-between">
                {/* Left side: Title */}
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Edit Organization</h1>
                  <p className="text-muted-foreground">
                    Update organization details and administrators
                  </p>
                </div>

                {/* Right side: Buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="min-w-[150px]"
                    // onClick={() => router.push("/admin/users/new")}
                    onClick={() => router.push(`/admin/users/new?orgId=${orgId}&mode=edit`)}  // CHANGE: Add ?orgId=${orgId} to pass org context

                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                  <Button onClick={() => router.push(`/admin/groups/new-normal?orgId=${orgId}`)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Normal Group
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/admin/groups/new-rule-based?orgId=${orgId}`)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Rule-Based Group
                  </Button>
                  <Button  // CHANGE: Add ?orgId=${orgId} to pass org context
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/users/bulk-import?orgId=${orgId}`)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Bulk Import users
                  </Button>
                </div>
              </div>


              {/* </div> */}

              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <GlobalLoader />
                </div>
              ) : (
                <OrganizationForm />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
