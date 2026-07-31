"use client"

import { useUser } from "@/components/user-provider"

export function AdminHeader() {
  const { user } = useUser()

  // Only Super Admin and Admin can access admin

  const canAccess = user.role === "Super Admin" || user.role === "Admin"
  const isSuperAdmin = user.role === "Super Admin"

  
  if (!canAccess) {
    return (
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access the administration section.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">AdminiManage users, groups, and system settingsstration</h1>
      <p className="text-muted-foreground">
        {isSuperAdmin ? "Manage users, groups, and organization settings" : "Manage users and groups"}
      </p>
    </div>
  )
}
