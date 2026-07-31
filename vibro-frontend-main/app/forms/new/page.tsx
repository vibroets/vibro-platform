"use client"

import { FormCreator } from "@/components/forms/form-creator"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import { getEmptyFormData } from "@/utils/form-utils"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function NewFormPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "full_access", {
    redirectInsufficient: "/forms",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [formData, setFormData] = useState(getEmptyFormData())   // 👈 lifted state
  const [step, setStep] = useState("type")                       // 👈 lifted state
  const [isInEditCheck, setIsInEditCheck] = useState<string | null>(null) // 👈 if needed
  const [formId, setFormId] = useState<string | null>(null)      // 👈 if needed
  const router = useRouter()
  return (
    <div className="min-h-screen bg-neutral-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-14"}`}>
        
        {/* 🔙 Pass the props Header needs */}
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title="Create New Form"
          // description="Build and configure your form"{formData.title ? `: ${formData.title}` : ""}
          description={`Configure your ${formData.type ? `${formData.type}` : ""} form settings`}
          setFormData={setFormData}
          setStep={setStep}
          step={step}
          id={formId ?? undefined}
          isInEditCheck={isInEditCheck ?? undefined}
        />

        <div className={`flex flex-col gap-4 p-4 transition-all duration-300 bg-neutral-100 ${isSidebarOpen ? "md:pl-8" : ""}`}>
          <Suspense fallback={<div>Loading form...</div>}>
            <FormCreator
              formData={formData}
              setFormData={setFormData}
              step={step}
              setStep={setStep}
              setIsInEditCheck={setIsInEditCheck}
              setFormId={setFormId}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
