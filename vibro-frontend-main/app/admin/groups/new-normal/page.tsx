"use client"
import dynamic from "next/dynamic"


const NormalGroupForm = dynamic(() =>
  import("@/components/admin/normal-group-form").then(mod => mod.NormalGroupForm),
  { ssr: false }
)
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function NewNormalGroupPage() {
      const [isSidebarOpen, setIsSidebarOpen] = useState(true)
 const router = useRouter()

  return (
     <div className="min-h-screen">
              <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}/>
              <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : ""}`}>
              <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}/>
               <div className="flex flex-col gap-4 p-4 md:p-8">
            <div className="p-4 md:p-6 ">
    <div className="space-y-6">
       <div>
        <Button variant="outline" type="button" onClick={() => router.push("/admin?tab=groups")}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Normal Group</h1>
        <p className="text-muted-foreground">Create a new group with manually selected members</p>
      </div>

      <NormalGroupForm />
    </div>
    </div>
    </div>
    </div>
    </div>
  )
}
