"use client";

import { useState } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";

// Dynamically import the named TaskShare component, SSR disabled
const TaskShare = dynamicImport(
  () => import("@/components/tasks/task-share").then(mod => mod.TaskShare),
  { ssr: false }
);

// Tell Next.js this page should always render dynamically
export const dynamic = "force-dynamic";

export default function TaskSharePage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("tasks", "full_access", {
    redirectInsufficient: "/tasks",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onBack={() => router.push("/tasks")} />
        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300 bg-neutral-100 ${
            isSidebarOpen ? "md:pl-8" : "md:pl-20"
          }`}
        >
          <TaskShare />
        </div>
      </div>
    </div>
  );
}
