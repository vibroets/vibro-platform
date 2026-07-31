//@ts-nocheck
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Share,
  Trash,
  Archive,
  RefreshCw,
  ChevronDown,
  Filter,
  Calendar,
  User,
  Megaphone,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { useModuleAccess } from "@/hooks/useModuleAccess"

interface AnnouncementsHeaderProps {
  onFilterChange: (filter: string) => void
  onAuthorFilterChange: (author: string | null) => void
  onDateFilterChange: (date: Date | null) => void
  onCategoryFilterChange?: (category: string | null) => void
  sortDirection?: "asc" | "desc"
  onToggleSort?: () => void
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  selectedRows?: number[];
  canEdit?: boolean;
  onBulkDelete?: () => void;
  onBulkShare?: () => void;
}

export function AnnouncementsHeader({
  onFilterChange,
  onAuthorFilterChange,
  onDateFilterChange,
  onCategoryFilterChange,
  sortDirection = "desc",
  onToggleSort,
  setSearchQuery,
  searchQuery,
  selectedRows = [],
  canEdit = false,
  onBulkDelete,
  onBulkShare,
}: AnnouncementsHeaderProps) {
  const router = useRouter()
  const { isFullAccess, isViewOnly } = useModuleAccess("announcements")
  const [date, setDate] = useState<Date | null>(null)
  // const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  const canCreate = isFullAccess

  // Mock list of authors for the filter
  const authors = ["John Doe", "Jane Smith", "Michael Johnson", "Sarah Williams", "Robert Brown"]

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    onFilterChange(value)
  }

  const handleDateSelect = (date: Date | null) => {
    console.log("Date selected:", date)
    setDate(date)
    onDateFilterChange(date)
  }

  const handleAuthorSelect = (author: string) => {
    onAuthorFilterChange(author)
  }

  const handleCategorySelect = (value: string) => {
    if (onCategoryFilterChange) {
      onCategoryFilterChange(value === "all" ? null : value)
    }
  }

  const clearFilters = () => {
    setDate(null)
    onDateFilterChange(null)
    onAuthorFilterChange(null)
  }

  const handleNewAnnouncement = () => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push("/announcements/new")
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // setSearchTerm(e.target.value)
    setSearchQuery(e.target.value)

    // In a real app, you would trigger a search or filter operation
  }



  return (
    <div className="space-y-6 mb-4">
      {/* Top header section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm md:text-base text-muted-foreground">
            Create, schedule, and track high-impact updates for your organisation.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by title, author, or status..."
              className="w-full pl-8 text-sm"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          {canCreate ? (
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={handleNewAnnouncement}>
                <Plus className="mr-2 h-4 w-4" />
                New announcement
              </Button>
            </div>
          ) : isViewOnly ? (
            <div className="flex gap-2 justify-end">
              <Button size="sm" className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed">
                <Plus className="mr-2 h-4 w-4" />
                New announcement
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 px-3 py-3 sm:px-4 sm:py-1">
        {selectedRows.length > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
              <TabsList className="flex flex-row gap-1">
                <TabsTrigger value="all" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                  All
                </TabsTrigger>
                <TabsTrigger value="live" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                  Live
                </TabsTrigger>
                <TabsTrigger value="expiring-today" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                  Expiring Today
                </TabsTrigger>
                <TabsTrigger value="expired" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                  Expired
                </TabsTrigger>
                <TabsTrigger value="pinned" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                  Pinned
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs font-medium text-muted-foreground mr-2">
                {selectedRows.length} selected
              </span>
              {canEdit && onBulkShare && (
                <Button variant="outline" size="sm" onClick={onBulkShare} className="mr-2">
                  <Share className="h-3.5 w-3.5 mr-1.5" />
                  Share Selected
                </Button>
              )}
              {canEdit && onBulkDelete && (
                <Button variant="destructive" size="sm" onClick={onBulkDelete} className="mr-2">
                  <Trash className="h-3.5 w-3.5 mr-1.5" />
                  Delete Selected
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="flex w-full flex-row gap-1">
              <TabsTrigger value="all" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                All
              </TabsTrigger>
              <TabsTrigger value="active" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                Active
              </TabsTrigger>
              <TabsTrigger value="pinned" className="whitespace-nowrap flex-1 hover:bg-blue-500 hover:text-white data-[state=active]:bg-blue-200 text-black rounded-md">
                Pinned
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

    </div>
  )
}
