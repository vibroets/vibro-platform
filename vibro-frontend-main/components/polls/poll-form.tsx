//@ts-nocheck

"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { PlusCircle, Trash2, MoveDown, MoveUp, ImageIcon, Eye, Users, MapPin, UserCircle, ArrowLeft } from "lucide-react"
import { type PollQuestion, type PollCategory } from "@/data/polls"
import { useUser } from "@/components/user-provider"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import axiosInstance from "@/utils/axiosInstance"
import { useSelector } from "react-redux"
import { selectUser } from "@/redux/slices/authSlice"

interface PollFormProps {
  pollId?: string
}

type PollQuestionType = "multiple-choice" | "checkbox" | "rating" | "text" | "yes-no" | "emoji"

const CATEGORIES: PollCategory[] = [
  "Employee Engagement",
  "Operations",
  "HR",
  "Safety",
  "Training",
  "Events",
  "General",
]

interface SelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  searchPlaceholder?: string
  options: { id: number; label: string }[]
  selected: number[]
  onChange: (selected: number[]) => void
}

function SelectionDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  options,
  selected,
  onChange,
}: SelectionDialogProps) {
  const [search, setSearch] = useState("")

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 min-h-0">
          <Input
            type="search"
            placeholder={searchPlaceholder || "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-y-auto border rounded-md p-2 space-y-1">
            {filtered.map((item) => (
              <label
                key={item.id}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />
                <span className="text-xs">{item.label}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No results found</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PollForm({ pollId }: PollFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUser()
  const reduxUser = useSelector(selectUser)
  const organizationId = reduxUser?.organization

  const [loading, setLoading] = useState(!!pollId)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<PollCategory | "">("")
  const [thumbnail, setThumbnail] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false)
  const [questions, setQuestions] = useState<PollQuestion[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Target audience state
  const [users, setUsers] = useState<{ id: number; first_name: string; last_name: string; username: string; email: string }[]>([])
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([])
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [audienceLoading, setAudienceLoading] = useState(true)

  useEffect(() => {
    async function fetchAudience() {
      if (!organizationId) return
      setAudienceLoading(true)
      try {
        const [usersRes, groupsRes, locationsRes] = await Promise.all([
          axiosInstance.get("/users/list").catch(() => ({ data: [] })),
          axiosInstance.get("/groups/").catch(() => ({ data: [] })),
          axiosInstance.get(`/location/${organizationId}/`).catch(() => ({ data: [] })),
        ])
        setUsers(usersRes.data || [])
        setGroups(groupsRes.data || [])
        setLocations(locationsRes.data || [])
      } catch (err) {
        console.error("Error fetching audience data:", err)
      } finally {
        setAudienceLoading(false)
      }
    }
    fetchAudience()
  }, [organizationId])

  useEffect(() => {
    if (!pollId) return
    axiosInstance.get(`/poll/polls/${pollId}/`).then((res) => {
      const p = res.data
      setTitle(p.title || "")
      setDescription(p.description || "")
      setCategory(p.category || "")
      setThumbnail(p.thumbnail || "")
      setStartDate(p.start_date ? p.start_date.slice(0, 16) : "")
      setEndDate(p.end_date ? p.end_date.slice(0, 16) : "")
      setAnonymous(p.anonymous ?? false)
      setAllowMultipleResponses(p.allow_multiple_responses ?? false)
      setQuestions((p.questions || []).map((q: any) => ({
        id: String(q.id),
        type: q.question_type,
        question: q.question_text,
        options: q.options || [],
        required: q.required,
      })))
      setLoading(false)
    }).catch(() => {
      toast({ title: "Error", description: "Failed to load poll.", variant: "destructive" })
      setLoading(false)
    })
  }, [pollId])

  const addQuestion = () => {
    const newQuestion: PollQuestion = {
      id: `q${questions.length + 1}`,
      type: "multiple-choice",
      question: "",
      options: ["Option 1", "Option 2"],
      required: true,
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (index: number, field: keyof PollQuestion, value: any) => {
    const updatedQuestions = [...questions]
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value }
    setQuestions(updatedQuestions)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...questions]
    if (updatedQuestions[questionIndex].options) {
      updatedQuestions[questionIndex].options![optionIndex] = value
      setQuestions(updatedQuestions)
    }
  }

  const addOption = (questionIndex: number) => {
    const updatedQuestions = [...questions]
    if (updatedQuestions[questionIndex].options) {
      updatedQuestions[questionIndex].options!.push(`Option ${updatedQuestions[questionIndex].options!.length + 1}`)
      setQuestions(updatedQuestions)
    }
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...questions]
    if (updatedQuestions[questionIndex].options && updatedQuestions[questionIndex].options!.length > 2) {
      updatedQuestions[questionIndex].options!.splice(optionIndex, 1)
      setQuestions(updatedQuestions)
    } else {
      toast({
        title: "Cannot remove option",
        description: "A question must have at least 2 options.",
        variant: "destructive",
      })
    }
  }

  const removeQuestion = (index: number) => {
    const updatedQuestions = [...questions]
    updatedQuestions.splice(index, 1)
    setQuestions(updatedQuestions)
  }

  const moveQuestionUp = (index: number) => {
    if (index > 0) {
      const updatedQuestions = [...questions]
      const temp = updatedQuestions[index]
      updatedQuestions[index] = updatedQuestions[index - 1]
      updatedQuestions[index - 1] = temp
      setQuestions(updatedQuestions)
    }
  }

  const moveQuestionDown = (index: number) => {
    if (index < questions.length - 1) {
      const updatedQuestions = [...questions]
      const temp = updatedQuestions[index]
      updatedQuestions[index] = updatedQuestions[index + 1]
      updatedQuestions[index + 1] = temp
      setQuestions(updatedQuestions)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast({ title: "Error", description: "Poll title is required.", variant: "destructive" })
      return
    }

    if (!category) {
      toast({ title: "Error", description: "Please select a category.", variant: "destructive" })
      return
    }

    if (!startDate || !endDate) {
      toast({ title: "Error", description: "Start and end dates are required.", variant: "destructive" })
      return
    }

    if (questions.length === 0) {
      toast({ title: "Error", description: "At least one question is required.", variant: "destructive" })
      return
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question.trim()) {
        toast({ title: "Error", description: `Question ${i + 1} text is required.`, variant: "destructive" })
        return
      }
      if (
        (questions[i].type === "multiple-choice" || questions[i].type === "checkbox") &&
        (!questions[i].options || questions[i].options.length < 2)
      ) {
        toast({ title: "Error", description: `Question ${i + 1} must have at least 2 options.`, variant: "destructive" })
        return
      }
    }

    const formatDateTime = (dt: string) => {
      if (!dt) return dt
      // datetime-local gives "2026-07-22T20:30" — append ":00" if no seconds
      return dt.length === 16 ? dt + ":00" : dt
    }

    const pollData: any = {
      title,
      description: description || null,
      category: category as PollCategory,
      poll_type: "Single Choice",
      thumbnail: thumbnail || null,
      start_date: formatDateTime(startDate),
      end_date: formatDateTime(endDate),
      anonymous,
      allow_multiple_responses: allowMultipleResponses,
      questions: questions.map((q) => ({
        id: q.id.match(/^\d+$/) ? parseInt(q.id) : undefined,
        question_text: q.question,
        question_type: q.type,
        options: q.options || [],
        required: q.required,
      })),
    }

    try {
      setSubmitting(true)
      let createdPollId: string | null = null
      if (pollId) {
        await axiosInstance.put(`/poll/polls/${pollId}/`, pollData)
        createdPollId = pollId
        toast({ title: "Success", description: "Poll updated successfully." })
      } else {
        const res = await axiosInstance.post(`/poll/polls/`, pollData)
        createdPollId = String(res.data.id)
        toast({ title: "Success", description: "Poll created successfully." })
      }

      if (createdPollId && (selectedUsers.length > 0 || selectedGroups.length > 0 || selectedLocations.length > 0)) {
        await axiosInstance.post(`/poll/polls/${createdPollId}/share/`, {
          users: selectedUsers,
          groups: selectedGroups,
          locations: selectedLocations,
        })
        toast({ title: "Shared", description: "Poll shared with selected audience." })
      }

      router.push("/polls")
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error || JSON.stringify(error?.response?.data) || "Failed to save poll."
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push("/polls")
  }

  const handlePreview = () => {
    setPreviewOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading poll...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Polls
      </Button>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{pollId ? "Edit Poll" : "Create New Poll"}</CardTitle>
            <CardDescription>
              {pollId ? "Update your poll details and questions" : "Create a new poll with custom questions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Poll Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Poll Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter poll title"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter poll description"
                rows={3}
              />
            </div>

            {/* Category & Poll Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as PollCategory)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Start Date & End Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  Start Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">
                  End Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Anonymous & Allow Multiple Responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 border rounded-md p-3">
                <Switch
                  id="anonymous"
                  checked={anonymous}
                  onCheckedChange={setAnonymous}
                />
                <div>
                  <Label htmlFor="anonymous" className="cursor-pointer">Anonymous or Named</Label>
                  <p className="text-xs text-muted-foreground">
                    {anonymous ? "Responses are anonymous" : "Responses show respondent name"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 border rounded-md p-3">
                <Switch
                  id="allowMultiple"
                  checked={allowMultipleResponses}
                  onCheckedChange={setAllowMultipleResponses}
                />
                <div>
                  <Label htmlFor="allowMultiple" className="cursor-pointer">Allow Multiple Responses</Label>
                  <p className="text-xs text-muted-foreground">
                    {allowMultipleResponses ? "Users can respond multiple times" : "One response per user"}
                  </p>
                </div>
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-3">
              <Label>
                Target Audience <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Select users, groups, and locations to share this poll with
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setUserDialogOpen(true)}
                  className="border rounded-md p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCircle className="h-4 w-4" /> Users
                  </div>
                  <div className="text-sm truncate mt-1">
                    {audienceLoading ? "Loading..." :
                      selectedUsers.length > 0 ? `${selectedUsers.length} selected` : "Select users"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setGroupDialogOpen(true)}
                  className="border rounded-md p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" /> Groups
                  </div>
                  <div className="text-sm truncate mt-1">
                    {audienceLoading ? "Loading..." :
                      selectedGroups.length > 0 ? `${selectedGroups.length} selected` : "Select groups"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationDialogOpen(true)}
                  className="border rounded-md p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-4 w-4" /> Locations
                  </div>
                  <div className="text-sm truncate mt-1">
                    {audienceLoading ? "Loading..." :
                      selectedLocations.length > 0 ? `${selectedLocations.length} selected` : "Select locations"}
                  </div>
                </button>
              </div>
            </div>

            {/* Thumbnail (optional) */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail URL (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="thumbnail"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="Enter image URL"
                />
                <Button type="button" variant="outline" size="icon">
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </div>
              {thumbnail && (
                <div className="mt-2 border rounded-md p-2 max-w-xs">
                  <img
                    src={thumbnail || "/placeholder.svg"}
                    alt="Thumbnail preview"
                    className="max-h-32 object-contain"
                  />
                </div>
              )}
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>
                  Questions <span className="text-red-500">*</span>
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>

              {questions.length === 0 ? (
                <div className="text-center p-4 border border-dashed rounded-md">
                  <p className="text-muted-foreground">No questions added yet. Click "Add Question" to get started.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((question, qIndex) => (
                    <Card key={question.id} className="relative">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1 flex-1">
                            <Label htmlFor={`question-${qIndex}`}>Question {qIndex + 1}</Label>
                            <Input
                              id={`question-${qIndex}`}
                              value={question.question}
                              onChange={(e) => updateQuestion(qIndex, "question", e.target.value)}
                              placeholder="Enter your question"
                              className="mt-1"
                            />
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveQuestionUp(qIndex)}
                              disabled={qIndex === 0}
                            >
                              <MoveUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveQuestionDown(qIndex)}
                              disabled={qIndex === questions.length - 1}
                            >
                              <MoveDown className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(qIndex)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`question-type-${qIndex}`}>Question Type</Label>
                            <Select
                              value={question.type}
                              onValueChange={(value) => updateQuestion(qIndex, "type", value as PollQuestionType)}
                            >
                              <SelectTrigger id={`question-type-${qIndex}`}>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="multiple-choice">Single Choice</SelectItem>
                                <SelectItem value="checkbox">Multiple Choice</SelectItem>
                                <SelectItem value="rating">Rating Scale (1-5)</SelectItem>
                                <SelectItem value="yes-no">Yes/No</SelectItem>
                                <SelectItem value="text">Open Text</SelectItem>
                                <SelectItem value="emoji">Emoji Reaction</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`required-${qIndex}`}
                              checked={question.required}
                              onCheckedChange={(checked) => updateQuestion(qIndex, "required", checked)}
                            />
                            <Label htmlFor={`required-${qIndex}`}>Required</Label>
                          </div>
                        </div>

                        {(question.type === "multiple-choice" || question.type === "checkbox") && (
                          <div className="space-y-2">
                            <Label>Options</Label>
                            {question.options?.map((option, oIndex) => (
                              <div key={oIndex} className="flex gap-2 items-center">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                  placeholder={`Option ${oIndex + 1}`}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOption(qIndex, oIndex)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(qIndex)}
                              className="mt-2"
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Option
                            </Button>
                          </div>
                        )}

                        {question.type === "rating" && (
                          <div className="space-y-2">
                            <Label>Rating Scale (1-5)</Label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <div key={rating} className="text-center">
                                  <div className="h-10 w-10 rounded-full border flex items-center justify-center">
                                    {rating}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {question.type === "yes-no" && (
                          <div className="space-y-2">
                            <Label>Yes/No Options</Label>
                            <div className="flex gap-4">
                              <div className="h-10 px-6 rounded-full border flex items-center justify-center text-sm">
                                Yes
                              </div>
                              <div className="h-10 px-6 rounded-full border flex items-center justify-center text-sm">
                                No
                              </div>
                            </div>
                          </div>
                        )}

                        {question.type === "emoji" && (
                          <div className="space-y-2">
                            <Label>Emoji Reactions</Label>
                            <div className="flex gap-4 text-3xl">
                              <span>😀</span>
                              <span>😐</span>
                              <span>😞</span>
                            </div>
                          </div>
                        )}

                        {question.type === "text" && (
                          <div className="space-y-2">
                            <Label>Text Input</Label>
                            <Textarea disabled placeholder="User will enter text here" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : pollId ? "Update Poll" : "Create Poll"}</Button>
            </div>
          </CardFooter>
        </Card>
      </form>

      {/* Selection Dialogs */}
      <SelectionDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        title="Select Users"
        searchPlaceholder="Search users..."
        options={users.map((u) => ({ id: u.id, label: [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || u.email || `User ${u.id}` }))}
        selected={selectedUsers}
        onChange={setSelectedUsers}
      />
      <SelectionDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        title="Select Groups"
        searchPlaceholder="Search groups..."
        options={groups.map((g) => ({ id: g.id, label: g.name || "Unknown" }))}
        selected={selectedGroups}
        onChange={setSelectedGroups}
      />
      <SelectionDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        title="Select Locations"
        searchPlaceholder="Search locations..."
        options={locations.map((l) => ({ id: l.id, label: l.name || "Unknown" }))}
        selected={selectedLocations}
        onChange={setSelectedLocations}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Poll Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto p-4">
            <h2 className="text-xl font-bold">{title || "Untitled Poll"}</h2>
            {thumbnail && (
              <img
                src={thumbnail || "/placeholder.svg"}
                alt="Poll thumbnail"
                className="max-h-40 object-contain rounded-md"
              />
            )}
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={index} className="space-y-2 border p-4 rounded-md">
                  <p className="font-medium">
                    {index + 1}. {question.question || "Untitled Question"}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </p>

                  {question.type === "multiple-choice" && (
                    <div className="space-y-2">
                      {question.options?.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center space-x-2">
                          <input type="radio" id={`preview-${index}-${oIndex}`} name={`preview-${index}`} disabled />
                          <label htmlFor={`preview-${index}-${oIndex}`}>{option}</label>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.type === "checkbox" && (
                    <div className="space-y-2">
                      {question.options?.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center space-x-2">
                          <input type="checkbox" id={`preview-${index}-${oIndex}`} disabled />
                          <label htmlFor={`preview-${index}-${oIndex}`}>{option}</label>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.type === "rating" && (
                    <div className="flex gap-4 items-center">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <div key={rating} className="text-center">
                          <div className="h-10 w-10 rounded-full border flex items-center justify-center cursor-pointer">
                            {rating}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.type === "text" && <Textarea placeholder="Your answer" disabled />}

                  {question.type === "yes-no" && (
                    <div className="flex gap-4">
                      <div className="h-10 px-6 rounded-full border flex items-center justify-center text-sm">
                        Yes
                      </div>
                      <div className="h-10 px-6 rounded-full border flex items-center justify-center text-sm">
                        No
                      </div>
                    </div>
                  )}

                  {question.type === "emoji" && (
                    <div className="flex gap-4 text-3xl">
                      <span>😀</span>
                      <span>😐</span>
                      <span>😞</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
