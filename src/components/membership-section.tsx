"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { User, Building2, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function MembershipSection() {
  const [memberType, setMemberType] = useState<"individual" | "organisation" | "community">("individual")
  const [interests, setInterests] = useState<string[]>([])

  const toggleInterest = (interest: string) => {
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]))
  }

  const interestOptions = [
    "Joining a community",
    "Organising workshops",
    "Organising meetups",
    "Learning about the commons",
  ]

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">Apply to Become a Commoner</h1>
        </div>

        <form className="space-y-8">
          {/* Member type selector */}
          <div>
            <Label className="text-base mb-4 block">Applying as:</Label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setMemberType("individual")}
                className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors border ${
                  memberType === "individual"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="w-4 h-4" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => setMemberType("organisation")}
                className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors border ${
                  memberType === "organisation"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Organisation
              </button>
              <button
                type="button"
                onClick={() => setMemberType("community")}
                className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors border ${
                  memberType === "community"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-4 h-4" />
                Community
              </button>
            </div>
          </div>

          {/* Organisation/Community specific fields */}
          {memberType !== "individual" && (
            <div className="space-y-6 p-6 border border-border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="orgName">Name of your {memberType}</Label>
                <Input id="orgName" placeholder={`Enter ${memberType} name`} className="mt-2" />
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" placeholder="https://example.com" className="mt-2" />
              </div>

              <div>
                <Label htmlFor="memberCount">How many are part of your {memberType}?</Label>
                <Input id="memberCount" type="number" placeholder="e.g., 50" className="mt-2" />
              </div>
            </div>
          )}

          {/* About you */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">About you</h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" placeholder="John" className="mt-2" />
              </div>

              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" placeholder="Doe" className="mt-2" />
              </div>
            </div>

            <div>
              <Label htmlFor="zipcode">Zipcode</Label>
              <Input id="zipcode" placeholder="1000" className="mt-2" />
            </div>
          </div>

          {/* Interests */}
          <div>
            <Label className="text-base mb-4 block">I&apos;m interested in:</Label>
            <div className="space-y-3">
              {interestOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={option}
                    checked={interests.includes(option)}
                    onCheckedChange={() => toggleInterest(option)}
                  />
                  <label
                    htmlFor={option}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Needs */}
          <div>
            <Label htmlFor="needs">What are your needs?</Label>
            <Textarea id="needs" placeholder="Tell us about your needs..." className="mt-2 min-h-[100px]" />
          </div>

          {/* Offer */}
          <div>
            <Label htmlFor="offer">What can you offer to the community?</Label>
            <Textarea id="offer" placeholder="Tell us what you can contribute..." className="mt-2 min-h-[100px]" />
          </div>

          {/* Time commitment */}
          <div>
            <Label htmlFor="timeCommitment">How much time can you dedicate to contribute to the community?</Label>
            <Select>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select time commitment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-2h-week">1-2 hours per week</SelectItem>
                <SelectItem value="3-5h-week">3-5 hours per week</SelectItem>
                <SelectItem value="5-10h-week">5-10 hours per week</SelectItem>
                <SelectItem value="10h-week">10+ hours per week</SelectItem>
                <SelectItem value="1-2h-month">1-2 hours per month</SelectItem>
                <SelectItem value="3-5h-month">3-5 hours per month</SelectItem>
                <SelectItem value="5-10h-month">5-10 hours per month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Why join */}
          <div>
            <Label htmlFor="why">Tell us more about why you&apos;d like to join the Commons Hub:</Label>
            <Textarea id="why" placeholder="Share your motivation for joining..." className="mt-2 min-h-[150px]" />
          </div>

          {/* Submit */}
          <Button type="submit" size="lg" className="w-full">
            Apply
          </Button>
        </form>
      </div>
    </section>
  )
}
