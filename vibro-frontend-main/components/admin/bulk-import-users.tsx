"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"  // CHANGE: Add useSearchParams
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileUp, Check, AlertCircle, Download } from "lucide-react"
import Papa from 'papaparse';
import axiosInstance from "@/utils/axiosInstance";


interface ValidationError {
  row: number
  user: string
  field: string
  message: string
}

interface UserData {
  [key: string]: string | boolean | number
}

interface ImportResult {
  imported_count: number
  failed_count: number
  failed_records: ValidationError[]
}

export function BulkImportUsers() {
  const router = useRouter()
  const searchParams = useSearchParams()  // ADD: Read query params for orgId
  const { toast } = useToast()
  const [step, setStep] = useState<"upload" | "validation" | "summary">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<UserData[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const orgId = searchParams.get('orgId')  // ADD: Extract orgId from URL

  const appFields = [
    { value: "firstName", label: "First Name" },
    { value: "lastName", label: "Last Name" },
    { value: "employeeId", label: "Employee ID" },
    { value: "countryCode", label: "Country Code" },
    { value: "phone", label: "Phone" },
    { value: "designation", label: "Designation" },
    { value: "division", label: "Division" },
    { value: "subdivision", label: "SubDivision" },
    { value: "location", label: "Location" },
    { value: "department", label: "Department" },
    { value: "email", label: "Email" },
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (!selectedFile.name.endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        })
        return
      }
      setFile(selectedFile)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const templateData = [
        {
          firstName: "John",
          lastName: "Doe",
          employeeId: "EMP123",
          countryCode: "+1",
          phone: "1234567890",
          designation: "manager",
          division: "operations",
          subdivision: "subdivision_a",
          location: "warehouse_a",
          department: "hr",
          email: "john.doe@example.com",
          // mobileSupervisor: false,
          // dashboardAccess: true,
        },
      ]
      const csv = Papa.unparse(templateData)
      const blob = new Blob([csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "bulk_user_import_template.csv"
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: "Download Error",
        description: "Failed to download the template",
        variant: "destructive",
      })
    }
  }

  const handleUpload = () => {
    if (!file) return

    setIsProcessing(true)

    Papa.parse<string[]>(file, {
      complete: (result: Papa.ParseResult<string[]>) => {
        const data = result.data
        if (data.length < 2) {
          toast({
            title: "Invalid CSV",
            description: "CSV file must contain at least one header row and one data row",
            variant: "destructive",
          })
          setIsProcessing(false)
          return
        }

        const headers: string[] = data[0]
        const rows = data.slice(1).filter((row: string[]) => row.some((cell: string) => cell.trim() !== "")).map((row: string[], index: number) => {
          const rowData: UserData = {}
          headers.forEach((header: string, colIndex: number) => {
            const value = row[colIndex]?.trim()
            rowData[header] = value || ""
          })
          return rowData
        })

        setHeaders(headers)
        setCsvData(rows)
        setIsProcessing(false)
        handleValidate(rows, headers) // Directly proceed to validation
      },
      header: false,
      skipEmptyLines: true,
      error: () => {
        toast({
          title: "Error parsing CSV",
          description: "Failed to parse the CSV file",
          variant: "destructive",
        })
        setIsProcessing(false)
      },
    })
  }

  const handleValidate = async (data: UserData[], headers: string[]) => {
    setIsProcessing(true)

    const accessToken = localStorage.getItem("access_token")
    if (!accessToken) {
      toast({
        title: "Authentication Error",
        description: "Please log in to continue",
        variant: "destructive",
      })
      router.push("/login")
      setIsProcessing(false)
      return
    }

    // Automatic mapping based on header names
    const mapping = headers.map((header: string) => {
      const matchedField = appFields.find(
        (field: { label: string; value: string }) => field.label.toLowerCase() === header.toLowerCase() || field.value.toLowerCase() === header.toLowerCase()
      )
      return {
        csvColumn: header,
        appField: matchedField ? matchedField.value : "do_not_import",
      }
    })

    // Local validation for required fields and duplicates
    const localErrors: ValidationError[] = []
    const seenEmails: Set<string> = new Set()
    const seenPhones: Set<string> = new Set()
    const seenEmployeeIds = new Set()  // ADD: Track employeeId duplicates
    const requiredFields = ["firstName", "lastName", "countryCode", "phone", "email", "designation", "division", "subdivision", "location", "department", "employeeId"]  // ADD: employeeId to required

    const mappedData = data.map((row: UserData, index: number) => {
      const mappedRow: UserData = {}
      const firstName = row.firstName?.toString().trim() || ""
      const lastName = row.lastName?.toString().trim() || ""
      const userName = `${firstName} ${lastName}`.trim() || `Row ${index + 2}`

      // Check required fields
      requiredFields.forEach((field) => {
        const value = row[field]?.toString().trim()
        if (!value) {
          localErrors.push({
            row: index + 2,
            user: userName,
            field: field,
            message: `Missing required field: ${field}`,
          })
        }
      })

      // Check for duplicates in the CSV
      const email = row.email?.toString().trim().toLowerCase()
      const phone = row.phone?.toString().trim()
      const employeeId = row.employeeId?.toString().trim() || row.EMP_ID?.toString().trim()  // ADD: Fallback for EMP_ID

      if (email) {
        if (seenEmails.has(email)) {
          localErrors.push({
            row: index + 2,
            user: userName,
            field: "email",
            message: `Duplicate email found: ${email}`,
          })
        } else {
          seenEmails.add(email)
        }
      }

      if (phone) {
        if (seenPhones.has(phone)) {
          localErrors.push({
            row: index + 2,
            user: userName,
            field: "phone",
            message: `Duplicate phone found: ${phone}`,
          })
        } else {
          seenPhones.add(phone)
        }
      }

      if (employeeId) {  // ADD: Check employeeId duplicates
        if (seenEmployeeIds.has(employeeId)) {
          localErrors.push({
            row: index + 2,
            user: userName,
            field: "employeeId",
            message: `Duplicate employee ID found: ${employeeId}`,
          })
        } else {
          seenEmployeeIds.add(employeeId)
        }
      }

      // Map the CSV columns to app fields
      mapping.forEach((map) => {
        if (map.appField && map.appField !== "do_not_import") {
          let value: string | boolean | number = row[map.csvColumn]
          mappedRow[map.appField] = value
        }
      })

      return { ...mappedRow, rowIndex: index + 2 }
    })

    // Call backend validation
    let backendErrors: ValidationError[] = []
    try {
      const payload = {  // CHANGE: Wrap in payload with orgId
        data: mappedData,
        organizationId: orgId || null,
      }
      const result = await axiosInstance.post("/users/bulk-validate", payload)
      backendErrors = result.data.errors || []
    } catch (error: any) {
      if (error.response) {
        const result = error.response.data
        if (result.errors && Array.isArray(result.errors)) {
          backendErrors = result.errors
        } else {
          toast({
            title: "Validation Error",
            description: result.error || "Failed to validate data",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Network Error",
          description: "Failed to connect to the server",
          variant: "destructive",
        })
      }
    }

    // Combine and deduplicate errors
    const allErrorsMap = new Map<string, ValidationError>()
    for (const error of [...localErrors, ...backendErrors]) {
      const key = `${error.row}-${error.field}-${error.message}`
      allErrorsMap.set(key, error)
    }
    const allErrors = Array.from(allErrorsMap.values())
    setValidationErrors(allErrors)
    setStep("validation")
    setIsProcessing(false)
  }

  const handleConfirm = async () => {
    setIsProcessing(true)

    const accessToken = localStorage.getItem("access_token")
    if (!accessToken) {
      toast({
        title: "Authentication Error",
        description: "Please log in to continue",
        variant: "destructive",
      })
      setImportResult({
        imported_count: 0,
        failed_count: validRecords.length,
        failed_records: validRecords.map((_, index) => ({
          row: index + 2,
          user: `Row ${index + 2}`,
          field: "auth",
          message: "Authentication failed",
        })),
      })
      setStep("summary")
      setIsProcessing(false)
      setIsDialogOpen(false)
      return
    }

    // Filter out rows with validation errors
    const validRows = csvData
      .map((row: UserData, index: number) => ({ row, originalIndex: index + 2 }))
      .filter(({ originalIndex }: { originalIndex: number }) => !validationErrors.some((error: ValidationError) => error.row === originalIndex))
      .map(({ row, originalIndex }: { row: UserData; originalIndex: number }) => {
                const mappedRow: UserData = {
          firstName: row.firstName || "",
          lastName: row.lastName || "",
          employeeId: row.employeeId || row.EMP_ID || "",  // ADD: Fallback for EMP_ID
          countryCode: row.countryCode || "",
          phone: row.phone || "",
          designation: row.designation || "",
          division: row.division || "",
          subdivision: row.subdivision || "",
          location: row.location || "",
          department: row.department || "",
          email: row.email || "",
        }

        // Automatic mapping
        headers.forEach((header: string) => {
          const matchedField = appFields.find(
            (field: { label: string; value: string }) => field.label.toLowerCase() === header.toLowerCase() || field.value.toLowerCase() === header.toLowerCase()
          )
          if (matchedField && matchedField.value !== "do_not_import") {
            let value: string | boolean | number = row[header] || ""
            mappedRow[matchedField.value] = value
          }
        })

        return { ...mappedRow, rowIndex: originalIndex }
      })

    try {
      const payload = {  // CHANGE: Wrap in payload with orgId
        data: validRows,
        organizationId: orgId || null,
      }
      const result = await axiosInstance.post("/users/bulk-import", payload)
      setImportResult(result.data)
      toast({
        title: "Import Complete",
        description: `${result.data.imported_count} users imported successfully`,
      })
    } catch (error: any) {
      if (error.response) {
        const result = error.response.data
        setImportResult({
          imported_count: 0,
          failed_count: validRows.length,
          failed_records: result.errors || validRows.map((row) => ({
            row: row.rowIndex,
            user: `Row ${row.rowIndex}`,
            field: "import",
            message: result.error || "Failed to import",
          })),
        })
        toast({
          title: "Import Error",
          description: result.error || "Failed to import users",
          variant: "destructive",
        })
      } else {
        setImportResult({
          imported_count: 0,
          failed_count: validRows.length,
          failed_records: validRows.map((row) => ({
            row: row.rowIndex,
            user: `Row ${row.rowIndex}`,
            field: "network",
            message: "Failed to connect to the server",
          })),
        })
        toast({
          title: "Network Error",
          description: "Failed to connect to the server",
          variant: "destructive",
        })
      }
    } finally {
      setStep("summary")
      setIsProcessing(false)
      setIsDialogOpen(false)
    }
  }

  const handleDownloadValidationErrors = () => {
    const reportData = validationErrors.map((error: ValidationError) => ({
      Row: error.row,
      User: error.user,
      Field: error.field,
      Issue: error.message,
    }))

    const csv = Papa.unparse(reportData)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "validation_errors.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDownloadReport = () => {
    if (!importResult) return

    const reportData = importResult.failed_records.map((record: ValidationError) => ({
      Row: record.row,
      User: record.user,
      Field: record.field,
      Issue: record.message,
    }))

    const csv = Papa.unparse(reportData)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bulk_import_report.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Filter valid records for display in the validation tab
  const validRecords = csvData
    .map((row: UserData, index: number) => ({ row, originalIndex: index + 2 }))
    .filter(({ originalIndex }: { originalIndex: number }) => !validationErrors.some((error: ValidationError) => error.row === originalIndex))
    .map(({ row }: { row: UserData }) => row)

  useEffect(() => {
    console.log("Valid Records Length:", validRecords.length)
    console.log("Valid Records:", validRecords)
  }, [validRecords])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardDescription>Upload a CSV file to import multiple users at once</CardDescription>
        <Button variant="link" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-2" /> Click here to download the template
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-md p-1">
            <TabsTrigger 
              value="upload" 
              disabled={step !== "upload"}
              className="data-[state=active]:bg-blue-200 rounded-md transition-colors duration-200"
            >
              Upload
            </TabsTrigger>
            <TabsTrigger 
              value="validation" 
              disabled={step !== "validation"}
              className="data-[state=active]:bg-blue-200 rounded-md transition-colors duration-200"
            >
              Validation
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              disabled={step !== "summary"}
              className="data-[state=active]:bg-blue-200 rounded-md transition-colors duration-200"
            >
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="py-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Drag and drop your CSV file here, or click to browse. Download the template above to ensure correct format.
              </p>
              <div className="flex flex-col items-center gap-4">
                <Input type="file" accept=".csv" onChange={handleFileChange} className="max-w-sm" />
                <Button onClick={handleUpload} disabled={!file || isProcessing}>
                  {isProcessing ? "Processing..." : "Upload and Continue"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="validation" className="py-4">
            <div className="space-y-6">
              {validationErrors.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-md p-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <AlertCircle className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-yellow-800">Validation Issues Found</h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              We found {validationErrors.length} issues with your data. Please review the errors below.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Issue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationErrors.map((error: ValidationError, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell>{error.user}</TableCell>
                              <TableCell>{error.field}</TableCell>
                              <TableCell>{error.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleDownloadValidationErrors}>
                        <Download className="h-4 w-4 mr-2" /> Download Errors
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-green-50 p-4 border border-green-200">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Validation Successful</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>All {csvData.length} records passed validation and are ready to be imported.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {validRecords.length > 0 && (
                <div className="rounded-md ">
                  <div className="flex bg-green-50  px-4 py-6 rounded-md" >
                    <div className="flex-shrink-0">
                      <FileUp className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="ml-3 flex-1" >
                      <h3 className="text-sm font-medium text-green-700">Valid Records Ready to Import</h3>
                      <div className="mt-2 text-sm text-green-600">
                        <p>
                          {validRecords.length} valid records are ready to be imported into the system.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          {headers.map((header: string, index: number) => (
                            <TableHead key={index}>{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRecords.map((row: UserData, rowIndex: number) => (
                          <TableRow key={rowIndex}>
                            {headers.map((header: string, cellIndex: number) => (
                              <TableCell key={cellIndex}>{row[header]?.toString() || ""}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                {validRecords.length > 0 && (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button disabled={isProcessing}>
                        {isProcessing ? "Importing..." : "Confirm Import"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Bulk Import</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to import {validRecords.length} users? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleConfirm} disabled={isProcessing}>
                          {isProcessing ? "Importing..." : "Confirm"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="py-4">
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 border border-green-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Check className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Import Summary</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>
                          Successfully imported {importResult?.imported_count ?? 0} users.
                          {importResult && importResult.failed_count > 0 && ` ${importResult.failed_count} records failed to import.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              {importResult && importResult?.failed_records?.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult?.failed_records?.map((error: ValidationError, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell>{error.user}</TableCell>
                          <TableCell>{error.field}</TableCell>
                          <TableCell>{error.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => router.push("/admin?refresh=true")}>
                  Back to Admin
                </Button>
                {importResult && importResult?.failed_records?.length > 0 && (
                  <Button onClick={handleDownloadReport}>
                    <Download className="h-4 w-4 mr-2" /> Download Report
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
