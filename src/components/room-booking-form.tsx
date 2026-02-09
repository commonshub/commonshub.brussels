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
import { RoomMiniCalendar } from "@/components/room-mini-calendar"

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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    numberOfPeople: "",
    time: "",
    duration: "",
    projector: false,
    whiteboard: false,
    facilitationKit: false,
    coffeeTea: false,
    snacks: false,
    isPrivate: false,
    additionalNotes: "",
  })

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
                setFormData({
                  name: "",
                  email: "",
                  organisation: "",
                  numberOfPeople: "",
                  time: "",
                  duration: "",
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
              onDateSelect={setSelectedDate}
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
                <div className="space-y-2">
                  <Label htmlFor="time" className="block min-h-[2.5rem] flex items-start">Start Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration" className="block min-h-[2.5rem] flex items-start">Duration (hours) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfPeople" className="block min-h-[2.5rem] flex items-start">Number of People *</Label>
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
                      Facilitation kit
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
