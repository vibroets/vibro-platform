// @ts-nocheck
"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

import { NormalGroupForm } from "@/components/admin/normal-group-form"
import { RuleBasedGroupForm } from "@/components/admin/rule-based-group-form"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import axiosInstance from "@/utils/axiosInstance" // ✅ Import your axios
import GlobalLoader from "@/components/ui/globalloader";

export default function EditGroupPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [groupType, setGroupType] = useState<"normal" | "rulebased">("normal")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await axiosInstance.get(`/groups/${groupId}/`)
        const group = res.data
        console.log("data ::", group)

        // ✅ Set groupType based on response
        if (group.type === "normal") {
          setGroupType("normal")
        } else {
          setGroupType("rulebased")
        }
      } catch (err) {
        console.error("Failed to fetch group", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroup()
  }, [groupId])
console.log("groupType:>>>>", groupType)
  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : ""
        }`}
      >
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex flex-col gap-4 p-4 md:p-8">
          <div className="p-4 md:p-6">
            <div className="space-y-6">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                onClick={() => router.push("/admin?tab=groups")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <div className="flex items-center">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Edit Group
                  </h1>
                  <p className="text-muted-foreground">
                    Update group settings and members
                  </p>
                </div>
              </div>

              {isLoading ? (
                <GlobalLoader />
              ) : (
                <>
                  {groupType === "normal" ? (
                    <NormalGroupForm groupId={groupId} />
                  ) : (
                    <RuleBasedGroupForm groupId={groupId} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
