"use client"

import { useState, useEffect, useCallback } from "react"
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
  Folder,
  FolderPlus,
  FolderOpen,
  Pencil,
  Trash2,
  GripVertical,
} from "lucide-react"
import axiosInstance from "@/utils/axiosInstance"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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
  planner_count: number
  order?: number
}

interface PlannerFoldersProps {
  selectedFolderId: number | null
  onSelectFolder: (folderId: number | null) => void
  refreshKey?: number
}

function SortableFolderRow({
  folder,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  folder: PlannerFolder
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
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
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
        isSelected
          ? "bg-blue-100 text-blue-700 font-medium"
          : "hover:bg-muted text-muted-foreground"
      )}
      onClick={onSelect}
    >
      <div
        className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        style={{ touchAction: "none" }}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Folder
        className="h-4 w-4 flex-shrink-0"
        style={{ color: folder.color }}
      />
      <span className="flex-1 truncate">{folder.name}</span>
      <span className="text-xs text-muted-foreground">{folder.planner_count}</span>
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button
          className="p-0.5 hover:bg-blue-200 rounded"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          className="p-0.5 hover:bg-red-200 rounded"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3 text-red-500" />
        </button>
      </div>
    </div>
  )
}

export function PlannerFolders({ selectedFolderId, onSelectFolder, refreshKey }: PlannerFoldersProps) {
  const { toast } = useToast()
  const [folders, setFolders] = useState<PlannerFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editFolder, setEditFolder] = useState<PlannerFolder | null>(null)
  const [folderName, setFolderName] = useState("")
  const [folderColor, setFolderColor] = useState("#6366F1")
  const [isSaving, setIsSaving] = useState(false)

  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axiosInstance.get("/planner/folders/")
      const sorted = (res.data || []).sort((a: PlannerFolder, b: PlannerFolder) => (a.order ?? 0) - (b.order ?? 0))
      setFolders(sorted)
    } catch (err) {
      console.error("Failed to fetch folders:", err)
      setFolders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders, refreshKey])

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast({ title: "Error", description: "Folder name is required", variant: "destructive" })
      return
    }
    setIsSaving(true)
    try {
      await axiosInstance.post("/planner/folders/", { name: folderName.trim(), color: folderColor })
      toast({ title: "Success", description: "Folder created" })
      setFolderName("")
      setFolderColor("#6366F1")
      setCreateDialogOpen(false)
      fetchFolders()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to create folder",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editFolder || !folderName.trim()) return
    setIsSaving(true)
    try {
      await axiosInstance.put(`/planner/folders/${editFolder.id}/`, {
        name: folderName.trim(),
        color: folderColor,
      })
      toast({ title: "Success", description: "Folder updated" })
      setEditFolder(null)
      setFolderName("")
      setFolderColor("#6366F1")
      fetchFolders()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to update folder",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (folder: PlannerFolder) => {
    if (!confirm(`Delete folder "${folder.name}"? Planners in this folder will remain but lose the folder association.`)) return
    try {
      await axiosInstance.delete(`/planner/folders/${folder.id}/`)
      toast({ title: "Success", description: "Folder deleted" })
      if (selectedFolderId === folder.id) onSelectFolder(null)
      fetchFolders()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to delete folder",
        variant: "destructive",
      })
    }
  }

  const openEdit = (folder: PlannerFolder) => {
    setEditFolder(folder)
    setFolderName(folder.name)
    setFolderColor(folder.color)
  }

  const closeDialog = () => {
    setCreateDialogOpen(false)
    setEditFolder(null)
    setFolderName("")
    setFolderColor("#6366F1")
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = folders.findIndex((f) => f.id === active.id)
    const newIndex = folders.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(folders, oldIndex, newIndex)
    const folderIds = reordered.map((f) => f.id)

    // Optimistic update
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

  const totalPlanners = folders.reduce((sum, f) => sum + f.planner_count, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Folders</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => {
            setFolderName("")
            setFolderColor("#6366F1")
            setCreateDialogOpen(true)
          }}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {/* All Planners option */}
        <button
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
            selectedFolderId === null
              ? "bg-blue-100 text-blue-700 font-medium"
              : "hover:bg-muted text-muted-foreground"
          )}
          onClick={() => onSelectFolder(null)}
        >
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">All Planners</span>
          <span className="text-xs text-muted-foreground">{totalPlanners}</span>
        </button>

        {loading ? (
          <div className="text-xs text-muted-foreground p-3 text-center">Loading...</div>
        ) : folders.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3 text-center">No folders yet</div>
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
              {folders.map((folder) => (
                <SortableFolderRow
                  key={folder.id}
                  folder={folder}
                  isSelected={selectedFolderId === folder.id}
                  onSelect={() => onSelectFolder(selectedFolderId === folder.id ? null : folder.id)}
                  onEdit={() => openEdit(folder)}
                  onDelete={() => handleDelete(folder)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={createDialogOpen || !!editFolder} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editFolder ? "Edit Folder" : "Create Folder"}</DialogTitle>
            <DialogDescription>
              {editFolder ? "Rename or change the color of this folder" : "Create a new folder to organize planners"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g., Quarterly PM"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    editFolder ? handleEdit() : handleCreate()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={folderColor}
                  onChange={(e) => setFolderColor(e.target.value)}
                  className="h-8 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={folderColor}
                  onChange={(e) => setFolderColor(e.target.value)}
                  className="flex-1"
                  placeholder="#6366F1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={editFolder ? handleEdit : handleCreate} disabled={isSaving}>
              {isSaving ? "Saving..." : editFolder ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
