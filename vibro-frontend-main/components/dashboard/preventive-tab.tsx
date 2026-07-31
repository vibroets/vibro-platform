"use client"

import { useState, useEffect } from "react"
import axiosInstance from "@/utils/axiosInstance"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Activity,
} from "lucide-react"

interface PreventiveItem {
  id: number
  planner_name?: string
  form_title?: string
  start_date?: string
  end_date?: string
  is_completed?: boolean
  started_by?: string | null
  started_on?: string | null
  completed_on?: string | null
  user?: string | null
  group?: string | null
  leader?: string | null
}

function getStatus(item: PreventiveItem): string {
  if (item.is_completed) return "Completed"
  if (item.started_by || item.started_on) return "In Progress"
  return "Not Started"
}

const STATUS_STYLES: Record<string, string> = {
  Completed: "bg-green-100 text-green-700 border-green-300",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-300",
  "Not Started": "bg-slate-100 text-slate-600 border-slate-300",
}

export function PreventiveTab() {
  const [data, setData] = useState<PreventiveItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        setLoading(true)
        const response = await axiosInstance.get("/planner/all-planners/")
        const all = (response.data || []) as PreventiveItem[]
        const filtered = all.filter((item) => {
          const name = (item.planner_name || item.form_title || "").toLowerCase()
          return name.includes("preventive") || name.includes("maintenance")
        })
        if (!cancelled) setData(filtered)
      } catch (err) {
        console.error("Failed to fetch preventive data:", err)
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const total = data.length
  const completed = data.filter((d) => d.is_completed).length
  const inProgress = data.filter((d) => !d.is_completed && (d.started_by || d.started_on)).length
  const notStarted = data.filter((d) => !d.is_completed && !d.started_by && !d.started_on).length

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Preventive</CardTitle>
            <ShieldCheck className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : total}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Completed</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : completed}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">In Progress</CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : inProgress}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Not Started</CardTitle>
            <AlertTriangle className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : notStarted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-slate-500" />
            Preventive Maintenance Tasks
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Planners related to preventive maintenance activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Activity className="h-5 w-5 animate-pulse text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading preventive tasks...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No preventive maintenance tasks found.
            </div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Task Name</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Form</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Assignee</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Start Date</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">End Date</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => {
                    const status = getStatus(item)
                    const assignee = item.user || item.group || item.leader || "Unassigned"
                    return (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2 text-slate-700">{item.planner_name || "-"}</td>
                        <td className="px-4 py-2 text-slate-600">{item.form_title || "-"}</td>
                        <td className="px-4 py-2 text-slate-600">{assignee}</td>
                        <td className="px-4 py-2 text-slate-600">{item.start_date || "-"}</td>
                        <td className="px-4 py-2 text-slate-600">{item.end_date || "-"}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={STATUS_STYLES[status]}>
                            {status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
