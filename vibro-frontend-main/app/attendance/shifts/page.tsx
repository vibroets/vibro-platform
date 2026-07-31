"use client"

import { ShiftAssignmentHeader } from "@/components/attendance/shift-assignment-header"
import { ShiftAssignmentTable } from "@/components/attendance/shift-assignment-table"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function ShiftsPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="space-y-6">
      <ShiftAssignmentHeader />
      <ShiftAssignmentTable />
    </div>
  )
}
