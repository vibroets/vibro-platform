"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, RefreshCw, Phone, Mail, Building2, User } from "lucide-react"
import axiosInstance from "@/utils/axiosInstance"
import hotToaster from "react-hot-toast"

interface Enquiry {
  id: number
  name: string
  organization_name: string
  email: string
  phone: string
  message: string | null
  submitted_at: string
  is_contacted: boolean
}

export default function EnquiryManagement() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const fetchEnquiries = async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.get("/enquiries/")
      setEnquiries(res.data)
    } catch (err) {
      console.error("Failed to fetch enquiries", err)
      hotToaster.error("Failed to load enquiries")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEnquiries()
  }, [])

  const handleToggleContacted = async (id: number, current: boolean) => {
    try {
      await axiosInstance.patch(`/enquiries/${id}/`, { is_contacted: !current })
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, is_contacted: !current } : e))
      hotToaster.success(current ? "Marked as Not Contacted" : "Marked as Contacted")
    } catch (err) {
      hotToaster.error("Failed to update status")
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axiosInstance.delete(`/enquiries/${id}/`)
      setEnquiries(prev => prev.filter(e => e.id !== id))
      hotToaster.success("Enquiry deleted")
    } catch (err) {
      hotToaster.error("Failed to delete enquiry")
    }
  }

  const filtered = enquiries.filter(e => {
    const q = search.toLowerCase()
    return e.name.toLowerCase().includes(q) ||
      e.organization_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.phone.includes(q)
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Enquiries</CardTitle>
            <CardDescription>Website enquiry submissions from unregistered users</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEnquiries} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search enquiries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {loading && enquiries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Loading enquiries...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No enquiries found.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((enq) => (
                  <TableRow key={enq.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {enq.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {enq.organization_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a href={`mailto:${enq.email}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                        <Mail className="h-4 w-4" />
                        {enq.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <a href={`tel:${enq.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                        <Phone className="h-4 w-4" />
                        {enq.phone}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(enq.submitted_at)}</TableCell>
                    <TableCell>
                      <Badge variant={enq.is_contacted ? "default" : "secondary"}>
                        {enq.is_contacted ? "Contacted" : "New"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleContacted(enq.id, enq.is_contacted)}
                        >
                          {enq.is_contacted ? "Mark New" : "Mark Contacted"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(enq.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
