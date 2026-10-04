"use client"

import { ScreenQr } from "./screen-qr"
import { Trophy } from "lucide-react"

import {
  slotStatuses,
  visibleWindow,
  type ScreenSlot,
  type ScreenTournament,
  type SlotStatus,
} from "@/lib/programme-screen"
import { ACCENT, MUTED, s } from "./screen"
import { useNow } from "./screen-live"

/** Time slots on screen at once; the window moves along with the day. */
const ROWS = 4

function SlotLabel({ slot, status }: { slot: ScreenSlot; status: SlotStatus }) {
  return (
    <div className="flex shrink-0 flex-col justify-center" style={{ width: s(11), gap: s(0.5) }}>
      <div className="tabular-nums" style={{ fontSize: s(3.2), fontWeight: 700, lineHeight: 1 }}>
        {slot.start}
      </div>
      {status === "now" && (
        <>
          <span className="self-start rounded-full" style={{ background: ACCENT, fontSize: s(1.3), fontWeight: 800, padding: `${s(0.25)} ${s(0.9)}`, letterSpacing: "0.08em" }}>
            NOW
          </span>
          <span style={{ fontSize: s(1.2), color: MUTED }}>until {slot.end}</span>
        </>
      )}
      {status === "next" && (
        <span className="self-start rounded-full" style={{ border: `${s(0.15)} solid ${ACCENT}`, color: ACCENT, fontSize: s(1.3), fontWeight: 800, padding: `${s(0.15)} ${s(0.8)}`, letterSpacing: "0.08em" }}>
          NEXT
        </span>
      )}
    </div>
  )
}

function SlotRow({ slot, status, columns }: { slot: ScreenSlot; status: SlotStatus; columns: number }) {
  return (
    <div className="flex min-h-0" style={{ gap: s(1.4), opacity: status === "past" ? 0.35 : 1 }}>
      <SlotLabel slot={slot} status={status} />
      <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: s(1) }}>
        {slot.sessions.map((session) => (
          <div
            key={`${session.room}-${session.title}`}
            className="flex min-w-0 flex-col justify-center overflow-hidden rounded-[0.6em]"
            style={{
              fontSize: s(1),
              padding: `${s(0.8)} ${s(1.3)}`,
              background: status === "now" ? ACCENT : "rgba(255, 255, 255, 0.07)",
              boxShadow: status === "next" ? `inset ${s(0.4)} 0 0 ${ACCENT}` : undefined,
            }}
          >
            <div className="truncate" style={{ fontSize: s(1.35), lineHeight: 1.25 }}>
              <span style={{ fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: status === "now" ? "#fff" : ACCENT }}>
                {session.roomName}
              </span>
              {session.speakers.length > 0 && (
                <span style={{ color: status === "now" ? "rgba(255,255,255,0.9)" : MUTED }}> · {session.speakers.join(", ")}</span>
              )}
            </div>
            <div className="line-clamp-2" style={{ fontSize: s(1.9), fontWeight: 700, lineHeight: 1.12, marginTop: s(0.3), textWrap: "balance" }}>
              {session.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TournamentLine({ tournament, now }: { tournament: ScreenTournament; now: number }) {
  const status = now < tournament.startMs ? `${tournament.start} – ${tournament.end}` : now < tournament.endMs ? `Playing now, until ${tournament.end}` : "Finished"
  return (
    <div className="flex min-w-0 items-center" style={{ gap: s(1), fontSize: s(1.7) }}>
      <Trophy className="shrink-0" style={{ width: s(2.4), height: s(2.4), color: "#FFB900" }} />
      <span className="truncate">
        <strong>{tournament.name}</strong> at the kicker table{" "}
        <span style={{ color: now >= tournament.startMs && now < tournament.endMs ? ACCENT : MUTED, fontWeight: 700 }}>· {status}</span>
      </span>
    </div>
  )
}

/**
 * The programme on the big screen: the current and upcoming time slots, what
 * is on now in orange, what starts next outlined, what is over dimmed. It
 * re-reads the clock every few seconds, so the highlight and the window move
 * on their own through the day.
 */
export function ProgrammeBoard({
  slots,
  tournament,
  offsetMs,
  qrSvg,
  url,
}: {
  slots: ScreenSlot[]
  tournament: ScreenTournament | null
  offsetMs: number
  qrSvg: string
  url: string
}) {
  const now = useNow(offsetMs)
  const statuses = slotStatuses(slots, now)
  const { from, to } = visibleWindow(slots, now, ROWS)
  const columns = Math.max(1, ...slots.map((slot) => slot.sessions.length))
  const later = slots.slice(to)
  const over = slots.length > 0 && statuses.every((status) => status === "past")

  return (
    <>
      <div className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`, gap: s(1) }}>
        {slots.slice(from, to).map((slot, i) => (
          <SlotRow key={slot.start} slot={slot} status={statuses[from + i]} columns={columns} />
        ))}
      </div>

      <footer className="flex shrink-0 items-center" style={{ gap: s(2.4), marginTop: s(1.4) }}>
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: s(0.6) }}>
          {over ? (
            <div style={{ fontSize: s(2.2), fontWeight: 700 }}>Thank you for coming!</div>
          ) : (
            later.length > 0 && (
              <div className="truncate" style={{ fontSize: s(1.7), color: MUTED }}>
                Later: {later.map((slot) => `${slot.start} ${slot.sessions.map((session) => session.title).join(" / ")}`).join(" · ")}
              </div>
            )
          )}
          {tournament && <TournamentLine tournament={tournament} now={now} />}
        </div>
        <ScreenQr qrSvg={qrSvg} cta="The full programme" url={url} />
      </footer>
    </>
  )
}
