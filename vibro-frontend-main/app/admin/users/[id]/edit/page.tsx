"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

const SingleUserForm = dynamic(() =>
  import("@/components/admin/single-user-form").then(mod => mod.SingleUserForm),
  { ssr: false }
)
import { Pencil } from "lucide-react";

// import { SingleUserForm } from "@/components/admin/single-user-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import GlobalLoader from "@/components/ui/globalloader"

export default function EditUserPage() {
  const params = useParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const userId = params.id as string
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  const isView = mode === "View" ? "View" : "Edit";



  useEffect(() => {
    // Simulate loading user data
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  return (<div className="min-h-screen">
    <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
    <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
      <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex flex-col gap-4 p-4 md:p-8">
        <div className="p-4 md:p-6 ">
          <div className="space-y-6">
            <div className="flex items-center">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Button variant="outline" size="sm" className="mr-2" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  {mode === "View" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex items-center"
                      onClick={() => router.push(`/admin/users/${userId}/edit?mode=Edit`)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{isView} User</h1>
                {mode === "View" ? (
                  <p className="text-sm text-muted-foreground">Viewing user details</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Update user information and permissions</p>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <GlobalLoader />
              </div>
            ) : (
              <SingleUserForm />
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
