

"use client"
import { useParams, useSearchParams } from 'next/navigation';  // CHANGE: Add useSearchParams
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, X, Plus, Loader, Monitor } from "lucide-react"
import { FaMobileAlt } from "react-icons/fa"
import { useToast } from "@/hooks/use-toast"
import axiosInstance from "@/utils/axiosInstance"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { store } from '@/redux/store';
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice"
import GlobalLoader from '../ui/globalloader';
import hotToaster from "react-hot-toast";


  // onSuccess: () => void
const issuperadmin = store.getState().auth.user?.is_superadmin || false
const isadmin = store.getState().auth.user?.is_admin || false
const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  allow_chat: z.boolean(),
  organization: z.string(),
})

type FormValues = z.infer<typeof formSchema>

interface User {
  id: string
  username: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  countryCode: string
  designation: string
  location: string
  division: string
  department: string
  status: string
  organization_name: string
  dashboard_access: boolean
  mobile_supervisor: boolean
  is_admin?: boolean
  is_superadmin: boolean
}

export function NormalGroupForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  interface Organization {
    id: string | number
    organization_name: string
  }
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [groupDataLoaded, setGroupDataLoaded] = useState(false)
  const searchParams = useSearchParams();  // ADD: Read query params for orgId
  const orgId = searchParams.get('orgId');  // ADD: Extract orgId from URL
  const [checkedUsers, setCheckedUsers] = useState<string[]>([])
  const [checkedSelectedUsers, setCheckedSelectedUsers] = useState<string[]>([])


  const params = useParams()
  const editgroupid = params.id

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      allow_chat: false,
      organization: ""
    },
  })

  // Fetch organizations
  const fetchOrganizations = async () => {
    try {
      const response = await axiosInstance.get("/organization/list")
      setOrganizations(response.data)
    } catch (error) {
      console.error("Failed to fetch organizations:", error)
    } finally {
      setOrgLoading(false)
    }
  }

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get("/users/list")
      // Ensure unique users by id to prevent duplicate keys
      const uniqueUsers = res.data.filter((user: User, index: number, self: User[]) =>
        self.findIndex((u: User) => u.id === user.id) === index
      )
      setAvailableUsers(uniqueUsers)
    } catch (err) {
      console.error("Failed to fetch users", err)
    }
  }

  // Fetch group details for editing
  const fetchGroupDetails = async (groupId: string) => {
    try {
      const token = localStorage.getItem("access_token")
      const res = await axiosInstance.get(`/regular-groups/${groupId}/`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const data = res.data

      form.setValue("name", data.name)
      form.setValue("allow_chat", data.allow_chat)
      form.setValue("organization", String(data.organization))

      const membersFromAPI = data.members.map((id: number) =>
        availableUsers.find((user) => String(user.id) === String(id))
      ).filter(Boolean)

      setSelectedUsers(membersFromAPI)

      // Remove selected users from available list
      const selectedIds = data.members
      const filteredAvailable = availableUsers.filter(user => !selectedIds.includes(user.id))
      setAvailableUsers(filteredAvailable)

      setGroupDataLoaded(true)
    } catch (error) {
      console.error("Error fetching group details:", error)
    }
  }

  useEffect(() => {
    fetchOrganizations()
    fetchUsers()
  }, [])

  useEffect(() => {
    if (
      editgroupid &&
      typeof editgroupid === "string" &&
      availableUsers.length > 0 &&
      !groupDataLoaded
    ) {
      fetchGroupDetails(editgroupid)
    }
  }, [editgroupid, availableUsers, groupDataLoaded])

  const userinfo = useSelector(selectUser);
  if (!userinfo) return null
  if (orgLoading) return (
    <div className="relative flex justify-center items-center">
      <GlobalLoader />
    </div>
  );
  const filteredUsers = availableUsers
    .filter((u: any) =>
      !selectedUsers.some((s: any) => s.id === u.id) &&
      u.organization === userinfo.organization
    )
    .filter((u: any) => {
      const term = searchQuery.toLowerCase();
      const { username, first_name, last_name, email, phone, designation, location, division, department, organization_name } = u;
      return (
        (username && typeof username === 'string' && username.toLowerCase().includes(term)) ||
        (first_name && typeof first_name === 'string' && first_name.toLowerCase().includes(term)) ||
        (last_name && typeof last_name === 'string' && last_name.toLowerCase().includes(term)) ||
        (email && typeof email === 'string' && email.toLowerCase().includes(term)) ||
        (phone && typeof phone === 'string' && phone.toLowerCase().includes(term)) ||
        (designation && typeof designation === 'string' && designation.toLowerCase().includes(term)) ||
        (location && typeof location === 'string' && location.toLowerCase().includes(term)) ||
        (division && typeof division === 'string' && division.toLowerCase().includes(term)) ||
        (department && typeof department === 'string' && department.toLowerCase().includes(term)) ||
        (organization_name && typeof organization_name === 'string' && organization_name.toLowerCase().includes(term))
      );
    });


  const addUser = (user: User) => {
    setSelectedUsers((prev) => [...prev, user])
    setAvailableUsers((prev) => prev.filter((u) => u.id !== user.id))
  }

  const removeUser = (user: User) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id))
    setAvailableUsers((prev) => [...prev, user])
  }


  // ✅ Toggle individual checkbox
  const toggleCheckboxSelected = (userId: string) => {
    setCheckedSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  // ✅ Select/Deselect all
  const toggleSelectAllSelected = () => {
    if (checkedSelectedUsers.length === selectedUsers.length) {
      setCheckedSelectedUsers([])
    } else {
      setCheckedSelectedUsers(selectedUsers.map((u) => u.id))
    }
  }

  // ✅ Remove all checked selected users
  const removeSelectedUsers = () => {
    const usersToRemove = selectedUsers.filter((u) =>
      checkedSelectedUsers.includes(u.id)
    )

    setSelectedUsers((prev) =>
      prev.filter((u) => !checkedSelectedUsers.includes(u.id))
    )
    setAvailableUsers((prev) => [...prev, ...usersToRemove])
    setCheckedSelectedUsers([])
  }



  // Toggle checkbox
  const toggleCheckbox = (userId: string) => {
    setCheckedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  // Add all selected users at once
  const addSelectedUsers = () => {
    const usersToAdd = availableUsers.filter((u) =>
      checkedUsers.includes(u.id)
    )
    setSelectedUsers((prev) => [...prev, ...usersToAdd])
    setAvailableUsers((prev) =>
      prev.filter((u) => !checkedUsers.includes(u.id))
    )
    setCheckedUsers([])
  }

  // ✅ Select / Deselect All Checkboxes
  const toggleSelectAll = () => {
    if (checkedUsers.length === filteredUsers.length) {
      setCheckedUsers([]) // Uncheck all
    } else {
      setCheckedUsers(filteredUsers.map((u) => u.id)) // Check all
    }
  }



  async function onSubmit(values: FormValues) {
    console.log("✅ onSubmit fired with values:", values);

    setIsSubmitting(true);
    try {
      await handleCreateNormalGroup(values, selectedUsers);
      // Wait a moment for the success toast to be visible before navigating
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: "There was an error saving the group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateNormalGroup(values: FormValues, members: User[]) {
    try {
      const payload = {  // ADD: Include organizationId for scoping
        name: values.name,
        description: "",
        allow_chat: values.allow_chat,
        type: "Normal",
        members: members.map((user) => user.id),
        organization: userinfo?.organization || values.organization,
        organizationId: orgId || null,  // ADD: Pass orgId for backend scoping
      };

      let response;
      if (editgroupid) {
        response = await axiosInstance.put(`/regular-groups/${editgroupid}/`, payload)
          .then((res) => {
            hotToaster.success("Group Updated");
            return res;
          })
          .catch((error) => {
            console.error("Update error:", error);
            hotToaster.error("Error Occurred while Updating the Group",{duration:2000});
            throw error;
          });
      } else {
        response = await axiosInstance.post("/regular-groups/", payload)
          .then((res) => {
            hotToaster.success("Group Created",{duration:2000});
            return res;
          })
          .catch((error) => {
            console.error("Create error:", error);
            hotToaster.error("Error Occurred while Creating the Group",{duration:2000});
            throw error;
          });
      }

      return response;
    } catch (error) {
      throw error;
    }
  }


  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Operations Team" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {issuperadmin && (
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value?.toString()} // ensure it's a string
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.organization_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="allow_chat"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Allow Chat</FormLabel>
                    <FormDescription>
                      Enable chat functionality for this group
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Group Members</h3>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search users..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Available Users */}
              {/* Available Users */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Available Users</h4>

                    {/* 🔹 Add Selected Button */}
                    <Button
                      variant="default"
                      size="sm"
                      disabled={checkedUsers.length === 0}
                      onClick={addSelectedUsers}
                    >
                      Add Selected ({checkedUsers.length})
                    </Button>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-[50px] text-center sticky top-0 bg-white z-30">
                            {/* ✅ Select All Checkbox */}
                            <input
                              type="checkbox"
                              ref={el => {
                                if (el) {
                                  el.indeterminate =
                                    checkedUsers.length > 0 &&
                                    checkedUsers.length < filteredUsers.length;
                                }
                              }}
                              checked={
                                filteredUsers.length > 0 &&
                                checkedUsers.length === filteredUsers.length
                              }
                              onChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="w-[50px] text-center sticky top-0 bg-white z-30">Add</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Access</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">First Name</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Last Name</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Organization</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Phone</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Designation</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Location</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Division</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Department</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Status</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={11}
                              className="text-center text-muted-foreground"
                            >
                              <div className="relative flex justify-center items-center">
                                <GlobalLoader />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((user, index) => (
                            <TableRow key={`available-${user.id}-${index}`}>
                              {/* ✅ Checkbox */}
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={checkedUsers.includes(user.id)}
                                  onChange={() => toggleCheckbox(user.id)}
                                />
                              </TableCell>

                              {/* ➕ Plus Button */}
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => addUser(user)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {user.dashboard_access && <Monitor className="w-4 h-4" />}
                                  {user.mobile_supervisor && <FaMobileAlt className="w-4 h-4" />}
                                </div>
                              </TableCell>
                              <TableCell>{user.first_name || '-'}</TableCell>
                              <TableCell>{user.last_name || '-'}</TableCell>
                              <TableCell>{user.organization_name || '-'}</TableCell>
                              <TableCell>{user.countryCode && user.phone ? `${user.countryCode} ${user.phone}` : '-'}</TableCell>
                              <TableCell>{user.designation || '-'}</TableCell>
                              <TableCell>{user.location || '-'}</TableCell>
                              <TableCell>{user.division || '-'}</TableCell>
                              <TableCell>{user.department || '-'}</TableCell>
                              <TableCell>{user.status || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>



              {/* Selected Users */}
              {/* Selected Users */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">
                      Selected Users ({selectedUsers.length})
                    </h4>

                    {/* 🔹 Remove Selected Button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={checkedSelectedUsers.length === 0}
                      onClick={removeSelectedUsers}
                    >
                      Remove Selected ({checkedSelectedUsers.length})
                    </Button>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-30">
                        <TableRow>
                          <TableHead className="w-[50px] text-center sticky top-0 bg-white z-30">
                            {/* ✅ Select All Checkbox */}
                            <input
                              type="checkbox"
                              ref={el => {
                                if (el) {
                                  el.indeterminate =
                                    checkedSelectedUsers.length > 0 &&
                                    checkedSelectedUsers.length < selectedUsers.length;
                                }
                              }}
                              checked={
                                selectedUsers.length > 0 &&
                                checkedSelectedUsers.length === selectedUsers.length
                              }
                              onChange={toggleSelectAllSelected}
                            />
                          </TableHead>
                          <TableHead className="w-[50px] text-center sticky top-0 bg-white z-30">Remove</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Access</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">First Name</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Last Name</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Organization</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Phone</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Designation</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Location</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Division</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Department</TableHead>
                          <TableHead className="sticky top-0 bg-white z-30">Status</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {selectedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center text-muted-foreground">
                              No users selected
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedUsers.map((user, index) => (
                            <TableRow key={`selected-${user.id}-${index}`}>
                              {/* ✅ Checkbox */}
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={checkedSelectedUsers.includes(user.id)}
                                  onChange={() => toggleCheckboxSelected(user.id)}
                                />
                              </TableCell>

                              {/* ❌ Remove Single User */}
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeUser(user)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {user.dashboard_access && <Monitor className="w-4 h-4" />}
                                  {user.mobile_supervisor && <FaMobileAlt className="w-4 h-4" />}
                                </div>
                              </TableCell>
                              <TableCell>{user.first_name || '-'}</TableCell>
                              <TableCell>{user.last_name || '-'}</TableCell>
                              <TableCell>{user.organization_name || '-'}</TableCell>
                              <TableCell>{user.countryCode && user.phone ? `${user.countryCode} ${user.phone}` : '-'}</TableCell>
                              <TableCell>{user.designation || '-'}</TableCell>
                              <TableCell>{user.location || '-'}</TableCell>
                              <TableCell>{user.division || '-'}</TableCell>
                              <TableCell>{user.department || '-'}</TableCell>
                              <TableCell>{user.status || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/admin")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? editgroupid
                  ? "Updating..."
                  : "Creating..."
                : editgroupid
                ? "Update Group"
                : "Create Group"}
            </Button>
          </div>
        </form>
      </Form>
    </div>

  )
}
