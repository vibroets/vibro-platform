"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type UserRole = "Super Admin" | "Admin" | "Mobile Supervisor" | "End User"

interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

interface UserContextType {
  user: User
  setUser: (user: User) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    role: "Admin",
  })

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
