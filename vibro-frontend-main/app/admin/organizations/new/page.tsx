"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Loader } from "lucide-react";

import dynamicImport from "next/dynamic";

const OrganizationForm = dynamicImport(
  () => import("@/components/admin/organization-form").then(mod => mod.OrganizationForm),
  { ssr: false }
);
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { organizationFormStore } from "@/utils/organizationFormStore";
import { useEffect } from "react";

export default function NewOrganizationPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [dashboardAccess, setDashboardAccess] = useState(false);
  const [moduleAccessList, setModuleAccessList] = useState<{module: string, access: string}[]>([]);
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();

  // Get orgId from URL if available (when returning from Add User page)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const orgIdFromUrl = urlParams?.get('orgId') ? parseInt(urlParams.get('orgId')!) : undefined;

  const handleCancel = async() => {

    // If there's an orgId (returning from Add User page), delete the draft first
    try{
      if (orgIdFromUrl) {
    organizationFormStore.clear();
    setIsLoading(true);
      const res = await axiosInstance.delete(`/organization/delete-draft/${orgIdFromUrl}/`
      );
      if (res.status === 200 || res.status === 204) {
    router.push("/admin?tab=organization");
      }
    }else {
      // Handle unexpected responses
      toast({
        title: "Error",
        description: "Unexpected response while deleting the draft.",
        variant: "destructive",
      });
      organizationFormStore.clear();
      router.push("/admin?tab=organization");
    }
    }catch (err) {
      console.error("Failed to generate org ID:", err);
      toast({
        title: "Error",
        description: "Failed to Delete the Draft Data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear cached form data when starting a fresh organization creation
  // (i.e., when there's no orgId in the URL, meaning user is not returning from Add User page)
  useEffect(() => {
    if (!orgIdFromUrl) {
      console.log('Fresh organization creation - clearing any cached data');
      organizationFormStore.clear();
    }
  }, [orgIdFromUrl]);

  // Check if Add User button should be enabled
  const isAddUserEnabled = () => {
    console.log("Checking Add User button state:");
    console.log("- orgName:", orgName);
    console.log("- dashboardAccess:", dashboardAccess);
    console.log("- moduleAccessList:", moduleAccessList);

    if (!orgName.trim()) {
      console.log("❌ Blocked: No organization name");
      return false;
    }
    if (!dashboardAccess) {
      console.log("❌ Blocked: Dashboard access not enabled");
      return false;
    }
    if (!moduleAccessList || moduleAccessList.length === 0) {
      console.log("❌ Blocked: No module access list");
      return false;
    }
    // At least one module must have access other than "no_access"
    const hasAccess = moduleAccessList.some(module => module.access !== "no_access");
    console.log("Has access:", hasAccess);
    return hasAccess;
  };

  const handleAddUser = async () => {
    if (!isAddUserEnabled()) return;

    setIsLoading(true);
    try {
      console.log("Generating next organization ID 1 ...");
      const res = await axiosInstance.post("/organization/next-id/");
      console.log("Generating next organization ID 2...");
      const nextOrgId = res.data.nextOrgId;
      console.log("Generating next organization ID 3...");
      // router.push(`/admin/users/new?orgId=${nextOrgId}`);
      const isEditPage = pathname.includes("/edit");

    // Conditionally add the mode query param
    console.log("isEditPage:", isEditPage);
    const queryParams = isEditPage
      ? `?orgId=${nextOrgId}&mode=edit`
      : `?orgId=${nextOrgId}`;

    router.push(`/admin/users/new${queryParams}`);
    } catch (err) {
      console.error("Failed to generate org ID:", err);
      toast({
        title: "Error",
        description: "Failed to generate next organization ID.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
          <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
          <div className="flex items-center justify-center h-64">
            <Loader className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className={`flex flex-col gap-4 p-4 transition-all duration-300 ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}>
          <div className="p-4 md:p-6 space-y-6">
            {/* Back button */}
            <Button variant="outline" type="button" onClick={handleCancel}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Add New Organization</h1>
                <p className="text-muted-foreground">
                  Create a new organization and optionally assign administrators.
                </p>
              </div>

              <Button className="min-w-[150px]" onClick={handleAddUser} disabled={!isAddUserEnabled()}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            {/* Organization Form */}
            <OrganizationForm
              isNew={true}
              orgId={orgIdFromUrl}
              onNameChange={setOrgName}
              onDashboardAccessChange={setDashboardAccess}
              onModuleAccessChange={setModuleAccessList}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
