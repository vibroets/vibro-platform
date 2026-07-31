"use client"

import { useState } from "react"
import { AnnouncementsTable } from "@/components/announcements/announcements-table"
import { AnnouncementsHeader } from "@/components/announcements/announcements-header"
import AnnouncementBulkShare from "@/components/announcements/announcement-bulk-share"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import axiosInstance from "@/utils/axiosInstance"
import hotToaster from "react-hot-toast"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function AnnouncementsPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("announcements", "view_only", {
    redirectNoAccess: "/dashboard",
    redirectInsufficient: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const { isFullAccess } = useModuleAccess("announcements")
  const [filter, setFilter] = useState("all")
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkShareDialogOpen, setBulkShareDialogOpen] = useState(false)

  const canEdit = isFullAccess

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) return
    setBulkDeleteDialogOpen(true)
  }

  const handleBulkShare = () => {
    if (selectedRows.length === 0) return
    setBulkShareDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    if (selectedRows.length === 0) return

    try {
      await axiosInstance.post('/announcements/bulk_delete', {
        ids: selectedRows
      })
      setSelectedRows([])
      hotToaster.success("Selected announcements deleted successfully")
      setBulkDeleteDialogOpen(false)
      // Trigger a refetch of announcements - this would need to be implemented
      // For now, the table component handles its own state updates
    } catch (err) {
      hotToaster.error("Failed to delete selected announcements")
      console.error('Error bulk deleting announcements:', err)
    }
  }

  const confirmBulkShare = async (users: number[], groups: number[]) => {
    if (selectedRows.length === 0) return

    try {
      await axiosInstance.post('/announcements/bulk_share/', {
        announcements: selectedRows,
        users: users,
        groups: groups,
        share_status: "sent"
      })
      setSelectedRows([])
      hotToaster.success("Selected announcements shared successfully")
      setBulkShareDialogOpen(false)
    } catch (err) {
      hotToaster.error("Failed to share selected announcements")
      console.error('Error bulk sharing announcements:', err)
    }
  }

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title="Announcements"
          description="Create, schedule and track organisation-wide updates."
          step="header"
        />

        <div
          className={`flex flex-col gap-4 p-4 transition-all duration-300  ${
            isSidebarOpen ? "md:px-4" : ""
          }`}
        >
          <div className="p-2 md:px-6">
            <AnnouncementsHeader
              onFilterChange={setFilter}
              onAuthorFilterChange={setAuthorFilter}
              onDateFilterChange={setDateFilter}
              onCategoryFilterChange={setCategoryFilter}
              sortDirection={sortDirection}
              onToggleSort={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              setSearchQuery={setSearchQuery}
              searchQuery={searchQuery}
              selectedRows={selectedRows}
              canEdit={canEdit}
              onBulkDelete={handleBulkDelete}
              onBulkShare={handleBulkShare}
            />
            <AnnouncementsTable
              searchQuery={searchQuery}
              filter={filter}
              authorFilter={authorFilter}
              categoryFilter={categoryFilter}
              dateFilter={dateFilter}
              sortDirection={sortDirection}
              selectedRows={selectedRows}
              setSelectedRows={setSelectedRows}
              bulkDeleteDialogOpen={bulkDeleteDialogOpen}
              setBulkDeleteDialogOpen={setBulkDeleteDialogOpen}
              onConfirmBulkDelete={confirmBulkDelete}
            />
          </div>
        </div>
      </div>

      <AnnouncementBulkShare
        isOpen={bulkShareDialogOpen}
        onClose={() => setBulkShareDialogOpen(false)}
        selectedAnnouncements={selectedRows}
        onConfirm={confirmBulkShare}
      />
    </div>
  )
}
