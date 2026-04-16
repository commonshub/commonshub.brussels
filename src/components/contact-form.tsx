"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send } from "lucide-react"

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    reason: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showMessageRequirements, setShowMessageRequirements] = useState(false)

  // Calculate message stats for validation
  const messageLength = formData.message.length
  const wordCount = formData.message.trim().split(/\s+/).filter(Boolean).length
  const isMessageValid = messageLength >= 100 && wordCount >= 20

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
    if (submitStatus !== "idle") {
      setSubmitStatus("idle")
      setErrorMessage(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side validation
    if (!isMessageValid) {
      setShowMessageRequirements(true)
      setSubmitStatus("error")
      setErrorMessage("Please provide more details in your message (at least 100 characters and 20 words).")
      return
    }
    
    setIsSubmitting(true)
    setSubmitStatus("idle")
    setErrorMessage(null)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitStatus("success")
        setFormData({
          name: "",
          email: "",
          organisation: "",
          reason: "",
          message: "",
        })
        setShowMessageRequirements(false)
      } else {
        const data = await response.json().catch(() => ({}))
        setSubmitStatus("error")
        setErrorMessage(data.error || "Something went wrong. Please try again.")
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      setSubmitStatus("error")
      setErrorMessage("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-background p-6 md:p-8 rounded-lg border border-border">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            required
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="your@email.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="organisation">Organisation or Community</Label>
        <Input
          id="organisation"
          value={formData.organisation}
          onChange={(e) => updateField("organisation", e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason for Contact <span className="text-destructive">*</span>
        </Label>
        <Select required value={formData.reason} onValueChange={(value) => updateField("reason", value)}>
          <SelectTrigger id="reason">
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="booking-room">Booking a room</SelectItem>
            <SelectItem value="joining-community">Joining the community</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="visit">Visit</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">
          Message <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="message"
          required
          value={formData.message}
          onChange={(e) => updateField("message", e.target.value)}
          placeholder="Tell us more about your inquiry..."
          rows={6}
        />
        {showMessageRequirements && (
          <div className="flex justify-between text-xs text-muted-foreground" aria-live="polite">
            <span className={messageLength < 100 ? "text-amber-600" : "text-green-600"}>
              {messageLength} / 100 characters {messageLength >= 100 && "✓"}
            </span>
            <span className={wordCount < 20 ? "text-amber-600" : "text-green-600"}>
              {wordCount} / 20 words {wordCount >= 20 && "✓"}
            </span>
          </div>
        )}
      </div>

      {submitStatus === "success" && (
        <div
          className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm"
          role="status"
          aria-live="polite"
        >
          Message sent successfully. We&apos;ll get back to you soon.
        </div>
      )}

      {submitStatus === "error" && (
        <div
          className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage || "Something went wrong. Please try again or email us directly at hello@commonshub.brussels"}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full cursor-pointer disabled:cursor-not-allowed"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          "Sending..."
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Send Message
          </>
        )}
      </Button>
    </form>
  )
}
