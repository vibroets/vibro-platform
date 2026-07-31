"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { useUser } from "@/components/user-provider"
import { Progress } from "@/components/ui/progress"

interface ShiftInfo {
  id: string
  shift: "Morning" | "Evening" | "Custom"
  location: string
  startTime: string
  endTime: string
  hasGpsBoundary: boolean
  latitude?: number
  longitude?: number
  radius?: number
}

export function ClockInOut() {
  const { user } = useUser()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<Date | null>(null)
  const [userLocation, setUserLocation] = useState<GeolocationPosition | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Mock current shift data
  const currentShift: ShiftInfo = {
    id: "1",
    shift: "Morning",
    location: "Warehouse A",
    startTime: "08:00 AM",
    endTime: "05:00 PM",
    hasGpsBoundary: true,
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 100,
  }

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Get user's location
  useEffect(() => {
    if (currentShift.hasGpsBoundary) {
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            setUserLocation(position)
            setLocationError(null)

            // Calculate distance from required location
            if (currentShift.latitude && currentShift.longitude) {
              const dist = calculateDistance(
                position.coords.latitude,
                position.coords.longitude,
                currentShift.latitude,
                currentShift.longitude,
              )
              setDistance(dist)
            }
          },
          (error) => {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                setLocationError("Location permission denied. Please enable location services.")
                break
              case error.POSITION_UNAVAILABLE:
                setLocationError("Location information is unavailable.")
                break
              case error.TIMEOUT:
                setLocationError("Location request timed out.")
                break
              default:
                setLocationError("An unknown error occurred.")
                break
            }
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
        )

        return () => navigator.geolocation.clearWatch(watchId)
      } else {
        setLocationError("Geolocation is not supported by this browser.")
      }
    }
  }, [currentShift])

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c

    return Math.round(d)
  }

  // Check if user is within the required GPS boundary
  const isWithinBoundary = (): boolean => {
    if (!currentShift.hasGpsBoundary || !distance || !currentShift.radius) {
      return true
    }
    return distance <= currentShift.radius
  }

  const handleClockIn = () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setClockedIn(true)
      setClockInTime(new Date())
      setLoading(false)
    }, 1000)
  }

  const handleClockOut = () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setClockedIn(false)
      setClockInTime(null)
      setLoading(false)
      // In a real app, you would calculate hours worked and save to database
    }, 1000)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDuration = (startTime: Date, endTime: Date) => {
    const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60)
    const hours = Math.floor(diff / 60)
    const minutes = diff % 60
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Shift</CardTitle>
          <CardDescription>Your assigned shift details and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Shift Type</p>
                <Badge variant="outline" className="mt-1">
                  {currentShift.shift}
                </Badge>
              </div>
              <div>
                <p className="font-medium">Location</p>
                <p className="text-sm text-muted-foreground mt-1">{currentShift.location}</p>
              </div>
              <div>
                <p className="font-medium">Hours</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentShift.startTime} - {currentShift.endTime}
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  <p className="font-medium">Current Time</p>
                </div>
                <p>{formatTime(currentTime)}</p>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Badge variant={clockedIn ? "default" : "outline"} className="mr-2">
                    Status
                  </Badge>
                </div>
                <p className={clockedIn ? "text-green-600 font-medium" : "text-muted-foreground"}>
                  {clockedIn ? "Currently Clocked In" : "Off Shift"}
                </p>
              </div>

              {clockedIn && clockInTime && (
                <div className="flex items-center justify-between">
                  <p className="text-sm">Clocked in at {formatTime(clockInTime)}</p>
                  <p className="text-sm">Duration: {formatDuration(clockInTime, currentTime)}</p>
                </div>
              )}
            </div>

            {currentShift.hasGpsBoundary && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <MapPin className="h-4 w-4 mr-2" />
                  <p className="font-medium">Location Status</p>
                </div>

                {locationError ? (
                  <div className="flex items-center text-red-500 mt-2">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <p className="text-sm">{locationError}</p>
                  </div>
                ) : distance !== null ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm">Distance from location:</p>
                      <p className="text-sm font-medium">{distance} meters</p>
                    </div>
                    <Progress
                      value={currentShift.radius ? ((currentShift.radius - distance) / currentShift.radius) * 100 : 0}
                      className="h-2"
                    />
                    <div className="flex items-center mt-2">
                      {isWithinBoundary() ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          <p className="text-sm">You are within the required location</p>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-500">
                          <XCircle className="h-4 w-4 mr-2" />
                          <p className="text-sm">
                            You are outside the required location (
                            {currentShift.radius
                              ? Math.max(0, Math.ceil(currentShift.radius - distance))
                              : "unknown"}{" "}
                            meters to go)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Acquiring location...</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {!clockedIn ? (
            <Button
              onClick={handleClockIn}
              disabled={loading || (currentShift.hasGpsBoundary && !isWithinBoundary())}
              className="w-full"
            >
              {loading ? "Processing..." : "Clock In"}
            </Button>
          ) : (
            <Button onClick={handleClockOut} variant="destructive" disabled={loading} className="w-full">
              {loading ? "Processing..." : "Clock Out"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>Your recent attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="font-medium">Yesterday</p>
                <p className="text-sm text-muted-foreground">April 26, 2023</p>
              </div>
              <div className="text-right">
                <p className="text-sm">08:02 AM - 05:15 PM</p>
                <p className="text-sm text-muted-foreground">9h 13m</p>
              </div>
              <Badge variant="outline" className="ml-2">
                On Time
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="font-medium">Tuesday</p>
                <p className="text-sm text-muted-foreground">April 25, 2023</p>
              </div>
              <div className="text-right">
                <p className="text-sm">08:10 AM - 05:05 PM</p>
                <p className="text-sm text-muted-foreground">8h 55m</p>
              </div>
              <Badge variant="outline" className="ml-2">
                On Time
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="font-medium">Monday</p>
                <p className="text-sm text-muted-foreground">April 24, 2023</p>
              </div>
              <div className="text-right">
                <p className="text-sm">08:30 AM - 05:00 PM</p>
                <p className="text-sm text-muted-foreground">8h 30m</p>
              </div>
              <Badge variant="secondary" className="ml-2">
                Late
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
