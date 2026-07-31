"use client"

import { ClockInOut } from "@/components/attendance/clock-in-out"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function ClockPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "full_access", {
    redirectInsufficient: "/attendance",
    redirectNoAccess: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clock In/Out</h1>
        <p className="text-muted-foreground">Manage your attendance with GPS-based clock in/out</p>
      </div>
      <ClockInOut />
    </div>
  )
}
