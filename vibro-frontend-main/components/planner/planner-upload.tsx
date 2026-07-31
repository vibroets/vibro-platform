"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Check, AlertCircle } from "lucide-react"
import { useUser } from "@/components/user-provider"
import { PlannerAdherenceSummary } from "./planner-adherence-summary"

export function PlannerUpload() {
  const { user } = useUser()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<boolean>(false)
  const [success, setSuccess] = useState<boolean>(false)

  // Only Super Admin and Admin can upload templates
  const canUpload = user.role === "Super Admin" || user.role === "Admin"

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setPreview(false)
      setSuccess(false)
    }
  }

  const handlePreview = () => {
    if (file) {
      setPreview(true)
    }
  }

  const handleAssign = () => {
    if (file && preview) {
      setSuccess(true)
    }
  }

  if (!canUpload) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription>You do not have permission to upload templates.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Check className="mr-2 h-5 w-5 text-green-500" />
            Template Assigned Successfully
          </CardTitle>
          <CardDescription>The template has been processed and assignments have been created.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Assignment summary</h3>
                <div className="mt-2 text-sm text-green-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Total assignments created: 24</li>
                    <li>Forms assigned: 12</li>
                    <li>Tasks assigned: 8</li>
                    <li>Locations affected: 4</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        {success && (
          <div className="mt-4">
            <PlannerAdherenceSummary />
          </div>
        )}
        <CardFooter>
          <Button
            onClick={() => {
              setFile(null)
              setPreview(false)
              setSuccess(false)
            }}
          >
            Upload Another Template
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Template Preview</CardTitle>
          <CardDescription>Review the assignments before confirming</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4">
              <h3 className="font-medium">File: {file?.name}</h3>
              <p className="text-sm text-muted-foreground">Size: {(file?.size || 0) / 1024} KB</p>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Form ID</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Warehouse A</TableCell>
                    <TableCell>FORM-001</TableCell>
                    <TableCell>Operations Team</TableCell>
                    <TableCell>2023-05-15</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Warehouse B</TableCell>
                    <TableCell>FORM-002</TableCell>
                    <TableCell>Logistics Team</TableCell>
                    <TableCell>2023-05-16</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Office Building</TableCell>
                    <TableCell>FORM-003</TableCell>
                    <TableCell>Admin Team</TableCell>
                    <TableCell>2023-05-17</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      ... 21 more rows
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setPreview(false)}>
            Back
          </Button>
          <Button onClick={handleAssign}>Confirm and Assign</Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Template</CardTitle>
        <CardDescription>Upload a CSV or Excel file with assignment details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Drag and drop your file here, or click to browse</p>
            <Input id="file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <Label htmlFor="file" className="cursor-pointer">
              <Button variant="secondary" type="button">
                <FileText className="mr-2 h-4 w-4" />
                Browse Files
              </Button>
            </Label>
          </div>

          {file && (
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Template Requirements</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>File must be in CSV or Excel format</li>
                    <li>Required columns: Location, Form ID, Assigned To, Due Date</li>
                    <li>Optional columns: Priority, Notes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handlePreview} disabled={!file}>
          Preview Assignments
        </Button>
      </CardFooter>
    </Card>
  )
}

// Helper component for the preview table
function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full">{children}</table>
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>
}

function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>
}

function TableRow({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>
}

function TableHead({
  children,
  className,
  colSpan,
}: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <th className={`p-2 text-left font-medium text-muted-foreground ${className || ""}`} colSpan={colSpan}>
      {children}
    </th>
  )
}

function TableCell({
  children,
  className,
  colSpan,
}: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`p-2 border-t ${className || ""}`} colSpan={colSpan}>
      {children}
    </td>
  )
}
