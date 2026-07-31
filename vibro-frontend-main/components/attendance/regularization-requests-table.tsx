"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, CheckCircle, XCircle, FileText } from "lucide-react"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface RegularizationRequest {
  id: string
  userName: string
  employeeId: string
  requestType: string
  date: string
  reason: string
  status: "Pending" | "Approved" | "Rejected"
  requestsThisMonth: number
  hasAttachment: boolean
}

export function RegularizationRequestsTable() {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [currentRequest, setCurrentRequest] = useState<RegularizationRequest | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const { toast } = useToast()

  const { isFullAccess } = useModuleAccess("attendance")
  const canApprove = isFullAccess

  const requests: RegularizationRequest[] = [
    {
      id: "1",
      userName: "John Doe",
      employeeId: "EMP001",
      requestType: "Missed Punch",
      date: "2023-04-26",
      reason: "Forgot to clock in due to urgent meeting with client.",
      status: "Pending",
      requestsThisMonth: 1,
      hasAttachment: true,
    },
    {
      id: "2",
      userName: "Jane Smith",
      employeeId: "EMP002",
      requestType: "Wrong Time",
      date: "2023-04-25",
      reason: "System recorded wrong time due to network issues.",
      status: "Approved",
      requestsThisMonth: 2,
      hasAttachment: false,
    },
    {
      id: "3",
      userName: "Michael Johnson",
      employeeId: "EMP003",
      requestType: "Forgot Device",
      date: "2023-04-24",
      reason: "Left phone at home, couldn't use the app to clock in.",
      status: "Rejected",
      requestsThisMonth: 3,
      hasAttachment: true,
    },
    {
      id: "4",
      userName: "Sarah Williams",
      employeeId: "EMP004",
      requestType: "System Error",
      date: "2023-04-23",
      reason: "App crashed during clock out process.",
      status: "Pending",
      requestsThisMonth: 1,
      hasAttachment: false,
    },
    {
      id: "5",
      userName: "Robert Brown",
      employeeId: "EMP005",
      requestType: "Other",
      date: "2023-04-22",
      reason: "Was at client site with no internet access.",
      status: "Pending",
      requestsThisMonth: 2,
      hasAttachment: true,
    },
  ]

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatusFilter = statusFilter ? request.status === statusFilter : true

    return matchesSearch && matchesStatusFilter
  })

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setSelectedRows(
      selectedRows.length === filteredRequests.length ? [] : filteredRequests.map((request) => request.id),
    )
  }

  const handleView = (request: RegularizationRequest) => {
    setCurrentRequest(request)
    setIsViewDialogOpen(true)
  }

  const handleApprove = (id: string) => {
    // In a real app, this would call an API to approve the request
    toast({
      title: "Request Approved",
      description: `Regularization request ${id} has been approved.`,
    })
  }

  const handleReject = (id: string) => {
    // In a real app, this would call an API to reject the request
    toast({
      title: "Request Rejected",
      description: `Regularization request ${id} has been rejected.`,
    })
  }

  const handleBulkApprove = () => {
    // In a real app, this would call an API to approve multiple requests
    toast({
      title: "Requests Approved",
      description: `${selectedRows.length} regularization requests have been approved.`,
    })
    setSelectedRows([])
  }

  const handleBulkReject = () => {
    // In a real app, this would call an API to reject multiple requests
    toast({
      title: "Requests Rejected",
      description: `${selectedRows.length} regularization requests have been rejected.`,
    })
    setSelectedRows([])
  }

  const getStatusBadge = (status: RegularizationRequest["status"]) => {
    switch (status) {
      case "Approved":
        return <Badge variant="default">Approved</Badge>
      case "Rejected":
        return <Badge variant="destructive">Rejected</Badge>
      case "Pending":
        return <Badge variant="outline">Pending</Badge>
      default:
        return null
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div className="relative w-full sm:w-[300px]">
            <Input
              type="search"
              placeholder="Search by name, ID, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {canApprove && selectedRows.length > 0 && (
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={handleBulkApprove}>
                  <CheckCircle className="mr-1 h-4 w-4" />
                  Approve ({selectedRows.length})
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkReject}>
                  <XCircle className="mr-1 h-4 w-4" />
                  Reject ({selectedRows.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedRows.length === filteredRequests.length && filteredRequests.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Request Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requests This Month</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedRows.includes(request.id)}
                    onCheckedChange={() => toggleRow(request.id)}
                    aria-label={`Select row ${request.id}`}
                    disabled={request.status !== "Pending"}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{request.userName}</p>
                    <p className="text-sm text-muted-foreground">{request.employeeId}</p>
                  </div>
                </TableCell>
                <TableCell>{request.requestType}</TableCell>
                <TableCell>{request.date}</TableCell>
                <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {request.requestsThisMonth}/5
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(request)}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {canApprove && request.status === "Pending" && (
                        <>
                          <DropdownMenuItem onClick={() => handleApprove(request.id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReject(request.id)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
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

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Regularization Request Details</DialogTitle>
            <DialogDescription>Request ID: {currentRequest?.id}</DialogDescription>
          </DialogHeader>
          {currentRequest && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Employee</p>
                  <p className="text-sm">{currentRequest.userName}</p>
                  <p className="text-xs text-muted-foreground">{currentRequest.employeeId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <div className="mt-1">{getStatusBadge(currentRequest.status)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Request Type</p>
                  <p className="text-sm">{currentRequest.requestType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm">{currentRequest.date}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Reason</p>
                <p className="text-sm mt-1">{currentRequest.reason}</p>
              </div>
              {currentRequest.hasAttachment && (
                <div>
                  <p className="text-sm font-medium">Supporting Document</p>
                  <Button variant="outline" size="sm" className="mt-1">
                    <FileText className="mr-2 h-4 w-4" />
                    View Document
                  </Button>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Requests This Month</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono">
                    {currentRequest.requestsThisMonth}/5
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {5 - currentRequest.requestsThisMonth} requests remaining this month
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {canApprove && currentRequest?.status === "Pending" && (
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={() => handleReject(currentRequest.id)} className="w-full">
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => handleApprove(currentRequest.id)} className="w-full">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
            {(currentRequest?.status !== "Pending" || !canApprove) && (
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full">
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
