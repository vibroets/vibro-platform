"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import { bulkImportResponses, getPoll, type PollResponse } from "@/data/polls"

interface PollResponseUploadProps {
  pollId: string
}

export function PollResponseUpload({ pollId }: PollResponseUploadProps) {
  const router = useRouter()
  const { toast } = useToast()

  const poll = getPoll(pollId)

  const [step, setStep] = useState<"upload" | "validate" | "complete">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({})
  const [progress, setProgress] = useState(0)

  if (!poll) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Poll not found</h2>
          <p className="text-muted-foreground">The poll you're looking for doesn't exist or has been deleted.</p>
          <Button className="mt-4" onClick={() => router.push("/polls")}>
            Back to Polls
          </Button>
        </div>
      </div>
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setProgress(0)

    // Simulate file reading
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        // Simulate progress
        const interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 100) {
              clearInterval(interval)
              return 100
            }
            return prev + 10
          })
        }, 200)

        // Parse CSV or JSON (simulated here)
        const mockData = [
          {
            respondent: "User 1",
            answers: [
              { questionId: poll.questions[0].id, answer: poll.questions[0].type === "rating" ? 4 : "Option 1" },
              {
                questionId: poll.questions[1]?.id,
                answer: poll.questions[1]?.type === "checkbox" ? ["Option 1", "Option 2"] : "Option 2",
              },
            ],
          },
          {
            respondent: "User 2",
            answers: [
              { questionId: poll.questions[0].id, answer: poll.questions[0].type === "rating" ? 5 : "Option 2" },
              {
                questionId: poll.questions[1]?.id,
                answer: poll.questions[1]?.type === "checkbox" ? ["Option 2"] : "Option 1",
              },
            ],
          },
          {
            respondent: "User 3",
            answers: [
              { questionId: poll.questions[0].id, answer: poll.questions[0].type === "rating" ? 3 : "Option 3" },
              {
                questionId: poll.questions[1]?.id,
                answer: poll.questions[1]?.type === "checkbox" ? ["Option 1", "Option 3"] : "Option 3",
              },
            ],
          },
        ]

        setResponses(mockData)

        // Validate the data
        const errors: Record<number, string[]> = {}

        mockData.forEach((response, index) => {
          const rowErrors: string[] = []

          // Check if respondent is provided
          if (!response.respondent) {
            rowErrors.push("Respondent name is required")
          }

          // Check if all required questions are answered
          poll.questions.forEach((question) => {
            if (question.required) {
              const answer = response.answers.find((a) => a.questionId === question.id)
              if (!answer) {
                rowErrors.push(`Answer for question "${question.question}" is required`)
              }
            }
          })

          if (rowErrors.length > 0) {
            errors[index] = rowErrors
          }
        })

        setValidationErrors(errors)

        // Move to validation step
        setTimeout(() => {
          setStep("validate")
        }, 2000)
      } catch (error) {
        toast({
          title: "Error parsing file",
          description: "Please make sure the file is in the correct format.",
          variant: "destructive",
        })
      }
    }

    reader.readAsText(file)
  }

  const handleImport = () => {
    // Check if there are any validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: "Validation errors",
        description: "Please fix the validation errors before importing.",
        variant: "destructive",
      })
      return
    }

    try {
      // Format responses for import
      const formattedResponses = responses.map((response) => ({
        pollId,
        respondent: response.respondent,
        answers: response.answers,
      }))

      // Import responses
      bulkImportResponses(formattedResponses as Omit<PollResponse, "id" | "submittedOn">[])

      // Show success message
      toast({
        title: "Import successful",
        description: `${formattedResponses.length} responses have been imported.`,
      })

      // Move to complete step
      setStep("complete")
    } catch (error) {
      toast({
        title: "Import failed",
        description: "An error occurred while importing the responses.",
        variant: "destructive",
      })
    }
  }

  const handleCancel = () => {
    router.push(`/polls/${pollId}`)
  }

  const handleViewResponses = () => {
    router.push(`/polls/${pollId}?tab=responses`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Import Responses</CardTitle>
          <CardDescription>Import multiple responses for {poll.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={step} value={step} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload" disabled={step !== "upload"}>
                Upload File
              </TabsTrigger>
              <TabsTrigger value="validate" disabled={step !== "validate"}>
                Validate Data
              </TabsTrigger>
              <TabsTrigger value="complete" disabled={step !== "complete"}>
                Complete
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-2 mt-4">
                <Label htmlFor="file">Upload File</Label>
                <div className="border-2 border-dashed rounded-md p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">Upload a file</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop or click to upload a CSV or JSON file
                  </p>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileChange}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>

              {file && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-sm text-muted-foreground">({(file.size / 1024).toFixed(2)} KB)</span>
                  </div>

                  {progress > 0 && progress < 100 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="validate" className="space-y-4">
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Validation Results</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{responses.length} responses found</span>
                    <span className="text-sm text-muted-foreground">|</span>
                    <span className="text-sm text-red-500">{Object.keys(validationErrors).length} with errors</span>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Row</TableHead>
                      <TableHead>Respondent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[300px]">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response, index) => (
                      <TableRow key={index} className={validationErrors[index] ? "bg-red-50" : "bg-green-50"}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{response.respondent}</TableCell>
                        <TableCell>
                          {validationErrors[index] ? (
                            <div className="flex items-center text-red-500">
                              <AlertCircle className="h-4 w-4 mr-2" />
                              <span>Error</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-green-500">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              <span>Valid</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {validationErrors[index] ? (
                            <ul className="text-sm text-red-500 list-disc pl-4">
                              {validationErrors[index].map((error, eIndex) => (
                                <li key={eIndex}>{error}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-green-500">No issues</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="complete" className="space-y-4">
              <div className="text-center p-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <h3 className="mt-4 text-xl font-medium">Import Complete</h3>
                <p className="text-muted-foreground mt-2">
                  {responses.length} responses have been successfully imported.
                </p>
                <div className="mt-6">
                  <Button onClick={handleViewResponses}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    View Responses
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {step === "upload" && (
            <Button onClick={handleUpload} disabled={!file}>
              Upload and Validate
            </Button>
          )}
          {step === "validate" && (
            <Button onClick={handleImport} disabled={Object.keys(validationErrors).length > 0}>
              Import Responses
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
