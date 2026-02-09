"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import roomsData from "@/settings/rooms.json";

interface EmbeddedBookingFormProps {
  roomId: string;
  roomName: string;
  date: string;
  onComplete: () => void;
  onBack: () => void;
}

export function EmbeddedBookingForm({ 
  roomId, 
  roomName, 
  date, 
  onComplete,
  onBack 
}: EmbeddedBookingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    numberOfPeople: "",
    dateTime: `${date}T10:00`,
    duration: "",
    projector: false,
    whiteboard: false,
    facilitationKit: false,
    coffeeTea: false,
    snacks: false,
    isPrivate: false,
    additionalNotes: "",
  });

  const room = roomsData.rooms.find(r => r.id === roomId);
  const pricePerHour = room?.pricePerHour || 0;
  const tokensPerHour = room?.tokensPerHour || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, room: roomId }),
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

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h3 className="text-xl font-semibold text-green-800 dark:text-green-200">
              Booking Request Sent!
            </h3>
            <p className="text-green-700 dark:text-green-300">
              Thank you for your booking request for the {roomName}. 
              We will get back to you shortly to confirm your reservation.
            </p>
            <Button variant="outline" onClick={onComplete} className="cursor-pointer">
              Book another room
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="cursor-pointer -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
        <CardTitle className="text-lg">Book {roomName}</CardTitle>
        <CardDescription>
          Fill out the form below and we&apos;ll get back to you to confirm your booking.
          {pricePerHour > 0 && (
            <span className="block mt-1">
              <strong>€{pricePerHour}/hour</strong> or{" "}
              <strong>{tokensPerHour} token{tokensPerHour > 1 ? "s" : ""}/hour</strong> for members
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfPeople">People *</Label>
              <Input
                id="numberOfPeople"
                type="number"
                min="1"
                max={room?.capacity || 100}
                required
                value={formData.numberOfPeople}
                onChange={(e) => setFormData({ ...formData, numberOfPeople: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTime">Date & Time *</Label>
              <Input
                id="dateTime"
                type="datetime-local"
                required
                value={formData.dateTime}
                onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Hours *</Label>
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Options</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "projector", label: "Projector" },
                { id: "whiteboard", label: "Whiteboard" },
                { id: "facilitationKit", label: "Facilitation kit" },
                { id: "coffeeTea", label: "Coffee/Tea" },
                { id: "snacks", label: "Snacks" },
              ].map(({ id, label }) => (
                <div key={id} className="flex items-center space-x-2">
                  <Checkbox
                    id={id}
                    checked={formData[id as keyof typeof formData] as boolean}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, [id]: !!checked })
                    }
                  />
                  <Label htmlFor={id} className="text-xs font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="isPrivate"
                checked={formData.isPrivate}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPrivate: !!checked })
                }
              />
              <div className="grid gap-1 leading-none">
                <Label htmlFor="isPrivate" className="text-xs font-medium cursor-pointer">
                  Private request
                </Label>
                <p className="text-xs text-muted-foreground">
                  Handled by paid staff (more expensive)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalNotes" className="text-xs">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any special requirements..."
              value={formData.additionalNotes}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full cursor-pointer" disabled={isSubmitting}>
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
