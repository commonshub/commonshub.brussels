"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Clock, Users, Euro, CheckCircle2 } from "lucide-react"
import Image from "@/components/optimized-image"

const ostromPrinciples = [
  {
    number: 1,
    title: "Clearly Defined Boundaries",
    description: "The boundaries of the resource and who has access must be clearly defined.",
  },
  {
    number: 2,
    title: "Proportional Equivalence",
    description: "Rules should ensure proportional distribution of benefits and costs.",
  },
  {
    number: 3,
    title: "Collective Choice Arrangements",
    description: "Those affected by the rules should have a say in modifying them.",
  },
  {
    number: 4,
    title: "Monitoring",
    description: "There must be effective monitoring of the resource and user behavior.",
  },
  {
    number: 5,
    title: "Graduated Sanctions",
    description: "Sanctions for rule violations should start mild and become stricter for repeat offenders.",
  },
  {
    number: 6,
    title: "Conflict Resolution",
    description: "There should be rapid, low-cost, local means for resolving conflicts.",
  },
  {
    number: 7,
    title: "Minimal Recognition of Rights",
    description: "The rights of community members to organize must be recognized by outside authorities.",
  },
  {
    number: 8,
    title: "Nested Enterprises",
    description: "For larger resources, governance should be organized in multiple nested layers.",
  },
]

export default function CommonsGamePage() {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    numberOfPeople: "",
    date: "",
    time: "",
    place: "commons-hub",
    otherPlace: "",
    comment: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/workshop-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          workshop: "The Commons Game",
          place: formData.place === "other" ? formData.otherPlace : "Commons Hub Brussels",
        }),
      })

      if (response.ok) {
        setSubmitted(true)
      }
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-sm font-medium text-primary uppercase tracking-wider mb-4">Workshop</div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">The Commons Game</h1>
              <p className="mt-6 text-xl text-muted-foreground">
                The Game of the Commons is a great interactive game to discover what it takes to manage together a
                common resource.
              </p>

              <div className="mt-8 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">2 hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">4-16 people</span>
                </div>
                <div className="flex items-center gap-2">
                  <Euro className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">25€/person or 350€/group</span>
                </div>
              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="mt-8 cursor-pointer">
                    Book this Workshop
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Book The Commons Game</DialogTitle>
                    <DialogDescription>
                      Fill in the details below and we'll get back to you to confirm your booking.
                    </DialogDescription>
                  </DialogHeader>

                  {submitted ? (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Booking Request Sent!</h3>
                      <p className="text-muted-foreground">
                        We'll review your request and get back to you soon to confirm the details.
                      </p>
                      <Button
                        className="mt-6 cursor-pointer"
                        onClick={() => {
                          setOpen(false)
                          setSubmitted(false)
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="your@email.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="organisation">Organisation or Community</Label>
                        <Input
                          id="organisation"
                          value={formData.organisation}
                          onChange={(e) => setFormData((prev) => ({ ...prev, organisation: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="numberOfPeople">Number of People *</Label>
                        <Input
                          id="numberOfPeople"
                          type="number"
                          min="4"
                          max="16"
                          required
                          value={formData.numberOfPeople}
                          onChange={(e) => setFormData((prev) => ({ ...prev, numberOfPeople: e.target.value }))}
                          placeholder="4-16 participants"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="date">Preferred Date *</Label>
                          <Input
                            id="date"
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time">Preferred Time *</Label>
                          <Input
                            id="time"
                            type="time"
                            required
                            value={formData.time}
                            onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="place">Location *</Label>
                        <Select
                          value={formData.place}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, place: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="commons-hub">Commons Hub Brussels</SelectItem>
                            <SelectItem value="other">Other (specify below)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.place === "other" && (
                        <div className="space-y-2">
                          <Label htmlFor="otherPlace">Specify Location *</Label>
                          <Input
                            id="otherPlace"
                            required
                            value={formData.otherPlace}
                            onChange={(e) => setFormData((prev) => ({ ...prev, otherPlace: e.target.value }))}
                            placeholder="Address or location name"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="comment">Comment</Label>
                        <Textarea
                          id="comment"
                          value={formData.comment}
                          onChange={(e) => setFormData((prev) => ({ ...prev, comment: e.target.value }))}
                          placeholder="Any additional information or questions..."
                          rows={3}
                        />
                      </div>

                      <Button type="submit" className="w-full cursor-pointer" disabled={submitting}>
                        {submitting ? "Sending..." : "Submit Booking Request"}
                      </Button>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <div className="relative">
              <Image
                src="/images/img-0428-204.jpeg"
                alt="The Commons Game workshop in action - participants sitting in a circle discussing"
                width={600}
                height={400}
                className="rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Game Photo Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Image
                src="/images/img-0435-202.jpeg"
                alt="The Commons Game - participants fishing wooden fish from a shared pool"
                width={600}
                height={400}
                className="rounded-xl shadow-lg"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4">How it Works</h2>
              <p className="text-muted-foreground mb-4">
                Participants engage in a hands-on simulation where they must collectively manage a shared
                resource—represented by wooden fish in a common pool. Each player must decide how much to take,
                balancing personal gain against the sustainability of the resource for everyone.
              </p>
              <p className="text-muted-foreground">
                Through multiple rounds and debriefing sessions, participants experience firsthand the challenges and
                solutions for governing shared resources, discovering the principles that Nobel laureate Elinor Ostrom
                identified for successful commons management.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ostrom's 8 Principles */}
      <section id="principles" className="py-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Elinor Ostrom's 8 Principles</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Nobel Prize-winning economist Elinor Ostrom identified these principles for successfully managing
              common-pool resources.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ostromPrinciples.map((principle) => (
              <Card key={principle.number} className="bg-card">
                <CardContent className="p-6">
                  <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold mb-4">
                    {principle.number}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{principle.title}</h3>
                  <p className="text-sm text-muted-foreground">{principle.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground">Learn More About the Commons</h2>
            <p className="mt-4 text-muted-foreground">
              Watch this introduction to understand the concept of the commons and why managing shared resources
              matters.
            </p>
          </div>

          <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/CxC161GvMPc"
              title="The Commons Game Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Play?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Book The Commons Game for your team, community, or organization and discover the art of collective resource
            management.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="cursor-pointer">
                Book this Workshop
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </section>
    </main>
  )
}
