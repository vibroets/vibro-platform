//@ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Edit,
  Share,
  Copy,
  Trash,
  X,
  Download,
  Filter,
  ChevronDown,
  CheckCircle,
  BarChart2,
  Calendar,
  Search,
  Upload,
  Users,
  Clock,
  EyeOff,
  Building2,
  TrendingUp,
  MapPin,
  History,
  Activity,
  PieChart,
} from "lucide-react"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import axiosInstance from "@/utils/axiosInstance"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResponsiveBar } from "@nivo/bar"
import { ResponsivePie } from "@nivo/pie"
import { ResponsiveLine } from "@nivo/line"

interface PollDetailProps {
  pollId: string
  initialTab?: string
}

export function PollDetail({ pollId, initialTab = "view" }: PollDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { isFullAccess } = useModuleAccess("polls")

  const [poll, setPoll] = useState<any | null>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [shares, setShares] = useState<any[]>([])
  const [summaryStats, setSummaryStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const canEdit = isFullAccess

  useEffect(() => {
    axiosInstance.get(`/poll/polls/${pollId}/`).then((res) => {
      const p = res.data
      setPoll({
        id: String(p.id),
        title: p.title,
        description: p.description,
        category: p.category,
        pollType: p.poll_type,
        thumbnail: p.thumbnail,
        createdBy: p.created_by_name || "—",
        createdOn: p.created_on ? new Date(p.created_on).toLocaleDateString() : "—",
        status: p.is_active ? "Active" : "Closed",
        responseCount: p.response_count || 0,
        isPinned: false,
        removeOnCompletion: false,
        startDate: p.start_date,
        endDate: p.end_date,
        anonymous: p.anonymous,
        allowMultipleResponses: p.allow_multiple_responses,
        is_active: p.is_active,
        questions: (p.questions || []).map((q: any) => ({
          id: String(q.id),
          type: q.question_type,
          question: q.question_text,
          options: q.options || [],
          required: q.required,
        })),
      })
      setLoading(false)
    }).catch(() => {
      toast({ title: "Error", description: "Failed to load poll.", variant: "destructive" })
      setLoading(false)
    })

    // Fetch responses
    axiosInstance.get(`/poll/polls/${pollId}/responses/`).then((res) => {
      setResponses(res.data || [])
    }).catch(() => {})

    // Fetch summary stats
    axiosInstance.get(`/poll/polls/${pollId}/summary/`).then((res) => {
      setSummaryStats(res.data)
    }).catch(() => {})
  }, [pollId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading poll...</p>
      </div>
    )
  }

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

  const handleShare = () => {
    router.push(`/polls/${pollId}/edit`)
  }

  const handleEdit = () => {
    router.push(`/polls/${pollId}/edit`)
  }

  const handleDuplicate = async () => {
    try {
      const pollData = {
        title: `${poll.title} (Copy)`,
        description: poll.description,
        category: poll.category,
        poll_type: poll.pollType || "Single Choice",
        thumbnail: poll.thumbnail,
        start_date: poll.startDate,
        end_date: poll.endDate,
        anonymous: poll.anonymous,
        allow_multiple_responses: poll.allowMultipleResponses,
        questions: poll.questions.map((q: any) => ({
          question_text: q.question,
          question_type: q.type,
          options: q.options || [],
          required: q.required,
        })),
      }
      const res = await axiosInstance.post("/poll/polls/", pollData)
      toast({ title: "Poll duplicated", description: "The poll has been duplicated successfully." })
      router.push(`/polls/${res.data.id}/edit`)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to duplicate poll.", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      await axiosInstance.delete(`/poll/polls/${pollId}/`)
      setDeleteDialogOpen(false)
      toast({ title: "Poll deleted", description: "The poll has been deleted successfully." })
      router.push("/polls")
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete poll.", variant: "destructive" })
    }
  }

  const handleClosePoll = async () => {
    try {
      await axiosInstance.patch(`/poll/polls/${pollId}/`, { is_active: false })
      setPoll({ ...poll, status: "Closed", is_active: false })
      toast({ title: "Poll closed", description: "The poll has been closed successfully." })
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to close poll.", variant: "destructive" })
    }
  }

  const handleTogglePin = () => {
    if (poll) {
      setPoll({ ...poll, isPinned: !poll.isPinned })
      toast({
        title: poll.isPinned ? "Poll unpinned" : "Poll pinned",
        description: poll.isPinned
          ? "The poll has been unpinned successfully."
          : "The poll has been pinned successfully.",
      })
    }
  }

  const handleToggleRemoveOnCompletion = () => {
    if (poll) {
      setPoll({ ...poll, removeOnCompletion: !poll.removeOnCompletion })
      toast({
        title: "Setting updated",
        description: poll.removeOnCompletion
          ? "The poll will no longer be removed on completion."
          : "The poll will be removed on completion.",
      })
    }
  }

  const handleExportResponses = async () => {
    try {
      const lines = ["Respondent,Department,Question,Answer,Submitted On"]
      for (const response of responses) {
        for (const ans of response.answers || []) {
          const answerStr = Array.isArray(ans.answer) ? ans.answer.join("; ") : String(ans.answer ?? "")
          const escapedAnswer = `"${answerStr.replace(/"/g, '""')}"`
          const escapedName = `"${(response.respondent || "").replace(/"/g, '""')}"`
          const escapedDept = `"${(response.department || "").replace(/"/g, '""')}"`
          const escapedQuestion = `"${(ans.question || "").replace(/"/g, '""')}"`
          lines.push(`${escapedName},${escapedDept},${escapedQuestion},${escapedAnswer},${response.submittedOn}`)
        }
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `poll-${pollId}-responses.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Responses exported", description: "CSV file downloaded successfully." })
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to export responses.", variant: "destructive" })
    }
  }

  // Generate summary data for charts
  const generateSummaryData = () => {
    if (!poll || responses.length === 0) return []

    const summaryData: any[] = []

    poll.questions.forEach((question) => {
      if (question.type === "multiple-choice" || question.type === "checkbox") {
        const optionCounts: Record<string, number> = {}

        // Initialize counts
        question.options?.forEach((option) => {
          optionCounts[option] = 0
        })

        // Count responses
        responses.forEach((response) => {
          const answer = response.answers.find((a) => a.questionId === question.id)
          if (answer) {
            if (Array.isArray(answer.answer)) {
              ;(answer.answer as string[]).forEach((option) => {
                optionCounts[option] = (optionCounts[option] || 0) + 1
              })
            } else {
              optionCounts[answer.answer as string] = (optionCounts[answer.answer as string] || 0) + 1
            }
          }
        })

        // Format for charts
        const chartData = Object.entries(optionCounts).map(([option, count]) => ({
          option,
          count,
          id: option,
          value: count,
          label: option,
        }))

        summaryData.push({
          question: question.question,
          type: question.type,
          data: chartData,
        })
      } else if (question.type === "rating") {
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

        // Count ratings
        responses.forEach((response) => {
          const answer = response.answers.find((a) => a.questionId === question.id)
          if (answer && typeof answer.answer === "number") {
            ratingCounts[answer.answer as keyof typeof ratingCounts] += 1
          }
        })

        // Format for charts
        const chartData = Object.entries(ratingCounts).map(([rating, count]) => ({
          option: `Rating ${rating}`,
          count,
          id: `Rating ${rating}`,
          value: count,
          label: `Rating ${rating}`,
        }))

        summaryData.push({
          question: question.question,
          type: "rating",
          data: chartData,
        })
      }
    })

    return summaryData
  }

  const summaryData = generateSummaryData()

  return (
    <div className="space-y-6">
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="shares">Shares</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {poll.title}
                    <Badge variant={poll.status === "Active" ? "default" : "secondary"}>{poll.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Created by {poll.createdBy} on {poll.createdOn}
                  </CardDescription>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/polls/${pollId}/bulk-import`)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleShare}>
                      <Share className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={handleDuplicate}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {poll.is_active && (
                          <DropdownMenuItem onSelect={handleClosePoll}>
                            <X className="mr-2 h-4 w-4" />
                            Close Poll
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setDeleteDialogOpen(true)}>
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {poll.thumbnail && (
                <div className="rounded-md overflow-hidden max-h-48">
                  <img
                    src={poll.thumbnail || "/placeholder.svg"}
                    alt={poll.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Response Count</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{poll.responseCount}</div>
                  </CardContent>
                </Card>

                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={poll.status === "Active" ? "default" : "secondary"}>{poll.status}</Badge>
                  </CardContent>
                </Card>

                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{poll.questions.length}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pinned">Pin Poll</Label>
                      <p className="text-sm text-muted-foreground">Pinned polls appear at the top of the list</p>
                    </div>
                    <Switch id="pinned" checked={poll.isPinned || false} onCheckedChange={handleTogglePin} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="remove-on-completion">Remove on Completion</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically remove the poll from user's view after they complete it
                      </p>
                    </div>
                    <Switch
                      id="remove-on-completion"
                      checked={poll.removeOnCompletion || false}
                      onCheckedChange={handleToggleRemoveOnCompletion}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Questions</h3>
                <div className="space-y-4">
                  {poll.questions.map((question, index) => (
                    <Card key={question.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                          {index + 1}. {question.question}
                          {question.required && <span className="text-red-500 ml-1">*</span>}
                        </CardTitle>
                        <CardDescription>
                          Type: {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(question.type === "multiple-choice" || question.type === "checkbox") && (
                          <div className="space-y-2">
                            {question.options?.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-center space-x-2">
                                {question.type === "multiple-choice" ? (
                                  <div className="h-4 w-4 rounded-full border" />
                                ) : (
                                  <div className="h-4 w-4 rounded-sm border" />
                                )}
                                <span>{option}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {question.type === "rating" && (
                          <div className="flex gap-4 items-center">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <div key={rating} className="text-center">
                                <div className="h-8 w-8 rounded-full border flex items-center justify-center">
                                  {rating}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {question.type === "text" && (
                          <div className="h-20 border rounded-md bg-muted/20 p-2">
                            <span className="text-muted-foreground">Text input field</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          {/* Dashboard Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Eligible Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryStats?.total_eligible_users ?? 0}</div>
                <p className="text-xs text-muted-foreground">Users shared with this poll</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Responses Received</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summaryStats?.responses_received ?? 0}</div>
                <p className="text-xs text-muted-foreground">Users who submitted</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Responses</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{summaryStats?.pending_responses ?? 0}</div>
                <p className="text-xs text-muted-foreground">Users yet to respond</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Percentage</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{summaryStats?.response_percentage ?? 0}%</div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${summaryStats?.response_percentage ?? 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Anonymous Responses</CardTitle>
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryStats?.anonymous_responses ?? 0}</div>
                <p className="text-xs text-muted-foreground">Responses without user identity</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Poll Status</CardTitle>
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge variant={poll.status === "Active" ? "default" : "secondary"}>{poll.status}</Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {poll.questions.length} question{poll.questions.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Response Trends - Line Chart */}
          {summaryStats?.response_trends && summaryStats.response_trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Response Trends
                </CardTitle>
                <CardDescription>Daily and cumulative response counts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] border rounded-md p-4">
                  <ResponsiveLine
                    data={[
                      {
                        id: "Daily Responses",
                        color: "hsl(210, 70%, 50%)",
                        data: summaryStats.response_trends.map((t: any) => ({ x: t.date, y: t.count })),
                      },
                      {
                        id: "Cumulative",
                        color: "hsl(140, 70%, 50%)",
                        data: summaryStats.cumulative_trends.map((t: any) => ({ x: t.date, y: t.count })),
                      },
                    ]}
                    margin={{ top: 20, right: 50, bottom: 80, left: 60 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: 0, max: "auto" }}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 30,
                      legend: "Date",
                      legendOffset: 60,
                      legendPosition: "middle",
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: "Count",
                      legendOffset: -40,
                      legendPosition: "middle",
                    }}
                    colors={{ datum: "color" }}
                    pointSize={6}
                    pointColor={{ theme: "background" }}
                    pointBorderWidth={2}
                    pointBorderColor={{ from: "serieColor" }}
                    pointLabelYOffset={-12}
                    useMesh={true}
                    legends={[
                      {
                        anchor: "top-right",
                        direction: "row",
                        justify: false,
                        translateX: 0,
                        translateY: -20,
                        itemsSpacing: 2,
                        itemWidth: 100,
                        itemHeight: 20,
                        itemDirection: "left-to-right",
                        itemOpacity: 0.85,
                        symbolSize: 12,
                        effects: [{ on: "hover", style: { itemOpacity: 1 } }],
                      },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participation Rate - Pie Chart */}
          {summaryStats && (summaryStats.responses_received > 0 || summaryStats.pending_responses > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Participation Rate
                  </CardTitle>
                  <CardDescription>Responded vs Pending distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsivePie
                      data={[
                        { id: "Responded", value: summaryStats.responses_received ?? 0, color: "hsl(140, 70%, 50%)" },
                        { id: "Pending", value: summaryStats.pending_responses ?? 0, color: "hsl(30, 70%, 50%)" },
                      ]}
                      margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                      innerRadius={0.5}
                      padAngle={0.7}
                      cornerRadius={3}
                      colors={{ datum: "color" }}
                      borderWidth={1}
                      borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
                      radialLabelsSkipAngle={10}
                      radialLabelsTextColor="#333333"
                      radialLabelsLinkColor={{ from: "color" }}
                      sliceLabelsSkipAngle={10}
                      sliceLabelsTextColor="#333333"
                      legends={[
                        {
                          anchor: "bottom",
                          direction: "row",
                          justify: false,
                          translateX: 0,
                          translateY: 56,
                          itemsSpacing: 0,
                          itemWidth: 100,
                          itemHeight: 18,
                          itemDirection: "left-to-right",
                          itemOpacity: 1,
                          symbolSize: 18,
                          symbolShape: "circle",
                        },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Department-wise Participation - Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Department-wise Participation
                  </CardTitle>
                  <CardDescription>Responded vs Pending by department</CardDescription>
                </CardHeader>
                <CardContent>
                  {summaryStats?.department_participation && summaryStats.department_participation.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveBar
                        data={summaryStats.department_participation.map((d: any) => ({
                          department: d.department,
                          Responded: d.responded,
                          Pending: d.pending,
                        }))}
                        keys={["Responded", "Pending"]}
                        indexBy="department"
                        groupMode="grouped"
                        margin={{ top: 20, right: 50, bottom: 80, left: 60 }}
                        padding={0.3}
                        valueScale={{ type: "linear" }}
                        colors={{ scheme: "category10" }}
                        axisBottom={{
                          tickSize: 5,
                          tickPadding: 5,
                          tickRotation: 20,
                          legend: "Department",
                          legendPosition: "middle",
                          legendOffset: 60,
                        }}
                        axisLeft={{
                          tickSize: 5,
                          tickPadding: 5,
                          tickRotation: 0,
                          legend: "Users",
                          legendPosition: "middle",
                          legendOffset: -40,
                        }}
                        labelSkipWidth={12}
                        labelSkipHeight={12}
                        labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
                        animate={true}
                        motionStiffness={90}
                        motionDamping={15}
                        legends={[
                          {
                            dataFrom: "keys",
                            anchor: "top-right",
                            direction: "row",
                            justify: false,
                            translateX: 0,
                            translateY: -20,
                            itemsSpacing: 2,
                            itemWidth: 80,
                            itemHeight: 20,
                            itemDirection: "left-to-right",
                            itemOpacity: 0.85,
                            symbolSize: 12,
                            effects: [{ on: "hover", style: { itemOpacity: 1 } }],
                          },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No department data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Department-wise Participation Table */}
          {summaryStats?.department_participation && summaryStats.department_participation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Department Participation Details</CardTitle>
                <CardDescription>Detailed breakdown by department</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Total Eligible</TableHead>
                      <TableHead className="text-center">Responded</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryStats.department_participation.map((dept: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{dept.department}</TableCell>
                        <TableCell className="text-center">{dept.total}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{dept.responded}</TableCell>
                        <TableCell className="text-center text-orange-600 font-medium">{dept.pending}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${dept.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{dept.percentage}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Group-wise & Location-wise Participation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Group-wise */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Group-wise Participation
                </CardTitle>
                <CardDescription>Response breakdown by shared groups</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryStats?.group_participation && summaryStats.group_participation.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Responded</TableHead>
                        <TableHead className="text-center">Pending</TableHead>
                        <TableHead className="text-center">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryStats.group_participation.map((grp: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{grp.name}</TableCell>
                          <TableCell className="text-center">{grp.total}</TableCell>
                          <TableCell className="text-center text-green-600">{grp.responded}</TableCell>
                          <TableCell className="text-center text-orange-600">{grp.pending}</TableCell>
                          <TableCell className="text-center font-medium">{grp.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No groups shared with this poll</p>
                )}
              </CardContent>
            </Card>

            {/* Location-wise */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location-wise Participation
                </CardTitle>
                <CardDescription>Response breakdown by shared locations</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryStats?.location_participation && summaryStats.location_participation.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Responded</TableHead>
                        <TableHead className="text-center">Pending</TableHead>
                        <TableHead className="text-center">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryStats.location_participation.map((loc: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{loc.name}</TableCell>
                          <TableCell className="text-center">{loc.total}</TableCell>
                          <TableCell className="text-center text-green-600">{loc.responded}</TableCell>
                          <TableCell className="text-center text-orange-600">{loc.pending}</TableCell>
                          <TableCell className="text-center font-medium">{loc.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No locations shared with this poll</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* User-wise Participation Table */}
          {summaryStats?.user_wise && summaryStats.user_wise.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User-wise Participation
                </CardTitle>
                <CardDescription>Individual user response status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryStats.user_wise.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>{user.location}</TableCell>
                        <TableCell className="text-center">
                          {user.responded ? (
                            <Badge className="bg-green-500">Responded</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Heat Map - Department × Location */}
          {summaryStats?.heat_map && summaryStats.heat_map.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5" />
                  Department × Location Heat Map
                </CardTitle>
                <CardDescription>Response intensity by department and location combination</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2 border-b font-medium">Department \ Location</th>
                        {Array.from(new Set(summaryStats.heat_map.map((h: any) => h.location))).map((loc: string) => (
                          <th key={loc} className="text-center p-2 border-b font-medium whitespace-nowrap">{loc}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(summaryStats.heat_map.map((h: any) => h.department))).map((dept: string) => (
                        <tr key={dept}>
                          <td className="font-medium p-2 border-b whitespace-nowrap">{dept}</td>
                          {Array.from(new Set(summaryStats.heat_map.map((h: any) => h.location))).map((loc: string) => {
                            const cell = summaryStats.heat_map.find((h: any) => h.department === dept && h.location === loc)
                            if (!cell) return <td key={loc} className="text-center p-2 border-b text-muted-foreground">—</td>
                            const intensity = cell.percentage
                            const bgColor = intensity === 0 ? "bg-gray-100" :
                              intensity < 25 ? "bg-red-200" :
                              intensity < 50 ? "bg-orange-200" :
                              intensity < 75 ? "bg-yellow-200" : "bg-green-300"
                            return (
                              <td key={loc} className={`text-center p-2 border-b ${bgColor}`}>
                                <div className="font-bold">{cell.responded}/{cell.total}</div>
                                <div className="text-xs">{cell.percentage}%</div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span>Legend:</span>
                  <div className="flex items-center gap-1"><div className="w-4 h-4 bg-gray-100 rounded" /> No data</div>
                  <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-200 rounded" /> &lt;25%</div>
                  <div className="flex items-center gap-1"><div className="w-4 h-4 bg-orange-200 rounded" /> 25-50%</div>
                  <div className="flex items-center gap-1"><div className="w-4 h-4 bg-yellow-200 rounded" /> 50-75%</div>
                  <div className="flex items-center gap-1"><div className="w-4 h-4 bg-green-300 rounded" /> &gt;75%</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Poll History Timeline */}
          {summaryStats?.poll_history && summaryStats.poll_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Poll History
                </CardTitle>
                <CardDescription>Timeline of poll events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summaryStats.poll_history.map((event: any, index: number) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          event.event === "Poll Created" ? "bg-blue-500" :
                          event.event === "Poll Shared" ? "bg-purple-500" :
                          event.event === "First Response Received" ? "bg-green-500" :
                          event.event === "Latest Response" ? "bg-cyan-500" :
                          event.event === "Poll Closed" ? "bg-red-500" : "bg-gray-400"
                        }`} />
                        {index < summaryStats.poll_history.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 flex-1 min-h-[20px]" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-sm">{event.event}</p>
                        {event.details && (
                          <p className="text-sm text-muted-foreground">{event.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{event.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question-wise Response Charts */}
          {responses.length > 0 && summaryData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Question-wise Results</CardTitle>
                <CardDescription>Response distribution for each question (Pie & Bar charts)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {summaryData.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <h3 className="text-lg font-medium">{item.question}</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Bar chart */}
                        <div className="h-[300px] border rounded-md p-4">
                          <ResponsiveBar
                            data={item.data}
                            keys={["count"]}
                            indexBy="option"
                            margin={{ top: 50, right: 50, bottom: 50, left: 60 }}
                            padding={0.3}
                            valueScale={{ type: "linear" }}
                            colors={{ scheme: "category10" }}
                            axisBottom={{
                              tickSize: 5,
                              tickPadding: 5,
                              tickRotation: 0,
                              legend: "Options",
                              legendPosition: "middle",
                              legendOffset: 40,
                            }}
                            axisLeft={{
                              tickSize: 5,
                              tickPadding: 5,
                              tickRotation: 0,
                              legend: "Count",
                              legendPosition: "middle",
                              legendOffset: -40,
                            }}
                            labelSkipWidth={12}
                            labelSkipHeight={12}
                            labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
                            animate={true}
                            motionStiffness={90}
                            motionDamping={15}
                          />
                        </div>
                        {/* Pie chart */}
                        <div className="h-[300px] border rounded-md p-4">
                          <ResponsivePie
                            data={item.data}
                            margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                            innerRadius={0.5}
                            padAngle={0.7}
                            cornerRadius={3}
                            colors={{ scheme: "category10" }}
                            borderWidth={1}
                            borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
                            radialLabelsSkipAngle={10}
                            radialLabelsTextColor="#333333"
                            radialLabelsLinkColor={{ from: "color" }}
                            sliceLabelsSkipAngle={10}
                            sliceLabelsTextColor="#333333"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Responses</CardTitle>
                  <CardDescription>Individual responses for {poll.title}</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search responses..."
                      className="w-full sm:w-[200px] pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportResponses}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-md">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">No responses yet</h3>
                  <p className="text-sm text-muted-foreground">Share this poll to start collecting responses.</p>
                  {canEdit && (
                    <Button className="mt-4" onClick={handleShare}>
                      <Share className="h-4 w-4 mr-2" />
                      Share Poll
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Respondent</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Submitted On</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell className="font-medium">{response.respondent}</TableCell>
                        <TableCell>{response.department || "—"}</TableCell>
                        <TableCell>{response.submittedOn}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shares" className="space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Shares</CardTitle>
                  <CardDescription>Share history for {poll.title}</CardDescription>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share className="h-4 w-4 mr-2" />
                    Share Poll
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {shares.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-md">
                  <Share className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">No shares yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Share this poll with others to start collecting responses.
                  </p>
                  {canEdit && (
                    <Button className="mt-4" onClick={handleShare}>
                      <Share className="h-4 w-4 mr-2" />
                      Share Poll
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shared By</TableHead>
                      <TableHead>Shared On</TableHead>
                      <TableHead>Shared With</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shares.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell className="font-medium">{share.sharedBy}</TableCell>
                        <TableCell>{share.sharedOn}</TableCell>
                        <TableCell>{share.sharedWith.join(", ")}</TableCell>
                        <TableCell>
                          {share.scheduled ? (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2 text-orange-500" />
                              <span>Scheduled for {share.scheduledDate}</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                              <span>Sent</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the poll and all its responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onSelect={(e) => { e.preventDefault(); handleDelete(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
