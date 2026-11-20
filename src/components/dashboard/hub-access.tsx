import { DoorClosed, Lock, MessageCircle } from "lucide-react"

import { DoorOpener } from "@/components/dashboard/door-opener"
import settings from "@/settings/settings.json"

const ELINOR = `https://discord.com/channels/${settings.discord.guildId}/${settings.discord.channels.elinor}`

/**
 * Open the door and Ask Elinor, at the top of a dashboard. `locked`: why they can't (their
 * membership isn't paid): both greyed out, with that reason underneath. `readOnly`: an admin
 * viewing someone's page: shown as they'd see it, but the door doesn't open.
 */
export function HubAccess({ name, locked, readOnly }: { name: string; locked?: string | null; readOnly?: boolean }) {
  if (locked)
    return (
      <div className="mt-8">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2" aria-disabled="true">
          <div className="flex cursor-not-allowed items-center gap-4 rounded-2xl border-2 border-border p-5 text-muted-foreground opacity-60">
            <DoorClosed className="h-8 w-8 shrink-0" />
            <span className="block text-lg font-bold">Open the door</span>
          </div>
          <div className="flex cursor-not-allowed items-center gap-4 rounded-2xl border-2 border-border p-5 text-muted-foreground opacity-60">
            <MessageCircle className="h-8 w-8 shrink-0" />
            <span>
              <span className="block text-lg font-bold">Ask Elinor</span>
              <span className="block text-sm">Our community assistant, on Discord</span>
            </span>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {locked}
        </p>
      </div>
    )
  return (
    <fieldset disabled={readOnly} className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2">
      <DoorOpener name={name} refresh />
      <a href={ELINOR} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl border-2 border-primary p-5 text-foreground transition hover:bg-primary/5">
        <MessageCircle className="h-8 w-8 shrink-0 text-primary" />
        <span>
          <span className="block text-lg font-bold">Ask Elinor</span>
          <span className="block text-sm text-muted-foreground">Our community assistant, on Discord</span>
        </span>
      </a>
    </fieldset>
  )
}

/** Why the door and Elinor are off, from where they stand (lib/membership-standing.ts), or null when they're on. */
export function lockedReason(state: "member" | "accepted" | "pending" | "ended" | "none", who: "you" | "they" = "you"): string | null {
  const your = who === "you" ? "your" : "their"
  if (state === "member") return null
  if (state === "accepted") return `Opening the door and Elinor are for members: we couldn't find ${your} membership payment yet.`
  if (state === "ended") return `Opening the door and Elinor are for members: ${your} membership is no longer paid.`
  return "Opening the door and Elinor are for members."
}
