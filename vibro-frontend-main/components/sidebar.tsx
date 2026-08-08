"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Megaphone,
  ClipboardList,
  CheckSquare,
  BarChart,
  GraduationCap,
  Calendar,
  Clock,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  CalendarDays,
  UserCog,
  MapPin,
  UserPlus,
  CheckCircle,
  Bell,
  Mail,
  UserCheck,
  Save,
  LayoutDashboard,
  MailQuestion,
  FolderOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useUser } from "@/components/user-provider"
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useFormStore } from "@/utils/formStore"


export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const pathname = usePathname()
  const router = useRouter();     // <-- ADD this
  const [pendingRoute, setPendingRoute] = useState<string | null>(null); // <-- ADD
  const [showConfirm, setShowConfirm] = useState(false);
  const [learningExpanded, setLearningExpanded] = useState(pathname.startsWith("/learning"));
  const { isFormDirty, setIsFormDirty } = useFormStore();
  // const { user } = useUser()
  const userinfo = useSelector(selectUser);
  if (!userinfo) return null // or return loading

  // console.log("userinfo?.module_permissions >>>> ", userinfo?.module_permissions);

  const isOnFormsPage = pathname.startsWith("/forms");

  // Intercept navigation from sidebar
  const handleNavClick = (href: string) => {
    if (isOnFormsPage && href !== "/forms" && isFormDirty) {
      setPendingRoute(href);
      setShowConfirm(true);
    } else {
      // 👇 trigger loader right away
      window.dispatchEvent(new Event("route-loader-start"));
      router.push(href);
      setIsOpen(true); // optional: close sidebar on mobile
    }
  };

  //  const handleNavClick = (href: string) => {
  //     router.push(href);
  //     // setIsOpen(false); // for mobile close
  // };

  const confirmNavigation = () => {
    if (pendingRoute) {
      setIsFormDirty(false);

      // 👇 trigger loader here too
      window.dispatchEvent(new Event("route-loader-start"));
      router.push(pendingRoute);

      setShowConfirm(false);
      setPendingRoute(null);
      setIsOpen(false); // close sidebar on mobile if needed
    }
  };


  const routes = [
    {
      label: "Dashboard",
      icon: BarChart3,
      href: "/dashboard",
      active: pathname === "/dashboard",
      moduleKey: "dashboard",
    },
    {
      label: "Announcements",
      icon: Megaphone,
      href: "/announcements",
      active: pathname === "/announcements",
      moduleKey: "announcements",
    },
    {
      label: "Forms",
      icon: ClipboardList,
      href: "/forms",
      active: pathname === "/forms",
      moduleKey: "forms",
    },
    {
      label: "Tasks",
      icon: CheckSquare,
      href: "/tasks",
      active: pathname === "/tasks",
      moduleKey: "tasks",
    },
    {
      label: "Polls",
      icon: BarChart,
      href: "/polls",
      active: pathname === "/polls",
      moduleKey: "polls",
    },
    {
      label: "Learning & Training",
      icon: GraduationCap,
      href: "/learning",
      active: pathname.startsWith("/learning"),
      moduleKey: "learning_training",
      expandable: true,
      children: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/learning", moduleKey: "learning_training" },
        { label: "L&T Module", icon: BookOpen, href: "/learning/lt-module", moduleKey: "learning_training" },
        { label: "Training Calendar", icon: CalendarDays, href: "/learning/training-calendar", moduleKey: "learning_training" },
        { label: "Trainer Management", icon: UserCog, href: "/learning/trainer-management", moduleKey: "learning_training" },
        { label: "Venue Management", icon: MapPin, href: "/learning/venue-management", moduleKey: "learning_training" },
        { label: "Participant Enrollment", icon: UserPlus, href: "/learning/participant-enrollment", moduleKey: "learning_training" },
        { label: "Approval Workflow", icon: CheckCircle, href: "/learning/approval-workflow", moduleKey: "learning_training" },
        { label: "Training Analytics", icon: BarChart3, href: "/learning/analytics", moduleKey: "learning_training" },
        { label: "Notifications", icon: Bell, href: "/learning/notifications", moduleKey: "learning_training" },
        { label: "Notification Log", icon: Mail, href: "/learning/notification-log", moduleKey: "learning_training" },
        { label: "Attendance", icon: UserCheck, href: "/learning/attendance", moduleKey: "learning_training" },
        { label: "Drafts", icon: Save, href: "/learning/drafts", moduleKey: "learning_training" },
        { label: "Admin Dashboard", icon: LayoutDashboard, href: "/learning/admin-dashboard", moduleKey: "learning_training" },
      ],
    },
    {
      label: "Planner",
      icon: Calendar,
      href: "/planner",
      active: pathname === "/planner",
      moduleKey: "planner",
    },
    {
      label: "Attendance",
      icon: Clock,
      href: "/attendance",
      active: pathname === "/attendance",
      moduleKey: "attendance",
    },
    {
      label: "Guides",
      icon: FolderOpen,
      href: "/guides",
      active: pathname.startsWith("/guides"),
      moduleKey: "guides",
    },
    {
      label: "Administration",
      icon: Settings,
      href: "/admin",
      active: pathname.startsWith("/admin"),
      moduleKey: "administration",
    },
  ]

  const priority = {
    no_access: 0,
    view_only: 1,
    full_access: 2,
  };

  // Convert user and org permissions to maps
  const userAccessMap = new Map(
    (userinfo?.module_access || []).map((perm) => [perm.module.toLowerCase(), perm.access])
  );

  const orgAccessMap = new Map(
    (userinfo?.module_permissions || []).map((perm) => [perm.module.toLowerCase(), perm.access])
  );

  // Helper to get final access
  function getEffectiveAccess(moduleKey: string): "no_access" | "view_only" | "full_access" {
    const orgAccess = orgAccessMap.get(moduleKey) ?? "no_access";

    // If org gives no access, return no access regardless of user access
    if (orgAccess === "no_access") return "no_access";

    // If user has no explicit entry for this module, inherit from org
    const userAccess = userAccessMap.get(moduleKey) ?? orgAccess;

    // Else, return the lesser of org and user access (most restrictive)
    return priority[orgAccess] < priority[userAccess] ? orgAccess : userAccess;
  }


  const isSuperAdmin = userinfo.role_details?.name?.toLowerCase() === "super_admin";

  // Only allow modules where access is NOT 'no_access'
  const allowedModules = new Set(
    isSuperAdmin
      ? routes.map((route) => route.moduleKey.toLowerCase())
      : routes
        .map((route) => {
          const access = getEffectiveAccess(route.moduleKey.toLowerCase());
          // console.log(
          //   `[DEBUG] Module: ${route.moduleKey.toLowerCase()}, OrgAccess: ${orgAccessMap.get(
          //     route.moduleKey.toLowerCase()
          //   )}, UserAccess: ${userAccessMap.get(route.moduleKey.toLowerCase())}, FinalAccess: ${access}`
          // );
          return access !== "no_access" ? route.moduleKey.toLowerCase() : null;
        })
        .filter(Boolean) // remove nulls
  );

  // console.log("[DEBUG] module_permissions", userinfo?.module_permissions);
  // console.log("[DEBUG] module_access", userinfo?.module_access);



  let filteredRoutes = routes
    .filter((route) => allowedModules.has(route.moduleKey.toLowerCase()))
    .map((route) => ({
      ...route,
      active: pathname.startsWith(route.href),
    }))

  // Only show admin for Super Admin and Admin roles
    // if (isSuperAdmin || ["admin", "location_leader"].includes(userinfo.role_details?.name?.toLowerCase()))
    if (
      isSuperAdmin ||
      userinfo.role_details?.name?.toLowerCase() === "admin"
    ) {
      // Administration is now in routes array and filtered by module access
      // Only ensure it shows for admin/super_admin roles even if module access is not set
      if (!filteredRoutes.some(r => r.href === "/admin")) {
        filteredRoutes.push({
          label: "Administration",
          icon: Settings,
          href: "/admin",
          moduleKey: "administration",
          active: pathname.startsWith("/admin"),
        });
      }
    }

    if (isSuperAdmin) {
      filteredRoutes.push({
        label: "Enquiry",
        icon: MailQuestion,
        href: "/enquiry",
        moduleKey: "enquiry",
        active: pathname.startsWith("/enquiry"),
      });
    }


  return (
    <>
      {/* Sidebar toggle button - visible on all sizes */}
      <Button
        size="icon"
        className="fixed top-4 left-2 z-50"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* sidebar icon while closed */}
      <nav>
        {!isOpen && (
          <div className="fixed top-16 pt-2 left-1 z-20 flex flex-col space-y-0">
            {filteredRoutes.map((route: any) => (
              <button
                key={route.href}
                onClick={() => {
                  if (route.expandable) {
                    setLearningExpanded(!learningExpanded);
                    setIsOpen(true);
                  } else {
                    handleNavClick(route.href);
                  }
                }}
                className={`group relative h-9 w-8 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white ${route.active ? "bg-blue-200" : "bg-transparent"}`}>
                <route.icon className="h-4 w-4" />
                <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20 whitespace-nowrap text-xs rounded bg-blue-200 px-1 py-1 text-black opacity-0 group-hover:opacity-100 transition-opacity duration-300" >
                  {route.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </nav>


      <div
        className={cn("fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden", isOpen ? "block" : "hidden")}
        onClick={() => setIsOpen(false)}
      />

      {/* this line is for viewing ham burger */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-blue-50 border-r transition-transform translate-x-0 overflow-y-auto",
          isOpen ? "translate-x-0 " : "-translate-x-full",
        )}
      >


        <div className="flex h-16 items-center border-b px-4  border-gray-300 shadow-md ">
          <div className="flex items-center gap-2 font-bold text-xl ml-16">
            <span className="text-primary">VIBRO</span>
            {userinfo?.organization_name && (
              <span className="text-sm font-normal text-muted-foreground truncate max-w-[100px]">
                | {userinfo.organization_name}
              </span>
            )}
          </div>
        </div>
        <nav className="grid gap-1 p-2">
          {filteredRoutes.map((route: any) => (
            <div key={route.href}>
              <button
                onClick={() => {
                  if (route.expandable) {
                    setLearningExpanded(!learningExpanded);
                    // Only navigate if not already on this route
                    if (!pathname.startsWith(route.href)) {
                      handleNavClick(route.href);
                    }
                  } else {
                    handleNavClick(route.href);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-600 hover:text-white w-full",
                  route.active ? "bg-blue-200" : "transparent",
                )}
              >
                <route.icon className={`h-5 w-5 ${isOpen ? "translate-x-0" : "-translate-x-full"}`} />
                <span className="flex-1 text-left">{route.label}</span>
                {route.expandable && (
                  <span className="ml-auto">
                    {learningExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                )}
              </button>
              {route.expandable && learningExpanded && route.children && (
                <div className="ml-6 mt-0.5 grid gap-0.5">
                  {route.children.map((child: any) => (
                    <button
                      key={child.href}
                      onClick={() => handleNavClick(child.href)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-600 hover:text-white",
                        pathname === child.href ? "bg-blue-100 text-blue-700" : "text-gray-600",
                      )}
                    >
                      <child.icon className="h-4 w-4" />
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Auto-close sidebar when switching to small screens to prevent overlay covering content */}
      <AutoCloseOnBreakpoint isOpen={isOpen} setIsOpen={setIsOpen} />

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            You have unsaved changes in the form. Do you really want to leave this page?
          </div>
          <DialogFooter className="mt-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmNavigation}>
              Yes, Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}

function AutoCloseOnBreakpoint({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  useEffect(() => {
    const handler = () => {
      // md breakpoint ~ 768px
      if (window.innerWidth < 768 && isOpen) {
        setIsOpen(false);
      }
    };
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [isOpen, setIsOpen]);
  return null;
}
