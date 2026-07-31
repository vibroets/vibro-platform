"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import axiosInstance from "@/utils/axiosInstance"
import { selectHydrated, selectUser } from "@/redux/slices/authSlice"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import GlobalLoader from "@/components/ui/globalloader"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  TrendingUp,
  XCircle,
  FileText,
  Repeat,
  ThumbsUp,
  ChevronDown,
  ChevronRight,
  MapPin,
} from "lucide-react"
import { FolderPieCharts } from "@/components/planner/folder-pie-charts"

interface PlannerAssignment {
  id: number
  planner_name?: string
  form_title?: string
  start_date?: string
  end_date?: string
  planner_shared_on?: string
  is_completed?: boolean
  started_by?: string | null
  started_on?: string | null
  completed_on?: string | null
  user?: string | null
  group?: string | null
  leader?: string | null
  non_completion_reason?: string | null
  reason_status?: string | null
  rejection_reason?: string | null
  rejection_questions?: any[] | null
  rejection_answers?: any[] | null
  extended_due_date?: string | null
  reason_history?: any[] | null
  repeat_enabled?: boolean
  repeat_interval_days?: number
  early_notification_days?: number
  parent_planner_id?: number | null
  repeat_generation_date?: string | null
  folder_id?: number | null
  folder_name?: string | null
  folder_color?: string | null
  order_id?: string | null
  location?: number | null
  location_name?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  Completed: "#22c55e",
  "In Progress": "#f59e0b",
  "Not Started": "#64748b",
}

const TYPE_COLORS: Record<string, string> = {
  User: "#8b5cf6",
  Group: "#ec4899",
  Leader: "#3b82f6",
}

const HEALTH_COLORS: Record<string, string> = {
  Overdue: "#ef4444",
  "On Track": "#3b82f6",
  Completed: "#22c55e",
}

function getStatus(item: PlannerAssignment): string {
  if (item.is_completed) return "Completed"
  if (item.started_by || item.started_on) return "In Progress"
  return "Not Started"
}

function getAssignmentType(item: PlannerAssignment): string {
  if (item.user) return "User"
  if (item.group) return "Group"
  if (item.leader) return "Leader"
  return "Unassigned"
}

export function PlannerDashboard() {
  const hydrated = useSelector(selectHydrated)
  const reduxUser = useSelector(selectUser)
  const [data, setData] = useState<PlannerAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hydrated || !reduxUser) return
    let cancelled = false
    async function fetchData() {
      try {
        setLoading(true)
        const response = await axiosInstance.get("/planner/all-planners/")
        if (!cancelled) setData(response.data || [])
      } catch (err) {
        console.error("Failed to fetch planner dashboard data:", err)
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [hydrated, reduxUser])

  const today = useMemo(() => new Date(), [])

  const metrics = useMemo(() => {
    const total = data.length
    const completed = data.filter((d) => d.is_completed).length
    const inProgress = data.filter((d) => !d.is_completed && (d.started_by || d.started_on)).length
    const notStarted = total - completed - inProgress
    const pending = inProgress + notStarted
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const overdue = data.filter((d) => {
      if (d.is_completed) return false
      if (!d.end_date) return false
      return differenceInCalendarDays(parseISO(d.end_date), today) < 0
    }).length
    const allRepeatPlanners = data.filter((d) => d.repeat_enabled)
    const seenNames = new Set<string>()
    const uniqueRepeatPlanners = allRepeatPlanners.filter((d) => {
      const name = d.planner_name || d.form_title || "Unnamed"
      if (seenNames.has(name)) return false
      seenNames.add(name)
      return true
    })
    const repeatEnabled = uniqueRepeatPlanners.length
    const repeatPlanners = allRepeatPlanners
    return { total, completed, inProgress, notStarted, pending, completionRate, overdue, repeatEnabled, repeatPlanners }
  }, [data, today])

  const statusData = useMemo(
    () => [
      { name: "Completed", value: metrics.completed, color: STATUS_COLORS["Completed"] },
      { name: "In Progress", value: metrics.inProgress, color: STATUS_COLORS["In Progress"] },
      { name: "Not Started", value: metrics.notStarted, color: STATUS_COLORS["Not Started"] },
    ],
    [metrics]
  )

  const typeData = useMemo(() => {
    const counts: Record<string, number> = { User: 0, Group: 0, Leader: 0, Unassigned: 0 }
    data.forEach((d) => {
      const type = getAssignmentType(d)
      counts[type] = (counts[type] || 0) + 1
    })
    return [
      { name: "User", value: counts.User, color: TYPE_COLORS.User },
      { name: "Group", value: counts.Group, color: TYPE_COLORS.Group },
      { name: "Leader", value: counts.Leader, color: TYPE_COLORS.Leader },
    ].filter((d) => d.value > 0)
  }, [data])

  const healthData = useMemo(() => {
    const onTrack = data.filter((d) => {
      if (d.is_completed) return false
      if (!d.end_date) return true
      return differenceInCalendarDays(parseISO(d.end_date), today) >= 0
    }).length
    return [
      { name: "Completed", value: metrics.completed, color: HEALTH_COLORS.Completed },
      { name: "On Track", value: onTrack, color: HEALTH_COLORS["On Track"] },
      { name: "Overdue", value: metrics.overdue, color: HEALTH_COLORS.Overdue },
    ].filter((d) => d.value > 0)
  }, [data, metrics.completed, metrics.overdue, today])

  const trendData = useMemo(() => {
    const days = 14
    const dates: Date[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      dates.push(d)
    }
    return dates.map((d) => {
      const key = format(d, "yyyy-MM-dd")
      const display = format(d, "MMM dd")
      const planned = data.filter((item) => {
        if (!item.end_date) return false
        return item.end_date.split("T")[0] === key
      }).length
      const actual = data.filter((item) => {
        if (!item.completed_on) return false
        return item.completed_on.split("T")[0] === key
      }).length
      return { date: display, planned, actual }
    })
  }, [data, today])

  // --- Approval Flow Analytics ---
  const approvalMetrics = useMemo(() => {
    const overduePlanners = data.filter((d) => {
      if (d.is_completed) return false
      if (!d.end_date) return false
      return differenceInCalendarDays(parseISO(d.end_date), today) < 0
    })

    const withReason = overduePlanners.filter((d) => d.non_completion_reason || d.reason_status !== 'pending' || d.rejection_reason)
    const pendingReason = overduePlanners.filter((d) => d.reason_status === 'pending' && d.non_completion_reason)
    const approvedReason = overduePlanners.filter((d) => d.reason_status === 'approved')
    const rejectedReason = overduePlanners.filter((d) => d.reason_status === 'rejected')
    const noReason = overduePlanners.filter((d) => !d.non_completion_reason && d.reason_status === 'pending' && !d.rejection_reason)

    // Cycle analysis from reason_history
    let totalSubmissions = 0
    let totalRejections = 0
    let totalApprovals = 0
    const rejectionsPerPlanner: Record<number, number> = {}

    data.forEach((d) => {
      if (d.reason_history && d.reason_history.length > 0) {
        d.reason_history.forEach((h: any) => {
          if (h.action === 'submitted') totalSubmissions++
          if (h.action === 'rejected') {
            totalRejections++
            rejectionsPerPlanner[d.id] = (rejectionsPerPlanner[d.id] || 0) + 1
          }
          if (h.action === 'approved') totalApprovals++
        })
      }
    })

    const approvedAfterSingleRejection = Object.values(rejectionsPerPlanner).filter(r => r === 1).length
    const approvedAfterMultipleRejections = Object.values(rejectionsPerPlanner).filter(r => r >= 2).length
    const currentlyRejected = data.filter((d) => d.reason_status === 'rejected').length
    const avgCyclesToApprove = totalApprovals > 0 ? (totalSubmissions / totalApprovals).toFixed(1) : '0'
    const approvalRate = totalSubmissions > 0 ? Math.round((totalApprovals / totalSubmissions) * 100) : 0
    const rejectionRate = totalSubmissions > 0 ? Math.round((totalRejections / totalSubmissions) * 100) : 0

    return {
      overdueTotal: overduePlanners.length,
      withReason: withReason.length,
      pendingReason: pendingReason.length,
      approvedReason: approvedReason.length,
      rejectedReason: rejectedReason.length,
      noReason: noReason.length,
      totalSubmissions,
      totalRejections,
      totalApprovals,
      approvedAfterSingleRejection,
      approvedAfterMultipleRejections,
      currentlyRejected,
      avgCyclesToApprove,
      approvalRate,
      rejectionRate,
    }
  }, [data, today])

  const reasonStatusData = useMemo(() => {
    return [
      { name: 'No Reason Given', value: approvalMetrics.noReason, color: '#94a3b8' },
      { name: 'Pending Review', value: approvalMetrics.pendingReason, color: '#f59e0b' },
      { name: 'Approved', value: approvalMetrics.approvedReason, color: '#22c55e' },
      { name: 'Rejected', value: approvalMetrics.rejectedReason, color: '#ef4444' },
    ].filter(d => d.value > 0)
  }, [approvalMetrics])

  const approvalFlowData = useMemo(() => {
    return [
      { name: 'Approved (No Rejection)', value: approvalMetrics.totalApprovals - approvalMetrics.approvedAfterSingleRejection - approvalMetrics.approvedAfterMultipleRejections, color: '#22c55e' },
      { name: 'Approved After 1 Rejection', value: approvalMetrics.approvedAfterSingleRejection, color: '#3b82f6' },
      { name: 'Approved After 2+ Rejections', value: approvalMetrics.approvedAfterMultipleRejections, color: '#8b5cf6' },
      { name: 'Currently Rejected', value: approvalMetrics.currentlyRejected, color: '#ef4444' },
    ].filter(d => d.value > 0)
  }, [approvalMetrics])

  const cycleDistributionData = useMemo(() => {
    const buckets: Record<string, number> = {
      '1 Cycle': 0,
      '2 Cycles': 0,
      '3 Cycles': 0,
      '4+ Cycles': 0,
    }
    data.forEach((d) => {
      if (d.reason_history && d.reason_history.length > 0) {
        const submits = d.reason_history.filter((h: any) => h.action === 'submitted').length
        if (submits === 1) buckets['1 Cycle']++
        else if (submits === 2) buckets['2 Cycles']++
        else if (submits === 3) buckets['3 Cycles']++
        else if (submits >= 4) buckets['4+ Cycles']++
      }
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [data])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <GlobalLoader />
      </div>
    )
  }

  return (
    <div className="space-y-3 overflow-y-auto pr-1 max-h-[calc(100vh-8rem)] mt-0">
      {/* KPI Cards - General (Radiant Gradient) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-blue-100 font-semibold">Total Planners</p>
              <p className="text-xl font-bold mt-0.5">{metrics.total}</p>
            </div>
            <Layers className="h-7 w-7 text-blue-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-100 font-semibold">Pending</p>
              <p className="text-xl font-bold mt-0.5">{metrics.pending}</p>
              <p className="text-[9px] text-amber-100 mt-0.5">{metrics.inProgress} in progress, {metrics.notStarted} not started</p>
            </div>
            <Clock className="h-7 w-7 text-amber-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-100 font-semibold">Completed</p>
              <p className="text-xl font-bold mt-0.5">{metrics.completed}</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-violet-100 font-semibold">Completion Rate</p>
              <p className="text-xl font-bold mt-0.5">{metrics.completionRate}%</p>
            </div>
            <TrendingUp className="h-7 w-7 text-violet-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-rose-100 font-semibold">Overdue</p>
              <p className="text-xl font-bold mt-0.5">{metrics.overdue}</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-rose-100 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Approval Flow (Radiant Gradient) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-red-500 to-rose-700 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-red-100 font-semibold">Overdue Total</p>
              <p className="text-xl font-bold mt-0.5">{approvalMetrics.overdueTotal}</p>
              <p className="text-[9px] text-red-100 mt-0.5">{approvalMetrics.noReason} no reason, {approvalMetrics.withReason} with reason</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-red-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sky-100 font-semibold">Reasons Submitted</p>
              <p className="text-xl font-bold mt-0.5">{approvalMetrics.totalSubmissions}</p>
              <p className="text-[9px] text-sky-100 mt-0.5">Total submission cycles</p>
            </div>
            <FileText className="h-7 w-7 text-sky-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-green-100 font-semibold">Approved</p>
              <p className="text-xl font-bold mt-0.5">{approvalMetrics.totalApprovals}</p>
              <p className="text-[9px] text-green-100 mt-0.5">{approvalMetrics.approvalRate}% approval rate</p>
            </div>
            <ThumbsUp className="h-7 w-7 text-green-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-pink-500 to-rose-700 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-pink-100 font-semibold">Currently Rejected</p>
              <p className="text-xl font-bold mt-0.5">{approvalMetrics.currentlyRejected}</p>
              <p className="text-[9px] text-pink-100 mt-0.5">Awaiting user response</p>
            </div>
            <XCircle className="h-7 w-7 text-pink-100 opacity-80" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-fuchsia-100 font-semibold">Avg Cycles</p>
              <p className="text-xl font-bold mt-0.5">{approvalMetrics.avgCyclesToApprove}</p>
              <p className="text-[9px] text-fuchsia-100 mt-0.5">{approvalMetrics.rejectionRate}% rejection rate</p>
            </div>
            <Repeat className="h-7 w-7 text-fuchsia-100 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Repeat Planner KPI (Radiant Gradient) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-md">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-indigo-100 font-semibold">Repeat-Enabled</p>
              <p className="text-xl font-bold mt-0.5">{metrics.repeatEnabled}</p>
              <p className="text-[9px] text-indigo-100 mt-0.5">Auto-repeating planners</p>
            </div>
            <Repeat className="h-7 w-7 text-indigo-100 opacity-80" />
          </CardContent>
        </Card>
        {metrics.repeatPlanners
          .reduce((acc: { name: string; items: PlannerAssignment[] }[], item) => {
            const name = item.planner_name || item.form_title || "Unnamed"
            const existing = acc.find((g) => g.name === name)
            if (existing) existing.items.push(item)
            else acc.push({ name, items: [item] })
            return acc
          }, [])
          .slice(0, 3)
          .map((group) => {
            const p = group.items[0]
            return (
              <Card key={group.name} className="relative overflow-hidden border-none bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-slate-200 font-semibold truncate max-w-[160px]">
                      {group.name}
                    </p>
                    <Badge className="text-[9px] bg-white/20 text-white border-none">Every {p.repeat_interval_days || 0}d</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-slate-200 inline-flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" /> {new Set(group.items.map(i => i.location).filter(Boolean)).size} locations
                    </span>
                    {p.early_notification_days != null && p.early_notification_days > 0 && (
                      <span className="text-[9px] text-slate-200">Notify {p.early_notification_days}d early</span>
                    )}
                  </div>
                  {p.repeat_generation_date && (
                    <p className="text-[9px] text-slate-200 mt-0.5">Next: {format(parseISO(p.repeat_generation_date), "MMM dd, yyyy")}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
      </div>

      {/* Folder Completion Pie Charts */}
      <FolderPieCharts />

      {/* Charts Row 1 - General (Compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Status Breakdown</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Distribution of planner statuses</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={48} innerRadius={30} paddingAngle={3}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                  <Legend wrapperStyle={{ fontSize: '9px' }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Assignment by Type</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">How planners are assigned</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={48} paddingAngle={3}>
                    {typeData.map((entry, index) => (
                      <Cell key={`type-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                  <Legend wrapperStyle={{ fontSize: '9px' }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Health Overview</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Completed, on track and overdue</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {healthData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-medium">{item.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px]" style={{ borderColor: item.color, color: item.color }}>{item.value}</Badge>
                </div>
              ))}
              <div className="h-16 pt-0.5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={healthData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={28} innerRadius={18} startAngle={90} endAngle={-270}>
                      {healthData.map((entry, index) => (
                        <Cell key={`health-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Approval Flow (Compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Overdue Reason Status</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Breakdown of overdue planners by reason status</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-36">
              {reasonStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reasonStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={48} innerRadius={30} paddingAngle={3}>
                      {reasonStatusData.map((entry, index) => (
                        <Cell key={`reason-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                    <Legend wrapperStyle={{ fontSize: '9px' }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[10px]">No overdue planners</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Approval Flow Outcome</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">How approvals and rejections are distributed</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-36">
              {approvalFlowData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={approvalFlowData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={48} innerRadius={30} paddingAngle={3}>
                      {approvalFlowData.map((entry, index) => (
                        <Cell key={`flow-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                    <Legend wrapperStyle={{ fontSize: '9px' }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[10px]">No approval flow data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Submission Cycles</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Submit-review cycles distribution</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-36">
              {cycleDistributionData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cycleDistributionData} margin={{ top: 3, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                    <Bar dataKey="value" name="Planners" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[10px]">No cycle data yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart + Top Planners (Compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Calendar className="h-3.5 w-3.5" />
              Planned vs Actual Completion
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Last 14 days planned end dates vs actual completions</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
                  <Legend wrapperStyle={{ fontSize: '9px' }} iconSize={8} />
                  <Bar dataKey="planned" name="Planned" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-700">Top Planners by Volume</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Most created planner templates</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TopPlannersTable data={data} />
          </CardContent>
        </Card>
      </div>

      {/* Repeat Planner Summary (Compact) */}
      {metrics.repeatEnabled > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Repeat className="h-3.5 w-3.5 text-purple-500" />
              Repeat Planner Summary
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Planners configured for automatic repeat assignment</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <RepeatPlannerTable data={metrics.repeatPlanners} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RepeatPlannerTable({ data }: { data: PlannerAssignment[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (name: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const grouped = useMemo(() => {
    const groups: Record<string, PlannerAssignment[]> = {}
    data.forEach((item) => {
      const name = item.planner_name || item.form_title || "Unnamed"
      if (!groups[name]) groups[name] = []
      groups[name].push(item)
    })
    return Object.entries(groups)
  }, [data])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1.5 font-medium text-muted-foreground w-6"></th>
            <th className="text-left py-1.5 font-medium text-muted-foreground">Planner Name</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">Locations</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">Interval</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">Notify</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">Start Date</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">End Date</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">Folder</th>
            <th className="text-right py-1.5 font-medium text-muted-foreground">Next Repeat</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([name, items]) => {
            const isExpanded = expandedRows.has(name)
            const first = items[0]
            return (
              <Fragment key={name}>
                <tr className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-1.5 text-center">
                    {items.length > 1 && (
                      <button
                        onClick={() => toggleRow(name)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                    )}
                  </td>
                  <td className="py-1.5 font-medium">
                    {name}
                    {first.parent_planner_id && (
                      <Badge variant="secondary" className="ml-2 text-[9px]">Repeated</Badge>
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {new Set(items.map(i => i.location).filter(Boolean)).size}
                    </span>
                  </td>
                  <td className="py-1.5 text-center">
                    <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-400">
                      {first.repeat_interval_days || 0}d
                    </Badge>
                  </td>
                  <td className="py-1.5 text-center text-[10px] text-muted-foreground">
                    {first.early_notification_days ? `${first.early_notification_days}d` : "—"}
                  </td>
                  <td className="py-1.5 text-center text-[10px] text-muted-foreground">
                    {first.start_date ? format(parseISO(first.start_date), "MMM dd, yyyy") : "—"}
                  </td>
                  <td className="py-1.5 text-center text-[10px] text-muted-foreground">
                    {first.end_date ? format(parseISO(first.end_date), "MMM dd, yyyy") : "—"}
                  </td>
                  <td className="py-1.5 text-center">
                    {first.folder_name ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: first.folder_color || "#64748b" }} />
                        <span className="text-[10px]">{first.folder_name}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-[10px] text-muted-foreground">
                    {first.repeat_generation_date
                      ? format(parseISO(first.repeat_generation_date), "MMM dd, yyyy")
                      : "—"}
                  </td>
                </tr>
                {isExpanded && items.map((item) => (
                  <tr key={item.id} className="bg-muted/20 border-b last:border-0">
                    <td></td>
                    <td className="py-1 pl-6 text-[10px] text-muted-foreground">
                      {item.user || item.group || item.leader || "Unassigned"}
                    </td>
                    <td className="py-1.5 text-center text-[10px] text-muted-foreground">
                      {item.location_name || "—"}
                    </td>
                    <td className="py-1.5 text-center text-[10px] text-muted-foreground">—</td>
                    <td className="py-1.5 text-center text-[10px] text-muted-foreground">—</td>
                    <td className="py-1.5 text-center text-[10px] text-muted-foreground">
                      {item.start_date ? format(parseISO(item.start_date), "MMM dd, yyyy") : "—"}
                    </td>
                    <td className="py-1.5 text-center text-[10px] text-muted-foreground">
                      {item.end_date ? format(parseISO(item.end_date), "MMM dd, yyyy") : "—"}
                    </td>
                    <td className="py-1.5 text-center">
                      {item.folder_name ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.folder_color || "#64748b" }} />
                          <span className="text-[10px]">{item.folder_name}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-[10px] text-muted-foreground">
                      {item.repeat_generation_date
                        ? format(parseISO(item.repeat_generation_date), "MMM dd, yyyy")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TopPlannersTable({ data }: { data: PlannerAssignment[] }) {
  const topPlanners = useMemo(() => {
    const groups: Record<string, Set<number | string>> = {}
    data.forEach((item) => {
      const key = item.planner_name || item.form_title || "Unnamed"
      if (!groups[key]) groups[key] = new Set()
      if (item.location) groups[key].add(item.location)
    })
    return Object.entries(groups)
      .map(([name, locs]) => [name, locs.size] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [data])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1.5 font-medium text-muted-foreground">Planner Name</th>
            <th className="text-right py-1.5 font-medium text-muted-foreground">No. of Location</th>
          </tr>
        </thead>
        <tbody>
          {topPlanners.map(([name, count]) => (
            <tr key={name} className="border-b last:border-0">
              <td className="py-1.5">{name}</td>
              <td className="py-1.5 text-right font-medium">{count}</td>
            </tr>
          ))}
          {topPlanners.length === 0 && (
            <tr>
              <td className="py-3 text-center text-muted-foreground" colSpan={2}>
                No planners available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
