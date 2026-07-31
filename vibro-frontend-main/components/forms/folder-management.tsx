"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Folder, FolderOpen, File, MoreHorizontal, Plus, Edit, Trash, Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import axiosInstance from "@/utils/axiosInstance"
import { useSelector } from "react-redux"
import { selectUser } from "@/redux/slices/authSlice"

interface FolderType {
  id: string
  name: string
  description?: string
  parent?: string
  created_at: string
  updated_at: string
  created_by: string
  subfolders: FolderType[]
  forms: any[]
}

interface Form {
  id: string
  title: string
  // Add other form properties as needed
}

export function FolderManagement() {
  const [folders, setFolders] = useState<FolderType[]>([])
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showAccessDeniedDialog, setShowAccessDeniedDialog] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [parentFolder, setParentFolder] = useState("")
  const [currentFolder, setCurrentFolder] = useState<FolderType | null>(null)
  const { toast } = useToast()
  const user = useSelector(selectUser)
  const router = useRouter()

  const fetchFolders = async (parentId?: string) => {
    try {
      const response = await axiosInstance.get(`/folder/${parentId ? `?parent=${parentId}` : ''}`);

      // Check if the response indicates access denied for super admin
      if (response.data?.access === "denied" && response.data?.message === "You don't have access to this module.") {
        setShowAccessDeniedDialog(true);
        return;
      }

      const fetchedFolders = response.data.map((folder: any) => ({
        ...folder,
        id: folder.id.toString(),
        subfolders: [],
        forms: [],
      }));

      if (parentId) {
        setFolders(prev =>
          prev.map(folder =>
            folder.id === parentId ? { ...folder, subfolders: fetchedFolders } : folder
          )
        );
      } else {
        setFolders(fetchedFolders);
      }
    } catch (error: any) {
      console.error("Failed to fetch folders:", error);
      toast({
        title: "Error",
        description: "Failed to fetch folders.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  // Get root level folders
  const rootFolders = folders.filter((folder) => !folder.parent)

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const isExpanded = expandedFolders.includes(folderId);
    if (isExpanded) {
      setExpandedFolders(prev => prev.filter(id => id !== folderId));
    } else {
      setExpandedFolders(prev => [...prev, folderId]);
      const folder = folders.find(f => f.id === folderId);
      if (folder && folder.subfolders.length === 0) {
        fetchFolders(folderId);
      }
    }
  };

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await axiosInstance.post("/folder/", {
        name: folderName,
        parent: parentFolder === "none" ? null : parentFolder,
      });
      toast({
        title: "Folder Created",
        description: `Folder "${folderName}" has been created.`,
      });
      setShowFolderDialog(false);
      setFolderName("");
      setParentFolder("");
      fetchFolders(); // Refetch all folders
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder.",
        variant: "destructive",
      });
    }
  };

  // Handle edit folder
  const handleEditFolder = async () => {
    if (!folderName.trim() || !currentFolder) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty",
        variant: "destructive",
      })
      return
    }

    try {
      await axiosInstance.put(`/folder/${currentFolder.id}/`, {
        name: folderName,
        parent: parentFolder === "none" ? null : parentFolder,
      });
      toast({
        title: "Folder Updated",
        description: `Folder "${folderName}" has been updated.`,
      });
      setShowEditDialog(false);
      setCurrentFolder(null);
      setFolderName("");
      setParentFolder("");
      fetchFolders(); // Refetch all folders
    } catch (error) {
      console.error("Failed to update folder:", error);
      toast({
        title: "Error",
        description: "Failed to update folder.",
        variant: "destructive",
      });
    }
  };

  // Handle delete folder
  const handleDeleteFolder = async (folder: FolderType) => {
    // A more robust check should be done on the backend, but this is a client-side guard
    if (folder.forms.length > 0 || folder.subfolders.length > 0) {
      toast({
        title: "Cannot Delete Folder",
        description: "Folder may contain forms or subfolders. Please ensure it's empty before deleting.",
        variant: "destructive",
      });
      // We can still attempt deletion and let the backend decide.
    }

    try {
      await axiosInstance.delete(`/folder/${folder.id}/`);
      toast({
        title: "Folder Deleted",
        description: `Folder "${folder.name}" has been deleted.`,
      });
      fetchFolders(); // Refetch all folders
    } catch (error) {
      console.error("Failed to delete folder:", error);
      toast({
        title: "Error",
        description: "Failed to delete folder. It might not be empty.",
        variant: "destructive",
      });
    }
  };


  // Open edit dialog
  const openEditDialog = (folder: FolderType) => {
    setCurrentFolder(folder)
    setFolderName(folder.name)
    setParentFolder(folder.parent || "none")
    setShowEditDialog(true)
  }

  // Render folder tree recursively
  const renderFolderTree = (foldersToRender: FolderType[], level = 0) => {
    if (foldersToRender.length === 0) {
      return null
    }

    return (
      <ul className={`pl-${level > 0 ? 4 : 0}`}>
        {foldersToRender.map((folder) => {
          const isExpanded = expandedFolders.includes(folder.id)
          const hasChildren = folder.subfolders.length > 0

          return (
            <li key={folder.id} className="py-1">
              <div className="flex items-center justify-between group">
                <div
                  className="flex items-center cursor-pointer hover:bg-gray-100 rounded px-2 py-1 flex-grow"
                  onClick={() => toggleFolder(folder.id)}
                >
                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
                  ) : (
                    <Folder className="h-4 w-4 mr-2 text-blue-500" />
                  )}
                  <span className="text-sm">{folder.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({folder.forms.length})</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEditDialog(folder)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteFolder(folder)}>
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Form
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {isExpanded && (
                <>
                  {hasChildren && renderFolderTree(folder.subfolders, level + 1)}
                  {folder.forms.length > 0 && (
                    <ul className="pl-4">
                      {folder.forms.map((form: Form) => (
                        <li key={form.id} className="py-1">
                          <div className="flex items-center">
                            <File className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-sm">{form.title}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  // Get available parent folders (excluding the current folder and its children)
  const getAvailableParentFolders = (currentFolderId?: string) => {
    if (!currentFolderId) {
      return folders.filter(f => !f.parent);
    }

    const descendantIds = new Set<string>();
    const getDescendants = (folderId: string) => {
      descendantIds.add(folderId);
      const children = folders.flatMap(f => f.id === folderId ? f.subfolders : []);
      for (const child of children) {
        getDescendants(child.id);
      }
    };

    getDescendants(currentFolderId);

    return folders.filter(f => !descendantIds.has(f.id));
  };

  return (
    <div className="border rounded-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Folder Management</h3>
        <Button size="sm" onClick={() => setShowFolderDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </div>

      <div className="max-h-[400px] overflow-y-auto">{renderFolderTree(rootFolders)}</div>

      {/* Create Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="folderName" className="text-right">
                Folder Name
              </Label>
              <Input
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentFolder" className="text-right">
                Parent Folder
              </Label>
              <Select value={parentFolder} onValueChange={setParentFolder}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select parent folder (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Root Level)</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
              Create Folder
            </Button>
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
              <Label htmlFor="editFolderName" className="text-right">
                Folder Name
              </Label>
              <Input
                id="editFolderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editParentFolder" className="text-right">
                Parent Folder
              </Label>
              <Select value={parentFolder} onValueChange={setParentFolder}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select parent folder (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Root Level)</SelectItem>
                  {getAvailableParentFolders(currentFolder?.id).map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditFolder} disabled={!folderName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Denied Dialog */}
      <AlertDialog open={showAccessDeniedDialog} onOpenChange={setShowAccessDeniedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Access Denied</AlertDialogTitle>
            <AlertDialogDescription>
              You don't have access to this module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowAccessDeniedDialog(false);
              router.push("/dashboard");
            }}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
