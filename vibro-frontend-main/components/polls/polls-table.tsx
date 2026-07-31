"use client"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Share, Edit, Trash, BarChart, X, Copy, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
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

interface PollRow {
  id: number
  title: string
  description?: string | null
  category?: string
  poll_type?: string
  created_by_name?: string
  created_on?: string
  is_active?: boolean
  response_count?: number
  start_date?: string
  end_date?: string
}

interface PollsTableProps {
  searchQuery?: string
  onSyncRef?: React.MutableRefObject<(() => void) | null>
}

export function PollsTable({ searchQuery = "", onSyncRef }: PollsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { isFullAccess } = useModuleAccess("polls")
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [polls, setPolls] = useState<PollRow[]>([])
  const [allPolls, setAllPolls] = useState<PollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pollToDelete, setPollToDelete] = useState<string | null>(null)

  const canEdit = isFullAccess

  const fetchPolls = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/poll/polls/")
      setAllPolls(res.data || [])
      setPolls(res.data || [])
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load polls.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  useEffect(() => {
    if (onSyncRef) {
      onSyncRef.current = fetchPolls
    }
  }, [fetchPolls, onSyncRef])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setPolls(allPolls)
    } else {
      const q = searchQuery.toLowerCase()
      setPolls(allPolls.filter((p) =>
        p.title?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.created_by_name?.toLowerCase().includes(q)
      ))
    }
  }, [searchQuery, allPolls])

  const toggleRow = (id: string) => {
    if (!canEdit) return
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    if (!canEdit) return
    setSelectedRows(selectedRows.length === polls.length ? [] : polls.map((poll) => String(poll.id)))
  }

  const handleViewResults = (id: string) => {
    router.push(`/polls/${id}?tab=summary`)
  }

  const handleEdit = (id: string) => {
    router.push(`/polls/${id}/edit`)
  }

  const handleShare = (id: string) => {
    router.push(`/polls/${id}?tab=shares`)
  }

  const handleClosePoll = async (id: string) => {
    try {
      await axiosInstance.patch(`/poll/polls/${id}/`, { is_active: false })
      toast({ title: "Poll closed", description: "The poll has been closed successfully." })
      fetchPolls()
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to close poll.", variant: "destructive" })
    }
  }

  const confirmDelete = (id: string) => {
    setPollToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!pollToDelete) return
    try {
      await axiosInstance.delete(`/poll/polls/${pollToDelete}/`)
      setPollToDelete(null)
      setDeleteDialogOpen(false)
      toast({ title: "Poll deleted", description: "The poll has been deleted successfully." })
      fetchPolls()
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete poll.", variant: "destructive" })
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const res = await axiosInstance.get(`/poll/polls/${id}/`)
      const original = res.data
      const pollData = {
        title: `${original.title} (Copy)`,
        description: original.description,
        category: original.category,
        poll_type: original.poll_type || "Single Choice",
        thumbnail: original.thumbnail,
        start_date: original.start_date,
        end_date: original.end_date,
        anonymous: original.anonymous,
        allow_multiple_responses: original.allow_multiple_responses,
        questions: (original.questions || []).map((q: any) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || [],
          required: q.required,
        })),
      }
      await axiosInstance.post("/poll/polls/", pollData)
      toast({ title: "Poll duplicated", description: "The poll has been duplicated successfully." })
      fetchPolls()
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to duplicate poll.", variant: "destructive" })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return
    try {
      await Promise.all(selectedRows.map((id) => axiosInstance.delete(`/poll/polls/${id}/`)))
      setSelectedRows([])
      toast({ title: "Polls deleted", description: `${selectedRows.length} polls have been deleted successfully.` })
      fetchPolls()
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete some polls.", variant: "destructive" })
    }
  }

  return (
    <>
      <div className="rounded-md border">
        {selectedRows.length > 0 && canEdit && (
          <div className="bg-muted/50 p-2 flex items-center justify-between">
            <span className="text-sm font-medium">{selectedRows.length} items selected</span>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedRows.length === polls.length && polls.length > 0}
                  onCheckedChange={toggleAll}
                  disabled={!canEdit}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Created On</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response Count</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Loading polls...
                </TableCell>
              </TableRow>
            ) : polls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No polls found.
                </TableCell>
              </TableRow>
            ) : (
              polls.map((poll) => (
                <TableRow
                  key={poll.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/polls/${poll.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRows.includes(String(poll.id))}
                      onCheckedChange={() => toggleRow(String(poll.id))}
                      disabled={!canEdit}
                      aria-label={`Select row ${poll.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{poll.title}</TableCell>
                  <TableCell>{poll.created_by_name || "—"}</TableCell>
                  <TableCell>{poll.created_on ? new Date(poll.created_on).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={poll.is_active ? "default" : "secondary"}>{poll.is_active ? "Active" : "Closed"}</Badge>
                  </TableCell>
                  <TableCell>{poll.response_count || 0}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleViewResults(String(poll.id))}>
                          <BarChart className="mr-2 h-4 w-4" />
                          View Results
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push(`/polls/${poll.id}/bulk-import`)}>
                          <Upload className="mr-2 h-4 w-4" />
                          Bulk Import
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem onSelect={() => handleShare(String(poll.id))}>
                              <Share className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleEdit(String(poll.id))}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDuplicate(String(poll.id))}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            {poll.is_active && (
                              <DropdownMenuItem onSelect={() => handleClosePoll(String(poll.id))}>
                                <X className="mr-2 h-4 w-4" />
                                Close Poll
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => confirmDelete(String(poll.id))}>
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </>
  )
}
