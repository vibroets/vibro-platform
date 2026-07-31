"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Folder, FolderPlus, MoreHorizontal, Pencil, Trash2, ArrowLeft, ChevronRight, GripVertical } from "lucide-react"
import axiosInstance from "@/utils/axiosInstance"
import { useToast } from "@/hooks/use-toast"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface PlannerFolder {
  id: number
  name: string
  color: string
  created_on?: string
  created_by?: string
  planner_count?: number
  order?: number
}

function SortableFolderRow({
  folder,
  onEdit,
  onDelete,
  onClick,
}: {
  folder: PlannerFolder
  onEdit: () => void
  onDelete: () => void
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between group hover:bg-gray-50 rounded-lg px-3 py-2 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          style={{ touchAction: "none" }}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${folder.color}20` }}
        >
          <Folder className="h-4 w-4" style={{ color: folder.color }} />
        </div>
        <div>
          <span className="text-sm font-medium">{folder.name}</span>
          {folder.planner_count != null && (
            <span className="text-xs text-gray-500 ml-2">({folder.planner_count} planners)</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:hidden" />
        <div className="hidden group-hover:block" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default function PlannerFoldersPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("planner", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  const router = useRouter()
  const { toast } = useToast()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [folders, setFolders] = useState<PlannerFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [folderColor, setFolderColor] = useState("#6366F1")
  const [editFolder, setEditFolder] = useState<PlannerFolder | null>(null)

  const fetchFolders = async () => {
    try {
      setLoading(true)
      const res = await axiosInstance.get("/planner/folders/")
      const sorted = (res.data || []).sort((a: PlannerFolder, b: PlannerFolder) => (a.order ?? 0) - (b.order ?? 0))
      setFolders(sorted)
    } catch (err) {
      console.error("Failed to fetch folders:", err)
      toast({ title: "Error", description: "Failed to fetch folders", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hydrated && hasRequiredAccess) fetchFolders()
  }, [hydrated, hasRequiredAccess])

  if (!hydrated || !hasRequiredAccess) return null

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast({ title: "Error", description: "Folder name is required", variant: "destructive" })
      return
    }
    try {
      await axiosInstance.post("/planner/folders/", {
        name: folderName,
        color: folderColor,
      })
      toast({ title: "Success", description: "Folder created successfully" })
      setShowCreateDialog(false)
      setFolderName("")
      setFolderColor("#6366F1")
      fetchFolders()
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.error || "Failed to create folder", variant: "destructive" })
    }
  }

  const handleEdit = async () => {
    if (!folderName.trim() || !editFolder) return
    try {
      await axiosInstance.put(`/planner/folders/${editFolder.id}/`, {
        name: folderName,
        color: folderColor,
      })
      toast({ title: "Success", description: "Folder updated successfully" })
      setShowEditDialog(false)
      setEditFolder(null)
      setFolderName("")
      setFolderColor("#6366F1")
      fetchFolders()
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.error || "Failed to update folder", variant: "destructive" })
    }
  }

  const handleDelete = async (folder: PlannerFolder) => {
    if (!confirm(`Delete folder "${folder.name}"? Planners in this folder will remain but become unassigned.`)) return
    try {
      await axiosInstance.delete(`/planner/folders/${folder.id}/`)
      toast({ title: "Success", description: "Folder deleted successfully" })
      fetchFolders()
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.error || "Failed to delete folder", variant: "destructive" })
    }
  }

  const openEdit = (folder: PlannerFolder) => {
    setEditFolder(folder)
    setFolderName(folder.name)
    setFolderColor(folder.color || "#6366F1")
    setShowEditDialog(true)
  }

  const colorOptions = ["#6366F1", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#14B8A6"]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = folders.findIndex((f) => f.id === active.id)
    const newIndex = folders.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(folders, oldIndex, newIndex)
    const folderIds = reordered.map((f) => f.id)

    setFolders(reordered.map((f, i) => ({ ...f, order: i })))

    try {
      await axiosInstance.post("/planner/folders/reorder/", { folder_ids: folderIds })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to reorder folders",
        variant: "destructive",
      })
      fetchFolders()
    }
  }

  return (
    <div className="h-screen overflow-hidden flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`flex-1 h-screen flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title="Planner Folders"
          onBack={() => router.push("/planner")}
        />

        <div className="flex-1 min-h-0 overflow-hidden p-4 md:p-8">
          <div className="h-full flex flex-col px-4 md:px-6 space-y-4">
            <div className="flex justify-between items-center">
              <div />
              <Button size="sm" onClick={() => { setFolderName(""); setFolderColor("#6366F1"); setShowCreateDialog(true) }}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </div>

            <div className="border rounded-lg p-4 flex flex-col flex-1 min-h-0">
              <h3 className="text-lg font-medium mb-4">Folder Management</h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading folders...</div>
              ) : folders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No folders yet. Click "New Folder" to create one.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={folders.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1 overflow-auto flex-1 min-h-0">
                      {folders.map((folder) => (
                        <SortableFolderRow
                          key={folder.id}
                          folder={folder}
                          onClick={() => router.push(`/planner/folders/${folder.id}`)}
                          onEdit={() => openEdit(folder)}
                          onDelete={() => handleDelete(folder)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name and color for your new planner folder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="folderName" className="text-right">Folder Name</Label>
              <Input
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="col-span-3"
                placeholder="Enter folder name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Color</Label>
              <div className="col-span-3 flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFolderColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${folderColor === color ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!folderName.trim()}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editFolderName" className="text-right">Folder Name</Label>
              <Input
                id="editFolderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Color</Label>
              <div className="col-span-3 flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFolderColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${folderColor === color ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!folderName.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
