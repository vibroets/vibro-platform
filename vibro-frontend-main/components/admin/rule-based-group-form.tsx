
"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";  // CHANGE: Add useSearchParams
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X, Loader, HotelIcon, Monitor } from "lucide-react";
import { FaMobileAlt } from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import hotToaster from "react-hot-toast";
import axiosInstance from "@/utils/axiosInstance";
import { userInfo } from "os";
import { ReduxProvider } from "@/redux/ReduxProvider";



// Define the form schema
const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  allowChat: z.boolean(),
  matchType: z.enum(["AND", "OR"]),
  organization: z.string().optional(),
});
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice"
import { or } from "mathjs";
import { store } from '@/redux/store';
import { is } from "date-fns/locale";
import GlobalLoader from "../ui/globalloader";
import { Host_Grotesk } from "next/font/google";

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

// Helper function to check if a user matches the given conditions
const doesUserMatchConditions = (user: any, conditions: Condition[], matchType: "AND" | "OR") => {
  if (conditions.length === 0) {
    return true; // No conditions, so the user matches
  }

  const matches = conditions.map(condition => {
    // Get the user's value for the specific field, handle null/undefined
    let userValue = user[condition.field];
    if (userValue === null || userValue === undefined) {
      userValue = ""; // Treat null/undefined as empty string for comparison
    } else if (typeof userValue === "object" && userValue.name) {
      userValue = userValue.name; // Extract name from nested objects if present
    }
    userValue = String(userValue).toLowerCase();
    const conditionValue = String(condition.value || '').toLowerCase();

    switch (condition.operator) {
      case "equals":
        return userValue === conditionValue;
      case "not_equal":
        return userValue !== conditionValue;
      case "contains":
        return userValue.includes(conditionValue);
      case "starts_with":
        return userValue.startsWith(conditionValue);
      case "ends_with":
        return userValue.endsWith(conditionValue);
      case "is_one_of":
        const allowedValues = conditionValue.split(',').map(s => s.trim());
        return allowedValues.includes(userValue);
      default:
        return false;
    }
  });

  if (matchType === "AND") {
    return matches.every(match => match);
  } else { // OR
    return matches.some(match => match);
  }
};

export function RuleBasedGroupForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();  // ADD: Read query params for orgId
  const orgId = searchParams.get('orgId');  // ADD: Extract orgId from URL
  const editgroupid = params.id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conditions, setConditions] = useState<Condition[]>([]);
  // const [organizations, setOrganizations] = useState([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [checkedUsers, setCheckedUsers] = useState<string[]>([]);
  const [checkedSelectedUsers, setCheckedSelectedUsers] = useState<string[]>([]);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const userinfo = useSelector(selectUser);
  const [fieldOptions, setFieldOptions] = useState({
    department: [],
    location: [],
    designation: [],
    division: [],
    subdivision: [],
  });
  const issuperadmin = userinfo?.role_details?.name?.toLowerCase() === "super_admin";
  const isadmin = userinfo?.role_details?.name?.toLowerCase() === "admin";
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      allowChat: true,
      matchType: "AND",
      organization: "",
    },
  });
  if (!userinfo) return null

  const fields = [
    { value: "department", label: "Department" },
    { value: "location", label: "Location" },
    { value: "designation", label: "Designation" },
    { value: "division", label: "Division" },
    { value: "subdivision", label: "SubDivision" },
  ];

  const operators = [
    { value: "equals", label: "Equals" },
    { value: "not_equal", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts With" },
    { value: "ends_with", label: "Ends With" },
    { value: "is_one_of", label: "Is One Of" },
  ];

  // Fetch organizations
  // const fetchOrganizations = async () => {
  //   try {
  //     const response = await axiosInstance.get("/organization/list");
  //     setOrganizations(response.data);
  //   } catch (error) {
  //     console.error("Failed to fetch organizations:", error);
  //   } finally {
  //     setOrgLoading(false);
  //   }
  // };

  // Normalize user data to match the expected format and include all relevant fields for filtering
const normalizeUser = (user: any) => ({
    id: user.id.toString(),
    username: `${user.first_name} ${user.last_name}`,
    first_name: user.first_name || "N/A",
    last_name: user.last_name || "N/A",
    email: user.email || null,
    phone: user.phone || "N/A",
    countryCode: user.countryCode || "",
    // Selected users from rule-based group API appear to come as nested objects under member_details.
    // Keep rendering fields consistent by normalizing defensively.
    designation: user.designation_details?.name ?? user.designation?.name ?? "N/A",
    department: user.department_details?.name ?? user.department?.name ?? "N/A",
    location: user.location_details?.name ?? user.location?.name ?? "N/A",
    division: user.division_details?.name ?? user.division?.name ?? user.division ?? "N/A",
    subdivision: user.subdivision_details?.name ?? user.subdivision?.name ?? user.subdivision ?? "N/A",
    status: user.status || "N/A",
    organization_name: user.organization_name || "N/A",
    organization: user.organization || "N/A",
    dashboard_access: user.dashboard_access || false,
    mobile_supervisor: user.mobile_supervisor || false,
  });

  // Fetch users for available users
  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get("/users/list");
      const normalizedUsers = res.data.map(normalizeUser);
      setAvailableUsers(normalizedUsers);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    // fetchOrganizations();
    fetchUsers();
  }, []);

  // Fetch dropdown options and group data if editing
  useEffect(() => {
    async function fetchOptionsAndGroupData() {
      try {
        const scopedOrgId = issuperadmin ? orgId : userinfo?.organization;
        const optionsBaseUrl = scopedOrgId ? `/${scopedOrgId}/` : "/";
        const [deptRes, locRes, desgRes, divRes, subdivRes] = await Promise.all([
          axiosInstance.get(`/department${optionsBaseUrl}`),
          axiosInstance.get(`/location${optionsBaseUrl}`),
          axiosInstance.get(`/designation${optionsBaseUrl}`),
          axiosInstance.get(`/division${optionsBaseUrl}`),
          axiosInstance.get(`/subdivision${optionsBaseUrl}`),
        ]);

        const fetchedFieldOptions = {
          department: deptRes.data.map((d: any) => d.name),
          location: locRes.data.map((l: any) => l.name),
          designation: desgRes.data.map((d: any) => d.name),
          division: divRes.data.map((d: any) => d.name),
          subdivision: subdivRes.data.map((d: any) => d.name),
        };
        setFieldOptions(fetchedFieldOptions);

        if (editgroupid) {
          const { data } = await axiosInstance.get(`/rule-based-groups/${editgroupid}/`);
          form.reset({
            name: data.name,
            description: data.description,
            allowChat: data.allow_chat,
            matchType: data.match_type.toUpperCase() as "AND" | "OR",
            organization: data.organization.toString(),
          });

          setConditions(
            data.conditions.map((c: any) => ({
              id: c.id.toString(),
              field: c.field,
              operator: c.operator,
              value: c.value,
            }))
          );

          // The rule-based group API doesn't return dashboard_access and mobile_supervisor fields
          // Fetch all users and match to get these fields
          try {
            const usersRes = await axiosInstance.get("/users/list");
            const allUsers = usersRes.data.map(normalizeUser);
            
            const membersWithAccess = data.member_details.map((member: any) => {
              const normalized = normalizeUser(member);
              // Find matching user in all users to get access fields
              const matchingUser = allUsers.find((u: any) => u.id === member.id.toString());
              if (matchingUser) {
                normalized.dashboard_access = matchingUser.dashboard_access;
                normalized.mobile_supervisor = matchingUser.mobile_supervisor;
                normalized.organization_name = matchingUser.organization_name;
                normalized.status = matchingUser.status;
                normalized.phone = matchingUser.phone;
                normalized.countryCode = matchingUser.countryCode;
              }
              return normalized;
            });
            
            setSelectedUsers(membersWithAccess);
          } catch (error) {
            console.error("Error fetching users list:", error);
            // Fallback to just normalize without access fields
            const normalizedMembers = data.member_details.map(normalizeUser);
            setSelectedUsers(normalizedMembers);
          }
        }
      } catch (error) {
        console.error("Error fetching dropdown data or group data:", error);
      } finally {
        setOrgLoading(false);
      }
    }

    fetchOptionsAndGroupData();
  }, [editgroupid, issuperadmin, orgId, userinfo?.organization]);

  const addUser = (user: any) => {
    setSelectedUsers([...selectedUsers, user]);
  };

  const removeUser = (user: any) => {
    setSelectedUsers(selectedUsers.filter((u: any) => u.id !== user.id));
  };

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
      setCheckedSelectedUsers(selectedUsers.map((u: any) => u.id))
    }
  }

  // ✅ Remove all checked selected users
  const removeSelectedUsers = () => {
    const usersToRemove = selectedUsers.filter((u: any) =>
      checkedSelectedUsers.includes(u.id)
    )
    setSelectedUsers((prev) =>
      prev.filter((u: any) => !checkedSelectedUsers.includes(u.id))
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
    const usersToAdd = filteredAvailableUsers.filter((u: any) =>
      checkedUsers.includes(u.id)
    )
    setSelectedUsers((prev) => [...prev, ...usersToAdd])
    setAvailableUsers((prev) =>
      prev.filter((u: any) => !checkedUsers.includes(u.id))
    )
    setCheckedUsers([])
  }

  // Select / Deselect All Checkboxes
  const toggleSelectAll = () => {
    if (checkedUsers.length === filteredAvailableUsers.length) {
      setCheckedUsers([]) // Uncheck all
    } else {
      setCheckedUsers(filteredAvailableUsers.map((u: any) => u.id)) // Check all
    }
  }

  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      field: "department",
      operator: "equals",
      value: fieldOptions.department[0] || "",
    };
    setConditions([...conditions, newCondition]);
    // Reset filters when conditions change
    setFiltersApplied(false);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
    // Reset filters when conditions change
    setFiltersApplied(false);
  };

  const updateCondition = (id: string, field: keyof Condition, value: string) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    // Reset filters when conditions change
    setFiltersApplied(false);
  };

  const applyFilters = () => {
    setFiltersApplied(true);
  };

  const clearFilters = () => {
    setFiltersApplied(false);
    setCheckedUsers([]);
  };

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    const payload = {  // ADD: Include organizationId for scoping
      name: data.name,
      description: data.description,
      allow_chat: data.allowChat,
      match_type: data.matchType.toLowerCase(),
      organization: userinfo?.organization || "",
      members: selectedUsers.map((u: any) => parseInt(u.id)),
      conditions: conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      })),
      organizationId: orgId || null,  // ADD: Pass orgId for backend scoping
    };

    try {
      if (editgroupid) {
        await axiosInstance.put(`/rule-based-groups/${editgroupid}/`, payload).then((res) => {
          
          hotToaster.success("Updated a Rule Based Group",{duration:2000});
        }).catch((error) => {
          console.error("Update error:", error);
          hotToaster.error("Can't Update The Rule Based Group\n"+ error.response?.data?.detail || "An error occurred.");
        });
      } else {
        await axiosInstance.post("/rule-based-groups/", payload).then((res) => {
          hotToaster.success("Created a Rule Based Group",{duration:2000});
        }).catch((error) => {
          console.error("Creation error:", error);
          hotToaster.error(
            "Can't Create The Rule Based Group\n" +
              error.response?.data?.detail || "An error occurred."
          );
        });
      }

      // Wait a moment for the success toast to be visible before navigating
      setTimeout(() => {
        router.push("/admin");
      }, 1500);
    } catch (error) {
      console.error("Submission error:", error);
      hotToaster.error(
        "An unexpected error occurred during submission!\nPlease try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter available users based on selected conditions and if they are already selected
  const filteredAvailableUsers = availableUsers
  .filter((u: any) => !selectedUsers.some((s: any) => s.id === u.id))
  .filter((u: any) => u.organization === userinfo.organization)
  .filter((u: any) => filtersApplied ? doesUserMatchConditions(u, conditions, form.watch("matchType")) : true);

let usersToReturn;
if (isadmin) {
  usersToReturn = filteredAvailableUsers;
} else if (issuperadmin) {
  usersToReturn = availableUsers;
} else {
  usersToReturn = []; 
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
                    <Input placeholder="Warehouse Staff" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* {issuperadmin && (
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org: any) => (
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
            )} */}

            <FormField
              control={form.control}
              name="allowChat"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel className="text-base">Allow Chat</FormLabel>
                    <FormDescription>
                      Enable chat for this group
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Conditions</h3>
              <FormField
                control={form.control}
                name="matchType"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="AND" />
                          </FormControl>
                          <FormLabel className="cursor-pointer">
                            Match ALL
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="OR" />
                          </FormControl>
                          <FormLabel className="cursor-pointer">
                            Match ANY
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
                {conditions.map((condition, index) => (
                  <div
                    key={condition.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border rounded-md p-4"
                  >
                    <div className="w-full sm:w-1/4">
                      <Select
                        value={condition.field}
                        onValueChange={(value) =>
                          updateCondition(condition.id, "field", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full sm:w-1/4">
                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          updateCondition(condition.id, "operator", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((operator) => (
                            <SelectItem
                              key={operator.value}
                              value={operator.value}
                            >
                              {operator.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full sm:w-1/3">
                      <Select
                        value={condition.value}
                        onValueChange={(value) =>
                          updateCondition(condition.id, "value", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            fieldOptions[
                              condition.field as keyof typeof fieldOptions
                            ] || []
                          ).map((value: string) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(condition.id)}
                      disabled={conditions.length === 1 && !editgroupid}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addCondition}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Condition
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={applyFilters}
                    disabled={conditions.length === 0}
                    className="flex-1"
                  >
                    Apply Filters
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    disabled={!filtersApplied}
                    className="flex-1"
                  >
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
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
                                  checkedUsers.length < filteredAvailableUsers.length;
                              }
                            }}
                            checked={
                              filteredAvailableUsers.length > 0 &&
                              checkedUsers.length === filteredAvailableUsers.length
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
                      {filteredAvailableUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground py-4">
                            {orgLoading ? (
                              <div className="relative flex justify-center items-center">
                                <GlobalLoader />
                              </div>
                            ) : (
                              "No users found matching the current conditions or all available users are selected."
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAvailableUsers.map((user: any, index) => (
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
                            <TableCell>{user.phone ? (user.countryCode ? `${user.countryCode} ${user.phone}` : user.phone) : '-'}</TableCell>
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
                          <TableCell colSpan={11} className="text-center text-muted-foreground py-4">
                            No users selected for this group.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedUsers.map((user: any, index) => (
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
                            <TableCell>{user.phone ? (user.countryCode ? `${user.countryCode} ${user.phone}` : user.phone) : '-'}</TableCell>
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
                ? "Saving..."
                : editgroupid
                ? "Update Group"
                : "Create Group"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
