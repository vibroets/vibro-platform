"use client";
import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog as AlertDialog,
  DialogContent as AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
} from "@/components/ui/dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import { Info, Trash2, User } from "lucide-react";
import { userInfo } from "os";
import { disableGlobalCursorStyles } from "react-resizable-panels";
import { customList } from "country-codes-list";
import hotToaster from "react-hot-toast";
import Papa from 'papaparse';
import { ro } from "date-fns/locale";
import GlobalLoader from "../ui/globalloader";
import { organizationFormStore } from "@/utils/organizationFormStore";
// import PhoneInput, {
//   isValidPhoneNumber,
//   parsePhoneNumber,
// } from "react-phone-number-input";
// import "react-phone-number-input/style.css";

const countryCodeOptions = Object.entries(
  customList("countryCallingCode", "{countryNameEn}: +{countryCallingCode}")
).map(([code, name]) => ({
  value: `+${code}`,
  label: `${name}`,
}));

// --- Helper: make datalist include current value if missing ---
interface SelectOption {
  id: string;
  name: string;
  description: string;
  field?: string;
}
function addCurrentToOptions(options: SelectOption[] | undefined, current: string): SelectOption[] {
  const opts = options || [];
  if (!current) return opts;
  return opts.some((opt) => opt.name === current)
    ? opts
    : [{ id: "current", name: current, description: "" }, ...opts];
}

// --- Form Schema ---
const formSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    employeeId: z.string().min(1, "Employee ID is required"),
    countryCode: z.string().min(1, "Country code is required"),
    phone: z.string().min(1, "Phone number is required"),
    designation: z.string().min(1, "Designation is required"),
    division: z.string().min(1, "Division is required"),
    subdivision: z.string().optional(),
    location: z.string().min(1, "Location is required"),
    department: z.string().min(1, "Department is required"),
    email: z.string().email().min(1, "email is required").or(z.literal("")),
    dashboardAccess: z.boolean(),
    mobileSupervisor: z.boolean(),
    organization: z.string().optional(),
    disable: z.boolean().optional(),
    module_access_list: z
      .array(
        z.object({
          module: z.string(),
          access: z.enum(["full_access", "view_only", "no_access"]),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.dashboardAccess && (!data.email || data.email.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "Email is required when dashboard access is enabled",
      path: ["email"],
    }
  )
  .refine(
    (data) => {
      if (data.dashboardAccess) {
        if (!Array.isArray(data.module_access_list)) {
          return false;
        }
        return data.module_access_list.some((m) => m.access !== "no_access");
      }
      return true;
    },
    {
      message:
        "At least one module must have access (not 'no_access') when dashboard access is enabled",
      path: ["module_access_list"],
    }
  );
// )
// .refine((data) => isValidPhoneNumber(data.phone), {
//   message: "Invalid phone number for the selected country",
//   path: ["phone"],
// });

type FormValues = z.infer<typeof formSchema>;

type ModuleAccess = {
  module: string;
  access: "full_access" | "view_only" | "no_access";
};

const MODULE_TEMPLATE: ModuleAccess[] = [
  { module: "dashboard", access: "no_access" },
  { module: "announcements", access: "no_access" },
  { module: "forms", access: "no_access" },
  { module: "tasks", access: "no_access" },
  { module: "polls", access: "no_access" },
  { module: "learning_training", access: "no_access" },
  { module: "planner", access: "no_access" },
  { module: "attendance", access: "no_access" },
];
// --- Main Component ---
interface SingleUserFormProps {
  handleSuperAdminBack?: () => Promise<void>;
  isSuperAdmin?: boolean;
  orgId?: string | null;
  isLoading?: boolean;
  mode?: string | null;
}

export function SingleUserForm({
  handleSuperAdminBack,
  isSuperAdmin,
  orgId,
  isLoading,
  mode
}: SingleUserFormProps) {
  console.log("🚀 SingleUserForm component mounted/updated");
  const searchParams = useSearchParams();
  const currentMode = searchParams.get("mode"); // "View"
  const isOrganizationEditMode = currentMode?.toLowerCase() === "edit";
  const currentOrgId = searchParams.get("orgId");
  const hasOrgId = currentOrgId !== null;
  const pathname = usePathname();
  const isOrganizationPage = pathname.includes("/admin/organizations/");
  console.log("orgId via org create>>", currentOrgId + "value : ", hasOrgId);
  console.log("mode mode >>", currentMode);
  console.log("pathname >>", pathname);
  console.log("isOrganizationPage >>", isOrganizationPage);
  const router = useRouter();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const userId = params.id as string;
  const userinfo = useSelector(selectUser);
  console.log("userinfo", userinfo);
  const currentuserrole = userinfo?.role_details.name === "admin";
  console.log("currentuserrole", currentuserrole);
  // Determine isSuperAdmin from userinfo if not provided as prop
  const computedIsSuperAdmin = isSuperAdmin !== undefined ? isSuperAdmin : (userinfo?.role_details?.name === "super_admin");
  const [loading, setLoading] = useState(false);

  const [subdivisionOptions, setSubdivisionOptions] = useState<SelectOption[]>(
    []
  );
  const [divisionOptions, setDivisionOptions] = useState<SelectOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>(
    []
  );
  const [locationOptions, setLocationOptions] = useState<SelectOption[]>([]);
  const [designationOptions, setDesignationOptions] = useState<SelectOption[]>(
    []
  );
  const [openDropdown, setOpenDropdown] = useState<
    | "departments"
    | "subdivisions"
    | "designation"
    | "division"
    | "location"
    | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentField, setCurrentField] = useState<string>("");
  const [dialogValue, setDialogValue] = useState("");
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteOption, setDeleteOption] = useState<SelectOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  // Bulk import state
  const [bulkImportMode, setBulkImportMode] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImportProcessing, setBulkImportProcessing] = useState(false);
  const [bulkImportData, setBulkImportData] = useState<{ name: string; description: string }[]>([]);
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
  const [bulkImportDuplicates, setBulkImportDuplicates] = useState<{ name: string; description: string }[]>([]);
  const [bulkImportConfirmDialog, setBulkImportConfirmDialog] = useState(false);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [moduleListInitialized, setModuleListInitialized] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeId: "",
      countryCode: "+1",
      phone: "",
      designation: "",
      division: "",
      subdivision: "",
      location: "",
      department: "",
      email: "",
      dashboardAccess: false,
      organization: "",
      mobileSupervisor: true,
      disable: false,
      module_access_list: MODULE_TEMPLATE.map((module) => ({ ...module })),
    },
  });

  const noUserData = !userinfo;
  const userEmail = userinfo?.role;
  console.log("userinfo role>>", userinfo);

  // console.log("edituserId >>", userId);

  // --- Fetch options for datalist ---
  const fetchOptions = async (
    url: string,
    setFn: Dispatch<SetStateAction<SelectOption[]>>
  ) => {
    try {
      const res = await axiosInstance.get(url);
      setFn(res.data || []);
    } catch {
      setFn([]); // fallback if error
    }
  };

useEffect(() => {

  let hasFetched = false;

  const fetchAll = async () => {
    if (hasFetched) return;
    hasFetched = true;

    if (!userinfo) return;

    // Super admin within an org context: use org-specific URLs
    // Super admin without org context: use base URLs (null organization entries)
    // Admin: use organization-specific URLs
    const orgId = computedIsSuperAdmin ? (currentOrgId || '') : (userinfo?.organization || '');
    const baseUrl = orgId ? `/${orgId}` : '';

    await fetchOptions(`/subdivision${baseUrl}/`, setSubdivisionOptions);
    await fetchOptions(`/division${baseUrl}/`, setDivisionOptions);
    await fetchOptions(`/department${baseUrl}/`, setDepartmentOptions);
    await fetchOptions(`/location${baseUrl}/`, setLocationOptions);
    await fetchOptions(`/designation${baseUrl}/`, setDesignationOptions);
  };

  // Only fetch options if not in view mode
  if (currentMode !== "View") {
    fetchAll();
  }

  // eslint-disable-next-line
}, [computedIsSuperAdmin, userinfo?.organization, currentMode, currentOrgId]);

  // NOTE: The below useEffect was commented out because it unconditionally
  // calls the global /subdivision/, /division/, /department/, /location/,
  // and /designation/ endpoints on every mount. This was overwriting the
  // org-scoped data fetched above for admin users, causing the dropdowns
  // to show entries from all organizations instead of only the current one.
  // The first useEffect already handles both super-admin (global) and
  // admin (org-scoped) fetching correctly based on computedIsSuperAdmin.
  // useEffect(() => {
  //   fetchOptions("/subdivision/", setSubdivisionOptions);
  //   fetchOptions("/division/", setDivisionOptions);
  //   fetchOptions("/department/", setDepartmentOptions);
  //   fetchOptions("/location/", setLocationOptions);
  //   fetchOptions("/designation/", setDesignationOptions);
  //   // eslint-disable-next-line
  // }, []);


  // Update selectAll state when options or currentField change
  useEffect(() => {
    const optionMapping: Record<string, SelectOption[]> = {
      designation: designationOptions,
      division: divisionOptions,
      location: locationOptions,
      subdivision: subdivisionOptions,
      department: departmentOptions,
    };
    const options = optionMapping[currentField] || [];
    const isAllSelected = options.length > 0 && selectedOptions.length === options.length;
    setSelectAll(isAllSelected);
  }, [currentField, designationOptions, divisionOptions, locationOptions, subdivisionOptions, departmentOptions, selectedOptions]);

  // --- Handle create and edit selection ---
  const handleValueChange = (fieldName: string, value: string, originalOnChange: (value: string) => void) => {
    if (value === "--Create and Edit--") {
      setCurrentField(fieldName);
      setDialogValue("");
      setDialogError("");
      setSelectedOptions([]);
      setSelectAll(false);
      setDialogOpen(true);
    } else {
      // value is the selected option's id as string
      originalOnChange(value);
    }
  };

  // --- Check if save should be disabled ---
  const isSaveDisabled = isDialogSubmitting || !dialogValue.trim() || !!dialogError;

  // --- Check for duplicates and validate input ---
  const handleDialogValueChange = (value: string) => {
    setDialogValue(value);
    setDialogError("");

    // Check for duplicates
    if (value.trim()) {
      const optionMapping: Record<string, SelectOption[]> = {
        designation: designationOptions,
        division: divisionOptions,
        location: locationOptions,
        subdivision: subdivisionOptions,
        department: departmentOptions,
      };
      const options: SelectOption[] = optionMapping[currentField] || [];
      const isDuplicate = options.some(
        (option) => option.name.toLowerCase() === value.trim().toLowerCase()
      );

      if (isDuplicate) {
        setDialogError(`The ${currentField.toLowerCase()} name already exists`);
      }
    }
  };

  // --- Handle dialog save ---
  const handleDialogSave = async () => {
    if (!dialogValue.trim()) return;
    setIsDialogSubmitting(true);
    const capitalizedValue =
      dialogValue.charAt(0).toUpperCase() + dialogValue.slice(1);
    console.log("Current Field in dialog>>", currentField);
    console.log("Dialog Value>>", dialogValue);
    console.log("description>>", capitalizedValue);

    try {
      // For super admin: save with null organization, for admin: save with organization ID
      const orgIdForCreate = computedIsSuperAdmin ? (currentOrgId || null) : (userinfo?.organization || null);
      const apiUrl = orgIdForCreate ? `/${currentField}/${orgIdForCreate}/` : `/${currentField}/`;
      const payload = { name: dialogValue.trim(), description: capitalizedValue, organization_id: orgIdForCreate };

      await axiosInstance.post(apiUrl, payload);

      // Refetch options and set the selected field to the created option's id
      // Refetch options using the same conditional logic
      const refetchUrl = orgIdForCreate ? `/${currentField}/${orgIdForCreate}/` : `/${currentField}/`;
      const urlStateMap = {
        designation: setDesignationOptions,
        division: setDivisionOptions,
        subdivision: setSubdivisionOptions,
        location: setLocationOptions,
        department: setDepartmentOptions,
      };
      const setFn = urlStateMap[currentField as keyof typeof urlStateMap];
      if (setFn) {
        const res = await axiosInstance.get(refetchUrl);
        const opts = res.data || [];
        setFn(opts);
        const created = opts.find((o: any) => (o?.name || "").toLowerCase() === dialogValue.trim().toLowerCase());
        if (created) {
          form.setValue(currentField as keyof FormValues, created.name);
        }
      }
      // setDialogOpen(false);
      setDialogValue("");
      hotToaster.success(`${currentField} added successfully`);
    } catch (error: any) {
      hotToaster.error('Failed to add ' + currentField);
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  // --- Handle select option ---
  const handleSelectOption = (optionId: string) => {
    setSelectedOptions(prev => {
      const newSelected = prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId];

      // Update selectAll based on new selection
      const optionMapping: Record<string, SelectOption[]> = {
        designation: designationOptions,
        division: divisionOptions,
        location: locationOptions,
        subdivision: subdivisionOptions,
        department: departmentOptions,
      };
      const options = optionMapping[currentField] || [];
      setSelectAll(newSelected.length === options.length);

      return newSelected;
    });
  };

  // --- Handle select all ---
  const handleSelectAll = () => {
    const optionMapping: Record<string, SelectOption[]> = {
      designation: designationOptions,
      division: divisionOptions,
      location: locationOptions,
      subdivision: subdivisionOptions,
      department: departmentOptions,
    };
    const options = optionMapping[currentField] || [];
    const allIds = options.map(opt => opt.id);
    const isCurrentlyAllSelected = selectedOptions.length === options.length && options.length > 0;
    if (isCurrentlyAllSelected) {
      setSelectedOptions([]);
      setSelectAll(false);
    } else {
      setSelectedOptions(allIds);
      setSelectAll(true);
    }
  };

  // --- Handle bulk delete ---
  const handleBulkDeleteConfirm = async () => {
    setBulkDeleteDialogOpen(false);
    setIsDeleting(true);
    try {
      const orgIdForDelete = computedIsSuperAdmin ? (currentOrgId || '') : (userinfo?.organization || '');
      await axiosInstance.post(`/bulk/delete/${currentField}/${orgIdForDelete}`, {
        ids: selectedOptions.map(id => parseInt(id)),
        commit: true,
        organization_id: orgIdForDelete || null
      });

      // Refetch options
      const urlStateMap = {
        designation: setDesignationOptions,
        division: setDivisionOptions,
        subdivision: setSubdivisionOptions,
        location: setLocationOptions,
        department: setDepartmentOptions,
      };
      const setFn = urlStateMap[currentField as keyof typeof urlStateMap];
      if (setFn) {
        const refetchUrl = orgIdForDelete ? `/${currentField}/${orgIdForDelete}/` : `/${currentField}/`;
        await fetchOptions(refetchUrl, setFn);
      }
      // Clear form field if it was using any deleted options
      const currentValue = form.getValues(currentField as keyof FormValues);
      if (currentField && currentValue) {
        const optionMapping: Record<string, SelectOption[]> = {
          designation: designationOptions,
          division: divisionOptions,
          location: locationOptions,
          subdivision: subdivisionOptions,
          department: departmentOptions,
        };
        const options = optionMapping[currentField] || [];
        const isCurrentDeleted = selectedOptions.includes(options.find(opt => opt.name === currentValue)?.id || '');
        if (isCurrentDeleted) {
          form.setValue(currentField as keyof FormValues, "");
        }
      }
      const deletedCount = selectedOptions.length;
      setSelectedOptions([]);
      setSelectAll(false);
      hotToaster.success(`${deletedCount} ${currentField}(s) deleted successfully`);
    } catch (error: any) {
      hotToaster.error(`Cannot delete some ${currentField}(s) because they are linked to other records.`);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Handle single delete ---
  const handleDeleteClick = (option: SelectOption, fieldName: string) => {
    setDeleteOption({ ...option, field: fieldName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteOption) return;
    setIsDeleting(true);
    try {
      // console.log("check url>>", `/${deleteOption.field}/${deleteOption.id}/`);
      // await axiosInstance.delete(`/${deleteOption.field}/${deleteOption.id}/`);
      const orgIdForSingleDelete = computedIsSuperAdmin ? (currentOrgId || '') : (userinfo?.organization || '');
      const response = await axiosInstance.post(`/bulk/delete/${deleteOption.field}`, {
        ids: [deleteOption.id],
        commit: true,
      });
console.log("delete responsesssssss>>", response);
      // Refetch options
      const urlStateMap = {
        designation: setDesignationOptions,
        division: setDivisionOptions,
        subdivision: setSubdivisionOptions,
        location: setLocationOptions,
        department: setDepartmentOptions,
      };
      const setFn = urlStateMap[deleteOption.field as keyof typeof urlStateMap];
      if (setFn) {
        const refetchUrl = orgIdForSingleDelete ? `/${deleteOption.field}/${orgIdForSingleDelete}/` : `/${deleteOption.field}/`;
        await fetchOptions(refetchUrl, setFn);
      }
      // Clear form field if it was using this deleted option
      const currentValue = form.getValues(deleteOption.field as keyof FormValues);
      if (currentValue === deleteOption.name) {
        form.setValue(deleteOption.field as keyof FormValues, "");
      }
      setDeleteDialogOpen(false);
      setDeleteOption(null);
      hotToaster.success(`${deleteOption.field} deleted successfully`);
    } catch (error: any) {
      // hotToaster.error('Failed to delete ' + deleteOption.field);
      hotToaster.error(`Cannot delete ${currentField} because it is linked to other records.`);
      setDeleteDialogOpen(false);
      setDeleteOption(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const { reset } = form;

  // --- Initialize module access for organization users ---
  useEffect(() => {
    if (moduleListInitialized) {
      return;
    }

    if (userId) {
      setModuleListInitialized(true);
      return;
    }

    const initializeModuleAccessList = async () => {
      let modulesToApply: ModuleAccess[] | null = null;
      let visibleModules: string[] = [];

      try {
        if (currentOrgId) {
          if (isOrganizationEditMode) {
            const res = await axiosInstance.get(`/organization/${currentOrgId}`);
            const permissions = res.data?.organization?.module_permissions as ModuleAccess[] | undefined;
            if (Array.isArray(permissions)) {
              modulesToApply = permissions
                .filter((permission) => permission && permission.access !== "no_access")
                .map((permission) => ({
                  module: permission.module,
                  access: permission.access,
                }));
              visibleModules = modulesToApply.map((permission) => permission.module);
            }
          } else {
            const cachedData = organizationFormStore.get();
            const cachedModules = cachedData.module_access_list;
            if (Array.isArray(cachedModules)) {
              // Default user modules to "no_access" even if organization has access
              modulesToApply = cachedModules
                .filter((module) => module && module.access !== "no_access")
                .map((module) => ({
                  module: module.module,
                  access: "no_access",
                }));
              visibleModules = modulesToApply.map((module) => module.module);
            }
      }
        } else if (Array.isArray(userinfo?.module_permissions)) {
          const permissions = userinfo.module_permissions as ModuleAccess[];
          modulesToApply = permissions
            .filter((permission) => permission && permission.access !== "no_access")
            .map((permission) => ({
              module: permission.module,
              access: permission.access,
            }));
          visibleModules = modulesToApply.map((permission) => permission.module);
        } else if (computedIsSuperAdmin && !currentOrgId) {
          // For super admin creating user not in org context, show all modules
          visibleModules = MODULE_TEMPLATE.map((module) => module.module);
        }
      } catch (error) {
        console.error("Failed to initialize module access list:", error);
      }

      const listToApply = MODULE_TEMPLATE.map((module) => {
        const override = modulesToApply?.find(
          (permission) => permission.module === module.module
        );
        return override
          ? { module: override.module, access: override.access }
          : { ...module };
      });

      form.setValue(
        "module_access_list",
        listToApply.map((module) => ({ ...module }))
      );
      form.trigger("module_access_list");
      setAllowedModules(visibleModules);
      setModuleListInitialized(true);
    };

    initializeModuleAccessList();
  }, [
    moduleListInitialized,
    userId,
    currentOrgId,
    isOrganizationEditMode,
    userinfo?.module_permissions,
    form,
  ]);

  // --- Fetch user to edit (if userId exists) ---
  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/users/${userId}`);
        const user = res.data;
        console.log("Fetched---------------- user data:", user);
        setUserData(user);
      } catch { } finally {
        setLoading(false)
      }
    };
    console.log("Fetching user with ID:", fetchUser);
    fetchUser();
  }, [userId]);

  // --- Populate form after userData is loaded (and options if not in view mode) ---
  useEffect(() => {
    if (!userData) return; // Wait for userData

    const populateForm = async () => {
      // For view mode, always proceed (we show text inputs, don't need options)
      // For super admin edit mode, populate immediately (options will load and update Combobox)
      // For admin edit/create mode, wait for options to load (we use dropdowns)
      const computedIsSuperAdminEditMode = computedIsSuperAdmin && currentMode === "Edit";
      if (currentMode !== "View" && !computedIsSuperAdminEditMode && designationOptions.length === 0) return;

      const baseModules = MODULE_TEMPLATE.map((module) => module.module);
      // Use the clean name from details objects, or strip organization name from display strings
      // For super admin edit mode, show all values including null/empty values
      const designation = userData.designation_details?.name || (userData.designation ? userData.designation.split(' (')[0] : '') || '';
      const division = userData.division_details?.name || (userData.division ? userData.division.split(' (')[0] : '') || '';
      const subdivision = userData.subdivision_details?.name || (userData.subdivision ? userData.subdivision.split(' (')[0] : '') || '';
      const location = userData.location_details?.name || (userData.location ? userData.location.split(' (')[0] : '') || '';
      const department = userData.department_details?.name || (userData.department ? userData.department.split(' (')[0] : '') || '';

      reset({
        firstName: userData.first_name || "",
        lastName: userData.last_name || "",
        employeeId: userData.employee_id || "",
        countryCode: userData.country_code || "+1",
        phone: userData.phone || "",
        designation,
        division,
        subdivision,
        location,
        department,
        email: userData.email || "",
        dashboardAccess: userData.dashboard_access ?? false,
        disable: userData.disable || false,
        mobileSupervisor: userData.mobile_supervisor || true,
        module_access_list: baseModules.map((moduleKey) => {
          const found = userData.module_access?.find(
            (perm: any) => perm.module === moduleKey
          );
          return {
            module: moduleKey,
            access: found ? found.access : "no_access",
          };
        }),
      });

      const userVisibleModules = (userData.module_access || [])
        .filter((perm: any) => perm && perm.access !== "no_access")
        .map((perm: any) => perm.module);

      // For edit mode, show the user's organization's modules if applicable
      if (userId) {
        // For edit, try to fetch the organization's modules
        try {
          const orgId = userData.organization;
          if (orgId) {
            const res = await axiosInstance.get(`/organization/${orgId}`);
            const permissions = res.data?.organization?.module_permissions as any[] | undefined;
            if (Array.isArray(permissions)) {
              const orgVisibleModules = permissions
                .filter((perm) => perm && perm.access !== "no_access")
                .map((perm) => perm.module);
              setAllowedModules(orgVisibleModules);
            } else {
              setAllowedModules(userVisibleModules.length > 0 ? userVisibleModules : []);
            }
          } else {
            setAllowedModules(userVisibleModules.length > 0 ? userVisibleModules : []);
          }
        } catch (error) {
          setAllowedModules(userVisibleModules.length > 0 ? userVisibleModules : []);
        }
      } else if (userVisibleModules.length > 0) {
        setAllowedModules(userVisibleModules);
      }
    };

    populateForm();
  }, [
    userData, 
    reset, 
    currentMode,
    computedIsSuperAdmin,
    // For super admin edit mode, we populate immediately but also update when options load
    // For admin edit/create mode, we need options (we use dropdowns)
    // For view mode, we don't need options but including them doesn't hurt
    designationOptions, 
    divisionOptions, 
    subdivisionOptions, 
    locationOptions, 
    departmentOptions
  ]);

  const dashboardAccess = form.watch("dashboardAccess");

  // --- Submit Handler ---
  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    // const phoneNumber = parsePhoneNumber(values.phone);
    // const countryCode = phoneNumber
    //   ? `+${phoneNumber.countryCallingCode}`
    //   : "";
    // const nationalNumber = phoneNumber ? phoneNumber.nationalNumber : "";
    const payload = {
      first_name: values.firstName,
      last_name: values.lastName,
      employee_id: values.employeeId,
      country_code: values.countryCode,
      phone: values.phone,
      // country_code: countryCode,
      // phone: nationalNumber,
      designation: values.designation,
      division: values.division,
      subdivision: values.subdivision,
      location: values.location,
      department: values.department,
      email: values.email,
      dashboard_access: values.dashboardAccess,
      mobile_supervisor: true,
      disable: values.disable,
      username: values.email?.split("@")[0] || values.phone,
      is_active: true,
      is_admin: false,
      is_superadmin: false,
      ...(!userId && {
        organization: hasOrgId ? Number(orgId) : userinfo?.organization,
        role: 3,
      }),
      module_access_list: values.dashboardAccess
        ? (values.module_access_list || [])
        : (values.module_access_list || []).map(module => ({ ...module, access: "no_access" })),
    };
    console.log("&&&&&&&&&&&&&&", payload);
    try {
      let res;
      if (userId) {
        res = await axiosInstance.put(`/users/${userId}`, payload);
        hotToaster.success("User Updated successfully", { duration: 2000 });
      } else {
        res = await axiosInstance.post("/users/create", payload);
        hotToaster.success("User created successfully", { duration: 2000 });
      }
      if (mode === "edit" && hasOrgId && !currentuserrole) {
        // Edit organization page
        router.push(`/admin/organizations/${orgId}/edit`);
      } else if (hasOrgId && !currentuserrole) {
        // New organization page with orgId
        router.push(`/admin/organizations/new?orgId=${orgId}`);
      } else if (mode === "Edit") {
        // Default new organization page
        router.push("/admin");
      }      // router.push("/admin/organizations/new");
      else {
        router.push("/admin");
      }
    } catch (error: any) {
      const rawError = error?.response?.data;
      let message =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        "Something went wrong.";
      if (rawError && typeof rawError === 'object' && !rawError.error && !rawError.detail) {
        const messages: string[] = [];
        for (const [field, errors] of Object.entries(rawError)) {
          if (Array.isArray(errors)) {
            messages.push(...errors.map((e: any) => `${field}: ${e}`));
          } else if (typeof errors === 'string') {
            messages.push(`${field}: ${errors}`);
          } else if (typeof errors === 'object' && errors !== null) {
            messages.push(`${field}: ${JSON.stringify(errors)}`);
          }
        }
        if (messages.length > 0) message = messages.join("; ");
      }
      console.log("Error details:", message, "Full response:", rawError);
      hotToaster.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Handle bulk import mode toggle ---
  const handleBulkImportMode = () => {
    setBulkImportMode(true);
    setBulkImportFile(null);
    setBulkImportData([]);
    setBulkImportErrors([]);
  };

  // --- Download sample CSV template ---
  const handleDownloadSample = () => {
    const fieldDisplayName = currentField.charAt(0).toUpperCase() + currentField.slice(1);
    const csvHeader = `${fieldDisplayName.toUpperCase()} NAME`;

    const sampleData = [
      { [csvHeader]: `${fieldDisplayName} 1` },
      { [csvHeader]: `${fieldDisplayName} 2` },
      { [csvHeader]: `${fieldDisplayName} 3` },
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentField}_sample.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // --- Handle file selection for bulk import ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setBulkImportErrors(['Please upload a valid CSV file.']);
        setBulkImportFile(null);
        return;
      }
      setBulkImportFile(file);
      setBulkImportErrors([]);
      parseCsvFile(file);
    }
  };

  // --- Parse CSV file ---
  const parseCsvFile = (file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) {
          setBulkImportErrors(['CSV file must contain at least one header row and one data row.']);
          return;
        }

        const headers = data[0].map((h) => h?.toLowerCase().trim());
        const fieldDisplayName = currentField.charAt(0).toUpperCase() + currentField.slice(1);
        const fieldSpecificHeader = `${fieldDisplayName.toLowerCase()} name`;
        const generalNameIndex = headers.indexOf('name');
        const fieldSpecificNameIndex = headers.indexOf(fieldSpecificHeader);

        const nameIndex = fieldSpecificNameIndex !== -1 ? fieldSpecificNameIndex : generalNameIndex;

        if (nameIndex === -1) {
          setBulkImportErrors([`CSV file must contain a "${fieldDisplayName} name" or "name" column.`]);
          return;
        }

        const parsedData: { name: string; description: string }[] = [];
        const duplicates: { name: string; description: string }[] = [];
        const errors: string[] = [];
        const seenNames: Set<string> = new Set();

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const name = row[nameIndex]?.trim() || '';

          if (!name) {
            errors.push(`Row ${i + 1}: Name field is required.`);
            continue;
          }

          const lowerName = name.toLowerCase();
          if (seenNames.has(lowerName)) {
            errors.push(`Row ${i + 1}: Duplicate name "${name}" found in CSV.`);
            continue;
          }
          seenNames.add(lowerName);

          // Auto-generate description from name (first letter capitalized)
          const description = name.charAt(0).toUpperCase() + name.slice(1);
          parsedData.push({ name, description });
        }

        // Check for duplicates with existing options
        const optionMapping: Record<string, SelectOption[]> = {
          designation: designationOptions,
          division: divisionOptions,
          location: locationOptions,
          subdivision: subdivisionOptions,
          department: departmentOptions,
        };
        const existingOptions = optionMapping[currentField] || [];
        const newData: { name: string; description: string }[] = [];

        parsedData.forEach((item) => {
          const isDuplicate = existingOptions.some(
            (option) => option.name.toLowerCase() === item.name.toLowerCase()
          );
          if (isDuplicate) {
            duplicates.push(item);
          } else {
            newData.push(item);
          }
        });

        setBulkImportData(newData);
        setBulkImportDuplicates(duplicates);
        setBulkImportErrors(errors);
      },
      header: false,
      skipEmptyLines: true,
      error: () => {
        setBulkImportErrors(['Failed to parse CSV file.']);
      },
    });
  };

  // --- Handle bulk import ---
  const handleBulkImport = async (skipConfirmation = false) => {
    if (bulkImportData.length === 0) return;

    // If there are duplicates and user hasn't chosen to skip confirmation, show dialog
    if (bulkImportDuplicates.length > 0 && !skipConfirmation) {
      setBulkImportConfirmDialog(true);
      return;
    }

    setBulkImportProcessing(true);

    try {
      // Use same URL logic as single create
      const apiUrl = computedIsSuperAdmin ? `/${currentField}/` : `/${currentField}/${userinfo?.organization}/`;

      // Send individual requests for each item (same as single create logic)
      for (const item of bulkImportData) {
        const payload = computedIsSuperAdmin
          ? { name: item.name, description: item.description, organization_id: null }
          : { name: item.name, description: item.description, organization_id: userinfo?.organization };

        await axiosInstance.post(apiUrl, payload);
      }

      // Refetch options using same logic as single create
      const refetchUrl = computedIsSuperAdmin ? `/${currentField}/` : `/${currentField}/${userinfo?.organization}/`;
      const urlStateMap = {
        designation: setDesignationOptions,
        division: setDivisionOptions,
        subdivision: setSubdivisionOptions,
        location: setLocationOptions,
        department: setDepartmentOptions,
      };
      const setFn = urlStateMap[currentField as keyof typeof urlStateMap];
      if (setFn) {
        await fetchOptions(refetchUrl, setFn);
      }

      hotToaster.success(`Successfully imported ${bulkImportData.length} ${currentField}s`);
      setDialogOpen(false);
      setBulkImportMode(false);
    } catch (error: any) {
      hotToaster.error(`Failed to import ${currentField}s`);
    } finally {
      setBulkImportProcessing(false);
    }
  };

  // --- Go back to single entry mode ---
  const handleBackToSingleEntry = () => {
    setBulkImportMode(false);
    setBulkImportFile(null);
    setBulkImportData([]);
    setBulkImportErrors([]);
    setBulkImportDuplicates([]);
    setBulkImportConfirmDialog(false);
  };

  // function setEnabled(checked: boolean) {
  //   throw new Error("Function not implemented.");
  // }

  // --- Render ---
  if (noUserData) {
    return (
      <span className="flex items-center justify-center h-screen gap-2">
        <Info className="h-5 w-5" />
        <span className="text-gray-500 text-sm">
          No user data found. Please re-authenticate
        </span>
      </span>
    );
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <GlobalLoader />
        </div>
      ) : (
        <Form<FormValues> {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* --- First Name --- */}
              <FormField
                disabled={currentMode === "View"}
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        {...field}
                        autoComplete="off"
                        className="disabled:opacity-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Last Name --- */}
              <FormField
                disabled={currentMode === "View"}
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Doe"
                        {...field}
                        autoComplete="off"
                        className="disabled:opacity-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Employee ID --- */}
              <FormField
                disabled={currentMode === "View"}
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="EMP123"
                        {...field}
                        autoComplete="off"
                        className="disabled:opacity-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Country Code --- */}
              <FormField
                disabled={currentMode === "View"}
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country Code *</FormLabel>
                    <FormControl>
                      {currentMode === "View" ? (
                        <Input
                          value={field.value}
                          disabled
                          className="text-black disabled:opacity-100"
                          placeholder="Select country code"
                        />
                      ) : (
                        <Combobox
                          options={countryCodeOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select country code"
                          searchPlaceholder="Search country..."
                          notFoundText="No country found."
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Phone --- */}
              <FormField
                disabled={currentMode === "View"}
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="555-1234"
                        {...field}
                        autoComplete="off"
                        className="disabled:opacity-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Phone ---
           <FormField
             disabled={mode === "View"}
             control={form.control}
             name="phone"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>Phone Number *</FormLabel>
                 <FormControl>
                   <PhoneInput
                     placeholder="Enter phone number"
                     international
                     defaultCountry="US"
                     {...field}
                     // This is the key part: It tells the component to use your existing Input
                     // for the text field, so it gets all the correct styles automatically.
                     inputComponent={Input}
                   />
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           /> */}

          {/* --- Designation with search functionality --- */}
          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="designation"
            render={({ field }) => {
              const allOptions = addCurrentToOptions(
                designationOptions,
                field.value || ""
              );
              return (
                <FormItem>
                  <FormLabel>Designation *</FormLabel>
                  <FormControl>
                    {currentMode === "View" ? (
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        disabled={currentMode === "View"}
                        className={currentMode === "View" ? "text-black disabled:opacity-100" : ""}
                        placeholder={currentMode === "View" ? "Select Designation" : "Enter Designation"}
                      />
                    ) : (
                      <Combobox
                        options={[
                          { value: "--Create and Edit--", label: "--Create and Edit--" },
                          ...allOptions.map((option) => ({ value: option.name, label: option.name }))
                        ]}
                        value={field.value}
                        onChange={(value) => handleValueChange("designation", value, field.onChange)}
                        placeholder="Select Designation"
                        searchPlaceholder="Search designations..."
                        notFoundText="No designation found."
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* --- Division with search functionality --- */}
          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="division"
            render={({ field }) => {
              const allOptions = addCurrentToOptions(
                divisionOptions,
                field.value || ""
              );
              return (
                <FormItem>
                  <FormLabel>Division *</FormLabel>
                  <FormControl>
                    {currentMode === "View" ? (
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        disabled={currentMode === "View"}
                        className={currentMode === "View" ? "text-black disabled:opacity-100" : ""}
                        placeholder={currentMode === "View" ? "Select Division" : "Enter Division"}
                      />
                    ) : (
                      <Combobox
                        options={[
                          { value: "--Create and Edit--", label: "--Create and Edit--" },
                          ...allOptions.map((option) => ({ value: option.name, label: option.name }))
                        ]}
                        value={field.value}
                        onChange={(value) => handleValueChange("division", value, field.onChange)}
                        placeholder="Select Division"
                        searchPlaceholder="Search divisions..."
                        notFoundText="No division found."
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* --- Location with search functionality --- */}
          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="location"
            render={({ field }) => {
              const allOptions = addCurrentToOptions(
                locationOptions,
                field.value || ""
              );
              return (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <FormControl>
                    {currentMode === "View" ? (
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        disabled={currentMode === "View"}
                        className={currentMode === "View" ? "text-black disabled:opacity-100" : ""}
                        placeholder={currentMode === "View" ? "Select Location" : "Enter Location"}
                      />
                    ) : (
                      <Combobox
                        options={[
                          { value: "--Create and Edit--", label: "--Create and Edit--" },
                          ...allOptions.map((option) => ({ value: option.name, label: option.name }))
                        ]}
                        value={field.value}
                        onChange={(value) => handleValueChange("location", value, field.onChange)}
                        placeholder="Select Location"
                        searchPlaceholder="Search locations..."
                        notFoundText="No location found."
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* --- Subdivision with search functionality --- */}
          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="subdivision"
            render={({ field }) => {
              const allOptions = addCurrentToOptions(
                subdivisionOptions,
                field.value || ""
              );
              return (
                <FormItem>
                  <FormLabel>Sub Division *</FormLabel>
                  <FormControl>
                    {currentMode === "View" ? (
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        disabled={currentMode === "View"}
                        className={currentMode === "View" ? "text-black disabled:opacity-100" : ""}
                        placeholder={currentMode === "View" ? "Select Sub-Division" : "Enter Sub-Division"}
                      />
                    ) : (
                      <Combobox
                        options={[
                          { value: "--Create and Edit--", label: "--Create and Edit--" },
                          ...allOptions.map((option) => ({ value: option.name, label: option.name }))
                        ]}
                        value={field.value || ""}
                        onChange={(value) => handleValueChange("subdivision", value, field.onChange)}
                        placeholder="Select Sub-Division"
                        searchPlaceholder="Search subdivisions..."
                        notFoundText="No subdivision found."
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* --- Department with search functionality --- */}
          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="department"
            render={({ field }) => {
              const allOptions = addCurrentToOptions(
                departmentOptions,
                field.value || ""
              );
              return (
                <FormItem>
                  <FormLabel>Department *</FormLabel>
                  <FormControl>
                    {currentMode === "View" ? (
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        disabled={currentMode === "View"}
                        className={currentMode === "View" ? "text-black disabled:opacity-100" : ""}
                        placeholder={currentMode === "View" ? "Select Department" : "Enter Department"}
                      />
                    ) : (
                      <Combobox
                        options={[
                          { value: "--Create and Edit--", label: "--Create and Edit--" },
                          ...allOptions.map((option) => ({ value: option.name, label: option.name }))
                        ]}
                        value={field.value}
                        onChange={(value) => handleValueChange("department", value, field.onChange)}
                        placeholder="Select Department"
                        searchPlaceholder="Search departments..."
                        notFoundText="No department found."
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="john.doe@example.com"
                    {...field}
                    autoComplete="off"
                    className="disabled:opacity-100"
                  />
                </FormControl>
                <FormDescription
                  className={dashboardAccess ? "text-destructive" : ""}
                >
                  {dashboardAccess ? "" : ""}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <FormField
            disabled={currentMode === "View"}
            control={form.control}
            name="dashboardAccess"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Dashboard Access</FormLabel>
                  <FormDescription>
                    Allow this user to access the dashboard
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    className="disabled:opacity-100"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={currentMode === "View"}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch("dashboardAccess") && (
            <div className="mt-4">
              <div className="border border-gray-400 rounded-md p-4 space-y-4">
                <h3 className="text-base font-medium border border-gray-400 rounded-md pl-2 py-2">
                  Module Access Control
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const modules = form.watch("module_access_list") || [];
                    console.log("Rendering modules in user form:", modules);

                    const moduleEntries = modules.map((moduleItem, index) => ({
                      moduleItem,
                      index,
                    }));

                    const visibleModuleEntries = moduleEntries.filter(({ moduleItem }) => {
                      if (allowedModules.length > 0) {
                        return allowedModules.includes(moduleItem.module);
                      }
                      return moduleItem.access !== "no_access";
                    });

                    if (visibleModuleEntries.length === 0) {
                      console.log("No modules to render, showing fallback message");
                      return (
                        <div className="col-span-2 text-center text-muted-foreground py-4">
                          {currentOrgId ? "Loading organization modules..." : "No modules available"}
                        </div>
                      );
                    }

                    return visibleModuleEntries.map(({ moduleItem, index }) => (
                      <FormField
                        key={moduleItem.module}
                        control={form.control}
                        name={`module_access_list.${index}.access`}
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between border px-2 rounded-md h-14">
                            <FormLabel className="capitalize">
                              {moduleItem.module.replace("_", " ")}
                            </FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={currentMode === "View"}
                              >
                                <SelectTrigger className="w-[150px] h-8 text-xs disabled:opacity-100">
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
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ));
                  })()}
                </div>
                {form.formState.errors.module_access_list && (
                  <p className="text-destructive text-sm text-base-red-600 mt-1 font-semibold">
                    {
                      "At least one module must have access when dashboard access is enabled"
                    }
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-6">
              {/* Left side: Disable User switch - only show for edit operations when not in View mode */}
              <div className="flex-1">
                {userId && mode !== "View" && currentMode !== "View" && (
                  <FormField
                    control={form.control}
                    name="disable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center rounded-lg border p-1 space-x-3">
                        <FormLabel className="text-base">
                          Disable User
                        </FormLabel>
                        <FormControl>
                          <Switch
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              setEnabled(checked);
                            }}
                            className="w-10 h-6"
                            checked={field.value}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="flex space-x-4">
                <Button
                  className="w-28"
                  variant="outline"
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (computedIsSuperAdmin && handleSuperAdminBack) {
                      // Super admin - use enhanced logic with delete-draft when needed
                      handleSuperAdminBack();
                    } else if (currentMode?.toLowerCase() === "edit" && currentOrgId) {
                      // Organization edit page - go back to org edit
                      router.push(`/admin/organizations/${currentOrgId}/edit`);
                    } else {
                      // Default - back to admin users tab
                      router.push("/admin?tab=users");
                    }
                  }}
                >
                  Cancel
                </Button>
            <Button
              type="submit"
              disabled={isSubmitting || currentMode === "View"}
            >
              {isSubmitting
                ? userId
                  ? "Updating..."
                  : "Creating..."
                : userId
                ? "Update User"
                : "Create User"}
            </Button>
          </div>
        </div>

            {/* Dialog for creating new entries */}
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setDialogValue("");
                  setCurrentField("");
                  setBulkImportMode(false);
                  setBulkImportFile(null);
                  setBulkImportData([]);
                  setBulkImportErrors([]);
                  setBulkImportDuplicates([]);
                  setBulkImportConfirmDialog(false);
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {bulkImportMode
                      ? `Bulk Import ${currentField.charAt(0).toUpperCase() +
                      currentField.slice(1)
                      }`
                      : `Create New ${currentField.charAt(0).toUpperCase() +
                      currentField.slice(1)
                      }`}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {!bulkImportMode ? (
                    <>
                      {/* Display existing options */}
                      {(() => {
                        const optionMapping: Record<string, SelectOption[]> = {
                          designation: designationOptions,
                          division: divisionOptions,
                          location: locationOptions,
                          subdivision: subdivisionOptions,
                          department: departmentOptions,
                        };
                        const options: SelectOption[] =
                          optionMapping[currentField] || [];

                        return (
                          options.length > 0 && (
                            <div className="border-t pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-gray-900">
                                  Existing{" "}
                                  {currentField.charAt(0).toUpperCase() +
                                    currentField.slice(1)}
                                  s
                                </h4>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={selectAll}
                                      onChange={handleSelectAll}
                                      className="w-3 h-3"
                                    />
                                    Select All
                                  </label>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setBulkDeleteDialogOpen(true)
                                    }
                                    disabled={
                                      selectedOptions.length === 0 || isDeleting
                                    }
                                    className="text-sm px-2 py-1 h-6 bg-red-600 border-red-200 text-white hover:bg-red-100"
                                  >
                                    {isDeleting
                                      ? "Deleting..."
                                      : `Delete Selected (${selectedOptions.length})`}
                                  </Button>
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                <div className="flex flex-col gap-2">
                                  {options.map((option: SelectOption) => (
                                    <div
                                      key={option.id}
                                      className="text-sm text-gray-700 bg-white px-2 py-1 rounded border flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={selectedOptions.includes(
                                            option.id
                                          )}
                                          onChange={() =>
                                            handleSelectOption(option.id)
                                          }
                                          className="w-3 h-3"
                                        />
                                        <span>{option.name}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteClick(
                                            option,
                                            currentField
                                          )
                                        }
                                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                                        title="Delete option"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )
                        );
                      })()}

                      {/* Input field with description below existing list */}
                      <div className="space-y-2">
                        <DialogDescription>
                          Enter the name for the new {currentField}.
                        </DialogDescription>
                        <Input
                          value={dialogValue}
                          onChange={(e) =>
                            handleDialogValueChange(e.target.value)
                          }
                          placeholder={`Enter ${currentField} name`}
                          autoFocus
                        />
                        {dialogError && (
                          <p className="text-sm text-red-600 font-medium">
                            {dialogError}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Bulk import UI */}
                      <div className="space-y-4">
                        <div className="items-center justify-between">
                          <DialogDescription>
                            Upload a CSV file with "{currentField}" names. The
                            file should have a "name" column.
                          </DialogDescription>
                          <Button
                            variant="link"
                            onClick={handleDownloadSample}
                            className="p-1 mt-2 h-auto text-xs border border-gray-300 rounded-md hover:bg-gray-100 transition"
                          >
                            Download Sample Format
                          </Button>
                        </div>

                        <div className="border-2 border-dashed rounded-lg p-6">
                          <div className="text-center">
                            <Input
                              type="file"
                              accept=".csv"
                              onChange={handleFileSelect}
                              className="max-w-sm mx-auto"
                            />
                            <p className="text-sm text-muted-foreground mt-2">
                              Select a CSV file to upload
                            </p>
                          </div>
                        </div>

                        {bulkImportErrors.length > 0 && (
                          <div className="rounded-md bg-red-50 p-4 border border-red-200">
                            <h4 className="text-sm font-medium text-red-800 mb-2">
                              Validation Errors
                            </h4>
                            <ul className="text-sm text-red-700 space-y-1">
                              {bulkImportErrors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bulkImportDuplicates.length > 0 && (
                          <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                            <h4 className="text-sm font-medium text-yellow-800 mb-2">
                              Duplicate Entries Found (
                              {bulkImportDuplicates.length} items already exist)
                            </h4>
                            <div className="max-h-40 overflow-y-auto">
                              <ul className="text-sm text-yellow-700 space-y-1">
                                {bulkImportDuplicates.map((item, index) => (
                                  <li
                                    key={index}
                                    className="flex justify-between"
                                  >
                                    <span>{item.name}</span>
                                    {item.description && (
                                      <span className="text-gray-500">
                                        ({item.description})
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {bulkImportData.length > 0 &&
                          bulkImportErrors.length === 0 && (
                            <div className="rounded-md bg-green-50 p-4 border border-green-200">
                              <h4 className="text-sm font-medium text-green-800 mb-2">
                                Ready to Import ({bulkImportData.length} new
                                items)
                              </h4>
                              <div className="max-h-40 overflow-y-auto">
                                <ul className="text-sm text-green-700 space-y-1">
                                  {bulkImportData.map((item, index) => (
                                    <li
                                      key={index}
                                      className="flex justify-between"
                                    >
                                      <span>{item.name}</span>
                                      {item.description && (
                                        <span className="text-gray-500">
                                          ({item.description})
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter>
                  {!bulkImportMode ? (
                    <>
                      <Button variant="outline" onClick={handleBulkImportMode}>
                        Bulk Import
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setDialogValue("");
                          setCurrentField("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDialogSave}
                        disabled={isSaveDisabled}
                      >
                        {isDialogSubmitting ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleBackToSingleEntry}
                      >
                        Back to Single Entry
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setCurrentField("");
                          setBulkImportMode(false);
                          setBulkImportFile(null);
                          setBulkImportData([]);
                          setBulkImportErrors([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleBulkImport()}
                        disabled={
                          bulkImportData.length === 0 ||
                          bulkImportErrors.length > 0 ||
                          bulkImportProcessing
                        }
                      >
                        {bulkImportProcessing
                          ? "Importing..."
                          : `Import ${bulkImportData.length} Items`}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Bulk import confirmation dialog */}
            <AlertDialog open={bulkImportConfirmDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Duplicates Found</AlertDialogTitle>
                  <AlertDialogDescription>
                    Some entries in your CSV file ({bulkImportDuplicates.length}
                    ) already exist. Would you like to continue importing only
                    the new entries ({bulkImportData.length} items)? The
                    duplicate entries will be skipped.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBulkImportConfirmDialog(false);
                      setBulkImportData([]);
                      setBulkImportDuplicates([]);
                      setBulkImportFile(null);
                    }}
                  >
                    Cancel Import
                  </Button>
                  <Button
                    onClick={() => {
                      setBulkImportConfirmDialog(false);
                      handleBulkImport(true);
                    }}
                  >
                    Continue with New Data
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Bulk delete confirmation dialog */}
            <AlertDialog open={bulkDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bulk Delete Confirmation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedOptions.length}{" "}
                    selected {currentField}
                    {selectedOptions.length > 1 ? "s" : ""}? This action cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBulkDeleteDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkDeleteConfirm}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting
                      ? "Deleting..."
                      : `Delete ${selectedOptions.length} Item${selectedOptions.length > 1 ? "s" : ""
                      }`}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete confirmation dialog */}
            <AlertDialog open={deleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Confirmation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{deleteOption?.name}"? This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setDeleteOption(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      handleDeleteConfirm();
                    }}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </form>
        </Form>
      )}
    </>

  );
}
