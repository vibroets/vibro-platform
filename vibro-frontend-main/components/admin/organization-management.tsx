"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MoreHorizontal,
  Edit,
  Plus,
  Search,
  Users,
  Power,
  PowerOff,
  Loader,
  MapPinned,
} from "lucide-react";
import { useUser } from "@/components/user-provider";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import ConfirmModalBox from "../ui/confirm-modalbox";
import axiosInstance from "@/utils/axiosInstance";
import hotToaster from "react-hot-toast";
import { id } from "date-fns/locale";
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import CardContent from "@mui/material/CardContent";
import Card from "@mui/material/Card";
import GlobalLoader from "../ui/globalloader";

interface Organization {
  id: string;
  organization_name: string;
  created_date: string;
  admin_count: number;
  organization_status: "Active" | "Inactive";
  organization: number;
  is_draft?: boolean; // HIGHLIGHT: Add draft flag
}

export interface SelectedOrganization {
  id: number;
  organization_name: string;
  organization_description: string;
  created_date: string;
  organization_status: string;
  created_timestamp: string;
  admin_count: number;
  admins: Admin[];
  dashboard_access: boolean; // ✅ at organization level
  module_permissions: any[];
}

export interface Admin {
  id: number;
  organization: number;
  user: User;
  assigned_timestamp: string;
  dashboard_access: boolean; // ✅ at admin level
}

export interface User {
  id: number;
  employee_id: string | null;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  country_code: string | null;
  designation: string | null;
  designation_details: Detail | null;
  location: string | null;
  location_details: Detail | null;
  division: string | null;
  subdivision: string | null;
  department: string | null;
  department_details: Detail | null;
  status: string;
  organization: number;
  role: number;
  role_details: Detail;
  dashboard_access: boolean;
  module_access: ModuleAccess[];
  mobile_supervisor: boolean;
  is_active: boolean;
  is_admin: boolean;
  is_superadmin: boolean;
  disable: boolean;
}

export interface Detail {
  id: number;
  name: string;
  description: string;
}

export interface ModuleAccess {
  module: string;
  access: string;
  is_draft?: boolean; // HIGHLIGHT: Add for future filter (hide drafts?)
}

export default function OrganizationManagement() {
  // Per-column filters for organizations
  const [orgNameFilter, setOrgNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [checkvalue, setCheckValue] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>();
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [viewOrgData, setViewOrgData] = useState<SelectedOrganization | null>();
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchOrgs, setFetchOrgs] = useState<boolean>(false);
  const [viewPop, setViewpop] = useState<boolean>(false);

  const reduxUser = useSelector(selectUser);
  const isSuperAdmin = reduxUser?.role_details?.name === "super_admin";
  const isAdmin = reduxUser?.role_details?.name === "admin";
  const userOrgId = reduxUser?.id;

  // const canManage = reduxUser?.role_details.name === "super admin"
  // if (!canManage) {
  //   return (
  //     <div className="rounded-md border p-8 text-center">
  //       <h2 className="text-xl font-semibold">Access Denied</h2>
  //       <p className="text-muted-foreground mt-2">Only Super Admins can manage organizations.</p>
  //     </div>
  //   )

  // }

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleOrgClick = async (item: Organization) => {
    setSelectedOrg(item);
  };

  useEffect(() => {
    if (selectedOrg) {
      const fetchOrganization = async () => {
        try {
          setLoading(true);
          setViewpop(true);
          // setError("");
          const orgRes = await axiosInstance.get(
            `/organization/${selectedOrg.id}`
          );
          const org = orgRes.data.organization;
          console.groupCollapsed(org, "ORG DATA");
          setViewOrgData(org);

          setShowPopup(true);
        } catch (err) {
          // setError("Failed to load organization details.");
        } finally {
          setLoading(false);
          setViewpop(false);
        }
      };

      fetchOrganization();
    }
  }, [selectedOrg]);

  console.log(loading, "LOADS");
  if (!reduxUser) return null; // or return loading
  const organizationValue = reduxUser.organization;

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setFetchOrgs(true);
      const res = await axiosInstance.get("organization/list");
      const data = res.data;
      const mappedOrganizations: Organization[] = data.map((org: any) => ({
        id: String(org.id),
        organization_name: org.organization_name,
        created_date: org.created_date,
        admin_count: org.admin_count,
        organization_status:
          org.organization_status === "Active" ? "Active" : "Inactive",
        organization: org.organization,
        organization_id: org.organization_id,
        is_draft: org.is_draft, // HIGHLIGHT: Map draft flag
      }));
      setOrganizations(mappedOrganizations);
    } catch (err) {
      console.error("Failed to fetch organization list", err);
    } finally {
      setLoading(false);
      setFetchOrgs(false);
    }
  };

  const archiveOrganizations = async (ids: string[]) => {
    try {
      await axiosInstance.post("bulk/archive/organization", {
        ids: ids.map((id) => parseInt(id)),
      });
      hotToaster.success("The selected organization has been deactivated.", {
        duration: 2000,
      });
      setShowModal(false);
      setPendingDeleteId(null);
      fetchOrganizations();
    } catch (err) {
      console.error("Deactivation failed", err);
      hotToaster.error("Failed to deactivate the organization.", {
        duration: 2000,
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedRows(
      selectedRows.length === filteredorganization.length
        ? []
        : filteredorganization.map((org) => org.id)
    );
  };

  // Filter organizations for table: Super Admin sees all, Admin sees only their org (with search and per-column filters)
  // HIGHLIGHT: Optional: Hide drafts in list (filter !is_draft)
  const filteredorganization = organizations.filter((item) => {
    const matchesSearch =
      item.organization_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.organization_status
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesOrgName =
      orgNameFilter.trim() === "" ||
      item.organization_name
        .toLowerCase()
        .includes(orgNameFilter.toLowerCase());
    const matchesStatus =
      statusFilter.trim() === "" ||
      item.organization_status
        .toLowerCase()
        .includes(statusFilter.toLowerCase());
    if (isSuperAdmin) {
      return matchesSearch && matchesOrgName && matchesStatus;
    }
    if (isAdmin) {
      return (
        item.id === String(reduxUser.organization) &&
        matchesSearch &&
        matchesOrgName &&
        matchesStatus
      );
    }
    return false;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-200 text-green-800 hover:bg-green-200";
      case "Inactive":
        return "bg-red-200 text-red-800 hover:bg-red-200";
      case "Pending":
        return "bg-yellow-200 text-yellow-800 hover:bg-yellow-200";
      default:
        return "bg-gray-500";
    }
  };

  // Reset edit loader if organizations change (e.g., after navigation)
  useEffect(() => {
    setEditLoadingId(null);
  }, [organizations]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search organizations..."
            className="w-full sm:w-[250px] pl-8"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {isSuperAdmin && (
          <Button onClick={() => router.push("/admin/organizations/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Organization
          </Button>
        )}
      </div>
      <div className="w-full rounded-md border border-b border-gray-300 shadow-md overflow-y-auto max-h-[280px]">
        <table className="w-full table-auto text-xs">
          <TableHeader className="sticky top-0 bg-white z-30">
            <TableRow className="bg-gray-50 border-b border-blue-100 ">
              {/* <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedRows.length === filteredorganization.length && filteredorganization.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead> */}
              <TableHead className="sticky top-0 bg-white z-30 pl-10 w-1/5">
                Organization Name
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30 pl-10 w-1/5">
                Created On
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30 pl-10 w-1/5">
                Admin Count
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30 pl-10 w-1/5">
                Status
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30 pl-10 w-1/5">
                Actions
              </TableHead>
            </TableRow>
            {/* Filter row */}
            <TableRow className="bg-gray-50 border-b border-blue-100 ">
              <TableCell className="pl-10 py-2">
                <Input
                  placeholder="Organization Name"
                  value={orgNameFilter}
                  onChange={(e) => setOrgNameFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="pl-10 py-2">
                <Input
                  placeholder="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell className="pl-10 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs px-2 py-1 bg-white hover:bg-sky-100 border border-sky-200"
                  onClick={() => {
                    setOrgNameFilter("");
                    setStatusFilter("");
                  }}
                >
                  Clear
                </Button>
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredorganization.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {loading && fetchOrgs ? (
                    <>
                      <div className="relative flex justify-center items-center">
                        <GlobalLoader />
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No Records Found
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredorganization.map((org) => (
                <TableRow key={org.id}>
                  {/* <TableCell>
                  <Checkbox
                    checked={selectedRows.includes(org.id)}
                    onCheckedChange={() => toggleRow(org.id)}
                    aria-label={`Select row ${org.id}`}
                  />
                </TableCell> */}
                  <TableCell
                    className="font-medium pl-10 cursor-pointer"
                    onClick={() => handleOrgClick(org)}
                  >
                    {org.organization_name}
                  </TableCell>
                  <TableCell>{org.created_date}</TableCell>
                  <TableCell>{org.admin_count}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${getStatusColor(
                        org.organization_status
                      )} text`}
                    >
                      {org.organization_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            router.push(`/admin/organizations/${org.id}/edit`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            router.push(`/admin/organizations/${org.id}/admins`)
                          }
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Manage Admins
                        </DropdownMenuItem>
                        {(isSuperAdmin || isAdmin) && (
                          <DropdownMenuItem
                            onSelect={() =>
                              router.push(
                                `/admin/organizations/${org.id}/leaders`
                              )
                            }
                          >
                            <MapPinned className="mr-2 h-4 w-4" />
                            Manage Location leaders
                          </DropdownMenuItem>
                        )}
                        {org.organization_status === "Active" ? (
                          <DropdownMenuItem
                            onSelect={() => {
                              setPendingDeleteId(org.id);
                              setShowModal(true);
                              setCheckValue("Deactivate");
                            }}
                          >
                            <PowerOff className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => {
                              setPendingDeleteId(org.id);
                              setShowModal(true);
                              setCheckValue("Activate");
                            }}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
      <ConfirmModalBox
        isOpen={checkvalue === "Deactivate" && showModal}
        title="Deactivate Organization"
        description={
          "Are you sure you want to deactivate this organization? \n Deactivating this organization will prevent users from accessing it. All data will be preserved."
        }
        variant="deactivate"
        button={checkvalue}
        onClose={() => {
          setShowModal(false);
          setPendingDeleteId(null);
          setCheckValue("");
        }}
        onConfirm={() => {
          if (pendingDeleteId) {
            archiveOrganizations([pendingDeleteId]);
          }
        }}
      />
      <ConfirmModalBox
        isOpen={checkvalue === "Activate" && showModal}
        title="Activate Organization"
        description={
          "Are you sure you want to activate this organization? \n Activating this organization will restore access for all associated users."
        }
        variant="default"
        button={checkvalue}
        onClose={() => {
          setShowModal(false);
          setPendingDeleteId(null);
          setCheckValue("");
        }}
        onConfirm={() => {
          setPendingDeleteId(null);
          setShowModal(false);
          // TODO: Activate organization logic (e.g., PATCH /organization/{id}/activate)
          fetchOrganizations(); // HIGHLIGHT: Refresh
        }}
      />
      {loading && viewPop && (
        <>
          <div className="flex justify-center items-center">
            <GlobalLoader />
          </div>
        </>
      )}
      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          {/* Modal container with rounded corners */}
          <div className="relative bg-white rounded-2xl shadow-lg w-[800px] overflow-hidden">
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <h2 className="text-lg font-semibold mb-2">
                {viewOrgData?.organization_name} Details
              </h2>
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowPopup(false);
                  setSelectedOrg(null);
                }}
              >
                ✕
              </button>
              <div className="mb-5">
                <label className="bold block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <span className="font-semibold text-gray-900">
                    {viewOrgData?.organization_name || "—"}
                  </span>
                </div>
              </div>
              <div className="mb-5">
                <label className="bold block text-sm font-medium text-gray-700 mb-1">
                  Organization Description
                </label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <span className="font-semibold text-gray-900">
                    {viewOrgData?.organization_description || "—"}
                  </span>
                </div>
              </div>
              <div className="mb-5">
                <label className="bold block text-sm font-medium text-gray-700 mb-1">
                  Dashboard Access
                </label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <span className="font-semibold text-gray-900">
                    {viewOrgData?.dashboard_access?.toString() || "false"}
                  </span>
                </div>
              </div>
              <div className="mb-5">
                <label className="bold block text-sm font-medium text-gray-700 mb-1">
                  Organization Users
                </label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <Card>
                    <CardContent className="p-4">
                      <div className="rounded-md border overflow-y-auto">
                        <table className="w-full">
                          <TableHeader className="sticky top-0 bg-white z-30">
                            <TableRow>
                              <TableHead className="sticky top-0 bg-white z-30">
                                Name
                              </TableHead>
                              <TableHead className="sticky top-0 bg-white z-30">
                                Email
                              </TableHead>
                              <TableHead className="sticky top-0 bg-white z-30">
                                Role
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {viewOrgData?.admins.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center text-muted-foreground"
                                >
                                  No admins selected
                                </TableCell>
                              </TableRow>
                            ) : (
                              viewOrgData?.admins.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell>
                                    {user.user.first_name} {user.user.last_name}
                                  </TableCell>
                                  <TableCell>{user.user.email}</TableCell>
                                  <TableCell>
                                    {user.user.role_details.description}
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
              <div className="mb-5">
                <label className="bold block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <span className="font-semibold text-gray-900">
                    {selectedOrg?.organization_status || "—"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPopup(false);
                  setSelectedOrg(null);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
