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
import { FaMobileAlt } from "react-icons/fa";

import {
  MoreHorizontal,
  Edit,
  Trash,
  KeyRound,
  UserPlus,
  Upload,
  RefreshCw,
  Mail,
  Search,
  Filter,
  Loader,
  User,
  Phone,
  Monitor,
  Archive,
} from "lucide-react";
import { useUser } from "@/components/user-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import ConfirmModalBox from "../ui/confirm-modalbox";
import axiosInstance from "@/utils/axiosInstance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import GlobalLoader from "../ui/globalloader";
import hotToaster from "react-hot-toast";

interface User {
  id: string;
  status: "Active" | "Inactive";
  // is_active: boolean
  first_name: string;
  last_name: string;
  countryCode: string;
  phone: string;
  designation: string;
  location: string;
  division: string;
  department: string;
  email: string | null;
  dashboard_access: boolean;
  mobile_supervisor: boolean;
  organization: string | number;
  disable: boolean;
  organization_name: string;
}

function ManualAutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Show all suggestions if input is focused and input is empty, else filter
  const filtered = suggestions.filter(
    (s) =>
      s &&
      (inputValue.trim() === "" ||
        s.toLowerCase().includes(inputValue.toLowerCase()))
  );

  return (
    <div className="relative">
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 120)}
      />
      {show && filtered.length > 0 && (
        <div className="absolute z-30 bg-white border border-gray-200 rounded shadow w-full max-h-40 ">
          {filtered.map((s, i) => (
            <div
              key={i}
              className="px-2 py-1 cursor-pointer hover:bg-blue-100 text-xs"
              onMouseDown={() => {
                setInputValue(s);
                onChange(s);
                setShow(false);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserManagement({ canEdit = false }: { canEdit?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredusers, setFilteredUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [checkvalue, setCheckValue] = useState("");
  const [isMuultipleDeleteModalOpen, setIsMultipleDeleteModalOpen] =
    useState(false);
  const userinfo = useSelector(selectUser);
  const currentuserrole = userinfo?.role_details?.name === "admin";
  const userEmail = userinfo?.email;

  // Temporary filters used in the dropdowns
  const [tempStatusFilter, setTempStatusFilter] = useState("all");
  const [tempDepartmentFilter, setTempDepartmentFilter] = useState("all");
  const [tempLocationFilter, setTempLocationFilter] = useState("all");

  const [searchTerm, setSearchTerm] = useState("");
  // Actual filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  // Add per-column filter states
  const [firstNameFilter, setFirstNameFilter] = useState("");
  const [lastNameFilter, setLastNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");

  const isSuperAdmin = userinfo?.role === "Super Admin";

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredusers.map((user) => user.id);
      setSelectedRows(allIds);
    } else {
      setSelectedRows([]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Get token from localStorage or your auth provider
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No access token found. Please login.");
        hotToaster.error("Unauthorized\nYou are not logged in. Please login to continue."
        );
        return;
      }
      const res = await axiosInstance.get("/users/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const users: User[] = res.data.map((user: any) => ({
        id: String(user.id),
        status: user.status,
        first_name: user.first_name,
        last_name: user.last_name,
        countryCode: user.country_code,
        phone: user.phone,
        designation: user.designation || "",
        location: user.location || "",
        division: user.division || "",
        department: user.department || "",
        email: user.email,
        dashboard_access: user.dashboard_access,
        mobile_supervisor: user.mobile_supervisor ?? false,
        organization: user.organization,
        organization_name: user.organization_name || "",
        disable: user.disable || false,
      }));
      setAllUsers(users);

      if (userinfo.role_details.name === "super_admin") {
        // Super admin should NOT see null organization users in the table
        const filtered = users.filter(
          (user) => user.organization !== null && user.organization !== undefined
        );
        setFilteredUsers(filtered);
      } else if (userinfo.role_details.name === "admin") {
        const filtered = users.filter(
          (user) => user.organization === userinfo.organization
        );
        setFilteredUsers(filtered);
      } else {
        setFilteredUsers([]);
      }
    } catch (err) {
      hotToaster.error("Failed to fetch users.\n Your session may have expired. Please login again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedRows(
      selectedRows.length === filteredusers.length
        ? []
        : filteredusers.map((user) => user.id)
    );
  };

  const handleResetPassword = (userId: string) => {
    toast({
      title: "Password Reset Email Sent",
      description: "A password reset link has been sent to the user's email.",
    });
  };

  const handleArchiveUser = async (userId: string) => {
    try {
      await axiosInstance.post(`/users/archive/${userId}?re-activate=false`);
      setPendingDeleteId(null);
      setCheckValue("");
      setShowModal(false);
      hotToaster.success("User Archived Successfully", { duration: 2000 });
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to archive user", error);
      const rawError = error?.response?.data;
      let msg = "Failed to archive user";
      if (rawError && typeof rawError === 'object' && !rawError.error && !rawError.detail) {
        const msgs: string[] = [];
        for (const [field, errors] of Object.entries(rawError)) {
          if (Array.isArray(errors)) msgs.push(...errors.map((e: any) => `${field}: ${e}`));
          else if (typeof errors === 'string') msgs.push(`${field}: ${errors}`);
        }
        if (msgs.length > 0) msg = msgs.join("; ");
      } else if (rawError?.error) msg = rawError.error;
      else if (rawError?.detail) msg = rawError.detail;
      hotToaster.error(msg, { duration: 2000 });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await axiosInstance.delete(`/users/${userId}`);

      setPendingDeleteId(null);
      setFilteredUsers((prev) =>
        prev.filter((filtered) => !selectedRows.includes(filtered.id))
      );
      setAllUsers(allUsers.filter((f) => f.id !== userId));
      hotToaster.success("User Deleted Successfully");
    } catch (error) {
      console.error("Failed to delete user", error);
      hotToaster.error("Can't delete the User");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) {
      hotToaster.custom("No rows selected\nPlease select at least one item to delete.");
      return; // Exit early if no rows are selected
    }

    const payload = {
      ids: selectedRows,
      commit: false,
    };

    try {
      await axiosInstance.post(`/bulk/delete/user`, payload);
      hotToaster.success("Users Deleted Successfully");

      setSelectedRows([]);
      fetchUsers();
      setAllUsers((prev) =>
        prev.filter((users) => !selectedRows.includes(users.id))
      );
      setFilteredUsers((prev) =>
        prev.filter((filtered) => !selectedRows.includes(filtered.id))
      );
    } catch (error: any) {
      hotToaster.error(
        "Failed to Delete Users \n" + error?.response?.data?.message ||
          "An unexpected error occurred"
      );
    }
  };

  const handleEmailReport = async () => {
    if (!userEmail) {
      hotToaster.error("Email Not Found\nUnable to find your email address in local storage."
      );
      return;
    }

    try {
      await axiosInstance
        .get(`/users/emailcsv?email=${userEmail}`)
        .then((response) => {
          hotToaster.success(
            `Report Sent\nThe Excel report has been sent to ${userEmail}.`
          );
        })
        .catch((error) => {
          console.error("Error sending email report:", error);
        });
    } catch (error: any) {
      hotToaster.error(`Failed to Send Report \n` + error?.response?.data?.message || "An unexpected error occurred.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-200 text-green-800 hover:bg-green-200";
      case "Inactive":
        return "bg-red-200 text-red-800 hover:bg-red-200";
      default:
        return "bg-gray-500";
    }
  };

  const normalize = (str: string): string =>
    str.toLowerCase().replace(/-/g, "").trim();
  useEffect(() => {
    const result = allUsers.filter((item) => {
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();

      const matchesSearch =
        normalizedSearchTerm === "" ||
        item.first_name.toLowerCase().includes(normalizedSearchTerm) ||
        item.last_name.toLowerCase().includes(normalizedSearchTerm) ||
        item.department.toLowerCase().includes(normalizedSearchTerm) ||
        item.division.toLowerCase().includes(normalizedSearchTerm) ||
        item.location.toLowerCase().includes(normalizedSearchTerm) ||
        item.organization_name.toLowerCase().includes(normalizedSearchTerm);

      const matchesDepartment =
        departmentFilter === "all" ||
        departmentFilter.trim() === "" ||
        (item.department &&
          item.department
            .toLowerCase()
            .includes(departmentFilter.toLowerCase()));

      const matchesLocation =
        locationFilter === "all" ||
        locationFilter.trim() === "" ||
        (item.location &&
          item.location.toLowerCase().includes(locationFilter.toLowerCase()));

      // Per-column filters
      const matchesFirstName =
        firstNameFilter.trim() === "" ||
        item.first_name.toLowerCase().includes(firstNameFilter.toLowerCase());
      const matchesLastName =
        lastNameFilter.trim() === "" ||
        item.last_name.toLowerCase().includes(lastNameFilter.toLowerCase());
      const matchesPhone =
        phoneFilter.trim() === "" ||
        (item.countryCode + item.phone)
          .toLowerCase()
          .includes(phoneFilter.toLowerCase());
      const matchesDesignation =
        designationFilter.trim() === "" ||
        item.designation.toLowerCase().includes(designationFilter.toLowerCase());
      const matchesDivision =
        divisionFilter.trim() === "" ||
        (item.division &&
          item.division.toLowerCase().includes(divisionFilter.toLowerCase()));
      const matchesOrganization =
        organizationFilter.trim() === "" ||
        item.organization_name.toLowerCase().includes(organizationFilter.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        statusFilter.trim() === "" ||
        item.status.toLowerCase().includes(statusFilter.toLowerCase());

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesLocation &&
        matchesFirstName &&
        matchesLastName &&
        matchesPhone &&
        matchesDesignation &&
        matchesDivision &&
        matchesOrganization &&
        matchesStatus
      );
    });

    setFilteredUsers(result);
  }, [
    searchTerm,
    departmentFilter,
    locationFilter,
    statusFilter,
    firstNameFilter,
    lastNameFilter,
    phoneFilter,
    designationFilter,
    divisionFilter,
    organizationFilter,
  ]);

  // Place these after filteredusers is defined and always use allUsers for options
  const locationOptions = Array.from(
    new Set(allUsers.map((user) => user.location).filter(Boolean))
  );
  const divisionOptions = Array.from(
    new Set(allUsers.map((user) => user.division).filter(Boolean))
  );
  const departmentOptions = Array.from(
    new Set(allUsers.map((user) => user.department).filter(Boolean))
  );
  const statusOptions = Array.from(
    new Set(allUsers.map((user) => user.status).filter(Boolean))
  );
  const organization_name = Array.from(
    new Set(allUsers.map((user) => user.organization_name).filter(Boolean))
  );
  const firstNameOptions = Array.from(
    new Set(allUsers.map((user) => user.first_name).filter(Boolean))
  );
  const lastNameOptions = Array.from(
    new Set(allUsers.map((user) => user.last_name).filter(Boolean))
  );
  const phoneOptions = Array.from(
    new Set(allUsers.map((user) => `${user.countryCode} ${user.phone}`).filter(Boolean))
  );
  const designationOptions = Array.from(
    new Set(allUsers.map((user) => user.designation).filter(Boolean))
  );

  if (!userinfo) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full sm:w-[250px] pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <DropdownMenu>
            {/* <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger> */}
            <DropdownMenuContent align="end" className="w-[200px]">
              <div className="p-2">
                {/* <div className="mb-2">
                  <Label htmlFor="filter-department">Department</Label>
                  <Select
                    value={tempDepartmentFilter}
                    onValueChange={setTempDepartmentFilter}
                  >
                    <SelectTrigger id="filter-department">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="Logistics">Logistics</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Shipping">Shipping</SelectItem>
                      <SelectItem value="Management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}

                <div className="mb-2">
                  <Label htmlFor="filter-location">Location</Label>
                  <Select
                    value={tempLocationFilter}
                    onValueChange={setTempLocationFilter}
                  >
                    <SelectTrigger id="filter-location">
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    {/* <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="Warehouse A">Warehouse A</SelectItem>
                      <SelectItem value="Warehouse B">Warehouse B</SelectItem>
                      <SelectItem value="Office Building">
                        Office Building
                      </SelectItem>
                    </SelectContent> */}
                  </Select>
                </div>
                <div className="mb-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={tempStatusFilter}
                    onValueChange={setTempStatusFilter}
                  >
                    <SelectTrigger id="filter-status">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full mt-2"
                  onClick={() => {
                    setDepartmentFilter(tempDepartmentFilter);
                    setLocationFilter(tempLocationFilter);
                    setStatusFilter(tempStatusFilter);
                  }}
                >
                  Apply Filters
                </Button>
                <Button
                  className="w-full mt-2 h-6 bg-red-500 text-white hover:bg-red-400"
                  onClick={() => {
                    setDepartmentFilter("all");
                    setLocationFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Remove
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex flex-col sm:flex-row gap-2 min-w-[150px]">
            {currentuserrole && canEdit && (
              <Button
                className="min-w-[150px]"
                onClick={() => router.push("/admin/users/new")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            )}
            {currentuserrole && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin/users/bulk-import")}
              >
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import users
              </Button>
            )}
            {/* <Button variant="outline" size="sm" onClick={() => { setShowModal(true); setCheckValue("Email") }} >
              <Mail className="mr-2 h-4 w-4" />
              Email CSV
            </Button> */}
            {/* <Button
              className="min-w-[126px]"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowModal(true);
                setCheckValue("Sync All");
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync
            </Button> */}

            {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="min-w-[126px] h-9" variant="outline">
                  Bulk Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsMultipleDeleteModalOpen(true)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-y-auto max-h-[500px] overflow-x-auto border-b border-gray-300 shadow-md">
        <table className="w-full text-xs">
          <TableHeader className="sticky top-0 bg-white z-30">
            <TableRow className="pl-10 bg-blue-50">
              <TableHead className="sticky top-0 bg-white z-30 pl-10">
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === filteredusers.length &&
                    filteredusers.length > 0
                  }
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Access
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30 pl-10">
                First Name
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Last Name
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Organization Name
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Phone
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Designation
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Location
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Division
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Department
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Status
              </TableHead>
              <TableHead className="sticky top-0 bg-white z-30">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-gray-50 border-b border-blue-100">
              <TableCell />
              <TableCell className="pl-10 py-2"></TableCell>
              <TableCell className="pl-10 py-2">
                <Input
                  placeholder="First Name"
                  value={firstNameFilter}
                  onChange={(e) => setFirstNameFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Last Name"
                  value={lastNameFilter}
                  onChange={(e) => setLastNameFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Organization Name"
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Phone"
                  value={phoneFilter}
                  onChange={(e) => setPhoneFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Designation"
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Location"
                  value={locationFilter === "all" ? "" : locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value || "all")}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Division"
                  value={divisionFilter === "all" ? "" : divisionFilter}
                  onChange={(e) => setDivisionFilter(e.target.value || "all")}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Department"
                  value={departmentFilter === "all" ? "" : departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value || "all")}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Status"
                  value={statusFilter === "all" ? "" : statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value || "all")}
                  className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                />
              </TableCell>
              <TableCell className="text-right pr-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs px-4 mr-11 py-1 bg-white border-blue-600 hover:bg-gray-200 border focus:border-sky-100"
                  onClick={() => {
                    setFirstNameFilter("");
                    setLastNameFilter("");
                    setPhoneFilter("");
                    setDesignationFilter("");
                    setLocationFilter("all");
                    setDivisionFilter("");
                    setDepartmentFilter("all");
                    setStatusFilter("all");
                    setOrganizationFilter("");
                  }}
                >
                  Clear
                </Button>
              </TableCell>
            </TableRow>
            {filteredusers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8">
                  {loading ? (
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
              filteredusers.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.disable ? "line-through text-gray-500" : ""}
                  onClick={(e) => {
                    if (!e.defaultPrevented) {
                      router.push(`/admin/users/${user.id}/edit?mode=View`);
                    }
                  }}
                >
                  <TableCell className="pl-10">
                    <input
                      type="checkbox"
                      onClick={(e) => e.stopPropagation()}
                      checked={selectedRows.includes(user.id)}
                      onChange={() => toggleRow(user.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 cursor-pointer">
                      {user.dashboard_access && <Monitor className="w-4 h-4" />}
                      {user.mobile_supervisor && (
                        <FaMobileAlt className="w-4 h-4" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium cursor-pointer">
                    {user.first_name}
                  </TableCell>
                  <TableCell>{user.last_name}</TableCell>
                  <TableCell>{user.organization_name}</TableCell>
                  <TableCell>
                    {user.countryCode} {user.phone}
                  </TableCell>
                  <TableCell className="cursor-pointer">
                    {user.designation}
                  </TableCell>
                  <TableCell className="cursor-pointer">
                    {user.location}
                  </TableCell>
                  <TableCell className="cursor-pointer">
                    {user.division}
                  </TableCell>
                  <TableCell className="cursor-pointer">
                    {user.department}
                  </TableCell>
                  <TableCell className="cursor-pointer">
                    <Badge
                      className={getStatusColor(
                        user.disable ? "Inactive" : user.status
                      )}
                    >
                      {user.disable ? "Inactive" : user.status}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <>
                          <Button
                            variant="outline"
                            className="flex items-center gap-2 text-xs px-2 py-1 h-9 pr-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(user.id);
                              setCheckValue("Archive");
                              setShowModal(true);
                            }}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex items-center gap-2 text-xs px-2 py-1 h-9 pr-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(user.id);
                              setCheckValue("Delete");
                              setShowModal(true);
                            }}
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">View only</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      <div>
        {/* Delete Confirmation Modal */}
        <Dialog
          open={isMuultipleDeleteModalOpen}
          onOpenChange={setIsMultipleDeleteModalOpen}
        >
          <DialogContent className="sm:max-w-[1200px] h-[600px] flex flex-col overflow-y-auto ">
            <DialogHeader className="flex-shrink-0 ">
              <DialogTitle>Delete Selected Users</DialogTitle>
            </DialogHeader>
            <div className="relative ">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground " />
              <Input
                type="search"
                placeholder="Search users..."
                className="w-full sm:w-[250px] pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="w-full rounded-md border border-b border-gray-300 shadow-md overflow-y-auto max-h-[360px]">
              <table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedRows.length === filteredusers.length &&
                          filteredusers.length > 0
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="">Access</TableHead>
                    <TableHead className="">First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Organization Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                  {/* Filter row for modal table */}
                  <TableRow className="bg-gray-50 border-b border-blue-100">
                    <TableCell />
                    <TableCell className="py-2"></TableCell>
                    <TableCell>
                      <Input
                        placeholder="First Name"
                        value={firstNameFilter}
                        onChange={(e) => setFirstNameFilter(e.target.value)}
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Last Name"
                        value={lastNameFilter}
                        onChange={(e) => setLastNameFilter(e.target.value)}
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Organization Name"
                        value={organizationFilter}
                        onChange={(e) => setOrganizationFilter(e.target.value)}
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Phone"
                        value={phoneFilter}
                        onChange={(e) => setPhoneFilter(e.target.value)}
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Designation"
                        value={designationFilter}
                        onChange={(e) => setDesignationFilter(e.target.value)}
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Location"
                        value={locationFilter === "all" ? "" : locationFilter}
                        onChange={(e) =>
                          setLocationFilter(e.target.value || "all")
                        }
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Division"
                        value={
                          divisionFilter === "all" ? "All" : divisionFilter
                        }
                        onChange={(e) =>
                          setDivisionFilter(e.target.value || "all")
                        }
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Department"
                        value={
                          departmentFilter === "all" ? "" : departmentFilter
                        }
                        onChange={(e) =>
                          setDepartmentFilter(e.target.value || "all")
                        }
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Status"
                        value={statusFilter === "all" ? "" : statusFilter}
                        onChange={(e) =>
                          setStatusFilter(e.target.value || "all")
                        }
                        className="h-8 text-xs md:text-xs bg-white border border-gray-200 focus:border-blue-400"
                      />
                    </TableCell>
                    <TableCell className="text-right pr-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 py-1"
                        onClick={() => {
                          setFirstNameFilter("");
                          setLastNameFilter("");
                          setPhoneFilter("");
                          setDesignationFilter("");
                          setLocationFilter("all");
                          setDivisionFilter("");
                          setDepartmentFilter("all");
                          setStatusFilter("all");
                          setOrganizationFilter("");
                        }}
                      >
                        Clear
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredusers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(user.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleRow(user.id)}
                        />
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        {user.dashboard_access && (
                          <Monitor className="w-4 h-4" />
                        )}
                        {user.mobile_supervisor && (
                          <FaMobileAlt className="w-4 h-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.first_name}
                      </TableCell>
                      <TableCell>{user.last_name}</TableCell>
                      <TableCell>{user.organization_name}</TableCell>
                      <TableCell>
                        {user.countryCode} {user.phone}
                      </TableCell>
                      <TableCell>{user.designation}</TableCell>
                      <TableCell>{user.location}</TableCell>
                      <TableCell>{user.division}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(user.status)}>
                          {" "}
                          {user.status}
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
                            {canEdit && (
                              <>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    router.push(`/admin/users/${user.id}/edit`)
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setPendingDeleteId(user.id);
                                    setCheckValue("Delete");
                                    setShowModal(true);
                                  }}
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>

            <DialogFooter className="flex-shrink-0 mt-4">
              <Button
                variant="outline"
                onClick={() => setIsMultipleDeleteModalOpen(false)}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={() => {
                  setShowModal(true);
                  setCheckValue("DeleteMultiple");
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <ConfirmModalBox
          isOpen={checkvalue === "Archive" && showModal}
          title="Archive User"
          description="This will archive the user and make them unavailable. You can restore them later from Super Admin Features."
          variant="deactivate"
          button="Archive"
          onClose={() => {
            setShowModal(false);
            setPendingDeleteId(null);
            setCheckValue("");
          }}
          onConfirm={() => {
            if (pendingDeleteId) {
              handleArchiveUser(pendingDeleteId);
            }
          }}
        />

        <ConfirmModalBox
          isOpen={checkvalue === "Delete" && showModal}
          title="Delete User"
          description={`Are you sure you want to delete ? This action cannot be undone and will remove all data associated with this user.`}
          variant="delete"
          button={checkvalue}
          onClose={() => {
            setShowModal(false);
            setCheckValue("");
          }}
          onConfirm={() => {
            if (pendingDeleteId) {
              handleDeleteUser(pendingDeleteId);
              setShowModal(false);
              setCheckValue("");
            }
          }}
        />

        <ConfirmModalBox
          isOpen={checkvalue === "Email" && showModal}
          title="Send Report via Email"
          description="An Excel file will be generated and automatically sent to your registered email address. Do you want to proceed?"
          variant="info"
          button="Send Report"
          onClose={() => {
            // setPendingDeleteId(null)
            setShowModal(false);
            setCheckValue("");
            // window.location.reload();
          }}
          onConfirm={() => {
            handleEmailReport();
            setShowModal(false);
            setCheckValue("");
          }}
        />

        <ConfirmModalBox
          isOpen={checkvalue === "Reset Password" && showModal}
          title="Reset Password"
          description={`Are you sure you want to reset the password ? A password reset link will be sent to their email address.`}
          variant="default"
          button={checkvalue}
          onClose={() => {
            setShowModal(false);
            setPendingDeleteId(null);
            // window.location.reload();
            setCheckValue("");
          }}
          onConfirm={() => {
            if (pendingDeleteId) {
              // handleDeleteUser(pendingDeleteId)
            }
          }}
        />

        <ConfirmModalBox
          isOpen={checkvalue === "Sync All" && showModal}
          title="Sync Integration"
          description={`This will initiate a manual sync with the external service. This may take a few minutes.`}
          variant="default"
          button="Sync Now"
          onClose={() => {
            // setPendingDeleteId(null)
            setShowModal(false);
            setCheckValue("");
            // window.location.reload();
          }}
          onConfirm={() => {
            // if (pendingDeleteId) {
            // handleDeleteUser(pendingDeleteId)
            // setPendingDeleteId(null)
            setShowModal(false);
            setCheckValue("");
            // }
          }}
        />
      </div>
    </div>
  );
}
//           button={checkvalue}
//           onClose={() => {
//             // setPendingDeleteId(null)
//             setShowModal(false);
//             setCheckValue("");
//             // window.location.reload();
//           }}
//           onConfirm={() => {
//             if (pendingDeleteId) {
//               handleDeleteUser(pendingDeleteId)
//               // setPendingDeleteId(null)
//               setShowModal(false);
//               setCheckValue("");
//             }
//           }}
//         />

//         <ConfirmModalBox
//           isOpen={checkvalue === "Email" && showModal}
//           title="Send Report via Email"
//           description="An Excel file will be generated and automatically sent to your registered email address. Do you want to proceed?"
//           variant="info"
//           button="Send Report"
//           onClose={() => {
//             // setPendingDeleteId(null)
//             setShowModal(false)
//             setCheckValue("");
//             // window.location.reload();
//           }}
//           onConfirm={() => {
//             handleEmailReport()
//             setShowModal(false);
//             setCheckValue("");

//           }}
//         />

//         <ConfirmModalBox
//           isOpen={checkvalue === "Reset Password" && showModal}
//           title="Reset Password"
//           description={`Are you sure you want to reset the password ? A password reset link will be sent to their email address.`}
//           variant="default"
//           button={checkvalue}
//           onClose={() => {
//             setShowModal(false);
//             setPendingDeleteId(null);
//             // window.location.reload();
//             setCheckValue("");
//           }}
//           onConfirm={() => {
//             if (pendingDeleteId) {
//               // handleDeleteUser(pendingDeleteId)
//             }
//           }}
//         />

//         <ConfirmModalBox
//           isOpen={checkvalue === "Sync All" && showModal}
//           title="Sync Integration"
//           description={`This will initiate a manual sync with the external service. This may take a few minutes.`}
//           variant="default"
//           button="Sync Now"
//           onClose={() => {
//             // setPendingDeleteId(null)
//             setShowModal(false);
//             setCheckValue("");
//             // window.location.reload();
//           }}
//           onConfirm={() => {
//             // if (pendingDeleteId) {
//             // handleDeleteUser(pendingDeleteId)
//             // setPendingDeleteId(null)
//             setShowModal(false);
//             setCheckValue("");
//             // }
//           }}
//         />
//       </div>
//     </div>
//   );
// }
// }
//     </div>
//   );
// }
