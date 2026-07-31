"use client"

import { RegularizationRequestForm } from "@/components/attendance/regularization-request-form"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function NewRegularizationPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "full_access", {
    redirectInsufficient: "/attendance/regularization",
    redirectNoAccess: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Regularization Request</h1>
        <p className="text-muted-foreground">Submit a request to correct your attendance record</p>
      </div>
      <RegularizationRequestForm />
    </div>
  )
}
