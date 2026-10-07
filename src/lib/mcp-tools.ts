/**
 * Every tool /mcp offers, in one place: Elinor (the community's assistant on
 * Discord) connects to this one server and finds all she can do.
 *
 * - the public dataset (transactions, contributors, events, rooms, tokens);
 * - our Luma calendar: list events, look one up (participants by status,
 *   organizers' names), add a member's event to the calendar, create one;
 * - the Discord bot's tools (opencollective/token-bot: permissions, rooms,
 *   shifts, and proposals to mint tokens, sign up for a shift or book a room,
 *   which the person concerned confirms in Discord), proxied as they are.
 *
 * Two keys: ELINOR_MCP_TOKEN opens everything (it is also what this server
 * presents to the Discord bot); MCP_API_KEY opens what only reads.
 * Acting for someone (adding or creating an event) needs their Discord id:
 * members (the Discord member role) add events straight to the calendar,
 * anyone else's submission waits for an admin.
 */

import settings from "@/settings/settings.json"

import { discordFetch } from "./discord"
import { addToCalendar, createEvent, getEventDetails, listEvents, LumaError, lookupOnCalendar, resolveEventId } from "./luma-api"
import { listDatasetFiles, listDatasetPeriods, queryDataset, readDatasetFile, summarizeTokens } from "./mcp-dataset"

export type Scope = "read" | "elinor"

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  /** MCP tool annotations: what a client may let run without asking. */
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }
}

interface LocalTool extends McpTool {
  scope: Scope
  run: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

/** A tool call that went wrong in a way worth telling the assistant as is. */
export class ToolError extends Error {}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false })
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra })
const period = {
  year: str("Dataset year, e.g. 2026", { pattern: "^\\d{4}$" }),
  month: str("Dataset month, e.g. 05", { pattern: "^\\d{2}$" }),
  latest: { type: "boolean", description: "Use latest/public instead of a year/month period" },
}
const requestedBy = str("The Discord user id of the member asking (they must be the one who asked you).")

function text(args: Record<string, unknown>, key: string, required = true): string | undefined {
  const v = args[key]
  if (typeof v === "string" && v.trim()) return v.trim()
  if (required) throw new ToolError(`${key} is required`)
  return undefined
}

function isoDate(args: Record<string, unknown>, key: string, required = true): string | undefined {
  const v = text(args, key, required)
  if (v === undefined) return undefined
  const ms = Date.parse(v)
  if (!Number.isFinite(ms)) throw new ToolError(`${key} must be an ISO 8601 date-time, e.g. 2026-10-20T18:00:00+02:00`)
  return new Date(ms).toISOString()
}

/** Is this Discord user a member of the hub (the member role on our server)? */
export async function isMember(discordUserId: string): Promise<boolean> {
  if (!/^\d{5,25}$/.test(discordUserId)) throw new ToolError("requestedBy must be a Discord user id (digits)")
  const res = await discordFetch(`/guilds/${settings.discord.guildId}/members/${discordUserId}`)
  if (!res.ok) return false
  const member = (await res.json()) as { roles?: string[] }
  return (member.roles ?? []).includes(settings.discord.roles.member)
}

const LOCAL: LocalTool[] = [
  // ── the public dataset ──
  { name: "list_periods", scope: "read", description: "List available public dataset years/months and public file types.", inputSchema: obj({}), run: () => listDatasetPeriods() },
  { name: "list_dataset_files", scope: "read", description: "List public dataset files available for a year, month, or latest snapshot.", inputSchema: obj(period), run: (a) => listDatasetFiles(a) },
  {
    name: "read_dataset_file",
    scope: "read",
    description: "Read an allowlisted public dataset file such as transactions.json, contributors.json, events.json, rooms.json, or calendars/public.ics.",
    inputSchema: obj({ ...period, file: str("Public dataset file path, e.g. transactions.json or calendars/public.ics") }, ["file"]),
    run: (a) => readDatasetFile({ ...a, file: text(a, "file")! }),
  },
  {
    name: "query_dataset",
    scope: "read",
    description: "Query first-class public datasets: transactions, contributors, events, rooms, or calendars. JSON arrays are paginated with limit/offset.",
    inputSchema: obj({ ...period, dataset: { type: "string", enum: ["transactions", "contributors", "events", "rooms", "calendars"] }, limit: { type: "number", minimum: 1, maximum: 500 }, offset: { type: "number", minimum: 0 } }, ["dataset"]),
    run: (a) => {
      const dataset = text(a, "dataset") as "transactions" | "contributors" | "events" | "rooms" | "calendars"
      if (!["transactions", "contributors", "events", "rooms", "calendars"].includes(dataset)) throw new ToolError(`Unknown dataset: ${dataset}`)
      return queryDataset({ ...a, dataset, limit: typeof a.limit === "number" ? a.limit : undefined, offset: typeof a.offset === "number" ? a.offset : undefined })
    },
  },
  { name: "summarize_tokens", scope: "read", description: "Summarize issued and burnt tokens from public MINT/BURN transactions for a period.", inputSchema: obj(period), run: (a) => summarizeTokens(a) },

  // ── the Luma calendar ──
  {
    name: "luma_list_events",
    scope: "read",
    description:
      "List the events on the Commons Hub's Luma calendar: upcoming (soonest first) or past (latest first). Each has its id, name, start/end, link, place, capacity and spots left, and whether the hub manages it (calendar: ours) or it is someone else's event listed on our calendar (listed).",
    inputSchema: obj({
      when: { type: "string", enum: ["upcoming", "past"], description: "Default upcoming." },
      after: str("Only events starting after this ISO date-time."),
      before: str("Only events starting before this ISO date-time."),
      limit: { type: "number", minimum: 1, maximum: 100, description: "Default 20." },
    }),
    run: (a) => listEvents({ when: a.when === "past" ? "past" : "upcoming", after: isoDate(a, "after", false), before: isoDate(a, "before", false), limit: typeof a.limit === "number" ? Math.min(100, Math.max(1, a.limit)) : 20 }),
  },
  {
    name: "luma_get_event",
    scope: "read",
    description:
      "Look up one event (its evt-… id or its luma.com link): details, how many people registered by status (approved = going, pending_approval, waitlist, invited, declined, checked_in) and its organizers (names only: never share anyone's contact details).",
    inputSchema: obj({ event: str("The event's id (evt-…) or its luma.com / lu.ma link.") }, ["event"]),
    run: (a) => getEventDetails(text(a, "event")!),
  },
  {
    name: "luma_add_event",
    scope: "elinor",
    description:
      "Put an existing event on the Commons Hub's main Luma calendar, for the member who asks: their Luma event (id or link) or an event elsewhere (url, name, start, duration). Members (the member role on Discord) add it straight away; anyone else's goes to the calendar admins for approval. Tell the person which happened.",
    inputSchema: obj(
      {
        requestedBy,
        event: str("A Luma event: its id (evt-…) or luma.com link."),
        url: str("For an event not on Luma: its page."),
        name: str("For an event not on Luma: its name."),
        start: str("For an event not on Luma: when it starts, ISO 8601 with the offset, e.g. 2026-10-20T18:00:00+02:00."),
        durationMinutes: { type: "number", minimum: 15, maximum: 7 * 24 * 60, description: "For an event not on Luma: how long it lasts, in minutes." },
      },
      ["requestedBy"],
    ),
    run: async (a) => {
      const member = await isMember(text(a, "requestedBy")!)
      const event = text(a, "event", false)
      if (event) {
        const eventId = await resolveEventId(event)
        if (await lookupOnCalendar(eventId)) return { status: "already on the calendar", eventId }
        const added = await addToCalendar({ event: eventId }, member)
        return { ...added, member, note: member ? "Added to the Commons Hub calendar." : "Submitted; a calendar admin will approve it (only members add events directly)." }
      }
      const url = text(a, "url")!
      const name = text(a, "name")!
      const start = isoDate(a, "start")!
      const durationMinutes = typeof a.durationMinutes === "number" ? Math.round(a.durationMinutes) : 120
      const added = await addToCalendar({ url, name, start, durationMinutes }, member)
      return { ...added, member, note: member ? "Added to the Commons Hub calendar." : "Submitted; a calendar admin will approve it (only members add events directly)." }
    },
  },
  {
    name: "luma_create_event",
    scope: "elinor",
    description:
      "Create a new event on the Commons Hub's Luma calendar for a member (members only), at the hub unless another address is given, and make them its host (their email is needed for that; ask them). It does not book a room: for that, propose a room booking too.",
    inputSchema: obj(
      {
        requestedBy,
        name: str("The event's title."),
        start: str("When it starts, ISO 8601 with the offset, e.g. 2026-10-20T18:00:00+02:00."),
        end: str("When it ends, same format."),
        description: str("What it is about (Markdown)."),
        visibility: { type: "string", enum: ["public", "members-only", "private"], description: "Default public." },
        capacity: { type: "number", minimum: 1, maximum: 500 },
        hostEmail: str("The member's email, to make them the host (they will manage the event)."),
        hostName: str("Their name, for the host line."),
        address: str("Only if it is not at the Commons Hub."),
      },
      ["requestedBy", "name", "start", "end"],
    ),
    run: async (a) => {
      if (!(await isMember(text(a, "requestedBy")!))) throw new ToolError("Only members can create events on the Commons Hub calendar. They can submit an existing event with luma_add_event instead.")
      const start = isoDate(a, "start")!
      const end = isoDate(a, "end")!
      if (Date.parse(end) <= Date.parse(start)) throw new ToolError("end must be after start")
      const visibility = (["public", "members-only", "private"] as const).find((v) => v === a.visibility)
      return createEvent({
        name: text(a, "name")!,
        start,
        end,
        description: text(a, "description", false),
        visibility,
        capacity: typeof a.capacity === "number" ? Math.round(a.capacity) : undefined,
        hostEmail: text(a, "hostEmail", false),
        hostName: text(a, "hostName", false),
        address: text(a, "address", false),
      })
    },
  },
]

// ── the Discord bot's tools, proxied ──

const BOT_URL = () => process.env.TOKEN_BOT_MCP_URL || "https://bot.opencollective.xyz/mcp"
let botTools: { at: number; tools: McpTool[] } | null = null

async function botRpc(method: string, params: Record<string, unknown> = {}): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const token = process.env.ELINOR_MCP_TOKEN
  if (!token) throw new ToolError("ELINOR_MCP_TOKEN is not set")
  const res = await fetch(BOT_URL(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  })
  if (!res.ok) throw new ToolError(`The Discord bot answered ${res.status}`)
  return (await res.json()) as { result?: unknown; error?: { code: number; message: string } }
}

/**
 * The bot's tools, as it describes them now: fetched afresh for every tools/list
 * (a new version of the bot shows at once), from the last answer for a call
 * (within five minutes). When the bot can't be reached: the last known ones,
 * or none, and no error.
 */
async function discordBotTools({ fresh = false } = {}): Promise<McpTool[]> {
  if (!fresh && botTools && Date.now() - botTools.at < 5 * 60_000) return botTools.tools
  try {
    const { result } = await botRpc("tools/list")
    const tools = ((result as { tools?: McpTool[] })?.tools ?? []).filter((t) => !LOCAL.some((l) => l.name === t.name))
    botTools = { at: Date.now(), tools: tools.map((t) => ({ ...t, description: `${t.description} (Discord bot)`, annotations: t.annotations ?? annotate(t.name, "elinor") })) }
  } catch (error) {
    console.error("[mcp] Discord bot tools unavailable:", error instanceof Error ? error.message : error)
    botTools = { at: Date.now() - 4 * 60_000, tools: botTools?.tools ?? [] }
  }
  return botTools.tools
}

/** Every tool this key may use. */
/**
 * What each tool does, for the client deciding what may run without asking:
 * reading is safe; adding or creating an event writes to Luma (nothing is
 * deleted); the bot's proposals only ask the person concerned to confirm.
 */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
function annotate(name: string, scope: Scope): McpTool["annotations"] {
  if (name === "luma_add_event") return { ...WRITES, idempotentHint: true }
  if (name === "luma_create_event") return { ...WRITES, idempotentHint: false }
  if (name.startsWith("propose_")) return { ...WRITES, idempotentHint: false }
  return scope === "read" || !name.startsWith("propose_") ? READ_ONLY : WRITES
}

export async function listTools(scope: Scope): Promise<McpTool[]> {
  const local = LOCAL.filter((t) => scope === "elinor" || t.scope === "read").map(({ name, description, inputSchema, scope: s }) => ({ name, description, inputSchema, annotations: annotate(name, s) }))
  return scope === "elinor" ? [...local, ...(await discordBotTools({ fresh: true }))] : local
}

/** Run a tool: ours, or the bot's (whose answer is passed on as it is, MCP result or error). */
export async function callTool(scope: Scope, name: string, args: Record<string, unknown>): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const local = LOCAL.find((t) => t.name === name)
  if (local) {
    if (local.scope === "elinor" && scope !== "elinor") return { error: { code: -32001, message: `${name} needs Elinor's key` } }
    try {
      const data = await local.run(args)
      return { result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } }
    } catch (error) {
      // What the assistant should relay: our own checks and Luma's answer.
      if (error instanceof ToolError || error instanceof LumaError) return { result: { content: [{ type: "text", text: error.message }], isError: true } }
      throw error
    }
  }
  // The bot's tool: its arguments go through exactly as given.
  if (scope === "elinor" && ((await discordBotTools()).some((t) => t.name === name) || (await discordBotTools({ fresh: true })).some((t) => t.name === name)))
    return botRpc("tools/call", { name, arguments: args })
  return { error: { code: -32602, message: `Unknown tool: ${name}` } }
}
