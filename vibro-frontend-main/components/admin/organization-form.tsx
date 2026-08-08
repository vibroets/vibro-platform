"use client";

import { use, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import hotToaster from "react-hot-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, X, Loader } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { selectUser, setUser } from "@/redux/slices/authSlice";
import { useSelector, useDispatch } from "react-redux";
import { cn } from "@/lib/utils";
import GlobalLoader from "../ui/globalloader";
import { organizationFormStore } from "@/utils/organizationFormStore";

const MODULES = [
  { module: "dashboard", access: "no_access" },
  { module: "announcements", access: "no_access" },
  { module: "forms", access: "no_access" },
  { module: "tasks", access: "no_access" },
  { module: "polls", access: "no_access" },
  { module: "learning_training", access: "no_access" },
  { module: "planner", access: "no_access" },
  { module: "attendance", access: "no_access" },
  { module: "guides", access: "no_access" },
  { module: "administration", access: "full_access" },
];

const formSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string().optional(),
  created_date: z.string().optional(),
  created_timestamp: z.string().optional(),
  organization_status: z.string().optional(),
  dashboardaccess: z.boolean(),
  module_access_list: z
    .array(
      z.object({
        module: z.string(),
        access: z.enum(["full_access", "view_only", "no_access"]),
      })
    )
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  admins: User[];
  organization: number | null;
}

interface Group {
  id: string | number;
  name: string;
  description?: string;
  allow_chat?: boolean;
  type?: string;
  created_at?: string;
  organization_name?: string;
}

interface OrganizationFormProps {
  isNew?: boolean;
  orgId?: number;
  onNameChange?: (name: string) => void;
  onDashboardAccessChange?: (dashboardAccess: boolean) => void;
  onModuleAccessChange?: (moduleAccessList: any[]) => void;
  onCancel?: () => void;
}

export function OrganizationForm({
  isNew = false,
  orgId,
  onNameChange,
  onDashboardAccessChange,
  onModuleAccessChange,
  onCancel,
}: OrganizationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const dispatch = useDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [selectedAdmins, setSelectedAdmins] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState(1);
  const params = useParams();
  const organizationId = params.id as string;
  const searchParams = useSearchParams();
  const orgIdd = searchParams.get("orgId");

  const [isOrgLoading, setIsOrgLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchOneOrganizations();
    } else if (isNew && orgId) {
      fetchUsersForOrg(orgId);
      setIsOrgLoading(false);
    } else {
      setIsOrgLoading(false);
    }
  }, [organizationId, isNew, orgId]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsersForOrg = async (id: number) => {
    try {
      const res = await axiosInstance.get("/users/list");
      const users =
        res.data?.map((value: any) => ({
          id: value.id,
          name: `${value.first_name} ${value.last_name}`,
          email: value.email,
          role: value.role_details?.name || "",
          organization: value.organization,
        })) || [];
      setAvailableUsers(
        users.filter(
          (u: User) =>
            u.role?.toLowerCase() !== "admin" &&
            u.role?.toLowerCase() !== "super_admin" &&
            (u.organization === null || u.organization === id) // allow null users for new org
        )
      );
      setOrgUsers(users);
    } catch (err) {
      console.error("Failed to fetch users for new org", err);
    }
  };

  // const fetchUsers = async () => {
  //   try {
  //     const res = await axiosInstance.get("/users/list")
  //     const users = res.data?.map((value: any) => ({
  //       id: value.id,
  //       name: `${value.first_name} ${value.last_name}`,
  //       email: value.email,
  //       role: value.role_details?.name || "",
  //       organization: value.organization,
  //     })) || []
  //     setAvailableUsers(users)
  //   } catch (err) {
  //     console.error("Failed to fetch users", err)
  //   }
  // }
  //   const fetchUsers = async () => {
  //   // if (!orgId) {
  //   //   console.warn("Organization ID is missing");
  //   //   return;
  //   // }
  // console.log("Fetching users for orgId:", orgIdd);
  //   try {
  //     const res = await axiosInstance.get(`/users/by-organization/?orgId=${orgIdd}`);
  //     const users = res.data?.map((value: any) => ({
  //       id: value.id,
  //       name: `${value.first_name} ${value.last_name}`,
  //       email: value.email,
  //       role: value.role_details?.name || "",
  //       organization: value.organization,
  //     })) || [];
  //     setAvailableUsers(users);
  //   } catch (err) {
  //     console.error("Failed to fetch users", err);
  //   }
  // };

  const fetchUsers = async () => {
    if (!orgIdd) {
      console.warn("Organization ID is missing");
      return;
    }
    try {
      setIsOrgLoading(true);
      console.log("Fetching users for orgId:", orgIdd);
      const res = await axiosInstance.get(
        `/users/by-organization/?orgId=${orgIdd}`
      );
      console.log("API response:", res.data);

      const users =
        res.data?.map((value: any) => ({
          id: value.id,
          name: `${value.first_name ?? ""} ${value.last_name ?? ""}`.trim(),
          email: value.email ?? "",
          role: value.role_details?.name || "",
          admins: value.admins || [],
          organization: Number(value.organization) || null,
        })) || [];
      console.log("Mapped users:", users);
      console.log("Available users before setting state:", res.data);
      setAvailableUsers(users);

      const autoAdmins = users.filter(
        (u: User) =>
          u.role?.toLowerCase() === "admin" &&
          (u.organization === Number(orgIdd) || u.organization === orgId)
      );
      setSelectedAdmins(autoAdmins);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setIsOrgLoading(false);
    }
  };

  // const fetchOneOrganizations = async () => {
  //   try {
  //     const usersRes = await axiosInstance.get("/users/list");
  //     const users =
  //       usersRes.data?.map((user: any) => ({
  //         id: user.id,
  //         name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
  //         email: user.email,
  //         role: user.role_details?.name || "",
  //         organization: user.organization,
  //       })) || [];
  //     setAvailableUsers(users);

  //     const orgUsersRes = await axiosInstance.get(
  //       `/organization/${organizationId}/available-users/`
  //     );
  //     const orgUsersData =
  //       orgUsersRes.data?.map((user: any) => ({
  //         id: user.id,
  //         name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
  //         email: user.email,
  //         role: user.role_details?.name || "",
  //         organization: user.organization,
  //       })) || [];
  //     setOrgUsers(orgUsersData);

  //     if (organizationId) {
  //       const orgRes = await axiosInstance.get(
  //         `/organization/${organizationId}`
  //       );
  //       const org = orgRes.data.organization;
  //       form.reset({
  //         name: org.organization_name || "",
  //         description: org.organization_description || "",
  //         dashboardaccess: org.dashboard_access ?? false,
  //         module_access_list:
  //           org.module_permissions ??
  //           MODULES.map((m) => ({
  //             module: m.module,
  //             access: "no_access",
  //           })),
  //       });

  //       const admins = org.admins.map((admin: any) => ({
  //         id: admin.user.id,
  //         name: `${admin.user.first_name || ""} ${admin.user.last_name || ""}`.trim(),
  //         email: admin.user.email,
  //         role: admin.user.role_details?.name || "admin",
  //       }));

  //       setSelectedAdmins(admins)
  //       setAvailableUsers(
  //         allOrgUsers.filter(
  //           (user: User) => !admins.some((admin: any) => String(admin.id) === String(user.id))
  //         )
  //       )

  //       const groupsRes = await axiosInstance.get(`/organization/groups/${organizationId}/`)
  //       const groups = groupsRes.data || []
  //       setSelectedGroups(groups)
  //     }
  //   } catch (err) {
  //     console.error("Failed to fetch organization", err)
  //     toast({
  //       title: "Error",
  //       description: "Failed to load organization data",
  //       variant: "destructive",
  //     })
  //   } finally {
  //     setIsOrgLoading(false)
  //   }
  // };

  const fetchOneOrganizations = async () => {
    try {
      const orgUsersRes = await axiosInstance.get(
        `/organization/${organizationId}/available-users/`
      );
      const allOrgUsers =
        orgUsersRes.data?.map((user: any) => ({
          id: user.id,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email,
          role: user.role_details?.name || "",
          organization: user.organization,
        })) || [];
      setOrgUsers(allOrgUsers);

      if (organizationId) {
        const orgRes = await axiosInstance.get(
          `/organization/${organizationId}`
        );
        const org = orgRes.data.organization;
        
        // Properly initialize module_access_list
        // If module_permissions is null, undefined, or empty array, use MODULES template
        let moduleAccessList = MODULES.map((m) => ({
          module: m.module,
          access: "no_access" as const,
        }));
        
        if (org.module_permissions && Array.isArray(org.module_permissions) && org.module_permissions.length > 0) {
          // Use existing permissions, but merge in any new modules not yet saved
          const existingModules = new Set(org.module_permissions.map((p: any) => p.module));
          moduleAccessList = [
            ...org.module_permissions,
            ...MODULES.filter((m) => !existingModules.has(m.module)).map((m) => ({
              module: m.module,
              access: "no_access" as const,
            })),
          ];
        }
        
        form.reset({
          name: org.organization_name || "",
          description: org.organization_description || "",
          dashboardaccess: org.dashboard_access ?? false,
          module_access_list: moduleAccessList,
        });

        const admins = org.admins.map((admin: any) => ({
          id: admin.user.id,
          name: `${admin.user.first_name || ""} ${
            admin.user.last_name || ""
          }`.trim(),
          email: admin.user.email,
          role: admin.user.role_details?.name || "admin",
        }));

        setSelectedAdmins(admins);
        setAvailableUsers(
          allOrgUsers.filter(
            (user: User) =>
              !admins.some((admin: any) => String(admin.id) === String(user.id))
          )
        );

        const groupsRes = await axiosInstance.get(
          `/organization/groups/${organizationId}/`
        );
        const groups = groupsRes.data || [];
        setSelectedGroups(groups);
      }
    } catch (err) {
      console.error("Failed to fetch organization", err);
      toast({
        title: "Error",
        description: "Failed to load organization data",
        variant: "destructive",
      });
    } finally {
      setIsOrgLoading(false);
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      dashboardaccess: false,
      module_access_list: MODULES.map((m) => ({
        module: m.module,
        access: "no_access",
      })),
    },
  });

  // Restore form data from sessionStorage when component mounts
  // Only restore if:
  // 1. Creating a new organization (isNew is true)
  // 2. Not editing an existing one (organizationId is not set)
  // 3. Has an orgId (meaning user is returning from Add User page)
  // 4. Has cached data available
  useEffect(() => {
    if (isNew && !organizationId && orgId && organizationFormStore.hasCachedData()) {
      const cachedData = organizationFormStore.get();
      console.log('Restoring cached organization form data:', cachedData);
      
      if (cachedData.name || cachedData.description || cachedData.dashboardaccess !== undefined) {
        form.reset({
          name: cachedData.name || "",
          description: cachedData.description || "",
          dashboardaccess: cachedData.dashboardaccess ?? false,
          module_access_list: cachedData.module_access_list || MODULES.map((m) => ({
            module: m.module,
            access: "no_access",
          })),
        });

        // Notify parent component about the restored name
        if (cachedData.name && typeof onNameChange === "function") {
          onNameChange(cachedData.name);
        }

        // Restore selected admins if available
        if (cachedData.selectedAdmins && cachedData.selectedAdmins.length > 0) {
          setSelectedAdmins(cachedData.selectedAdmins as User[]);
        }
      }
    }
  }, [isNew, organizationId, orgId, form, onNameChange]);

  // Save form data to sessionStorage whenever it changes (only for new organizations)
  useEffect(() => {
    if (isNew && !organizationId) {
      const subscription = form.watch((formData) => {
        // Filter out any undefined or invalid module access items
        const filteredModuleAccessList = formData.module_access_list?.filter(
          (item): item is { module: string; access: 'full_access' | 'view_only' | 'no_access' } =>
            !!item && typeof item.module === 'string' && typeof item.access === 'string'
        );

        organizationFormStore.save({
          name: formData.name || "",
          description: formData.description || "",
          dashboardaccess: formData.dashboardaccess ?? false,
          module_access_list: filteredModuleAccessList,
        });
      });
      return () => subscription.unsubscribe();
    }
  }, [isNew, organizationId, form]);

  // Save selected admins to sessionStorage whenever they change (only for new organizations)
  useEffect(() => {
    if (isNew && !organizationId && selectedAdmins.length > 0) {
      organizationFormStore.save({
        selectedAdmins: selectedAdmins,
      });
    }
  }, [selectedAdmins, isNew, organizationId]);

  // Notify parent component about dashboard access changes
  useEffect(() => {
    if (isNew && !organizationId && typeof onDashboardAccessChange === "function") {
      const dashboardAccess = form.watch("dashboardaccess") ?? false;
      onDashboardAccessChange(dashboardAccess);
    }
  }, [isNew, organizationId, form, onDashboardAccessChange]);

  // Notify parent component about module access changes
  useEffect(() => {
    if (isNew && !organizationId && typeof onModuleAccessChange === "function") {
      const subscription = form.watch((value, { name }) => {
        if (name?.startsWith('module_access_list')) {
          const moduleAccessList = value.module_access_list;
          onModuleAccessChange(moduleAccessList || []);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [isNew, organizationId, form, onModuleAccessChange]);

  const userinfo = useSelector(selectUser);
  if (!userinfo)
    return (
      <div className="relative flex justify-center items-center">
        <GlobalLoader />
      </div>
    );

  const filteredUsers = availableUsers
    .filter((user: User) => user.role?.toLowerCase() !== "admin")
    .filter((user: User) => user.role?.toLowerCase() !== "super_admin")
    .filter((user: User) => {
      if (isNew && orgId) {
        return user.organization === null || user.organization === orgId;
      } else if (organizationId) {
        return user.organization === parseInt(organizationId);
      } else {
        return (
          user.organization === null || user.organization === Number(orgIdd)
        );
      }
    })
    .filter(
      (user: User) =>
        !selectedAdmins.some(
          (admin: User) => String(admin.id) === String(user.id)
        )
    )
    .filter((user: User) => {
      const query = searchQuery.toLowerCase();
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.role?.toLowerCase().includes(query) ||
        false
      );
    });

  const filteredOrgUsers = orgUsers
    .filter((user: User) => user.role?.toLowerCase() !== "super_admin")
    .filter((user: User) => {
      if (isNew && orgId) {
        return user.organization === null || user.organization === orgId;
      } else {
        return user.organization !== null;
      }
    })
    .filter((user: User) => {
      const query = orgSearchQuery.toLowerCase();
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.role?.toLowerCase().includes(query) ||
        false
      );
    });

  const filteredGroups = selectedGroups.filter((group: Group) => {
    const query = groupSearchQuery.toLowerCase();
    return group.name?.toLowerCase().includes(query);
  });

  const addAdmin = (user: User) => {
    setSelectedAdmins((prev) => [...prev, user]);
    setAvailableUsers((prev) => prev.filter((u) => u.id !== user.id));
  };

  //   const handleAddUser = async (user: User) => {
  //   try {
  //     const payload = {
  //       email: user.email,
  //       first_name: user.name.split(" ")[0],
  //       last_name: user.name.split(" ").slice(1).join(" "),
  //       phone: "", // fill as needed
  //       organizationId: isNew && orgId ? orgId : organizationId ? parseInt(organizationId) : null,
  //       role: "admin",
  //     };

  //     await axiosInstance.post("/users/create/", payload);
  //     toast({
  //       title: "User added successfully",
  //       description: `${user.name} has been added.`,
  //     });

  //     handleRefresh(); // refresh user lists
  //   } catch (err: any) {
  //     toast({
  //       title: "Error adding user",
  //       description: err.response?.data?.error || "Something went wrong",
  //       variant: "destructive",
  //     });
  //   }
  // };

  const removeAdmin = (user: User) => {
    setSelectedAdmins((prev) => prev.filter((u) => u.id !== user.id));
    setAvailableUsers((prev) => [...prev, user]);
  };

  const handleRefresh = () => {
    if (isNew && orgId) {
      fetchUsersForOrg(orgId);
    } else if (organizationId) {
      fetchOneOrganizations();
    } else {
      fetchUsers();
    }
  };

  const handleCancel = () => {
    // Clear cached form data when user cancels
    if (isNew && !organizationId) {
      organizationFormStore.clear();
    }
    router.push("/admin?tab=organization");
  };

  async function handleCreateOrganization(
    values: FormValues,
    admins: User[],
    groups: Group[]
  ) {
    try {
      // Always send module_access_list, even if dashboard access is false
      // This ensures proper initialization for future edits
      const moduleAccessList = values.module_access_list && values.module_access_list.length > 0
        ? values.module_access_list
        : MODULES.map((m) => ({
            module: m.module,
            access: "no_access" as const,
          }));
      
      const payload = {
        organizationId: orgId ?? Number(orgIdd),
        organization_name: values.name,
        organization_description: values.description ?? null,
        created_date: values.created_date,
        created_timestamp: values.created_timestamp,
        organization_status: values.organization_status,
        admin_ids: admins?.length ? admins.map((u) => u.id) : [],
        group_ids: groups.map((g) => g.id),
        dashboard_access: values.dashboardaccess,
        module_access_list: moduleAccessList,
      };

      let response;

      if (isNew && orgId) {
        response = await axiosInstance.post("/organization/create", payload);
        hotToaster.success("Organization created successfully!");
        // Clear cached form data after successful creation
        organizationFormStore.clear();
      } else if (organizationId) {
        response = await axiosInstance.put(
          `/organization/${organizationId}`,
          payload
        );
        hotToaster.success("Organization updated successfully!");

        // Update Redux state with new organization name
        if (userinfo) {
          dispatch(setUser({
            ...userinfo,
            organization_name: values.name
          }));
        }
      } else {
        response = await axiosInstance.post("/organization/create", payload);
        if (response) {
          hotToaster.success("Organization created successfully!");
          // Clear cached form data after successful creation
          organizationFormStore.clear();
          router.push("/admin?tab=organization");
        }
      }
      router.push("/admin?tab=organization");
    } catch (error) {
      // Optional: log error details
      console.error("Create org error:", error);
      hotToaster.error("Can't Create Organization!");
    }
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    await handleCreateOrganization(values, selectedAdmins, selectedGroups);
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {isOrgLoading ? (
            <div className="flex items-center justify-center h-64">
                              <GlobalLoader />
                            </div>
          ) : (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="East Region Division"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e); // keep react-hook-form in sync
                          // ✅ send value up to parent
                          if (typeof onNameChange === "function") {
                            console.log("🔤 Organization name changed:", e.target.value);
                            onNameChange(e.target.value);
                          }
                        }}
                      />
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
                        placeholder="Optional description for this organization"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          {/* --- Dashboard Access Section --- */}
          <div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="dashboardaccess"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Dashboard Access
                      </FormLabel>
                      <FormDescription>
                        Allow this organization to access the dashboard
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          console.log("🔄 Dashboard access toggle changed:", checked);
                          field.onChange(checked);

                          // Trigger dashboard access callback
                          if (isNew && !organizationId && typeof onDashboardAccessChange === "function") {
                            console.log("📡 Sending dashboard access to parent:", checked);
                            onDashboardAccessChange(checked);
                          }

                          // When enabling dashboard access, ensure module_access_list is properly initialized
                          if (checked) {
                            const currentModuleList = form.getValues("module_access_list");
                            if (!currentModuleList || currentModuleList.length === 0) {
                              const newModuleList = MODULES.map((m) => ({
                                module: m.module,
                                access: "no_access" as const,
                              }));
                              form.setValue("module_access_list", newModuleList);
                              console.log("📋 Initialized module list:", newModuleList);
                            }
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("dashboardaccess") && (
                <div className="mt-4">
                  <div className="border border-gray-400 rounded-md p-4 space-y-4">
                    <h3 className="text-base font-medium border border-gray-400 rounded-md pl-2 py-2">
                      Module Access Control
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {form
                        .watch("module_access_list")
                        ?.map((moduleItem, index) => (
                          <FormField
                            key={`${moduleItem.module}-${index}`}
                            control={form.control}
                            name={`module_access_list.${index}.access`}
                            render={({ field }) => (
                              <FormItem
                                className={cn(
                                  "flex items-center justify-between border px-2 rounded-md h-14",
                                  field.value === "no_access"
                                )}
                              >
                                <FormLabel className="capitalize">
                                  {moduleItem.module.replace("_", " ")}
                                </FormLabel>
                                <FormControl>
                                  <div className="mt-0">
                                    <Select
                                      onValueChange={(value) => {
                                        console.log(`📋 Module ${moduleItem.module} access changed from ${field.value} to ${value}`);
                                        field.onChange(value);
                                        // Trigger callback when module access changes
                                        if (isNew && !organizationId && typeof onModuleAccessChange === "function") {
                                          const currentList = form.getValues("module_access_list") || [];
                                          const updatedList = currentList.map((item, idx) =>
                                            idx === index ? { ...item, access: value as 'full_access' | 'view_only' | 'no_access' } : item
                                          );
                                          console.log("📋 Sending updated module list to parent:", updatedList);
                                          onModuleAccessChange(updatedList);
                                        }
                                      }}
                                      value={field.value}
                                      disabled={
                                        userinfo.role_details.name !==
                                        "super_admin"
                                      }
                                    >
                                      <SelectTrigger className="w-[150px] h-8 text-xs">
                                        <SelectValue placeholder="Select access" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="full_access">
                                          Full Access
                                        </SelectItem>
                                        <SelectItem value="view_only">
                                          View Only
                                        </SelectItem>
                                        <SelectItem value="no_access">
                                          No Access
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* --- Admin Section --- */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Organization Users</h3>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium mb-2">Available Users</h4>
                  <div className="rounded-md border max-h-[300px] overflow-y-auto">
                    <table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Add</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers == null ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              <div className="relative flex justify-center items-center">
                                <GlobalLoader />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground"
                            >
                              No users found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((user: User) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => addAdmin(user)}
                                >
                                  {/* <Button variant="ghost" size="icon" onClick={() => handleAddUser(user)}> */}

                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TableCell>
                              <TableCell>{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell className="capitalize">
                                {user.role}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium mb-2">
                    Selected Admins ({selectedAdmins.length})
                  </h4>
                  <h4 className="text-sm font-medium mb-2">Selected Admins</h4>
                  <div className="rounded-md border max-h-[300px] overflow-y-auto">
                    <table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Remove</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAdmins.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground"
                            >
                              No admins selected
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedAdmins.map((user: User) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAdmin(user)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                              <TableCell>{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell className="capitalize">
                                {user.role}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* --- Groups Section --- */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Organization Groups</h3>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search groups..."
                  className="pl-8"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="rounded-md border max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        {/* <TableHead>Description</TableHead> */}
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGroups.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground"
                          >
                            No groups found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredGroups.map((group: Group) => (
                          <TableRow key={group.id}>
                            <TableCell>{group.name}</TableCell>
                            <TableCell>{group.description}</TableCell>
                            <TableCell className="capitalize">
                              {group.type || "normal"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- Footer Buttons --- */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel || handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isNew ? (
                "Create Organization"
              ) : (
                "Update Organization"
              )}
            </Button>
          </div>
        </form>
      </Form>
    )}
    </div>
  );
}
