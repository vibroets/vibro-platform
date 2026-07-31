"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  MoreHorizontal,
  Eye,
  ThumbsUp,
  CheckCircle,
  Share,
  Edit,
  Trash,
  FileText,
  Pin,
  ArrowUpDown,
} from "lucide-react"
import { useRouter } from "next/navigation"
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
import axiosInstance from "@/utils/axiosInstance"
import hotToaster from "react-hot-toast"
import { useModuleAccess } from "@/hooks/useModuleAccess"

interface Announcement {
  id: number
  title: string
  announcement_category: string
  announcement_start_date: string
  announcement_end_date: string
  pin_as_important: boolean
  request_acknowledge: boolean
  prevent_download: boolean
  announcement_content: string
  announcement_tags: string | null
  announcement_attachments: string
  organization: number
  organization_name: string
  created_by: number
  created_by_name: string
  created_on: string
  updated_by: number | null
  updated_by_name: string | null
  updated_on: string | null
  // Fields not provided by API, showing N/A
  count_of_views?: number
  count_of_likes?: number
  count_of_acknowledge?: number
}


interface AnnouncementsTableProps {
  filter: string
  authorFilter: string | null
  categoryFilter?: string | null
  dateFilter: Date | null
  searchQuery: string;
  sortDirection?: "asc" | "desc"
  selectedRows?: number[]
  setSelectedRows?: React.Dispatch<React.SetStateAction<number[]>>
  bulkDeleteDialogOpen?: boolean
  setBulkDeleteDialogOpen?: React.Dispatch<React.SetStateAction<boolean>>
  onConfirmBulkDelete?: () => Promise<void>
}

function getAnnouncementStatus(startDateStr: string, endDateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDateStr)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDateStr)
  end.setHours(0, 0, 0, 0)

  if (end < today) return { label: "Expired", variant: "destructive" as const }
  if (start > today) return { label: "Scheduled", variant: "secondary" as const }
  if (end.getTime() === today.getTime()) return { label: "Expiring Today", variant: "outline" as const }
  return { label: "Live", variant: "success" as const }
}

export function AnnouncementsTable({
  searchQuery,
  filter,
  authorFilter,
  categoryFilter,
  dateFilter,
  sortDirection = "desc",
  selectedRows = [],
  setSelectedRows,
  bulkDeleteDialogOpen = false,
  setBulkDeleteDialogOpen,
  onConfirmBulkDelete,
}: AnnouncementsTableProps) {
  const { isFullAccess } = useModuleAccess("announcements")
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<number | null>(null)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [selectedAnnouncementForPin, setSelectedAnnouncementForPin] = useState<number | null>(null)
  const [pinAction, setPinAction] = useState<'pin' | 'unpin' | null>(null)
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([])

  // Filter states
  const [titleFilter, setTitleFilter] = useState("")
  const [localCategoryFilter, setLocalCategoryFilter] = useState("")
  const [localAuthorFilter, setLocalAuthorFilter] = useState("")
  const [localCreatedDateFilter, setLocalCreatedDateFilter] = useState("")

  const canEdit = isFullAccess

  // Fetch announcements on mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true)
        const response = await axiosInstance.get('/announcements/')
        setAnnouncements(response.data)
        setError(null)
      } catch (err) {
        setError('Failed to fetch announcements')
        console.error('Error fetching announcements:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  // Apply filters when they change
  useEffect(() => {
    let result = [...announcements]

    // Apply status / pin filter
    if (filter !== "all") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      result = result.filter((a) => {
        const start = new Date(a.announcement_start_date)
        start.setHours(0, 0, 0, 0)
        const end = new Date(a.announcement_end_date)
        end.setHours(0, 0, 0, 0)
        if (filter === "pinned") return a.pin_as_important
        if (filter === "live") return start <= today && end > today
        if (filter === "expiring-today") return end.getTime() === today.getTime()
        if (filter === "expired") return end < today
        if (filter === "scheduled") return start > today
        return true
      })
    }

    // Apply global filters from props
    if (authorFilter) {
      result = result.filter((a) => a.created_by_name === authorFilter)
    }

    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((a) => a.announcement_category === categoryFilter)
    }

    if (dateFilter) {
      result = result.filter((a) => {
        const announcementDate = new Date(a.created_on)
        return (
          announcementDate.getFullYear() === dateFilter.getFullYear() &&
          announcementDate.getMonth() === dateFilter.getMonth() &&
          announcementDate.getDate() === dateFilter.getDate()
        )
      })
    }

    if (searchQuery) {
      const lowerSearch = searchQuery.toLowerCase();
      result = result.filter((a) =>
        a.title.toLowerCase().includes(lowerSearch) ||
        a.announcement_category.toLowerCase().includes(lowerSearch) ||
        a.created_by_name.toLowerCase().includes(lowerSearch)
      );
    }

    // Apply local column filters
    if (titleFilter) {
      result = result.filter((a) => a.title.toLowerCase().includes(titleFilter.toLowerCase()))
    }

    if (localCategoryFilter) {
      result = result.filter((a) => a.announcement_category.toLowerCase().includes(localCategoryFilter.toLowerCase()))
    }

    if (localAuthorFilter) {
      result = result.filter((a) => a.created_by_name.toLowerCase().includes(localAuthorFilter.toLowerCase()))
    }

    if (localCreatedDateFilter) {
      result = result.filter((a) => new Date(a.created_on).toISOString().split('T')[0] >= localCreatedDateFilter)
    }

    // Sort by id ascending
    result.sort((a, b) => a.id - b.id)

    setFilteredAnnouncements(result)
  }, [announcements, filter, authorFilter, categoryFilter, dateFilter, searchQuery, sortDirection, titleFilter, localCategoryFilter, localAuthorFilter, localCreatedDateFilter])

  const toggleRow = (id: number) => {
    if (!isFullAccess) return
    if (setSelectedRows) {
      setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
    }
  }

  const toggleAll = () => {
    if (!isFullAccess) return
    if (setSelectedRows) {
      setSelectedRows(
        selectedRows.length === filteredAnnouncements.length
          ? []
          : filteredAnnouncements.map((announcement) => announcement.id),
      )
    }
  }

  const handleEdit = (id: number) => {  
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/announcements/${id}/edit`)
  }

  const handleViewReceiptHistory = (id: number) => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/announcements/${id}/receipt-history?view=directview_history`)
  }



  const handleDelete = (id: number) => {
    setSelectedAnnouncement(id)
    setDeleteDialogOpen(true)
  }

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) return
    if (setBulkDeleteDialogOpen) {
      setBulkDeleteDialogOpen(true)
    }
  }

  const confirmBulkDelete = async () => {
    if (selectedRows.length === 0) return

    try {
      await axiosInstance.post('/announcements/bulk_delete/', {
        ids: selectedRows
      })
      setAnnouncements((prev) => prev.filter((a) => !selectedRows.includes(a.id)))
      if (setSelectedRows) {
        setSelectedRows([])
      }
      hotToaster.success("Selected announcements deleted successfully")
      if (setBulkDeleteDialogOpen) {
        setBulkDeleteDialogOpen(false)
      }
    } catch (err) {
      hotToaster.error("Failed to delete selected announcements")
      console.error('Error bulk deleting announcements:', err)
    }
  }

  const confirmDelete = async () => {
    if (!selectedAnnouncement) return

    try {
      await axiosInstance.delete(`/announcements/${selectedAnnouncement}/`)
      // Remove from announcements state instead of filteredAnnouncements to ensure consistency
      setAnnouncements((prev) => prev.filter((a) => a.id !== selectedAnnouncement))
      hotToaster.success("Announcement deleted successfully")
      setDeleteDialogOpen(false)
      setSelectedAnnouncement(null)
    } catch (err) {
      hotToaster.error("Failed to delete announcement")
      console.error('Error deleting announcement:', err)
    }
  }

  const handlePinClick = (id: number) => {
    const announcement = announcements.find((a) => a.id === id)
    if (!announcement) return
    setPinAction(announcement.pin_as_important ? 'unpin' : 'pin')
    setSelectedAnnouncementForPin(id)
    setPinDialogOpen(true)
  }

  const confirmPin = async () => {
    if (!selectedAnnouncementForPin || !pinAction) return

    const newPinValue = pinAction === 'pin'

    try {
      console.log('Updating pin status for announcement ID:', selectedAnnouncementForPin, 'to', newPinValue)
      const response = await axiosInstance.patch(`/announcements/${selectedAnnouncementForPin}/`, {
        pin_as_important: newPinValue
      })
      if (response.status == 200) {
        setAnnouncements((prev) => prev.map((a) =>
          a.id === selectedAnnouncementForPin ? { ...a, pin_as_important: newPinValue } : a
        ))
      }
      hotToaster.success(newPinValue ? "Announcement pinned successfully" : "Announcement unpinned successfully")
      setPinDialogOpen(false)
      setSelectedAnnouncementForPin(null)
      setPinAction(null)
    } catch (err) {
      hotToaster.error("Failed to update pin status")
      console.error('Error updating pin status:', err)
    }
  }


  const handleShare = (id: number) => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/announcements/share?id=${id}`)
  }

  const viewDetails = (id: number) => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/announcements/${id}`)
  }

  if (loading) {
    return <div className="mt-4 text-center py-8">Loading announcements...</div>
  }

  if (error) {
    return <div className="mt-4 text-center py-8 text-red-500">{error}</div>
  }

  return (
    <>
      <div className="mt-4 rounded-md border shadow-[0_4px_10px_rgba(0,0,0,0.2)] max-h-[450px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white z-10">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedRows.length === filteredAnnouncements.length && filteredAnnouncements.length > 0}
                  disabled={!isFullAccess}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="max-w-[220px]">Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="whitespace-nowrap">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Created on
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center">
                  <Eye className="h-4 w-4 mr-1" />
                  <span>Views</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center">
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  <span>Likes</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span>Ack.</span>
                </div>
              </TableHead>
              <TableHead className="w-[96px] text-right">Actions</TableHead>
            </TableRow>
            {/* Filter row below header */}
            <TableRow className="bg-gray-50 border-b border-blue-100">
              
              <TableCell />
              <TableCell />
              <TableCell>
                <input
                  type="text"
                  placeholder="Title"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <input
                  type="text"
                  placeholder="Category"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={localCategoryFilter}
                  onChange={(e) => setLocalCategoryFilter(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <input
                  type="text"
                  placeholder="Author"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={localAuthorFilter}
                  onChange={(e) => setLocalAuthorFilter(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <input
                  type="date"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={localCreatedDateFilter}
                  onChange={(e) => setLocalCreatedDateFilter(e.target.value)}
                />
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAnnouncements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  No announcements found matching your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredAnnouncements.map((announcement) => (
                <TableRow
                  key={announcement.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRows.includes(announcement.id)}
                      disabled={!isFullAccess}
                      onCheckedChange={() => toggleRow(announcement.id)}
                      aria-label={`Select row ${announcement.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {announcement.id}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate hover:underline" onClick={() => viewDetails(announcement.id)}>{announcement.title}</span>
                      {announcement.pin_as_important && (
                        <Badge
                          variant="outline"
                          className="ml-2 flex items-center justify-center border-amber-400/70 bg-amber-50/60 text-amber-700 shrink-0"
                        >
                          <Pin className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {announcement.announcement_category}
                  </TableCell>
                  <TableCell>{announcement.created_by_name}</TableCell>
                  <TableCell>{new Date(announcement.created_on).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {(() => {
                      const status = getAnnouncementStatus(announcement.announcement_start_date, announcement.announcement_end_date)
                      return (
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {announcement.count_of_views !== undefined ? announcement.count_of_views : "N/A"}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {announcement.count_of_likes !== undefined ? announcement.count_of_likes : "N/A"}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {announcement.count_of_acknowledge !== undefined ? announcement.count_of_acknowledge : "N/A"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => viewDetails(announcement.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleViewReceiptHistory(announcement.id)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Receipt History
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem onClick={() => handleShare(announcement.id)}>
                              <Share className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(announcement.id)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePinClick(announcement.id)}>
                              <Pin className="mr-2 h-4 w-4" />
                              {announcement.pin_as_important ? "Unpin" : "Pin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(announcement.id)}>
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
            <AlertDialogTitle>Are you sure you want to delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This announcement will be permanently deleted from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete {selectedRows.length} announcement{selectedRows.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected announcements will be permanently deleted from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground">
              Delete {selectedRows.length} Announcement{selectedRows.length > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pin className="h-5 w-5" />
              {pinAction === 'pin' ? 'Pin Announcement' : 'Unpin Announcement'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pinAction} this announcement? This will update its importance status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPin}>
              {pinAction === 'pin' ? 'Pin' : 'Unpin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
