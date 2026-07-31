// @ts-nocheck
"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit, User, Calendar, MessageSquare, Building2 } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import axiosInstance from "@/utils/axiosInstance"
import GlobalLoader from "@/components/ui/globalloader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface GroupData {
  id: string
  name: string
  description: string
  allow_chat: boolean
  type: string
  match_type?: string
  created_at: string
  organization: number
  organization_name: string
  member_details?: any[]
  conditions?: any[]
}

export default function ViewGroupPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [groupData, setGroupData] = useState<GroupData | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await axiosInstance.get(`/groups/${groupId}/`)
        console.log("Group data:", res.data)
        setGroupData(res.data)
      } catch (err) {
        console.error("Failed to fetch group", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroup()
  }, [groupId])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`${isSidebarOpen ? "md:ml-64" : ""}`}>
          <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
          <div className="p-4 md:p-8">
            <GlobalLoader />
          </div>
        </div>
      </div>
    )
  }

  if (!groupData) {
    return (
      <div className="min-h-screen">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`${isSidebarOpen ? "md:ml-64" : ""}`}>
          <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
          <div className="p-4 md:p-8">
            <p>Group not found</p>
          </div>
        </div>
      </div>
    )
  }

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/admin?tab=groups")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      View Group
                    </h1>
                    <p className="text-muted-foreground">
                      Group details and members
                    </p>
                  </div>
                </div>
                <Button onClick={() => router.push(`/admin/groups/${groupId}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Group Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Group Name</label>
                      <p className="text-base font-semibold">{groupData.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p className="text-base">{groupData.description || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Type</label>
                      <div className="mt-1">
                        <Badge variant="outline">{groupData.type === "Normal" ? "Normal" : "Rule-Based"}</Badge>
                      </div>
                    </div>
                    {groupData.type !== "Normal" && groupData.match_type && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Match Type</label>
                        <p className="text-base">{groupData.match_type}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Chat Allowed</label>
                      <div className="mt-1">
                        <Badge className={groupData.allow_chat ? "bg-green-500" : "bg-gray-500"}>
                          {groupData.allow_chat ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Organization</label>
                      <p className="text-base">{groupData.organization_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created On</label>
                      <p className="text-base">{groupData.created_at}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {groupData.type !== "Normal" && groupData.conditions && groupData.conditions.length > 0 ? (
                      <div className="space-y-2">
                        {groupData.conditions.map((condition: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-md">
                            <p className="text-sm">
                              <span className="font-medium">Field:</span> {condition.field}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Operator:</span> {condition.operator}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Value:</span> {condition.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No conditions (Normal Group)</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Members</CardTitle>
                </CardHeader>
                <CardContent>
                  {groupData.member_details && groupData.member_details.length > 0 ? (
                    <div className="space-y-2">
                      {groupData.member_details.map((member: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <p className="font-medium">{member.first_name} {member.last_name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                          <div className="flex gap-2 mt-2">
                            {member.department && (
                              <Badge variant="secondary" className="text-xs">
                                {member.department.name}
                              </Badge>
                            )}
                            {member.designation && (
                              <Badge variant="secondary" className="text-xs">
                                {member.designation.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No members in this group</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
