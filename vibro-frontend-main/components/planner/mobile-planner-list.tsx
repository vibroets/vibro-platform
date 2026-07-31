"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, CheckCircle, MapPin, Share2, FileText, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { differenceInCalendarDays, parseISO } from "date-fns"
import axiosInstance from "@/utils/axiosInstance"
import { useSelector } from "react-redux"
import { selectUser, selectHydrated } from "@/redux/slices/authSlice"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface PlannerItem {
  id: number
  order_id?: string
  planner_name: string
  form_id: number
  form_title: string
  form_type?: string
  assign_type: string
  start_date: string
  end_date: string
  description: string | null
  is_completed: boolean
  planner_shared_on: string
  location?: number | null
  location_name?: string | null
  started_by?: string | null
  started_on?: string | null
}

interface UserOption {
  id: number
  name: string
  username?: string
}

interface GroupOption {
  id: number
  name: string
}

interface LocationOption {
  id: number
  name: string
}

export function MobilePlannerList() {
  const user = useSelector(selectUser)
  const hydrated = useSelector(selectHydrated)
  const { toast } = useToast()
  const router = useRouter()
  const [planners, setPlanners] = useState<PlannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Start confirmation dialog state
  const [startDialogPlanner, setStartDialogPlanner] = useState<PlannerItem | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [sharePlanner, setSharePlanner] = useState<PlannerItem | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])
  const [isSharing, setIsSharing] = useState(false)
  const didFetchRef = useRef(false)

  useEffect(() => {
    if (!hydrated || !user) return
    if (didFetchRef.current) return
    didFetchRef.current = true
    fetchPlanners()
  }, [hydrated, user])

  const fetchPlanners = async () => {
    try {
      setLoading(true)
      const response = await axiosInstance.get("/planner/my-planners/")
      setPlanners(response.data)
      setError(null)
    } catch (err: any) {
      console.error("Error fetching planners:", err)
      setError("Failed to load planners")
    } finally {
      setLoading(false)
    }
  }

  const handleStartClick = (planner: PlannerItem) => {
    setStartDialogPlanner(planner)
  }

  const confirmStart = async () => {
    if (!startDialogPlanner) return
    try {
      setIsStarting(true)
      const res = await axiosInstance.post(`/planner/${startDialogPlanner.id}/start/`)
      toast({ title: "Success", description: "Planner started successfully" })
      const plannerLocation = res.data?.location_name || startDialogPlanner.location_name || null
      // Navigate to the form with planner location info as query params
      const params = new URLSearchParams()
      if (plannerLocation) params.set("planner_location", plannerLocation)
      if (startDialogPlanner.order_id) params.set("planner_order_id", startDialogPlanner.order_id)
      router.push(`/forms/${startDialogPlanner.form_id}${params.toString() ? `?${params.toString()}` : ""}`)
      setStartDialogPlanner(null)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to start planner",
        variant: "destructive",
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleShareClick = async (planner: PlannerItem) => {
    setSharePlanner(planner)
    setShareDialogOpen(true)
    setSelectedUsers([])
    setSelectedGroups([])
    setSelectedLocations([])
    // Fetch users, groups, locations for sharing
    try {
      const orgId = user?.organization_id || user?.id
      const [usersRes, groupsRes, locationsRes] = await Promise.all([
        axiosInstance.get("/users/list"),
        axiosInstance.get("/groups/"),
        axiosInstance.get(`/location/${orgId}/`),
      ])
      setUsers(usersRes.data || [])
      setGroups(groupsRes.data || [])
      setLocations(locationsRes.data || [])
    } catch (err) {
      console.error("Error fetching share options:", err)
    }
  }

  const handleShareSubmit = async () => {
    if (!sharePlanner) return
    if (selectedUsers.length === 0 && selectedGroups.length === 0 && selectedLocations.length === 0) {
      toast({ title: "Error", description: "Select at least one user, group, or location", variant: "destructive" })
      return
    }
    try {
      setIsSharing(true)
      await axiosInstance.post("/planner/share/", {
        planner_assignment_id: sharePlanner.id,
        users: selectedUsers,
        groups: selectedGroups,
        leaders: [],
        locations: selectedLocations,
      })
      toast({ title: "Success", description: "Planner shared successfully" })
      setShareDialogOpen(false)
      setSharePlanner(null)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to share planner",
        variant: "destructive",
      })
    } finally {
      setIsSharing(false)
    }
  }

  const getDaysLeft = (endDate: string, isCompleted: boolean) => {
    if (isCompleted) return { text: "Completed", color: "text-green-600", badge: "bg-green-100 text-green-800 border-green-300" }
    const end = parseISO(endDate)
    const daysLeft = differenceInCalendarDays(end, new Date())
    if (daysLeft < 0) return { text: `${Math.abs(daysLeft)}d overdue`, color: "text-red-600", badge: "bg-red-100 text-red-800 border-red-300" }
    if (daysLeft === 0) return { text: "Due today", color: "text-red-600", badge: "bg-red-100 text-red-800 border-red-300" }
    if (daysLeft <= 3) return { text: `${daysLeft}d left`, color: "text-red-600", badge: "bg-red-100 text-red-800 border-red-300" }
    if (daysLeft <= 7) return { text: `${daysLeft}d left`, color: "text-yellow-600", badge: "bg-yellow-100 text-yellow-800 border-yellow-300" }
    return { text: `${daysLeft}d left`, color: "text-green-600", badge: "bg-green-100 text-green-800 border-green-300" }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading planners...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  if (planners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Planners Assigned</h3>
        <p className="text-sm text-muted-foreground">
          You don't have any planners assigned to you yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Planners</h2>
        <Badge variant="outline">{planners.length} Active</Badge>
      </div>

      {planners.map((planner) => {
        const daysLeft = getDaysLeft(planner.end_date, planner.is_completed)
        const status = planner.is_completed ? "Completed" : (planner.started_by ? "In Progress" : "Not Started")
        return (
        <Card key={planner.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base font-bold text-blue-700">
                  {planner.order_id || `PLN-${planner.id}`}
                </CardTitle>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <span>{planner.planner_name}</span>
                  {planner.location_name && (
                    <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
                      <MapPin className="h-3 w-3" />
                      {planner.location_name}
                    </span>
                  )}
                </div>
              </div>
              <Badge
                variant="outline"
                className={planner.is_completed ? "bg-green-100 text-green-800" : status === "In Progress" ? "bg-yellow-100 text-yellow-800" : ""}
              >
                {status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>{planner.form_title}</span>
              </div>

              {planner.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{planner.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{new Date(planner.start_date).toLocaleDateString()}</span>
                </div>
                <span>—</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(planner.end_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Badge variant="outline" className={`text-xs ${daysLeft.badge}`}>
                  {daysLeft.text}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {planner.assign_type}
                </Badge>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {!planner.is_completed && (
                  <Button
                    size="sm"
                    onClick={() => handleStartClick(planner)}
                    className="flex-1"
                  >
                    Start Planner
                  </Button>
                )}
                {planner.is_completed && (
                  <div className="flex items-center gap-1 text-green-600 text-sm flex-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>Completed</span>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShareClick(planner)}
                >
                  <Share2 className="h-3.5 w-3.5 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )
      })}

      {/* Start Confirmation Dialog */}
      <Dialog open={!!startDialogPlanner} onOpenChange={(open) => !open && setStartDialogPlanner(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Planner</DialogTitle>
            <DialogDescription>
              You are about to start planner <strong>{startDialogPlanner?.order_id || `PLN-${startDialogPlanner?.id}`}</strong>: {startDialogPlanner?.planner_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {startDialogPlanner?.location_name && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Location: <strong>{startDialogPlanner.location_name}</strong> (locked)</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Form: <strong>{startDialogPlanner?.form_title}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>End date: <strong>{startDialogPlanner ? new Date(startDialogPlanner.end_date).toLocaleDateString() : ""}</strong></span>
            </div>
            <p className="text-sm text-muted-foreground">
              Clicking confirm will start the planner and open the form for you to fill out.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStartDialogPlanner(null)}>
              Cancel
            </Button>
            <Button onClick={confirmStart} disabled={isStarting}>
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirm & Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share Planner</DialogTitle>
            <DialogDescription>
              Share <strong>{sharePlanner?.planner_name}</strong> with users, groups, or locations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Users</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {users.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No users available</span>
                ) : users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedUsers.includes(u.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedUsers([...selectedUsers, u.id])
                        else setSelectedUsers(selectedUsers.filter(id => id !== u.id))
                      }}
                    />
                    <span>{u.name || u.username}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Groups</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {groups.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No groups available</span>
                ) : groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedGroups.includes(g.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedGroups([...selectedGroups, g.id])
                        else setSelectedGroups(selectedGroups.filter(id => id !== g.id))
                      }}
                    />
                    <span>{g.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Locations</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {locations.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No locations available</span>
                ) : locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedLocations.includes(l.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedLocations([...selectedLocations, l.id])
                        else setSelectedLocations(selectedLocations.filter(id => id !== l.id))
                      }}
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShareSubmit} disabled={isSharing}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
