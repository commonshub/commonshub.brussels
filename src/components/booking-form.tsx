"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, Users, Coins } from "lucide-react";
import roomsData from "@/settings/rooms.json";

interface BookingFormProps {
  preselectedRoomId?: string;
  preselectedDate?: string;
}

// Filter to only bookable rooms (those with pricing)
const bookableRooms = roomsData.rooms.filter(
  (room) => room.pricePerHour > 0 || room.tokensPerHour > 0
);

export function BookingForm({ preselectedRoomId, preselectedDate }: BookingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(preselectedRoomId || "");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    numberOfPeople: "",
    dateTime: preselectedDate ? `${preselectedDate}T10:00` : "",
    duration: "",
    projector: false,
    whiteboard: false,
    facilitationKit: false,
    coffeeTea: false,
    snacks: false,
    isPrivate: false,
    additionalNotes: "",
  });

  // Update dateTime if preselectedDate changes
  useEffect(() => {
    if (preselectedDate && !formData.dateTime) {
      setFormData((prev) => ({
        ...prev,
        dateTime: `${preselectedDate}T10:00`,
      }));
    }
  }, [preselectedDate, formData.dateTime]);

  const selectedRoom = bookableRooms.find((r) => r.id === selectedRoomId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, room: selectedRoomId }),
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setFormData({
      name: "",
      email: "",
      organisation: "",
      numberOfPeople: "",
      dateTime: preselectedDate ? `${preselectedDate}T10:00` : "",
      duration: "",
      projector: false,
      whiteboard: false,
      facilitationKit: false,
      coffeeTea: false,
      snacks: false,
      isPrivate: false,
      additionalNotes: "",
    });
  };

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h3 className="text-xl font-semibold text-green-800">
              Booking Request Sent!
            </h3>
            <p className="text-green-700">
              Thank you for your booking request
              {selectedRoom && ` for the ${selectedRoom.name}`}. We will get
              back to you shortly to confirm your reservation.
            </p>
            <Button variant="outline" onClick={resetForm}>
              Make Another Booking
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book a Room</CardTitle>
        <CardDescription>
          Select a room and fill out the details below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Selection */}
          <div className="space-y-2">
            <Label htmlFor="room">Select Room *</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a room..." />
              </SelectTrigger>
              <SelectContent>
                {bookableRooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    <div className="flex items-center gap-2">
                      <span>{room.name}</span>
                      <span className="text-muted-foreground text-xs">
                        (up to {room.capacity})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Room details */}
            {selectedRoom && (
              <div className="mt-3 p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">
                  {selectedRoom.shortDescription}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Up to {selectedRoom.capacity} people
                  </span>
                  <span className="font-semibold">
                    €{selectedRoom.pricePerHour}/hour
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <Coins className="w-4 h-4" />
                    {selectedRoom.tokensPerHour} token
                    {selectedRoom.tokensPerHour > 1 ? "s" : ""}/hour for members
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisation">Organisation or Community</Label>
            <Input
              id="organisation"
              value={formData.organisation}
              onChange={(e) =>
                setFormData({ ...formData, organisation: e.target.value })
              }
            />
          </div>

          {/* Booking Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfPeople">Number of People *</Label>
              <Input
                id="numberOfPeople"
                type="number"
                min="1"
                max={selectedRoom?.capacity || 100}
                required
                value={formData.numberOfPeople}
                onChange={(e) =>
                  setFormData({ ...formData, numberOfPeople: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTime">Date & Time *</Label>
              <Input
                id="dateTime"
                type="datetime-local"
                required
                value={formData.dateTime}
                onChange={(e) =>
                  setFormData({ ...formData, dateTime: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, duration: e.target.value })
                }
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="projector"
                  checked={formData.projector}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, projector: !!checked })
                  }
                />
                <Label
                  htmlFor="projector"
                  className="text-sm font-normal cursor-pointer"
                >
                  Projector
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whiteboard"
                  checked={formData.whiteboard}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, whiteboard: !!checked })
                  }
                />
                <Label
                  htmlFor="whiteboard"
                  className="text-sm font-normal cursor-pointer"
                >
                  Whiteboard
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="facilitationKit"
                  checked={formData.facilitationKit}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, facilitationKit: !!checked })
                  }
                />
                <Label
                  htmlFor="facilitationKit"
                  className="text-sm font-normal cursor-pointer"
                >
                  Facilitation kit
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="coffeeTea"
                  checked={formData.coffeeTea}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, coffeeTea: !!checked })
                  }
                />
                <Label
                  htmlFor="coffeeTea"
                  className="text-sm font-normal cursor-pointer"
                >
                  Coffee/Tea
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="snacks"
                  checked={formData.snacks}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, snacks: !!checked })
                  }
                />
                <Label
                  htmlFor="snacks"
                  className="text-sm font-normal cursor-pointer"
                >
                  Snacks
                </Label>
              </div>
            </div>
          </div>

          {/* Private Request */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="isPrivate"
                checked={formData.isPrivate}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPrivate: !!checked })
                }
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="isPrivate"
                  className="text-sm font-medium cursor-pointer"
                >
                  Make this a private request
                </Label>
                <p className="text-xs text-muted-foreground">
                  Private requests are handled by paid staff and are more
                  expensive. Public requests can more easily be picked up by any
                  member of the community.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any special requirements or questions..."
              value={formData.additionalNotes}
              onChange={(e) =>
                setFormData({ ...formData, additionalNotes: e.target.value })
              }
            />
          </div>

          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isSubmitting || !selectedRoomId}
          >
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
      </CardContent>
    </Card>
  );
}
