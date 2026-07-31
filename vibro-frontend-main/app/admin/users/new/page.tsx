"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, Dispatch, SetStateAction } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

// Dynamic imports for SSR-sensitive components
const SingleUserForm = dynamic(
  () => import("@/components/admin/single-user-form").then(mod => mod.SingleUserForm),
  { ssr: false }
)

const Sidebar = dynamic(
  () => import("@/components/sidebar").then(mod => mod.Sidebar),
  { ssr: false }
)

const Header = dynamic(
  () => import("@/components/header").then(mod => mod.Header),
  { ssr: false }
)

const Button = dynamic(
  () => import("@/components/ui/button").then(mod => mod.Button),
  { ssr: false }
)

const ArrowLeft = dynamic(
  () => import("lucide-react").then(mod => mod.ArrowLeft),
  { ssr: false }
)

export default function NewUserPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
    </Suspense>
  )
}

function PageContent({
  isSidebarOpen,
  setIsSidebarOpen,
}: {
  isSidebarOpen: boolean
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>> // ✅ Correct typing
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") // "edit" or null
  const orgId = searchParams.get("orgId") // organization ID if any
  const userinfo = useSelector(selectUser);
  const currentuserrole = userinfo?.role_details.name === "admin";
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSuperAdminBack = async () => {
  // If mode is edit → NEVER delete draft
  if (mode === "edit") {
    if (orgId) {
      router.push(`/admin/organizations/${orgId}/edit`);
    } else {
      router.push("/admin?tab=users");
    }
    return;
  }

  // Otherwise → delete draft
  if (orgId && !currentuserrole) {
    setIsLoading(true);
    try {
      const res = await axiosInstance.delete(`/organization/delete-draft/${orgId}/`);
      if (res.status === 200 || res.status === 204) {
        router.push("/admin/organizations/new");
      } else {
        toast({
          title: "Error",
          description: "Unexpected response while deleting the draft.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to delete draft organization:", err);
      toast({
        title: "Error",
        description: "Failed to delete the draft organization.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
    return;
  }

  // Default back for Add User from /admin?tab=users
  router.push("/admin?tab=users");
  };


  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300 ${
            isSidebarOpen ? "md:pl-8" : "md:pl-14"
          }`}
        >
          <div className="p-4 md:p-6">
            <div className="space-y-6">
              <div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    if (currentuserrole) {
                      // Admin user
                      if (orgId) {
                        router.push(`/admin/organizations/${orgId}/edit`);
                      } else {
                        router.push("/admin?tab=users");
                      }
                    } else {
                      // Super admin - use enhanced logic with delete-draft when needed
                      handleSuperAdminBack();
                    }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">Add New User</h1>
                <p className="text-muted-foreground">
                  Create a new user account with appropriate permissions
                </p>
              </div>

              <SingleUserForm
                handleSuperAdminBack={handleSuperAdminBack}
                isSuperAdmin={!currentuserrole}
                orgId={orgId}
                isLoading={isLoading}
                mode={mode}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

