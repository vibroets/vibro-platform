"use client"


import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import axiosInstance from "@/utils/axiosInstance"
import { CheckIcon, ChevronDownIcon, Save, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation"
import hotToaster from "react-hot-toast";
import { Button } from "@/components/ui/button"
import { showWarningToast } from "@/utils/hotToastsUtils";
import { useSelector } from "react-redux";
import { selectCreatedAnnouncement } from "@/redux/slices/announcementSlice";

export default function AnnouncementShare() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const router = useRouter();
  const createdAnnouncement = useSelector(selectCreatedAnnouncement);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [sharedusers, setSharedUsers] = useState<any[]>([]);
  const [sharedgroups, setSharedGroups] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isskipLoading, setIsSkipLoading] = useState(false);
  const [announcementData, setAnnouncementData] = useState<any>({
    user: [],
    group: [],
  });

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
    fetchUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    // ✅ Get announcement data from Redux
    const idFromQuery = id ? Number(id) : undefined;
    setAnnouncementData({
      id: idFromQuery ?? createdAnnouncement?.id,
      title: createdAnnouncement?.title || "",
      user: createdAnnouncement?.user || [],
      group: createdAnnouncement?.group || [],
    });
  }, [createdAnnouncement, id]);

  useEffect(() => {
    if (id) {
      fetchSharedUsers();
    }
  }, [id]);

  const fetchSharedUsers = async () => {
    try {
      const numericId = id ? Number(id) : null;

      if (numericId === null) {
        console.error("Invalid announcement id");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const response = await axiosInstance.get(`/announcements/${numericId}/shares/`);
      const shared = response.data; // array of share objects
      console.log("Fetched shared data:", shared);

      const sharedUsers = shared.filter((item: any) => item.sent_to_user !== null);
      const sharedGroups = shared.filter((item: any) => item.sent_to_group !== null);

      setSharedUsers(sharedUsers);
      setSharedGroups(sharedGroups);

    } catch (error) {
      console.error("Error fetching shared users and groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareAnnouncement = async () => {
    if (announcementData?.user?.length === 0 && announcementData?.group?.length === 0) {
      showWarningToast(
        "No Users or Groups Selected\nPlease select at least one user or group to share the announcement.", "error"
      );
      return;
    }

    if (isSaving) return; // Prevent multiple submissions
    setIsSaving(true);

    try {
      const payload = {
        users: announcementData.user,
        groups: announcementData.group,
      }
      console.log("Sharing announcement with payload:", payload);

      const response = await axiosInstance.post(`/announcements/${id}/share/`, payload);

      if (response.status === 200 || response.status === 201) {
        hotToaster.success("Announcement Shared Successfully!",{duration:2000});
        router.push("/announcements");
      } else {
        throw new Error("Unexpected response status");
      }
    } catch (error: any) {
      console.error("Error Sharing announcement:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to share announcement. Please try again.";
      hotToaster.error("Error Saving Announcement\n"+ errorMessage,{duration:2000});
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (userId: number) => {
    let updatedUser = [...announcementData.user];
    if (updatedUser.includes(userId)) {
      updatedUser = updatedUser.filter(id => id !== userId);
    } else {
      updatedUser.push(userId);
    }
    setAnnouncementData({ ...announcementData, user: updatedUser });
  };

  const toggleGroup = (groupId: number) => {
    let updatedGroup = [...announcementData.group];
    if (updatedGroup.includes(groupId)) {
      updatedGroup = updatedGroup.filter(id => id !== groupId);
    } else {
      updatedGroup.push(groupId);
    }
    setAnnouncementData({ ...announcementData, group: updatedGroup });
  };

  const selectedUsers = users.filter((u) => announcementData.user.includes(u.id));
  const selectedGroups = groups.filter((g) => announcementData.group.includes(g.id));
  const filteredUsers = users
    .filter((user) => !sharedusers.some((su) => su.sent_to_user === user.id))
    .filter((user) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(searchLower) ||
        (user.email && user.email.toLowerCase() === searchLower) ||
        user.phone_number?.toLowerCase().includes(searchLower)
      );
    });


  function skipsharing() {
    setIsSkipLoading(true);
    router.push("/announcements")
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {announcementData.title ? `Your Announcement - ${announcementData.title} Saved Successfully!` : "Share Announcement"}
          {/* Your Announcement - {announcementData.title} Saved Successfully! */}
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
                <ChevronDownIcon className="h-4 w-4" />
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
                          checked={announcementData.user.includes(user.id)}
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
                <ChevronDownIcon className="h-4 w-4" />
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
                  {groups.filter((group) => !sharedgroups.some((sg) => sg.sent_to_group === group.id)).map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-100 text-sm cursor-pointer"
                    >
                      <Checkbox.Root
                        className="h-4 w-4 border rounded flex items-center justify-center"
                        checked={announcementData.group.includes(group.id)}
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

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/announcements")} className="mr-2">
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
            onClick={handleShareAnnouncement} disabled={isSaving}>
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
      {id && (sharedusers.length > 0 || sharedgroups.length > 0) && (
        <div className="mt-6 w-full">
          <Tabs defaultValue={sharedusers.length > 0 ? "users" : "groups"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              {sharedusers.length > 0 && <TabsTrigger value="users" className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">Shared Users</TabsTrigger>}
              {sharedgroups.length > 0 && <TabsTrigger value="groups" className="hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">Shared Groups</TabsTrigger>}
            </TabsList>
            {sharedusers.length > 0 && (
              <TabsContent value="users">
                <div className="overflow-x-auto overflow-y-scroll max-h-56 border rounded-xl shadow-md bg-white">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700">
                      <tr>
                        <th className="px-4 py-2 border-b font-medium">S.No</th>
                        <th className="px-4 py-2 border-b font-medium">Name</th>
                        <th className="px-4 py-2 border-b font-medium">Share Status</th>
                        <th className="px-4 py-2 border-b font-medium">Sent Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedusers.map((user: any, index: number) => (
                        <tr
                          key={user.id}
                          className="hover:bg-blue-50 transition-colors duration-200"
                        >
                          <td className="px-4 py-2 border-b">{index + 1}</td>
                          <td className="px-4 py-2 border-b font-medium text-gray-800">
                            {user.sent_to_user_name || "NA"}
                          </td>
                          <td className="px-4 py-2 border-b text-gray-600">
                            {user.share_status || "NA"}
                          </td>
                          <td className="px-4 py-2 border-b text-gray-500 text-sm">
                            {user.sent_timestamp ? new Date(user.sent_timestamp).toLocaleString() : "NA"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
            {sharedgroups.length > 0 && (
              <TabsContent value="groups">
                <div className="overflow-x-auto overflow-y-scroll max-h-56 border rounded-xl shadow-md bg-white">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700">
                      <tr>
                        <th className="px-4 py-2 border-b font-medium">S.No</th>
                        <th className="px-4 py-2 border-b font-medium">Group Name</th>
                        <th className="px-4 py-2 border-b font-medium">Share Status</th>
                        <th className="px-4 py-2 border-b font-medium">Sent Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedgroups.map((group: any, index: number) => (
                        <tr
                          key={group.id}
                          className="hover:bg-blue-50 transition-colors duration-200"
                        >
                          <td className="px-4 py-2 border-b">{index + 1}</td>
                          <td className="px-4 py-2 border-b font-medium text-gray-800">
                            {group.sent_to_group_name || "NA"}
                          </td>
                          <td className="px-4 py-2 border-b text-gray-600">
                            {group.share_status || "NA"}
                          </td>
                          <td className="px-4 py-2 border-b text-gray-500 text-sm">
                            {group.sent_timestamp ? new Date(group.sent_timestamp).toLocaleString() : "NA"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}


    </>
  );
}

// ✅ Force this page to always render dynamically (avoids build crash)
export const dynamic = "force-dynamic";
