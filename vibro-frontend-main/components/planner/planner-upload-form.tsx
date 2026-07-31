"use client"

import type React from "react"
import { useRef, useEffect } from "react";

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"

import { Upload, FileText, Check, AlertCircle, Info, Download, CheckCircle, ArrowLeft, FileUp, Share } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import axiosInstance from "@/utils/axiosInstance"
import hotToaster from "react-hot-toast"
import Papa from 'papaparse';
import { useSelector } from "react-redux"
import { selectUser } from "@/redux/slices/authSlice"
import * as XLSX from 'xlsx';

interface ValidationError {
  row: number
  planner: string
  field: string
  message: string
}

interface PlannerRowData {
  [key: string]: string | boolean | number
}

interface ImportResult {
  imported_count: number
  failed_count: number
  failed_records: ValidationError[]
}

export function PlannerUploadForm() {
  const router = useRouter()
  const { toast } = useToast()
  const user = useSelector(selectUser)
  const organizationId = user?.organization

  const headerLabels: Record<string, string> = {
    'planner_name': 'Planner Name',
    'location': 'Location',
    'form': 'Form',
    'start_date': 'Start Date',
    'end_date': 'End Date',
    'description': 'Description',
  }
  const getHeaderLabel = (key: string) => headerLabels[key] || key

  const [step, setStep] = useState<"upload" | "validation" | "summary" | "sharing">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<PlannerRowData[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImported, setIsImported] = useState(false)
  const [createdPlannerAssignments, setCreatedPlannerAssignments] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedLeaders, setSelectedLeaders] = useState<number[]>([])
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [availableGroups, setAvailableGroups] = useState<any[]>([])
  const [availableLeaders, setAvailableLeaders] = useState<any[]>([])

  // Repeat planner settings
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatIntervalDays, setRepeatIntervalDays] = useState(50)
  const [earlyNotificationDays, setEarlyNotificationDays] = useState(3)

  // Folder settings
  const [folders, setFolders] = useState<{id: number; name: string; color: string}[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>("")

  // Removed unused ref - not needed for this implementation

  useEffect(() => {
    console.log('PlannerUploadForm step state:', step)
    if (step === 'validation') {
      // small non-intrusive toast to indicate navigation to validation
      toast({ title: 'Validation', description: 'Showing validation results' })
    }
  }, [step])

  // Fetch folders on mount
  useEffect(() => {
    axiosInstance.get("/planner/folders/")
      .then(res => setFolders(res.data || []))
      .catch(err => console.error("Failed to fetch folders:", err))
  }, [])

  // Helpers to convert Excel serial dates to JS Date and formatted strings
  const excelSerialToDate = (serial: number): Date => {
    // Excel stores dates as days since 1899-12-31 with a bug for 1900 leap year.
    // JS epoch is 1970-01-01. Use standard conversion: (serial - 25569) * 86400 * 1000
    const utcDays = serial - 25569
    const utcValue = Math.round(utcDays * 86400 * 1000)
    return new Date(utcValue)
  }

  const formatDateForDisplay = (val: any): string => {
    if (val == null || val === '') return ''
    // If it's a number (Excel serial), convert to date and display as YYYY-MM-DD 00:00
    if (typeof val === 'number') {
      const d = excelSerialToDate(val)
      // For Excel dates (date-only inputs), show the date as-is with 00:00 time
      // Don't apply timezone conversion that changes the date itself
      const yyyy = d.getUTCFullYear()
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd} 00:00` // Always show 00:00 for Excel date-only inputs
    }
    // If it's a Date object
    if (val instanceof Date) {
      const d = val
      // Convert UTC to IST (UTC+5:30)
      const istTime = new Date(d.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000))
      const yyyy = istTime.getFullYear()
      const mm = String(istTime.getMonth() + 1).padStart(2, '0')
      const dd = String(istTime.getDate()).padStart(2, '0')
      const hh = String(istTime.getHours()).padStart(2, '0')
      const min = String(istTime.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`
    }
    // Otherwise assume string
    return String(val)
  }

  const toIsoIfExcelDate = (val: any): string => {
    if (val == null || val === '') return ''
    if (typeof val === 'number') {
      return excelSerialToDate(val).toISOString()
    }
    if (val instanceof Date) return val.toISOString()
    // Try to parse string; if valid date, return ISO, else return original
    const parsed = new Date(String(val))
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
    return String(val)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      // More lenient file validation
      const fileName = selectedFile.name.toLowerCase()
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV or Excel file",
          variant: "destructive",
        })
        return
      }

      console.log("File selected:", selectedFile.name, selectedFile.type)
      setFile(selectedFile)

      // Reset state when new file is selected
      setCsvData([])
      setHeaders([])
      setValidationErrors([])
      setImportResult(null)
      setStep("upload")
    }
  }

  // Parse Excel file by converting to CSV-like format
  const parseExcelFile = (file: File): Promise<{ headers: string[]; rows: PlannerRowData[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        try {
          if (file.name.endsWith('.csv')) {
            // For CSV files, parse directly with Papa Parse
            const csvText = event.target?.result as string
            Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              complete: (results: any) => {
                const jsonData = results.data
                if (!jsonData || jsonData.length === 0) {
                  reject(new Error('CSV file is empty or invalid'))
                  return
                }

                const headers = Object.keys(jsonData[0] || {}).filter(h => h.trim() !== '')
                const rows: PlannerRowData[] = jsonData.map((row: any) => {
                  const plannerRow: PlannerRowData = {}
                  headers.forEach((header) => {
                    plannerRow[header] = row[header] || ''
                  })
                  return plannerRow
                })

                console.log('Parsed CSV - Headers:', headers, 'Rows:', rows.length)
                resolve({ headers, rows })
              },
              error: (error: any) => {
                reject(new Error(`Failed to parse CSV: ${error.message}`))
              }
            })
          } else {
            // For Excel files (.xlsx, .xls), parse binary with SheetJS (xlsx)
            const arrayBuffer = event.target?.result as ArrayBuffer
            try {
              const workbook = XLSX.read(arrayBuffer, { type: 'array' })
              const firstSheetName = workbook.SheetNames[0]
              const sheet = workbook.Sheets[firstSheetName]
              const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

              if (!jsonData || jsonData.length === 0) {
                reject(new Error('Excel file is empty or invalid format. Please ensure it contains data and is in CSV or Excel format.'))
                return
              }

              const headers = Object.keys(jsonData[0] || {}).filter(h => h && h.toString().trim() !== '')
              const rows: PlannerRowData[] = jsonData.map((row: any) => {
                const plannerRow: PlannerRowData = {}
                headers.forEach((header) => {
                  plannerRow[header] = row[header] || ''
                })
                return plannerRow
              })

              console.log('Parsed Excel (xlsx) - Headers:', headers, 'Rows:', rows.length)
              resolve({ headers, rows })
            } catch (err) {
              reject(new Error(`Failed to parse Excel (.xlsx/.xls) file: ${(err as Error).message}`))
            }
          }
        } catch (error) {
          console.error('Parse error:', error)
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      // Read as text for CSV, ArrayBuffer for Excel files
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file)
      } else {
        // Read binary for proper XLSX parsing
        reader.readAsArrayBuffer(file)
      }
    })
  }

  // Helper function to extract form ID from URL
  const extractFormIdFromUrl = (url: string): string | null => {
    // Match URLs like: https://domain.com/forms/form-123 or /forms/form-123
    const match = url.match(/\/forms\/form-(\d+)$/)
    return match ? match[1] : null
  }

  // Helper function to check if string is a URL
  const isUrl = (str: string): boolean => {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  // Validate data locally
  const validatePlannerRowData = async (data: PlannerRowData[], headers: string[]): Promise<ValidationError[]> => {
    const errors: ValidationError[] = []
    const requiredFields = ['planner_name', 'form', 'start_date', 'end_date']

    // Get unique forms from backend (prefer organization-scoped endpoint)
    let availableForms: any[] = []
    try {
      let response: any
      if (organizationId) {
        response = await axiosInstance.get(`/forms/organization/${organizationId}/`)
      } else {
        // Fall back to organization-scoped endpoint (no extra org id)
        response = await axiosInstance.get('/organization/forms/')
      }
      availableForms = response.data?.results || response.data?.forms || response.data || []
    } catch (error) {
      console.error('Failed to fetch forms:', error)
      // Continue validation without form checking if backend fails
    }

    data.forEach((row, index) => {
      const rowIndex = index + 2
      const plannerName = row.planner_name?.toString().trim() || `Row ${rowIndex}`

      // Check for missing required fields
      const missingFields: string[] = []
      requiredFields.forEach((field) => {
        const value = row[field]?.toString().trim()
        if (!value) {
          missingFields.push(field)
        }
      })

      if (missingFields.length > 0) {
        errors.push({
          row: rowIndex,
          planner: plannerName,
          field: missingFields.join(', '),
          message: `Missing required fields: ${missingFields.join(', ')}`
        })
      }

      // Check form against available forms (supports both names and URLs)
      const formValue = row.form?.toString().trim()
      if (formValue && availableForms.length > 0) {
        let formExists = false
        let validationType = 'name'

        if (isUrl(formValue)) {
          // Try to validate as URL
          const formId = extractFormIdFromUrl(formValue)
          if (formId) {
            formExists = availableForms.some((form: any) => form.id?.toString() === formId)
            validationType = 'url'
          }
        } else {
          // Validate as form name (existing logic)
          formExists = availableForms.some((form: any) =>
            form.title?.toLowerCase() === formValue.toLowerCase() ||
            form.name?.toLowerCase() === formValue.toLowerCase()
          )
        }

        if (!formExists) {
          const errorMessage = validationType === 'url'
            ? `Form URL "${formValue}" does not exist or is not accessible in your organization`
            : `Form name "${formValue}" does not exist or is not accessible in your organization`
          errors.push({
            row: rowIndex,
            planner: plannerName,
            field: 'form',
            message: errorMessage
          })
        }
      }
    })

    return errors
  }

  const handleValidate = async (data: PlannerRowData[], headers: string[]) => {
    setIsProcessing(true)

    try {
      const errors = await validatePlannerRowData(data, headers)
      setValidationErrors(errors)
      setStep("validation")
    } catch (error) {
      console.error('Validation error:', error)
      toast({
        title: "Validation Error",
        description: "Failed to validate the file. Please try again.",
        variant: "destructive",
      })
    }

    setIsProcessing(false)
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file first",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      console.log('Starting file upload with file:', file.name)
      
      // Parse Excel file
      const { headers: fileHeaders, rows: fileRows } = await parseExcelFile(file)
      console.log('File parsed successfully - Headers:', fileHeaders, 'Rows:', fileRows.length)
      console.log('First row data:', fileRows[0])
      
      // Normalize headers for comparison (lowercase, trim spaces, convert to underscore)
      const normalizeHeader = (header: string) => {
        return header.trim().toLowerCase().replace(/\s+/g, '_')
      }

      const normalizedHeaders = fileHeaders.map(normalizeHeader)
      console.log('Normalized headers:', normalizedHeaders)
      
      // Define required headers and their aliases (already normalized)
      const requiredHeaderMap: { [key: string]: string[] } = {
        'planner_name': ['planner_name', 'plannername', 'planner_no', 'plannerno', 'order_type'],
        'form': ['form', 'form_name', 'formname'],
        'start_date': ['start_date', 'startdate', 'start_on'],
        'end_date': ['end_date', 'enddate', 'end_on']
      }

      // Optional headers - mapped if present but not required
      const optionalHeaderMap: { [key: string]: string[] } = {
        'location': ['location', 'location_name', 'locationname', 'wtg_location', 'wtglocation'],
        'description': ['description', 'desc'],
      }

      // Find which original headers map to required fields
      const headerMapping: { [key: string]: string } = {}
      const missingFields: string[] = []

      Object.keys(requiredHeaderMap).forEach((requiredField) => {
        const aliases = requiredHeaderMap[requiredField]
        console.log(`Looking for ${requiredField} with aliases:`, aliases)
        
        const matchedIndex = normalizedHeaders.findIndex((normHeader) => {
          const isMatch = aliases.includes(normHeader)
          console.log(`  Checking ${normHeader} against aliases: ${isMatch}`)
          return isMatch
        })

        if (matchedIndex !== -1) {
          headerMapping[requiredField] = fileHeaders[matchedIndex]
          console.log(`✓ Matched ${requiredField} to column: "${fileHeaders[matchedIndex]}" (normalized: ${normalizedHeaders[matchedIndex]})`)
        } else {
          missingFields.push(requiredField)
          console.warn(`✗ Could not find column for: ${requiredField}`)
          console.warn(`  Available normalized headers: [${normalizedHeaders.join(', ')}]`)
        }
      })

      // Map optional headers if present
      Object.keys(optionalHeaderMap).forEach((optionalField) => {
        const aliases = optionalHeaderMap[optionalField]
        const matchedIndex = normalizedHeaders.findIndex((normHeader) => aliases.includes(normHeader))
        if (matchedIndex !== -1) {
          headerMapping[optionalField] = fileHeaders[matchedIndex]
        }
      })

      if (missingFields.length > 0) {
        // Use warn instead of error to avoid Next.js dev overlay for expected validation failures
        console.warn('Missing required headers:', missingFields)
        console.warn('Your file headers are:', fileHeaders)

        // Prepare a header-level validation error so the user can see it in the Validation tab
        const headerError: ValidationError = {
          // Use row 1 to indicate header row for clarity in UI
          row: 1,
          planner: 'Header',
          field: missingFields.join(', '),
          message: `Missing required columns: ${missingFields.join(', ')}`,
        }

        // Expose the headers (so table can render) and show the header error
        setCsvData([])
        setHeaders(fileHeaders)
        setValidationErrors([headerError])

        toast({
          title: "Invalid file format",
          description: `Missing required columns: ${missingFields.join(', ')}. Your file has: ${fileHeaders.join(', ')}`,
          variant: "destructive",
        })

        // Ensure processing flag is cleared and navigate to Validation tab so user can review
        setIsProcessing(false)
        setStep("validation")
        return
      }

      // Remap the data using the found headers. Convert Excel date serials for display.
      const remappedRows: PlannerRowData[] = fileRows.map((row) => {
        const remappedRow: PlannerRowData = {}
        Object.keys(headerMapping).forEach((standardField) => {
          const originalHeader = headerMapping[standardField]
          const rawVal = row[originalHeader]
          // For display, format date-like fields
          if (standardField === 'start_date' || standardField === 'end_date') {
            remappedRow[standardField] = formatDateForDisplay(rawVal)
          } else {
            remappedRow[standardField] = rawVal ?? ''
          }
        })
        // Also include any extra columns (description, etc)
        fileHeaders.forEach((header) => {
          if (!Object.values(headerMapping).includes(header)) {
            remappedRow[header] = row[header] ?? ''
          }
        })
        return remappedRow
      })

      console.log('Remapped rows:', remappedRows[0])
      
      // Set the data FIRST
      console.log('Setting CSV data and headers')
      setCsvData(remappedRows)
      setHeaders(['planner_name', 'location', 'form', 'start_date', 'end_date', 'description'])
      
      // Then perform validation
      console.log('Starting validation on', remappedRows.length, 'rows')
      
      // Get forms for validation (prefer organization-scoped endpoint)
      let availableForms: any[] = []
      try {
        let response: any
        if (organizationId) {
          response = await axiosInstance.get(`/forms/organization/${organizationId}/`)
        } else {
          // Fall back to organization-scoped endpoint
          response = await axiosInstance.get('/organization/forms/')
        }
        availableForms = response.data?.results || response.data?.forms || response.data || []
        console.log('Fetched forms:', availableForms.length)
      } catch (error) {
        console.error('Failed to fetch forms:', error)
        // Continue validation without form checking if backend fails
      }

      // Validate data
      const errors: ValidationError[] = []
      const validationRequiredFields = ['planner_name', 'form', 'start_date', 'end_date']

      remappedRows.forEach((row, index) => {
        const rowIndex = index + 2
        const plannerName = row.planner_name?.toString().trim() || `Row ${rowIndex}`

        // Check for missing required fields
        const missingFieldsList: string[] = []
        validationRequiredFields.forEach((field) => {
          const value = row[field]?.toString().trim()
          if (!value) {
            missingFieldsList.push(field)
          }
        })

        if (missingFieldsList.length > 0) {
          errors.push({
            row: rowIndex,
            planner: plannerName,
            field: missingFieldsList.join(', '),
            message: `Missing required fields: ${missingFieldsList.join(', ')}`
          })
        }

        // Check form against available forms (supports both names and URLs)
        const formValue = row.form?.toString().trim()
        if (formValue && availableForms.length > 0) {
          let formExists = false
          let validationType = 'name'

          if (isUrl(formValue)) {
            // Try to validate as URL
            const formId = extractFormIdFromUrl(formValue)
            if (formId) {
              formExists = availableForms.some((form: any) => form.id?.toString() === formId)
              validationType = 'url'
            }
          } else {
            // Validate as form name (existing logic)
            formExists = availableForms.some((form: any) =>
              form.title?.toLowerCase() === formValue.toLowerCase() ||
              form.name?.toLowerCase() === formValue.toLowerCase()
            )
          }

          if (!formExists) {
            const errorMessage = validationType === 'url'
              ? `Form URL "${formValue}" does not exist or is not accessible in your organization`
              : `Form name "${formValue}" does not exist or is not accessible in your organization`
            errors.push({
              row: rowIndex,
              planner: plannerName,
              field: 'form',
              message: errorMessage
            })
          }
        }
      })

      console.log('Validation complete - errors found:', errors.length)
      setValidationErrors(errors)
      setStep("validation")
      
      toast({
        title: "File loaded",
        description: `Loaded ${remappedRows.length} records for validation`,
      })
    } catch (error: any) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to load the file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Filter valid records for display and import
  const validRecords = csvData
    .map((row: PlannerRowData, index: number) => ({ row, originalIndex: index + 2 }))
    .filter(({ originalIndex }: { originalIndex: number }) => !validationErrors.some((error: ValidationError) => error.row === originalIndex))
    .map(({ row }: { row: PlannerRowData }) => row)

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
          planner: `Row ${index + 2}`,
          field: "auth",
          message: "Authentication failed",
        })),
      })
      setStep("summary")
      setIsProcessing(false)
      setIsDialogOpen(false)
      return
    }

    // Prepare valid records for import
    const recordsToImport: Array<PlannerRowData & { rowIndex: number }> = csvData
      .map((row: PlannerRowData, index: number) => ({ row, originalIndex: index + 2 }))
      .filter(({ originalIndex }: { originalIndex: number }) => !validationErrors.some((error: ValidationError) => error.row === originalIndex))
      .map(({ row, originalIndex }: { row: PlannerRowData; originalIndex: number }) => {
        const mapped = {
          planner_name: row.planner_name,
          location: row.location || '',
          form: row.form,
          start_date: toIsoIfExcelDate(row.start_date),
          end_date: toIsoIfExcelDate(row.end_date),
          description: row.description,
          rowIndex: originalIndex
        } as any
        console.log("Mapped record:", mapped)
        return mapped
      })

    console.log("Sending to backend:", recordsToImport)

    try {
      const response = await axiosInstance.post("/planner/bulk-import/", {
        data: recordsToImport,
        repeat_enabled: repeatEnabled,
        repeat_interval_days: repeatIntervalDays,
        early_notification_days: earlyNotificationDays,
        folder_id: selectedFolderId || undefined,
      })

      setImportResult({
        imported_count: response.data.success_count || recordsToImport.length,
        failed_count: response.data.errors?.length || 0,
        failed_records: response.data.errors?.map((error: any, index: number) => ({
          row: recordsToImport[index]?.rowIndex || index + 2,
          planner: recordsToImport[index]?.planner_name || `Row ${index + 2}`,
          field: 'import',
          message: error.error || error.message || 'Failed to import',
        })) || [],
      })

      // Store created planner assignments for sharing step
      setCreatedPlannerAssignments(response.data.created_assignments || [])

      toast({
        title: "Import Complete",
        description: `${response.data.success_count || recordsToImport.length} planners imported successfully`,
      })
      
      // Move to sharing step after successful import
      setStep("sharing")
      
      // Fetch available users, groups, and leaders for sharing
      fetchSharingData()
    } catch (error: any) {
      console.error("Import error:", error)
      console.error("Error response:", error.response)
      
      if (error.response) {
        const result = error.response.data
        console.error("Backend error details:", result)
        
        setImportResult({
          imported_count: 0,
          failed_count: recordsToImport.length,
          failed_records: result.errors || recordsToImport.map((row: any) => ({
            row: row.rowIndex,
            planner: row.planner_name || `Row ${row.rowIndex}`,
            field: "import",
            message: result.error || "Failed to import",
          })),
        })
        toast({
          title: "Import Error",
          description: result.error || "Failed to import planners",
          variant: "destructive",
        })
      } else {
        setImportResult({
          imported_count: 0,
          failed_count: recordsToImport.length,
          failed_records: recordsToImport.map((row: any) => ({
            row: row.rowIndex,
            planner: row.planner_name || `Row ${row.rowIndex}`,
            field: "network",
            message: "Failed to connect to the server",
          })),
        })
        toast({
          title: "Network Error",
          description: "Failed to connect to the server",
          variant: "destructive",
        })
        setStep("summary")
      }
    } finally {
      setIsProcessing(false)
      setIsDialogOpen(false)
    }
  }

  const fetchSharingData = async () => {
    try {
      // Fetch available users
      const usersRes = await axiosInstance.get("/users/list");
      setAvailableUsers(usersRes.data || []);
      
      // Fetch available groups
      const groupsRes = await axiosInstance.get("/groups/");
      setAvailableGroups(groupsRes.data || []);
      
      // Fetch available leaders (users with mobile_supervisor = true)
      const leaders = usersRes.data.filter((u: any) => u.mobile_supervisor);
      setAvailableLeaders(leaders || []);
    } catch (error) {
      console.error("Error fetching sharing data:", error);
      toast({
        title: "Error",
        description: "Failed to load users and groups for sharing",
        variant: "destructive",
      });
    }
  }

  const handleShare = async () => {
    if (createdPlannerAssignments.length === 0) {
      toast({
        title: "Error",
        description: "No planners to share",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Share each planner assignment with selected users/groups/leaders
      for (const assignment of createdPlannerAssignments) {
        await axiosInstance.post("/planner/share/", {
          planner_assignment_id: assignment.planner_assignment_id,
          users: selectedUsers,
          groups: selectedGroups,
          leaders: selectedLeaders,
        });
      }

      toast({
        title: "Success",
        description: `Shared ${createdPlannerAssignments.length} planners successfully`,
      });

      // Wait 1.5 seconds then navigate to planner main page
      setTimeout(() => {
        router.push("/planner");
      }, 1500);

      // Move to summary step
      setStep("summary");
      
      // Clear sharing selections
      setSelectedUsers([]);
      setSelectedGroups([]);
      setSelectedLeaders([]);
    } catch (error: any) {
      console.error("Error sharing planners:", error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to share planners",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const handleDownloadValidationErrors = () => {
    const reportData = validationErrors.map((error: ValidationError) => ({
      Row: error.row,
      Planner: error.planner,
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
      Planner: record.planner,
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



  const handleDownloadTemplate = async () => {
    try {
      console.log("Downloading template...")

      const response = await axiosInstance.get('/planner/download-template/', {
        responseType: 'blob',
        timeout: 10000, // 10 second timeout
      })

      console.log("Download response:", response)
      console.log("Response status:", response.status)
      console.log("Response headers:", response.headers)
      console.log("Response data size:", response.data?.size || 'unknown')

      if (!response.data) {
        throw new Error("No data received from server")
      }

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Get filename from content-disposition header or default
      const contentDisposition = response.headers['content-disposition']
      let filename = 'planner_template.xlsx'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '')
        }
      }

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the object URL
      window.URL.revokeObjectURL(url)

      toast({
        title: "Template downloaded",
        description: "The planner template has been downloaded successfully.",
      })

    } catch (error: any) {
      console.error("Error downloading template:", error)
      console.error("Error details:", error.response?.data, error.response?.status, error.message)

      let errorMessage = "Failed to download the template."
      if (error.response?.status === 401) {
        errorMessage = "Authentication required. Please log in again."
      } else if (error.response?.status === 404) {
        errorMessage = "Template not found on server."
      } else if (error.response?.status >= 500) {
        errorMessage = "Server error. Please try again later."
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = "Request timeout. Please check your connection."
      }

      toast({
        title: "Download failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Import Planners</CardTitle>
        <CardDescription>Bulk import planners by uploading a CSV or Excel file</CardDescription>
        <div className="flex items-center gap-2">
          <Button variant="link" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 rounded-md p-1">
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
              value="sharing"
              disabled={step !== "sharing"}
              className="data-[state=active]:bg-blue-200 rounded-md transition-colors duration-200"
            >
              Share
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
              <h3 className="text-lg font-medium mb-2">Bulk Import Planners</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Upload a CSV or Excel file with planner data. Download the template above for the correct format.
              </p>
              <div className="flex flex-col items-center gap-4">
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="max-w-sm" />
                <Button onClick={handleUpload} disabled={!file || isProcessing}>
                  {isProcessing ? "Processing..." : "Validate File"}
                </Button>
              </div>
            </div>

            {/* Folder Selection */}
            <div className="mt-6 border rounded-lg p-4 bg-gray-50">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Folder (optional)</Label>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full border rounded-md p-2 text-sm bg-white"
                >
                  <option value="">No Folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">All planners in this upload will be assigned to the selected folder.</p>
              </div>
            </div>

            {/* Repeat Planner Settings */}
            <div className="mt-6 border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="repeat-enabled"
                  checked={repeatEnabled}
                  onCheckedChange={(checked) => setRepeatEnabled(checked === true)}
                />
                <Label htmlFor="repeat-enabled" className="text-sm font-medium cursor-pointer">
                  Enable Repeat Planner
                </Label>
              </div>
              {repeatEnabled && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Repeat Interval (days)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={repeatIntervalDays}
                      onChange={(e) => setRepeatIntervalDays(Math.max(1, parseInt(e.target.value) || 0))}
                      placeholder="e.g., 50 or 100"
                      className="bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                      Planner will auto-reassign to the same users every N days
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Early Notification (days)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={earlyNotificationDays}
                      onChange={(e) => setEarlyNotificationDays(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="e.g., 3"
                      className="bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                      Users will see the planner N days before the start date
                    </p>
                  </div>
                </div>
              )}
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
                            <TableHead>Planner</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Issue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationErrors.map((error: ValidationError, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell>{error.planner}</TableCell>
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
                <div className="rounded-md">
                  <div className="flex bg-green-50 px-4 py-6 rounded-md">
                    <div className="flex-shrink-0">
                      <FileUp className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-green-700">Valid Records Ready to Import</h3>
                      <div className="mt-2 text-sm text-green-600">
                        <p>
                          {validRecords.length} valid records are ready to be imported into the system.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((header: string, index: number) => (
                            <TableHead key={index}>{getHeaderLabel(header)}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRecords.slice(0, 3).map((row: PlannerRowData, rowIndex: number) => (
                          <TableRow key={rowIndex}>
                            {headers.map((header: string, cellIndex: number) => (
                              <TableCell key={cellIndex}>{row[header]?.toString() || ""}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {validRecords.length > 3 && (
                          <TableRow>
                            <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
                              {validRecords.length - 3} more records...
                            </TableCell>
                          </TableRow>
                        )}
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
                        {isProcessing ? "Importing..." : "Ready to Upload"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Bulk Import</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to import {validRecords.length} planners? This action cannot be undone.
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

          <TabsContent value="sharing" className="py-4">
            <div className="space-y-6">
              <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Share className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-blue-800">Share Planners</h3>
                    <div className="mt-2 text-sm text-blue-600">
                      <p>
                        {createdPlannerAssignments.length} planners are ready to be shared. Select users, groups, or leaders to share them with.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Users Selection */}
                <div className="rounded-md border p-4">
                  <h4 className="font-medium mb-3">Users</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {availableUsers.map((user: any) => (
                      <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedUsers([...selectedUsers, user.id])
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                            }
                          }}
                        />
                        <span className="text-sm">{user.first_name} {user.last_name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Groups Selection */}
                <div className="rounded-md border p-4">
                  <h4 className="font-medium mb-3">Groups</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {availableGroups.map((group: any) => (
                      <label key={group.id} className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={selectedGroups.includes(group.id)}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedGroups([...selectedGroups, group.id])
                            } else {
                              setSelectedGroups(selectedGroups.filter(id => id !== group.id))
                            }
                          }}
                        />
                        <span className="text-sm">{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Leaders Selection */}
                <div className="rounded-md border p-4">
                  <h4 className="font-medium mb-3">Location Leaders</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {availableLeaders.map((leader: any) => (
                      <label key={leader.id} className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={selectedLeaders.includes(leader.id)}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedLeaders([...selectedLeaders, leader.id])
                            } else {
                              setSelectedLeaders(selectedLeaders.filter(id => id !== leader.id))
                            }
                          }}
                        />
                        <span className="text-sm">{leader.first_name} {leader.last_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => setStep("validation")}>
                  Back
                </Button>
                <Button onClick={handleShare} disabled={isProcessing || (selectedUsers.length === 0 && selectedGroups.length === 0 && selectedLeaders.length === 0)}>
                  {isProcessing ? "Sharing..." : "Share Planners"}
                </Button>
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
                        Successfully imported {importResult?.imported_count ?? 0} planners.
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
                        <TableHead>Planner</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult?.failed_records?.map((error: ValidationError, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell>{error.planner}</TableCell>
                          <TableCell>{error.field}</TableCell>
                          <TableCell>{error.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => router.push("/planner")}>
                  Back to Planner
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
