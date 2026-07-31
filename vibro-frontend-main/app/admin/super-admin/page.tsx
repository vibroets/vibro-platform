"use client";

import { SuperAdminFeatures } from "@/components/admin/super-admin-features";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SuperAdminPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : ""
        }`}
      >
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300 ${
            isSidebarOpen ? "md:pl-8" : "md:pl-14"
          }`}
        >
          <div className="pl-4 md:pl-6 ">
            <div className="space-y-6">
              <div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => router.push("/admin?tab=super-admin")}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Super Admin Features
                </h1>
                <p className="text-muted-foreground">
                  Advanced administration tools and system management
                </p>
              </div>

              <SuperAdminFeatures />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
