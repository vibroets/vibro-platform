"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { format, isBefore, startOfDay } from "date-fns"
import { CalendarIcon, Upload, X, ImageIcon, FileText, Film, Music, FileIcon as FilePresentation, Plus, Edit2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import axiosInstance from "@/utils/axiosInstance"
import hotToaster from "react-hot-toast"
import { useDispatch } from "react-redux";
import { setCreatedAnnouncement } from "@/redux/slices/announcementSlice";

// Utility functions for timezone handling
const TIMEZONE_OFFSET = '+05:30' // IST

// Convert Date object to date-only string (YYYY-MM-DD)
const dateToString = (date: Date | undefined): string | undefined => {
  if (!date) return undefined
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Convert date-only string to Date object for Calendar component
const stringToDate = (dateString: string | undefined): Date | undefined => {
  if (!dateString) return undefined
  // Create date at midnight in local timezone
  return new Date(`${dateString}T00:00:00`)
}

// Convert date-only string to ISO datetime with timezone for API
const dateStringToISODatetime = (dateString: string | undefined): string | null => {
  if (!dateString) return null
  return `${dateString}T00:00:00${TIMEZONE_OFFSET}`
}

// Parse API datetime-with-timezone back to date-only string
const parseISODatetimeToString = (isoString: string | null): string | undefined => {
  if (!isoString) return undefined
  // Extract date part (YYYY-MM-DD) from the datetime string
  return isoString.split('T')[0]
}

interface AnnouncementFormProps {
  id?: string
}



export function AnnouncementForm({ id }: AnnouncementFormProps) {
  const router = useRouter()
  const dispatch = useDispatch()
  const isEditing = !!id

  // Form state - initialize with empty values
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [pinned, setPinned] = useState(false)
  const [requireAcknowledgment, setRequireAcknowledgment] = useState(false)
  const [preventDownload, setPreventDownload] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)
  const [content, setContent] = useState("")

  // Category management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null)

  // UI state
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [attachments, setAttachments] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<{ name: string; size: number; url: string }[]>([])
  const [deletedAttachments, setDeletedAttachments] = useState<string[]>([])
  const [isDisabled, setIsDisabled] = useState(!isEditing)
  const [returnID, setReturnID] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Keep the original category from the API so a save never sends an empty category
  const loadedCategory = useRef<string>("")

  // Fetch categories on load
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosInstance.get('/announcement-categories/')
        setCategories(response.data)
        // Set default category only when creating a new announcement and none selected
        setCategory((prev) => {
          if (!isEditing && !prev && response.data.length > 0) {
            return response.data[0].name
          }
          return prev
        })
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()
  }, [isEditing])

  // Load data if editing
  useEffect(() => {
    const fetchAnnouncement = async () => {
      if (isEditing && id) {
        console.log('🔄 Starting to populate form data for editing announcement ID:', id)
        try {
          const response = await axiosInstance.get(`/announcements/${id}/`)
          const data = response.data

          console.log('📥 Full API response data:', data)

          // Populate form fields
          console.log('📝 Populating basic form fields...')
          setTitle(data.title)
          setTags(data.announcement_tags || "")
          setPinned(data.pin_as_important)
          setRequireAcknowledgment(data.request_acknowledge)
          setPreventDownload(data.prevent_download)
          setContent(data.announcement_content)

          // Parse category from API response
          let categoryValue = data.announcement_category || "Organization_Update"
          setCategory(categoryValue)
          loadedCategory.current = categoryValue
          console.log('🏷️ Category parsed:', data.announcement_category, '→', categoryValue)

          // Parse dates with proper timezone handling
          if (data.announcement_start_date) {
            console.log('📅 API start_date received:', data.announcement_start_date)
            const dateString = parseISODatetimeToString(data.announcement_start_date)
            console.log('🔄 Parsed start_date string:', dateString)
            const dateObject = stringToDate(dateString)
            console.log('✅ Converted start_date Date object:', dateObject)
            setStartDate(dateObject)
          }
          if (data.announcement_end_date) {
            console.log('📅 API end_date received:', data.announcement_end_date)
            const dateString = parseISODatetimeToString(data.announcement_end_date)
            console.log('🔄 Parsed end_date string:', dateString)
            const dateObject = stringToDate(dateString)
            console.log('✅ Converted end_date Date object:', dateObject)
            setEndDate(dateObject)
          }

          // Parse existing attachments from API response
          if (data.announcement_attachments) {
            console.log('📎 Raw announcement_attachments:', data.announcement_attachments)
            // Handle different attachment data formats
            let parsedAttachments: any[] = []
            if (Array.isArray(data.announcement_attachments)) {
              parsedAttachments = data.announcement_attachments
            } else if (typeof data.announcement_attachments === 'string') {
              if (data.announcement_attachments.trim().startsWith('{') || data.announcement_attachments.trim().startsWith('[')) {
                try {
                  const parsed = JSON.parse(data.announcement_attachments)
                  if (Array.isArray(parsed)) {
                    parsedAttachments = parsed
                  }
                } catch (error) {
                  console.error('❌ Failed to parse announcement_attachments as JSON:', error)
                }
              } else {
                // Treat as comma-separated filenames
                parsedAttachments = data.announcement_attachments.split(',').map((name: string) => ({
                  name: name.trim(),
                  size: 0, // Unknown size
                  url: '' // No URL for non-JSON
                })).filter((item: any) => item.name)
              }
            }
            if (parsedAttachments.length > 0) {
              setExistingAttachments(parsedAttachments)
              console.log('📎 Existing attachments loaded:', parsedAttachments)
            }
          }

          console.log('🎉 Form population completed successfully!')
        } catch (error) {
          console.error('❌ Error fetching announcement:', error)
          hotToaster.error('Failed to load announcement data')
        }
      }
    }

    fetchAnnouncement()
  }, [isEditing, id])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const validFiles = Array.from(files).filter(file => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv']
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        return allowedTypes.includes(fileExtension)
      })

      if (validFiles.length !== files.length) {
        hotToaster.error("Only PDF, Word (.doc, .docx), Excel (.xls, .xlsx), images (.jpg, .jpeg, .png, .gif, .bmp, .webp, .svg), and videos (.mp4, .avi, .mov, .wmv, .flv, .mkv) are allowed")
      }

      setAttachments(prev => [...prev, ...validFiles])
    }
    // Reset input value to allow selecting the same file again
    event.target.value = ''
  }

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...attachments]
    newAttachments.splice(index, 1)
    setAttachments(newAttachments)
  }

  const handleRemoveExistingAttachment = (index: number) => {
    const attachmentToRemove = existingAttachments[index]

    // Add to deleted attachments list
    setDeletedAttachments(prev => [...prev, attachmentToRemove.name])

    // Remove from existing attachments display
    const newExistingAttachments = [...existingAttachments]
    newExistingAttachments.splice(index, 1)
    setExistingAttachments(newExistingAttachments)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileTypeFromName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    if (['pdf'].includes(extension)) return 'pdf'
    if (['doc', 'docx'].includes(extension)) return 'doc'
    if (['xls', 'xlsx'].includes(extension)) return 'xls'
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)) return 'image'
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(extension)) return 'video'
    return 'file'
  }

  const handleDiscard = () => {
    setDiscardDialogOpen(true)
  }

  const confirmDiscard = () => {
    router.push("/announcements")
  }

  const handleSave = async () => {
    // Validate form
    if (!title.trim()) {
      hotToaster.error("Title is required")
      return
    }

    if (!startDate) {
      hotToaster.error("Start date is required")
      return
    }

    if (!endDate) {
      hotToaster.error("End date is required")
      return
    }

    if (isBefore(endDate, startDate)) {
      hotToaster.error("End date must be after start date")
      return
    }

    setIsSaving(true)

    // Map category to API expected value, falling back to the loaded category
    let announcementCategory = category.trim() || loadedCategory.current.trim() || categories[0]?.name || ""
    if (!announcementCategory) {
      hotToaster.error("Category is required. Please select or create a category.")
      setIsSaving(false)
      return
    }

    // Prepare FormData for multipart upload
    const formData = new FormData()

    // Add announcement data
    formData.append('title', title)
    formData.append('announcement_content', content)
    formData.append('announcement_category', announcementCategory)
    formData.append('announcement_start_date', dateStringToISODatetime(dateToString(startDate)) || '')
    formData.append('announcement_end_date', dateStringToISODatetime(dateToString(endDate)) || '')
    formData.append('pin_as_important', pinned.toString())
    formData.append('request_acknowledge', requireAcknowledgment.toString())
    formData.append('prevent_download', preventDownload.toString())
    formData.append('announcement_tags', tags || '')
    formData.append('announcement_fullscreen', fullScreen.toString())

    // Add file attachments
    attachments.forEach(file => {
      formData.append('attachments', file)
    })

    // Add deleted attachments for updates (only when editing)
    if (isEditing && deletedAttachments.length > 0) {
      deletedAttachments.forEach(filename => {
        formData.append('deleted_attachments', filename)
      })
    }

    // Debug: Log FormData contents
    console.log("Saving announcement with FormData:")
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`)
      } else {
        console.log(`${key}: ${value}`)
      }
    }

    try {
      let response
      if (isEditing && id) {
        // Update existing announcement - backend will append new files to existing ones
        response = await axiosInstance.put(`/announcements/${id}/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        hotToaster.success("Announcement updated successfully!")

        // Update existing attachments state with the response
        if (response.data.announcement_attachments) {
          let parsedAttachments: any[] = []
          if (Array.isArray(response.data.announcement_attachments)) {
            parsedAttachments = response.data.announcement_attachments
          } else if (typeof response.data.announcement_attachments === 'string') {
            if (response.data.announcement_attachments.trim().startsWith('{') || response.data.announcement_attachments.trim().startsWith('[')) {
              try {
                const parsed = JSON.parse(response.data.announcement_attachments)
                if (Array.isArray(parsed)) {
                  parsedAttachments = parsed
                }
              } catch (error) {
                console.error('❌ Failed to parse updated announcement_attachments:', error)
              }
            } else {
              // Treat as comma-separated filenames
              parsedAttachments = response.data.announcement_attachments.split(',').map((name: string) => ({
                name: name.trim(),
                size: 0,
                url: ''
              })).filter((item: any) => item.name)
            }
          }
          if (parsedAttachments.length > 0) {
            setExistingAttachments(parsedAttachments)
            setAttachments([]) // Clear new attachments since they're now existing
            setDeletedAttachments([]) // Clear deleted attachments since the operation is complete
          }
        }
      } else {
        // Create new announcement
        response = await axiosInstance.post('/announcements/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        const returnedID = response.data.id;
        setReturnID(response.data.id);
        console.log("Saved announcement ID:", returnedID);
        console.log("API Response:", response.data);

        // Store announcement data in Redux for the share page
        dispatch(setCreatedAnnouncement({
          id: returnedID,
          title: title,
          user: [],
          group: [],
        }));

        hotToaster.success("Announcement saved successfully!")
        setIsDisabled(false);

        // Navigate to share page
        window.dispatchEvent(new Event("route-loader-start"));
        router.push(`/announcements/share?id=${returnedID}`);
      }
      setIsSaving(false)
    } catch (error) {
      // Handle error
      const axiosError = error as any
      hotToaster.error("Error saving announcement. Please try again.")
      console.error("Save error:", axiosError)
      if (axiosError?.response?.data) {
        console.error("Backend validation errors:", axiosError.response.data)
      }
      setIsSaving(false)
    }
  }

  const handleShareImmediately = () => {
    router.push(isEditing ? `/announcements/share?id=${id}` : `/announcements/share?id=${returnID}`);
  }

  const handleShare = async (users: number[], groups: number[]) => {
    if (!users.length && !groups.length) {
      hotToaster.error("Select at least one user or group to share")
      return
    }
    const shareId = isEditing ? id : returnID
    if (!shareId) {
      hotToaster.error("Save the announcement first")
      return
    }
    try {
      const payload = {
        users: users,
        groups: groups,
      };
      console.log("Sharing announcement ID:", shareId, "with payload:", payload);
      await axiosInstance.post(`/announcements/${shareId}/share/`, payload)
      hotToaster.success("Announcement shared successfully!")
      router.push("/announcements")
    } catch (error) {
      hotToaster.error("Error sharing announcement")
      console.error(error)
    }
  }

  // Category management functions
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      hotToaster.error("Category name is required")
      return
    }
    try {
      await axiosInstance.post('/announcement-categories/', { name: newCategoryName.trim() })
      hotToaster.success("Category created successfully")
      setNewCategoryName("")
      setCategoryDialogOpen(false)
      // Refresh categories
      const response = await axiosInstance.get('/announcement-categories/')
      setCategories(response.data)
    } catch (error) {
      hotToaster.error("Error creating category")
      console.error(error)
    }
  }

  const handleEditCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) {
      hotToaster.error("Category name is required")
      return
    }
    try {
      await axiosInstance.put(`/announcement-categories/${editingCategory.id}/`, { name: newCategoryName.trim() })
      hotToaster.success("Category updated successfully")
      setNewCategoryName("")
      setEditingCategory(null)
      setCategoryDialogOpen(false)
      // Refresh categories
      const response = await axiosInstance.get('/announcement-categories/')
      setCategories(response.data)
    } catch (error) {
      hotToaster.error("Error updating category")
      console.error(error)
    }
  }

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return
    try {
      await axiosInstance.delete(`/announcement-categories/${categoryToDelete}/`)
      hotToaster.success("Category deleted successfully")
      setCategoryToDelete(null)
      setDeleteDialogOpen(false)
      // Refresh categories
      const response = await axiosInstance.get('/announcement-categories/')
      setCategories(response.data)
      // Reset category if the deleted one was selected
      if (categories.find(c => c.id === categoryToDelete)?.name === category) {
        setCategory(response.data[0]?.name || "")
      }
    } catch (error) {
      hotToaster.error("Error deleting category")
      console.error(error)
    }
  }

  const openCreateDialog = () => {
    setEditingCategory(null)
    setNewCategoryName("")
    setCategoryDialogOpen(true)
  }

  const openEditDialog = (cat: { id: number; name: string }) => {
    setEditingCategory(cat)
    setNewCategoryName(cat.name)
    setCategoryDialogOpen(true)
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
        return <FilePresentation className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <>
      <form className="space-y-8">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter announcement title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <div className="flex gap-2">
                <Select
                  value={category}
                  onValueChange={setCategory}
                >
                  <SelectTrigger id="category" className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={openCreateDialog}
                  title="Create new category"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {categories.find(c => c.name === category) && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => openEditDialog(categories.find(c => c.name === category)!)}
                      title="Edit category"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const cat = categories.find(c => c.name === category)
                        if (cat) {
                          setCategoryToDelete(cat.id)
                          setDeleteDialogOpen(true)
                        }
                      }}
                      title="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (optional)</Label>
              <Input
                id="tags"
                placeholder="Enter tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="pin-toggle" className="cursor-pointer">
                  Pin as Important
                </Label>
                <Switch id="pin-toggle" checked={pinned} onCheckedChange={setPinned} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="acknowledgment-toggle" className="cursor-pointer">
                  Request Acknowledgment
                </Label>
                <Switch
                  id="acknowledgment-toggle"
                  checked={requireAcknowledgment}
                  onCheckedChange={setRequireAcknowledgment}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="download-toggle" className="cursor-pointer">
                  Prevent Download
                </Label>
                <Switch id="download-toggle" checked={preventDownload} onCheckedChange={setPreventDownload} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="fullscreen-toggle" className="cursor-pointer">
                  Full-Screen Announcement
                </Label>
                <Switch id="fullscreen-toggle" checked={fullScreen} onCheckedChange={setFullScreen} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scheduling</Label>
            <div className="flex flex-wrap gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    classNames={{
                      day_disabled: "text-red-500 bg-red-100 cursor-not-allowed line-through"
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => !startDate || isBefore(date, startDate)}
                    classNames={{
                      day_disabled: "text-gray-400 opacity-50 bg-gray-200 cursor-not-allowed border border-gray-300 line-through"
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {!fullScreen &&
            <div className="space-y-2">
              <Label>Announcement Content</Label>
              <Tabs defaultValue="edit">
                <TabsList className="mb-2">
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <div className="border rounded-md p-4 min-h-[300px]">
                    {/* This would be a WYSIWYG editor in a real implementation */}
                    <textarea
                      className="w-full h-full min-h-[300px] resize-none border-none focus:outline-none"
                      placeholder="Enter announcement content..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    ></textarea>
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  <Card>
                    <CardContent className="p-4 min-h-[300px]">
                      {content ? (
                        <div dangerouslySetInnerHTML={{ __html: content }} />
                      ) : (
                        <p className="text-muted-foreground">No content to preview</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          }

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*,video/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Attachment
                </Button>
              </div>
            </div>
            <div className="border rounded-md p-4">
              {attachments.length === 0 && existingAttachments.length === 0 ? (
                <div className="text-center py-8">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">No attachments added</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Add Attachment
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Existing Attachments */}
                  {existingAttachments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Existing Attachments</h4>
                      <ul className="divide-y">
                        {existingAttachments.map((attachment, index) => (
                          <li key={`existing-${index}`} className="py-2 flex items-center justify-between">
                            <div className="flex items-center">
                              {getAttachmentIcon(getFileTypeFromName(attachment.name))}
                              <span className="ml-2">{attachment.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveExistingAttachment(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* New Attachments */}
                  {attachments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">New Attachments</h4>
                      <ul className="divide-y">
                        {attachments.map((attachment, index) => (
                          <li key={`new-${index}`} className="py-2 flex items-center justify-between">
                            <div className="flex items-center">
                              {getAttachmentIcon(getFileTypeFromName(attachment.name))}
                              <span className="ml-2">{attachment.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveAttachment(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">

          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update" : "Save")}
            </Button>
            {/* <Button type="button" disabled={isDisabled} variant="default" onClick={handleShareImmediately}>
              Share Immediately
            </Button> */}
          </div>
        </div>
      </form>


      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Create/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Create New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="Enter category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingCategory ? handleEditCategory : handleCreateCategory}>
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
