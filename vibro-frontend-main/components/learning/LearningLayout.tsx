"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";

export default function LearningLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("learning_training", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  if (!hydrated || !hasRequiredAccess) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} title={title} description={description || ""} />
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
