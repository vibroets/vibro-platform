"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import dynamic from "next/dynamic";

const GuideManagement = dynamic(
  () => import("@/components/admin/guide-management").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="text-center text-gray-500 font-medium p-8">Loading guides...</div>
    ),
  }
);

export default function GuidesPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "md:ml-12"
        }`}
      >
        <div className={!isSidebarOpen ? "pl-12" : ""}>
          <Header
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
            title="Guides"
            description="Upload and share SOPs, tutorials, QAPs, drawings, and reports"
          />
        </div>
        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300 ${
            isSidebarOpen ? "md:pl-8" : "md:pl-14"
          }`}
        >
          <div className="p-4 md:p-6">
            <GuideManagement />
          </div>
        </div>
      </div>
    </div>
  );
}
