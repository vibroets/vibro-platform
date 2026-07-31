"use client"

import {
  Megaphone,
  ClipboardList,
  CheckSquare,
  BarChart,
  GraduationCap,
  Calendar,
  Clock,
  Users,
  Plus,
  Archive,
  FileText,
  AlertCircle,
  BookOpen,
  UserPlus,
  Star,
} from "lucide-react"
import { useState, useEffect } from "react"
import axiosInstance from "@/utils/axiosInstance"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/user-provider"
import { Progress } from "@/components/ui/progress"
import { useSelector } from "react-redux"
import { selectAccessToken } from "@/redux/slices/authSlice"

interface top_active_groups {
  name: string;
  count: number;
}

export function DashboardMetrics() {
  const router = useRouter()
  const { user } = useUser()
  const accessToken = useSelector(selectAccessToken)

  // Only Super Admin and Admin can create content
  const canCreate = user.role === "Super Admin" || user.role === "Admin"

  const [formCounts, setFormCounts] = useState({
    total_forms: 0,
    standard_forms: 0,
    location_forms: 0,
    audit_forms: 0
  })

  const [announcementCount, setAnnouncementCount] = useState({count: 0 , today_count: 0})

 const [organizationStats, setOrganizationStats] = useState({
  total_users_count: 0,
  total_groups_count: 0,
  recently_added_users: 0,
  top_active_groups: [] as top_active_groups[]
});



  const [taskCounts, setTaskCounts] = useState({
    total_task_count: 0,
    not_started: 0,   
    in_progress: 0,
    completed: 0,
    overdue: 0
  })  

  // useEffect(() => {
  //   axiosInstance.get('/form/counts/')
  //     .then(response => setFormCounts(response.data))
  //     .catch(err => console.error('Error fetching form counts:', err))
  // }, [])

  useEffect(() => {
  if (!accessToken) return
  Promise.all([
    axiosInstance.get('/form/counts/'),
    axiosInstance.get('/announcements/count/'),
    axiosInstance.get('/tasks/count/'),
    axiosInstance.get('/organization/stats/'),
  ])
    .then(([formRes, announcementRes,taskRes,organizationRes]) => {
      setFormCounts(formRes.data)
      setAnnouncementCount(announcementRes.data)
      setTaskCounts(taskRes.data)
      setOrganizationStats(organizationRes.data)
    })
    .catch(err => console.error("Error fetching counts:", err))
}, [accessToken])

const getProgressPercent = (count: number, total: number) => {
  if (!total || total === 0) return 0; // avoid division by zero
  return (count / total) * 100;
};

  return (
    <div className="space-y-8">
      {/* Announcements & Forms Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/announcements")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Announcements</CardTitle>
            <Megaphone className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div className="text-2xl font-bold">{announcementCount?.count}</div>
             
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Active</span>
            </div>
            <Progress value={announcementCount.count} className="h-2 mt-1" />
            <p className="text-xs text-muted-foreground mt-2">{announcementCount.today_count > 0 ? announcementCount.today_count : "No"} new announcements today</p>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/announcements/new")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Announcement
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/forms")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Forms</CardTitle>
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{formCounts.total_forms}</div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="rounded-md bg-muted p-2 text-center">
                <div className="text-sm font-medium">Standard</div>
                <div className="text-xl font-bold">{formCounts.standard_forms}</div>
              </div>
              <div className="rounded-md bg-muted p-2 text-center">
                <div className="text-sm font-medium">Location</div>
                <div className="text-xl font-bold">{formCounts.location_forms}</div>
              </div>
              <div className="rounded-md bg-muted p-2 text-center">
                <div className="text-sm font-medium">Audit</div>
                <div className="text-xl font-bold">{formCounts.audit_forms}</div>
              </div>
            </div>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/forms/new")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Form
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Tasks & Polls Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/tasks")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Tasks</CardTitle>
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div className="text-2xl font-bold">{taskCounts.total_task_count}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Not Started</span>
                <span>{taskCounts.not_started}</span>
              </div>
              <Progress value={getProgressPercent(taskCounts.not_started, taskCounts.total_task_count)} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>In Progress</span>
                <span>{taskCounts.in_progress}</span>
              </div>
              <Progress value={getProgressPercent(taskCounts.in_progress, taskCounts.total_task_count)} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>Completed</span>
                <span>{taskCounts.completed}</span>
              </div>
              <Progress value={getProgressPercent(taskCounts.completed, taskCounts.total_task_count)} className="h-2" />
            </div>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/tasks/new")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Assign Task
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/polls")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Polls</CardTitle>
            <BarChart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div className="text-2xl font-bold">7</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">72% response rate</span>
              </div>
            </div>
            <div className="mt-2 space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Active Polls</span>
                  <span>4</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "57%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Closed Polls</span>
                  <span>3</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-muted-foreground rounded-full" style={{ width: "43%" }}></div>
                </div>
              </div>
            </div>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/polls/new")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Poll
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Learning & Planner Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/learning")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Learning & Training</CardTitle>
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div className="text-2xl font-bold">5</div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">2 pending assessments</span>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Safety Procedures Training</span>
                <Badge variant="outline">45 enrolled</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Customer Service Excellence</span>
                <Badge variant="outline">32 enrolled</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Leadership Skills Development</span>
                <Badge variant="outline">15 enrolled</Badge>
              </div>
            </div>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/learning/courses")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Manage Courses
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/planner")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Planner</CardTitle>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div className="text-2xl font-bold">3</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pending template assignments</span>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Monthly Safety Inspection</span>
                <Badge>Due in 3 days</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Quarterly Inventory Check</span>
                <Badge>Due in 7 days</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Weekly Team Meeting</span>
                <Badge>Due tomorrow</Badge>
              </div>
            </div>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/planner/upload")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Upload Template
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Attendance & User Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push("/attendance")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Attendance</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div className="text-2xl font-bold">156</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">4 pending regularizations</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="rounded-md bg-muted p-2">
                <div className="text-sm text-muted-foreground">Today's Clock-ins</div>
                <div className="text-xl font-bold">124</div>
                <div className="text-xs text-muted-foreground">5 late arrivals</div>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-sm text-muted-foreground">Today's Clock-outs</div>
                <div className="text-xl font-bold">98</div>
                <div className="text-xs text-muted-foreground">26 still on shift</div>
              </div>
            </div>
          </CardContent>
          {canCreate && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push("/attendance/shifts")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Shift Assignments
              </Button>
            </CardFooter>
          )}
        </Card>

    <Card
  className="cursor-pointer hover:bg-muted/50 transition-colors"
  onClick={() => router.push("/admin")}
>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-lg font-medium">Users & Groups</CardTitle>
    <Users className="h-5 w-5 text-muted-foreground" />
  </CardHeader>

  <CardContent>
    <div className="flex justify-between items-center mb-4">
    
    {/* Left: Users & Groups Count */}
    <div className="flex space-x-6 items-center">
      <div>
        <div className="text-2xl font-bold">{organizationStats.total_users_count}</div>
        <div className="text-sm text-muted-foreground">Total Users</div>
      </div>

      <div>
        <div className="text-2xl font-bold">{organizationStats.total_groups_count}</div>
        <div className="text-sm text-muted-foreground">Total Groups</div>
      </div>
    </div>

    {/* Right: Recent Users */}
    <div className="flex items-center gap-2">
      <UserPlus className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{organizationStats.recently_added_users} recent users</span>
    </div>

  </div>

    {/* Top Active Groups */}
{organizationStats.top_active_groups && organizationStats.top_active_groups.length > 0 && (
  <div className="mt-2 space-y-2">
    <div className="text-sm font-medium">Top Active Groups</div>
    <div className="space-y-2">
      {organizationStats.top_active_groups.map((group, index) => (
        <div key={index} className="flex items-center">
          <Star className="h-3 w-3 text-yellow-500 mr-1" />
          <span className="text-sm">{group.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {group.count} members
          </span>
        </div>
      ))}
    </div>
  </div>
)}

  </CardContent>

  {canCreate && (
    <CardFooter>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={(e) => {
          e.stopPropagation()
          router.push("/admin")
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Manage Users
      </Button>
    </CardFooter>
  )}
</Card>

      </div>
    </div>
  )
}

import { Badge } from "@/components/ui/badge"
