"use client"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSelector } from "react-redux"
import { selectUser } from "@/redux/slices/authSlice"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const UserManagement = dynamic(() => import("@/components/admin/user-management"), { ssr: false })
const GroupManagement = dynamic(() => import("@/components/admin/group-management"), { ssr: false })
const OrganizationManagement = dynamic(() => import("@/components/admin/organization-management"), { ssr: false })


export function AdminTabs() {
  const currentUser = useSelector(selectUser)
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = searchParams.get("tab") || "users"
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  if (!currentUser) return null

  const canAccess = currentUser.role_details.name === "super_admin" || currentUser.role_details.name === "admin"


  const isSuperAdmin = currentUser.role_details.name === "super_admin";
  const tabCount = isSuperAdmin ? 4 : 3;

return (
   <Tabs
      value={activeTab}
      onValueChange={(val) => {
        setActiveTab(val)
        // update the URL with the new tab
        router.push(`?tab=${val}`)
      }}
    >
    <TabsList 
      className={`grid w-full border-b border-gray-300 shadow-md gap-x-0 ${
        tabCount === 4 ? 'grid-cols-4' : 'grid-cols-3'
      }`}
    >
      <TabsTrigger value="users" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">
        Users
      </TabsTrigger>
      <TabsTrigger value="groups" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">
        Groups
      </TabsTrigger>
      <TabsTrigger value="organization" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">
        Organization
      </TabsTrigger>
      {isSuperAdmin && (
        <TabsTrigger value="super-admin" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">
          Super Admin
        </TabsTrigger>
      )}
    </TabsList>

      <TabsContent value="users" className="mt-6">
        <UserManagement />
      </TabsContent>
      <TabsContent value="groups" className="mt-6">
        <GroupManagement />
      </TabsContent>
      <TabsContent value="organization" className="mt-6">
        <OrganizationManagement />
      </TabsContent>
      <TabsContent value="super-admin" className="mt-6">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Super Admin Features</h2>
          <Button onClick={() => router.push("/admin/super-admin")}>Access All Features</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recovery</CardTitle>
              <CardDescription>Restore or permanently delete recently removed items</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Access the recovery console to manage deleted forms, checklists, and users.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support Chat</CardTitle>
              <CardDescription>View and respond to user support requests</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Access the support chat system to assist users with their inquiries.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>API/BI Integrations</CardTitle>
              <CardDescription>Configure external integrations and data connections</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage API integrations and BI dashboard connections for data exchange.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Archiving</CardTitle>
              <CardDescription>Manage archived forms, announcements, and other content</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Toggle archived items between active and inactive states.</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
