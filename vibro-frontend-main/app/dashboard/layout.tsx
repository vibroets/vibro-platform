"use client";

import type React from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { selectAccessToken, selectHydrated, selectUser } from "@/redux/slices/authSlice";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const router = useRouter();
  const accessToken = useSelector(selectAccessToken); // 🔥 Get token from Redux
  const isHydrated = useSelector(selectHydrated);
  const userinfo = useSelector(selectUser);

  useEffect(() => {
    if (isHydrated && !accessToken) {
      router.push("/login");
    }
  }, [isHydrated, accessToken, router]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!accessToken) return;
    if (!userinfo) return;

    const isSuperAdmin =
      Boolean(userinfo?.is_superadmin) ||
      userinfo?.role_details?.name?.toLowerCase() === "super_admin";
    if (isSuperAdmin) return;

    const priority = {
      no_access: 0,
      view_only: 1,
      full_access: 2,
    } as const;

    type AccessLevel = keyof typeof priority;

    const userAccessMap = new Map(
      (userinfo?.module_access || []).map((perm) => [
        String(perm.module).toLowerCase(),
        perm.access as AccessLevel,
      ])
    );

    const orgAccessMap = new Map(
      (userinfo?.module_permissions || []).map((perm) => [
        String(perm.module).toLowerCase(),
        perm.access as AccessLevel,
      ])
    );

    function getEffectiveAccess(moduleKey: string): AccessLevel {
      const key = moduleKey.toLowerCase();
      const org = orgAccessMap.get(key) ?? "no_access";
      const user = userAccessMap.get(key) ?? "no_access";
      return priority[org] <= priority[user] ? org : user;
    }

    if (getEffectiveAccess("dashboard") !== "no_access") return;

    const fallback = [
      { moduleKey: "announcements", href: "/announcements" },
      { moduleKey: "forms", href: "/forms" },
      { moduleKey: "tasks", href: "/tasks" },
      { moduleKey: "polls", href: "/polls" },
      { moduleKey: "learning_training", href: "/learning" },
      { moduleKey: "planner", href: "/planner" },
      { moduleKey: "attendance", href: "/attendance" },
    ].find((c) => getEffectiveAccess(c.moduleKey) !== "no_access");

    router.replace(fallback?.href ?? "/login");
  }, [accessToken, isHydrated, router, userinfo]);

  if (!isHydrated) {
    return <div className="p-6">Loading...</div>;
  }


  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      {/* <div className="md:ml-64 transition-all duration-300"> */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-12"}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Dashboard" description="Welcome to VIBRO, your operational excellence tool." />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
