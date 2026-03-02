"use client";

import type React from "react";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Building2, Users } from "lucide-react";
import { Gamepad2, Laptop, Coins, Calendar, CheckCircle } from "lucide-react";
import { CommunityActivityGallery } from "./community-activity-gallery";

const membershipBenefits = [
  {
    icon: Laptop,
    content: "Access to the coworking",
  },
  {
    icon: Gamepad2,
    content: (
      <>
        Play{" "}
        <Link href="/workshops/commons-game" className="text-primary hover:underline">
          the Commons Games
        </Link>{" "}
        and learn{" "}
        <Link href="/workshops/commons-game#principles" className="text-primary hover:underline">
          Elinor Ostrom's 8 principles to govern the commons
        </Link>
      </>
    ),
  },
  {
    icon: Users,
    content: "Make use of the common space and the common resources of the community",
  },
  {
    icon: Coins,
    content: "Contribute and earn tokens",
  },
  {
    icon: Calendar,
    content: "Make proposals to organise events, workshops or other activities for the community",
  },
];

const individualTiers = [
  { amount: 10, period: "month" },
  { amount: 15, period: "month" },
  { amount: 20, period: "month" },
  { amount: 50, period: "month" },
  { amount: 100, period: "month" },
];

const orgTiers = [
  { amount: 100, period: "year" },
  { amount: 250, period: "year" },
  { amount: 500, period: "year" },
  { amount: 1000, period: "year" },
];

const timeCommitments = [
  { label: "0", value: "0" },
  { label: "1h/month", value: "1h/month" },
  { label: "3h/month", value: "3h/month" },
  { label: "1h/week", value: "1h/week" },
  { label: "3h/week", value: "3h/week" },
  { label: "1 day/week", value: "1day/week" },
];

const needsOptions = [
  { id: "space-work", label: "I need a space to work" },
  { id: "space-meetings", label: "I need a space for meetings" },
  {
    id: "community-contribute",
    label: "I need a community where I can contribute",
  },
  { id: "space-workshops", label: "I need a space to organise workshops" },
  { id: "space-events", label: "I need a space to organise events" },
  { id: "learn-commons", label: "I want to learn about the commons" },
  { id: "meet-commoners", label: "I want to meet other commoners" },
];

export function MembershipJoinSection() {
  const [memberType, setMemberType] = useState<
    "individual" | "organisation" | "community"
  >("individual");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [euroContribution, setEuroContribution] = useState<number | null>(null);
  const [timeContribution, setTimeContribution] = useState<string | null>(null);
  const [otherNotes, setOtherNotes] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleNeed = (needId: string) => {
    setSelectedNeeds((prev) =>
      prev.includes(needId)
        ? prev.filter((id) => id !== needId)
        : [...prev, needId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Build the plan string
    const planLabel = memberType === "individual"
      ? `Individual - €${euroContribution}/month`
      : memberType === "community"
        ? `Community - €${euroContribution}/year`
        : `Organisation - €${euroContribution}/year`;

    // Build motivation/notes including all collected information
    const needsLabels = selectedNeeds.map(id =>
      needsOptions.find(opt => opt.id === id)?.label
    ).filter(Boolean);

    const motivationParts = [];
    if (needsLabels.length > 0) {
      motivationParts.push(`**Needs:**\n${needsLabels.map(n => `- ${n}`).join("\n")}`);
    }
    if (timeContribution && timeContribution !== "0") {
      motivationParts.push(`**Time contribution:** ${timeContribution}`);
    }
    if (memberType !== "individual" && numberOfPeople) {
      motivationParts.push(`**Number of people:** ${numberOfPeople}`);
    }
    if (otherNotes) {
      motivationParts.push(`**Additional notes:**\n${otherNotes}`);
    }

    const motivation = motivationParts.join("\n\n") || "No additional information provided.";

    const data = {
      name,
      organisation: memberType !== "individual" ? (website || name) : "",
      email,
      plan: planLabel,
      motivation,
    };

    try {
      const response = await fetch("/api/membership-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to submit application");
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again or email us at hello@commonshub.brussels");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTiers = memberType === "individual" ? individualTiers : orgTiers;

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
            Become a Member
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Rediscover with us the commons, an alternative model of society
            where our common resources are managed by the people that depend on
            them.
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-8">
          <ul className="space-y-4">
            {membershipBenefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-3">
                <benefit.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{benefit.content}</span>
              </li>
            ))}
          </ul>
        </div>

        {isSuccess ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-20 h-20 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Application Submitted!</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Thank you for your application! We&apos;ll be in touch soon, and you&apos;ll receive an invitation to come visit the Hub.
            </p>
            <Button
              className="mt-8"
              onClick={() => {
                setIsSuccess(false);
                setName("");
                setEmail("");
                setWebsite("");
                setNumberOfPeople("");
                setSelectedNeeds([]);
                setEuroContribution(null);
                setTimeContribution(null);
                setOtherNotes("");
              }}
            >
              Submit another application
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          {/* Member type selector */}
          <div className="mb-10">
            <Label className="block text-center text-lg font-medium mb-4">
              Join as:
            </Label>
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg border border-border p-1 bg-muted/50">
                <button
                  type="button"
                  onClick={() => setMemberType("individual")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    memberType === "individual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setMemberType("community")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    memberType === "community"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Community
                </button>
                <button
                  type="button"
                  onClick={() => setMemberType("organisation")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    memberType === "organisation"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Organisation
                </button>
              </div>
            </div>
          </div>

          {/* Name and website */}
          <Card className="mb-8">
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="name">
                  {memberType === "individual"
                    ? "Your name"
                    : memberType === "community"
                      ? "Name of your community"
                      : "Name of your organisation"}
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    memberType === "individual"
                      ? "John Doe"
                      : memberType === "community"
                        ? "Awesome Community"
                        : "Company Inc."
                  }
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1.5"
                  required
                />
              </div>

              {memberType !== "individual" && (
                <>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="numberOfPeople">
                      Number of people in your{" "}
                      {memberType === "community" ? "community" : "organisation"}
                    </Label>
                    <Input
                      id="numberOfPeople"
                      type="number"
                      min="1"
                      value={numberOfPeople}
                      onChange={(e) => setNumberOfPeople(e.target.value)}
                      placeholder="10"
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Needs checkboxes */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <Label className="block text-base font-medium mb-4">
                How can the community help you?
              </Label>
              <div className="space-y-3">
                {needsOptions.map((option) => (
                  <div key={option.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={option.id}
                      checked={selectedNeeds.includes(option.id)}
                      onCheckedChange={() => toggleNeed(option.id)}
                    />
                    <label
                      htmlFor={option.id}
                      className="text-base text-foreground cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contributions */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <Label className="block text-base font-medium mb-6">
                What can you contribute to the community?
              </Label>

              {/* Euro contribution */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3">
                  Euros{" "}
                  {memberType === "individual" ? "(per month)" : "(per year)"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentTiers.map((tier) => (
                    <button
                      key={tier.amount}
                      type="button"
                      onClick={() => setEuroContribution(tier.amount)}
                      className={`px-4 py-2 cursor-pointer rounded-lg border text-sm font-medium transition-colors ${
                        euroContribution === tier.amount
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/50 hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      €{tier.amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time contribution */}
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Tokens (time)
                </p>
                <div className="flex flex-wrap gap-2">
                  {timeCommitments.map((time) => (
                    <button
                      key={time.value}
                      type="button"
                      onClick={() => setTimeContribution(time.value)}
                      className={`px-4 py-2 cursor-pointer rounded-lg border text-sm font-medium transition-colors ${
                        timeContribution === time.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/50 hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other notes */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <Label htmlFor="other-notes">
                Other things you&apos;d like to mention?
              </Label>
              <Textarea
                id="other-notes"
                value={otherNotes}
                onChange={(e) => setOtherNotes(e.target.value)}
                placeholder="Tell us anything else you'd like to share..."
                className="mt-1.5 min-h-[100px]"
              />
            </CardContent>
          </Card>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-center">
              <p>{error}</p>
              <p className="mt-2 text-sm">
                You can also email us directly at{" "}
                <a href="mailto:hello@commonshub.brussels" className="underline">
                  hello@commonshub.brussels
                </a>
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="text-center">
            <Button
              type="submit"
              size="lg"
              className="cursor-pointer"
              disabled={isSubmitting || !name || !email || !euroContribution}
            >
              {isSubmitting ? "Submitting..." : "Apply to become a member"}
            </Button>
          </div>
        </form>
        )}

        {/* Not sure yet */}
        <div className="mt-20">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-foreground">
              Not sure yet?
            </h3>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Come meet the community! Every Friday at 12:30pm it&apos;s
              community potluck at the Commons Hub. Bring some food to share and
              meet fellow commoners.
            </p>
          </div>
          <CommunityActivityGallery
            channelId="1443604342077919313"
            title=""
            maxImages={3}
          />
        </div>
      </div>
    </section>
  );
}
