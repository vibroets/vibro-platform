"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Dynamically import components to skip SSR
const Sidebar = dynamic(() => import("@/components/sidebar").then(mod => mod.Sidebar), { ssr: false })
const Header = dynamic(() => import("@/components/header").then(mod => mod.Header), { ssr: false })
const RuleBasedGroupForm = dynamic(
  () => import("@/components/admin/rule-based-group-form").then(mod => mod.RuleBasedGroupForm),
  { ssr: false }
)

export default function NewRuleBasedGroupPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const router = useRouter()

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300 ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="p-4 md:p-6">
            <div className="space-y-6">
              <div>
                <Button variant="outline" type="button" onClick={() => router.push("/admin?tab=groups")}>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Create Rule-Based Group</h1>
                <p className="text-muted-foreground">Create a new group with membership determined by rules</p>
              </div>

              <RuleBasedGroupForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
