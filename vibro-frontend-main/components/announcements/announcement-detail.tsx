"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Edit,
  Share,
  Trash,
  Eye,
  ThumbsUp,
  CheckCircle,
  Download,
  FileText,
  ImageIcon,
  Film,
  Music,
  FileIcon as FilePresentation,
  Pin,
  ArrowLeft,
  Search,
  X,
  Filter,
} from "lucide-react"
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

interface AnnouncementDetailProps {
  id: string
}

interface AnnouncementAPIResponse {
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
  announcement_attachments: string | null | any[]
  organization: number
  organization_name: string
  created_by: number
  created_by_name: string
  created_on: string
  updated_by: number | null
  updated_by_name: string | null
  updated_on: string | null
  count_of_views: number | null
  count_of_likes: number | null
  count_of_acknowledge: number | null
}

interface AnnouncementDisplay {
  id: number
  title: string
  author: string
  createdOn: string
  views: number | null
  likes: number | null
  acknowledgements: number | null
  sentTo: string | null
  receivedBy: number | null
  viewedBy: number | null
  acknowledgedBy: number | null
  pinned: boolean
  status: string | null
  content: string
  attachments: any[]
  announcement_category: string
  announcement_start_date: string
  announcement_end_date: string
  request_acknowledge: boolean
  prevent_download: boolean
  announcement_tags: string | null
  organization_name: string
  updated_by_name: string | null
  updated_on: string | null
}

interface ShareInfo {
  id: number
  sent_to_user_name: string
  sent_to_user_designation: string | null
  sent_to_user_location: string | null
  user_group_name: string | null
  sent_to_group_name: string | null
  share_status: string
  sent_timestamp: string
  acknowledged: boolean
  acknowledged_timestamp: string | null
  viewed_timestamp: string | null
  liked: boolean
}

export function AnnouncementDetail({ id }: AnnouncementDetailProps) {
  const router = useRouter()
  const { isFullAccess } = useModuleAccess("announcements")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinAction, setPinAction] = useState<'pin' | 'unpin' | null>(null)
  const [announcement, setAnnouncement] = useState<AnnouncementDisplay | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("view")
  const [shareInfo, setShareInfo] = useState<ShareInfo[]>([])
  const [shareInfoLoading, setShareInfoLoading] = useState(false)

  // Filter states
  const [filterViewed, setFilterViewed] = useState<string>("all")
  const [filterLiked, setFilterLiked] = useState<string>("all")
  const [filterAcknowledged, setFilterAcknowledged] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Filter share info based on filters and search
  const filteredShareInfo = useMemo(() => {
    return shareInfo.filter((info) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const userName = (info.sent_to_user_name || info.sent_to_group_name || '').toLowerCase()
        const designation = (info.sent_to_user_designation || '').toLowerCase()
        const groupName = (info.user_group_name || info.sent_to_group_name || '').toLowerCase()
        if (!userName.includes(query) && !designation.includes(query) && !groupName.includes(query)) {
          return false
        }
      }

      // Viewed filter
      if (filterViewed !== 'all') {
        if (filterViewed === 'viewed' && !info.viewed_timestamp) return false
        if (filterViewed === 'not-viewed' && info.viewed_timestamp) return false
      }

      // Liked filter
      if (filterLiked !== 'all') {
        if (filterLiked === 'liked' && !info.liked) return false
        if (filterLiked === 'not-liked' && info.liked) return false
      }

      // Acknowledged filter
      if (filterAcknowledged !== 'all') {
        if (filterAcknowledged === 'acknowledged' && !info.acknowledged) return false
        if (filterAcknowledged === 'not-acknowledged' && info.acknowledged) return false
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (info.share_status !== filterStatus) return false
      }

      return true
    })
  }, [shareInfo, filterViewed, filterLiked, filterAcknowledged, filterStatus, searchQuery])

  // Clear all filters
  const clearFilters = () => {
    setFilterViewed('all')
    setFilterLiked('all')
    setFilterAcknowledged('all')
    setFilterStatus('all')
    setSearchQuery('')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const canEdit = isFullAccess

  // Fetch share info data
  const fetchShareInfo = async () => {
    try {
      setShareInfoLoading(true)
      const response = await axiosInstance.get(`/announcements/${id}/share-info/`)
      setShareInfo(response.data)
    } catch (error) {
      console.error('Error fetching share info:', error)
      hotToaster.error('Failed to load engagement data')
    } finally {
      setShareInfoLoading(false)
    }
  }

  // Load announcement data
  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        setLoading(true)
        const response = await axiosInstance.get(`/announcements/${id}/`)
        const apiData: AnnouncementAPIResponse = response.data

        // Parse attachments from various formats
        const parseAttachments = (attachmentsInput: string | null | any[]) => {
          if (!attachmentsInput) return []

          // If it's already an array, process it directly
          if (Array.isArray(attachmentsInput)) {
            return attachmentsInput.map((attachment: any, index: number) => {
              const fileExtension = attachment.name.split('.').pop()?.toLowerCase() || ''
              let type = 'file'

              // Determine file type based on extension
              if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
                type = 'image'
              } else if (fileExtension === 'pdf') {
                type = 'pdf'
              } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(fileExtension)) {
                type = 'video'
              } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fileExtension)) {
                type = 'audio'
              } else if (['ppt', 'pptx'].includes(fileExtension)) {
                type = 'ppt'
              } else if (['xls', 'xlsx'].includes(fileExtension)) {
                type = 'excel'
              }

              return {
                id: index + 1,
                name: attachment.name,
                type: type,
                size: attachment.size || 'Unknown'
              }
            })
          }

          // If it's a string, check if it looks like JSON or treat as comma-separated
          if (typeof attachmentsInput === 'string' && attachmentsInput.trim()) {
            const trimmedInput = attachmentsInput.trim()
            // Check if it starts with { or [ to assume JSON
            if (trimmedInput.startsWith('{') || trimmedInput.startsWith('[')) {
              try {
                // Try to parse as JSON
                const parsedAttachments = JSON.parse(trimmedInput)
                if (Array.isArray(parsedAttachments)) {
                  return parsedAttachments.map((attachment: any, index: number) => {
                    const fileExtension = attachment.name.split('.').pop()?.toLowerCase() || ''
                    let type = 'file'

                    // Determine file type based on extension
                    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
                      type = 'image'
                    } else if (fileExtension === 'pdf') {
                      type = 'pdf'
                    } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(fileExtension)) {
                      type = 'video'
                    } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fileExtension)) {
                      type = 'audio'
                    } else if (['ppt', 'pptx'].includes(fileExtension)) {
                      type = 'ppt'
                    } else if (['xls', 'xlsx'].includes(fileExtension)) {
                      type = 'excel'
                    }

                    return {
                      id: index + 1,
                      name: attachment.name,
                      type: type,
                      size: attachment.size || 'Unknown'
                    }
                  })
                }
              } catch (error) {
                console.error('Failed to parse announcement_attachments as JSON:', error)
              }
            }
            // If not JSON or parsing failed, treat as comma-separated
            return trimmedInput.split(',').map((name, index) => {
              const trimmed = name.trim()
              if (!trimmed) return null
              const fileExtension = trimmed.split('.').pop()?.toLowerCase() || ''
              let type = 'file'

              // Determine file type based on extension
              if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
                type = 'image'
              } else if (fileExtension === 'pdf') {
                type = 'pdf'
              } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(fileExtension)) {
                type = 'video'
              } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fileExtension)) {
                type = 'audio'
              } else if (['ppt', 'pptx'].includes(fileExtension)) {
                type = 'ppt'
              } else if (['xls', 'xlsx'].includes(fileExtension)) {
                type = 'excel'
              }

              return {
                id: index + 1,
                name: trimmed,
                type: type,
                size: 'Unknown'
              }
            }).filter(Boolean)
          }

          return []
        }

        // Transform API data to display format
        const displayData: AnnouncementDisplay = {
          id: apiData.id,
          title: apiData.title,
          author: apiData.created_by_name,
          createdOn: new Date(apiData.created_on).toLocaleDateString(),
          views: apiData.count_of_views, // Not provided by API
          likes: apiData.count_of_views, // Not provided by API
          acknowledgements: apiData.count_of_acknowledge, // Not provided by API
          sentTo: null, // Not provided by API
          receivedBy: null, // Not provided by API
          viewedBy: null, // Not provided by API
          acknowledgedBy: null, // Not provided by API
          pinned: apiData.pin_as_important,
          status: null, // Not provided by API
          content: apiData.announcement_content,
          attachments: parseAttachments(apiData.announcement_attachments),
          announcement_category: apiData.announcement_category,
          announcement_start_date: apiData.announcement_start_date,
          announcement_end_date: apiData.announcement_end_date,
          request_acknowledge: apiData.request_acknowledge,
          prevent_download: apiData.prevent_download,
          announcement_tags: apiData.announcement_tags,
          organization_name: apiData.organization_name,
          updated_by_name: apiData.updated_by_name,
          updated_on: apiData.updated_on
        }

        setAnnouncement(displayData)
      } catch (err) {
        console.error('Error fetching announcement:', err)
        router.push("/announcements")
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncement()
  }, [id, router])

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    try {
      await axiosInstance.delete(`/announcements/${id}/`)
      hotToaster.success("Announcement deleted successfully")
      router.push("/announcements")
    } catch (err) {
      hotToaster.error("Failed to delete announcement")
      console.error('Error deleting announcement:', err)
    }
  }
  const handleShare = () => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/announcements/share?id=${id}`)
  }

  const handleEdit = () => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/announcements/${id}/edit`)
  }

  const handleTogglePin = () => {
    if (!announcement) return
    setPinAction(announcement.pinned ? 'unpin' : 'pin')
    setPinDialogOpen(true)
  }

  const confirmPin = async () => {
    if (!announcement || !pinAction) return

    const newPinValue = pinAction === 'pin'

    try {
      await axiosInstance.patch(`/announcements/${id}/`, {
        pin_as_important: newPinValue
      })
      setAnnouncement({
        ...announcement,
        pinned: newPinValue
      })
      hotToaster.success(newPinValue ? "Announcement pinned successfully" : "Announcement unpinned successfully")
      setPinDialogOpen(false)
      setPinAction(null)
    } catch (err) {
      hotToaster.error("Failed to update pin status")
      console.error('Error updating pin status:', err)
    }
  }

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="h-4 w-4" />
      case "pdf":
        return <FileText className="h-4 w-4" />
      case "video":
        return <Film className="h-4 w-4" />
      case "audio":
        return <Music className="h-4 w-4" />
      case "ppt":
      case "excel":
        return <FilePresentation className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const handleDownloadAttachment = async (filename: string) => {
    // Check if downloads are prevented
    if (announcement?.prevent_download) {
      hotToaster.error("Download is disabled for this announcement")
      return
    }

    try {
      const response = await axiosInstance.get(
        `/announcements/${id}/download_attachment/?filename=${encodeURIComponent(filename)}`,
        {
          responseType: 'blob', // Important: tells axios to return binary data
        }
      )

      // Create a blob from the response data
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream'
      })

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()

      // Clean up
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      hotToaster.success("File downloaded successfully")
    } catch (error) {
      console.error('Error downloading file:', error)
      hotToaster.error("Failed to download file")
    }
  }

  const handleTabChange = (value: string) => {
    if (value === "history") {
      window.dispatchEvent(new Event("route-loader-start"));
      router.push(`/announcements/${id}/receipt-history`)
    } else if (value === "stats") {
      setActiveTab(value)
      fetchShareInfo()
    } else {
      setActiveTab(value)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading announcement...</div>
  }

  if (!announcement) {
    return <div className="flex justify-center items-center h-64">Announcement not found</div>
  }

  return (
    <>
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{announcement.title}</h1>
            <p className="text-muted-foreground">
              By {announcement.author} • {announcement.createdOn}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => handleEdit()}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => handleShare()}>
                <Share className="mr-2 h-4 w-4" />
                Share
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="outline" onClick={handleTogglePin}>
                  <Pin className="mr-2 h-4 w-4" />
                  {announcement.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button variant="outline" onClick={handleDelete}>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="view" className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">View</TabsTrigger>
            <TabsTrigger value="stats" className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">Stats</TabsTrigger>
            <TabsTrigger value="history" className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">Shared Users</TabsTrigger>
          </TabsList>
      <TabsContent value="view" className="space-y-6">
            <Card className="shadow-md p-2 ">
              <CardHeader className="pb-3 ">
                <div className="flex flex-wrap gap-2 ">
                  {announcement.pinned && (
                    <Badge className="flex items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-200">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </Badge>
                  )}
                  {announcement.request_acknowledge && (
                    <Badge className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                      <CheckCircle className="h-3 w-3" />
                      Acknowledgment Required
                    </Badge>
                  )}
                  {announcement.prevent_download && (
                    <Badge className="flex items-center gap-1 bg-red-100 text-red-800 hover:bg-red-200">
                      <Download className="h-3 w-3" />
                      Downloads Disabled
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {announcement.content &&
              <CardContent className="pt-1 text-base leading-relaxed space-y-3  ">
                <div
                  className="prose prose-base max-w-none"
                  dangerouslySetInnerHTML={{ __html: announcement.content }}
                />
              </CardContent>
}
            {/* </Card>

            <Card className="shadow-md"> */}
              <CardHeader className="pb-3 pt-0  ">
                <CardTitle className="text-lg font-semibold tracking-wide">Announcement Details :</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  

                  <div className="space-y-1">
                    <Label className="text-base font-medium text-muted-foreground">Start Date</Label>
                    <p className="text-base font-medium">{new Date(announcement.announcement_start_date).toLocaleDateString()}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-base font-medium text-muted-foreground">End Date</Label>
                    <p className="text-base font-medium">{new Date(announcement.announcement_end_date).toLocaleDateString()}</p>
                  </div>

                  {announcement.announcement_tags && (
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-base font-medium text-muted-foreground">Tags</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {announcement.announcement_tags.split(',').map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-sm px-2 py-0.5">
                            {tag.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {announcement.updated_on && (
                    <div>
                      <Label className="text-base font-medium text-muted-foreground">Last Updated On</Label>
                      <p className="text-base">{new Date(announcement.updated_on).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {announcement.attachments.length > 0 && (
              <Card className="shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y rounded-md border">
                    {announcement.attachments.map((attachment: any) => (
                      <li key={attachment.id} className="py-3 px-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getAttachmentIcon(attachment.type)}
                          <span className="font-medium text-base">{attachment.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {attachment.size !== 'Unknown' ? formatFileSize(attachment.size) : 'Unknown'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-muted rounded-full"
                          onClick={() => handleDownloadAttachment(attachment.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>


          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Engagement Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-4 border rounded-md bg-gradient-to-br from-blue-50 to-white">
                    <Eye className="h-8 w-8 text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-blue-700">{announcement.views ?? "N/A"}</span>
                    <span className="text-sm text-muted-foreground">Total Views</span>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-md bg-gradient-to-br from-green-50 to-white">
                    <ThumbsUp className="h-8 w-8 text-green-600 mb-2" />
                    <span className="text-2xl font-bold text-green-700">{announcement.likes ?? "N/A"}</span>
                    <span className="text-sm text-muted-foreground">Total Likes</span>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-md bg-gradient-to-br from-purple-50 to-white">
                    <CheckCircle className="h-8 w-8 text-purple-600 mb-2" />
                    <span className="text-2xl font-bold text-purple-700">{announcement.acknowledgements ?? "N/A"}</span>
                    <span className="text-sm text-muted-foreground">Acknowledgements</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Detailed User Engagement</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear Filters
                    </Button>
                  </div>

                  {/* Filters */}
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filters</span>
                    </div>

                    {/* Search */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, designation, or group..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Filter Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Viewed</Label>
                        <select
                          value={filterViewed}
                          onChange={(e) => setFilterViewed(e.target.value)}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          <option value="all">All</option>
                          <option value="viewed">Viewed</option>
                          <option value="not-viewed">Not Viewed</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Liked</Label>
                        <select
                          value={filterLiked}
                          onChange={(e) => setFilterLiked(e.target.value)}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          <option value="all">All</option>
                          <option value="liked">Liked</option>
                          <option value="not-liked">Not Liked</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Acknowledged</Label>
                        <select
                          value={filterAcknowledged}
                          onChange={(e) => setFilterAcknowledged(e.target.value)}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          <option value="all">All</option>
                          <option value="acknowledged">Acknowledged</option>
                          <option value="not-acknowledged">Not Acknowledged</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Status</Label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          <option value="all">All</option>
                          <option value="sent">Sent</option>
                          <option value="viewed">Viewed</option>
                          <option value="liked">Liked</option>
                          <option value="acknowledged">Acknowledged</option>
                          <option value="notified">Notified</option>
                        </select>
                      </div>
                    </div>

                    {/* Results count */}
                    <div className="text-xs text-muted-foreground">
                      Showing {filteredShareInfo.length} of {shareInfo.length} users
                    </div>
                  </div>

                  {shareInfoLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading engagement data...</div>
                  ) : filteredShareInfo.length > 0 ? (
                    <div className="rounded-md border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-3 text-left font-semibold">User</th>
                              <th className="px-4 py-3 text-left font-semibold">Designation</th>
                              <th className="px-4 py-3 text-left font-semibold">Group</th>
                              <th className="px-4 py-3 text-center font-semibold">Viewed</th>
                              <th className="px-4 py-3 text-center font-semibold">Liked</th>
                              <th className="px-4 py-3 text-center font-semibold">Acknowledged</th>
                              <th className="px-4 py-3 text-left font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredShareInfo.map((info) => (
                              <tr key={info.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-medium">{info.sent_to_user_name || info.sent_to_group_name || 'N/A'}</td>
                                <td className="px-4 py-3 text-muted-foreground">{info.sent_to_user_designation || '-'}</td>
                                <td className="px-4 py-3 text-muted-foreground">{info.user_group_name || info.sent_to_group_name || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                  {info.viewed_timestamp ? (
                                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">No</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {info.liked ? (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                      <ThumbsUp className="h-3 w-3 mr-1" />
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">No</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {info.acknowledged ? (
                                    <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">No</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    className={
                                      info.share_status === 'acknowledged'
                                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                                        : info.share_status === 'viewed'
                                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                        : info.share_status === 'liked'
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }
                                  >
                                    {info.share_status.charAt(0).toUpperCase() + info.share_status.slice(1)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {shareInfo.length > 0 ? (
                        <>
                          No results match your filters. 
                          <Button
                            variant="link"
                            onClick={clearFilters}
                            className="ml-2 p-0 h-auto"
                          >
                            Clear filters
                          </Button>
                        </>
                      ) : (
                        "No engagement data available. Share this announcement to track user interactions."
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
