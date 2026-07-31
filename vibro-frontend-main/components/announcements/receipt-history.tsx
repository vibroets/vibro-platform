"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Download, ArrowLeft, Filter } from "lucide-react"
import axiosInstance from "@/utils/axiosInstance"

interface ReceiptHistoryProps {
  id: string
}

interface ShareData {
  id: number
  announcement: number
  announcement_title: string
  sent_to_user: number | null
  sent_to_user_name: string | null
  sent_to_group: number | null
  sent_to_group_name: string | null
  share_status: string
  sent_timestamp: string
  acknowledged: boolean
  viewed_timestamp: string | null
  liked: boolean
  sent_to_user_location: string | null
  sent_to_user_designation: string | null
  acknowledged_timestamp: string | null
  user_group_name: string | null
}

interface Recipient {
  id: string
  name: string
  designation: string
  location: string
  group: string
  sent: string
  viewed: string
  acknowledged: string
  status: string
}

export function ReceiptHistory({ id }: ReceiptHistoryProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Individual filter states
  const [nameFilter, setNameFilter] = useState("")
  const [designationFilter, setDesignationFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [groupFilter, setGroupFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString()
  }

  useEffect(() => {
    const fetchShares = async () => {
      try {
        const response = await axiosInstance.get(`/announcements/${id}/shares/`)
        const data: ShareData[] = response.data

        // Filter for users only
        const userShares = data.filter(share => share.sent_to_user !== null)
        const mappedRecipients: Recipient[] = userShares.map((share) => ({
          id: share.id.toString(),
          name: share.sent_to_user_name || "-",
          designation: share.sent_to_user_designation ?? "-",
          location: share.sent_to_user_location ?? "-",
          group: share.user_group_name || "-",
          sent: formatDate(share.sent_timestamp),
          viewed: formatDate(share.viewed_timestamp) ? formatDate(share.viewed_timestamp) : " - ",
          acknowledged: share.acknowledged_timestamp ? formatDate(share.acknowledged_timestamp) : " - ",
          status: share.share_status.charAt(0).toUpperCase() + share.share_status.slice(1),
        }))

        // Extract unique group names
        const groupShares = data.filter(share => share.sent_to_group !== null)
        const uniqueGroups = Array.from(new Set(groupShares.map(share => share.sent_to_group_name).filter((name): name is string => name !== null)))

        setRecipients(mappedRecipients)
        setGroups(uniqueGroups)
      } catch (error) {
        console.error("Error fetching shares:", error)
        setRecipients([])
        setGroups([])
      } finally {
        setLoading(false)
      }
    }
    fetchShares()
  }, [id])

  const filteredRecipients = recipients.filter((recipient) => {
    // Global search filter
    const matchesSearch =
      recipient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipient.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipient.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipient.group.toLowerCase().includes(searchQuery.toLowerCase())

    // Individual column filters
    const matchesName = !nameFilter || recipient.name.toLowerCase().includes(nameFilter.toLowerCase())
    const matchesDesignation = !designationFilter || recipient.designation.toLowerCase().includes(designationFilter.toLowerCase())
    const matchesLocation = !locationFilter || recipient.location.toLowerCase().includes(locationFilter.toLowerCase())
    const matchesGroup = !groupFilter || recipient.group.toLowerCase().includes(groupFilter.toLowerCase())
    const matchesStatus = !statusFilter || recipient.status === statusFilter

    return matchesSearch && matchesName && matchesDesignation && matchesLocation && matchesGroup && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Acknowledged":
        return <Badge>Acknowledged</Badge>
      case "Viewed":
        return <Badge variant="secondary">Viewed</Badge>
      case "Received":
        return <Badge variant="outline">Received</Badge>
      case "Sent":
        return (
          <Badge variant="outline" className="bg-muted">
            Sent
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      {groups.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold">Shared Groups :</h3>
          <p className="text-muted-foreground">{groups.join(', ')}</p>
        </div>
      )}
      {recipients.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold">Shared Users :</h3>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, designation, location or group..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>



      <div className="rounded-md border max-h-96 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Viewed</TableHead>
              <TableHead>Acknowledged</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
            {/* Filter row below header */}
            <TableRow className="bg-gray-50 border-b border-blue-100">
              <TableCell>
                <input
                  type="text"
                  placeholder="Name"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <input
                  type="text"
                  placeholder="Designation"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <input
                  type="text"
                  placeholder="Location"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </TableCell>
              <TableCell>
                <input
                  type="text"
                  placeholder="Group"
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                />
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell>
                <select
                  className="h-8 text-xs bg-white border border-gray-200 focus:border-blue-400 rounded px-2 w-full"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="Viewed">Viewed</option>
                  <option value="Received">Received</option>
                  <option value="Sent">Sent</option>
                </select>
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredRecipients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  No receipt history found
                </TableCell>
              </TableRow>
            ) : (
              filteredRecipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell className="font-medium">{recipient.name}</TableCell>
                  <TableCell>{recipient.designation}</TableCell>
                  <TableCell>{recipient.location}</TableCell>
                  <TableCell>{recipient.group}</TableCell>
                  <TableCell>{recipient.sent}</TableCell>
                  <TableCell>{recipient.viewed}</TableCell>
                  <TableCell>{recipient.acknowledged}</TableCell>
                  <TableCell>{getStatusBadge(recipient.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
