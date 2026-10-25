import type { Metadata } from "next"
import Image from "@/components/optimized-image"
import Link from "next/link"
import { Presentation } from "lucide-react"

import { ElinorChat, MarketChat } from "@/components/token/elinor-chat"
import { TokenTerms } from "@/components/token-terms"
import { PASS_DISCLAIMER } from "@/lib/guest-pass"
import { EARN, GUEST_PASS_SCREENS, ROLES, ROOM_TOKENS, tokens } from "@/lib/token-story"
import settings from "@/settings/settings.json"

export const metadata: Metadata = {
  title: "The Commons Hub Token | Commons Hub Brussels",
  description: "Earn tokens by taking care of the community (the Heartbeat, park cleaning, roles, shifts, helping each other) and use them to cowork, invite a friend or book a room.",
}

/**
 * /token: the Commons Hub Token, for members and people curious about it.
 * The same story as slides at /token/slides (lib/token-story.ts).
 */
export default function TokenPage() {
  return (
    <div className="bg-background">
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">The Commons Hub Token</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight text-foreground text-balance sm:text-6xl">
          Take care of the community. <span className="text-primary">Get tokens.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Euros are scarce: they measure what we sell. Our token is abundant: it comes into existence whenever a member gives time, energy and care to the community. Members then use it for what the hub has to spare: an idle desk, a free room, a day at the hub for a friend.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/token/slides" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">
            <Presentation className="h-4 w-4" /> See it as slides
          </Link>
          <a href={settings.socials.discord} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full border-2 border-primary px-5 py-2 font-semibold text-primary hover:bg-primary/5">
            Join us on Discord
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="text-3xl font-extrabold text-foreground">How to earn tokens</h2>
        <div className="mt-8 space-y-14">
          {EARN.map((way, i) => (
            <article key={way.id} className={`grid items-center gap-6 md:grid-cols-2 md:gap-10 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <figure>
                {way.visual === "market" ? (
                  <MarketChat />
                ) : (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                    <Image src={way.photo!} alt={way.photoAlt ?? ""} fill sizes="(min-width: 768px) 480px, 100vw" className={way.id === "shifts" ? "object-cover object-left-top" : "object-cover"} />
                  </div>
                )}
                {way.more && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {way.more.map((m) => (
                      <div key={m.src} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                        <Image src={m.src} alt={m.alt} fill sizes="(min-width: 768px) 240px, 50vw" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {way.caption && <figcaption className="mt-2 text-sm text-muted-foreground">{way.caption}</figcaption>}
              </figure>
              <div>
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{way.amount}</span>
                <h3 className="mt-3 text-2xl font-bold text-foreground">{way.title}</h3>
                <p className="mt-2 text-muted-foreground">{way.text}</p>
                {way.id === "roles" && (
                  <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {ROLES.map((r) => (
                      <li key={r.name} className="flex justify-between gap-3 border-b border-border py-1">
                        <span className="text-foreground">{r.name}</span>
                        <span className="shrink-0 text-muted-foreground">{tokens(r.tokens)}/week</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-12 rounded-2xl bg-muted p-5 text-foreground">
          <strong>Did something else for the community?</strong> Share it in #contributions on Discord, or use <code className="rounded bg-background px-1">/claim</code>: we look at contributions together at the Heartbeat and reward them.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="text-3xl font-extrabold text-foreground">What you can do with them</h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-xl font-bold text-foreground">Cowork</h3>
            <p className="mt-1 text-muted-foreground">Use a desk that&apos;s free today: {tokens(1)} for half a day, {tokens(2)} for a day.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-xl font-bold text-foreground">Invite a friend</h3>
            <p className="mt-1 text-muted-foreground">A coworking pass that opens the door for them: {tokens(1)} for half a day (5h), {tokens(2)} for a full day.</p>
          </div>
        </div>

        <h3 className="mt-12 text-2xl font-bold text-foreground">A coworking pass for a friend, from your phone</h3>
        <p className="mt-2 text-muted-foreground">Log in on commonshub.brussels, choose Cowork → For a guest, pay with your tokens, and share the link (or we email it to them).</p>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {GUEST_PASS_SCREENS.map((s, i) => (
            <figure key={s.src}>
              <div className="relative aspect-[390/844] overflow-hidden rounded-[1.6rem] border-4 border-foreground bg-muted shadow-md">
                <Image src={s.src} alt={s.alt} fill sizes="(min-width: 1024px) 230px, 45vw" className="object-cover object-top" />
              </div>
              <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{i + 1}.</span> {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-14 grid items-start gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-2xl font-bold text-foreground">Book a room, just by asking Elinor</h3>
            <p className="mt-2 text-muted-foreground">
              Elinor, our community assistant, proposes the booking on Discord; you confirm and pay in tokens. You can also use <code className="rounded bg-muted px-1">/book</code>, or your dashboard on the website.
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {ROOM_TOKENS.map((r) => (
                <li key={r.name} className="flex justify-between gap-3 border-b border-border py-1">
                  <span className="text-foreground">
                    {r.name}
                    {r.note && <span className="text-muted-foreground"> ({r.note})</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{tokens(r.perHour)} an hour</span>
                </li>
              ))}
            </ul>
          </div>
          <figure>
            <ElinorChat />
            <figcaption className="mt-2 text-sm text-muted-foreground">An example of booking the Mush Room with Elinor.</figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <div className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
          <h2 className="text-2xl font-extrabold">Become a member</h2>
          <p className="mt-2 max-w-2xl opacity-90">Tokens are for members: the people who make the hub their home and steward it with us.</p>
          <Link href="/apply" className="mt-4 inline-flex rounded-full bg-background px-5 py-2 font-semibold text-foreground hover:opacity-90">
            Apply to join the community
          </Link>
        </div>
        <TokenTerms kinds={["coworking", "rooms"]} className="mt-8 space-y-1" />
        <p className="mt-2 text-xs text-muted-foreground">{PASS_DISCLAIMER}</p>
      </section>
    </div>
  )
}
