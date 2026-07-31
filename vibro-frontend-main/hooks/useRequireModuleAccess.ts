// hooks/useRequireModuleAccess.ts
"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSelector } from "react-redux"
import { selectHydrated } from "@/redux/slices/authSlice"
import { useModuleAccess } from "@/hooks/useModuleAccess"

type RequiredAccess = "view_only" | "full_access"

const accessPriority = {
  no_access: 0,
  view_only: 1,
  full_access: 2,
} as const

const requiredPriority: Record<RequiredAccess, number> = {
  view_only: 1,
  full_access: 2,
}

export function useRequireModuleAccess(
  moduleKey: string,
  required: RequiredAccess,
  options?: {
    redirectNoAccess?: string
    redirectInsufficient?: string
    enabled?: boolean
  }
) {
  const router = useRouter()
  const hydrated = useSelector(selectHydrated)
  const { access, isNoAccess } = useModuleAccess(moduleKey)

  const hasRequiredAccess = useMemo(() => {
    return accessPriority[access] >= requiredPriority[required]
  }, [access, required])

  const redirectNoAccess = options?.redirectNoAccess ?? "/dashboard"
  const redirectInsufficient = options?.redirectInsufficient ?? "/dashboard"
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) return
    if (!hydrated) return

    if (isNoAccess) {
      router.replace(redirectNoAccess)
      return
    }

    if (!hasRequiredAccess) {
      router.replace(redirectInsufficient)
    }
  }, [
    enabled,
    hydrated,
    hasRequiredAccess,
    isNoAccess,
    redirectInsufficient,
    redirectNoAccess,
    router,
  ])

  return {
    access,
    hasRequiredAccess,
    hydrated,
  }
}

