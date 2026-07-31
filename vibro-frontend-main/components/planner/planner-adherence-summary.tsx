"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertCircle, Clock } from "lucide-react"

export function PlannerAdherenceSummary() {
  // This would typically come from an API or state
  const adherenceData = {
    overall: 78,
    byLocation: [
      { name: "Warehouse A", adherence: 92, status: "good" },
      { name: "Warehouse B", adherence: 68, status: "warning" },
      { name: "Office Building", adherence: 85, status: "good" },
      { name: "Distribution Center", adherence: 45, status: "critical" },
    ],
    byFormType: [
      { name: "Safety Inspection", adherence: 95, status: "good" },
      { name: "Inventory Check", adherence: 72, status: "warning" },
      { name: "Maintenance Request", adherence: 65, status: "warning" },
      { name: "Quality Control", adherence: 80, status: "good" },
    ],
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planner Adherence Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Overall Adherence</h3>
            <span className="font-medium">{adherenceData.overall}%</span>
          </div>
          <Progress value={adherenceData.overall} className="h-2" />
        </div>

        <div>
          <h3 className="font-medium mb-3">Adherence by Location</h3>
          <div className="space-y-3">
            {adherenceData.byLocation.map((location) => (
              <div key={location.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  {location.status === "good" && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
                  {location.status === "warning" && <Clock className="h-4 w-4 text-amber-500 mr-2" />}
                  {location.status === "critical" && <AlertCircle className="h-4 w-4 text-red-500 mr-2" />}
                  <span>{location.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={location.adherence} className="h-2 w-24" />
                  <span className="text-sm">{location.adherence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">Adherence by Form Type</h3>
          <div className="space-y-3">
            {adherenceData.byFormType.map((formType) => (
              <div key={formType.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  {formType.status === "good" && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
                  {formType.status === "warning" && <Clock className="h-4 w-4 text-amber-500 mr-2" />}
                  {formType.status === "critical" && <AlertCircle className="h-4 w-4 text-red-500 mr-2" />}
                  <span>{formType.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={formType.adherence} className="h-2 w-24" />
                  <span className="text-sm">{formType.adherence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
