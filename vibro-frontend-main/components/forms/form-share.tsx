"use client"


import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import axiosInstance from "@/utils/axiosInstance"
import { CheckIcon, ChevronDownIcon, Save, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation"
import hotToaster from "react-hot-toast";
import { Button } from "@/components/ui/button"
import { showWarningToast } from "@/utils/hotToastsUtils";

export function FormShare() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [sharedusers, setSharedUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isskipLoading, setIsSkipLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    user: [],
    group: [],
  });

  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("/users/list");
        setUsers(response.data);
      } catch (error) {
        console.error("Error while fetching users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("/groups/");
        setGroups(response.data);
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
    fetchGroups();
    // ✅ Safe sessionStorage access
    if (typeof window !== "undefined") {
      try {
        const data = JSON.parse(sessionStorage.getItem("formData") || "{}");
        const idFromQuery = id ? Number(id) : undefined;
        setFormData({
          id: idFromQuery ?? data.id,
          parentId: data.parentId ?? data.id,   // fallback safe
          title: data.title,
          user: data.user || [],
          group: data.group || [],
        });
      } catch (err) {
        console.error("Error reading formData from sessionStorage", err);
      }
    }
  }, []);

  // useEffect(() => {
  //   if (id) {
  //     fetchSharedUsers();
  //   }
  // }, [id]);

  useEffect(() => {
    console.log("formData updated:", formData?.id, formData?.parentId);
  if (formData?.parentId) {
    fetchSharedUsers();
  }
}, [formData?.parentId]);

  const fetchSharedUsers = async () => {
    try {
      // const numericId = id ? Number(id) : null;
      console.log("Fetching shared users for form id:", formData.parentId);
      const numericId = formData?.parentId
        ? Number(formData.parentId)
        : null;

      if (numericId === null) {
        console.error("Invalid form id");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const response = await axiosInstance.get(`/form/assignments/recipients/${numericId}/`);
      const shared = response.data; // array of shared user objects
      console.log("Fetched shared users:", shared);


      // Extract user_ids from response
      const sharedUserIds = shared
        .map((u: { user_id: number }) => u.user_id)
        .filter((uid: number) => uid !== numericId); // ✅ remove same as current id

      setSharedUsers(shared);

      // Merge with existing formData.user
      // setFormData((prev: { user: number[]; group: number[] }) => ({
      //   ...prev,
      //   user: [...new Set([...(prev.user || []), ...sharedUserIds])],
      // }));
    } catch (error) {
      console.error("Error fetching shared users:", error);
    } finally {
      setIsLoading(false);
    }
  };







  const handleSaveForm = async () => {
    if (formData?.user?.length === 0 && formData?.group?.length === 0) {
      showWarningToast(
        "No Users or Groups Selected\nPlease select at least one user or group to share the form.", "error"
      );
      return;
    }

    if (isSaving) return; // Prevent multiple submissions
    setIsSaving(true);

    try {
      const payload = {
        assign_type: "user",
        form: formData?.id,
        user: formData.user.map((id: any) => id),
      }

      const response = await axiosInstance.post("form/assignments/", payload);

      if (response.status === 201) {
        hotToaster.success("Form Shared Successfully!", { duration: 2000 });
        const redirectPath = formData.folder ? `/forms/folders/${formData.folder}` : "/forms";
        router.push(redirectPath);
      } else {
        throw new Error("Unexpected response status");
      }
    } catch (error: any) {
      console.error("Error Sharing form:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to share form. Please try again.";
      hotToaster.error("Error Saving Form\n" + errorMessage, { duration: 2000 });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (userId: any) => {
    const updated = formData.user.includes(userId)
      ? formData.user.filter((id: any) => id !== userId)
      : [...formData.user, userId];

    setFormData({ ...formData, user: updated });
  };

  const toggleGroup = (groupId: any) => {
    const updated = formData.group.includes(groupId)
      ? formData.group.filter((id: any) => id !== groupId)
      : [...formData.group, groupId];

    setFormData({ ...formData, group: updated });
  };

  const selectedUsers = users.filter((u) => formData.user.includes(u.id));
  const selectedGroups = groups.filter((g) => formData.group.includes(g.id));
  const filteredUsers = users
    .filter((user) => {
      // Exclude already shared users
      const isShared = sharedusers.some((s) => s.user_id === user.id);
      if (isShared) return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        user.first_name?.toLowerCase().includes(searchLower) ||
        user.last_name?.toLowerCase().includes(searchLower) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower) ||
        (user.email && user.email.toLowerCase() === searchLower) ||
        user.phone?.toLowerCase().includes(searchLower)
      );
    });


  function skipsharing() {
    setIsSkipLoading(true);
    const redirectPath = formData.folder ? `/forms/folders/${formData.folder}` : "/forms";
    router.push(redirectPath);
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Your Form - {formData.title} Saved Successfully!
        </h1>
        <p className="text-muted-foreground">Select User/Group you want to share to</p>
      </div>

      {/* Users Multiselect */}
      <>
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <span className="text-gray-500">Loading users...</span>
          </div>
        ) : (
          <div className="w-full ">
            <Label htmlFor="user-multiselect" className="text-sm font-medium text-gray-700">
              Users
            </Label>

            <Popover.Root open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
              <Popover.Trigger asChild>
                <button
                  id="user-multiselect"
                  className="mt-1 flex justify-between items-center w-full border rounded px-3 py-2 text-sm text-left bg-white"
                >
                  {selectedUsers.length > 0
                    ? selectedUsers.map((u) => u.first_name || "NA").join(", ")
                    : "- Select Users -"}
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                  align="start"
                >
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
                          checked={formData.user.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        >
                          <Checkbox.Indicator>
                            <CheckIcon className="h-3 w-3 text-green-600" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <span>
                          {user.first_name || "NA"} {user.last_name || "NA"} - {user.email || "Email Not Available"} - ({user.phone || "Phone Not Available"})
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm px-2 py-2">No users found</div>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        )}
      </>

      {/* Groups Multiselect */}
      {isLoading ? (
        <div className="flex items-center justify-center h-16">
          <span className="text-gray-500">Loading groups...</span>
        </div>
      ) : (
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
                {selectedGroups.length > 0
                  ? selectedGroups.map((g) => g.name || "NA").join(", ")
                  : "- Select Groups -"}
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                className="z-50 mt-2 w-[--radix-popover-trigger-width] bg-white border rounded shadow-md p-2 max-h-60 overflow-y-auto"
                align="start"
              >
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                  >
                    <Checkbox.Root
                      className="h-4 w-4 border rounded flex items-center justify-center"
                      checked={formData.group.includes(group.id)}
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
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const redirectPath = formData.folder ? `/forms/folders/${formData.folder}` : "/forms";
            router.push(redirectPath);
          }} className="mr-2">
            Cancel
          </Button>

          <Button
            className="bg-blue-500 text-white hover:bg-blue-700 hover:text-white"
            onClick={() => skipsharing()}
          >
            {isskipLoading ? "Loading..." : "Skip Sharing"}
          </Button>
          <Button
            className="bg-blue-500 text-white hover:bg-blue-700 hover:text-white"
            onClick={handleSaveForm} disabled={isSaving}>
            {isSaving ? (
              <>
                <Save className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        </div>
      </div>
      {id && (
        <div className="mt-0 w-full">
          {/* Shared Users Table */}
          {sharedusers.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-3">Shared Users</h2>
              <div className="overflow-x-auto overflow-y-scroll max-h-56 border rounded-xl shadow-md bg-white">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 border-b font-medium">S.No</th>
                      <th className="px-4 py-2 border-b font-medium">Name</th>
                      <th className="px-4 py-2 border-b font-medium">Designation</th>
                      <th className="px-4 py-2 border-b font-medium">Department</th>
                      <th className="px-4 py-2 border-b font-medium">Form shared on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedusers.map((user: any, index: number) => (
                      <tr
                        key={user.user_id}
                        className="hover:bg-blue-50 transition-colors duration-200"
                      >
                        <td className="px-4 py-2 border-b">{index + 1}</td>
                        <td className="px-4 py-2 border-b font-medium text-gray-800">
                          {user.username || "NA"}
                        </td>
                        <td className="px-4 py-2 border-b text-gray-600">
                          {user.designation || "NA"}
                        </td>
                        <td className="px-4 py-2 border-b text-gray-600">
                          {user.department || "NA"}
                        </td>
                        <td className="px-4 py-2 border-b text-gray-500 text-sm">
                          {user.form_shared_on || "NA"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}


    </>
  );
}

// ✅ Force this page to always render dynamically (avoids build crash)
export const dynamic = "force-dynamic";
