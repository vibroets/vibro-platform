"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Edit, Trash, MapPin, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useModuleAccess } from "@/hooks/useModuleAccess"

interface ShiftAssignment {
  id: string
  userName: string
  employeeId: string
  shift: "Morning" | "Evening" | "Custom"
  dateRange: string
  location: string
  hasGpsBoundary: boolean
  latitude?: number
  longitude?: number
  radius?: number
}

export function ShiftAssignmentTable() {
  const router = useRouter()
  const { isFullAccess } = useModuleAccess("attendance")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentShift, setCurrentShift] = useState<ShiftAssignment | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterShift, setFilterShift] = useState<string | null>(null)

  const canEdit = isFullAccess

  const shifts: ShiftAssignment[] = [
    {
      id: "1",
      userName: "John Doe",
      employeeId: "EMP001",
      shift: "Morning",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Warehouse A",
      hasGpsBoundary: true,
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 100,
    },
    {
      id: "2",
      userName: "Jane Smith",
      employeeId: "EMP002",
      shift: "Evening",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Warehouse B",
      hasGpsBoundary: true,
      latitude: 37.7833,
      longitude: -122.4167,
      radius: 150,
    },
    {
      id: "3",
      userName: "Michael Johnson",
      employeeId: "EMP003",
      shift: "Morning",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Office Building",
      hasGpsBoundary: false,
    },
    {
      id: "4",
      userName: "Sarah Williams",
      employeeId: "EMP004",
      shift: "Custom",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Remote",
      hasGpsBoundary: false,
    },
    {
      id: "5",
      userName: "Robert Brown",
      employeeId: "EMP005",
      shift: "Morning",
      dateRange: "2023-04-15 to 2023-04-30",
      location: "Warehouse A",
      hasGpsBoundary: true,
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 100,
    },
  ]

  const filteredShifts = shifts.filter((shift) => {
    const matchesSearch =
      shift.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.location.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesShiftFilter = filterShift ? shift.shift === filterShift : true

    return matchesSearch && matchesShiftFilter
  })

  const toggleRow = (id: string) => {
    if (!canEdit) return
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    if (!canEdit) return
    setSelectedRows(selectedRows.length === filteredShifts.length ? [] : filteredShifts.map((shift) => shift.id))
  }

  const handleEdit = (shift: ShiftAssignment) => {
    setCurrentShift(shift)
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    // In a real app, this would save the changes to the database
    setIsEditDialogOpen(false)
    setCurrentShift(null)
    // Show success message
    alert("Shift updated successfully")
  }

  const handleDelete = (id: string) => {
    // In a real app, this would delete the shift from the database
    // For now, just show an alert
    alert(`Shift ${id} deleted`)
  }

  return (
    <>
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, ID, or location..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={filterShift || "all"}
            onValueChange={(value) => setFilterShift(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Evening">Evening</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedRows.length === filteredShifts.length && filteredShifts.length > 0}
                    onCheckedChange={toggleAll}
                    disabled={!canEdit}
                    aria-label="Select all"
                  />
                </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>GPS Boundary</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShifts.map((shift) => (
              <TableRow key={shift.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(shift.id)}
                      onCheckedChange={() => toggleRow(shift.id)}
                      disabled={!canEdit}
                      aria-label={`Select row ${shift.id}`}
                    />
                  </TableCell>
                <TableCell className="font-medium">{shift.userName}</TableCell>
                <TableCell>{shift.employeeId}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      shift.shift === "Morning" ? "default" : shift.shift === "Evening" ? "secondary" : "outline"
                    }
                  >
                    {shift.shift}
                  </Badge>
                </TableCell>
                <TableCell>{shift.dateRange}</TableCell>
                <TableCell>{shift.location}</TableCell>
                <TableCell>
                  {shift.hasGpsBoundary ? (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Enabled
                    </Badge>
                  ) : (
                    "None"
                  )}
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
                      {canEdit && (
                        <>
                          <DropdownMenuItem onClick={() => handleEdit(shift)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Shift
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(shift.id)}>
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Shift Assignment</DialogTitle>
          </DialogHeader>
          {currentShift && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" value={currentShift.userName} className="col-span-3" disabled />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shift" className="text-right">
                  Shift
                </Label>
                <Select defaultValue={currentShift.shift}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dateRange" className="text-right">
                  Date Range
                </Label>
                <Input id="dateRange" value={currentShift.dateRange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Input id="location" value={currentShift.location} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">GPS Boundary</Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Checkbox id="hasGpsBoundary" checked={currentShift.hasGpsBoundary} />
                  <label
                    htmlFor="hasGpsBoundary"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Enable GPS boundary
                  </label>
                </div>
              </div>
              {currentShift.hasGpsBoundary && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="latitude" className="text-right">
                      Latitude
                    </Label>
                    <Input id="latitude" type="number" value={currentShift.latitude} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="longitude" className="text-right">
                      Longitude
                    </Label>
                    <Input id="longitude" type="number" value={currentShift.longitude} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="radius" className="text-right">
                      Radius (m)
                    </Label>
                    <Input id="radius" type="number" value={currentShift.radius ?? ""} className="col-span-3" />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
