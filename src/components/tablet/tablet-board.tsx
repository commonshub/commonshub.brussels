"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

import { PosterLogo } from "@/components/poster/poster";
import { useNow } from "@/components/screen/screen-live";
import {
  DEFAULT_SHIFT_HOURS,
  SHIFT_HOURS,
  SHIFT_LEAD_MINUTES,
  SHIFT_STARTS,
  type TabletEventWithShifts,
} from "@/lib/tablet";

/**
 * The community tablet (/tablet), in portrait: the next events, each with
 * the shift that stewards it and who is already on it, and a sheet to sign
 * someone up. Anyone standing at the tablet can pick any name, so the bot
 * DMs that person with a link to cancel. The sheet closes itself after a
 * minute without a touch, so the next person finds the tablet as it should
 * be, and the page refreshes every two minutes while nobody is using it.
 */

/** Sizes in a unit that is 1% of a portrait tablet's width (and shrinks on a wider window). */
const u = (n: number) => `calc(var(--u) * ${n})`;
const TZ = "Europe/Brussels";
const IDLE_MS = 60_000;

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
const startLabel = (minutes: number) =>
  minutes === 0
    ? "When it starts"
    : minutes < 0
      ? `${Math.abs(minutes) >= 60 ? `${Math.abs(minutes) / 60}h` : `${Math.abs(minutes)} min`} before`
      : `${minutes >= 60 ? `${minutes / 60}h` : `${minutes} min`} after`;

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

function SignupSheet({
  event,
  rewardPerHour,
  onClose,
  onDone,
}: {
  event: TabletEventWithShifts;
  rewardPerHour: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState<Picked | null>(null);
  const [startOffset, setStartOffset] = useState(-SHIFT_LEAD_MINUTES);
  const [hours, setHours] = useState(DEFAULT_SHIFT_HOURS);
  const [state, setState] = useState<{
    kind: "idle" | "sending" | "done" | "error";
    message?: string;
    emailed?: boolean;
    dmSent?: boolean;
  }>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

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

  const startMs = event.startMs + startOffset * 60_000;
  const endMs = startMs + hours * 3_600_000;

  async function confirm() {
    if (!person) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/tablet/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ...(person.kind === "discord"
            ? { discordUserId: person.member.id }
            : { email: person.email, name: person.name }),
          startOffset,
          hours,
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
              {dayLabel(event.startMs, Date.now())} {dateLabel(event.startMs)} ·{" "}
              {time(event.startMs)}
            </div>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: u(4.6) }}
            >
              Steward “{event.name}”
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

            <section>
              <div
                className="font-semibold"
                style={{ fontSize: u(3.2), marginBottom: u(1.5) }}
              >
                2. When can you come?
              </div>
              <div className="flex flex-wrap" style={{ gap: u(1.5) }}>
                {SHIFT_STARTS.map((m) => (
                  <Choice
                    key={m}
                    active={startOffset === m}
                    onClick={() => setStartOffset(m)}
                  >
                    {startLabel(m)}
                  </Choice>
                ))}
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

function EventCard({
  event,
  now,
  rewardPerHour,
  available,
  onJoin,
}: {
  event: TabletEventWithShifts;
  now: number;
  rewardPerHour: number;
  available: boolean;
  onJoin: () => void;
}) {
  const live = event.startMs <= now;
  return (
    <li
      className="flex shrink-0 overflow-hidden rounded-[2.5vw] border border-border bg-card"
      style={{ gap: u(3), padding: u(3) }}
    >
      <div
        className="flex shrink-0 flex-col items-center justify-center rounded-[1.8vw] bg-primary/10 text-center"
        style={{ width: u(15), padding: u(1.5) }}
      >
        <span
          className="font-semibold uppercase text-primary"
          style={{ fontSize: u(2.1), letterSpacing: "0.04em" }}
        >
          {live ? "Now" : dayLabel(event.startMs, now)}
        </span>
        <span className="font-bold leading-none" style={{ fontSize: u(6.5) }}>
          {new Date(event.startMs).toLocaleDateString("en-GB", {
            day: "numeric",
            timeZone: TZ,
          })}
        </span>
        <span className="text-muted-foreground" style={{ fontSize: u(2.3) }}>
          {new Date(event.startMs).toLocaleDateString("en-GB", {
            month: "short",
            timeZone: TZ,
          })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: u(1.2) }}>
        <div className="text-muted-foreground" style={{ fontSize: u(2.6) }}>
          {time(event.startMs)}–{time(event.endMs)}
        </div>
        <div
          className="line-clamp-2 font-bold leading-tight"
          style={{ fontSize: u(3.6) }}
        >
          {event.name}
        </div>
        <div
          className="flex flex-wrap items-center"
          style={{ gap: u(1.2), marginTop: u(0.6) }}
        >
          {event.signups.length > 0 ? (
            event.signups.map((s) => (
              <span
                key={s.discordUserId}
                className="flex items-center rounded-full bg-muted"
                style={{
                  padding: `${u(0.6)} ${u(1.8)} ${u(0.6)} ${u(0.6)}`,
                  gap: u(1),
                  fontSize: u(2.5),
                }}
              >
                <Avatar src={s.avatar} name={s.displayName} size={4.6} />
                <span className="font-semibold">{s.displayName}</span>
                <span className="text-muted-foreground">
                  {time(s.startMs)}–{time(s.endMs)}
                </span>
              </span>
            ))
          ) : (
            <span
              className="text-muted-foreground"
              style={{ fontSize: u(2.6) }}
            >
              Nobody on shift yet. Be the first!
            </span>
          )}
        </div>
      </div>
      <div
        className="flex shrink-0 flex-col items-center justify-center"
        style={{ gap: u(1) }}
      >
        <button
          type="button"
          disabled={!available}
          onClick={onJoin}
          className="rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
          style={{ padding: `${u(2)} ${u(3.4)}`, fontSize: u(3.1) }}
        >
          {event.signups.length > 0 ? "Join" : "Sign up"}
        </button>
        <span className="text-muted-foreground" style={{ fontSize: u(2.2) }}>
          {tokens(DEFAULT_SHIFT_HOURS * rewardPerHour)} / {DEFAULT_SHIFT_HOURS}h
        </span>
      </div>
    </li>
  );
}

export function TabletBoard({
  events,
  shiftsAvailable,
  rewardAmountPerHour,
}: {
  events: TabletEventWithShifts[];
  shiftsAvailable: boolean;
  rewardAmountPerHour: number;
}) {
  const router = useRouter();
  const now = useNow(0, 15_000);
  const [open, setOpen] = useState<TabletEventWithShifts | null>(null);
  const lastTouch = useRef(Date.now());

  const close = useCallback(() => setOpen(null), []);

  // A minute without a touch: close the sheet for the next person.
  useEffect(() => {
    const touch = () => (lastTouch.current = Date.now());
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current > IDLE_MS) setOpen(null);
    }, 5_000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      clearInterval(id);
    };
  }, []);

  // Fresh events and sign-ups every two minutes, but never under someone's fingers.
  useEffect(() => {
    const id = setInterval(() => {
      if (!open && Date.now() - lastTouch.current > 30_000) router.refresh();
    }, 120_000);
    return () => clearInterval(id);
  }, [open, router]);

  const shown = events.filter((e) => e.endMs > now);

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
          Steward an event: welcome people, show them around, make them feel at
          home. A shift starts {SHIFT_LEAD_MINUTES} minutes before the event and
          lasts {DEFAULT_SHIFT_HOURS} hours, or less if that’s all you can do.
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

      <ul
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ gap: u(2.4), paddingBottom: u(5) }}
      >
        {shown.length > 0 ? (
          shown.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              now={now}
              rewardPerHour={rewardAmountPerHour}
              available={shiftsAvailable}
              onJoin={() => setOpen(e)}
            />
          ))
        ) : (
          <li className="text-muted-foreground" style={{ fontSize: u(3.2) }}>
            No events in the next two weeks yet.
          </li>
        )}
      </ul>

      {open && (
        <SignupSheet
          event={open}
          rewardPerHour={rewardAmountPerHour}
          onClose={close}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}
