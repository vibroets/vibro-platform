"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { FormsTable } from "@/components/forms/forms-table";
import axiosInstance from "@/utils/axiosInstance";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Plus, FolderPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import DeleteFolderDialog from "@/components/ui/DeleteFolderDialog";
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import hotToaster from "react-hot-toast";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Folder {
  id: number;
  name: string;
  description: string;
  parent: number | null;
  created_by: string;
}

export default function FolderView() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  });
  if (!hydrated || !hasRequiredAccess) return null;

  const params = useParams();
  const folderId = params.id as string | undefined;

  const [forms, setForms] = useState<any[]>([]);
  const [folderName, setFolderName] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameFolderName, setRenameFolderName] = useState("");

  const [parentFolder, setParentFolder] = useState<string | undefined>("none");
  const [parentFolderIdBack, setParentFolderIdBack] = useState<string | null>("");
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);


  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  // wrapped in useCallback so we can reuse safely
  const fetchFolderForms = useCallback(async () => {
    if (!folderId) return;

    try {
      setLoading(true);
      const [formRes, folderRes, allFoldersRes] = await Promise.all([
        axiosInstance.get(`/forms/folder/${folderId}/`),
        axiosInstance.get(`/folder/${folderId}/`),
        axiosInstance.get("/folders/organization/"),
      ]);
      console.log("folders res for parent id check", folderRes.data);
      console.log("formRes.data:", formRes.data);
      console.log("allFoldersRes.data:", allFoldersRes.data);

      // Support both legacy array response and current object response:
      // { folder, subfolders, forms }.
      const formsSource = Array.isArray(formRes.data)
        ? formRes.data
        : Array.isArray(formRes.data?.forms)
          ? formRes.data.forms
          : [];

      const transformedFormsWithLatestResponse = await Promise.all(
        formsSource.map(async (item: any) => {
          const createdDateTime = new Date(item.created_at);
          const formattedDate = createdDateTime.toLocaleString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const formattedTime = createdDateTime.toLocaleString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          const formattedDateTime = `${formattedDate}\n${formattedTime}`;

          // Fetch latest response date
          let latestResponseFormatted = "—";
          try {
            const responseRes = await axiosInstance.get(`/form/${item.id}/latest-submission/`);
            if (responseRes.data) {
              const responseDate = responseRes.data.created_at || responseRes.data.submitted_at || responseRes.data.submission_initiated_on;
              if (responseDate) {
                const latestResponseDateTime = new Date(responseDate);
                const latestResponseDate = latestResponseDateTime.toLocaleString("en-GB", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                });
                const latestResponseTime = latestResponseDateTime.toLocaleString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                });
                latestResponseFormatted = `${latestResponseDate}\n${latestResponseTime}`;
              }
            }
          } catch (error) {
            // No submissions for this form
          }

          return {
            id: item.id,
            title: item.title || "Untitled",
            author: item.created_by,
            // Keep the raw timestamp so the shared created-date filter can compare reliably.
            createdAt: item.created_at,
            createdDate: formattedDateTime,
            latestResponse: latestResponseFormatted,
            formType: item.form_type || "Unknown",
            repeatSchedule: "None",
            responses: item.response_count ?? 0,
            status: item.status || (item.is_disabled ? "Disabled" : item.is_archived ? "Archived" : "Active"),
            error_message: item.error_message || "",
            deletedby: item.is_deleted || null,
            isarchived: item.is_archived || false,
          };
        })
      );

      console.log("transformedForms:", transformedFormsWithLatestResponse);
      setForms(transformedFormsWithLatestResponse);

      // Prefer subfolders from /forms/folder/:id/, fallback to organization list.
      const children = Array.isArray(formRes.data?.subfolders)
        ? formRes.data.subfolders
        : allFoldersRes.data.filter((f: Folder) => f.parent === Number(folderId));
      console.log("children folders:", children);
      setFolders(children);

      // Use folder details from the same endpoint when available.
      const folderDetails = formRes.data?.folder ?? folderRes.data;
      setCurrentFolder({
        id: folderDetails.id.toString(),
        name: folderDetails.name,
      });
      setParentFolder(folderDetails.id.toString());
      setParentFolderIdBack(
        folderDetails.parent !== null ? folderDetails.parent.toString() : undefined
      );

      setDebugInfo({
        formRes: formRes.data,
        folderRes: folderRes.data,
        allFoldersRes: allFoldersRes.data,
        formsSource,
        transformedForms: transformedFormsWithLatestResponse,
        children,
      });
    } catch (err) {
      console.error("Error fetching folder forms:", err);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    if (folderId) {
      fetchFolderForms();
    } else {
      setCurrentFolder(null);
      setParentFolder("none");
    }
  }, [folderId, fetchFolderForms]);

  const handleCreateForm = () => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/forms/new?folderId=${folderId ?? ""}`);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      hotToaster.error("Folder name cannot be empty");
      return;
    }

    try {
      await axiosInstance.post("/folder/", {
        name: folderName,
        parent: parentFolder === "none" ? null : parentFolder,
      });

      hotToaster.success("Folder Created Successfully", { duration: 2000 });

      setShowFolderDialog(false);
      setFolderName("");
      // ✅ immediately refetch after folder creation
      fetchFolderForms();
    } catch (error) {

      console.error("Failed to create folder:", error);
      hotToaster.error("Failed to create folder.");
    }
  };

  const handleRenameFolder = async () => {
    if (!renameFolderName.trim()) {
      hotToaster.error("Folder name cannot be empty");
      return;
    }

    if (!folderId) {
      hotToaster.error("Folder ID is missing");
      return;
    }

    try {
      await axiosInstance.patch(`/folder/${folderId}/`, {
        name: renameFolderName.trim(),
      });

      hotToaster.success("Folder Renamed Successfully", { duration: 2000 });

      setShowRenameDialog(false);
      setRenameFolderName("");

      // Update the current folder name in the UI
      if (currentFolder) {
        setCurrentFolder({
          ...currentFolder,
          name: renameFolderName.trim()
        });
      }

      // Refetch data to ensure consistency
      fetchFolderForms();
    } catch (error) {
      console.error("Failed to rename folder:", error);
      hotToaster.error("Failed to rename folder.");
    }
  };

  const handleRenameClick = () => {
    if (currentFolder) {
      // setRenameFolderName("");
      setShowRenameDialog(true);
    }
  };

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:pl-14"}`}
      >
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title="Folder - Forms"
          onBack={() =>
            router.push(parentFolderIdBack ? `/forms/folders/${parentFolderIdBack}` : "/forms")
          }
        />


        <div className="flex flex-col gap-4 p-4">
          <div className="px-4 md:px-6 space-y-4">
            <div className="p-0">
              <div className="flex justify-between items-center mb-4">
                <h2 className="flex text-xl font-bold">
                  {currentFolder?.name}
                  <div className="relative inline-flex  group">
                    <FolderPen
                      className="ml-2 h-4 w-4 "
                      onClick={handleRenameClick}
                    />

                    <span className="absolute left-full ml-2 whitespace-nowrap rounded bg-blue-200 px-2 py-1 text-xs text-black opacity-0 transition-opacity group-hover:opacity-100">
                      Rename folder
                    </span>
                  </div>
                </h2>

                <div className="flex space-x-2">
                  <Button size="sm" onClick={handleCreateForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Form
                  </Button>
                  <Button
                    size="sm"
                    className="bg-white text-black border-2 border-gray-400 hover:bg-blue-100 transition-all ease-in-out duration-100"
                    onClick={() => setShowFolderDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                  {folderId && (
                    <DeleteFolderDialog
                      folderId={folderId}
                      folderName={currentFolder?.name || ""}
                    />
                  )}
                  {/* <Button
                    size="sm"
                    className="bg-white text-black border-2 border-gray-400 hover:bg-blue-100 transition-all ease-in-out duration-100"
                    onClick={handleRenameClick}
                  >
                    Rename
                  </Button> */}
                </div>

                {/* ------------------- Create Folder Dialog ------------------- */}
                <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Folder</DialogTitle>
                      <DialogDescription>
                        Enter a name for your new folder.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      {/* Folder Name */}
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

                      {/* Parent Folder (read-only) */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="parentFolder" className="text-right">
                          Parent Folder
                        </Label>
                        <Input
                          id="parentFolder"
                          value={currentFolder ? currentFolder.name : "None (Root Level)"}
                          readOnly
                          className="col-span-3 bg-gray-100 cursor-not-allowed"
                        />
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

                {/* ------------------- Rename Folder Dialog ------------------- */}
                <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rename Folder</DialogTitle>
                      <DialogDescription>
                        Enter a new name for your folder.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      {/* Current Folder Name */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="currentFolderName" className="text-right">
                          Current Name
                        </Label>
                        <Input
                          id="currentFolderName"
                          value={currentFolder?.name || ""}
                          disabled
                          className="col-span-3 bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      {/* New Folder Name */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="renameFolderName" className="text-right">
                          New Name
                        </Label>
                        <Input
                          id="renameFolderName"
                          value={renameFolderName}
                          onChange={(e) => setRenameFolderName(e.target.value)}
                          className="col-span-3"
                          placeholder="Enter new folder name"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleRenameFolder} disabled={!renameFolderName.trim()}>
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <FormsTable
                searchQuery=""
                formType={null}
                dateRange={{ from: undefined, to: undefined }}
                injectedForms={forms}
                injectedFolders={folders}
                loadingstate={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

