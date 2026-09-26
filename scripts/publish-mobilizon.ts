/**
 * Publishes a hosted event (src/settings/events/<slug>.json) to a Mobilizon
 * group: one event for the day itself and one per session. Participation is
 * external, so RSVPs stay on Luma.
 *
 *   bun scripts/publish-mobilizon.ts ocd-2026 --dry-run   # print the payloads
 *   bun scripts/publish-mobilizon.ts ocd-2026 --draft     # create as drafts
 *   bun scripts/publish-mobilizon.ts ocd-2026             # publish
 *
 * Environment: MOBILIZON_EMAIL, MOBILIZON_PASSWORD, and optionally
 * MOBILIZON_URL (https://mobilizon.be) and MOBILIZON_GROUP (commonshub_bxl).
 *
 * Re-running is safe: what was created is remembered in
 * .data/mobilizon-<slug>.json and updated instead of created again. Events the
 * group already has at the same time with a matching title (e.g. one posted by
 * hand) are skipped. See docs/mobilizon-sync.md for the API notes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HostedEvent, HostedSession } from "../src/lib/hosted-events";
import roomsData from "../src/settings/rooms.json";

const SITE_URL = "https://commonshub.brussels";
const MOBILIZON_URL = (process.env.MOBILIZON_URL || "https://mobilizon.be").replace(/\/$/, "");
const GROUP = process.env.MOBILIZON_GROUP || "commonshub_bxl";
const SESSION_MINUTES = 60;

const ADDRESS = {
  street: "51 Rue de la Madeleine - Magdalenasteenweg",
  locality: "Brussels",
  postalCode: "1000",
  country: "Belgium",
  geom: "4.3552039;50.8449817",
  timezone: "Europe/Brussels",
};

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const draft = args.includes("--draft");
if (!slug) {
  console.error("Usage: bun scripts/publish-mobilizon.ts <event-slug> [--dry-run] [--draft]");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const event: HostedEvent = JSON.parse(
  readFileSync(join(root, "src/settings/events", `${slug}.json`), "utf8")
);
const statePath = join(root, ".data", `mobilizon-${slug}.json`);
const state: Record<string, { id: string; uuid: string }> = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : {};

// --- Building the payloads --------------------------------------------------

interface Payload {
  key: string;
  title: string;
  description: string;
  beginsOn: string;
  endsOn: string;
  room?: string;
  category: string;
  tags: string[];
  withCover?: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absolute = (url: string) => (url.startsWith("/") ? SITE_URL + url : url);
const link = (url: string, text: string) => `<a href="${escapeHtml(absolute(url))}">${escapeHtml(text)}</a>`;
const roomName = (slug?: string) => roomsData.rooms.find((r) => r.slug === slug)?.name || slug || "";

/** The UTC offset of the event, e.g. "+02:00", taken from startAt. */
const offset = event.startAt.slice(19);
const day = event.startAt.slice(0, 10);

function at(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00${offset}`);
}

function sessionTimes(session: HostedSession) {
  const date = session.date || day;
  const begins = at(date, session.start);
  const dayEnd = at(date, event.endAt.slice(11, 16));
  let ends = session.end
    ? at(date, session.end)
    : new Date(begins.getTime() + SESSION_MINUTES * 60_000);
  if (ends > dayEnd) ends = dayEnd;
  return { beginsOn: begins.toISOString(), endsOn: ends.toISOString() };
}

const eventPage = `${SITE_URL}/events/${event.slug}`;
const register = event.links.luma || eventPage;
const tagNames = [...(event.tags || []).map((t) => t.name), "Commons"];

function sessionPayload(session: HostedSession, i: number): Payload {
  const parts = [
    session.description ? `<p>${escapeHtml(session.description)}</p>` : "",
    session.speakers?.length ? `<p>With ${escapeHtml(session.speakers.join(", ").replace(/\.$/, ""))}.</p>` : "",
    session.url ? `<p>More: ${link(session.url, session.url.startsWith("/") ? absolute(session.url) : session.url)}</p>` : "",
    `<p>📍 ${escapeHtml(roomName(session.room))}, Commons Hub Brussels</p>`,
    `<p>Part of ${link(eventPage, event.name)}: a day of workshops, conversations and activities in all our rooms. ` +
      `Come for one session, stay for the day. Free, please register on ${link(register, "Luma")}.</p>`,
  ];
  return {
    key: `session-${session.date || day}-${session.start}-${session.room || i}`,
    title: session.title,
    description: parts.filter(Boolean).join("\n"),
    ...sessionTimes(session),
    room: roomName(session.room),
    category: "LEARNING",
    tags: tagNames,
  };
}

function dayPayload(): Payload {
  const programme = [...event.sessions]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => {
      const title = s.url ? link(s.url, s.title) : escapeHtml(s.title);
      const who = s.speakers?.length ? `, with ${escapeHtml(s.speakers.join(", "))}` : "";
      return `<li>${s.start} · ${escapeHtml(roomName(s.room))} — ${title}${who}</li>`;
    })
    .join("\n");
  const tournament = event.tournament
    ? `<p>${event.tournament.start}–${event.tournament.end} · ${escapeHtml(event.tournament.name)}: ` +
      `teams of ${event.tournament.teamSize}, ${event.tournament.fee.amount} ${event.tournament.fee.currency} per ${event.tournament.fee.per}.</p>`
    : "";
  return {
    key: "day",
    title: event.name,
    description: [
      `<p>${escapeHtml(event.description)}</p>`,
      `<p>Come meet the Commons Hub community, explore what we're building together, and join one of many workshops, conversations and activities throughout the day.</p>`,
      `<h3>The programme</h3>`,
      `<ul>\n${programme}\n</ul>`,
      tournament,
      `<p>Come for one session, stay for the day. All are welcome. The Commons Hub only exists because people show up, contribute, experiment and build together.</p>`,
      `<p>🔥 Register: ${link(register, register)}<br>More: ${link(eventPage, eventPage)}</p>`,
    ]
      .filter(Boolean)
      .join("\n"),
    beginsOn: new Date(event.startAt).toISOString(),
    endsOn: new Date(event.endAt).toISOString(),
    category: "COMMUNITY",
    tags: tagNames,
    withCover: true,
  };
}

const payloads = [dayPayload(), ...event.sessions.map(sessionPayload)];

// --- Mobilizon API -----------------------------------------------------------

let token = "";

async function gql<T>(query: string, variables: Record<string, unknown> = {}, files?: Record<string, Blob>): Promise<T> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  let body: BodyInit;
  if (files) {
    // Absinthe's upload format: the Upload variable names a multipart field.
    const form = new FormData();
    form.set("query", query);
    form.set("variables", JSON.stringify(variables));
    for (const [name, blob] of Object.entries(files)) form.set(name, blob, name);
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ query, variables });
  }
  const res = await fetch(`${MOBILIZON_URL}/api`, { method: "POST", headers, body });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error(`Empty response (${res.status})`);
  return json.data;
}

async function login() {
  const { MOBILIZON_EMAIL: email, MOBILIZON_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error("Set MOBILIZON_EMAIL and MOBILIZON_PASSWORD");
  const data = await gql<{ login: { accessToken: string } }>(
    `mutation($email: String!, $password: String!) { login(email: $email, password: $password) { accessToken } }`,
    { email, password }
  );
  token = data.login.accessToken;
}

interface GroupEvent {
  id: string;
  uuid: string;
  title: string;
  beginsOn: string;
}

async function loadContext() {
  const data = await gql<{
    loggedPerson: { id: string; preferredUsername: string };
    group: { id: string; organizedEvents: { elements: GroupEvent[] } } | null;
  }>(
    `query($group: String!) {
      loggedPerson { id preferredUsername }
      group(preferredUsername: $group) {
        id
        organizedEvents(limit: 100) { elements { id uuid title beginsOn } }
      }
    }`,
    { group: GROUP }
  );
  if (!data.group) throw new Error(`Group @${GROUP} not found on ${MOBILIZON_URL}`);
  return { actorId: data.loggedPerson.id, groupId: data.group.id, existing: data.group.organizedEvents.elements };
}

async function uploadCover(actorId: string): Promise<string | null> {
  if (!event.coverImage) return null;
  const res = await fetch(absolute(event.coverImage));
  if (!res.ok) {
    console.warn(`Could not fetch the cover image (${res.status}), continuing without it`);
    return null;
  }
  const blob = await res.blob();
  const data = await gql<{ uploadMedia: { uuid: string } }>(
    `mutation($actorId: ID!, $name: String!, $alt: String, $file: Upload!) {
      uploadMedia(actorId: $actorId, name: $name, alt: $alt, file: $file) { uuid }
    }`,
    { actorId, name: `${event.slug}-cover.${blob.type.split("/")[1] || "png"}`, alt: event.name, file: "cover" },
    { cover: blob }
  );
  return data.uploadMedia.uuid;
}

const EVENT_FIELDS = `
  $title: String!, $description: String!, $beginsOn: DateTime!, $endsOn: DateTime,
  $organizerActorId: ID!, $attributedToId: ID, $category: EventCategory, $tags: [String],
  $physicalAddress: AddressInput, $picture: MediaInput, $externalParticipationUrl: String
`;
const EVENT_ARGS = `
  title: $title, description: $description, beginsOn: $beginsOn, endsOn: $endsOn,
  organizerActorId: $organizerActorId, attributedToId: $attributedToId,
  category: $category, tags: $tags, physicalAddress: $physicalAddress, picture: $picture,
  joinOptions: EXTERNAL, externalParticipationUrl: $externalParticipationUrl,
  visibility: PUBLIC, language: "en"
`;

function variables(p: Payload, ctx: { actorId: string; groupId: string }, coverUuid: string | null) {
  return {
    title: p.title,
    description: p.description,
    beginsOn: p.beginsOn,
    endsOn: p.endsOn,
    organizerActorId: ctx.actorId,
    attributedToId: ctx.groupId,
    category: p.category,
    tags: p.tags,
    physicalAddress: {
      ...ADDRESS,
      description: p.room ? `Commons Hub Brussels · ${p.room}` : "Commons Hub Brussels",
    },
    picture: p.withCover && coverUuid ? { mediaUuid: coverUuid } : undefined,
    externalParticipationUrl: register,
  };
}

const normalise = (s: string) => s.toLowerCase().replace(/\[[a-z]{2}\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function alreadyThere(p: Payload, existing: GroupEvent[]) {
  return existing.find(
    (e) =>
      new Date(e.beginsOn).getTime() === new Date(p.beginsOn).getTime() &&
      (normalise(e.title).includes(normalise(p.title)) || normalise(p.title).includes(normalise(e.title)))
  );
}

function saveState() {
  mkdirSync(join(root, ".data"), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

// --- Run ------------------------------------------------------------------------

async function main() {
  if (dryRun) {
    for (const p of payloads) {
      console.log(`\n=== ${p.title} (${p.beginsOn} → ${p.endsOn})${state[p.key] ? " [update]" : ""}`);
      console.log(p.description);
    }
    console.log(`\n${payloads.length} events for @${GROUP} on ${MOBILIZON_URL}. Nothing was sent.`);
    return;
  }

  await login();
  const ctx = await loadContext();
  const coverUuid = await uploadCover(ctx.actorId);

  for (const p of payloads) {
    const vars = variables(p, ctx, coverUuid);
    const known = state[p.key];
    if (known) {
      await gql(
        `mutation($eventId: ID!, $draft: Boolean, ${EVENT_FIELDS}) { updateEvent(eventId: $eventId, draft: $draft, ${EVENT_ARGS}) { id uuid } }`,
        { eventId: known.id, draft, ...vars }
      );
      console.log(`updated  ${p.title}${draft ? " (draft)" : ""}  ${MOBILIZON_URL}/events/${known.uuid}`);
      continue;
    }
    const existing = alreadyThere(p, ctx.existing);
    if (existing) {
      console.log(`skipped  ${p.title}  already there as "${existing.title}" ${MOBILIZON_URL}/events/${existing.uuid}`);
      continue;
    }
    const data = await gql<{ createEvent: { id: string; uuid: string } }>(
      `mutation($draft: Boolean, ${EVENT_FIELDS}) { createEvent(draft: $draft, ${EVENT_ARGS}) { id uuid } }`,
      { draft, ...vars }
    );
    state[p.key] = data.createEvent;
    saveState();
    console.log(`created  ${p.title}${draft ? " (draft)" : ""}  ${MOBILIZON_URL}/events/${data.createEvent.uuid}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
