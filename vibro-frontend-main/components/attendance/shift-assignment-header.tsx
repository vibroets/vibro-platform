"use client"

import { Button } from "@/components/ui/button"
import { PlusCircle, ArrowLeft, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useModuleAccess } from "@/hooks/useModuleAccess"

export function ShiftAssignmentHeader() {
  const router = useRouter()
  const { isFullAccess, isViewOnly } = useModuleAccess("attendance")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/attendance")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Shift Assignments</h1>
        </div>
        <p className="text-muted-foreground">Manage employee shift schedules and locations</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {isFullAccess ? (
          <Button onClick={() => router.push("/attendance/shifts/new")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
        ) : isViewOnly ? (
          <Button
            disabled
            title="You have view-only access for Attendance"
            className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
        ) : null}
        {isFullAccess ? (
          <Button variant="outline" onClick={() => router.push("/attendance/bulk-assign")}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Assign
          </Button>
        ) : isViewOnly ? (
          <Button
            disabled
            title="You have view-only access for Attendance"
            className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Assign
          </Button>
        ) : null}
      </div>
    </div>
  )
}
