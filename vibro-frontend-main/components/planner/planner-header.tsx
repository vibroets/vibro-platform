"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, FolderPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import { CreatePlannerDialog } from "@/components/planner/create-planner-dialog"

interface PlannerHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onPlannerCreated?: () => void;
}

export function PlannerHeader({ searchQuery, setSearchQuery, onPlannerCreated }: PlannerHeaderProps) {
  const router = useRouter()
  const { isFullAccess, isViewOnly } = useModuleAccess("planner")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <form className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search all columns..."
          className="w-full sm:w-[300px] pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>
      {isFullAccess ? (
        <div className="flex items-center gap-2">
          <CreatePlannerDialog onCreated={onPlannerCreated} />
          <Button variant="outline" onClick={() => router.push("/planner/folders")}>
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button onClick={() => router.push("/planner/upload")}>Bulk Import</Button>
        </div>
      ) : isViewOnly ? (
        <Button
          disabled
          title="You have view-only access for Planner"
          className="bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
        >
          Bulk Import
        </Button>
      ) : null}
    </div>


  )
}
