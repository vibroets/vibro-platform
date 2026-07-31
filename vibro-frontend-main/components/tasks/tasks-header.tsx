
"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Plus, Search, BarChart, RefreshCw, ChevronDown, FileUp, Download, Filter } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useModuleAccess } from "@/hooks/useModuleAccess"

interface taskHeaderProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}

export function TasksHeader({ searchQuery, setSearchQuery }: taskHeaderProps) {
  const router = useRouter()
  const { isFullAccess, isViewOnly } = useModuleAccess("tasks")

  // Temporary filters used in the dropdowns
  const [tempStatusFilter, setTempStatusFilter] = useState("all");
  const [tempTitleFilter, setTempTitleFilter] = useState("all");
  const [tempInchargeFilter, setTempInchargeFilter] = useState("all");

  const [statusFilter, setStatusFilter] = useState("all")
  const [titleFilter, setTitleFilter] = useState("all")
  const [inchargeFilter, setInchargeFilter] = useState("all")

  // const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would filter the tasks
    toast({
      title: "Search initiated",
      description: `Searching for tasks matching "${searchQuery}"`,
    })
  }

  const handleSync = () => {
    // In a real app, this would sync with the server
    toast({
      title: "Sync initiated",
      description: "Syncing tasks with the server...",
    })

    // Simulate sync delay
    setTimeout(() => {
      toast({
        title: "Sync complete",
        description: "All tasks have been synchronized.",
      })
    }, 1500)
  }

  const handleExport = () => {
    // In a real app, this would export tasks
    toast({
      title: "Export initiated",
      description: "Exporting tasks data...",
    })

    // Simulate export delay
    setTimeout(() => {
      toast({
        title: "Export complete",
        description: "Tasks data has been exported.",
      })
    }, 1500)
  }

  const addTask = () =>{
    window.dispatchEvent(new Event("route-loader-start"));
    router.push("/tasks/new")
  }

            // <Button onClick={() => router.push("/tasks/new")}>


  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by Title, Assignee, or Status..." 
          className="w-full sm:w-[300px] pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>
      <div className="flex flex-col sm:flex-row gap-2">
        {isFullAccess ? (
          <Button onClick={() => addTask()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        ) : isViewOnly ? (
          <Button className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        ) : null}
        {isFullAccess && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push("/tasks/bulk-import")}>
                <FileUp className="mr-2 h-4 w-4" />
                Bulk Import
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/tasks?view=reports")}>
                <BarChart className="mr-2 h-4 w-4" />
                View Reports
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSync}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
