"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Upload, FileText, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function BulkAssignPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "full_access", {
    redirectInsufficient: "/attendance/shifts",
    redirectNoAccess: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [file, setFile] = useState<File | null>(null)
  const [isUploaded, setIsUploaded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      // Simulate file processing
      setTimeout(() => {
        setIsUploaded(true)
      }, 1000)
    }
  }

  const handleProcess = () => {
    setIsProcessing(true)
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false)
      setIsComplete(true)
      toast({
        title: "Shifts assigned successfully",
        description: "25 shifts have been assigned to employees.",
      })
    }, 2000)
  }

  const handleDownloadTemplate = () => {
    // In a real app, this would download a CSV template
    toast({
      title: "Template downloaded",
      description: "The CSV template has been downloaded.",
    })
  }

  // Mock preview data
  const previewData = [
    {
      employeeId: "EMP001",
      employeeName: "John Doe",
      shift: "Morning",
      startDate: "2023-05-01",
      endDate: "2023-05-31",
      location: "Warehouse A",
      hasGps: true,
    },
    {
      employeeId: "EMP002",
      employeeName: "Jane Smith",
      shift: "Evening",
      startDate: "2023-05-01",
      endDate: "2023-05-31",
      location: "Warehouse B",
      hasGps: true,
    },
    {
      employeeId: "EMP003",
      employeeName: "Michael Johnson",
      shift: "Morning",
      startDate: "2023-05-01",
      endDate: "2023-05-31",
      location: "Office Building",
      hasGps: false,
    },
    {
      employeeId: "EMP004",
      employeeName: "Sarah Williams",
      shift: "Custom",
      startDate: "2023-05-01",
      endDate: "2023-05-31",
      location: "Remote",
      hasGps: false,
    },
    {
      employeeId: "EMP005",
      employeeName: "Robert Brown",
      shift: "Morning",
      startDate: "2023-05-01",
      endDate: "2023-05-31",
      location: "Warehouse A",
      hasGps: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/attendance/shifts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Assign Shifts</h1>
      </div>

      {!isComplete ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload Shift Assignments</CardTitle>
            <CardDescription>
              Upload a CSV file with employee shift assignments.
              <Button variant="link" className="h-auto p-0" onClick={handleDownloadTemplate}>
                Download template
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isUploaded ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-10">
                <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <Input id="file-upload" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Select File
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-muted-foreground mr-4" />
                    <div>
                      <p className="font-medium">{file?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file?.size ? `${(file.size / 1024).toFixed(2)} KB` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null)
                      setIsUploaded(false)
                    }}
                  >
                    Remove
                  </Button>
                </div>

                <div className="border rounded-md">
                  <div className="p-4 border-b">
                    <h3 className="font-medium">Preview (First 5 rows)</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>GPS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.employeeId}</TableCell>
                          <TableCell>{row.employeeName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.shift === "Morning" ? "default" : row.shift === "Evening" ? "secondary" : "outline"
                              }
                            >
                              {row.shift}
                            </Badge>
                          </TableCell>
                          <TableCell>{`${row.startDate} to ${row.endDate}`}</TableCell>
                          <TableCell>{row.location}</TableCell>
                          <TableCell>{row.hasGps ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-4 border-t">
                    <p className="text-sm text-muted-foreground">Total records: 25 (showing 5 of 25)</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/attendance/shifts")}>
              Cancel
            </Button>
            <Button onClick={handleProcess} disabled={!isUploaded || isProcessing}>
              {isProcessing ? "Processing..." : "Process Assignments"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <CheckCircle className="mr-2 h-5 w-5" />
              Assignments Complete
            </CardTitle>
            <CardDescription>All shift assignments have been processed successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="border rounded-md p-4">
                  <p className="text-sm text-muted-foreground">Total Assignments</p>
                  <p className="text-2xl font-bold">25</p>
                </div>
                <div className="border rounded-md p-4">
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-green-600">25</p>
                </div>
                <div className="border rounded-md p-4">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">0</p>
                </div>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Assignment Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm">Morning Shift</p>
                    <p className="text-sm font-medium">15</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm">Evening Shift</p>
                    <p className="text-sm font-medium">8</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm">Custom Shift</p>
                    <p className="text-sm font-medium">2</p>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <p className="text-sm font-medium">Total</p>
                    <p className="text-sm font-medium">25</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/attendance/shifts")} className="w-full">
              Return to Shift Assignments
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
