// Updated component with corrections
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, X, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import axiosInstance from "@/utils/axiosInstance";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  organization: number | null;
}

const formSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string().optional(),
  created_date: z.string().optional(),
  created_timestamp: z.string().optional(),
  organization_status: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ManageOrganizationAdminsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAdmins, setSelectedAdmins] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const orgId = params.id as string;
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (orgId) {
      fetchOneOrganizations();
    }
  }, [orgId]);

  const fetchOneOrganizations = async () => {
    try {
      const usersRes = await axiosInstance.get("/users/list");
      const users =
        usersRes.data?.map((user: any) => ({
          id: user.id,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email,
          role: user.role_details?.name || "",
          organization: user.organization,
        })) || [];
      setAvailableUsers(users);

      if (orgId) {
        const orgRes = await axiosInstance.get(`/organization/${orgId}`);
        const org = orgRes.data.organization;

        form.reset({
          name: org.organization_name || "",
          description: org.organization_description || "",
        });
        setOrgName(org.organization_name || "");

        const admins = org.admins.map((admin: any) => ({
          id: admin.user.id,
          name: `${admin.user.first_name || ""} ${
            admin.user.last_name || ""
          }`.trim(),
          email: admin.user.email,
          role: admin.user.role_details?.name || "Admin",
        }));

        setSelectedAdmins(admins);

        // Remove admins from available users
        setAvailableUsers((prev) =>
          prev.filter(
            (user) =>
              !admins.some(
                (admin: any) => String(admin.id) === String(user.id)
              )
          )
        );
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = availableUsers.filter((user) => {
    const role = user.role?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    const normalizedOrgId = Number(orgId);
    const matchesSearch =
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      role.includes(query);

    return (
      role !== "admin" &&
      role !== "super_admin" &&
      (user.organization === null || user.organization === normalizedOrgId) &&
      matchesSearch
    );
  });

  const addAdmin = (user: User) => {
    setSelectedAdmins((prev) => [...prev, user]);
    setAvailableUsers((prev) => prev.filter((u) => u.id !== user.id));
  };

  const removeAdmin = (user: User) => {
    setSelectedAdmins((prev) => prev.filter((u) => u.id !== user.id));
    setAvailableUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev : [...prev, user]
    );
  };

  async function handleCreateOrganization(values: FormValues, admins: User[]) {
    try {
      const payload = {
        organization_name: values.name,
        organization_description: values.description ?? null,
        created_date: values.created_date,
        created_timestamp: values.created_timestamp,
        organization_status: values.organization_status,
        admin_ids: admins.map((u) => u.id),
      };

      const response = orgId
        ? await axiosInstance.put(`/organization/${orgId}`, payload)
        : await axiosInstance.post("/organization/create", payload);
      hotToaster.success("Updated admin!");
    } catch (error) {
      hotToaster.error("Can't Update admin!");
    }
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    await handleCreateOrganization(values, selectedAdmins);
    setIsSubmitting(false);
    router.back();
  }

  const handleSave = form.handleSubmit(onSubmit);

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : ""
        }`}
      >
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex flex-col gap-4 p-4 md:p-8">
          <div className="p-4 md:p-6">
            <div className="flex justify-between mb-6">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                onClick={() => router.push("/admin?tab=organization")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <div className="space-y-6">
              <div className="flex items-center">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Manage Organization Admins
                  </h1>
                  <p className="text-muted-foreground">
                    Add or remove administrators for {orgName}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
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
                    {/* Available Users */}
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-2">
                          Available Users
                        </h4>
                        <div className="rounded-md border max-h-[300px] overflow-y-auto">
                          <table className= "w-full table-auto">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-full">Add</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredUsers.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={4}
                                    className="text-center text-muted-foreground"
                                  >
                                    No users found
                                  </TableCell>
                                </TableRow>
                              ) : (
                                filteredUsers.map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => addAdmin(user)}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                    <TableCell className="sticky">
                                      {user.name}
                                    </TableCell>
                                    <TableCell className="sticky">
                                      {user.email}
                                    </TableCell>
                                    <TableCell className="sticky">
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

                    {/* Selected Admins */}
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-2">
                          Selected Admins ({selectedAdmins.length})
                        </h4>
                        <div className="rounded-md border max-h-[300px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">
                                  Remove
                                </TableHead>
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
                                selectedAdmins.map((user) => (
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
                                    <TableCell>{user.role}</TableCell>
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
                  <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
