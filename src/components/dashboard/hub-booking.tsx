"use client"

import { useEffect, useState } from "react"
import { CalendarPlus, Check, Copy, Loader2, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { brusselsIso, icsFor, nextHalfHour, todayInBrussels, nowTimeInBrussels, whenText } from "@/lib/hub-booking"

/**
 * The dashboard's Cowork and Book a room, for the member or a guest: the
 * same choices as the Discord commands (/buy, /guestpass, /book), paid in
 * tokens through the bot, without leaving the site. Then a confirmation:
 * for the member, a calendar file; for a guest, either "we emailed them
 * (you're cc'd)" or a link and QR code to share.
 */

type Mode = "cowork-me" | "cowork-guest" | "room-me" | "room-guest"

interface Options {
  balance: number
  tokenSymbol: string
  cowork: { item: { id: string; label: string; price: number; terms: string } | null }
  guestPass: Record<"half-day" | "day", { price: number; hours: number; eur: number }> & { maxDaysAhead: number }
  rooms: Array<{ slug: string; name: string; capacity?: number; tokenPricePerHour: number | null; bookableFromNote?: string }>
  terms: { cowork: string; room: string }
  disclaimer: string
}

type Done =
  | { kind: "me"; title: string; start: string; end: string; allDay?: boolean; price: number; balanceAfter: number; location: string }
  | { kind: "guest"; guest: string; emailed: boolean | null; passUrl?: string; when: string; price: number; balanceAfter: number }

const tokens = (n: number) => `${n} token${n === 1 ? "" : "s"}`

async function post(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/hub/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong, please try again." }))
  if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong, please try again.")
  return data
}

const TITLES: Record<Mode, string> = {
  "cowork-me": "Cowork today",
  "cowork-guest": "Invite a guest to cowork",
  "room-me": "Book a room",
  "room-guest": "Book a room for a guest",
}

export function HubBookingButton({ mode, children, className }: { mode: Mode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {open && <BookingFlow mode={mode} onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function BookingFlow({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  // One request id per attempt: a retry after a timeout never pays twice.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  // The form
  const [length, setLength] = useState<"half-day" | "day">("half-day")
  const [date, setDate] = useState(todayInBrussels())
  const [time, setTime] = useState(() => (mode.startsWith("room") ? nextHalfHour() : nowTimeInBrussels()))
  const [endTime, setEndTime] = useState(() => (mode.startsWith("room") ? nextHalfHour(60) : ""))
  const [room, setRoom] = useState("")
  const [title, setTitle] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [quote, setQuote] = useState<{ price: number } | null>(null)

  useEffect(() => {
    post("options")
      .then((o: Options) => {
        setOptions(o)
        setRoom((r) => r || o.rooms[0]?.slug || "")
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const isGuest = mode.endsWith("guest")
  const isRoom = mode.startsWith("room")
  const roomInfo = options?.rooms.find((r) => r.slug === room)
  const roomTimesChanged = () => {
    setQuote(null)
    setRequestId(crypto.randomUUID())
  }

  async function checkRoom() {
    setError(null)
    if (!endTime || endTime <= time) return setError("The end must be after the start.")
    if (!/:(00|30)$/.test(time) || !/:(00|30)$/.test(endTime)) return setError("Rooms are booked by half hours: start and end on :00 or :30.")
    if (isGuest && !guestName.trim()) return setError("What's your guest's name?")
    setBusy(true)
    try {
      const a = await post("availability", { room, start: brusselsIso(date, time), end: brusselsIso(date, endTime) })
      if (!a.available) throw new Error(a.reason || "The room isn't free then: try another time.")
      setQuote({ price: a.price })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function pay() {
    setError(null)
    if (isGuest && !guestName.trim()) return setError("What's your guest's name?")
    setBusy(true)
    try {
      if (mode === "cowork-me") {
        const r = await post("cowork", { requestId })
        const today = todayInBrussels()
        setDone({ kind: "me", title: "Coworking at the Commons Hub", start: today, end: today, allDay: true, price: r.price, balanceAfter: r.balanceAfter, location: "Rue de la Madeleine 51, 1000 Brussels" })
      } else if (mode === "cowork-guest") {
        const r = await post("guestpass", { requestId, length, start: brusselsIso(date, time), guestName, guestEmail })
        setDone({ kind: "guest", guest: r.guest, emailed: r.emailed, passUrl: r.passUrl, when: whenText(r.start, r.end), price: r.price, balanceAfter: r.balanceAfter })
      } else {
        const r = await post("book", { requestId, room, start: brusselsIso(date, time), end: brusselsIso(date, endTime), title: title || (isGuest ? `${guestName}'s meeting` : "Meeting"), ...(isGuest ? { guestName, guestEmail } : {}) })
        setDone(
          isGuest
            ? { kind: "guest", guest: r.guest?.name ?? guestName, emailed: r.guest?.emailed ?? null, passUrl: r.guest?.passUrl, when: `${r.room.name}, ${whenText(r.start, r.end)}`, price: r.price, balanceAfter: r.balanceAfter }
            : { kind: "me", title: `${r.title} (${r.room.name})`, start: r.start, end: r.end, price: r.price, balanceAfter: r.balanceAfter, location: `${r.room.name}, Commons Hub Brussels, Rue de la Madeleine 51, 1000 Brussels` },
        )
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Confirmation done={done} onClose={onClose} />

  const price = mode === "cowork-me" ? options?.cowork.item?.price : mode === "cowork-guest" ? options?.guestPass[length].price : quote?.price
  const enough = options && price !== undefined ? options.balance >= price : true
  const maxDate = options ? todayInBrussels(options.guestPass.maxDaysAhead) : undefined

  return (
    <>
      <DialogHeader>
        <DialogTitle>{TITLES[mode]}</DialogTitle>
        <DialogDescription>{options ? `You have ${tokens(options.balance)}.` : "Loading…"}</DialogDescription>
      </DialogHeader>

      {!options && !error && <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-muted-foreground" />}

      {options && (
        <div className="space-y-4">
          {mode === "cowork-me" &&
            (options.cowork.item ? (
              <p className="text-sm text-foreground">
                <span className="font-semibold">{options.cowork.item.label}</span>, for today: {tokens(options.cowork.item.price)}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Coworking with tokens isn&apos;t available right now.</p>
            ))}

          {mode === "cowork-guest" && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How long">
              {(["half-day", "day"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={length === l}
                  onClick={() => {
                    setLength(l)
                    setRequestId(crypto.randomUUID())
                  }}
                  className={`rounded-xl border-2 p-3 text-center text-sm transition ${length === l ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
                >
                  <span className="block font-semibold text-foreground">{l === "day" ? "Full day" : "Half day"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {options.guestPass[l].hours}h · {tokens(options.guestPass[l].price)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isRoom && (
            <div className="space-y-1.5">
              <Label htmlFor="room">Room</Label>
              <select
                id="room"
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value)
                  roomTimesChanged()
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {options.rooms.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                    {r.tokenPricePerHour !== null ? ` · ${tokens(r.tokenPricePerHour)}/h` : ""}
                  </option>
                ))}
              </select>
              {roomInfo?.bookableFromNote && <p className="text-xs text-muted-foreground">{roomInfo.bookableFromNote}</p>}
            </div>
          )}

          {mode !== "cowork-me" && (
            <div className="grid grid-cols-2 gap-3">
              <div className={`space-y-1.5 ${isRoom ? "col-span-2" : ""}`}>
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} min={todayInBrussels()} max={mode === "cowork-guest" ? maxDate : undefined} onChange={(e) => (setDate(e.target.value), roomTimesChanged())} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start">{isRoom ? "From" : "Starts at"}</Label>
                <Input id="start" type="time" step={isRoom ? 1800 : 60} value={time} onChange={(e) => (setTime(e.target.value), roomTimesChanged())} />
              </div>
              {isRoom && (
                <div className="space-y-1.5">
                  <Label htmlFor="end">To</Label>
                  <Input id="end" type="time" step={1800} value={endTime} onChange={(e) => (setEndTime(e.target.value), roomTimesChanged())} />
                </div>
              )}
            </div>
          )}

          {isRoom && (
            <div className="space-y-1.5">
              <Label htmlFor="title">What for</Label>
              <Input id="title" value={title} maxLength={100} placeholder={isGuest ? "e.g. Team meeting" : "e.g. Workshop"} onChange={(e) => setTitle(e.target.value)} />
            </div>
          )}

          {isGuest && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="guest-name">Guest&apos;s name</Label>
                <Input id="guest-name" value={guestName} maxLength={80} autoComplete="off" onChange={(e) => setGuestName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-email">Guest&apos;s email (optional)</Label>
                <Input id="guest-email" type="email" value={guestEmail} maxLength={200} autoComplete="off" onChange={(e) => setGuestEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">With an email, we send them the instructions to enter and cc you. Without, you get a link to share.</p>
              </div>
            </>
          )}

          {price !== undefined && (
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-semibold text-foreground">Cost: {tokens(price)}</p>
              {!enough && <p className="mt-1 text-destructive">You don&apos;t have enough tokens for this. You can /claim tokens for a contribution on Discord.</p>}
              <p className="mt-1 text-xs text-muted-foreground">{isRoom ? options.terms.room : mode === "cowork-me" ? options.cowork.item?.terms : options.terms.cowork}</p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {isRoom && !quote ? (
              <Button onClick={checkRoom} disabled={busy || !room}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check availability
              </Button>
            ) : (
              <Button onClick={pay} disabled={busy || !enough || price === undefined}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm and pay {price !== undefined ? tokens(price) : ""}
              </Button>
            )}
          </div>
        </div>
      )}
      {!options && error && <p className="text-sm text-destructive">{error}</p>}
    </>
  )
}

function Confirmation({ done, onClose }: { done: Done; onClose: () => void }) {
  if (done.kind === "me") {
    const ics = icsFor(done)
    return (
      <>
        <DialogHeader>
          <DialogTitle>You&apos;re all set 🎉</DialogTitle>
          <DialogDescription>
            {done.title}, {done.allDay ? "today" : whenText(done.start, done.end)}. Paid {tokens(done.price)}; you have {tokens(done.balanceAfter)} left.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" asChild>
            <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download="commons-hub.ics">
              <CalendarPlus className="mr-2 h-4 w-4" /> Add to my calendar
            </a>
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </>
    )
  }
  return <GuestConfirmation done={done} onClose={onClose} />
}

function GuestConfirmation({ done, onClose }: { done: Extract<Done, { kind: "guest" }>; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const share = !done.emailed && done.passUrl

  useEffect(() => {
    if (!share) return
    import("qrcode").then((QR) => QR.toString(done.passUrl!, { type: "svg", errorCorrectionLevel: "M", margin: 0 })).then(setQr).catch(() => setQr(null))
  }, [share, done.passUrl])

  return (
    <>
      <DialogHeader>
        <DialogTitle>Your guest {done.guest} is welcome at the hub</DialogTitle>
        <DialogDescription>
          {done.when}. Paid {tokens(done.price)}; you have {tokens(done.balanceAfter)} left.
        </DialogDescription>
      </DialogHeader>
      {done.emailed ? (
        <p className="text-sm text-foreground">We&apos;ve sent them the instructions to enter (you are cc&apos;d).</p>
      ) : share ? (
        <div className="space-y-4">
          {done.emailed === false && <p className="text-sm text-destructive">We couldn&apos;t send the email to your guest, so please share the link with them.</p>}
          <p className="text-sm text-foreground">Share this link with them, with the instructions to enter, or ask them to scan this QR code.</p>
          {qr && <div className="mx-auto w-48 rounded-xl bg-white p-3" role="img" aria-label="QR code of the guest's link" dangerouslySetInnerHTML={{ __html: qr }} />}
          <div className="flex gap-2">
            <Input readOnly value={done.passUrl} onFocus={(e) => e.target.select()} className="font-mono text-xs" aria-label="Link for your guest" />
            <Button
              variant="outline"
              size="icon"
              aria-label={copied ? "Copied" : "Copy the link"}
              onClick={() => navigator.clipboard.writeText(done.passUrl!).then(() => setCopied(true))}
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button variant="outline" size="icon" aria-label="Share" onClick={() => navigator.share({ title: "Your pass to the Commons Hub", url: done.passUrl }).catch(() => {})}>
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">The link opens the door during their visit only. It&apos;s personal: share it with your guest alone.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The door link was sent to you on Discord.</p>
      )}
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </>
  )
}
