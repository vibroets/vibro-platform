//@ts-nocheck
"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Eye, Download, Printer, UserPlus, Filter } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

// Mock data for form responses
const mockResponses = [
  {
    id: "resp-1",
    submissionId: "SUB-001",
    user: "John Doe",
    submissionDate: "2023-05-10",
    filledBy: "John Doe",
    designation: "Safety Officer",
    department: "Operations",
    location: "Site A",
    status: "Complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 0,
  },
  {
    id: "resp-2",
    submissionId: "SUB-002",
    user: "Jane Smith",
    submissionDate: "2023-05-09",
    filledBy: "Jane Smith",
    designation: "Supervisor",
    department: "Maintenance",
    location: "Site B",
    status: "Partial",
    taskCompletion: 75,
    overdueTask: 15,
    reopenedTask: 5,
  },
  {
    id: "resp-3",
    submissionId: "SUB-003",
    user: "Robert Johnson",
    submissionDate: "2023-05-08",
    filledBy: "Robert Johnson",
    designation: "Inspector",
    department: "Quality",
    location: "Site A",
    status: "Complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 10,
  },
  {
    id: "resp-4",
    submissionId: "SUB-004",
    user: "Emily Davis",
    submissionDate: "2023-05-07",
    filledBy: "Emily Davis",
    designation: "Manager",
    department: "HR",
    location: "Headquarters",
    status: "Partial",
    taskCompletion: 60,
    overdueTask: 30,
    reopenedTask: 0,
  },
  {
    id: "resp-5",
    submissionId: "SUB-005",
    user: "Michael Wilson",
    submissionDate: "2023-05-06",
    filledBy: "Michael Wilson",
    designation: "Technician",
    department: "IT",
    location: "Site C",
    status: "Complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 0,
  },
]

interface FormResponsesProps {
  formId: string
}

export function FormResponses({ formId }: FormResponsesProps) {
  const [responses, setResponses] = useState(mockResponses)
  const [selectedResponses, setSelectedResponses] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const { toast } = useToast()

  const displayedResponses = responses.filter((response) => {
    const searchTermMatch =
      response.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.department.toLowerCase().includes(searchTerm.toLowerCase())

    const statusMatch = statusFilter === "all" || !statusFilter ? true : response.status === statusFilter
    const locationMatch = locationFilter === "all" || !locationFilter ? true : response.location === locationFilter

    const dateMatch =
      dateRange.from && dateRange.to
        ? new Date(response.submissionDate) >= dateRange.from && new Date(response.submissionDate) <= dateRange.to
        : true

    return searchTermMatch && statusMatch && locationMatch && dateMatch
  })

  // Handle response selection for bulk actions
  const toggleResponseSelection = (responseId: string) => {
    setSelectedResponses((prev) =>
      prev.includes(responseId) ? prev.filter((id) => id !== responseId) : [...prev, responseId],
    )
  }

  // Handle select all responses
  const toggleSelectAll = () => {
    if (selectedResponses.length === displayedResponses.length) {
      setSelectedResponses([])
    } else {
      setSelectedResponses(displayedResponses.map((response) => response.id))
    }
  }

  // Handle bulk download
  const handleBulkDownload = () => {
    if (selectedResponses.length === 0) return

    toast({
      title: "Download Responses",
      description: `Downloading ${selectedResponses.length} responses.`,
    })

    // In a real app, you would trigger a download
  }

  // Handle bulk print
  const handleBulkPrint = () => {
    if (selectedResponses.length === 0) return

    toast({
      title: "Print Responses",
      description: `Printing ${selectedResponses.length} responses.`,
    })

    // In a real app, you would trigger a print
  }

  // Handle bulk reassign
  const handleBulkReassign = () => {
    if (selectedResponses.length === 0) return

    toast({
      title: "Reassign Responses",
      description: `Reassigning ${selectedResponses.length} responses.`,
    })

    // In a real app, you would open a reassign dialog
  }

  // Handle response actions
  const handleResponseAction = (action: string, responseId: string) => {
    // Handle different actions based on the action type
    switch (action) {
      case "view":
        toast({
          title: "View Response",
          description: `Viewing response ${responseId}.`,
        })
        break
      case "download":
        toast({
          title: "Download Response",
          description: `Downloading response ${responseId}.`,
        })
        break
      case "print":
        toast({
          title: "Print Response",
          description: `Printing response ${responseId}.`,
        })
        break
      case "reassign":
        toast({
          title: "Reassign Response",
          description: `Reassigning response ${responseId}.`,
        })
        break
      default:
        toast({
          title: "Unknown Action",
          description: `Unknown action ${action} for response ${responseId}.`,
        })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-semibold">Form Responses</h1>
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Search responses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded="false"
                className="w-[180px] justify-start text-left font-normal"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium leading-none">Status</h4>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Complete">Complete</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium leading-none">Location</h4>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Site A">Site A</SelectItem>
                      <SelectItem value="Site B">Site B</SelectItem>
                      <SelectItem value="Site C">Site C</SelectItem>
                      <SelectItem value="Headquarters">Headquarters</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <h4 className="text-sm font-medium leading-none mb-2">Date Range</h4>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          !dateRange.from ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.from?.toLocaleDateString() + " - " + dateRange.to?.toLocaleDateString()
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="start">
                      <Calendar
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Users
          </Button>
        </div>
      </div>

      {selectedResponses.length > 0 && (
        <div className="flex items-center space-x-2 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Bulk Actions ({selectedResponses.length} selected)
                <MoreHorizontal className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleBulkDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBulkPrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBulkReassign}>
                <UserPlus className="mr-2 h-4 w-4" />
                Reassign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedResponses.length === displayedResponses.length && displayedResponses.length > 0}
                  indeterminate={selectedResponses.length > 0 && selectedResponses.length < displayedResponses.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all responses"
                />
              </TableHead>
              <TableHead>Submission ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Submission Date</TableHead>
              <TableHead>Filled By</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Task Completion</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedResponses.map((response) => (
              <TableRow key={response.id}>
                <TableCell className="font-medium">
                  <Checkbox
                    checked={selectedResponses.includes(response.id)}
                    onCheckedChange={() => toggleResponseSelection(response.id)}
                    aria-label={`Select response ${response.id}`}
                  />
                </TableCell>
                <TableCell>{response.submissionId}</TableCell>
                <TableCell>{response.user}</TableCell>
                <TableCell>{response.submissionDate}</TableCell>
                <TableCell>{response.filledBy}</TableCell>
                <TableCell>{response.designation}</TableCell>
                <TableCell>{response.department}</TableCell>
                <TableCell>{response.location}</TableCell>
                <TableCell>
                  <Badge variant={response.status === "Complete" ? "success" : "secondary"}>{response.status}</Badge>
                </TableCell>
                <TableCell>
                  <Progress value={response.taskCompletion} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleResponseAction("view", response.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResponseAction("download", response.id)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResponseAction("print", response.id)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResponseAction("reassign", response.id)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Reassign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {displayedResponses.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center">
                  No responses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
