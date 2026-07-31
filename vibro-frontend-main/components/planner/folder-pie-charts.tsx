"use client"

import { useEffect, useState } from "react"
import axiosInstance from "@/utils/axiosInstance"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface FolderStat {
  id: number | null
  name: string
  color: string
  total: number
  completed: number
  percentage: number
}

const PROFESSIONAL_COLORS = [
  "#2563EB",
  "#7C3AED",
  "#DC2626",
  "#EA580C",
  "#16A34A",
  "#0891B2",
  "#DB2777",
  "#CA8A04",
]

const RADIUS = 28
const STROKE_WIDTH = 6
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getGradient(color: string): [string, string] {
  const map: Record<string, [string, string]> = {
    "#2563EB": ["#3B82F6", "#1D4ED8"],
    "#7C3AED": ["#A78BFA", "#6D28D9"],
    "#DC2626": ["#F87171", "#B91C1C"],
    "#EA580C": ["#FB923C", "#C2410C"],
    "#16A34A": ["#4ADE80", "#15803D"],
    "#0891B2": ["#22D3EE", "#0E7490"],
    "#DB2777": ["#F472B6", "#BE185D"],
    "#CA8A04": ["#FACC15", "#A16207"],
    "#10B981": ["#34D399", "#059669"],
    "#9CA3AF": ["#D1D5DB", "#6B7280"],
  }
  return map[color] || ["#3B82F6", "#1D4ED8"]
}

function PieChartCard({ stat, isOverall }: { stat: FolderStat; isOverall?: boolean }) {
  const { name, color, completed, total, percentage } = stat
  const strokeDashoffset = total > 0 ? CIRCUMFERENCE * (1 - completed / total) : CIRCUMFERENCE
  const chartColor = isOverall ? "#10B981" : color
  const [gradStart, gradEnd] = getGradient(chartColor)
  const gradId = `grad-${name.replace(/[^a-zA-Z0-9]/g, "")}-${stat.id}`

  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors min-w-[90px]">
      <svg width={68} height={68} viewBox="0 0 68 68">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradStart} />
            <stop offset="100%" stopColor={gradEnd} />
          </linearGradient>
        </defs>
        <circle cx={34} cy={34} r={RADIUS} fill="none" stroke="#E5E7EB" strokeWidth={STROKE_WIDTH} />
        {total > 0 && (
          <circle
            cx={34}
            cy={34}
            r={RADIUS}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 34 34)"
          />
        )}
        <text x={34} y={38} fontSize={13} fontWeight="700" fill={chartColor} textAnchor="middle">
          {percentage}%
        </text>
      </svg>
      <span
        className="text-xs font-semibold mt-1.5 truncate max-w-[80px] text-center"
        style={{ color: isOverall ? "#10B981" : "#111827" }}
      >
        {name}
      </span>
      <span className="text-[10px] text-muted-foreground mt-0.5">
        {completed}/{total}
      </span>
    </div>
  )
}

export function FolderPieCharts() {
  const [stats, setStats] = useState<FolderStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchStats() {
      try {
        setLoading(true)
        const response = await axiosInstance.get("/planner/folder-stats/")
        if (!cancelled) setStats(response.data || [])
      } catch (err) {
        console.error("Failed to fetch folder stats:", err)
        if (!cancelled) setStats([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => {
      cancelled = true
    }
  }, [])

  const folderStats = stats.filter((s) => s.id !== null)
  const unassignedStats = stats.filter((s) => s.id === null)

  const totalCompleted = stats.reduce((sum, s) => sum + s.completed, 0)
  const totalAll = stats.reduce((sum, s) => sum + s.total, 0)
  const overallPercentage = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0

  const overallStat: FolderStat = {
    id: null,
    name: "Overall",
    color: "#10B981",
    total: totalAll,
    completed: totalCompleted,
    percentage: overallPercentage,
  }

  const coloredFolderStats = folderStats.map((s, i) => ({
    ...s,
    color: s.color && s.color !== "#6366F1" ? s.color : PROFESSIONAL_COLORS[i % PROFESSIONAL_COLORS.length],
  }))

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Planner Adherence</CardTitle>
          <CardDescription className="text-xs text-slate-500">Loading planner stats...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (folderStats.length === 0 && unassignedStats.length === 0) {
    return null
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">Planner Adherence</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Completion progress across planner
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <PieChartCard stat={overallStat} isOverall />
          {coloredFolderStats.map((stat) => (
            <PieChartCard key={stat.id} stat={stat} />
          ))}
          {unassignedStats.map((stat) => (
            <PieChartCard key="unassigned" stat={stat} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
