"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import dynamic from "next/dynamic";

const AdminTabs = dynamic(
  () => import("@/components/admin/admin-tabs").then((mod) => mod.AdminTabs),
  {
    ssr: false,
    loading: () => (
      <div className="text-center text-gray-500 font-medium ">Loading tabs...</div>
    ),
  }
);

export default function AdminPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen ">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}
      >
        {/* Pad only the header/title when sidebar is minimized */}
        <div className={!isSidebarOpen ? "pl-12" : ""}>
          <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title="Administration" description="Manage users, roles, and system settings" step="header" />
        </div>
        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300  ${isSidebarOpen ? "md:pl-8" : "md:pl-14"}`}
        >
          <div className="p-4 md:p-6">
            <div>
              <p className="text-muted-foreground ">
                Manage users, groups, and system settings
              </p >
              {/* </div> */}

              {/* <Suspense fallback={<div>Loading admin tabs...</div>}> */}
              <AdminTabs />
              {/* </Suspense>   */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
