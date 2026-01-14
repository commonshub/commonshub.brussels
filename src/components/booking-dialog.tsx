"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { rooms } from "@/components/booking-section"
import { Loader2 } from "lucide-react"

interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedRoom: string | null
}

export function BookingDialog({ open, onOpenChange, preselectedRoom }: BookingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    numberOfPeople: "",
    dateTime: "",
    duration: "",
    room: preselectedRoom || "",
    projector: false,
    whiteboard: false,
    facilitationKit: false,
    coffeeTea: false,
    snacks: false,
    isPrivate: false,
    additionalNotes: "",
  })

  useEffect(() => {
    if (preselectedRoom && !submitted) {
      setFormData((prev) => ({ ...prev, room: preselectedRoom }))
    }
  }, [preselectedRoom, submitted])

  // Filter rooms based on number of people
  const numberOfPeopleInt = formData.numberOfPeople ? Number.parseInt(formData.numberOfPeople) : 0
  const availableRooms = numberOfPeopleInt > 0 ? rooms.filter((r) => r.capacity >= numberOfPeopleInt) : rooms

  const handlePeopleChange = (value: string) => {
    const numPeople = Number.parseInt(value) || 0
    const currentRoom = rooms.find((r) => r.id === formData.room)
    const shouldClearRoom = currentRoom && numPeople > 0 && currentRoom.capacity < numPeople

    setFormData((prev) => ({
      ...prev,
      numberOfPeople: value,
      room: shouldClearRoom ? "" : prev.room,
    }))
  }

  const handleRoomChange = (value: string) => {
    setFormData((prev) => ({ ...prev, room: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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

  const handleClose = () => {
    onOpenChange(false)
    if (submitted) {
      setSubmitted(false)
      setFormData({
        name: "",
        email: "",
        organisation: "",
        numberOfPeople: "",
        dateTime: "",
        duration: "",
        room: "",
        projector: false,
        whiteboard: false,
        facilitationKit: false,
        coffeeTea: false,
        snacks: false,
        isPrivate: false,
        additionalNotes: "",
      })
    }
  }

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Request Sent</DialogTitle>
            <DialogDescription>
              Thank you for your booking request. We will get back to you shortly to confirm your reservation.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleClose} className="w-full mt-4">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book a Space</DialogTitle>
          <DialogDescription>
            Fill out the form below and we will get back to you to confirm your booking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfPeople">Number of People *</Label>
              <Input
                id="numberOfPeople"
                type="number"
                min="1"
                max="80"
                required
                value={formData.numberOfPeople}
                onChange={(e) => handlePeopleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room">Room *</Label>
              <Select value={formData.room || undefined} onValueChange={handleRoomChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} (up to {room.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateTime">When do you need the space? *</Label>
              <Input
                id="dateTime"
                type="datetime-local"
                required
                value={formData.dateTime}
                onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours) *</Label>
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
          </div>

          <div className="space-y-3">
            <Label>Options</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="projector"
                  checked={formData.projector}
                  onCheckedChange={(checked) => setFormData({ ...formData, projector: !!checked })}
                />
                <Label htmlFor="projector" className="text-sm font-normal">
                  Projector
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whiteboard"
                  checked={formData.whiteboard}
                  onCheckedChange={(checked) => setFormData({ ...formData, whiteboard: !!checked })}
                />
                <Label htmlFor="whiteboard" className="text-sm font-normal">
                  Whiteboard
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="facilitationKit"
                  checked={formData.facilitationKit}
                  onCheckedChange={(checked) => setFormData({ ...formData, facilitationKit: !!checked })}
                />
                <Label htmlFor="facilitationKit" className="text-sm font-normal">
                  Facilitation kit
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="coffeeTea"
                  checked={formData.coffeeTea}
                  onCheckedChange={(checked) => setFormData({ ...formData, coffeeTea: !!checked })}
                />
                <Label htmlFor="coffeeTea" className="text-sm font-normal">
                  Coffee/Tea
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="snacks"
                  checked={formData.snacks}
                  onCheckedChange={(checked) => setFormData({ ...formData, snacks: !!checked })}
                />
                <Label htmlFor="snacks" className="text-sm font-normal">
                  Snacks
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="isPrivate"
                checked={formData.isPrivate}
                onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: !!checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="isPrivate" className="text-sm font-medium">
                  Make this a private request
                </Label>
                <p className="text-xs text-muted-foreground">
                  Private requests are handled by paid staff and are more expensive. Public requests can more easily be
                  picked up by any member of the community.
                </p>
              </div>
            </div>
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Booking Request"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
