"use client";

import { useEffect, useState } from "react";
import {
  Table,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
// Add Dialog components for the modal
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Edit,
  Trash,
  Plus,
  Search,
  MessageSquare,
  MessageSquareOff,
  Loader,
} from "lucide-react";
import { useUser } from "@/components/user-provider";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import ConfirmModalBox from "../ui/confirm-modalbox";
import axiosInstance from "@/utils/axiosInstance";
import hotToaster from "react-hot-toast";
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import OrganizationManagement from "./organization-management";
import GlobalLoader from "../ui/globalloader";

interface Group {
  id: string;
  name: string;
  group: number;
  member_count: number;
  created_at: string;
  allow_chat: boolean;
  type: "Normal" | "Rule-Based";
  members: number[];
  organization: number;
  organization_name: string;
}

export default function GroupManagement({ canEdit = false }: { canEdit?: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // State to manage the groups data
  const [groups, setGroups] = useState<Group[]>([]);

  const [nameFilter, setNameFilter] = useState("all");
  const [orgNameFilter, setOrgNameFilter] = useState("all");
  const [groupName, setgroupFilter] = useState("");
  const [lastNameFilter, setLastNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  // State for the modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEnableChat, setIsEnableChat] = useState(false);
  const [isDisableChat, setIsDisableChat] = useState(false);
  const [showBulkDeleteAlert, setShowBulkDeleteAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  // State for selected groups in the modal
  const [modalSelectedRows, setModalSelectedRows] = useState<string[]>([]);
  const reduxUser = useSelector(selectUser);
  // const reduxUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = reduxUser?.role_details?.name === "super_admin";
  const isAdmin = reduxUser?.role_details?.name === "admin";

  // const toggleRow = (id: string) => {
  //   setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  // }

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res =
        reduxUser?.role_details?.name === "admin"
          ? await axiosInstance.get(`/organization/groups/${reduxUser?.organization}/`)
          : await axiosInstance.get("/groups/");
      // const res = await axiosInstance.get(`/organization/groups/${reduxUser?.organization}/`)
      console.log("group list res >>", res.data);
      console.log("First group details:", JSON.stringify(res.data[0], null, 2));
      setGroups(res.data);
      // setFilteredUsers(res.data)
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    setSelectedRows(
      selectedRows.length === filteredgroups.length
        ? []
        : filteredgroups.map((group) => group.id)
    );
  };

  const handleBulkDelete = async () => {
    const payload = {
      ids: modalSelectedRows,
      commit: false,
    };

    console.log("payload ::", payload);

    try {
      await axiosInstance.post(`/bulk/delete/group`, payload);

      hotToaster.success("Groups Deleted Successfully", { duration: 2000 });
      // setIsDeleteModalOpen(false);
      setModalSelectedRows([]);
      fetchGroups();
    } catch (error: any) {
      console.error("Bulk delete failed:", error);

      hotToaster.error(
        "Failed to Delete Groups\n" + error?.response?.data?.message ||
        "An unexpected error occurred",
        { duration: 3000 }
      );
    }
  };

  // Handle the deletion from the modal
  const handleGroupDelete = async (userID: string) => {
    {
      console.log("delete clicked....");

      try {
        const token = localStorage.getItem("access_token");

        await axiosInstance
          .delete(`/groups/delete/${userID}?commit=false`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .then((res) => {
            hotToaster.success("Group Deleted", { duration: 2000 });
            fetchGroups();
          })
          .catch((error) => {
            hotToaster.error("Can't Deleted Group", { duration: 2000 });
          });
        // setDeleteMessage(response.data.message);
      } catch (error) {
        console.error("Error deleting groups:", error);
        // Optionally show an error message
      }
    }

    // Update the groups by filtering out the selected ones
    setGroups((prev) =>
      prev.filter((group) => !modalSelectedRows.includes(group.id))
    );
    toast({
      title: "Groups Deleted",
      description: `${modalSelectedRows.length} groups have been successfully deleted.`,
    });
    setSelectedRows([]);
  };

  const handleBulkChatToggle = (enable: boolean) => {
    if (selectedRows.length === 0) {
      console.log("enable chat clicked ....");
      toast({
        title: "No Groups Selected",
        description: "Please select at least one group to update.",
        variant: "destructive",
      });
      return;
      window.location.reload();
    }

    toast({
      title: `Chat ${enable ? "Enabled" : "Disabled"}`,
      description: `Chat has been ${enable ? "enabled" : "disabled"} for ${selectedRows.length
        } groups.`,
    });
  };

  const toggleModalRow = (id: string) => {
    setModalSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const newSelectedRows = prev.includes(id)
        ? prev.filter((rowId) => rowId !== id)
        : [...prev, id];
      console.log("Updated selectedRows:", newSelectedRows);
      return newSelectedRows;
    });
  };

  const toggleAllModalRows = () => {
    setModalSelectedRows(
      modalSelectedRows.length === filteredgroups.length
        ? []
        : filteredgroups.map((group) => group.id)
    );
  };

  const filteredgroups = groups.filter((item) => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearchTerm === "" ||
      item.name.toLowerCase().includes(normalizedSearchTerm) ||
      (item.organization_name &&
        item.organization_name.toLowerCase().includes(normalizedSearchTerm));

    const matchesName =
      nameFilter === "all" ||
      nameFilter.trim() === "" ||
      (item.name && item.name.toLowerCase().includes(nameFilter.toLowerCase()));

    const matchesOrgName =
      orgNameFilter === "all" ||
      orgNameFilter.trim() === "" ||
      (item.organization_name &&
        item.organization_name
          .toLowerCase()
          .includes(orgNameFilter.toLowerCase()) &&
        item.organization === reduxUser?.organization);

    if (isSuperAdmin) {
      return matchesSearch && matchesName;
    }
    if (isAdmin) {
      // For Admin, filter by organization
      return matchesSearch && matchesName && matchesOrgName;
    }

    return false;
  });
  console.log("filtered groups >>", filteredgroups);

  const getStatusColor = (status: boolean) => {
    switch (status) {
      case true:
        // return "bg-green-500"
        return "bg-green-200 text-green-800 hover:bg-green-200";
      case false:
        // return "bg-red-500"
        return "bg-red-200 text-red-800 hover:bg-red-200";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full sm:w-[250px] pl-8"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => router.push("/admin/groups/new-normal")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Normal Group
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/admin/groups/new-rule-based")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Rule-Based Group
            </Button>
          </div>
          )}
          {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Bulk Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDeleteModalOpen(true)}>
                <Trash className="mr-2 h-4 w-4" />
                Delete Selected
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setIsDeleteModalOpen(true);
                  setIsEnableChat(true);
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Enable Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setIsDeleteModalOpen(true);
                  setIsDisableChat(true);
                }}
              >
                <MessageSquareOff className="mr-2 h-4 w-4" />
                Disable Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>

      <div className="w-full rounded-md border border-b border-gray-300 shadow-md overflow-y-auto max-h-[280px]">
        <table className="w-full table-auto text-xs">
          <TableHeader className="sticky top-0 bg-white z-30">
            <TableRow>
              {/* <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedRows.length === filteredgroups.length && filteredgroups.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead> */}
              <TableHead className="sticky top-0 bg-white z-30">
                Group Name
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                organization
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Members
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Created On
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Chat Allowed
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">Type</TableHead>
              <TableHead className="sticky top-0 bg-white z-30 w-[100px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredgroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  {loading ? (
                    <>
                      <div className="relative flex justify-center items-center">
                        <GlobalLoader />
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No Records Found
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredgroups.map((group) => (
                <TableRow key={group.id}>
                  {/* <TableCell>
                  <Checkbox
                    checked={selectedRows.includes(group.id)}
                    onCheckedChange={() => toggleRow(group.id)}
                    aria-label={`Select row ${group.id}`}
                  />
                </TableCell> */}
                  {/* <Loader className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> */}
                  <TableCell>
                    <button
                      onClick={() => router.push(`/admin/groups/${group.id}`)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {group.name}
                    </button>
                  </TableCell>
                  <TableCell>{group.organization_name}</TableCell>
                  <TableCell>{group.member_details ? group.member_details.length : group.members ? group.members.length : "-"}</TableCell>
                  <TableCell>{group.created_at}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${getStatusColor(group.allow_chat)} text`}
                    >
                      {group.allow_chat ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{group.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <>
                            <DropdownMenuItem
                              onSelect={() =>
                                router.push(`/admin/groups/${group.id}/edit`)
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setPendingDeleteId(group.id);
                                setShowModal(true);
                              }}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      {/* Delete Confirmation Modal for bulk delete groups*/}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[1100px] h-[600px] flex flex-col overflow-y-auto">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {" "}
              {isEnableChat
                ? "Enable Chat for selected Groups"
                : isDisableChat
                  ? "Disable Chat for selected Groups"
                  : "Delete Selected Groups"}
            </DialogTitle>
          </DialogHeader>
          {/* Search Input for Modal */}
          <div className="relative mb-2 flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search groups in modal..."
              className="w-full sm:w-[250px] pl-8"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Table Section */}
          <div className="flex-1 overflow-y-auto rounded-md border">
            <table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        modalSelectedRows.length === filteredgroups.length &&
                        filteredgroups.length > 0
                      }
                      onCheckedChange={toggleAllModalRows}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead>Chat Allowed</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredgroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Checkbox
                        checked={modalSelectedRows.includes(group.id)}
                        onCheckedChange={() => toggleModalRow(group.id)}
                        aria-label={`Select row ${group.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.member_count}</TableCell>
                    <TableCell>{group.created_at}</TableCell>
                    <TableCell>
                      <Badge
                        variant={group.allow_chat ? "default" : "secondary"}
                      >
                        {group.allow_chat ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{group.type}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>

            {isEnableChat ? (
              <Button
                variant="destructive"
                onClick={() => handleBulkChatToggle(true)}
              >
                Enable Chat
              </Button>
            ) : isDisableChat ? (
              <Button
                variant="destructive"
                onClick={() => handleBulkChatToggle(false)}
              >
                Disable Chat
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteAlert(true)}
              >
                Delete
              </Button>
            )}

            <ConfirmModalBox
              isOpen={showBulkDeleteAlert}
              title="Delete Groups"
              description={`Are you sure you want to delete this selected groups?`}
              button="Delete"
              onClose={() => {
                setSelectedRows([]);
                setShowBulkDeleteAlert(false);
                // window.location.reload();
              }}
              onConfirm={() => {
                if (modalSelectedRows.length > 0) {
                  handleBulkDelete();
                } else {
                  hotToaster.error(
                    "Please Selecte Atleast One Group To Delete",
                    { duration: 1500 }
                  );
                  setIsDeleteModalOpen(true);
                }
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* <ConfirmModalBox
        isOpen={showModal}
        title="Delete Group"
        description={`Are you sure you want to delete this selected group? This action cannot be undone.`}
        button="Delete"
        onClose={() => {
          setPendingDeleteId(null)
          setShowModal(false)
          // window.location.reload();
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            setPendingDeleteId(null)
            handleDeleteGroup(pendingDeleteId)

          }
        }}
      /> */}

      <ConfirmModalBox
        isOpen={showModal}
        title="Delete Group"
        description={`Are you sure you want to delete this selected group? This action cannot be undone.`}
        button="Delete"
        onClose={() => {
          setPendingDeleteId(null);
          setShowModal(false);
          // window.location.reload();
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            handleGroupDelete(pendingDeleteId);
          }
        }}
      />
    </div>
  );
}
