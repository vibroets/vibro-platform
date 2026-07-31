//@ts-nocheck
"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Download, Upload, FileText, ArrowUpLeftFromSquareIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft } from "lucide-react"

export function TaskBulkImport() {
  const router = useRouter()
  const [step, setStep] = useState<"upload" | "validate" | "importing" | "complete">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()

  // Sample validation data
  const validationData = [
    {
      row: 1,
      title: "Safety Training",
      incharge: "John Doe",
      startDate: "2023-05-01",
      dueDate: "2023-05-15",
      status: "valid",
    },
    {
      row: 2,
      title: "Inventory Check",
      incharge: "Jane Smith",
      startDate: "2023-05-05",
      dueDate: "2023-05-20",
      status: "valid",
    },
    {
      row: 3,
      title: "Equipment Maintenance",
      incharge: "",
      startDate: "2023-05-10",
      dueDate: "2023-05-25",
      status: "invalid",
      error: "Missing incharge",
    },
    {
      row: 4,
      title: "Customer Calls",
      incharge: "Michael Johnson",
      startDate: "2023-05-15",
      dueDate: "2023-05-10",
      status: "invalid",
      error: "Due date before start date",
    },
    {
      row: 5,
      title: "Report Submission",
      incharge: "Sarah Williams",
      startDate: "2023-05-20",
      dueDate: "2023-05-30",
      status: "valid",
    },
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      // In a real app, this would be an API call to validate the CSV
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setStep("validate")
      toast({
        title: "File uploaded",
        description: "Your CSV file has been uploaded and validated.",
      })
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload failed",
        description: "Failed to upload the file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleImport = async () => {
    setStep("importing")

    // Simulate progress updates
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 300)

    try {
      // In a real app, this would be an API call to import the validated data
      await new Promise((resolve) => setTimeout(resolve, 3000))

      clearInterval(interval)
      setProgress(100)

      setTimeout(() => {
        setStep("complete")
        toast({
          title: "Import complete",
          description: "All valid tasks have been successfully imported.",
        })
      }, 500)
    } catch (error) {
      clearInterval(interval)
      console.error("Error importing tasks:", error)
      toast({
        title: "Import failed",
        description: "Failed to import the tasks. Please try again.",
        variant: "destructive",
      })
      setStep("validate")
    }
  }

  const handleDownloadTemplate = () => {
    // In a real app, this would download a template file
    toast({
      title: "Template downloaded",
      description: "The CSV template has been downloaded.",
    })
  }

  const validTasks = validationData.filter((item) => item.status === "valid").length
  const invalidTasks = validationData.filter((item) => item.status === "invalid").length

  return (
    <>
    <div >
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft/>
        Back</Button>
    </div>
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Bulk Import Tasks</h1>
      <p className="text-muted-foreground">Upload a CSV file to create multiple tasks at once</p>
    </div><Card>

        {step === "upload" && (
          <>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload a CSV file containing task data. The file should include columns for Title, Incharge, Start Date,
                Due Date, and Description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} />
                <p className="text-sm text-muted-foreground">Maximum file size: 5MB. Only CSV files are supported.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() =>setFile(null) }>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!file || isUploading}>
                {isUploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Validate
                  </>
                )}
              </Button>
            </CardFooter>
          </>
        )}

        {step === "validate" && (
          <>
            <CardHeader>
              <CardTitle>Validate Data</CardTitle>
              <CardDescription>
                Review the data before importing. Fix any errors in the original CSV file and upload again if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invalidTasks > 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Validation Issues Found</AlertTitle>
                  <AlertDescription>
                    Found {validTasks} valid tasks and {invalidTasks} tasks with errors. Please fix the errors and upload
                    again, or proceed with importing only the valid tasks.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Validation Successful</AlertTitle>
                  <AlertDescription>All {validTasks} tasks are valid and ready to be imported.</AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Row</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Incharge</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationData.map((item) => (
                      <TableRow key={item.row} className={item.status === "invalid" ? "bg-red-50" : ""}>
                        <TableCell>{item.row}</TableCell>
                        <TableCell>{item.title}</TableCell>
                        <TableCell>{item.incharge || "-"}</TableCell>
                        <TableCell>{item.startDate}</TableCell>
                        <TableCell>{item.dueDate}</TableCell>
                        <TableCell>
                          {item.status === "valid" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {item.error}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validTasks === 0}
                className={invalidTasks > 0 ? "bg-yellow-600 hover:bg-yellow-700" : ""}
              >
                {invalidTasks > 0 ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Import {validTasks} Valid Tasks Only
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Import All Tasks
                  </>
                )}
              </Button>
            </CardFooter>
          </>
        )}

        {step === "importing" && (
          <>
            <CardHeader>
              <CardTitle>Importing Tasks</CardTitle>
              <CardDescription>Please wait while your tasks are being imported...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
              <div className="h-[200px] flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <FileText className="h-16 w-16 text-primary mb-2 animate-pulse" />
                  <p className="text-muted-foreground">Processing {validTasks} tasks...</p>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {step === "complete" && (
          <>
            <CardHeader>
              <CardTitle>Import Complete</CardTitle>
              <CardDescription>All tasks have been successfully imported.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>Successfully imported {validTasks} tasks.</AlertDescription>
              </Alert>

              <div className="rounded-md border p-4">
                <h3 className="font-medium mb-2">Summary</h3>
                <ul className="space-y-1 list-disc pl-5">
                  <li>Total tasks processed: {validationData.length}</li>
                  <li>Successfully imported: {validTasks}</li>
                  <li>Failed to import: {invalidTasks}</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={() => router.push("/tasks")}>Return to Tasks</Button>
            </CardFooter>
          </>
        )}
      </Card></>
  )
}
