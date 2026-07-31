"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useRequireModuleAccess } from "@/hooks/useRequireModuleAccess"

export default function NewShiftPage() {
  const { hydrated, hasRequiredAccess } = useRequireModuleAccess("attendance", "full_access", {
    redirectInsufficient: "/attendance/shifts",
    redirectNoAccess: "/dashboard",
  })
  if (!hydrated || !hasRequiredAccess) return null

  const [hasGpsBoundary, setHasGpsBoundary] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      toast({
        title: "Shift created",
        description: "The shift assignment has been created successfully.",
      })
      router.push("/attendance/shifts")
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/attendance/shifts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Shift Assignment</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Shift Details</CardTitle>
            <CardDescription>Create a new shift assignment for an employee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select required>
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emp001">John Doe (EMP001)</SelectItem>
                    <SelectItem value="emp002">Jane Smith (EMP002)</SelectItem>
                    <SelectItem value="emp003">Michael Johnson (EMP003)</SelectItem>
                    <SelectItem value="emp004">Sarah Williams (EMP004)</SelectItem>
                    <SelectItem value="emp005">Robert Brown (EMP005)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift-type">Shift Type</Label>
                <Select required>
                  <SelectTrigger id="shift-type">
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8:00 AM - 5:00 PM)</SelectItem>
                    <SelectItem value="evening">Evening (5:00 PM - 2:00 AM)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input id="start-date" type="date" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input id="end-date" type="date" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select required>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse-a">Warehouse A</SelectItem>
                  <SelectItem value="warehouse-b">Warehouse B</SelectItem>
                  <SelectItem value="office">Office Building</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="gps-boundary"
                checked={hasGpsBoundary}
                onCheckedChange={(checked) => setHasGpsBoundary(checked === true)}
              />
              <label
                htmlFor="gps-boundary"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable GPS boundary for this location
              </label>
            </div>

            {hasGpsBoundary && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border p-4 rounded-md">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input id="latitude" type="number" step="0.000001" placeholder="e.g. 37.7749" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input id="longitude" type="number" step="0.000001" placeholder="e.g. -122.4194" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="radius">Radius (meters)</Label>
                  <Input id="radius" type="number" placeholder="e.g. 100" required />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={() => router.push("/attendance/shifts")}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Shift"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
