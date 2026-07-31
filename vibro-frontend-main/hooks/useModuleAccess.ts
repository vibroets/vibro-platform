
// hooks/useModuleAccess.ts
import { useSelector } from "react-redux"
import { selectUser } from "@/redux/slices/authSlice"

const priority = {
  no_access: 0,
  view_only: 1,
  full_access: 2,
} as const

type AccessLevel = keyof typeof priority

function getEffectiveAccess(
  moduleKey: string,
  userAccess: { module: string; access: AccessLevel }[] = [],
  orgAccess: { module: string; access: AccessLevel }[] = []
): AccessLevel {
  const normalizedKey = moduleKey.toLowerCase()

  const userMap = new Map(
    userAccess.map((perm) => [perm.module.toLowerCase(), perm.access])
  )
  const orgMap = new Map(
    orgAccess.map((perm) => [perm.module.toLowerCase(), perm.access])
  )

  const org = orgMap.get(normalizedKey) ?? "no_access"
  const user = userMap.get(normalizedKey) ?? "no_access"

  return priority[org] <= priority[user] ? org : user
}

export function useModuleAccess(moduleKey: string) {
  const user = useSelector(selectUser)

  const isSuperAdmin =
    Boolean(user?.is_superadmin) ||
    user?.role_details?.name?.toLowerCase() === "super_admin"

  const access: AccessLevel = isSuperAdmin
    ? "full_access"
    : getEffectiveAccess(
        moduleKey,
        user?.module_access || [],
        user?.module_permissions || []
      )

  return {
    access,
    isFullAccess: access === "full_access",
    isViewOnly: access === "view_only",
    isNoAccess: access === "no_access",
    isSuperAdmin,
  }
}
