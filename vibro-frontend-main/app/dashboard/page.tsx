"use client"

import { useState } from "react"
import { PlannerDashboard } from "@/components/planner/planner-dashboard"
import { DashboardFooter } from "@/components/dashboard-footer"
import { PreventiveTab } from "@/components/dashboard/preventive-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 border-b border-gray-300 shadow-md gap-x-0">
          <TabsTrigger value="overview" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">
            Planner Overview
          </TabsTrigger>
          <TabsTrigger value="preventive" className="text-black hover:text-white hover:bg-blue-600 data-[state=active]:bg-blue-200">
            Preventive
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <PlannerDashboard />
        </TabsContent>
        <TabsContent value="preventive" className="mt-4">
          <PreventiveTab />
        </TabsContent>
      </Tabs>
      <DashboardFooter />
    </div>
  )
}
