"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle } from "lucide-react"

interface MembershipApplicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedPlan: string | null
  memberType: "individual" | "organisation"
}

const individualPlans = [
  { value: "external-low", label: "External Member - €10/month (Low income)" },
  { value: "external-regular", label: "External Member - €20/month (Regular income)" },
  { value: "external-good", label: "External Member - €30/month (Good income)" },
  { value: "resident-low", label: "Resident - €50/month (Low income)" },
  { value: "resident-regular", label: "Resident - €100/month (Regular income)" },
  { value: "resident-good", label: "Resident - €150/month (Good income)" },
]

const organisationPlans = [
  { value: "external-org-small", label: "External Member Org - €200/year (<€100k turnover)" },
  { value: "external-org-medium", label: "External Member Org - €500/year (<€1M turnover)" },
  { value: "external-org-large", label: "External Member Org - €1000/year (>€1M turnover)" },
  { value: "resident-org-small", label: "Resident Org - €200/month (<€100k turnover)" },
  { value: "resident-org-medium", label: "Resident Org - €500/month (<€1M turnover)" },
  { value: "resident-org-large", label: "Resident Org - €1000/month (>€1M turnover)" },
]

export function MembershipApplicationDialog({
  open,
  onOpenChange,
  selectedPlan,
  memberType,
}: MembershipApplicationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plans = memberType === "individual" ? individualPlans : organisationPlans

  const getDefaultPlan = () => {
    if (!selectedPlan) return ""
    if (selectedPlan.includes("External Member") && !selectedPlan.includes("Organisation")) {
      return memberType === "individual" ? "external-regular" : "external-org-medium"
    }
    if (selectedPlan.includes("Resident")) {
      return memberType === "individual" ? "resident-regular" : "resident-org-medium"
    }
    return ""
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      organisation: formData.get("organisation") as string,
      email: formData.get("email") as string,
      plan: formData.get("plan") as string,
      motivation: formData.get("motivation") as string,
    }

    try {
      const response = await fetch("/api/membership-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to submit application")
      }

      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after dialog closes
    setTimeout(() => {
      setIsSuccess(false)
      setError(null)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {isSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <DialogTitle className="text-2xl mb-2">Application Submitted!</DialogTitle>
            <DialogDescription className="text-base">
              Thank you for your interest in joining Commons Hub Brussels. We will review your application and get back
              to you soon.
            </DialogDescription>
            <Button className="mt-6" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Apply to become a member</DialogTitle>
              <DialogDescription>Fill out the form below and we will get back to you shortly.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" placeholder="Your full name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organisation">Organisation or Community</Label>
                <Input id="organisation" name="organisation" placeholder="Your organisation (if applicable)" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" placeholder="your@email.com" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Membership Plan *</Label>
                <Select name="plan" defaultValue={getDefaultPlan()} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a membership plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivation">Motivation *</Label>
                <Textarea
                  id="motivation"
                  name="motivation"
                  placeholder="Tell us why you want to join Commons Hub Brussels and what you hope to contribute or gain from the community..."
                  rows={4}
                  required
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
