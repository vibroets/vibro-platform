"use client"

import type React from "react"

// Simplified version for this example
import { useState } from "react"

type Toast = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
   variant?: "default" | "destructive"
}

// Create a toast function that can be imported directly
export const toast = ({
  title,
  description,
  action,
  variant,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
   variant?: "default" | "destructive"
}) => {
  // This is a simplified implementation for direct imports
  console.log("Toast:", { title, description })
  // In a real implementation, this would use a global state or context
  // to add the toast to the UI
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({
    title,
    description,
    action,
    variant,
  }: { title?: string; description?: string; action?: React.ReactNode;  variant?: "default" | "destructive" }) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prevToasts) => [...prevToasts, { id, title, description, action, variant }])

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
    }, 5000)

    return id
  }

  const dismiss = (id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }

  return {
    toast,
    dismiss,
    toasts,
  }
}
