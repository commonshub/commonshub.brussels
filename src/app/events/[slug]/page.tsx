import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/components/optimized-image";
import {
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import {
  getHostedEvent,
  hostedEvents,
  type HostedEvent,
  type HostedSession,
  type HostedTournament,
} from "@/lib/hosted-events";
import roomsData from "@/settings/rooms.json";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return hostedEvents.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = getHostedEvent(slug);
  if (!event) return { title: "Event Not Found" };

  return {
    title: `${event.name} | Commons Hub Brussels`,
    description: event.tagline || event.description,
    openGraph: {
      title: event.name,
      description: event.tagline || event.description,
      images: event.coverImage ? [coverSrc(event.coverImage, "md")] : undefined,
    },
  };
}

function coverSrc(url: string, size: "sm" | "md" | "lg") {
  return url.startsWith("/") ? url : getProxiedImageUrl(url, size, { relative: true });
}

function roomName(slug: string) {
  return roomsData.rooms.find((r) => r.slug === slug)?.name || slug;
}

function formatDay(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

function formatTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** YYYY-MM-DD of an instant, in the event's time zone. */
function localDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

function formatWhen(event: HostedEvent) {
  const { startAt, endAt, timezone } = event;
  if (localDate(startAt, timezone) === localDate(endAt, timezone)) {
    return `${formatDay(startAt, timezone)} · ${formatTime(startAt, timezone)} – ${formatTime(endAt, timezone)}`;
  }
  return `${formatDay(startAt, timezone)} – ${formatDay(endAt, timezone)}`;
}

function formatFee(fee: HostedTournament["fee"]) {
  const amount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: fee.currency,
    maximumFractionDigits: 0,
  }).format(fee.amount);
  return `${amount} per ${fee.per}`;
}

/** A timetable entry: a session, or the tournament in its own column. */
interface ScheduleItem {
  start: string;
  end?: string;
  column: string;
  title: string;
  speakers?: string[];
  href?: string;
}

const TOURNAMENT_COLUMN = "kicker";

function scheduleDays(event: HostedEvent) {
  const firstDay = localDate(event.startAt, event.timezone);
  const days = new Map<string, ScheduleItem[]>();
  const add = (date: string, item: ScheduleItem) =>
    days.set(date, [...(days.get(date) || []), item]);

  event.sessions.forEach((session: HostedSession) =>
    add(session.date || firstDay, {
      start: session.start,
      end: session.end,
      column: session.room || "",
      title: session.title,
      speakers: session.speakers,
      href: session.url,
    })
  );

  if (event.tournament) {
    add(firstDay, {
      start: event.tournament.start,
      end: event.tournament.end,
      column: TOURNAMENT_COLUMN,
      title: event.tournament.name,
      href: "#tournament",
    });
  }

  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function columnLabel(column: string) {
  if (column === TOURNAMENT_COLUMN) return "Kicker table";
  return column ? roomName(column) : "Everywhere";
}

function SessionEntry({ item, showColumn }: { item: ScheduleItem; showColumn?: boolean }) {
  const title = item.href ? (
    <a href={item.href} className="hover:underline">
      {item.title}
    </a>
  ) : (
    item.title
  );

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-sm font-semibold text-primary">
        {item.start}
        {item.end ? ` – ${item.end}` : ""}
        {showColumn && (
          <span className="ml-2 font-normal text-muted-foreground">
            · {columnLabel(item.column)}
          </span>
        )}
      </div>
      <div className="font-medium text-foreground mt-1">{title}</div>
      {item.speakers && item.speakers.length > 0 && (
        <div className="text-sm text-muted-foreground">
          by {item.speakers.join(" & ")}
        </div>
      )}
    </div>
  );
}

function DaySchedule({ items }: { items: ScheduleItem[] }) {
  const roomOrder = roomsData.rooms.map((r) => r.slug);
  const columns = [...new Set(items.map((i) => i.column))].sort((a, b) => {
    const rank = (c: string) =>
      c === TOURNAMENT_COLUMN ? Infinity : roomOrder.indexOf(c);
    return rank(a) - rank(b);
  });
  const times = [...new Set(items.map((i) => i.start))].sort();
  const byTime = [...items].sort(
    (a, b) => a.start.localeCompare(b.start) || columns.indexOf(a.column) - columns.indexOf(b.column)
  );

  return (
    <>
      {/* Timetable: one column per room */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-separate border-spacing-2 table-fixed">
          <thead>
            <tr>
              <th className="w-20" />
              {columns.map((column) => (
                <th key={column} className="text-left">
                  {column && column !== TOURNAMENT_COLUMN ? (
                    <Link
                      href={`/rooms/${column}`}
                      className="inline-block rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      {columnLabel(column)}
                    </Link>
                  ) : (
                    <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                      {columnLabel(column)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <td className="align-top pt-3 text-sm font-semibold text-muted-foreground">
                  {time}
                </td>
                {columns.map((column) => (
                  <td key={column} className="align-top">
                    <div className="space-y-2">
                      {items
                        .filter((i) => i.start === time && i.column === column)
                        .map((item) => (
                          <SessionEntry key={item.title} item={item} />
                        ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Smaller screens: one list, by time */}
      <div className="lg:hidden space-y-3">
        {byTime.map((item) => (
          <SessionEntry key={`${item.start}-${item.title}`} item={item} showColumn />
        ))}
      </div>
    </>
  );
}

function TournamentSection({ tournament }: { tournament: HostedTournament }) {
  const matches = tournament.matches || [];

  return (
    <section id="tournament" className="py-16 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-500" />
          {tournament.name}
        </h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                <span>
                  {tournament.start} – {tournament.end}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary flex-shrink-0" />
                <span>
                  Teams of {tournament.teamSize}
                  {tournament.maxTeams ? `, up to ${tournament.maxTeams} teams` : ""}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Ticket className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{formatFee(tournament.fee)}</strong>. {tournament.payment}
                </span>
              </div>
              <Button size="lg" className="w-full gap-2 cursor-pointer" asChild>
                <a href={tournament.signupUrl} target="_blank" rel="noopener noreferrer">
                  Sign up your team
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {tournament.rules && tournament.rules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How it works</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  {tournament.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-semibold text-foreground">Matches</h3>
          {matches.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              The match schedule is published here once the teams are known and
              the draw is made.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Round</th>
                    <th className="py-2 pr-4">Match</th>
                    <th className="py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr
                      key={`${match.time}-${match.teamA}-${match.teamB}`}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium">{match.time}</td>
                      <td className="py-2 pr-4">{match.round}</td>
                      <td className="py-2 pr-4">
                        {match.teamA} vs {match.teamB}
                      </td>
                      <td className="py-2">{match.score || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tournament.bracketUrl && (
            <Button variant="outline" className="mt-4 gap-2 cursor-pointer" asChild>
              <a href={tournament.bracketUrl} target="_blank" rel="noopener noreferrer">
                Live bracket
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export default async function HostedEventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = getHostedEvent(slug);
  if (!event) notFound();

  const days = scheduleDays(event);
  const multiDay = days.length > 1;

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
                At the Commons Hub
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                {event.name}
              </h1>
              {event.tagline && (
                <p className="mt-6 text-xl text-muted-foreground">{event.tagline}</p>
              )}
              <div className="mt-8 space-y-3 text-foreground">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{formatWhen(event)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{event.location}</span>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                {event.links.luma && (
                  <Button size="lg" className="gap-2 cursor-pointer" asChild>
                    <a href={event.links.luma} target="_blank" rel="noopener noreferrer">
                      <Ticket className="w-5 h-5" />
                      Register on Luma
                    </a>
                  </Button>
                )}
                {event.links.website && (
                  <Button
                    size="lg"
                    variant={event.links.luma ? "outline" : "default"}
                    className="gap-2 cursor-pointer"
                    asChild
                  >
                    <a href={event.links.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-5 h-5" />
                      Event website
                    </a>
                  </Button>
                )}
                {event.tournament && (
                  <Button size="lg" variant="outline" className="gap-2 cursor-pointer" asChild>
                    <a href="#tournament">
                      <Trophy className="w-5 h-5" />
                      {event.tournament.name}
                    </a>
                  </Button>
                )}
              </div>
            </div>
            {event.coverImage && (
              <div
                className="relative w-full rounded-2xl overflow-hidden bg-muted"
                style={{ aspectRatio: event.coverAspectRatio || "1 / 1" }}
              >
                <Image
                  src={coverSrc(event.coverImage, "lg")}
                  alt={event.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-lg text-muted-foreground">{event.description}</p>
        </div>
      </section>

      {/* Schedule */}
      <section id="schedule" className="py-16 bg-card scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground">Schedule</h2>
          {days.length === 0 ? (
            <p className="mt-4 text-muted-foreground">
              The programme is not published yet.
              {event.links.website && (
                <>
                  {" "}
                  Follow{" "}
                  <a
                    href={event.links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    the event website
                  </a>{" "}
                  for updates.
                </>
              )}
            </p>
          ) : (
            <div className="mt-8 space-y-12">
              {days.map(([date, items]) => (
                <div key={date}>
                  {multiDay && (
                    <h3 className="text-xl font-semibold text-foreground mb-4">
                      {formatDay(`${date}T12:00:00Z`, event.timezone)}
                    </h3>
                  )}
                  <DaySchedule items={items} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {event.tournament && <TournamentSection tournament={event.tournament} />}

      {event.relatedEvents && event.relatedEvents.length > 0 && (
        <section className="py-16 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-foreground">Also this week</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {event.relatedEvents.map((related) => (
                <a
                  key={related.url}
                  href={related.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="h-full hover:shadow-lg transition-all">
                    <CardContent className="pt-6">
                      <div className="text-sm font-semibold text-primary">
                        {formatDay(`${related.date}T12:00:00Z`, event.timezone)}
                      </div>
                      <div className="mt-1 font-medium text-foreground flex items-center gap-2">
                        {related.title}
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                      {related.speakers && (
                        <div className="text-sm text-muted-foreground">
                          by {related.speakers.join(" & ")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
