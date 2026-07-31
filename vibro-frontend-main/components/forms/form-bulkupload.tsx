"use client"

import type React from "react"
import { useRef } from "react";

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, Check, AlertCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function FormBulkUploadForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<boolean>(false)
  const [success, setSuccess] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("forms")

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

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
      toast({
        title: "Assignments Created",
        description: "24 assignments have been created successfully.",
        variant: "default",
      })
    }
  }

  const handleDownloadTemplate = () => {
    toast({
      title: "Template Downloaded",
      description: "The template has been downloaded to your device.",
      variant: "default",
    })
  }

  // if (success) {
  //   return (
  //     <Card>
  //       <CardHeader>
  //         <CardTitle className="flex items-center">
  //           <Check className="mr-2 h-5 w-5 text-green-500" />
  //           Template Assigned Successfully
  //         </CardTitle>
  //         <CardDescription>The template has been processed and assignments have been created.</CardDescription>
  //       </CardHeader>
  //       <CardContent>
  //         <div className="rounded-md bg-green-50 p-4">
  //           <div className="flex">
  //             <div className="flex-shrink-0">
  //               <Check className="h-5 w-5 text-green-400" />
  //             </div>
  //             <div className="ml-3">
  //               <h3 className="text-sm font-medium text-green-800">Assignment summary</h3>
  //               <div className="mt-2 text-sm text-green-700">
  //                 <ul className="list-disc pl-5 space-y-1">
  //                   <li>Total assignments created: 24</li>
  //                   <li>Forms assigned: 12</li>
  //                   <li>Tasks assigned: 8</li>
  //                   <li>Locations affected: 4</li>
  //                 </ul>
  //               </div>
  //             </div>
  //           </div>
  //         </div>

  //         <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
  //           <div className="rounded-md bg-blue-50 p-4">
  //             <div className="flex">
  //               <div className="flex-shrink-0">
  //                 <Info className="h-5 w-5 text-blue-400" />
  //               </div>
  //               <div className="ml-3">
  //                 <h3 className="text-sm font-medium text-blue-800">Form Assignments</h3>
  //                 <div className="mt-2 text-sm text-blue-700">
  //                   <ul className="list-disc pl-5 space-y-1">
  //                     <li>Safety Inspection Forms: 5</li>
  //                     <li>Inventory Check Forms: 4</li>
  //                     <li>Quality Control Forms: 3</li>
  //                   </ul>
  //                 </div>
  //               </div>
  //             </div>
  //           </div>

  //           <div className="rounded-md bg-purple-50 p-4">
  //             <div className="flex">
  //               <div className="flex-shrink-0">
  //                 <Info className="h-5 w-5 text-purple-400" />
  //               </div>
  //               <div className="ml-3">
  //                 <h3 className="text-sm font-medium text-purple-800">Task Assignments</h3>
  //                 <div className="mt-2 text-sm text-purple-700">
  //                   <ul className="list-disc pl-5 space-y-1">
  //                     <li>Maintenance Tasks: 3</li>
  //                     <li>Inspection Tasks: 2</li>
  //                     <li>Follow-up Tasks: 3</li>
  //                   </ul>
  //                 </div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       </CardContent>
  //       <CardFooter className="flex justify-between">
  //         <Button variant="outline" onClick={() => router.push("/planner")}>
  //           Back to Planner
  //         </Button>
  //         <Button
  //           onClick={() => {
  //             setFile(null)
  //             setPreview(false)
  //             setSuccess(false)
  //           }}
  //         >
  //           Upload Another Template
  //         </Button>
  //       </CardFooter>
  //     </Card>
  //   )
  // }

  if (preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Template Preview</CardTitle>
          {/* <CardDescription>Review the assignments before confirming</CardDescription> */}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4">
              <h3 className="font-medium">File: {file?.name}</h3>
              <p className="text-sm text-muted-foreground">Size: {((file?.size || 0) / 1024).toFixed(2)} KB</p>
            </div>

            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="forms">Forms (12)</TabsTrigger>
                {/* <TabsTrigger value="tasks">Tasks (8)</TabsTrigger> */}
              </TabsList>
              <TabsContent value="forms" className="border rounded-md mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Form Type</TableHead>
                      <TableHead>Repeat Schedule</TableHead>
                      <TableHead>Responses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Daily Safety Inspection</TableCell>
                      <TableCell>John Doe</TableCell>
                      <TableCell>2023-04-15</TableCell>
                      <TableCell>Audit</TableCell>
                      <TableCell>Daily</TableCell>
                      <TableCell>145</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Site Inspection Report</TableCell>
                      <TableCell>Robert Johnson</TableCell>
                      <TableCell>2023-02-10</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Monthly</TableCell>
                      <TableCell>32</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Quality Assurance Audit</TableCell>
                      <TableCell>Emily Davis</TableCell>
                      <TableCell>2023-01-05</TableCell>
                      <TableCell>Standard</TableCell>
                      <TableCell>Quarterly</TableCell>
                      <TableCell>16</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        ... 9 more rows
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>
              {/* <TabsContent value="tasks" className="border rounded-md mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Warehouse A</TableCell>
                      <TableCell>Maintenance</TableCell>
                      <TableCell>Maintenance Team</TableCell>
                      <TableCell>2023-05-18</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Distribution Center</TableCell>
                      <TableCell>Inspection</TableCell>
                      <TableCell>Quality Team</TableCell>
                      <TableCell>2023-05-19</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Office Building</TableCell>
                      <TableCell>Follow-up</TableCell>
                      <TableCell>Admin Team</TableCell>
                      <TableCell>2023-05-20</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        ... 5 more rows
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent> */}
            </Tabs>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          {/* <Button variant="outline" onClick={() => setPreview(false)}>
            Back
          </Button> */}
          <Button onClick={handleAssign}>Confirm and Submit</Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Template</CardTitle>
        <CardDescription>Upload a CSV or Excel file </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Drag and drop your file here, or click to browse</p>
            <Input type="file" id="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <Label htmlFor="file" className="cursor-pointer">
              <Button variant="secondary" type="button" onClick={handleFileButtonClick}>
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
                    <li>Required columns: Title, Author, Created Date, Formtype, Respones ,etc..</li>
                    <li>Optional columns: Priority, Notes, Type (Form)</li>
                  </ul>
                </div>
                <div className="mt-2">
                  <Button variant="link" className="p-0 h-auto text-yellow-800" onClick={handleDownloadTemplate}>
                    Download Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => setFile(null)}>
          Discard
        </Button>
        <Button onClick={handlePreview} disabled={!file}>
          Preview Assignments
        </Button>
      </CardFooter>
    </Card>
  )
}

// Helper components for the preview table
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
