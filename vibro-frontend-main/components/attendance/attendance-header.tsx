//@ts-nocheck
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Upload, ChevronDown, Clock, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useModuleAccess } from "@/hooks/useModuleAccess"

export function AttendanceHeader() {
  const router = useRouter()
  const { isFullAccess, isViewOnly } = useModuleAccess("attendance")
  const canManage = isFullAccess

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">Manage shifts and attendance</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search users..." className="w-full sm:w-[200px] pl-8" />
        </div>
        <Button onClick={() => router.push("/attendance/shifts")}>Shift Assignments</Button>
        <Button variant="outline" onClick={() => router.push("/attendance/regularization")}>
          <FileText className="mr-2 h-4 w-4" />
          Regularization Requests
        </Button>
        {isFullAccess ? (
          <Button variant="default" onClick={() => router.push("/attendance/clock")}>
            <Clock className="mr-2 h-4 w-4" />
            Clock In/Out
          </Button>
        ) : isViewOnly ? (
          <Button
            disabled
            title="You have view-only access for Attendance"
            className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
          >
            <Clock className="mr-2 h-4 w-4" />
            Clock In/Out
          </Button>
        ) : null}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push("/attendance/bulk-assign")}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Assign Shifts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : isViewOnly ? (
          <Button
            disabled
            title="You have view-only access for Attendance"
            className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
          >
            Actions
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
