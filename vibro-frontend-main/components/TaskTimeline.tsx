"use client"

import React from "react"
import { format } from "date-fns"
import {
  FileText,
  FileCheck,
  Play,
  Edit,
  Share2,
  Send,
  RotateCcw,
  CheckCircle,
  ChartPie
} from "lucide-react"

interface TaskLog {
  id: number
  task: number
  task_name: string
  task_action: string
  action_by: string
  action_by_name: string
  action_to: string | null
  action_to_name: string | null
  action_date_time: string
  form_name?: string
}

interface TaskTimelineProps {
  logs: TaskLog[]
}

const getActionText = (log: TaskLog): React.ReactElement => {
  const { task_action, action_by_name, action_to_name } = log
  switch (task_action) {
    case "created":
      return <><span className="font-semibold">{action_by_name}</span> created the task</>
    case "started":
      return <><span className="font-semibold">{action_by_name}</span> started the task</>
    case "updated":
      return <><span className="font-semibold">{action_by_name}</span> updated the task</>
    case "assigned":
      return action_to_name ? (
        <><span className="font-semibold">{action_by_name}</span> assigned this task to: </>
      ) : (
        <><span className="font-semibold">{action_by_name}</span> assigned the task</>
      )
    case "reassigned":
      return action_to_name ? (
        <><span className="font-semibold">{action_by_name}</span> reassigned this task to:</>
      ) : (
        <><span className="font-semibold">{action_by_name}</span> reassigned the task</>
      )
    case "submitted":
      return <><span className="font-semibold">{action_by_name}</span> submitted the task</>
    case "Reopened":
      return <><span className="font-semibold">{action_by_name}</span> reopened the task</>
    case "mark_completed":
      return <><span className="font-semibold">{action_by_name}</span> marked the task as completed</>
    case "Completed":
      return <><span className="font-semibold">{action_by_name}</span> completed the task</>
    case "Due Extended":
      return <>
        <span className="font-semibold">{action_by_name}</span> extended the task’s due date.
      </>
    default:
      return <><span className="font-semibold">{action_by_name}</span> {task_action} the task</>
  }
}

const getActionIcon = (action: string): React.ReactElement => {
  switch (action) {
    case "created":
      return <FileCheck className="h-4 w-4 mr-2" />
    case "started":
      return <ChartPie className="h-4 w-4 mr-2" />
    case "updated":
      return <Edit className="h-4 w-4 mr-2" />
    case "assigned":
      return <Share2 className="h-4 w-4 mr-2" />
    case "reassigned":
      return <Share2 className="h-4 w-4 mr-2" />
    case "submitted":
      return <Send className="h-4 w-4 mr-2" />
    case "Reopened":
      return <RotateCcw className="h-4 w-4 mr-2" />
    case "mark_completed":
      return <CheckCircle className="h-4 w-4 mr-2" />
    case "Completed":
      return <CheckCircle className="h-4 w-4 mr-2" />
    case "Due Extended":
      return <Edit className="h-4 w-4 mr-2" />
    default:
      return <FileText className="h-4 w-4 mr-2" />
  }
}

const getActionColor = (action: string): string => {
  switch (action) {
    case "created":
      return "bg-gray-100 border-gray-200"
    case "started":
      return "bg-blue-100 border-blue-200"
    case "updated":
      return "bg-blue-100 border-blue-200"
    case "assigned":
      return "bg-yellow-100 border-yellow-200"
    case "reassigned":
      return "bg-yellow-100 border-yellow-200"
    case "submitted":
      return "bg-purple-100 border-purple-200"
    case "Reopened":
      return "bg-gray-100 border-gray-200"
    case "mark_completed":
      return "bg-green-100 border-green-200"
    case "Completed":
      return "bg-green-100 border-green-200"
    case "Due Extended":
      return "bg-blue-100 border-blue-200"
    default:
      return "bg-gray-100 border-gray-200"
  }
}

export function TaskTimeline({ logs }: TaskTimelineProps) {
  // Sort logs by action_datetime ascending
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(a.action_date_time).getTime() - new Date(b.action_date_time).getTime()
  )

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-6 bottom-0 w-0.5 bg-gray-300" />

      <div className="space-y-6">
        {sortedLogs.map((log, index) => {
          const formattedDate = format(new Date(log.action_date_time), "dd/MM/yyyy hh:mm a")
          const actionText = getActionText(log)
          const actionIcon = getActionIcon(log.task_action)
          const cardColor = getActionColor(log.task_action)

          return (
            <div key={log.id} className="relative flex items-start space-x-4">
              {/* Timeline dot */}
              <div className="flex-shrink-0 w-8 h-8 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center z-10">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Date */}
                <div className="text-sm text-gray-500 mb-1">
                  {formattedDate}
                </div>

                {/* Action card */}
                <div className={`${cardColor} p-4 rounded-lg shadow-sm`}>
                  <div className="flex items-start text-sm text-gray-900 mb-2">
                    {actionIcon}
                    <span className="flex-1">{actionText}</span>
                  </div>
                  {log.task_action === "shared" || log.task_action === "reassigned" ? (
                    log.action_to_name && (
                      <div className="text-xs  bg-white/50 p-2 rounded font-semibold">
                        {log.action_to_name}
                      </div>
                    )
                  ) : (
                    log.form_name && (
                      <div className="text-xs  bg-white/50 p-2 rounded font-semibold">
                        {log.form_name}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
