import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { callTool, listTools, type Scope } from "@/lib/mcp-tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * /mcp: the Commons Hub's MCP server (JSON-RPC over HTTP, Streamable HTTP
 * with JSON answers), the one place Elinor finds every tool she can use
 * (lib/mcp-tools.ts): the public dataset, our Luma calendar and the Discord
 * bot's tools. Authorization: Bearer ELINOR_MCP_TOKEN (everything) or
 * MCP_API_KEY (what only reads).
 */

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const SERVER_INFO = { name: "commonshub-brussels", version: "0.2.0" }
const INSTRUCTIONS =
  "Tools of the Commons Hub Brussels: its public data, its Luma calendar (list and look up events, add a member's event, create one) and the Discord bot's (permissions, rooms, shifts; proposals that the person concerned confirms in Discord). Never claim a proposal is done before its status says so. Never share anyone's contact details in a channel."

export async function POST(request: NextRequest) {
  const scope = authorize(request)
  if (!scope) return jsonRpcError(null, -32001, "Unauthorized", 401)

  let payload: JsonRpcRequest
  try {
    payload = (await request.json()) as JsonRpcRequest
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400)
  }

  const id = payload.id ?? null
  try {
    switch (payload.method) {
      case "initialize":
        return jsonRpcResult(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS })
      case "ping":
        return jsonRpcResult(id, {})
      case "tools/list":
        return jsonRpcResult(id, { tools: await listTools(scope) })
      case "tools/call": {
        const params = payload.params ?? {}
        const name = typeof params.name === "string" ? params.name : ""
        const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments) ? (params.arguments as Record<string, unknown>) : {}
        const { result, error } = await callTool(scope, name, args)
        return error ? jsonRpcError(id, error.code, error.message) : jsonRpcResult(id, result)
      }
      case "notifications/initialized":
        return new NextResponse(null, { status: 202 })
      default:
        return jsonRpcError(id, -32601, `Method not found: ${payload.method ?? ""}`)
    }
  } catch (error) {
    return jsonRpcError(id, -32000, error instanceof Error ? error.message : "Tool execution failed")
  }
}

/** What this server offers, for a person with the key. */
export async function GET(request: NextRequest) {
  const scope = authorize(request)
  if (!scope) return jsonRpcError(null, -32001, "Unauthorized", 401)
  const tools = await listTools(scope)
  return NextResponse.json({ name: SERVER_INFO.name, description: INSTRUCTIONS, tools: tools.map((t) => ({ name: t.name, description: t.description })) })
}

function jsonRpcResult(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result })
}

function jsonRpcError(id: string | number | null, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status })
}

/** Which key the request carries: Elinor's (everything) or the read-only one; null for neither. */
function authorize(request: NextRequest): Scope | null {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return null
  if (same(token, process.env.ELINOR_MCP_TOKEN)) return "elinor"
  if (same(token, process.env.MCP_API_KEY)) return "read"
  return null
}

function same(given: string, expected: string | undefined): boolean {
  if (!expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
