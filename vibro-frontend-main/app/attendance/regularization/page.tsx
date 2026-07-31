"use client"

import { RegularizationRequestsTable } from "@/components/attendance/regularization-requests-table"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function RegularizationPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Regularization Requests</h1>
        <p className="text-muted-foreground">Manage attendance correction requests</p>
      </div>
      <RegularizationRequestsTable />
    </div>
  )
}
