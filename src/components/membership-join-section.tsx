"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { KnownMembersPicker, type KnownMember } from "@/components/membership/known-members-picker";
import { User, Building2, Users } from "lucide-react";
import { Laptop, Coins, CheckCircle, Megaphone, BadgePercent, KeyRound, MessageSquarePlus, Heart, Hash, Lightbulb, Users2 } from "lucide-react";
import { CommunityActivityGallery } from "./community-activity-gallery";
import { DEFAULT_MONTHLY, MONTHLY_PRICES, type MonthlyPrice } from "@/lib/membership-application";

// As on the poster (/membership/poster). The coworking is the Friday open
// coworking, a community activity: membership doesn't buy desk days (which
// would be a service, with VAT).
const individualBenefits = [
  {
    icon: Lightbulb,
    content: "Take part in decisions and help shape the Hub: make proposals, and earn tokens for the time you give",
  },
  {
    icon: Heart,
    content: "Help care for the space and our shared resources",
  },
  {
    icon: BadgePercent,
    content: "Get members prices when you book rooms or events",
  },
  {
    icon: Laptop,
    content: (
      <>
        Join the Friday open coworking for members, newcomers and prospective commoners, and our{" "}
        <Link href="/events" className="text-primary hover:underline">
          community activities
        </Link>
      </>
    ),
  },
  {
    icon: Hash,
    content: "Join the members' channels on Discord and the weekly Heartbeat meetings (Mondays, 13:00–14:00)",
  },
];

const steps = [
  { title: "Apply and meet us", text: "Tell us why you want to join. Come to a potluck or an activity." },
  { title: "Receive three vouches", text: "Three active community members get to know you and vouch for you." },
  { title: "Take part", text: "Join the community and help care for our shared space." },
];

const prices = {
  individual: "€10, €15 or €20 a month: you choose.",
  community: "€100 a year.",
  organisation: "€200 a year.",
};

const organisationBenefits = [
  {
    icon: Megaphone,
    content: "Logo on the website as partner organisation",
  },
  {
    icon: BadgePercent,
    content: "Members prices on bookings and events",
  },
  {
    icon: KeyRound,
    content: "Membership for two people (who can open the door)",
  },
  {
    icon: MessageSquarePlus,
    content: "Make proposals (e.g. when you need space for a series of workshops)",
  },
];

const communityBenefits = [
  {
    icon: Users2,
    content: "Make the hub the place where your community meets",
  },
  {
    icon: Coins,
    content: "Contribute to the space to earn tokens to book the space for your meetups*",
  },
  {
    icon: Lightbulb,
    content: "You can make proposals and join conversations, and cocreate the hub",
  },
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
  const [contribute, setContribute] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [known, setKnown] = useState<KnownMember[]>([]);
  const [otherNotes, setOtherNotes] = useState("");
  const [email, setEmail] = useState("");
  const [monthly, setMonthly] = useState<MonthlyPrice>(DEFAULT_MONTHLY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When the form appeared and the hidden trap field: the API ignores bots by them.
  const shownAt = useRef(0);
  const [homepage, setHomepage] = useState("");
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

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

    const data = {
      type: memberType,
      name,
      email,
      website: memberType !== "individual" ? website : "",
      people: memberType !== "individual" ? numberOfPeople : "",
      needs: selectedNeeds
        .map((id) => needsOptions.find((opt) => opt.id === id)?.label)
        .filter(Boolean),
      contribute,
      heardFrom,
      knows: known.filter((k) => k.id).map((k) => ({ id: k.id, name: k.name })),
      whoYouKnow: known.filter((k) => !k.id).map((k) => k.name).join(", "),
      notes: otherNotes,
      homepage,
      ...(memberType === "individual" ? { monthly } : {}),
      elapsedMs: shownAt.current ? Date.now() - shownAt.current : undefined,
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

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm italic text-muted-foreground">A space becomes a commons when we care for it together</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-foreground mb-6">
            Become a Member
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            For people, communities and organisations who want to make the Hub
            their home and steward it with us.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-12">
          <h2 className="text-center text-lg font-semibold text-foreground">Membership grows at the speed of trust</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-border p-4">
                <p className="text-2xl font-bold text-primary">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {isSuccess ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-20 h-20 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Application Submitted!</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Thank you! Your application is pending: members of the community
              will review it and we&apos;ll get back to you as soon as possible.
              We sent you an email with the details. In the meantime, you&apos;re
              always welcome at our{" "}
              <a href="/potluck" className="text-primary underline">
                Friday community potluck
              </a>
              .
            </p>
            <Button
              className="mt-8"
              onClick={() => {
                setIsSuccess(false);
                setName("");
                setEmail("");
                setMonthly(DEFAULT_MONTHLY);
                setWebsite("");
                setNumberOfPeople("");
                setSelectedNeeds([]);
                setContribute("");
                setHeardFrom("");
                setKnown([]);
                setOtherNotes("");
              }}
            >
              Submit another application
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          {/* A trap for bots: hidden from people and screen readers, never focused. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="homepage">Leave this empty</label>
            <input id="homepage" name="homepage" type="text" tabIndex={-1} autoComplete="off" value={homepage} onChange={(e) => setHomepage(e.target.value)} />
          </div>
          {/* Member type selector */}
          <div className="mb-10">
            <Label className="block text-center text-lg font-medium mb-4">
              Join as:
            </Label>
            <div className="flex justify-center">
              {/* Wraps instead of overflowing: three fixed-width buttons do
                  not fit a phone screen side by side. */}
              <div className="flex w-full max-w-md flex-wrap justify-center gap-1 rounded-lg border border-border p-1 bg-muted/50">
                <button
                  type="button"
                  onClick={() => setMemberType("individual")}
                  className={`flex flex-1 min-w-0 items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    memberType === "individual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="hidden w-4 h-4 shrink-0 sm:block" />
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setMemberType("community")}
                  className={`flex flex-1 min-w-0 items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    memberType === "community"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="hidden w-4 h-4 shrink-0 sm:block" />
                  Community
                </button>
                <button
                  type="button"
                  onClick={() => setMemberType("organisation")}
                  className={`flex flex-1 min-w-0 items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    memberType === "organisation"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="hidden w-4 h-4 shrink-0 sm:block" />
                  Organisation
                </button>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="mb-10">
            <ul className="space-y-4">
              {(memberType === "organisation" ? organisationBenefits : memberType === "community" ? communityBenefits : individualBenefits).map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <benefit.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{benefit.content}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-foreground">
              <span className="font-semibold">{prices[memberType]}</span>{" "}
              <span className="text-sm text-muted-foreground">Rooms and events are booked separately and invoiced with VAT.</span>
            </p>
            {memberType === "community" && (
              <p className="mt-2 text-xs text-muted-foreground">
                * When it&apos;s idle, subject to community activities, without cleaning or stewarding.
              </p>
            )}
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
                        : "Organisation ASBL"
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

              {memberType === "individual" && (
                <fieldset>
                  <legend className="text-sm font-medium leading-none">How much would you like to pay each month?</legend>
                  <div role="radiogroup" className="mt-2 grid grid-cols-3 gap-2">
                    {MONTHLY_PRICES.map((p) => (
                      <button
                        key={p.amount}
                        type="button"
                        role="radio"
                        aria-checked={monthly === p.amount}
                        onClick={() => setMonthly(p.amount)}
                        className={`rounded-lg border px-2 py-3 text-center transition-colors ${
                          monthly === p.amount ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <span className="block text-lg font-semibold text-foreground">€{p.amount}</span>
                        <span className="block text-xs">{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Same membership whatever you pay. You pay once your application is accepted.
                  </p>
                </fieldset>
              )}

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
              <Label htmlFor="contribute" className="text-base font-medium">
                What can you contribute to the community?{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="contribute"
                value={contribute}
                onChange={(e) => setContribute(e.target.value)}
                placeholder="Skills, time, ideas, things you'd like to organise…"
                className="mt-1.5 min-h-[100px]"
              />
            </CardContent>
          </Card>

          {/* How they know us */}
          <Card className="mb-8">
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="heard-from" className="text-base font-medium">
                  How did you hear about the Commons Hub?
                </Label>
                <Textarea
                  id="heard-from"
                  value={heardFrom}
                  onChange={(e) => setHeardFrom(e.target.value)}
                  placeholder="A friend, an event, a search, walking by…"
                  className="mt-1.5 min-h-[70px]"
                />
              </div>
              <div>
                <Label htmlFor="who-you-know" className="text-base font-medium">
                  Who do you know at the hub?
                </Label>
                <KnownMembersPicker value={known} onChange={setKnown} />
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
              disabled={isSubmitting || !name || !email}
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
              meet fellow commoners.{" "}
              <a href="/potluck" className="text-primary underline">
                More about the potluck
              </a>
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
