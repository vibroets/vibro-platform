"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Dynamically import components to skip SSR
const Sidebar = dynamic(() => import("@/components/sidebar").then(mod => mod.Sidebar), { ssr: false })
const Header = dynamic(() => import("@/components/header").then(mod => mod.Header), { ssr: false })
const BulkImportUsers = dynamic(
  () => import("@/components/admin/bulk-import-users").then(mod => mod.BulkImportUsers),
  { ssr: false }
)

export default function BulkImportUsersPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex flex-col gap-4 p-4 md:p-8">
          <div className="pl-4 md:pl-6">
            <div className="space-y-6">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Bulk Import Users</h1>
                <p className="text-muted-foreground">
                  Import multiple users at once using a CSV file
                </p>
              </div>

              <BulkImportUsers />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
