"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RotateCcw, Trash2, Search, Send, RefreshCw, Database, BarChart, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ConfirmModalBox from "../ui/confirm-modalbox"
import axiosInstance from "@/utils/axiosInstance"
import ArchivedItemsTab from "./archiving/archiving"
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice"
import hotToaster from "react-hot-toast";

interface DeletedBy {
  id: number;
  fullname: string;
  email: string;
  username: string;
}
interface DeletedItem {
  id: string;
  modal: string;
  username: string;
  name: string;
  deletedBy: DeletedBy;
  last_deleted_date: string;
}


export function SuperAdminFeatures() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("recovery")
  const [chatMessage, setChatMessage] = useState("")
  const [checkvalue, setCheckValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showModal, setShowModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const currentUser = useSelector(selectUser);
  
  // Only Super Admin can access these features
  console.log("Current User:", currentUser?.role_details.name);
  const isSuperAdmin = currentUser?.role_details?.name === "super_admin";
  console.log("isSuperAdmin:", isSuperAdmin);



 useEffect(() => {
    if (isSuperAdmin) {
      fetchDeleteRecentUsers();
    }
  }, [isSuperAdmin]);

  const fetchDeleteRecentUsers = async () => {
    try {
      const res = await axiosInstance.get("/restore/list/deleted");
      console.log("list recently deleted list  >>", res.data);
      setDeletedItems(res.data)
    } catch (err) {
      console.error("Failed to fetch deleted list", err);
    }
  };


  // const deletedItems = [
  //   { id: "1", type: "Form", name: "Safety Inspection", deletedBy: "John Doe", deletedOn: "2023-05-15" },
  //   { id: "2", type: "Announcement", name: "Company Picnic", deletedBy: "Jane Smith", deletedOn: "2023-05-16" },
  //   { id: "3", type: "User", name: "Michael Johnson", deletedBy: "Robert Brown", deletedOn: "2023-05-17" },
  //   { id: "4", type: "Form", name: "Equipment Checkout", deletedBy: "Sarah Williams", deletedOn: "2023-05-18" },
  //   { id: "5", type: "Checklist", name: "Onboarding Process", deletedBy: "John Doe", deletedOn: "2023-05-19" },
  // ]

  async function handlePermanentDeleteUser(id: string) {
    try {
      console.log("Deleting item with ID check user:", id);
      const res = await axiosInstance.delete(`/users/${id}?commit=true`);
      console.log("User deleted successfully:", res.data);
      setDeletedItems((prevItems) => prevItems.filter((f) => f.id !== id));
hotToaster.success("User Deleted Permanently!", {duration:2000});
      // fetchUsers();
      setPendingDeleteId(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      hotToaster.error("Failed to Delete User",{duration:2000});
    }
  }


  async function handlePermanentDeleteGroups(id: string) {
    try {
      console.log("Deleting item with ID check groups:", id);
      const res = await axiosInstance.delete(`/groups/delete/${id}?commit=true`);
      console.log("groups deleted successfully:", res.data);
      setDeletedItems((prevItems) => prevItems.filter((f) => f.id !== id));
      hotToaster.success("Group Deleted Pemanently!",{duration:2000});
      // fetchUsers();
      setPendingDeleteId(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      hotToaster.error("Failed to Delete User",{duration:2000});
    }
  }

  async function handlePermanentDeleteOrgs(id: string) {
    try {
      console.log("Deleting item with ID check for orgs:", id);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  }

  async function handleRestoreUser(id: string) {
    try {
      console.log("reostoring item with ID check user:", id);
      const res = await axiosInstance.post(`/users/delete/${id}?re-activate=true`);
      console.log("User deleted successfully:", res.data);
      setDeletedItems((prevItems) => prevItems.filter((f) => f.id !== id));
      hotToaster.success("User Restored!",{duration:2000});
      // fetchDeleteRecentUsers();
      setPendingDeleteId(null);
    } catch (error) {
      hotToaster.error("Failed to Restore User",{duration:2000});
    }

  }


  async function handleRestoreGroups(id: string) {
    try {
      console.log("restoring item with ID check groups:", id);
      const res = await axiosInstance.post(`/groups/delete/${id}?re-activate=true`);
      console.log("groups deleted successfully:", res.data);
      setDeletedItems((prevItems) => prevItems.filter((f) => f.id !== id));
      hotToaster.success("Group Restored!",{duration:2000});
      // fetchUsers();
      setPendingDeleteId(null);
    } catch (error) {
      hotToaster.error("Failed to Restore Group",{duration:2000});
    }
  }

  async function handleRestoreOrgs(id: string) {
    try {
      console.log("Deleting item with ID check for orgs:", id);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  }

  const supportRequests = [
    {
      id: "1",
      user: "Jane Smith",
      message: "I can't access the forms section",
      timestamp: "2023-05-15 09:30",
      status: "New",
    },
    {
      id: "2",
      user: "Michael Johnson",
      message: "Need help with bulk import",
      timestamp: "2023-05-16 14:45",
      status: "Responded",
    },
    {
      id: "3",
      user: "Sarah Williams",
      message: "App crashes when I try to create a new announcement",
      timestamp: "2023-05-17 11:20",
      status: "New",
    },
  ]

  const chatHistory = [
    { id: "1", user: "Support", message: "How can I help you today?", timestamp: "2023-05-16 14:40" },
    { id: "2", user: "Michael Johnson", message: "Need help with bulk import", timestamp: "2023-05-16 14:45" },
    {
      id: "3",
      user: "Support",
      message: "Sure, I can help with that. What specific issue are you having with bulk import?",
      timestamp: "2023-05-16 14:47",
    },
  ]

  const [integrations, setIntegrations] = useState([
    // { id: "1", name: "Salesforce API", status: true, lastSync: "2023-05-15 09:30" },
    { id: "1", name: "Power BI Dashboard", status: false, lastSync: "2023-05-10 14:45" },
    // { id: "3", name: "SAP Integration", status: true, lastSync: "2023-05-17 11:20" },
    // { id: "4", name: "Tableau Reports", status: true, lastSync: "2023-05-16 16:15" },
    // { id: "5", name: "Microsoft Teams", status: false, lastSync: "2023-05-12 10:30" },
  ])

  const archivedItems = [
    { id: "1", type: "Form", name: "2022 Annual Survey", archivedOn: "2023-01-15", status: "Archived" },
    { id: "2", type: "Announcement", name: "Holiday Schedule 2022", archivedOn: "2023-01-16", status: "Archived" },
    { id: "3", type: "Form", name: "Q4 2022 Feedback", archivedOn: "2023-01-17", status: "Archived" },
    { id: "4", type: "Checklist", name: "2022 Inventory Process", archivedOn: "2023-01-18", status: "Archived" },
    { id: "5", type: "Announcement", name: "System Maintenance Notice", archivedOn: "2023-01-19", status: "Active" },
  ]

  const handleRestore = (id: string) => {
    toast({
      title: "Item Restored",
      description: "The item has been successfully restored.",
    })
  }



  const handleSendMessage = () => {
    if (!chatMessage.trim()) return

    setIsSubmitting(true)

    // Simulate sending message
    setTimeout(() => {
      toast({
        title: "Message Sent",
        description: "Your response has been sent to the user.",
      })

      setChatMessage("")
      setIsSubmitting(false)
    }, 1000)
  }

  const handleToggleIntegration = (id: string, currentStatus: boolean) => {
    toast({
      title: currentStatus ? "Integration Disabled" : "Integration Enabled",
      description: `The integration has been ${currentStatus ? "disabled" : "enabled"} successfully.`,
    })
  }

  const handleSyncIntegration = (id: string) => {
    toast({
      title: "Sync Initiated",
      description: "The integration sync has been initiated.",
    })
  }

  const handleToggleArchiveStatus = (id: string, currentStatus: string) => {
    toast({
      title: currentStatus === "Archived" ? "Item Activated" : "Item Archived",
      description: `The item has been ${currentStatus === "Archived" ? "activated" : "archived"} successfully.`,
    })
  }

  // Helper to clear selection after delete
  const clearSelection = (type: string) => {
    if (type === "User") setSelectedUserIds([]);
    if (type === "Group") setSelectedGroupIds([]);
  };

  // Bulk delete handler
  const handleBulkDelete = (type: string) => {
    setType(type);
    setShowModal(true);
    setCheckValue("BulkDelete");
  };

  // Bulk delete users
  async function handleBulkPermanentDeleteUsers(ids: string[]) {
    try {
      console.log("INSIDE BULD DELETE USERS");
      const userpayload = {
        ids: ids, // make sure selectedIds is an array of numbers or strings
        commit: true
      };
      console.log("Bulk deleting users with IDs:", userpayload);
      const res = await axiosInstance.post(`/bulk/delete/user`, userpayload);
      setDeletedItems((prevItems) => prevItems.filter((f) => !ids.includes(f.id)));
      
      hotToaster.success("Users Deleted Permanently!",{duration:2000});
    } catch (error) {
      console.error("Error bulk deleting users:", error);
      hotToaster.error("Failed to Delete Users",{duration:2000});
    }
  }

  // Bulk delete groups
  async function handleBulkPermanentDeleteGroups(ids: string[]) {
    try {
      console.log("INSIDE BULD DELETE GROUPS");
      const Grouppayload = {
        ids: ids, // make sure selectedIds is an array of numbers or strings
        commit: true
      };
      console.log("Bulk deleting groups with IDs:", Grouppayload);
      const res = await axiosInstance.post(`/bulk/delete/group`, Grouppayload);
      setDeletedItems((prevItems) => prevItems.filter((f) => !ids.includes(f.id)));
      hotToaster.success("Groups Deleted Permanently!",{duration:2000});
    } catch (error) {
      console.error("Error bulk deleting groups:", error);
      hotToaster.error("Failed to Delete Groups",{duration:2000});
    }
  }

  if (!currentUser) {
    return null;
  }

  // if (!isSuperAdmin) {
  //   return (
  //     <div className="rounded-md border p-8 text-center">
  //       <h2 className="text-xl font-semibold">Access Denied</h2>
  //       <p className="text-muted-foreground mt-2">Only Super Admins can access these features.</p>
  //     </div>
  //   );
  // }

  return (
    <><Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
        <TabsTrigger value="recovery" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">Recovery</TabsTrigger>
        <TabsTrigger value="support" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">Support Chat</TabsTrigger>
        <TabsTrigger value="integrations" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">API/BI Integrations</TabsTrigger>
        <TabsTrigger value="archiving" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">Archiving</TabsTrigger>
      </TabsList>

      <TabsContent value="recovery" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recently Deleted Items</CardTitle>
            <CardDescription>Restore or permanently delete recently removed items</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="user" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">Delete User</TabsTrigger>
                <TabsTrigger value="group" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">Delete Group</TabsTrigger>
              </TabsList>
              <TabsContent value="user">
                {/* Delete Selected Button */}
                <div className="flex justify-self-end items-center mb-2">
                 {selectedUserIds.length > 0 &&
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedUserIds.length === 0}
                    onClick={() => handleBulkDelete("User")}
                  >
                    Delete Selected
                  </Button>}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {selectedUserIds.length > 0 && `${selectedUserIds.length} selected`}
                  </span>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {/* Checkbox for select all */}
                          <input
                            type="checkbox"
                            checked={
                              deletedItems.filter((item) => item.modal === "User").length > 0 &&
                              selectedUserIds.length === deletedItems.filter((item) => item.modal === "User").length
                            }
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedUserIds(
                                  deletedItems.filter((item) => item.modal === "User").map((item) => item.id)
                                );
                              } else {
                                setSelectedUserIds([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Deleted By</TableHead>
                        <TableHead>Deleted On</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedItems
                        .filter((item) => item.modal === "User")
                        .map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(item.id)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedUserIds(prev => [...prev, item.id]);
                                  } else {
                                    setSelectedUserIds(prev => prev.filter(id => id !== item.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.modal}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.modal === "User" ? item.username : item.name}
                            </TableCell>
                            <TableCell>{item.deletedBy?.fullname}</TableCell>
                            <TableCell>{item.last_deleted_date}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPendingDeleteId(item.id);
                                    setType(item.modal);
                                    setShowModal(true);
                                    setCheckValue("Restore");
                                  }}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restore
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setPendingDeleteId(item.id);
                                    setType(item.modal);
                                    setShowModal(true);
                                    setCheckValue("Delete");
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="group">
                {/* Delete Selected Button */}
                <div className="flex justify-self-end items-center  mb-2">
              {selectedGroupIds.length > 0 &&
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedGroupIds.length === 0}
                    onClick={() => handleBulkDelete("Group")}
                  >
                    Delete Selected
                  </Button>
                  }
                  <span className="ml-2 text-xs text-muted-foreground">
                    {selectedGroupIds.length > 0 && `${selectedGroupIds.length} selected`}
                  </span>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {/* Checkbox for select all */}
                          <input
                            type="checkbox"
                            checked={
                              deletedItems.filter((item) => item.modal === "Group").length > 0 &&
                              selectedGroupIds.length === deletedItems.filter((item) => item.modal === "Group").length
                            }
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedGroupIds(
                                  deletedItems.filter((item) => item.modal === "Group").map((item) => item.id)
                                );
                              } else {
                                setSelectedGroupIds([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Deleted By</TableHead>
                        <TableHead>Deleted On</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedItems
                        .filter((item) => item.modal === "Group")
                        .map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedGroupIds.includes(item.id)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedGroupIds(prev => [...prev, item.id]);
                                  } else {
                                    setSelectedGroupIds(prev => prev.filter(id => id !== item.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.modal}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.modal === "User" ? item.username : item.name}
                            </TableCell>
                            <TableCell>{item.deletedBy?.fullname}</TableCell>
                            <TableCell>{item.last_deleted_date}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPendingDeleteId(item.id);
                                    setType(item.modal);
                                    setShowModal(true);
                                    setCheckValue("Restore");
                                  }}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restore
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setPendingDeleteId(item.id);
                                    setType(item.modal);
                                    setShowModal(true);
                                    setCheckValue("Delete");
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </TabsContent>

      <TabsContent value="support" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Support Requests</CardTitle>
              <CardDescription>User support requests and inquiries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Search requests..." className="pl-8" />
                </div>

                <div className="space-y-2">
                  {supportRequests.map((request) => (
                    <div
                      key={request.id}
                      className={`p-3 rounded-md border cursor-pointer hover:bg-muted ${request.status === "New" ? "border-blue-200 bg-blue-50" : "border"}`}
                      onClick={() => { }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{request.user}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{request.message}</p>
                        </div>
                        <Badge variant={request.status === "New" ? "default" : "outline"}>{request.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{request.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Chat with Michael Johnson</CardTitle>
              <CardDescription>Support conversation history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col h-[400px]">
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {chatHistory.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.user === "Support" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${message.user === "Support" ? "bg-muted" : "bg-primary text-primary-foreground"}`}
                      >
                        <p className="text-sm font-medium">{message.user}</p>
                        <p>{message.message}</p>
                        <p className="text-xs mt-1 opacity-70">{message.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2">
                  <Textarea
                    placeholder="Type your response..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="resize-none" />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim() || isSubmitting}
                    className="flex-shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="integrations" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>API and BI Integrations</CardTitle>
            <CardDescription>Manage external integrations and data connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Integration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {integration.name.includes("API") ? (
                            <Database className="mr-2 h-4 w-4" />
                          ) : (
                            <BarChart className="mr-2 h-4 w-4" />
                          )}
                          {integration.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={integration.status}
                            // onCheckedChange={() => handleToggleIntegration(integration.id, integration.status)} />

                            onCheckedChange={() => {
                              // setPendingDeleteId(group.id);
                              setShowModal(true)
                              setCheckValue(integration.status ? "Enabled" : "Disabled")
                            }} />
                          <span>{integration.status ? "Enabled" : "Disabled"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{integration.lastSync}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          // onClick={() => handleSyncIntegration(integration.id)}

                          onClick={() => {
                            // setPendingDeleteId(group.id);
                            setShowModal(true)
                            setCheckValue("Sync Now")
                          }}
                          disabled={!integration.status}
                        >
                          {isLoading ? (
                            <span className="flex items-center">
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Syncing...
                            </span>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Sync Now
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="archiving" className="mt-6">
        <ArchivedItemsTab />
      </TabsContent>
    </Tabs>

      {/* permanentlydelete  */}
      <ConfirmModalBox
        isOpen={checkvalue === "Delete" && showModal}
        title="Permanently Delete Item"
        description="This action cannot be undone. This will permanently delete the item from the system."
        variant="delete"
        button={checkvalue}
        onClose={() => {
          setShowModal(false);
          setPendingDeleteId(null);
          setCheckValue("");
          setType(null);
        }}
        onConfirm={() => {
          if (pendingDeleteId && type) {
            switch (type.toLowerCase()) {
              case "user":
                handlePermanentDeleteUser(pendingDeleteId);
                break;
              case "group":
                handlePermanentDeleteGroups(pendingDeleteId);
                break;
              case "organization":
                handlePermanentDeleteOrgs(pendingDeleteId);
                break;
              default:
                console.warn("Unknown delete type:", type);
            }
            setPendingDeleteId(null);
            setType(null);
          }
        }}
      />



      {/* restoredeleted  */}
      <ConfirmModalBox
        isOpen={checkvalue === "Restore" && showModal}
        title="Restore Item"
        description="This will restore the item to its original location."
        variant="default"
        button={checkvalue}
        onClose={() => {
          setShowModal(false);
          setPendingDeleteId(null);
          setCheckValue("");
          setType(null);
        }}
        onConfirm={() => {
          if (pendingDeleteId && type) {
            switch (type.toLowerCase()) {
              case "user":
                handleRestoreUser(pendingDeleteId);
                break;
              case "group":
                handleRestoreGroups(pendingDeleteId);
                break;
              case "organization":
                handleRestoreOrgs(pendingDeleteId);
                break;
              default:
                console.warn("Unknown delete type:", type);
            }
            setPendingDeleteId(null);
            setType(null);
          }
        }}
      />


      <ConfirmModalBox
        isOpen={checkvalue === "Activate" && showModal}
        title="Activate Item"
        description="This will make the item active and available to users."
        variant="default"
        button={checkvalue}
        onClose={() => {
          setShowModal(false)
          setPendingDeleteId(null)
          setCheckValue("");
          // window.location.reload();
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            // handleDeleteGroup(pendingDeleteId)
            setPendingDeleteId(null)
          }
        }} />

      <ConfirmModalBox
        isOpen={checkvalue === "Archive" && showModal}
        title="Archive Item"
        description="This will archive the item and make it unavailable to users."
        variant="deactivate"
        button={checkvalue}
        onClose={() => {
          setShowModal(false)
          setPendingDeleteId(null)
          setCheckValue("");
          // window.location.reload();
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            // handleDeleteGroup(pendingDeleteId)
            setPendingDeleteId(null)
          }
        }} />

      <ConfirmModalBox
        isOpen={checkvalue === "Sync Now" && showModal}
        title="Sync Integration"
        description="This will initiate a manual sync with the external service. This may take a few minutes."
        variant="default"
        // isLoading={isLoading}

        button={checkvalue}
        onClose={() => {
          setShowModal(false)
          setPendingDeleteId(null)
          setCheckValue("");
          // window.location.reload();
        }}
        onConfirm={() => {
          if (pendingDeleteId) {

            // handleDeleteGroup(pendingDeleteId)
            setPendingDeleteId(null)
          }
        }} />



      <ConfirmModalBox
        isOpen={checkvalue === "Enabled" && showModal}
        title="Disable Integration"
        description="This will disable the integration. All connected services will stop syncing."
        variant="deactivate"
        button="Disable"
        onClose={() => {
          setShowModal(false)
          setPendingDeleteId(null)
          setCheckValue("");
          // window.location.reload();
        }}
        onConfirm={() => {
          setIntegrations(prev =>
            prev.map(item =>
              item.id === "1" ? { ...item, status: false } : item
            )
          );
          setShowModal(false);
        }} />


      <ConfirmModalBox
        isOpen={checkvalue === "Disabled" && showModal}
        title="Enable Integration"
        description="This will enable the integration. Connected services will start syncing."
        variant="info"
        button="Enable"
        onClose={() => {
          setShowModal(false)
          // setPendingDeleteId(null)
          setCheckValue("");
          // window.location.reload();
        }}
        onConfirm={() => {
          setIntegrations(prev =>
            prev.map(item =>
              item.id === "1" ? { ...item, status: true } : item
            )
          );
          setShowModal(false);
        }} />


      {/* Bulk Delete Modal */}
      <ConfirmModalBox
        isOpen={checkvalue === "BulkDelete" && showModal}
        title="Permanently Delete Selected Items"
        description="This action cannot be undone. This will permanently delete all selected items."
        variant="delete"
        button="Delete Selected"
        onClose={() => {
          setShowModal(false);
          setCheckValue("");
          setType(null);
        }}
        onConfirm={async () => {
          if (type === "User" && selectedUserIds.length > 0) {
            await handleBulkPermanentDeleteUsers(selectedUserIds);
            clearSelection("User");
          }
          if (type === "Group" && selectedGroupIds.length > 0) {
            await handleBulkPermanentDeleteGroups(selectedGroupIds);
            clearSelection("Group");
          }
          setShowModal(false);
          setCheckValue("");
          setType(null);
        }}
      />
    </>

  )
}
