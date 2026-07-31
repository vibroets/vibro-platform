"use client"

import { ArrowLeft, Bell, Building2, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSelector, useDispatch } from "react-redux"
import { selectUser, clearAuth } from "@/redux/slices/authSlice"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ConfirmModalBox from "./ui/confirm-modalbox"
// import BackConfirmDialog from "@/components/BackConfirmDialog"
// import { useFormStore } from "@/stores/formstore"
import { getEmptyFormData } from "@/utils/form-utils"

import BackConfirmDialog from "./ui/BackConfirmDialog"
import { useFormStore } from "@/utils/formStore"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { useExcelJobStore } from "@/utils/excelJobStore"


interface User {
  role_details: any
  email: string
  first_name?: string
  last_name?: string
  designation?: string
  is_admin?: boolean
  is_superadmin?: boolean
  mobiles_supervisor?: boolean
}

interface HeaderProps {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  title?: string
  description?: string
  id?: string
  isInEditCheck?: string
  setFormData?: (data: any) => void
  setStep?: (step: string) => void
  step?: string
  onBack?: () => void
  status?: string
}

export function Header({
  isOpen,
  setIsOpen,
  title,
  description,
  id,
  isInEditCheck,
  setFormData,
  setStep, step, onBack, status
}: HeaderProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const { isFormDirty, setIsFormDirty } = useFormStore()
  const completedJobs = useExcelJobStore((state) => state.completedJobs);
  const clearJob = useExcelJobStore((state) => state.clearJob);

  const usericonimg = "https://cdn-icons-png.flaticon.com/128/17655/17655721.png"

  const getUserRole = (user: User | null): string => {
    if (!user || !user.role_details) return "User"
    switch (user.role_details.name) {
      case "super_admin":
        return "Super Admin"
      case "admin":
        return "Admin"
      case "end_user":
        return "User"
      default:
        return "User"
    }
  }

  const handleLogout = () => {
    dispatch(clearAuth())
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-300 shadow-md bg-background">
      <div className="flex h-16 items-center px-4 md:px-6 ">
        {/* 🔙 Back Button */}
        {setFormData && setStep && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isFormDirty) {
                setShowBackConfirm(true)
              } else {
                setFormData(getEmptyFormData())

                if (isInEditCheck === "edit") {
                  router.push(`/forms/${id}/?status=${status}`)
                } else if (step === "type") {
                  router.push("/forms")
                } else {
                  setStep("type")
                }
              }
            }}
            className="mr-4 bg-blue-500 text-white hover:bg-blue-600 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="mr-4 bg-blue-500 text-white hover:bg-blue-600 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        {/* Title + description */}
        <div className="flex items-center gap-3">
          {title && (
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600" />
          )}
          <div className="flex flex-col">
            {title && (
              <span className="text-xl font-bold tracking-tight text-gray-900 leading-tight">{title}</span>
            )}
            {description && (
              <span className="text-[12px] text-gray-500 font-normal leading-tight mt-0.5">
                {description}
              </span>
            )}
          </div>
        </div>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2  px-3 py-1 rounded-full border border-gray-300">
            <Building2 className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600 font-medium text-[15px]">{user?.organization_name}</span>
          </div>
          <div className="relative hidden md:flex">
            {/* <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> */}
            {/* <Input type="search" placeholder="Search..." className="w-64 pl-8" /> */}
            {/* <h1>Hi,{user?.first_name}</h1> */}
            <span className="text-gray-600 text-xl font-medium
           ">
              {user?.first_name}
            </span>
          </div>

          {/* Notifications */}
          {/* Notifications */}

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {completedJobs.length > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-[10px] text-white">
                    {completedJobs.length}
                  </span>
                )}              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto p-6">
              <DialogHeader>
                <DialogTitle>Notifications</DialogTitle>
                <DialogDescription>
                  Stay updated with latest activities
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3">
                {/* Example notification */}
                {completedJobs.length === 0 && (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No completed reports yet
                  </div>
                )}

                {completedJobs.map(job => (
                  <div
                    key={job.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium flex flex-wrap items-center gap-1">
                        {job.status === "SUCCESS" ? "☑️" : "❌"}

                        {job.type === "excel" ? " Excel report" : " PDF report"}

                        {job.filename && (
                          <span className="font-semibold text-blue-600">
                            {job.filename}
                          </span>
                        )}

                        {job.status === "SUCCESS"
                          ? " has been sent to Email"
                          : " failed to send"}
                      </p>

                      <p className="text-[10px] text-muted-foreground">
                        {new Date(job.timestamp).toLocaleTimeString()}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-xs"
                      onClick={() => clearJob(job.id)}
                    >
                      Clear
                    </Button>
                  </div>
                ))}



                {/* More notifications here */}
              </div>

              {/* <div className="pt-3 border-t flex justify-center">
                <Button variant="secondary" size="sm">
                  View all notifications
                </Button>
              </div> */}
            </DialogContent>
          </Dialog>


          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <div>
                <img src={usericonimg} className="justify-self-center w-10 h-10 mt-2" />
              </div>
              <DropdownMenuLabel>
                <div className="justify-self-center">{user?.first_name}</div>
                <div className="justify-self-center font-normal">{getUserRole(user)}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowModal(true)}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Logout confirmation */}
      <ConfirmModalBox
        isOpen={showModal}
        title="Logout Form"
        variant="delete"
        description={`Are you sure you want to logout? You will be signed out of your current session and will need to log in again to access your account.`}
        button="Confirm Logout"
        onClose={() => {
          setShowModal(false)
        }}
        onConfirm={() => {
          handleLogout()
        }}
      />

      {/* 🔙 Back confirmation */}
      <BackConfirmDialog
        open={showBackConfirm}
        onConfirm={() => {
          setFormData?.(getEmptyFormData())
          setIsFormDirty(false)
          isInEditCheck === "edit"
            ? router.push(`/forms/${id}/`)
            : setStep?.("type")
          setShowBackConfirm(false)
        }}
        onCancel={() => setShowBackConfirm(false)}
      />
    </header>
  )
}
