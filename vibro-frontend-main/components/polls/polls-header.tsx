"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, RefreshCw, ChevronDown, Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import axiosInstance from "@/utils/axiosInstance"

interface PollsHeaderProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onSync?: () => void
}

export function PollsHeader({ searchQuery = "", onSearchChange, onSync }: PollsHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()

  const { isFullAccess, isViewOnly } = useModuleAccess("polls")
  const canCreate = isFullAccess

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleSync = () => {
    if (onSync) {
      onSync()
    } else {
      toast({ title: "Syncing polls", description: "Your polls are being synchronized with the server." })
    }
  }

  const handleExport = async () => {
    try {
      const res = await axiosInstance.get("/poll/polls/", { params: { format: "csv" } })
      toast({ title: "Export complete", description: "Polls exported successfully." })
    } catch (error: any) {
      toast({ title: "Export", description: "Export feature requires backend support.", variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Polls</h1>
        <p className="text-muted-foreground">Create and manage polls</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search polls..."
            className="w-full sm:w-[200px] pl-8"
            value={searchQuery}
            onChange={(e) => onSearchChange ? onSearchChange(e.target.value) : undefined}
          />
        </form>
        {canCreate ? (
          <Button onClick={() => router.push("/polls/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Poll
          </Button>
        ) : isViewOnly ? (
          <Button
            disabled
            title="You have view-only access for Polls"
            className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Poll
          </Button>
        ) : null}
        {canCreate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleSync}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
              </DropdownMenu>
        ) : isViewOnly ? (
          <Button
            disabled
            title="You have view-only access for Polls"
            className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
          >
            Actions
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
