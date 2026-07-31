"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import axiosInstance from "@/utils/axiosInstance"
import { CheckIcon, ChevronDownIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button"
import hotToaster from "react-hot-toast";

interface FormShareModalProps {
  isOpen: boolean
  onClose: () => void
  formId: string | number
  onSave?: () => void
}

export function FormShareModal({ isOpen, onClose, formId, onSave }: FormShareModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [sharedGroups, setSharedGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchUsersAndGroups();
    }
  }, [isOpen]);

  const fetchUsersAndGroups = async () => {
    try {
      setIsLoading(true);
      const [usersRes, groupsRes, sharedRes] = await Promise.all([
        axiosInstance.get("/users/list"),
        axiosInstance.get("/groups/"),
        axiosInstance.get(`/form/assignments/recipients/${formId}/`)
      ]);
      setUsers(usersRes.data);
      setGroups(groupsRes.data);
      setSharedUsers(sharedRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      hotToaster.error("Failed to load users and groups");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleGroup = (groupId: number) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const selectAllUsers = () => {
    setSelectedUsers(filteredUsers.map(u => u.id));
  };

  const selectAllGroups = () => {
    setSelectedGroups(filteredGroups.map(g => g.id));
  };

  const clearAllUsers = () => {
    setSelectedUsers([]);
  };

  const clearAllGroups = () => {
    setSelectedGroups([]);
  };

  const filteredUsers = users.filter(user => {
    // Exclude already shared users
    const isShared = sharedUsers.some((s: any) => s.user_id === user.id);
    if (isShared) return false;

    const searchLower = userSearchTerm.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      user.phone?.toLowerCase().includes(searchLower)
    );
  });

  const filteredGroups = groups.filter(group => {
    // Exclude already shared groups
    const isShared = sharedGroups.some((s: any) => s.group_id === group.id);
    if (isShared) return false;

    const searchLower = groupSearchTerm.toLowerCase();
    return (
      group.name?.toLowerCase().includes(searchLower) ||
      group.description?.toLowerCase().includes(searchLower)
    );
  });

  const selectedUserObjects = users.filter(u => selectedUsers.includes(u.id));
  const selectedGroupObjects = groups.filter(g => selectedGroups.includes(g.id));

  const handleSave = async () => {
    if (selectedUsers.length === 0 && selectedGroups.length === 0) {
      hotToaster.error("Please select at least one user or group");
      return;
    }

    setIsSaving(true);
    try {
      // Share with users
      if (selectedUsers.length > 0) {
        await axiosInstance.post("form/assignments/", {
          assign_type: "user",
          form: formId,
          user: selectedUsers
        });
      }

      // Share with groups
      if (selectedGroups.length > 0) {
        await axiosInstance.post("form/assignments/", {
          assign_type: "group",
          form: formId,
          group: selectedGroups
        });
      }
      
      hotToaster.success("Form shared successfully!");
      setSelectedUsers([]);
      setSelectedGroups([]);
      onClose();
      if (onSave) onSave();
    } catch (error) {
      console.error("Error sharing form:", error);
      hotToaster.error("Failed to share form");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[650px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Share Form</h2>
          <button onClick={onClose}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-gray-500">Loading...</span>
          </div>
        ) : (
          <>
            {/* Users Multiselect */}
            <div className="w-full mb-4">
              <Label htmlFor="user-multiselect" className="text-sm font-medium text-gray-700">
                Users
              </Label>

              <Popover.Root open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                <Popover.Trigger asChild>
                  <button
                    id="user-multiselect"
                    className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                  >
                    {selectedUserObjects.length > 0
                      ? selectedUserObjects.map(u => `${u.first_name || "NA"} ${u.last_name || ""}`).join(", ")
                      : "- Select Users -"}
                    <ChevronDownIcon className="ml-2 h-4 w-4" />
                  </button>
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Content
                    className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-80 overflow-y-auto"
                    align="start"
                  >
                    <div className="flex items-center px-2 mb-2">
                      <Search className="h-4 w-4 text-gray-400 mr-2" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm outline-none"
                      />
                    </div>

                    <div className="flex gap-2 px-2 mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllUsers}
                        disabled={filteredUsers.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearAllUsers}
                        disabled={selectedUsers.length === 0}
                      >
                        Clear All
                      </Button>
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
                            {user.first_name || "NA"} {user.last_name || "NA"} - {user.email || "Email Not Available"}
                          </span>
                        </label>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm px-2 py-2">No users found</div>
                    )}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              {/* Selected Users Chips */}
              {selectedUserObjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUserObjects.map((user) => (
                    <span
                      key={user.id}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                    >
                      {user.first_name || "NA"} {user.last_name || ""}
                      <button onClick={() => toggleUser(user.id)}>
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Groups Multiselect */}
            <div className="w-full mb-4">
              <Label htmlFor="group-multiselect" className="text-sm font-medium text-gray-700">
                Groups
              </Label>

              <Popover.Root open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                <Popover.Trigger asChild>
                  <button
                    id="group-multiselect"
                    className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                  >
                    {selectedGroupObjects.length > 0
                      ? selectedGroupObjects.map(g => g.name || "NA").join(", ")
                      : "- Select Groups -"}
                    <ChevronDownIcon className="ml-2 h-4 w-4" />
                  </button>
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Content
                    className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-80 overflow-y-auto"
                    align="start"
                  >
                    <div className="flex items-center px-2 mb-2">
                      <Search className="h-4 w-4 text-gray-400 mr-2" />
                      <input
                        type="text"
                        placeholder="Search groups..."
                        value={groupSearchTerm}
                        onChange={(e) => setGroupSearchTerm(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm outline-none"
                      />
                    </div>

                    <div className="flex gap-2 px-2 mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllGroups}
                        disabled={filteredGroups.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearAllGroups}
                        disabled={selectedGroups.length === 0}
                      >
                        Clear All
                      </Button>
                    </div>

                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => (
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
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm px-2 py-2">No groups found</div>
                    )}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              {/* Selected Groups Chips */}
              {selectedGroupObjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedGroupObjects.map((group) => (
                    <span
                      key={group.id}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1"
                    >
                      {group.name || "NA"}
                      <button onClick={() => toggleGroup(group.id)}>
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="bg-blue-500 text-white hover:bg-blue-700"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FormShareModal;
