"use client";

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";

// Dynamically import the AnnouncementShare component, SSR disabled
const AnnouncementShare = dynamicImport(
  () => import("@/components/announcements/announcement-share"),
  { ssr: false }
);

// Tell Next.js this page should always render dynamically
export const dynamic = "force-dynamic";

export default function AnnouncementSharePage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("announcements", "full_access", {
    redirectInsufficient: "/announcements",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push("/announcements")} />
        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300 bg-neutral-100 ${
            isSidebarOpen ? "md:pl-8" : "md:pl-20"
          }`}
        >
          <AnnouncementShare />
        </div>
      </div>
    </div>
  );
}
