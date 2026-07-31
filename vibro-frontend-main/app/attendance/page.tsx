"use client"

import { AttendanceTable } from "@/components/attendance/attendance-table"
import { AttendanceHeader } from "@/components/attendance/attendance-header"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function AttendancePage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="space-y-6">
      {/* <AttendanceHeader />
      <AttendanceTable /> */}
    </div>
  )
}
