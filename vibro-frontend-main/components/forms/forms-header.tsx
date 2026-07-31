"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Filter, Download, Upload, RefreshCw, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DateRange } from "react-day-picker"
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import hotToaster from "react-hot-toast";
import axiosInstance from "@/utils/axiosInstance"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"


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


interface FormsHeaderProps {
  isOpen: boolean;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  formType: string;
  setFormType: React.Dispatch<React.SetStateAction<string>>;
  // dateRange: DateRange | undefined;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  [key: string]: any;
}

export function FormsHeader(
  { isOpen, searchQuery, setSearchQuery, formType, setFormType, dateRange, setDateRange, ...props }: FormsHeaderProps) {

  const user = useSelector(selectUser);
  console.log("superadmin check user object in Folder View Page:", user?.role);
  const issuperadmincheck = user?.role=='1';
  console.log("Superadmin Check in Folder View Page:", issuperadmincheck);
  const [searchTerm, setSearchTerm] = useState("")
  // const [formType, setFormType] = useState("")
  // const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  // const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [parentFolder, setParentFolder] = useState("")
  const router = useRouter()
  const { toast } = useToast()
  const currentuser = useSelector(selectUser);
  const [folderDescription, setFolderDescription] = useState("")
  const [folders, setFolders] = useState<FolderType[]>([])
  const [showAccessDeniedDialog, setShowAccessDeniedDialog] = useState(false)

const didFetch = useRef(false);

  const { isFullAccess, isViewOnly } = useModuleAccess("forms");


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
    if(!issuperadmincheck){
      fetchFolders();
    }else{
      setShowAccessDeniedDialog(true);
    }
  }, []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // setSearchTerm(e.target.value)
    setSearchQuery(e.target.value)

    // In a real app, you would trigger a search or filter operation
  }

  // Handle form type filter change
  const handleFormTypeChange = (value: string) => {

    if (value.toLowerCase() === "all") {
      setFormType("")
    } else {
      setFormType(value)
    }
    // In a real app, you would trigger a filter operation
  }

  const handleDateRangeFunction = () => {
    setDateRange(undefined)
  };

  // Handle date range selection
  const handleDateRangeSelect = (date: Date | undefined) => {
    if (!dateRange.from) {
      setDateRange({ from: date })
    } else if (dateRange.from && !dateRange.to && date && date > dateRange.from) {
      setDateRange({ from: dateRange.from, to: date })
    } else {
      setDateRange({ from: date })
    }
    // In a real app, you would trigger a filter operation when both dates are selected
  }

  // Handle create new form button click
  const handleCreateForm = () => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push("/forms/new")
  }

  // Handle sync button click
  const handleSync = () => {
    toast({
      title: "Syncing Forms",
      description: "Synchronizing forms with the server...",
    })
    // In a real app, you would trigger a sync operation
    setTimeout(() => {
      toast({
        title: "Sync Complete",
        description: "All forms have been synchronized.",
      })
    }, 2000)
  }

  // Handle bulk upload
  const handleBulkUpload = () => {
    toast({
      title: "Bulk Upload",
      description: "Opening bulk upload dialog...",
    })
    // In a real app, you would open a bulk upload dialog
  }

  // Handle bulk export
  const handleBulkExport = () => {
    toast({
      title: "Bulk Export",
      description: "Exporting all forms...",
    })
    // In a real app, you would trigger a bulk export operation
  }


  const handleCreateFolder = async () => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Creating folders is disabled.");
      return;
    }
    if (!folderName.trim()) {
      hotToaster.error("Folder name cannot be empty");
      return;
    }

    try {
      const response = await axiosInstance.post("/folder/", {
        name: folderName,
        parent: parentFolder === "none" ? null : parentFolder,
      });

      hotToaster.success(
        "Folder Created\n" + `Folder "${folderName}" has been created.`
      );

      setShowFolderDialog(false);
      setFolderName("");
      setParentFolder("");
      fetchFolders(); // Refetch all folders
    } catch (error) {
      console.error("Failed to create folder:", error);
      
      hotToaster.error("Failed to create folder.");
    }
  };



  return (
    <>
      <div
        className={`flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center p-4 pr-0 pl-0 border-b border-gray-300  bg-white rounded-lg shadow-sm ${isOpen ? 'md:justify-between' : 'md:justify-between'
          }`}
      >


        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search forms..."
              className="pl-8"
              // value={searchTerm}
              value={searchQuery}
              onChange={handleSearchChange}
            // {/* onChange={(e) => setSearchQuery(e.target.value)} */}
            />
          </div>

          <div className="flex space-x-2">
            <Select value={formType} onValueChange={handleFormTypeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Form Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="location">Location-based</SelectItem>
                <SelectItem value="audit">Audit</SelectItem>
              </SelectContent>
            </Select>

            {/* <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[220px] justify-start">
                  <Filter className="mr-2 h-4 w-4" />
                  {dateRange?.from
                    ? dateRange?.to
                      ? `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
                      : dateRange.from.toLocaleDateString()
                    : "Date Range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={dateRange}
                  //  onSelect={(range: any) => setDateRange(range)}
                  onSelect={(range: DateRange | undefined) => {
                    setDateRange(range ? range : undefined)
                  }}
                  initialFocus />
                <button onClick={() => handleDateRangeFunction()} className="bg-blue-500 w-48 ml-20 mb-2 rounded-sm text-sm p-0.5 text-white ">Reset</button>
              </PopoverContent>
            </Popover> */}



          </div>
        </div>

        <div className="flex w-full md:w-auto gap-1 justify-end md:ml-auto md:mr-6">
          {/* <Button variant="outline" size="sm" onClick={handleSync}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync
          </Button> */}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderPlus className="mr-2 h-4 w-4" />
                Folders
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Folder Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!isFullAccess}
                onClick={() => isFullAccess && setShowFolderDialog(true)}
              >
                Create New Folder
              </DropdownMenuItem>
              {/* <DropdownMenuItem onClick={() => router.push("/forms/folders")}>Manage Folders</DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleBulkExport}>Export All Forms</DropdownMenuItem>
              <DropdownMenuItem>Export Selected Forms</DropdownMenuItem>
              <DropdownMenuItem>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button> */}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Import Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                // onClick={handleBulkUpload}
                onClick={() => router.push("/forms/upload")}
              >Bulk Upload Forms</DropdownMenuItem>
              {/* <DropdownMenuItem>Import Responses</DropdownMenuItem>
              <DropdownMenuItem>Download Template</DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>


        </div>


        {/* Create Folder Dialog */}
        {/* <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
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
                      <SelectItem key={folder.id} value={folder.id.toString()}>
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
              <Button onClick={handleCreateFolder} disabled={!folderName}>
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog> */}
        <div>
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
        </div>

        {isFullAccess ? (
          <div className="flex justify-end  mb-4">
            <Button onClick={handleCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Form
            </Button>
          </div>
        ) : isViewOnly ? (
          // <div className="text-gray-500 text-sm">You have view-only access</div>
          <div className="flex justify-end  mb-4">
            <Button className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed">
              <Plus className="mr-2 h-4 w-4" />
              New Form
            </Button>
          </div>
        ) : null}
      </div>

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
    </>
  )
}
