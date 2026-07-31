"use client"

import CourseUploader from "@/components/learning/CourseUploader";
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess";

export default function Page() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("learning_training", "full_access", {
    redirectInsufficient: "/learning",
  })
  if (!hydrated || !hasRequiredAccess) return null

  return <CourseUploader />;
}
