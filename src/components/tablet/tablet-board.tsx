"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

import { PosterLogo } from "@/components/poster/poster";
import { useNow } from "@/components/screen/screen-live";
import { brusselsMs } from "@/lib/events-board-format";
import {
  covered,
  DAY_FROM,
  DAY_TO,
  DEFAULT_SHIFT_HOURS,
  EARLIEST_START,
  LATEST_START,
  minutesOf,
  SHIFT_HOURS,
  joinSlot,
  shiftFor,
  START_STEP,
  uncovered,
  WEEKS_AHEAD,
  WEEKS_BACK,
  type TabletBooking,
  type TabletDay,
  type TabletPerson,
  type TabletShift,
} from "@/lib/tablet";

/**
 * The community tablet (/tablet), in portrait: a calendar of the coming two
 * weeks. The hub needs a steward whenever it is open; each day shows what
 * especially needs one (bookings paid in euros, events: orange while nobody
 * is on shift then) and who already signed up (green). A tap on a booking
 * offers the shift that covers it; a tap elsewhere, a shift from that time.
 * A sheet signs someone up. Anyone standing at the tablet can pick any name, so the bot
 * DMs that person with a link to cancel. The sheet closes itself after a
 * minute without a touch, so the next person finds the tablet as it should
 * be, and the page refreshes every two minutes while nobody is using it.
 */

/** Sizes in a unit that is 1% of a portrait tablet's width (and shrinks on a wider window). */
const u = (n: number) => `calc(var(--u) * ${n})`;
const TZ = "Europe/Brussels";
/** Three minutes without a touch: back to /tablet (this week, no sheet open), freshly loaded. */
const IDLE_MS = 180_000;

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
const dayKey = (ms: number) =>
  new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
function dayLabel(ms: number, now: number): string {
  if (dayKey(ms) === dayKey(now)) return "Today";
  if (dayKey(ms) === dayKey(now + 86_400_000)) return "Tomorrow";
  return new Date(ms).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: TZ,
  });
}
const dateLabel = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
const tokens = (n: number) => `${n} ${n === 1 ? "token" : "tokens"}`;
/** "09:30" for 570 minutes. */
const hm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
/** Noon of a calendar day, to name it. */
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);

interface Member {
  id: string;
  displayName: string;
  avatar: string | null;
}

/** Who is signing up: a Discord member from the list, or someone giving an email address (and a name). */
type Picked =
  | { kind: "discord"; member: Member }
  | { kind: "email"; email: string; name: string };

const isEmail = (s: string) =>
  /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(s.trim());
const pickedName = (p: Picked) =>
  p.kind === "discord"
    ? p.member.displayName
    : p.name.trim() || p.email.split("@")[0];

function Avatar({
  src,
  name,
  size,
}: {
  src?: string | null;
  name: string;
  size: number;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: u(size), height: u(size) }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: u(size), height: u(size), fontSize: u(size * 0.45) }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
      style={{ padding: `${u(1.6)} ${u(3)}`, fontSize: u(3) }}
    >
      {children}
    </button>
  );
}

/** What the sheet is opened for: a day, a proposed start and length, and maybe what it stewards. */
interface Slot {
  day: string;
  start: number;
  hours: number;
  /** The booking it stewards. */
  context?: string;
  /** The sheet's title, when it is not about a booking ("Join Leen"). */
  title?: string;
  /** Opened to change the time: the time picker comes first. */
  editTime?: boolean;
}

function SignupSheet({
  slot,
  rewardPerHour,
  onClose,
  onDone,
}: {
  slot: Slot;
  rewardPerHour: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState<Picked | null>(null);
  const [start, setStart] = useState(slot.start);
  const [hours, setHours] = useState(slot.hours);
  const [state, setState] = useState<{
    kind: "idle" | "sending" | "done" | "error";
    message?: string;
    emailed?: boolean;
    dmSent?: boolean;
  }>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  // Opened to change the time: no keyboard over the time picker.
  useEffect(() => {
    if (!slot.editTime) input.current?.focus();
  }, [slot.editTime]);

  // Autocomplete over the community's Discord members.
  useEffect(() => {
    const q = query.trim();
    if (!q || person || q.includes("@")) return setMembers([]);
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/tablet/members?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d: { members?: Member[] }) => setMembers(d.members ?? []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, person]);

  const startMs = brusselsMs(slot.day, hm(start));
  const endMs = startMs + hours * 3_600_000;

  async function confirm() {
    if (!person) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/tablet/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: slot.day,
          start,
          hours,
          ...(person.kind === "discord"
            ? { discordUserId: person.member.id }
            : { email: person.email, name: person.name }),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        emailed?: boolean;
        dmSent?: boolean;
      };
      if (!res.ok || !data.ok)
        throw new Error(data.error || "Could not record the shift");
      setState({ kind: "done", emailed: data.emailed, dmSent: data.dmSent });
      onDone();
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not record the shift",
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92%] flex-col overflow-y-auto rounded-t-[3vw] bg-background"
        style={{ padding: u(5), gap: u(3.5) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between" style={{ gap: u(3) }}>
          <div className="min-w-0">
            <div
              className="font-semibold text-primary"
              style={{ fontSize: u(2.6) }}
            >
              {dayLabel(noon(slot.day), Date.now())} {dateLabel(noon(slot.day))}
            </div>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: u(4.6) }}
            >
              {slot.title ?? (slot.context ? `Steward “${slot.context}”` : "Steward the hub")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-border"
            style={{ padding: `${u(1.2)} ${u(2.6)}`, fontSize: u(2.8) }}
          >
            Close
          </button>
        </div>

        {state.kind === "done" && person ? (
          <div
            className="flex flex-col items-center text-center"
            style={{ gap: u(2.5), padding: `${u(4)} 0` }}
          >
            <div style={{ fontSize: u(10) }}>🙌</div>
            <div className="font-bold" style={{ fontSize: u(5) }}>
              Thank you, {pickedName(person)}!
            </div>
            <p className="text-muted-foreground" style={{ fontSize: u(3) }}>
              You’re on shift {dayLabel(startMs, Date.now()).toLowerCase()} from{" "}
              {time(startMs)} to {time(endMs)}
              {person.kind === "discord"
                ? ` and will earn ${tokens(hours * rewardPerHour)}`
                : ""}
              .{" "}
              {state.dmSent || state.emailed
                ? `We sent you ${state.dmSent ? "a message on Discord" : "an email with the calendar invite"}. Not you? It has a link to cancel.`
                : "It’s in the shifts calendar."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-primary font-semibold text-primary-foreground"
              style={{
                padding: `${u(2)} ${u(6)}`,
                fontSize: u(3.2),
                marginTop: u(2),
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <section>
              <div
                className="font-semibold"
                style={{ fontSize: u(3.2), marginBottom: u(1.5) }}
              >
                1. Who are you?
              </div>
              {person ? (
                <div
                  className="flex flex-col rounded-[2vw] border border-primary bg-primary/5"
                  style={{ padding: u(2), gap: u(2) }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{ gap: u(2) }}
                  >
                    <span
                      className="flex min-w-0 items-center"
                      style={{ gap: u(2) }}
                    >
                      <Avatar
                        src={
                          person.kind === "discord"
                            ? person.member.avatar
                            : null
                        }
                        name={pickedName(person)}
                        size={7}
                      />
                      <span
                        className="truncate font-semibold"
                        style={{ fontSize: u(3.6) }}
                      >
                        {person.kind === "discord"
                          ? person.member.displayName
                          : person.email}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-primary underline"
                      style={{ fontSize: u(2.8) }}
                      onClick={() => (
                        setPerson(null),
                        setQuery(""),
                        setTimeout(() => input.current?.focus(), 0)
                      )}
                    >
                      {person.kind === "discord" ? "Not me" : "Change"}
                    </button>
                  </div>
                  {person.kind === "email" && (
                    <input
                      value={person.name}
                      onChange={(e) =>
                        setPerson({ ...person, name: e.target.value })
                      }
                      placeholder="Your name"
                      autoComplete="off"
                      className="w-full rounded-[1.5vw] border border-border bg-card outline-none focus:border-primary"
                      style={{
                        padding: `${u(1.8)} ${u(2.6)}`,
                        fontSize: u(3.2),
                      }}
                    />
                  )}
                </div>
              ) : (
                <>
                  <input
                    ref={input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Your name on Discord, or your email"
                    autoComplete="off"
                    className="w-full rounded-[2vw] border border-border bg-card outline-none focus:border-primary"
                    style={{ padding: `${u(2.2)} ${u(3)}`, fontSize: u(3.6) }}
                  />
                  <div
                    className="flex flex-wrap"
                    style={{ gap: u(1.5), marginTop: u(2), minHeight: u(9) }}
                  >
                    {isEmail(query) && (
                      <button
                        type="button"
                        onClick={() =>
                          setPerson({
                            kind: "email",
                            email: query.trim().toLowerCase(),
                            name: "",
                          })
                        }
                        className="flex items-center rounded-full border border-primary bg-primary/5"
                        style={{
                          padding: `${u(1.4)} ${u(2.6)}`,
                          gap: u(1.4),
                          fontSize: u(3),
                        }}
                      >
                        ✉️{" "}
                        <span className="font-semibold">
                          Sign up with {query.trim().toLowerCase()}
                        </span>
                      </button>
                    )}
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setPerson({ kind: "discord", member: m })
                        }
                        className="flex items-center rounded-full border border-border bg-card"
                        style={{
                          padding: `${u(1)} ${u(2.4)} ${u(1)} ${u(1)}`,
                          gap: u(1.4),
                          fontSize: u(3),
                        }}
                      >
                        <Avatar src={m.avatar} name={m.displayName} size={6} />
                        <span className="font-semibold">{m.displayName}</span>
                      </button>
                    ))}
                    {query.trim() &&
                      !query.includes("@") &&
                      !searching &&
                      members.length === 0 && (
                        <p
                          className="text-muted-foreground"
                          style={{ fontSize: u(2.8) }}
                        >
                          Nobody by that name on our Discord. Type your email
                          address instead and we’ll send you the calendar
                          invite.
                        </p>
                      )}
                  </div>
                </>
              )}
            </section>

            <section
              className={slot.editTime ? "rounded-[2vw] ring-2 ring-primary" : ""}
              style={slot.editTime ? { padding: u(2) } : undefined}
            >
              <div
                className="font-semibold"
                style={{ fontSize: u(3.2), marginBottom: u(1.5) }}
              >
                2. When can you come?
              </div>
              <div className="flex items-center" style={{ gap: u(2) }}>
                <Choice
                  active={false}
                  onClick={() => setStart((m) => Math.max(EARLIEST_START, m - START_STEP))}
                >
                  − 30 min
                </Choice>
                <span
                  className="font-bold tabular-nums"
                  style={{ fontSize: u(6), minWidth: u(18), textAlign: "center" }}
                >
                  {hm(start)}
                </span>
                <Choice
                  active={false}
                  onClick={() => setStart((m) => Math.min(LATEST_START, m + START_STEP))}
                >
                  + 30 min
                </Choice>
              </div>
              <div
                className="flex flex-wrap"
                style={{ gap: u(1.5), marginTop: u(2) }}
              >
                {SHIFT_HOURS.map((h) => (
                  <Choice
                    key={h}
                    active={hours === h}
                    onClick={() => setHours(h)}
                  >
                    {h}h
                  </Choice>
                ))}
              </div>
            </section>

            <div
              className="rounded-[2vw] bg-muted"
              style={{ padding: u(3), fontSize: u(3.2) }}
            >
              <span className="font-bold">
                {time(startMs)}–{time(endMs)}
              </span>{" "}
              · {hours}h
              {person?.kind === "email" ? (
                ""
              ) : (
                <>
                  {" "}
                  · earns{" "}
                  <span className="font-bold text-primary">
                    {tokens(hours * rewardPerHour)}
                  </span>
                </>
              )}
            </div>

            {state.kind === "error" && (
              <p className="text-destructive" style={{ fontSize: u(3) }}>
                {state.message}
              </p>
            )}
            <button
              type="button"
              disabled={
                !person ||
                state.kind === "sending" ||
                (person.kind === "email" && !person.name.trim())
              }
              onClick={confirm}
              className="rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
              style={{ padding: `${u(2.6)} ${u(4)}`, fontSize: u(3.8) }}
            >
              {state.kind === "sending"
                ? "Signing you up…"
                : person
                  ? `Sign up ${pickedName(person)}`
                  : "Sign up"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Where a time of day sits on a day's track, in %. */
const at = (minutes: number) => ((Math.min(DAY_TO, Math.max(DAY_FROM, minutes)) - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100;

/** The hours along the top: 8, 10, … 22. */
function Ruler() {
  const hours = [];
  for (let h = DAY_FROM / 60; h <= DAY_TO / 60; h += 2) hours.push(h);
  return (
    <div className="flex shrink-0" style={{ gap: u(2) }}>
      <div className="shrink-0" style={{ width: u(15) }} />
      <div className="relative flex-1" style={{ height: u(3) }}>
        {hours.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 text-muted-foreground tabular-nums"
            style={{ left: `${at(h * 60)}%`, fontSize: u(2.1) }}
          >
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A sheet from the bottom of the screen; a tap outside closes it. */
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[92%] flex-col overflow-y-auto rounded-t-[3vw] bg-background"
        style={{ padding: u(5), gap: u(3.5) }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ kicker, title, onClose }: { kicker: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between" style={{ gap: u(3) }}>
      <div className="min-w-0">
        <div className="font-semibold text-primary" style={{ fontSize: u(2.6) }}>
          {kicker}
        </div>
        <h2 className="font-bold leading-tight" style={{ fontSize: u(4.6) }}>
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-full border border-border"
        style={{ padding: `${u(1.2)} ${u(2.6)}`, fontSize: u(2.8) }}
      >
        Close
      </button>
    </div>
  );
}

/** "today", "tomorrow", "on Friday", "on Friday 23 Oct" (beyond a week). */
function onDay(ms: number): string {
  const label = dayLabel(ms, Date.now());
  if (label === "Today" || label === "Tomorrow") return label.toLowerCase();
  return Math.abs(ms - Date.now()) < 6 * 86_400_000 ? `on ${label}` : `on ${label} ${dateLabel(ms)}`;
}
const dayTitle = (day: string) => `${dayLabel(noon(day), Date.now())} ${dateLabel(noon(day))}`;
const joined = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: TZ }) : null;

/** Someone on shift, in big: who they are, and an invitation to join them. */
function PersonSheet({
  person,
  shift,
  day,
  available,
  onClose,
  onPick,
}: {
  person: TabletPerson;
  shift: TabletShift;
  day: string;
  available: boolean;
  onClose: () => void;
  onPick: (slot: Slot) => void;
}) {
  const { start, hours } = joinSlot(shift);
  const others = shift.people.filter((p) => p.id !== person.id);
  const since = joined(person.joinedAt);
  return (
    <Sheet onClose={onClose}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border"
          style={{ padding: `${u(1.2)} ${u(2.6)}`, fontSize: u(2.8) }}
        >
          Close
        </button>
      </div>
      <div className="flex flex-col items-center text-center" style={{ gap: u(2) }}>
        <Avatar src={person.avatar} name={person.name} size={30} />
        <div className="font-bold leading-tight" style={{ fontSize: u(6.5) }}>
          {person.name}
        </div>
        {(since || person.contributions) && (
          <div className="text-muted-foreground" style={{ fontSize: u(2.8) }}>
            {since ? `In the community since ${since}` : ""}
            {since && person.contributions ? " · " : ""}
            {person.contributions ? `${person.contributions} contributions shared` : ""}
          </div>
        )}
        <p style={{ fontSize: u(3.4), marginTop: u(1) }}>
          {shift.endMs < Date.now() ? "Was on shift" : "On shift"} {onDay(shift.startMs)}{" "}
          <span className="font-bold">
            {time(shift.startMs)}–{time(shift.endMs)}
          </span>
          {others.length > 0 && <> with {others.map((p) => p.name).join(", ")}</>}
        </p>
      </div>
      {available ? (
        <div className="flex flex-col" style={{ gap: u(1.5) }}>
          <button
            type="button"
            onClick={() => onPick({ day, start, hours, title: `Join ${person.name}` })}
            className="rounded-full bg-primary font-bold text-primary-foreground"
            style={{ padding: `${u(2.6)} ${u(4)}`, fontSize: u(3.8) }}
          >
            Join {person.name} · {hm(start)}–{hm(start + hours * 60)}
          </button>
          <button
            type="button"
            onClick={() => onPick({ day, start, hours, title: `Join ${person.name}`, editTime: true })}
            className="rounded-full border border-border font-semibold"
            style={{ padding: `${u(2.2)} ${u(4)}`, fontSize: u(3.2) }}
          >
            Come at another time
          </button>
        </div>
      ) : shift.endMs > Date.now() ? (
        <p className="text-center text-muted-foreground" style={{ fontSize: u(2.8) }}>
          Want to join? Use /shifts on our Discord.
        </p>
      ) : null}
    </Sheet>
  );
}

/** A booking or event: when, where, what it is, who is on shift then, and a shift to steward it. */
function EventSheet({
  booking,
  day,
  shifts,
  available,
  onClose,
  onPick,
  onPerson,
}: {
  booking: TabletBooking;
  day: string;
  shifts: TabletShift[];
  available: boolean;
  onClose: () => void;
  onPick: (slot: Slot) => void;
  onPerson: (person: TabletPerson, shift: TabletShift) => void;
}) {
  const during = shifts.filter((s) => s.startMs < booking.endMs && s.endMs > booking.startMs);
  const gap = uncovered(booking, shifts);
  const { start, hours } = shiftFor(gap ?? booking);
  return (
    <Sheet onClose={onClose}>
      <SheetHeader kicker={dayTitle(day)} title={booking.title} onClose={onClose} />
      <div style={{ fontSize: u(3.4) }}>
        <span className="font-bold">
          {time(booking.startMs)}–{time(booking.endMs)}
        </span>
        {booking.rooms.length > 0 && <span className="text-muted-foreground"> · {booking.rooms.join(", ")}</span>}
      </div>
      {booking.description && (
        <p className="whitespace-pre-line text-muted-foreground" style={{ fontSize: u(2.9), lineHeight: 1.45 }}>
          {booking.description}
        </p>
      )}
      <div>
        <div className="font-semibold" style={{ fontSize: u(3), marginBottom: u(1.5) }}>
          {!during.length
            ? "Nobody is on shift for it yet"
            : gap
              ? `On shift for part of it; nobody from ${time(gap.startMs)}`
              : "On shift"}
        </div>
        {during.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: u(1.5) }}>
            {during.flatMap((s, i) =>
              s.people.map((p) => <PersonChip key={`${i}-${p.id}`} person={p} shift={s} onClick={() => onPerson(p, s)} large />),
            )}
          </div>
        )}
      </div>
      {available ? (
        <button
          type="button"
          onClick={() => onPick({ day, start, hours, context: booking.title })}
          className={`rounded-full font-bold ${gap ? "bg-primary text-primary-foreground" : "border border-border"}`}
          style={{ padding: `${u(2.6)} ${u(4)}`, fontSize: u(3.6) }}
        >
          Steward it · {hm(start)}–{hm(start + hours * 60)}
        </button>
      ) : booking.endMs > Date.now() ? (
        <p className="text-muted-foreground" style={{ fontSize: u(2.8) }}>
          Want to steward it? Use /shifts on our Discord.
        </p>
      ) : null}
    </Sheet>
  );
}

/** Someone on shift: avatar, name, and their hours. */
function PersonChip({
  person,
  shift,
  onClick,
  large = false,
}: {
  person: TabletPerson;
  shift: TabletShift;
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => (e.stopPropagation(), onClick())}
      className="flex items-center rounded-full border border-emerald-600/50 bg-emerald-600/10"
      style={{ gap: u(1.2), padding: `${u(0.5)} ${u(1.8)} ${u(0.5)} ${u(0.5)}`, fontSize: u(large ? 2.8 : 2.2) }}
    >
      <Avatar src={person.avatar} name={person.name} size={large ? 5.5 : 4} />
      <span className="font-semibold">{person.name}</span>
      <span className="tabular-nums text-muted-foreground">
        {time(shift.startMs)}–{time(shift.endMs)}
      </span>
    </button>
  );
}

/**
 * One day: a track from 8:00 to 22:00 with its bookings (orange while nobody
 * is on shift then) and its shifts (green), and below it who is on shift and
 * the bookings spelled out, since a one-hour block is too narrow to read.
 */
function DayRow({
  day,
  now,
  available,
  onPick,
  onPerson,
  onBooking,
}: {
  day: TabletDay;
  now: number;
  available: boolean;
  onPick: (slot: Slot) => void;
  onPerson: (person: TabletPerson, shift: TabletShift) => void;
  onBooking: (booking: TabletBooking) => void;
}) {
  const ms = noon(day.day);
  const isToday = dayKey(now) === day.day;
  const nowMinutes = minutesOf(now);
  const pickAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!available) return;
    const box = e.currentTarget.getBoundingClientRect();
    const minutes = DAY_FROM + ((e.clientX - box.left) / box.width) * (DAY_TO - DAY_FROM);
    const start = Math.min(LATEST_START, Math.max(EARLIEST_START, Math.floor(minutes / START_STEP) * START_STEP));
    onPick({ day: day.day, start, hours: DEFAULT_SHIFT_HOURS });
  };
  const span = (startMs: number, endMs: number) => {
    const left = at(minutesOf(startMs));
    const right = dayKey(endMs) === day.day ? at(minutesOf(endMs)) : 100;
    return { left: `${left}%`, width: `${Math.max(1.5, right - left)}%` };
  };
  return (
    <li className="flex shrink-0 items-start" style={{ gap: u(2) }}>
      <div className="flex shrink-0 flex-col justify-center" style={{ width: u(15), minHeight: u(8) }}>
        <span className={`font-bold leading-tight ${isToday ? "text-primary" : ""}`} style={{ fontSize: u(2.9) }}>
          {isToday ? "Today" : new Date(ms).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
        </span>
        <span className="text-muted-foreground" style={{ fontSize: u(2.2) }}>
          {new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: u(1) }}>
        <div
          role="button"
          tabIndex={0}
          onClick={pickAt}
          className="relative overflow-hidden rounded-[1.5vw] bg-muted/60"
          style={{ height: u(8) }}
        >
          {[10, 12, 14, 16, 18, 20].map((h) => (
            <span key={h} className="absolute inset-y-0 border-l border-border/70" style={{ left: `${at(h * 60)}%` }} />
          ))}
          {isToday && nowMinutes > DAY_FROM && (
            <span className="absolute inset-y-0 left-0 bg-background/70" style={{ width: `${at(nowMinutes)}%` }} />
          )}
          {day.bookings.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-label={b.title}
              onClick={(e) => (e.stopPropagation(), onBooking(b))}
              className={`absolute rounded-[0.8vw] ${covered(b, day.shifts) ? "bg-foreground/25" : "bg-primary"}`}
              style={{ ...span(b.startMs, b.endMs), top: u(0.8), height: u(2.8) }}
            />
          ))}
          {day.shifts.map((sh, i) => (
            <button
              key={i}
              type="button"
              aria-label={sh.people.map((p) => p.name).join(", ")}
              onClick={(e) => (e.stopPropagation(), onPerson(sh.people[0], sh))}
              className="absolute flex items-center overflow-hidden rounded-[0.8vw] bg-emerald-600"
              style={{ ...span(sh.startMs, sh.endMs), bottom: u(0.8), height: u(3.4), padding: `0 ${u(0.4)}`, gap: u(0.4) }}
            >
              {sh.people.map((p) => (
                <Avatar key={p.id} src={p.avatar} name={p.name} size={2.6} />
              ))}
            </button>
          ))}
        </div>
        {(day.shifts.length > 0 || day.bookings.length > 0) && (
          <div className="flex flex-wrap" style={{ gap: u(1) }}>
            {day.shifts.flatMap((sh, i) =>
              sh.people.map((p) => <PersonChip key={`${i}-${p.id}`} person={p} shift={sh} onClick={() => onPerson(p, sh)} />),
            )}
            {day.bookings.map((b) => {
              const needs = !covered(b, day.shifts);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onBooking(b)}
                  className={`flex min-w-0 max-w-full items-baseline rounded-[2vw] border text-left ${needs ? "border-primary bg-primary/10" : "border-border bg-card text-muted-foreground"}`}
                  style={{ gap: u(1), padding: `${u(0.6)} ${u(1.8)}`, fontSize: u(2.2) }}
                >
                  <span className="shrink-0 font-semibold tabular-nums">
                    {time(b.startMs)}–{time(b.endMs)}
                  </span>
                  <span className="min-w-0">
                    {b.title}
                    {b.rooms.length > 0 && !(b.rooms.length === 1 && b.title.startsWith(b.rooms[0])) && (
                      <span className="text-muted-foreground"> · {b.rooms.join(", ")}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}

/** "This week", "Next week", "In 3 weeks", "Last week", "2 weeks ago". */
const weekName = (week: number) =>
  week === 0 ? "This week" : week === 1 ? "Next week" : week === -1 ? "Last week" : week > 0 ? `In ${week} weeks` : `${-week} weeks ago`;

/** Back and forth a week at a time. */
function WeekNav({ week, days }: { week: number; days: TabletDay[] }) {
  const router = useRouter();
  const first = noon(days[0].day);
  const last = noon(days[days.length - 1].day);
  const go = (w: number) => router.push(w ? `/tablet?week=${w}` : "/tablet");
  const button = (w: number, label: string, enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => go(w)}
      className="shrink-0 rounded-full border border-border bg-card font-semibold disabled:opacity-30"
      style={{ padding: `${u(1.4)} ${u(3)}`, fontSize: u(2.8) }}
    >
      {label}
    </button>
  );
  return (
    <div className="flex shrink-0 items-center justify-between" style={{ gap: u(2) }}>
      {button(week - 1, "‹ Previous", week > -WEEKS_BACK)}
      <div className="min-w-0 text-center">
        <div className="font-bold" style={{ fontSize: u(3.4) }}>
          {weekName(week)}
        </div>
        <div className="text-muted-foreground" style={{ fontSize: u(2.4) }}>
          {dateLabel(first)} – {dateLabel(last)}
        </div>
      </div>
      {button(week + 1, "Next ›", week < WEEKS_AHEAD)}
    </div>
  );
}

export function TabletBoard({
  days,
  week,
  shiftsAvailable,
  rewardAmountPerHour,
}: {
  days: TabletDay[];
  week: number;
  shiftsAvailable: boolean;
  rewardAmountPerHour: number;
}) {
  const router = useRouter();
  const now = useNow(0, 15_000);
  const [open, setOpen] = useState<Slot | null>(null);
  const [detail, setDetail] = useState<
    | { kind: "person"; person: TabletPerson; shift: TabletShift; day: TabletDay }
    | { kind: "event"; booking: TabletBooking; day: TabletDay }
    | null
  >(null);
  const lastTouch = useRef(Date.now());

  const close = useCallback(() => (setOpen(null), setDetail(null)), []);
  const pick = useCallback((slot: Slot) => (setDetail(null), setOpen(slot)), []);

  // Three minutes without a touch: reload /tablet, so the next person finds this week, no sheet open, and fresh sign-ups.
  useEffect(() => {
    const touch = () => (lastTouch.current = Date.now());
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current > IDLE_MS) window.location.assign("/tablet");
    }, 5_000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      clearInterval(id);
    };
  }, []);

  const today = dayKey(now);
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground"
      style={
        {
          ["--u" as string]: "min(1vw, calc(100vh / 160))",
          padding: `${u(5)} ${u(5)} 0`,
          gap: u(3),
        } as React.CSSProperties
      }
    >
      <style>{"html, body { overflow: hidden; }"}</style>
      <header
        className="flex shrink-0 items-center justify-between"
        style={{ gap: u(3) }}
      >
        <span className="flex items-center" style={{ gap: u(2) }}>
          <span
            className="block shrink-0"
            style={{ width: u(7), height: u(7) }}
          >
            <PosterLogo className="block h-full w-full" />
          </span>
          <span className="font-semibold" style={{ fontSize: u(3) }}>
            Commons Hub Brussels
          </span>
        </span>
        <span className="text-right">
          <span
            className="block font-bold tabular-nums leading-none"
            style={{ fontSize: u(7) }}
            suppressHydrationWarning
          >
            {time(now)}
          </span>
          <span
            className="text-muted-foreground"
            style={{ fontSize: u(2.4) }}
            suppressHydrationWarning
          >
            {new Date(now).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: TZ,
            })}
          </span>
        </span>
      </header>

      <div className="shrink-0">
        <h1
          className="font-bold leading-[1.02]"
          style={{ fontSize: u(10.5), letterSpacing: "-0.03em" }}
        >
          Sign up for a shift
          <br />
          <span className="text-primary">Earn tokens</span>
        </h1>
        <p
          className="text-muted-foreground"
          style={{ fontSize: u(3), marginTop: u(2), maxWidth: u(80) }}
        >
          The hub needs someone whenever it’s open: welcome people, show them
          around, make them feel at home. Tap a time to sign up, or tap
          someone to join them. Rooms booked for euros and events need a steward
          most: they show in orange while nobody is on shift for them. {tokens(rewardAmountPerHour)} an
          hour.
        </p>
        {!shiftsAvailable && (
          <p
            className="rounded-[2vw] bg-muted"
            style={{ fontSize: u(2.8), marginTop: u(2), padding: u(2) }}
          >
            Sign-ups on the tablet are not available right now. Use /shifts on
            our Discord.
          </p>
        )}
      </div>

      <WeekNav week={week} days={days} />
      <Ruler />
      <ul
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ gap: u(1.6), paddingBottom: u(5) }}
      >
        {days.map((d) => (
          <DayRow
            key={d.day}
            day={d}
            now={now}
            available={shiftsAvailable && d.day >= today}
            onPick={pick}
            onPerson={(person, shift) => setDetail({ kind: "person", person, shift, day: d })}
            onBooking={(booking) => setDetail({ kind: "event", booking, day: d })}
          />
        ))}
      </ul>

      {detail?.kind === "person" && (
        <PersonSheet
          person={detail.person}
          shift={detail.shift}
          day={detail.day.day}
          available={shiftsAvailable && detail.shift.endMs > now}
          onClose={close}
          onPick={pick}
        />
      )}
      {detail?.kind === "event" && (
        <EventSheet
          booking={detail.booking}
          day={detail.day.day}
          shifts={detail.day.shifts}
          available={shiftsAvailable && detail.booking.endMs > now}
          onClose={close}
          onPick={pick}
          onPerson={(person, shift) => setDetail({ kind: "person", person, shift, day: detail.day })}
        />
      )}
      {open && (
        <SignupSheet
          key={`${open.day}-${open.start}`}
          slot={open}
          rewardPerHour={rewardAmountPerHour}
          onClose={close}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}
