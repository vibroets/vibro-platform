"use client";

import { useState, useEffect, useRef } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CalendarRange,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash,
  Share,
  Copy,
  Eye,
  Download,
  BarChart,
  Upload,
  Loader,
  ArchiveX,
  Folder,
} from "lucide-react";
// import { useToast } from "@/components/ui/use-toast"
import { useToast } from "../ui/use-toast";
import { useRouter } from "next/navigation";
import { useTabStore } from "@/utils/tabStore";
import { useFormStore } from "@/utils/formStore";
// import { useTabStore } from './tabStore';
import ConfirmModalBox from "../ui/confirm-modalbox";
import axiosInstance from "@/utils/axiosInstance";
import hotToaster from "react-hot-toast";
import { capitalize } from "@mui/material";
import GlobalLoader from "../ui/globalloader";
import FormShareModal from "./FormShareModal";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { selectHydrated, selectUser } from "@/redux/slices/authSlice";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FormsTableProps {
  injectedForms?: any[];
  injectedFolders?: any[];
  searchQuery: string;
  formType: string | null;
  dateRange: { from: Date | undefined; to: Date | undefined };
  loadingstate: boolean;
}

interface Folder {
  id: number;
  name: string;
  description: string;
  parent: number | null;
  author: string;
  created_at: string | number;
  created_by: string | number;
}

const getDateStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDateEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getFormCreatedAt = (form: any) => {
  const dateValue = form?.createdAt ?? form?.created_at ?? form?.createdDate;
  const parsedDate = new Date(dateValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const matchesDateRange = (
  value: Date | null,
  from?: Date | null,
  to?: Date | null
) => {
  if (value === null) return false;
  if (from && value < getDateStart(from)) return false;
  if (to && value > getDateEnd(to)) return false;

  return true;
};

const getCreatedDateLabel = (start: string, end: string) => {
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;

  return "Select range";
};

export function FormsTable({
  searchQuery,
  formType,
  dateRange,
  injectedForms,
  injectedFolders,
  loadingstate,
}: FormsTableProps) {
  const user = useSelector(selectUser);
  const hydrated = useSelector(selectHydrated);
  const { isFullAccess } = useModuleAccess("forms");
  console.log("Hydrated:", hydrated);
  console.log("User:", user);
  const organizationId = user?.organization;
  console.log("Organization ID from Redux:", organizationId);

  const [forms, setForms] = useState<any[]>([]);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [createdDateStart, setCreatedDateStart] = useState("");
  const [createdDateEnd, setCreatedDateEnd] = useState("");
  const [isCreatedDatePopoverOpen, setIsCreatedDatePopoverOpen] = useState(false);
  const [filteredForms, setFilteredForms] = useState(forms);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<Folder[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [apiCheckValue, setApiCheckValue] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    formId?: string;
    ids?: string[];
  } | null>(null);

  const [formsWithoutFolder, setFormsWithoutFolder] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAccessDeniedDialog, setShowAccessDeniedDialog] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedErrorMessage, setSelectedErrorMessage] = useState("");
  const didFetch = useRef(false);
  const tableScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFormId, setShareFormId] = useState<string | null>(null);

  const applyCreatedDateFilters = (startValue: string, endValue: string) => {
    const startDate = startValue ? new Date(startValue) : null;
    const endDate = endValue ? new Date(endValue) : null;

    setFilteredForms(
      forms.filter((f) =>
        matchesDateRange(getFormCreatedAt(f), startDate, endDate)
      )
    );
    setFilteredFolders(
      folders.filter((folder) => {
        const folderCreatedAt = new Date(folder.created_at);
        const normalizedFolderDate = Number.isNaN(folderCreatedAt.getTime())
          ? null
          : folderCreatedAt;

        return matchesDateRange(normalizedFolderDate, startDate, endDate);
      })
    );
  };

  useEffect(() => {
    // if (didFetch.current || !hydrated || !organizationId) return;
    //  didFetch.current = true;
    if (injectedForms) {
      console.log("injectedForms injectedForms", injectedForms);
      setForms(injectedForms);
      return;
    }
    async function fetchData() {
      try {
        setLoading(true);
        const [formRes, failedFormsRes, folderRes] = await Promise.all([
          axiosInstance.get(`/forms/organization/${organizationId}/`),
          axiosInstance.get(`/form-payload-files/?status=failed&organization=${organizationId}`),
          axiosInstance.get("/folders/organization/")
        ]);
        console.log("Organization ID:", organizationId);
        console.log("Organization ID data:", formRes.data);
        console.log("Sample form data:", formRes.data.forms?.[0]);
        console.log("Sample form status:", formRes.data.forms?.[0]?.status);
        console.log("Failed forms data:", failedFormsRes.data);
        setApiCheckValue(false);
        console.log("Fetched folders raw data:", folderRes.data);
        const parent = folderRes.data.filter((f: Folder) => f.parent === null);
        setFolders(parent);
        setFilteredFolders(parent); // initialize filteredFolders

        // Process regular forms and fetch latest response for each
        const regularFormsWithLatestResponse = await Promise.all(
          formRes.data.forms.map(async (item: any) => {
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

            // Try to fetch latest response date
            let latestResponseFormatted = "—";
            try {
              const responseRes = await axiosInstance.get(`/form/${item.id}/latest-submission/`);
              console.log(`Latest submission for form ${item.id}:`, responseRes.data);
              
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
                  console.log(`Latest response for form ${item.id}:`, latestResponseFormatted);
                }
              }
            } catch (error) {
              console.log(`No submissions for form ${item.id}`);
            }

            return {
              id: item.id,
              title: item.title || "Untitled",
              author: item?.form_admin,
              createdAt: item.created_at,
              createdDate: formattedDateTime,
              latestResponse: latestResponseFormatted,
              formType: item.form_type || "Unknown",
              repeatSchedule: "None",
              responses: item.response_count??0,
              folderId: item.folder || null,
              status: item.status || (item.is_disabled ? "Disabled" : item.is_archived ? "Archived" : "Active"),
              error_message: "",
              deletedby: item.is_deleted || null,
              isdisabed: item.is_disabled || false,
              isarchived: item.is_archived || false,
            };
          })
        );

        // Process failed forms
        const formsMap = formRes.data.forms.reduce((acc: any, form: any) => {
          acc[form.id] = form;
          return acc;
        }, {});

        const failedForms = failedFormsRes.data.map((failedForm: any) => {
          const formDetails = formsMap[failedForm.form];
          const createdDateTime = new Date(failedForm.created_at || failedForm.uploaded_at);
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

          // Format latest response date if available
          let latestResponseFormatted = "—";
          if (failedForm.latest_response || formDetails?.latest_response) {
            const latestResponseDateTime = new Date(failedForm.latest_response || formDetails?.latest_response);
            latestResponseFormatted = latestResponseDateTime.toLocaleString("en-GB", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          }

          return {
            id: failedForm.id,
            title: failedForm.title || formDetails?.title || "Untitled",
            author: failedForm.form_admin || formDetails?.form_admin || "Unknown",
            createdAt: failedForm.created_at || failedForm.uploaded_at,
            createdDate: formattedDateTime,
            latestResponse: latestResponseFormatted,
            formType: failedForm?.form_type || "Unknown",
            repeatSchedule: "None",
            responses: 0,
            folderId: null,
            status: failedForm.status || "failed",
            error_message: failedForm.error_message || "",
            deletedby: null,
            isdisabed: false,
            isarchived: false,
          };
        });

        // Combine regular and failed forms
        const allForms = [...regularFormsWithLatestResponse, ...failedForms];

        // Remove duplicates based on id to prevent key conflicts
        const uniqueForms = allForms.filter(
          (form, index, self) => self.findIndex((f) => f.id === form.id) === index
        );

        const noFolderForms = uniqueForms.filter(
          (f: { folderId: null }) => f.folderId === null
        );
        console.log("Fetched all forms without folder:", noFolderForms);
        setFormsWithoutFolder(noFolderForms);
        setForms(noFolderForms);
        setApiCheckValue(true);
        setLoading(false);
      } catch (err: any) {
        if (
          err.response?.status === 403 &&
          err.response?.data?.[0]?.detail ===
            "You do not have permission to perform this action." &&
          user?.role_details?.name?.toLowerCase() === "super_admin"
        ) {
          setShowAccessDeniedDialog(true);
        } else {
          console.error("Error fetching forms/folders:", err);
          setForms([
            {
              id: "1",
              title: "Sample Form",
              author: "John Doe",
              createdAt: "2023-01-01",
              createdDate: "2023-01-01",
              latestResponse: "—",
              formType: "standard",
              repeatSchedule: "None",
              responses: 0,
              folderId: null,
            },
          ]);
        }
      }
    }

    fetchData();
  }, [hydrated, organizationId, injectedForms]);

  useEffect(() => {
    if (injectedFolders) {
      setFolders(injectedFolders);
      setFilteredFolders(injectedFolders);
      return;
    }
  }, [injectedFolders]);

  useEffect(() => {
    // Filter forms
    if (!dateRange) {
      setFilteredForms(forms);
    } else {
      const filtered = forms.filter((form) => {
        const matchesSearch =
          (typeof form.title === "string" &&
            form.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (typeof form.author === "string" &&
            form.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (typeof form.formType === "string" &&
            form.formType.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesFormType =
          typeof formType === "string" && formType.trim() !== ""
            ? typeof form.formType === "string" &&
              form.formType.toLowerCase() === formType.toLowerCase()
            : true;

        const createdAt = getFormCreatedAt(form);
        const matchesDate =
          (!dateRange.from ||
            (createdAt !== null &&
              createdAt >= getDateStart(dateRange.from))) &&
          (!dateRange.to ||
            (createdAt !== null && createdAt <= getDateEnd(dateRange.to)));

        return matchesSearch && matchesFormType && matchesDate;
      });
      setFilteredForms(filtered);
    }

    // Filter folders
    const filteredFolders = folders.filter(
      (folder) =>
        (typeof folder.name === "string" &&
          folder.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (typeof folder.description === "string" &&
          folder.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredFolders(filteredFolders);
  }, [searchQuery, formType, dateRange, forms, folders]);

  const visibleFormIds = filteredForms.map((form) => String(form.id));
  const allVisibleFormsSelected =
    visibleFormIds.length > 0 &&
    visibleFormIds.every((id) => selectedForms.includes(id));
  const someVisibleFormsSelected =
    visibleFormIds.some((id) => selectedForms.includes(id)) &&
    !allVisibleFormsSelected;

  const toggleFormSelection = (formId: string | number) => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Editing actions are disabled.");
      return;
    }
    const normalizedFormId = String(formId);
    setSelectedForms((prev) =>
      prev.includes(normalizedFormId)
        ? prev.filter((id) => id !== normalizedFormId)
        : [...prev, normalizedFormId]
    );
  };

  const toggleSelectAll = () => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Editing actions are disabled.");
      return;
    }
    if (allVisibleFormsSelected) {
      setSelectedForms((prev) =>
        prev.filter((id) => !visibleFormIds.includes(id))
      );
    } else {
      setSelectedForms((prev) =>
        Array.from(new Set([...prev, ...visibleFormIds]))
      );
    }
  };

  const handleBulkDelete = () => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Deleting is disabled.");
      return;
    }
    if (selectedForms.length === 0) return;
    setPendingAction({ action: "bulkDelete", ids: selectedForms });
    setShowModal(true);
  };

  // Handle bulk share
  const handleBulkShare = () => {
    if (!isFullAccess) {
      hotToaster.error("You have view-only access. Sharing is disabled.");
      return;
    }
    if (selectedForms.length === 0) return;
    toast({
      title: "Share Forms",
      description: `Sharing ${selectedForms.length} forms.`,
    });

    // In a real app, you would open a share dialog
  };

  const backgroundSavingIds = useFormStore((state: any) => state.backgroundSavingIds || [])

  // Handle form actions
  const handleFormAction = (action: string, formId: string, status?:string) => {
    console.log("status in the handleFormAction ::", status)
    if ((backgroundSavingIds || []).includes(String(formId))) {
      hotToaster.custom("This form is currently being saved in the background. Please wait until it completes.");
      return;
    }

    const fullAccessActions = new Set([
      "edit",
      "delete",
      "share",
      "duplicate",
    ]);
    if (!isFullAccess && fullAccessActions.has(action)) {
      hotToaster.error("You have view-only access. This action is disabled.");
      return;
    }
    const form = forms.find((f) => f.id === formId); //form-1
    console.log("Form action:", action, "for formId:", formId, "form:", form);
    switch (action) {
      case "edit":
        router.push(`/forms/${formId}/edit`);
        break;
      case "view":
        // 👇 manually trigger loader before router.push
        if (typeof window !== "undefined") {
          const event = new Event("route-loader-start");
          window.dispatchEvent(event);
        }

        useTabStore.getState().setActiveTab("view");
        router.push(`/forms/${formId}?status=${status}`);
        break;
      case "delete":
        setPendingAction({ action: "delete", formId });
        setShowModal(true);
        break;
        setPendingAction({ action: "delete", formId });
        setShowModal(true);
        break;
      case "share":
        setShareFormId(formId);
        setShareModalOpen(true);
        break;
      case "duplicate":
        router.push(`/forms/${formId}/edit?mode=duplicate`);
        break;
      case "download":
        toast({
          title: "Download Form",
          description: `Downloading "${form?.title}".`,
        });
        break;
      case "analytics":
        useTabStore.getState().setActiveTab("analytics");
        router.push(`/forms/${formId}`);
        break;
      default:
        break;
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    const { action, formId, ids } = pendingAction;
    const form = formId ? forms.find((f) => f.id === formId) : null;

    if (action === "delete" && formId) {
      try {
        const response = await axiosInstance.delete(`/form/delete/${formId}`);
        setForms(forms.filter((f) => f.id !== formId));

        hotToaster.success(`Form has been deleted successfully!`, {
          duration: 2000,
        });
      } catch (err: any) {
        console.error("Delete error:", err.response?.data || err.message);
        toast({
          title: "Error",
          description: `Failed to delete form. Details: ${
            err.response?.data?.error || err.message
          }`,
          variant: "destructive",
        });
      }
    } else if (action === "bulkDelete" && ids) {
      try {
        const response = await axiosInstance.post("/form/bulk/delete", {
          ids,
          commit: false,
        });
        setForms(forms.filter((form) => !ids.includes(String(form.id))));
        setSelectedForms([]);
        toast({
          title: "Success",
          description: response.data.message,
        });
        hotToaster.success(`Selected forms have been deleted successfully!`, {
          duration: 2000,
        });
      } catch (err: any) {
        console.error("Bulk delete error:", err.response?.data || err.message);
        toast({
          title: "Error",
          description: `Failed to delete forms. Details: ${
            err.response?.data?.error || err.message
          }`,
          variant: "destructive",
        });
      }
    }

    setShowModal(false);
    setPendingAction(null);
  };

  const getFormTypeBadgeColor = (type: string) => {
    switch (type) {
      case "audit":
        return "bg-yellow-200 text-yellow-800 hover:bg-yellow-200";
      case "location":
        return "bg-red-200 text-red-800 hover:bg-blue-200";
      case "standard":
      default:
        return "bg-green-200 text-green-800 hover:bg-green-200";
    }
  };

  const getScheduleBadgeColor = (schedule: string) => {
    switch (schedule) {
      case "Daily":
        return "bg-red-100 text-red-800 hover:bg-red-200";
      case "Weekly":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200";
      case "Monthly":
        return "bg-indigo-100 text-indigo-800 hover:bg-indigo-200";
      case "Quarterly":
        return "bg-cyan-100 text-cyan-800 hover:bg-cyan-200";
      case "None":
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  const getStatusBadgeColor = (status?: string | null) => {
    switch (status) {
      case "failed":
        return "bg-red-200 text-red-800 hover:bg-red-300 cursor-pointer";
      case "success":
        return "bg-green-200 text-green-800 hover:bg-green-200";
      case "Active":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case "Disabled":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      case "Archived":
        return "bg-gray-200 text-gray-800 hover:bg-gray-300";
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-100";
    }
  };

  return (
    <>
      <div className="space-y-4">
        {isFullAccess && selectedForms.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <span className="text-sm font-medium">
              {selectedForms.length} forms selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkShare}
              className="ml-auto"
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}

        <div
          ref={tableScrollContainerRef}
          className="rounded-md border shadow-[0_4px_10px_rgba(0,0,0,0.2)] max-h-[calc(95vh-8rem)] overflow-y-auto overflow-x-auto"
          onScroll={() => {
            if (isCreatedDatePopoverOpen) {
              setIsCreatedDatePopoverOpen(false);
            }
          }}
        >
          <div>
            <table className="w-full caption-bottom text-xs">
              <TableHeader className="sticky top-0 bg-white z-30">
                <TableRow>
                  <TableHead className="sticky top-0 z-30 w-[50px] bg-white">
                    <Checkbox
                      checked={
                        someVisibleFormsSelected
                          ? "indeterminate"
                          : allVisibleFormsSelected
                      }
                      disabled={!isFullAccess}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all forms"
                    />
                  </TableHead>
                  <TableHead className="sticky top-0 z-30 min-w-[200px] bg-white">Title</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white">Author</TableHead>
                  <TableHead className="sticky top-0 z-30 min-w-[220px] bg-white">Created Date</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white">Latest Response</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white">Form Type</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white">Repeat Schedule</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white">Responses</TableHead>
                  <TableHead className="sticky top-0 z-30 bg-white">Status</TableHead>
                  <TableHead className="sticky top-0 z-30 w-[100px] bg-white right-0 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.15)]">Actions</TableHead>
                </TableRow>
                {/* Filter row below header */}
                <TableRow className="bg-gray-50 border-b border-blue-100">
                  <TableCell />
                  <TableCell>
                    <input
                      type="text"
                      placeholder="Title"
                      className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                      value={searchTerm}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchTerm(val);
                        setFilteredForms(
                          forms.filter(
                            (f) =>
                              typeof f.title === "string" &&
                              f.title.toLowerCase().includes(val.toLowerCase())
                          )
                        );
                        setFilteredFolders(
                          folders.filter(
                            (folder) =>
                              typeof folder.name === "string" &&
                              folder.name
                                .toLowerCase()
                                .includes(val.toLowerCase())
                          )
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      placeholder="Author"
                      value={authorFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAuthorFilter(val);

                        // Filter forms (files)
                        setFilteredForms(
                          forms.filter(
                            (f) =>
                              (!val ||
                                (typeof f.author === "string" &&
                                  f.author
                                    .toLowerCase()
                                    .includes(val.toLowerCase()))) &&
                              (searchTerm === "" ||
                                (typeof f.title === "string" &&
                                  f.title
                                    .toLowerCase()
                                    .includes(searchTerm.toLowerCase())))
                          )
                        );

                        // Filter folders by BOTH keyword and searchTerm
                        setFilteredFolders(
                          folders.filter(
                            (f) =>
                              (!val ||
                                (typeof f.name === "string" &&
                                  f.name
                                    .toLowerCase()
                                    .includes(val.toLowerCase())) ||
                                (typeof f.created_by === "string" &&
                                  f.created_by
                                    .toLowerCase()
                                    .includes(val.toLowerCase()))) &&
                              (searchTerm === "" ||
                                (typeof f.name === "string" &&
                                  f.name
                                    .toLowerCase()
                                    .includes(searchTerm.toLowerCase())) ||
                                (typeof f.created_by === "string" &&
                                  f.created_by
                                    .toLowerCase()
                                    .includes(searchTerm.toLowerCase())))
                          )
                        );
                      }}
                      className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Popover
                      open={isCreatedDatePopoverOpen}
                      onOpenChange={setIsCreatedDatePopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 w-full justify-between gap-2 bg-white px-2 text-xs font-normal text-gray-600 hover:bg-gray-50"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                            <span className="truncate">
                              {getCreatedDateLabel(createdDateStart, createdDateEnd)}
                            </span>
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="space-y-3">
                          <div className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                              From
                            </span>
                            <input
                              type="date"
                              value={createdDateStart}
                              className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                              max={createdDateEnd || undefined}
                              onChange={(e) => {
                                const nextStart = e.target.value;
                                setCreatedDateStart(nextStart);
                                applyCreatedDateFilters(nextStart, createdDateEnd);
                              }}
                            />
                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                              To
                            </span>
                            <input
                              type="date"
                              value={createdDateEnd}
                              className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                              min={createdDateStart || undefined}
                              onChange={(e) => {
                                const nextEnd = e.target.value;
                                setCreatedDateEnd(nextEnd);
                                applyCreatedDateFilters(createdDateStart, nextEnd);
                              }}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                              onClick={() => {
                                setCreatedDateStart("");
                                setCreatedDateEnd("");
                                applyCreatedDateFilters("", "");
                                setIsCreatedDatePopoverOpen(false);
                              }}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <select
                      className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilteredForms(
                          forms.filter(
                            (f) =>
                              !val ||
                              (typeof f.formType === "string" &&
                                f.formType.toLowerCase() === val.toLowerCase())
                          )
                        );
                        setFilteredFolders(
                          folders.filter(
                            (folder) =>
                              // Optionally filter folders by type if you have such a property, otherwise just leave as is
                              true
                          )
                        );
                      }}
                    >
                      <option value="">All Types</option>
                      <option value="standard">Standard</option>
                      <option value="location">Location</option>
                      <option value="audit">Audit</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilteredForms(
                          forms.filter(
                            (f) =>
                              !val ||
                              f.repeatSchedule.toLowerCase() ===
                                val.toLowerCase()
                          )
                        );
                      }}
                    >
                      <option value="">All</option>
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableHeader>
              {filteredFolders.length > 0 && (
                <TableBody>
                  {filteredFolders.map((folder) => (
                    <TableRow key={folder.id}>
                      <TableCell className="w-16">
                        <img
                          className="h-8" // Tailwind: 80px x 80px
                          src="https://img.icons8.com/fluency/48/folder-invoices--v2.png"
                          alt="folder-invoices--v2"
                        />
                      </TableCell>
                      <TableCell
                        className="font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => {
                          window.dispatchEvent(new Event("route-loader-start"));
                          router.push(`/forms/folders/${folder.id}`);
                        }}
                      >
                        {folder.name}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {folder.created_by}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {/* {folder.created_at} */}
                        {new Date(folder.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              )}

              <TableBody>
                {filteredFolders.length === 0 &&
                filteredForms.length === 0 &&
                apiCheckValue ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <span className="text-muted-foreground">
                        No matching data found.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <div className="relative flex justify-center items-center">
                        <GlobalLoader />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredForms.length === 0 &&
                  filteredFolders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <span className="text-muted-foreground">
                        No data found
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredForms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedForms.includes(String(form.id))}
                          disabled={!isFullAccess}
                          onCheckedChange={() => toggleFormSelection(form.id)}
                          aria-label={`Select ${form.title}`}
                        />
                      </TableCell>
                      <TableCell
                        onClick={() => !backgroundSavingIds.includes(String(form.id)) && handleFormAction("view", form.id, form.status)}
                        className={`font-medium ${backgroundSavingIds.includes(String(form.id)) ? "text-gray-400 cursor-not-allowed" : "cursor-pointer hover:text-blue-600"}`}
                        title={backgroundSavingIds.includes(String(form.id)) ? "Saving in background…" : undefined}
                      >
                        {form.isarchived && (
                          <ArchiveX className="text-gray-500 h-8 w-4 mr-2 inline" />
                        )}
                        {form.title}
                      </TableCell>
                      <TableCell>{form.author}</TableCell>
                      <TableCell className="whitespace-pre-line">{form.createdDate}</TableCell>
                      <TableCell className="whitespace-pre-line">{form.latestResponse}</TableCell>
                      <TableCell>
                        <Badge
                          className={`${getFormTypeBadgeColor(
                            form.formType
                          )} capitalize`}
                          variant="outline"
                        >
                          {form.formType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getScheduleBadgeColor(form.repeatSchedule)}
                          variant="outline"
                        >
                          {form.repeatSchedule}
                        </Badge>
                      </TableCell>
                      <TableCell>{form.responses}</TableCell>
                      <TableCell>
                        <Badge
                          className={getStatusBadgeColor(form.status)}
                          variant="outline"
                          onClick={() => {
                            if (form.status === 'failed') {
                              setSelectedErrorMessage(form.error_message);
                              setShowErrorModal(true);
                            }
                          }}
                        >
                          {form.status || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="sticky right-0 z-20 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={backgroundSavingIds.includes(String(form.id))}
                              onClick={() => handleFormAction("view", form.id)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={backgroundSavingIds.includes(String(form.id))}
                              onClick={() => handleFormAction("edit", form.id)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleFormAction("share", form.id)}
                            >
                              <Share className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleFormAction("duplicate", form.id)
                              }
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem
                              onClick={() =>
                                handleFormAction("download", form.id)
                              }
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleFormAction("analytics", form.id)
                              }
                            >
                              <BarChart className="h-4 w-4 mr-2" />
                              Analytics
                            </DropdownMenuItem>
                            {isFullAccess && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleFormAction("Import Responses", form.id)
                                }
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Import Responses
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                handleFormAction("Download Template", form.id)
                              }
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Template
                            </DropdownMenuItem> */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleFormAction("delete", form.id)
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        </div>

        {/* <div><ConfirmModalBox
        isOpen={showModal}
        title="Delete Form"
        variant="delete"
        description={`Are you sure you want to delete? This action cannot be undone and all responses will be permanently deleted.`}
        button="Delete"
        onClose={() => {
          setShowModal(false)
          setPendingDeleteId(null)
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            handleFormAction("delete", pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      /></div> */}

        <div>
          <ConfirmModalBox
            isOpen={showModal}
            title={
              pendingAction?.action === "duplicate"
                ? "Duplicate Form"
                : pendingAction?.action === "bulkDelete"
                ? "Delete Forms"
                : "Delete Form"
            }
            variant={
              pendingAction?.action === "duplicate" ? "default" : "delete"
            }
            description={
              pendingAction?.action === "duplicate"
                ? `Are you sure you want to duplicate "${
                    forms.find((f) => f.id === pendingAction?.formId)?.title
                  }"?`
                : pendingAction?.action === "bulkDelete"
                ? `Are you sure you want to delete ${pendingAction.ids?.length} selected forms? This action cannot be undone and all responses will be permanently deleted.`
                : `Are you sure you want to delete "${
                    forms.find((f) => f.id === pendingAction?.formId)?.title
                  }"? This action cannot be undone and all responses will be permanently deleted.`
            }
            button={
              pendingAction?.action === "duplicate" ? "Duplicate" : "Delete"
            }
            onClose={() => {
              setShowModal(false);
              setPendingAction(null);
            }}
            onConfirm={handleConfirmAction}
          />
        </div>

        {/* Access Denied Dialog */}
        <AlertDialog
          open={showAccessDeniedDialog}
          onOpenChange={setShowAccessDeniedDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Access Denied</AlertDialogTitle>
              <AlertDialogDescription>
                You don't have access to this module.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => {
                  setShowAccessDeniedDialog(false);
                  router.push("/dashboard");
                }}
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Error Message Dialog */}
        <AlertDialog
          open={showErrorModal}
          onOpenChange={setShowErrorModal}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Error Details</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedErrorMessage}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => {
                  setShowErrorModal(false);
                  setSelectedErrorMessage("");
                }}
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Share Modal */}
        <FormShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          formId={shareFormId || ""}
        />
      </div>
    </>
  );
}
