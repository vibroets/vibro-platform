"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import axiosInstance from "@/utils/axiosInstance"
import { CheckIcon, ChevronDownIcon, Search, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { showWarningToast } from "@/utils/hotToastsUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AnnouncementBulkShareProps {
  isOpen: boolean
  onClose: () => void
  selectedAnnouncements: number[]
  onConfirm: (users: number[], groups: number[]) => void
}

export default function AnnouncementBulkShare({
  isOpen,
  onClose,
  selectedAnnouncements,
  onConfirm
}: AnnouncementBulkShareProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const response = await axiosInstance.get("/organization/users/");
        setUsers(response.data);
      } catch (error) {
        console.error("Error while fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    const fetchGroups = async () => {
      try {
        setIsLoadingGroups(true);
        const response = await axiosInstance.get("/organization/groups/");
        setGroups(response.data);
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    if (isOpen) {
      fetchUsers();
      fetchGroups();
    }
  }, [isOpen]);

  const handleShareAnnouncement = async () => {
    if (selectedUsers.length === 0 && selectedGroups.length === 0) {
      showWarningToast(
        "No Users or Groups Selected\nPlease select at least one user or group to share the announcements.", "error"
      );
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      await onConfirm(selectedUsers, selectedGroups);
    } catch (error) {
      console.error("Error sharing announcements:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleGroup = (groupId: number) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectedUsersData = users.filter((u) => selectedUsers.includes(u.id));
  const selectedGroupsData = groups.filter((g) => selectedGroups.includes(g.id));

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase() === searchLower) ||
      user.phone_number?.toLowerCase().includes(searchLower)
    );
  });

  const handleClose = () => {
    setSelectedUsers([]);
    setSelectedGroups([]);
    setSearchTerm("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share {selectedAnnouncements.length} Announcement{selectedAnnouncements.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Select users and groups to share the selected announcements with.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Users Multiselect */}
          <div className="w-full">
            <Label htmlFor="user-multiselect" className="text-sm font-medium text-gray-700">
              Users
            </Label>

            <Popover.Root open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
              <Popover.Trigger asChild>
                <button
                  id="user-multiselect"
                  className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                >
                  {selectedUsersData.length > 0
                    ? `${selectedUsersData.length} user${selectedUsersData.length > 1 ? 's' : ''} selected`
                    : "- Select Users -"}
                  {isLoadingUsers ? (
                    <ChevronDownIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                  align="start"
                >
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center p-4">
                      <span className="text-gray-500">Loading users...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center px-2 mb-2">
                        <Search className="h-4 w-4 text-gray-400 mr-2" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm outline-none"
                        />
                      </div>

                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                          >
                            <Checkbox.Root
                              className="h-4 w-4 border rounded flex items-center justify-center"
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={() => toggleUser(user.id)}
                            >
                              <Checkbox.Indicator>
                                <CheckIcon className="h-3 w-3 text-green-600" />
                              </Checkbox.Indicator>
                            </Checkbox.Root>
                            <span>
                              {user.full_name || "NA"} - {user.email || "Email Not Available"}
                            </span>
                          </label>
                        ))
                      ) : (
                        <div className="text-gray-500 text-sm px-2 py-2">No users found</div>
                      )}
                    </>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Groups Multiselect */}
          <div className="w-full">
            <Label htmlFor="group-multiselect" className="text-sm font-medium text-gray-700">
              Groups
            </Label>

            <Popover.Root open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
              <Popover.Trigger asChild>
                <button
                  id="group-multiselect"
                  className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                >
                  {selectedGroupsData.length > 0
                    ? `${selectedGroupsData.length} group${selectedGroupsData.length > 1 ? 's' : ''} selected`
                    : "- Select Groups -"}
                  {isLoadingGroups ? (
                    <ChevronDownIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                  align="start"
                >
                  {isLoadingGroups ? (
                    <div className="flex items-center justify-center p-4">
                      <span className="text-gray-500">Loading groups...</span>
                    </div>
                  ) : (
                    <>
                      {groups.map((group) => (
                        <label
                          key={group.id}
                          className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                        >
                          <Checkbox.Root
                            className="h-4 w-4 border rounded flex items-center justify-center"
                            checked={selectedGroups.includes(group.id)}
                            onCheckedChange={() => toggleGroup(group.id)}
                          >
                            <Checkbox.Indicator>
                              <CheckIcon className="h-3 w-3 text-green-600" />
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          <span>
                            {group.name || "NA"} - {group.description || "NA"}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleShareAnnouncement}
            disabled={isSaving}
            className="bg-blue-500 text-white hover:bg-blue-700 hover:text-white"
          >
            {isSaving ? (
              <>
                <Save className="mr-2 h-4 w-4 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Share Announcements
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
