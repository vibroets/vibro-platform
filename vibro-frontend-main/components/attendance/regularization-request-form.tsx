"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Clock, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export function RegularizationRequestForm() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [requestType, setRequestType] = useState<string>("missed_punch")
  const [reason, setReason] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      toast({
        title: "Request submitted",
        description: "Your regularization request has been submitted successfully.",
      })
      router.push("/attendance")
    }, 1500)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Attendance Regularization Request</CardTitle>
          <CardDescription>
            Submit a request to correct attendance records. You have 3 requests remaining this month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="request-type">Request Type</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger id="request-type">
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missed_punch">Missed Punch</SelectItem>
                  <SelectItem value="wrong_time">Wrong Time</SelectItem>
                  <SelectItem value="forgot_device">Forgot Device</SelectItem>
                  <SelectItem value="system_error">System Error</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="actual-in">Actual Clock In</Label>
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input id="actual-in" type="time" placeholder="Actual clock in time" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual-out">Actual Clock Out</Label>
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input id="actual-out" type="time" placeholder="Actual clock out time" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Regularization</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a detailed explanation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof">Supporting Document (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="proof"
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFile(e.target.files[0])
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("proof")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {file ? file.name : "Upload Document"}
              </Button>
              {file && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Accepted file types: PDF, JPG, PNG (max 5MB)</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading || !date || !reason} className="w-full">
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
