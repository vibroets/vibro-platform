"use client"

import { useEffect, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { selectUser } from "@/redux/slices/authSlice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import ReactSelect from "react-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import axiosInstance from "@/utils/axiosInstance"
import { Plus } from "lucide-react"

interface FolderOption {
  id: number
  name: string
  color: string
}

interface FormOption {
  id: number
  title: string
  is_archived?: boolean
  form_type?: string
}

interface UserOption {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  mobile_supervisor?: boolean
}

interface GroupOption {
  id: number
  name: string
}

interface LocationOption {
  id: number
  name: string
}

interface CreatePlannerDialogProps {
  onCreated?: () => void
}

interface SelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  searchPlaceholder?: string
  options: { id: number; label: string }[]
  selected: number[]
  onChange: (selected: number[]) => void
}

function SelectionDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  options,
  selected,
  onChange,
}: SelectionDialogProps) {
  const [search, setSearch] = useState("")

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 min-h-0">
          <Input
            type="search"
            placeholder={searchPlaceholder || "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-y-auto border rounded-md p-2 space-y-1">
            {filtered.map((item) => (
              <label
                key={item.id}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />
                <span className="text-xs">{item.label}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No results found</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CollabParticipantsStepProps {
  users: UserOption[]
  groups: GroupOption[]
  selectedUsers: number[]
  selectedGroups: number[]
  setSelectedUsers: (ids: number[]) => void
  setSelectedGroups: (ids: number[]) => void
  displayName: (u: UserOption) => string
}

function CollabParticipantsStep({
  users,
  groups,
  selectedUsers,
  selectedGroups,
  setSelectedUsers,
  setSelectedGroups,
  displayName,
}: CollabParticipantsStepProps) {
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users")
  const [search, setSearch] = useState("")

  const toggleUser = (id: number) => {
    setSelectedUsers(
      selectedUsers.includes(id)
        ? selectedUsers.filter((v) => v !== id)
        : [...selectedUsers, id]
    )
  }

  const toggleGroup = (id: number) => {
    setSelectedGroups(
      selectedGroups.includes(id)
        ? selectedGroups.filter((v) => v !== id)
        : [...selectedGroups, id]
    )
  }

  const filteredUsers = users.filter((u) =>
    displayName(u).toLowerCase().includes(search.toLowerCase())
  )
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3 py-2">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => { setActiveTab("users"); setSearch("") }}
          className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Users {selectedUsers.length > 0 && `(${selectedUsers.length})`}
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("groups"); setSearch("") }}
          className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "groups"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Groups {selectedGroups.length > 0 && `(${selectedGroups.length})`}
        </button>
      </div>

      <Input
        type="search"
        placeholder={`Search ${activeTab}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9"
      />

      <div className="max-h-[40vh] overflow-y-auto border rounded-md p-2 space-y-1">
        {activeTab === "users" ? (
          filteredUsers.map((u) => (
            <label
              key={u.id}
              className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
            >
              <Checkbox
                checked={selectedUsers.includes(u.id)}
                onCheckedChange={() => toggleUser(u.id)}
              />
              <span className="text-xs">{displayName(u)}</span>
            </label>
          ))
        ) : (
          filteredGroups.map((g) => (
            <label
              key={g.id}
              className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
            >
              <Checkbox
                checked={selectedGroups.includes(g.id)}
                onCheckedChange={() => toggleGroup(g.id)}
              />
              <span className="text-xs">{g.name}</span>
            </label>
          ))
        )}
        {((activeTab === "users" && filteredUsers.length === 0) ||
          (activeTab === "groups" && filteredGroups.length === 0)) && (
          <p className="text-xs text-muted-foreground p-2">No results found</p>
        )}
      </div>
    </div>
  )
}

export function CreatePlannerDialog({ onCreated }: CreatePlannerDialogProps) {
  const user = useSelector(selectUser)
  const organizationId = user?.organization
  const { toast } = useToast()
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  })
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [collabWizardOpen, setCollabWizardOpen] = useState(false)
  const [collabWizardStep, setCollabWizardStep] = useState(1)
  const [groupMembers, setGroupMembers] = useState<UserOption[]>([])
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false)

  const [plannerName, setPlannerName] = useState("")
  const [selectedFormId, setSelectedFormId] = useState<string>("")
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [description, setDescription] = useState("")

  const [forms, setForms] = useState<FormOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])

  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedLocations, setSelectedLocations] = useState<number[]>([])

  const [locationDialogOpen, setLocationDialogOpen] = useState(false)

  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatIntervalDays, setRepeatIntervalDays] = useState(50)
  const [earlyNotificationDays, setEarlyNotificationDays] = useState(3)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>("")
  const [collaborativeEnabled, setCollaborativeEnabled] = useState(false)
  const [teamLeaderId, setTeamLeaderId] = useState<string>("")

  useEffect(() => {
    if (!open) return
    if (!organizationId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function fetchData() {
      setIsLoading(true)
      try {
        const [formsRes, usersRes, groupsRes, locationsRes, foldersRes] = await Promise.all([
          axiosInstance.get(`/forms/organization/${organizationId}/`).catch(() => axiosInstance.get('/organization/forms/')),
          axiosInstance.get("/users/list"),
          axiosInstance.get("/groups/"),
          axiosInstance.get(`/location/${organizationId}/`),
          axiosInstance.get("/planner/folders/"),
        ])
        if (cancelled) return
        const formsData = formsRes.data?.results || formsRes.data?.forms || formsRes.data || []
        const usersData = usersRes.data || []
        const groupsData = groupsRes.data || []
        const locationsData = locationsRes.data || []
        setForms(formsData)
        setUsers(usersData)
        setGroups(groupsData)
        setLocations(locationsData)
        setFolders(foldersRes.data || [])
      } catch (err) {
        console.error("Failed to load planner creation data:", err)
        toastRef.current({
          title: "Error",
          description: "Failed to load forms, users or groups",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [open, organizationId])

  const resetForm = () => {
    setPlannerName("")
    setSelectedFormId("")
    setSelectedLocationId("")
    setStartDate("")
    setEndDate("")
    setDescription("")
    setSelectedUsers([])
    setSelectedGroups([])
    setSelectedLocations([])
    setRepeatEnabled(false)
    setRepeatIntervalDays(50)
    setEarlyNotificationDays(3)
    setSelectedFolderId("")
    setCollaborativeEnabled(false)
    setTeamLeaderId("")
    setCollabWizardStep(1)
    setGroupMembers([])
  }

  const fetchGroupMembers = async (groupIds: number[]) => {
    if (groupIds.length === 0) {
      setGroupMembers([])
      return
    }
    setIsLoadingGroupMembers(true)
    try {
      const results = await Promise.all(
        groupIds.map((gid) => axiosInstance.get(`/groups/${gid}/`))
      )
      const allMembers: UserOption[] = []
      const seenIds = new Set<number>()
      results.forEach((res) => {
        const memberDetails = res.data?.member_details || []
        memberDetails.forEach((m: any) => {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id)
            allMembers.push({
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              username: m.username,
            })
          }
        })
      })
      setGroupMembers(allMembers)
    } catch (err) {
      console.error("Failed to fetch group members:", err)
      setGroupMembers([])
    } finally {
      setIsLoadingGroupMembers(false)
    }
  }

  const collabPoolUsers = (() => {
    const poolIds = new Set<number>(selectedUsers)
    groupMembers.forEach((m) => poolIds.add(m.id))
    // Include users from state that match, plus group members not in users state
    const fromUsers = users.filter((u) => poolIds.has(u.id))
    const fromGroupMembers = groupMembers.filter((m) => !users.some((u) => u.id === m.id))
    return [...fromUsers, ...fromGroupMembers]
  })()

  const handleSubmit = async () => {
    if (!plannerName.trim()) {
      toast({ title: "Error", description: "Planner name is required", variant: "destructive" })
      return
    }
    if (!selectedFormId) {
      toast({ title: "Error", description: "Please select a form", variant: "destructive" })
      return
    }
    if (!startDate || !endDate) {
      toast({ title: "Error", description: "Start and end dates are required", variant: "destructive" })
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: "Error", description: "End date must be on or after start date", variant: "destructive" })
      return
    }
    if (
      selectedUsers.length === 0 &&
      selectedGroups.length === 0 &&
      (collaborativeEnabled || selectedLocations.length === 0)
    ) {
      toast({
        title: "Error",
        description: collaborativeEnabled
          ? "Select at least one user or group as participants"
          : "Select at least one user, group, or location",
        variant: "destructive",
      })
      return
    }

    const selectedForm = forms.find((f) => String(f.id) === selectedFormId)
    if (!selectedForm) {
      toast({ title: "Error", description: "Selected form not found", variant: "destructive" })
      return
    }
    if (collaborativeEnabled && !teamLeaderId) {
      toast({ title: "Error", description: "Please select a Team Leader for collaborative audit", variant: "destructive" })
      return
    }

    setIsSaving(true)
    let assignmentId: number | null = null
    try {
      const importRes = await axiosInstance.post("/planner/bulk-import/", {
        data: [
          {
            planner_name: plannerName,
            location: selectedLocationId,
            form: selectedForm.title,
            start_date: startDate,
            end_date: endDate,
            description,
            rowIndex: 1,
          },
        ],
        repeat_enabled: repeatEnabled,
        repeat_interval_days: repeatIntervalDays,
        early_notification_days: earlyNotificationDays,
        folder_id: selectedFolderId || undefined,
        collaborative_enabled: collaborativeEnabled,
        team_leader: collaborativeEnabled && teamLeaderId ? parseInt(teamLeaderId) : undefined,
        collaborative_participant_users: collaborativeEnabled ? selectedUsers : undefined,
        collaborative_participant_groups: collaborativeEnabled ? selectedGroups : undefined,
      })

      const created = importRes.data?.created_assignments || []
      if (!created.length) {
        throw new Error(importRes.data?.errors?.[0]?.error || "Failed to create planner")
      }
      assignmentId = created[0].planner_assignment_id

      // Only call share endpoint for non-collaborative mode (collaborative uses participant pool)
      if (!collaborativeEnabled) {
        await axiosInstance.post("/planner/share/", {
          planner_assignment_id: assignmentId,
          users: selectedUsers,
          groups: selectedGroups,
          locations: selectedLocations,
        })
      }

      toast({ title: "Success", description: "Planner created and shared successfully" })
      resetForm()
      setOpen(false)
      onCreated?.()
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.response?.data?.errors?.[0]?.error || error.message || "Failed to create planner"
      toast({ title: "Error", description: message, variant: "destructive" })
      if (assignmentId) {
        try {
          await axiosInstance.delete(`/planner/${assignmentId}/delete/`)
        } catch (cleanupErr) {
          console.error("Failed to clean up placeholder planner:", cleanupErr)
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  const displayName = (u: UserOption) =>
    `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username || `User ${u.id}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Create Planner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Planner</DialogTitle>
          <DialogDescription>
            Plan a single assignment. Choose the form, dates, and who it should be shared with.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="planner-name" className="text-xs">Planner Name</Label>
                <Input
                  id="planner-name"
                  value={plannerName}
                  onChange={(e) => setPlannerName(e.target.value)}
                  placeholder="Enter planner name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location" className="text-xs">Location</Label>
                <ReactSelect
                  options={locations.map((l) => ({ value: String(l.id), label: l.name }))}
                  value={
                    selectedLocationId
                      ? {
                          value: selectedLocationId,
                          label: locations.find((l) => String(l.id) === selectedLocationId)?.name || "",
                        }
                      : null
                  }
                  onChange={(selected) => setSelectedLocationId(selected?.value || "")}
                  placeholder="Select location"
                  isClearable
                  isDisabled={isLoading}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    control: (base) => ({ ...base, fontSize: "0.875rem", minHeight: "2.25rem" }),
                    placeholder: (base) => ({ ...base, fontSize: "0.875rem" }),
                    singleValue: (base) => ({ ...base, fontSize: "0.875rem" }),
                    option: (base) => ({ ...base, fontSize: "0.875rem" }),
                    input: (base) => ({ ...base, fontSize: "0.875rem" }),
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="form" className="text-xs">Form</Label>
              <ReactSelect
                options={forms
                  .filter((f) => !f.is_archived)
                  .map((f) => ({ value: String(f.id), label: f.title }))}
                value={
                  selectedFormId
                    ? {
                        value: selectedFormId,
                        label: forms.find((f) => String(f.id) === selectedFormId)?.title || "",
                      }
                    : null
                }
                onChange={(selected) => setSelectedFormId(selected?.value || "")}
                placeholder="Search and select a form"
                isClearable
                isDisabled={isLoading}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  control: (base) => ({ ...base, fontSize: "0.875rem", minHeight: "2.25rem" }),
                  placeholder: (base) => ({ ...base, fontSize: "0.875rem" }),
                  singleValue: (base) => ({ ...base, fontSize: "0.875rem" }),
                  option: (base) => ({ ...base, fontSize: "0.875rem" }),
                  input: (base) => ({ ...base, fontSize: "0.875rem" }),
                }}
              />
            </div>

            {/* Toggles Row — Repeat (left) + Collaborative (right, audit forms only) */}
            <div className="flex items-center justify-between gap-4 py-1">
              {/* Repeat Planner Toggle — Left */}
              <div className="flex items-center gap-2">
                <Switch
                  id="create-repeat-enabled"
                  checked={repeatEnabled}
                  onCheckedChange={(checked) => setRepeatEnabled(checked === true)}
                />
                <Label htmlFor="create-repeat-enabled" className="text-sm font-medium cursor-pointer">
                  Repeat Planner
                </Label>
              </div>

              {/* Collaborative Audit Toggle — Right (audit forms only) */}
              {selectedFormId && (() => {
                const selectedForm = forms.find((f) => String(f.id) === selectedFormId)
                return selectedForm?.form_type === "audit" || selectedForm?.title?.toLowerCase().includes("audit")
              })() && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="create-collaborative-enabled" className="text-sm font-medium cursor-pointer">
                    Collaborative Audit
                  </Label>
                  <Switch
                    id="create-collaborative-enabled"
                    checked={collaborativeEnabled}
                    onCheckedChange={(checked) => {
                      const next = checked === true
                      setCollaborativeEnabled(next)
                      if (next) {
                        setCollabWizardStep(1)
                        setCollabWizardOpen(true)
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-date" className="text-xs">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="folder" className="text-xs">Folder (optional)</Label>
                <select
                  id="folder"
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full border rounded-md p-2 text-sm bg-background h-9"
                >
                  <option value="">No Folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Share With section — hidden in collaborative mode (handled by wizard) */}
            {!collaborativeEnabled && (
              <div className="space-y-1">
                <Label className="text-xs">Share With</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setUserDialogOpen(true)}
                    className="border rounded-md p-2 text-left hover:bg-muted transition-colors"
                  >
                    <div className="text-xs text-muted-foreground">Users</div>
                    <div className="text-sm truncate">
                      {selectedUsers.length > 0 ? `${selectedUsers.length} selected` : "Select users"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGroupDialogOpen(true)}
                    className="border rounded-md p-2 text-left hover:bg-muted transition-colors"
                  >
                    <div className="text-xs text-muted-foreground">Groups</div>
                    <div className="text-sm truncate">
                      {selectedGroups.length > 0 ? `${selectedGroups.length} selected` : "Select groups"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocationDialogOpen(true)}
                    className="border rounded-md p-2 text-left hover:bg-muted transition-colors"
                  >
                    <div className="text-xs text-muted-foreground">Locations</div>
                    <div className="text-sm truncate">
                      {selectedLocations.length > 0 ? `${selectedLocations.length} selected` : "Select locations"}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Repeat Planner Settings — Interval fields (shown when toggle is on) */}
            {repeatEnabled && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Repeat Interval (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={repeatIntervalDays}
                      onChange={(e) => setRepeatIntervalDays(Math.max(1, parseInt(e.target.value) || 0))}
                      placeholder="e.g., 50 or 100"
                      className="bg-white h-9"
                    />
                    <p className="text-xs text-muted-foreground">Auto-reassign every N days</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Early Notification (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={earlyNotificationDays}
                      onChange={(e) => setEarlyNotificationDays(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="e.g., 3"
                      className="bg-white h-9"
                    />
                    <p className="text-xs text-muted-foreground">Visible N days before start</p>
                  </div>
                </div>
              </div>
            )}

            {/* Collaborative Audit — Participants + Team Leader badge */}
            {collaborativeEnabled && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-1.5 flex-wrap">
                <span className="font-medium">Participants:</span>
                <span>{selectedUsers.length + selectedGroups.length} selected</span>
                {teamLeaderId && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-medium">Team Leader:</span>
                    <span>{displayName(collabPoolUsers.find((u) => String(u.id) === teamLeaderId) as UserOption)}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCollabWizardStep(1)
                    setCollabWizardOpen(true)
                  }}
                  className="ml-auto text-blue-600 hover:underline"
                >
                  {teamLeaderId ? "Change" : "Select"}
                </button>
              </div>
            )}

            {/* Collaborative Audit — 2-Step Wizard Dialog */}
            <Dialog open={collabWizardOpen} onOpenChange={setCollabWizardOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {collabWizardStep === 1 ? "Step 1: Select Participants" : "Step 2: Select Team Leader"}
                  </DialogTitle>
                  <DialogDescription>
                    {collabWizardStep === 1
                      ? "Choose users and/or groups as participants for the collaborative audit."
                      : "Pick a Team Leader from the selected participants to manage group delegation."}
                  </DialogDescription>
                </DialogHeader>

                {collabWizardStep === 1 ? (
                  /* Step 1: Users + Groups tabs */
                  <CollabParticipantsStep
                    users={users}
                    groups={groups}
                    selectedUsers={selectedUsers}
                    selectedGroups={selectedGroups}
                    setSelectedUsers={setSelectedUsers}
                    setSelectedGroups={setSelectedGroups}
                    displayName={displayName}
                  />
                ) : (
                  /* Step 2: Team Leader dropdown filtered to pool */
                  <div className="space-y-3 py-2">
                    {isLoadingGroupMembers ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading group members...</p>
                    ) : collabPoolUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No users available. Go back and select users or groups.</p>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {selectedUsers.length > 0 && `${selectedUsers.length} direct users`}
                          {selectedUsers.length > 0 && groupMembers.length > 0 && " + "}
                          {groupMembers.length > 0 && `${groupMembers.length} group members`}
                          {" available"}
                        </div>
                        <ReactSelect
                          options={collabPoolUsers.map((u) => ({ value: String(u.id), label: displayName(u) }))}
                          value={
                            teamLeaderId
                              ? {
                                  value: teamLeaderId,
                                  label: displayName(
                                    collabPoolUsers.find((u) => String(u.id) === teamLeaderId) ||
                                      users.find((u) => String(u.id) === teamLeaderId) as UserOption
                                  ),
                                }
                              : null
                          }
                          onChange={(selected) => setTeamLeaderId(selected?.value || "")}
                          placeholder="Search and select team leader"
                          isClearable
                          menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                          styles={{
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            control: (base) => ({ ...base, fontSize: "0.875rem", minHeight: "2.25rem" }),
                            placeholder: (base) => ({ ...base, fontSize: "0.875rem" }),
                            singleValue: (base) => ({ ...base, fontSize: "0.875rem" }),
                            option: (base) => ({ ...base, fontSize: "0.875rem" }),
                            input: (base) => ({ ...base, fontSize: "0.875rem" }),
                          }}
                        />
                      </>
                    )}
                  </div>
                )}

                <DialogFooter>
                  {collabWizardStep === 1 ? (
                    <>
                      <Button variant="outline" onClick={() => setCollabWizardOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          if (selectedUsers.length === 0 && selectedGroups.length === 0) {
                            toast({ title: "Error", description: "Select at least one user or group", variant: "destructive" })
                            return
                          }
                          await fetchGroupMembers(selectedGroups)
                          setCollabWizardStep(2)
                        }}
                        disabled={selectedUsers.length === 0 && selectedGroups.length === 0}
                      >
                        Next: Select Team Leader
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setCollabWizardStep(1)}>
                        Back
                      </Button>
                      <Button
                        onClick={() => setCollabWizardOpen(false)}
                        disabled={!teamLeaderId}
                      >
                        Confirm
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <SelectionDialog
              open={userDialogOpen}
              onOpenChange={setUserDialogOpen}
              title="Select Users"
              searchPlaceholder="Search users..."
              options={users.map((u) => ({ id: u.id, label: displayName(u) }))}
              selected={selectedUsers}
              onChange={setSelectedUsers}
            />
            <SelectionDialog
              open={groupDialogOpen}
              onOpenChange={setGroupDialogOpen}
              title="Select Groups"
              searchPlaceholder="Search groups..."
              options={groups.map((g) => ({ id: g.id, label: g.name }))}
              selected={selectedGroups}
              onChange={setSelectedGroups}
            />
            <SelectionDialog
              open={locationDialogOpen}
              onOpenChange={setLocationDialogOpen}
              title="Select Locations"
              searchPlaceholder="Search locations..."
              options={locations.map((l) => ({ id: l.id, label: l.name }))}
              selected={selectedLocations}
              onChange={setSelectedLocations}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving || isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? "Creating..." : "Create & Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
