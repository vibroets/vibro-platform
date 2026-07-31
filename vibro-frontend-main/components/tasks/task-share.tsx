"use client"


import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Switch from '@radix-ui/react-switch';
import axiosInstance from "@/utils/axiosInstance"
import { CheckIcon, ChevronDownIcon, Loader, Save, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation"
import hotToaster from "react-hot-toast";
import { Button } from "@/components/ui/button"
import { showWarningToast } from "@/utils/hotToastsUtils";
import { useSelector } from "react-redux";
import { selectCreatedTask } from "@/redux/slices/taskSlice";

export function TaskShare() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const taskidfromparams = searchParams.get("taskId")
  const router = useRouter();
  const createdTask = useSelector(selectCreatedTask);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [sharedusers, setSharedUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isskipLoading, setIsSkipLoading] = useState(false);
  const [taskData, setTaskData] = useState<any>({
    user: [],
    group: [],
  });

  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendEmail, setSendEmail] = useState(false);

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
    fetchUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    // ✅ Get task data from Redux
    const idFromQuery = id ? Number(id) : undefined;
    setTaskData({
      id: idFromQuery ?? createdTask?.id,
      title: createdTask?.title || "",
      user: createdTask?.user || [],
      group: createdTask?.group || [],
    });
  }, [createdTask, id]);

  useEffect(() => {
    if (id) {
      fetchSharedUsers();
    }
  }, [id]);

  const fetchSharedUsers = async () => {
    try {
      const numericId = id ? Number(id) : null;

      if (numericId === null) {
        console.error("Invalid task id");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const response = await axiosInstance.get(`/task/assignments/recipients/${numericId + 1}/`);
      const shared = response.data; // array of shared user objects
      console.log("Fetched shared users:", shared);


      // Extract user_ids from response
      const sharedUserIds = shared
        .map((u: { user_id: number }) => u.user_id)
        .filter((uid: number) => uid !== numericId); // ✅ remove same as current id

      setSharedUsers(shared);

    } catch (error) {
      console.error("Error fetching shared users:", error);
    } finally {
      setIsLoading(false);
    }
  };






  const handleShareTask = async () => {
    if (taskData?.user?.length === 0 && taskData?.group?.length === 0) {
      showWarningToast(
        "No Users or Groups Selected\nPlease select at least one user or group to share the task.", "error"
      );
      return;
    }

    if (isSaving) return; // Prevent multiple submissions
    setIsSaving(true);

    try {
      const payload = {
        users: taskData.user,
        groups: taskData.group,
        send_email: sendEmail
      }
      console.log("Sharing task with payload:", payload);

      const response = await axiosInstance.post(`/tasks/${taskidfromparams}/share/`, payload);
      // const response = await axiosInstance.post(`/tasks/${2}/share/`, payload);

      if (response.status === 200 || response.status === 201) {
        hotToaster.success("Task Shared Successfully!",{duration:2000});
        router.push("/tasks");
      } else {
        throw new Error("Unexpected response status");
      }
    } catch (error: any) {
      console.error("Error Sharing task:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to share task. Please try again.";
      hotToaster.error("Error Saving Task\n"+ errorMessage,{duration:2000});
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (userId: number) => {
    let updatedUser: number[];
    if (taskData.user.includes(userId)) {
      updatedUser = [];
    } else {
      updatedUser = [userId];
    }
    setTaskData({ ...taskData, user: updatedUser, group: [] });
  };

  const toggleGroup = (groupId: number) => {
    let updatedGroup: number[];
    if (taskData.group.includes(groupId)) {
      updatedGroup = [];
    } else {
      updatedGroup = [groupId];
    }
    setTaskData({ ...taskData, user: [], group: updatedGroup });
  };

  const selectedUsers = users.filter((u) => taskData.user.includes(u.id));
  const selectedGroups = groups.filter((g) => taskData.group.includes(g.id));
  const filteredUsers = users
    .filter((user) => {
      // Exclude already shared users
      const isShared = sharedusers.some((s) => s.user_id === user.id);
      if (isShared) return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(searchLower) ||
        (user.email && user.email.toLowerCase() === searchLower) ||
        user.phone_number?.toLowerCase().includes(searchLower)
      );
    });


  function skipsharing() {
    setIsSkipLoading(true);
    router.push("/tasks")
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Your Task - {taskData.title} Saved Successfully!
        </h1>
        <p className="text-muted-foreground">Select User/Group you want to share to</p>
      </div>

      {/* Users Multiselect */}
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
                ? selectedUsers.map((u) => u.full_name || "NA").join(", ")
                : "- Select Users -"}
              {isLoadingUsers ? (
                <Loader className="animate-spin h-4 w-4" />
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
                  <Loader className="animate-spin h-6 w-6 mr-2" />
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
                          checked={taskData.user.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        >
                          <Checkbox.Indicator>
                            <CheckIcon className="h-3 w-3 text-green-600" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <span>
                          {user.full_name || "NA"} - {user.email || "Email Not Available"} - ({user.phone_number || "Phone Not Available"})
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
              {selectedGroups.length > 0
                ? selectedGroups.map((g) => g.name || "NA").join(", ")
                : "- Select Groups -"}
              {isLoadingGroups ? (
                <Loader className="animate-spin h-4 w-4" />
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
                  <Loader className="animate-spin h-6 w-6 mr-2" />
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
                        checked={taskData.group.includes(group.id)}
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

      {/* Send Email Toggle */}
      <div className="flex items-center space-x-2 mt-4">
        <button
          className={`w-10 h-5 rounded-full relative cursor-pointer ${sendEmail ? 'bg-blue-500' : 'bg-gray-300'}`}
          onClick={() => setSendEmail(!sendEmail)}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${sendEmail ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <Label className="text-sm font-medium text-gray-700">Send Email</Label>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/tasks")} className="mr-2">
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
            onClick={handleShareTask} disabled={isSaving}>
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
                      <th className="px-4 py-2 border-b font-medium">Task shared on</th>
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
                          {user.task_shared_on || "NA"}
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
