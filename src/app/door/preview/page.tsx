import type { Metadata } from "next"
import Link from "next/link"

import { auth } from "@/auth"
import { DoorOpener } from "@/components/dashboard/door-opener"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { isMember } from "@/lib/admin-check"
import { loadDoorVisitors, type DoorVisitor } from "@/lib/door-today"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Door preview | Commons Hub Brussels",
  robots: { index: false },
}

const HOUR = 3600_000
const SAMPLE: DoorVisitor[] = [
  { name: "Ana", arrivedAt: Date.now() - 3 * HOUR, avatar: null, guest: false, lastContribution: { text: "Watered all the plants and repotted the big fig", at: Date.now() - 2 * 86_400_000 } },
  { name: "Tom", arrivedAt: Date.now() - 2 * HOUR, avatar: null, guest: false, lastContribution: { text: "Fixed the wifi in the Ostrom Room", at: Date.now() - 6 * 86_400_000 } },
  { name: "Leo", arrivedAt: Date.now() - HOUR, avatar: null, guest: true },
]

/**
 * /door/preview: the dashboard's door, to try the animation without opening
 * the real door. Members only. Shows today's real visitors (from the door's
 * public log); ?sample shows made-up ones, ?first nobody, ?fail a door that
 * doesn't answer.
 */
export default async function DoorPreview({ searchParams }: { searchParams: Promise<{ first?: string; fail?: string; sample?: string }> }) {
  const session = await auth()
  if (!session?.user || !(await isMember())) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28">
        <h1 className="text-3xl font-bold text-foreground">Door preview</h1>
        <SignInPrompt>Members only: sign in with Discord.</SignInPrompt>
      </div>
    )
  }
  const q = await searchParams
  const { username, discordId, avatar } = session.user
  const name = username || "You"
  const me = { username: name, avatar: discordId && avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=96` : null }
  const you: DoorVisitor = { name, arrivedAt: Date.now(), avatar: me.avatar, guest: false }
  const real = q.sample !== undefined || q.first !== undefined ? [] : await loadDoorVisitors(me).catch(() => [])
  const visitors = q.first !== undefined ? [you] : q.sample !== undefined ? [...SAMPLE, you] : real.some((v) => v.name === name) ? real : [...real, you]
  const variants = [
    { label: "Today's visitors", href: "/door/preview" },
    { label: "Sample visitors", href: "/door/preview?sample" },
    { label: "First one today", href: "/door/preview?first" },
    { label: "Door doesn't answer", href: "/door/preview?fail" },
  ]
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-foreground">Door preview</h1>
      <p className="mt-1 text-muted-foreground">The dashboard&apos;s door, for trying the animation: this page never opens the real door.</p>
      <nav className="mt-4 flex flex-wrap gap-2">
        {variants.map((v) => (
          <Link key={v.href} href={v.href} className="rounded-full border border-border px-3 py-1 text-sm text-foreground hover:bg-muted">
            {v.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <DoorOpener key={JSON.stringify(q)} name={name} demo={{ visitors, fail: q.fail !== undefined }} />
      </div>
    </div>
  )
}
