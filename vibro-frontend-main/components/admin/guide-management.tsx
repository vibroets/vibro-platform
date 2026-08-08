"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import {
  Folder,
  FolderOpen,
  FileText,
  Upload,
  Plus,
  Trash2,
  Share2,
  Download,
  Eye,
  ChevronRight,
  ChevronDown,
  Lock,
  Printer,
  Camera,
  File,
  ArrowLeft,
  Users,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import hotToaster from "react-hot-toast";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

interface GuideFolder {
  id: number;
  name: string;
  parent: number | null;
  document_count: number;
  has_children: boolean;
  created_at: string;
}

interface GuideDocument {
  id: number;
  title: string;
  description: string | null;
  folder: number | null;
  folder_name: string | null;
  file: string;
  file_url: string | null;
  file_type: string | null;
  file_size: number;
  document_type: string;
  uploaded_by: number;
  uploaded_by_name: string | null;
  allow_download: boolean;
  allow_print: boolean;
  allow_screenshot: boolean;
  created_at: string;
}

interface ShareTarget {
  id: number;
  name: string;
}

export default function GuideManagement() {
  const { isFullAccess, isViewOnly, isSuperAdmin } = useModuleAccess("guides");
  const canEdit = isFullAccess || isSuperAdmin;
  const reduxUser = useSelector((state: RootState) => state.auth?.user);
  const [folders, setFolders] = useState<GuideFolder[]>([]);
  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: number | null; name: string }[]>([{ id: null, name: "Root" }]);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showRestrictionsDialog, setShowRestrictionsDialog] = useState(false);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadDocType, setUploadDocType] = useState("other");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState<number | null>(null);
  const [shareTargetDoc, setShareTargetDoc] = useState<GuideDocument | null>(null);
  const [shareTargetFolder, setShareTargetFolder] = useState<GuideFolder | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [users, setUsers] = useState<ShareTarget[]>([]);
  const [groups, setGroups] = useState<ShareTarget[]>([]);
  const [restrictionsDoc, setRestrictionsDoc] = useState<GuideDocument | null>(null);

  const fetchFolders = useCallback(async (parentId: number | null) => {
    try {
      const url = parentId
        ? `/guide-folders/${parentId}/children/`
        : `/guide-folders/root/`;
      const res = await axiosInstance.get(url);
      setFolders(res.data);
    } catch (err) {
      console.error("Failed to fetch folders", err);
    }
  }, []);

  const fetchDocuments = useCallback(async (folderId: number | null) => {
    try {
      let url = `/guide-documents/`;
      if (folderId) {
        url = `/guide-folders/${folderId}/documents/`;
      }
      const res = await axiosInstance.get(url);
      // If in a folder, show all. If at root, filter to root-level docs (folder=null)
      if (folderId) {
        setDocuments(res.data);
      } else {
        setDocuments(res.data.filter((d: GuideDocument) => d.folder === null));
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  }, []);

  const fetchAll = useCallback(async (folderId: number | null) => {
    setLoading(true);
    await Promise.all([fetchFolders(folderId), fetchDocuments(folderId)]);
    setLoading(false);
  }, [fetchFolders, fetchDocuments]);

  useEffect(() => {
    fetchAll(currentFolderId);
  }, [currentFolderId, fetchAll]);

  const handleFolderClick = (folder: GuideFolder) => {
    setCurrentFolderId(folder.id);
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    setCurrentFolderId(newStack[newStack.length - 1].id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      hotToaster.error("Folder name is required");
      return;
    }
    try {
      await axiosInstance.post("/guide-folders/", {
        name: newFolderName.trim(),
        parent: currentFolderId,
      });
      hotToaster.success("Folder created");
      setShowFolderDialog(false);
      setNewFolderName("");
      fetchAll(currentFolderId);
    } catch (err) {
      hotToaster.error("Failed to create folder");
    }
  };

  const handleDeleteFolder = async (folder: GuideFolder) => {
    if (!confirm(`Delete folder "${folder.name}" and all its contents?`)) return;
    try {
      await axiosInstance.delete(`/guide-folders/${folder.id}/`);
      hotToaster.success("Folder deleted");
      fetchAll(currentFolderId);
    } catch (err) {
      hotToaster.error("Failed to delete folder");
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadFile) {
      hotToaster.error("Title and file are required");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle.trim());
      formData.append("description", uploadDescription || "");
      formData.append("document_type", uploadDocType);
      formData.append("folder", uploadFolder ? String(uploadFolder) : "");
      formData.append("file", uploadFile);

      await axiosInstance.post("/guide-documents/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      hotToaster.success("Document uploaded");
      setShowUploadDialog(false);
      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      setUploadDocType("other");
      fetchAll(currentFolderId);
    } catch (err) {
      hotToaster.error("Failed to upload document");
    }
  };

  const handleDeleteDocument = async (doc: GuideDocument) => {
    if (!confirm(`Delete document "${doc.title}"?`)) return;
    try {
      await axiosInstance.delete(`/guide-documents/${doc.id}/`);
      hotToaster.success("Document deleted");
      fetchAll(currentFolderId);
    } catch (err) {
      hotToaster.error("Failed to delete document");
    }
  };

  const handleDownload = async (doc: GuideDocument) => {
    if (!doc.allow_download) {
      hotToaster.error("Download is restricted for this document");
      return;
    }
    try {
      const response = await axiosInstance.get(`/guide-documents/${doc.id}/download/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${doc.title}.${doc.file_type || "file"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      hotToaster.error("Failed to download document");
    }
  };

  const handleView = async (doc: GuideDocument) => {
    try {
      const response = await axiosInstance.get(`/guide-documents/${doc.id}/view/`, {
        responseType: "blob",
      });
      const contentType = response.headers["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(url);
        }, 30000);
      } else {
        setTimeout(() => window.URL.revokeObjectURL(url), 30000);
      }
    } catch (err) {
      console.error("View failed", err);
      hotToaster.error("Failed to view document");
    }
  };

  const openShareDialog = async (doc: GuideDocument | null, folder: GuideFolder | null) => {
    setShareTargetDoc(doc);
    setShareTargetFolder(folder);
    setSelectedUserIds([]);
    setSelectedGroupIds([]);
    setUsers([]);
    setGroups([]);
    setShowShareDialog(true);
    try {
      const orgId = reduxUser?.organization;
      const roleName = reduxUser?.role_details?.name;

      const usersUrl = "/users/list";
      const groupsUrl = roleName === "admin" && orgId
        ? `/organization/groups/${orgId}/`
        : "/groups/";

      const [usersRes, groupsRes] = await Promise.all([
        axiosInstance.get(usersUrl),
        axiosInstance.get(groupsUrl),
      ]);
      const usersData = usersRes.data || [];
      const groupsData = groupsRes.data.results || groupsRes.data || [];
      setUsers(usersData.map((u: any) => ({
        id: u.id,
        name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username,
      })));
      setGroups(groupsData.map((g: any) => ({
        id: g.id,
        name: g.name,
      })));
    } catch (err) {
      console.error("Failed to fetch users/groups", err);
    }
  };

  const handleShare = async () => {
    try {
      await axiosInstance.post("/guide-shares/bulk_share/", {
        folder_id: shareTargetFolder?.id || null,
        document_id: shareTargetDoc?.id || null,
        user_ids: selectedUserIds,
        group_ids: selectedGroupIds,
      });
      hotToaster.success("Shared successfully");
      setShowShareDialog(false);
    } catch (err) {
      hotToaster.error("Failed to share");
    }
  };

  const handleSaveRestrictions = async () => {
    if (!restrictionsDoc) return;
    try {
      await axiosInstance.patch(`/guide-documents/${restrictionsDoc.id}/restrictions/`, {
        allow_download: restrictionsDoc.allow_download,
        allow_print: restrictionsDoc.allow_print,
        allow_screenshot: restrictionsDoc.allow_screenshot,
      });
      hotToaster.success("Restrictions updated");
      setShowRestrictionsDialog(false);
      setRestrictionsDoc(null);
      fetchAll(currentFolderId);
    } catch (err) {
      hotToaster.error("Failed to update restrictions");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeIcon = (docType: string) => {
    switch (docType) {
      case "sop": return <FileText className="h-5 w-5 text-blue-500" />;
      case "tutorial": return <FileText className="h-5 w-5 text-green-500" />;
      case "qap": return <FileText className="h-5 w-5 text-purple-500" />;
      case "drawing": return <FileText className="h-5 w-5 text-orange-500" />;
      case "report": return <FileText className="h-5 w-5 text-red-500" />;
      default: return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {folderStack.map((item, index) => (
            <div key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`text-sm font-medium hover:text-blue-600 ${
                  index === folderStack.length - 1 ? "text-blue-600" : "text-gray-600"
                }`}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowFolderDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Folder
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setUploadFolder(currentFolderId);
                  setShowUploadDialog(true);
                }}
              >
                <Upload className="h-4 w-4 mr-1" /> Upload
              </Button>
            </>
          ) : isViewOnly ? (
            <span className="text-xs text-gray-500 italic">View only access</span>
          ) : null}
        </div>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {folders.map((folder) => (
            <Card
              key={folder.id}
              className="group relative cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleFolderClick(folder)}
            >
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <Folder className="h-10 w-10 text-blue-500" />
                <p className="text-sm font-medium text-center truncate w-full">{folder.name}</p>
                <p className="text-xs text-gray-500">{folder.document_count} docs</p>
              </CardContent>
              {canEdit && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                <button
                  className="p-1 rounded hover:bg-blue-100"
                  onClick={(e) => { e.stopPropagation(); openShareDialog(null, folder); }}
                  title="Share folder"
                >
                  <Share2 className="h-3.5 w-3.5 text-blue-600" />
                </button>
                <button
                  className="p-1 rounded hover:bg-red-100"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                  title="Delete folder"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </button>
              </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {getDocTypeIcon(doc.document_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {doc.uploaded_by_name} · {formatFileSize(doc.file_size)} · {doc.file_type?.toUpperCase()}
                    </p>
                    {doc.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs capitalize">{doc.document_type}</Badge>
                      {!doc.allow_download && (
                        <Badge variant="destructive" className="text-xs"><Download className="h-3 w-3 mr-0.5" />Blocked</Badge>
                      )}
                      {!doc.allow_print && (
                        <Badge variant="destructive" className="text-xs"><Printer className="h-3 w-3 mr-0.5" />No Print</Badge>
                      )}
                      {!doc.allow_screenshot && (
                        <Badge variant="destructive" className="text-xs"><Camera className="h-3 w-3 mr-0.5" />No Screenshot</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" onClick={() => handleView(doc)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} disabled={!doc.allow_download}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openShareDialog(doc, null)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRestrictionsDoc(doc); setShowRestrictionsDialog(true); }}>
                        <Lock className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDocument(doc)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        folders.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-400">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No documents or folders yet. Create a folder or upload a document to get started.</p>
          </div>
        )
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. SOPs, QAPs, Tutorials..."
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
            <div>
              <Label>Document Type</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                  <SelectItem value="qap">QAP</SelectItem>
                  <SelectItem value="drawing">Drawing</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File</Label>
              <Input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-xs text-gray-500 mt-1">
                  {uploadFile.name} ({formatFileSize(uploadFile.size)})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUpload}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Share {shareTargetDoc ? "Document" : "Folder"}: {shareTargetDoc?.title || shareTargetFolder?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Share with Users</Label>
              {users.length === 0 ? (
                <p className="text-xs text-gray-400">Loading users...</p>
              ) : (
                <MultiSelectCombobox
                  options={users.map((u) => ({ label: u.name, value: String(u.id) }))}
                  selectedValues={selectedUserIds.map(String)}
                  onChange={(vals) => setSelectedUserIds(vals.map(Number))}
                  placeholder="Select users..."
                  searchPlaceholder="Search users..."
                  notFoundText="No users found."
                />
              )}
            </div>
            <div>
              <Label className="mb-2 block">Share with Groups</Label>
              {groups.length === 0 ? (
                <p className="text-xs text-gray-400">No groups available</p>
              ) : (
                <MultiSelectCombobox
                  options={groups.map((g) => ({ label: g.name, value: String(g.id) }))}
                  selectedValues={selectedGroupIds.map(String)}
                  onChange={(vals) => setSelectedGroupIds(vals.map(Number))}
                  placeholder="Select groups..."
                  searchPlaceholder="Search groups..."
                  notFoundText="No groups found."
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onClick={handleShare} disabled={selectedUserIds.length === 0 && selectedGroupIds.length === 0}>
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restrictions Dialog */}
      <Dialog open={showRestrictionsDialog} onOpenChange={setShowRestrictionsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Document Restrictions</DialogTitle>
          </DialogHeader>
          {restrictionsDoc && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium">{restrictionsDoc.title}</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <Label>Allow Download</Label>
                  </div>
                  <Switch
                    checked={restrictionsDoc.allow_download}
                    onCheckedChange={(checked) => setRestrictionsDoc({ ...restrictionsDoc, allow_download: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    <Label>Allow Print</Label>
                  </div>
                  <Switch
                    checked={restrictionsDoc.allow_print}
                    onCheckedChange={(checked) => setRestrictionsDoc({ ...restrictionsDoc, allow_print: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <Label>Allow Screenshot</Label>
                  </div>
                  <Switch
                    checked={restrictionsDoc.allow_screenshot}
                    onCheckedChange={(checked) => setRestrictionsDoc({ ...restrictionsDoc, allow_screenshot: checked })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestrictionsDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveRestrictions}>Save Restrictions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
