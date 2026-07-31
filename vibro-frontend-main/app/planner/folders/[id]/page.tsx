"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Folder, FolderPen, Trash2, Search } from "lucide-react"
import { PlannerHistory } from "@/components/planner/planner-history"
import axiosInstance from "@/utils/axiosInstance"
import { useToast } from "@/hooks/use-toast"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function PlannerFolderDetailPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("planner", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  const router = useRouter()
  const params = useParams()
  const folderId = params.id as string
  const { toast } = useToast()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [folderName, setFolderName] = useState("")
  const [folderColor, setFolderColor] = useState("#6366F1")
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameName, setRenameName] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchFolder = useCallback(async () => {
    if (!folderId) return
    try {
      const res = await axiosInstance.get(`/planner/folders/${folderId}/`)
      setFolderName(res.data?.name || "")
      setFolderColor(res.data?.color || "#6366F1")
      setRenameName(res.data?.name || "")
    } catch (err) {
      console.error("Failed to fetch folder:", err)
    }
  }, [folderId])

  useEffect(() => {
    if (hydrated && hasRequiredAccess) fetchFolder()
  }, [hydrated, hasRequiredAccess, fetchFolder])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [])

  if (!hydrated || !hasRequiredAccess) return null

  const handleRename = async () => {
    if (!renameName.trim()) return
    try {
      await axiosInstance.put(`/planner/folders/${folderId}/`, {
        name: renameName,
        color: folderColor,
      })
      toast({ title: "Success", description: "Folder renamed successfully" })
      setShowRenameDialog(false)
      setFolderName(renameName)
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.error || "Failed to rename folder", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete folder "${folderName}"? Planners will remain but become unassigned.`)) return
    try {
      await axiosInstance.delete(`/planner/folders/${folderId}/`)
      toast({ title: "Success", description: "Folder deleted successfully" })
      router.push("/planner/folders")
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.error || "Failed to delete folder", variant: "destructive" })
    }
  }

  const colorOptions = ["#6366F1", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#14B8A6"]

  return (
    <div className="h-screen overflow-hidden flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`flex-1 h-screen flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title={`Planner - ${folderName}`}
          onBack={() => router.push("/planner/folders")}
        />

        <div className="flex-1 min-h-0 overflow-hidden p-4 md:p-8">
          <div className="h-full flex flex-col px-4 md:px-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <form className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search all columns..."
                  className="w-full sm:w-[300px] pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${folderColor}20` }}
                  >
                    <Folder className="h-4 w-4" style={{ color: folderColor }} />
                  </div>
                  <h2 className="text-xl font-bold">{folderName}</h2>
                  <button
                    onClick={() => { setRenameName(folderName); setShowRenameDialog(true) }}
                    className="relative inline-flex group ml-1"
                    title="Rename folder"
                  >
                    <FolderPen className="h-4 w-4 text-gray-500 hover:text-blue-600" />
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="p-0 flex flex-col flex-1 min-h-0">
              <PlannerHistory
                key={refreshKey}
                searchQuery={searchQuery}
                folderId={Number(folderId)}
                onPlannersMoved={() => setRefreshKey(k => k + 1)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rename Folder Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>Enter a new name for your folder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currentName" className="text-right">Current Name</Label>
              <Input
                id="currentName"
                value={folderName}
                disabled
                className="col-span-3 bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="renameName" className="text-right">New Name</Label>
              <Input
                id="renameName"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="col-span-3"
                placeholder="Enter new folder name"
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
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
