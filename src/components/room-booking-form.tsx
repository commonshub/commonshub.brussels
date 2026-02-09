"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, Calendar } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RoomMiniCalendar, RoomEventData } from "@/components/room-mini-calendar"

// Time options: 8am to 9pm
const TIME_OPTIONS = [
  { value: "08:00", label: "8:00 AM", hour: 8 },
  { value: "09:00", label: "9:00 AM", hour: 9 },
  { value: "10:00", label: "10:00 AM", hour: 10 },
  { value: "11:00", label: "11:00 AM", hour: 11 },
  { value: "12:00", label: "12:00 PM", hour: 12 },
  { value: "13:00", label: "1:00 PM", hour: 13 },
  { value: "14:00", label: "2:00 PM", hour: 14 },
  { value: "15:00", label: "3:00 PM", hour: 15 },
  { value: "16:00", label: "4:00 PM", hour: 16 },
  { value: "17:00", label: "5:00 PM", hour: 17 },
  { value: "18:00", label: "6:00 PM", hour: 18 },
  { value: "19:00", label: "7:00 PM", hour: 19 },
  { value: "20:00", label: "8:00 PM", hour: 20 },
  { value: "21:00", label: "9:00 PM", hour: 21 },
]

// Duration options: 1h to 8h
const DURATION_OPTIONS = [
  { value: "1", label: "1 hour", hours: 1 },
  { value: "2", label: "2 hours", hours: 2 },
  { value: "3", label: "3 hours", hours: 3 },
  { value: "4", label: "4 hours", hours: 4 },
  { value: "5", label: "5 hours", hours: 5 },
  { value: "6", label: "6 hours", hours: 6 },
  { value: "7", label: "7 hours", hours: 7 },
  { value: "8", label: "8 hours", hours: 8 },
]

// Default number of people by room
const DEFAULT_PEOPLE: Record<string, number> = {
  mushroom: 8,
  satoshi: 10,
  ostrom: 40,
  playroom: 4,
  coworking: 30,
  angel: 6,
  phonebooth: 1,
}

// Check if a time slot conflicts with any event
function isTimeBooked(hour: number, events: RoomEventData[], selectedDate: string): boolean {
  const slotStart = new Date(`${selectedDate}T${hour.toString().padStart(2, '0')}:00:00`);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1 hour slot
  
  return events.some(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    // Overlap if slot starts before event ends AND slot ends after event starts
    return slotStart < eventEnd && slotEnd > eventStart;
  });
}

// Get max available duration from a start time before hitting a booking
function getMaxDuration(startHour: number, events: RoomEventData[], selectedDate: string): number {
  const startTime = new Date(`${selectedDate}T${startHour.toString().padStart(2, '0')}:00:00`);
  const endOfDay = 22; // 10pm
  
  let maxHours = endOfDay - startHour;
  
  for (const event of events) {
    const eventStart = new Date(event.start);
    // Only consider events that start after our start time
    if (eventStart > startTime) {
      const hoursUntilEvent = (eventStart.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      maxHours = Math.min(maxHours, Math.floor(hoursUntilEvent));
    }
  }
  
  return Math.max(0, maxHours);
}

interface RoomBookingFormProps {
  roomId: string
  roomName: string
  pricePerHour: number
  tokensPerHour: number
}

export function RoomBookingForm({ roomId, roomName, pricePerHour, tokensPerHour }: RoomBookingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayEvents, setDayEvents] = useState<RoomEventData[]>([])
  
  const defaultPeople = DEFAULT_PEOPLE[roomId] || ""
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    numberOfPeople: defaultPeople.toString(),
    time: "09:00",
    duration: "2",
    projector: false,
    whiteboard: false,
    facilitationKit: false,
    coffeeTea: false,
    snacks: false,
    isPrivate: false,
    additionalNotes: "",
  })
  
  // Calculate available time slots and durations
  const availableTimeOptions = selectedDate 
    ? TIME_OPTIONS.map(opt => ({
        ...opt,
        disabled: isTimeBooked(opt.hour, dayEvents, selectedDate)
      }))
    : TIME_OPTIONS.map(opt => ({ ...opt, disabled: false }))
  
  const selectedHour = parseInt(formData.time.split(':')[0])
  const maxDuration = selectedDate ? getMaxDuration(selectedHour, dayEvents, selectedDate) : 8
  
  const availableDurationOptions = DURATION_OPTIONS.map(opt => ({
    ...opt,
    disabled: opt.hours > maxDuration
  }))

  // Format selected date for display
  const formattedDate = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString('en-BE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate) return
    
    setIsSubmitting(true)

    // Combine date and time into dateTime format
    const dateTime = `${selectedDate}T${formData.time}`

    try {
      const response = await fetch("/api/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData, 
          dateTime,
          room: roomId 
        }),
      })

      if (response.ok) {
        setSubmitted(true)
      }
    } catch (error) {
      console.error("Error submitting booking:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h3 className="text-xl font-semibold text-green-800">Booking Request Sent!</h3>
            <p className="text-green-700">
              Thank you for your booking request for the {roomName}. We will get back to you shortly to confirm your
              reservation.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setSelectedDate(null)
                setDayEvents([])
                setFormData({
                  name: "",
                  email: "",
                  organisation: "",
                  numberOfPeople: defaultPeople.toString(),
                  time: "09:00",
                  duration: "2",
                  projector: false,
                  whiteboard: false,
                  facilitationKit: false,
                  coffeeTea: false,
                  snacks: false,
                  isPrivate: false,
                  additionalNotes: "",
                })
              }}
            >
              Make Another Booking
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book the {roomName}</CardTitle>
        <CardDescription>
          Fill out the form below and we will get back to you to confirm your booking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Calendar for date selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select a Date *
            </Label>
            <RoomMiniCalendar 
              roomId={roomId} 
              onDateSelect={(date, events) => {
                setSelectedDate(date)
                setDayEvents(events)
                // Reset time to first available slot
                if (date && events.length > 0) {
                  const firstAvailable = TIME_OPTIONS.find(
                    opt => !isTimeBooked(opt.hour, events, date)
                  )
                  if (firstAvailable) {
                    setFormData(prev => ({ ...prev, time: firstAvailable.value }))
                  }
                }
              }}
            />
          </div>

          {/* Time and duration fields - only show when date is selected */}
          {selectedDate && (
            <>
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  📅 {formattedDate}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="time">Start Time *</Label>
                  <Select
                    value={formData.time}
                    onValueChange={(value) => {
                      setFormData({ ...formData, time: value })
                    }}
                  >
                    <SelectTrigger id="time">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTimeOptions.map((opt) => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={opt.disabled}
                          className={opt.disabled ? "text-muted-foreground line-through" : ""}
                        >
                          {opt.label}{opt.disabled ? " (booked)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="duration">Duration *</Label>
                  <Select
                    value={formData.duration}
                    onValueChange={(value) => setFormData({ ...formData, duration: value })}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDurationOptions.map((opt) => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={opt.disabled}
                          className={opt.disabled ? "text-muted-foreground line-through" : ""}
                        >
                          {opt.label}{opt.disabled ? " (conflict)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="numberOfPeople">People *</Label>
                  <Input
                    id="numberOfPeople"
                    type="number"
                    min="1"
                    required
                    value={formData.numberOfPeople}
                    onChange={(e) => setFormData({ ...formData, numberOfPeople: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Options</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="projector"
                      checked={formData.projector}
                      onCheckedChange={(checked) => setFormData({ ...formData, projector: !!checked })}
                    />
                    <Label htmlFor="projector" className="text-sm font-normal cursor-pointer">
                      Projector
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="whiteboard"
                      checked={formData.whiteboard}
                      onCheckedChange={(checked) => setFormData({ ...formData, whiteboard: !!checked })}
                    />
                    <Label htmlFor="whiteboard" className="text-sm font-normal cursor-pointer">
                      Whiteboard
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="facilitationKit"
                      checked={formData.facilitationKit}
                      onCheckedChange={(checked) => setFormData({ ...formData, facilitationKit: !!checked })}
                    />
                    <Label htmlFor="facilitationKit" className="text-sm font-normal cursor-pointer">
                      Facilitation
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="coffeeTea"
                      checked={formData.coffeeTea}
                      onCheckedChange={(checked) => setFormData({ ...formData, coffeeTea: !!checked })}
                    />
                    <Label htmlFor="coffeeTea" className="text-sm font-normal cursor-pointer">
                      Coffee/Tea
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="snacks"
                      checked={formData.snacks}
                      onCheckedChange={(checked) => setFormData({ ...formData, snacks: !!checked })}
                    />
                    <Label htmlFor="snacks" className="text-sm font-normal cursor-pointer">
                      Snacks
                    </Label>
                  </div>
                </div>
              </div>

              {/* Contact info at the end */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organisation">Organisation or Community</Label>
                <Input
                  id="organisation"
                  value={formData.organisation}
                  onChange={(e) => setFormData({ ...formData, organisation: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Additional Notes</Label>
                <Textarea
                  id="additionalNotes"
                  placeholder="Any special requirements or questions..."
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                />
              </div>

              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="isPrivate"
                    checked={formData.isPrivate}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: !!checked })}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="isPrivate" className="text-sm font-medium cursor-pointer">
                      Make this a private request
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Private requests are handled by paid staff and are more expensive. Public requests can more easily be
                      picked up by any member of the community.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full cursor-pointer" disabled={isSubmitting || !selectedDate}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Booking Request"
                )}
              </Button>
            </>
          )}
          
          {!selectedDate && (
            <p className="text-sm text-muted-foreground text-center py-2">
              👆 Select a date above to continue
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
