"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Edit, Trash, Clock, CheckCircle, XCircle } from "lucide-react"
import { useModuleAccess } from "@/hooks/useModuleAccess"

interface ShiftAssignment {
  id: string
  userName: string
  employeeId: string
  shift: "Morning" | "Evening" | "Custom"
  dateRange: string
  location: string
  status: "Present" | "Absent" | "Late" | "Pending"
  clockIn: string | null
  clockOut: string | null
  regularizationRequests: number
}

export function AttendanceTable() {
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const { isFullAccess } = useModuleAccess("attendance")
  const canEdit = isFullAccess

  const shifts: ShiftAssignment[] = [
    {
      id: "1",
      userName: "John Doe",
      employeeId: "EMP001",
      shift: "Morning",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Warehouse A",
      status: "Present",
      clockIn: "08:00 AM",
      clockOut: "05:00 PM",
      regularizationRequests: 0,
    },
    {
      id: "2",
      userName: "Jane Smith",
      employeeId: "EMP002",
      shift: "Evening",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Warehouse B",
      status: "Late",
      clockIn: "06:15 PM",
      clockOut: "02:00 AM",
      regularizationRequests: 1,
    },
    {
      id: "3",
      userName: "Michael Johnson",
      employeeId: "EMP003",
      shift: "Morning",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Office Building",
      status: "Absent",
      clockIn: null,
      clockOut: null,
      regularizationRequests: 1,
    },
    {
      id: "4",
      userName: "Sarah Williams",
      employeeId: "EMP004",
      shift: "Custom",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Remote",
      status: "Present",
      clockIn: "09:00 AM",
      clockOut: "06:00 PM",
      regularizationRequests: 0,
    },
    {
      id: "5",
      userName: "Robert Brown",
      employeeId: "EMP005",
      shift: "Morning",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Warehouse A",
      status: "Pending",
      clockIn: null,
      clockOut: null,
      regularizationRequests: 0,
    },
  ]

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setSelectedRows(selectedRows.length === shifts.length ? [] : shifts.map((shift) => shift.id))
  }

  const getStatusBadge = (status: ShiftAssignment["status"]) => {
    switch (status) {
      case "Present":
        return <Badge variant="default">Present</Badge>
      case "Absent":
        return <Badge variant="destructive">Absent</Badge>
      case "Late":
        return <Badge variant="secondary">Late</Badge>
      case "Pending":
        return <Badge variant="outline">Pending</Badge>
      default:
        return null
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedRows.length === shifts.length && shifts.length > 0}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Clock In</TableHead>
            <TableHead>Clock Out</TableHead>
            <TableHead>Regularization Requests</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => (
            <TableRow key={shift.id}>
              <TableCell>
                <Checkbox
                  checked={selectedRows.includes(shift.id)}
                  onCheckedChange={() => toggleRow(shift.id)}
                  aria-label={`Select row ${shift.id}`}
                />
              </TableCell>
              <TableCell className="font-medium">{shift.userName}</TableCell>
              <TableCell>{shift.employeeId}</TableCell>
              <TableCell>{shift.shift}</TableCell>
              <TableCell>{shift.dateRange}</TableCell>
              <TableCell>{shift.location}</TableCell>
              <TableCell>{getStatusBadge(shift.status)}</TableCell>
              <TableCell>{shift.clockIn || "-"}</TableCell>
              <TableCell>{shift.clockOut || "-"}</TableCell>
              <TableCell>{shift.regularizationRequests}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && shift.regularizationRequests > 0 && (
                      <>
                        <DropdownMenuItem>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve Request
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject Request
                        </DropdownMenuItem>
                      </>
                    )}
                    {canEdit && (
                      <>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Shift
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Clock className="mr-2 h-4 w-4" />
                          Manual Clock In/Out
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Trash className="mr-2 h-4 w-4" />
                          Remove Shift
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
