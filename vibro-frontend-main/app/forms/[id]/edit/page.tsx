"use client"

import { FormCreator } from "@/components/forms/form-creator"
import { useParams, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useState, useEffect } from "react"
import { FormData } from "@/components/forms/form-creator"
import { getEmptyFormData } from "@/utils/form-utils"
import { useFormStore } from "@/utils/formStore"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function EditFormPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("forms", "full_access", {
    redirectInsufficient: "/forms",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const params = useParams()
  const searchParams = useSearchParams();
  const formId = params.id as string
  const pagemode = searchParams.get("mode");
  const status = searchParams.get("status");
  const isDuplicate = pagemode === "duplicate";
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // 🔹 State for FormCreator
  const [formData, setFormData] = useState<FormData>(getEmptyFormData())
  const [step, setStep] = useState("type")
  const [isInEditCheck, setIsInEditCheck] = useState("edit")
  const [currentFormId, setFormId] = useState(formId)
  const consumePrefetchedForm = useFormStore((state: any) => state.consumePrefetchedForm)
  const [prefetchedData, setPrefetchedData] = useState<any>(null)

  // Optional: fetch existing form data here
  useEffect(() => {
    if (formId) {
      setStep("header")
    }
    // try to hydrate from prefetch store
    const consumed = consumePrefetchedForm(String(formId))
    if (consumed) {
      setPrefetchedData(consumed)
    }
    // fetch form data by `formId` and setFormData
    // setStep("type") or whatever the last saved step is
  }, [formId])

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:pl-14"}`}>
        <Header
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          title={isDuplicate?"Duplicate Form":"Edit Form"}
          description={isDuplicate?"Duplicate this form and make necessary changes": `Update your ${formData.type ? `${formData.type}` : ""} form details`}
          id={currentFormId}
          isInEditCheck={isInEditCheck}
          setFormData={setFormData}
          setStep={setStep}
          step={step}
          status={status??" "}
        />
        <div className={`flex flex-col gap-4 p-4 bg-neutral-100 transition-all duration-300 ${isSidebarOpen ? "md:pl-8" : ""}`}>
          <FormCreator
            id={currentFormId}
            isEditing
            formData={formData}
            setFormData={setFormData}
            step={step}
            setStep={setStep}
            setIsInEditCheck={setIsInEditCheck}
            setFormId={setFormId}
            prefetchedData={prefetchedData}
            status={status??" "}
          />
        </div>
      </div>
    </div>
  )
}
