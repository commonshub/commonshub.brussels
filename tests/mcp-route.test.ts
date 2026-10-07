/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function loadRoute(dataDir: string, apiKey?: string) {
  jest.resetModules();
  process.env.DATA_DIR = dataDir;
  if (apiKey === undefined) {
    delete process.env.MCP_API_KEY;
  } else {
    process.env.MCP_API_KEY = apiKey;
  }
  return import("@/app/mcp/route");
}

function mcpRequest(body: unknown, apiKey?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (apiKey) headers.set("authorization", `Bearer ${apiKey}`);
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("/mcp route", () => {
  let tmpDir: string;
  const previousDataDir = process.env.DATA_DIR;
  const previousApiKey = process.env.MCP_API_KEY;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-mcp-"));
    writeJson(path.join(tmpDir, "2026", "05", "public", "transactions.json"), {
      year: "2026",
      month: "05",
      transactions: [
        { id: "tx-1", type: "MINT", amount: 100, timestamp: 1770000000 },
        { id: "tx-2", type: "BURN", amount: 25, timestamp: 1770000010 },
      ],
    });
    writeJson(path.join(tmpDir, "2026", "05", "public", "contributors.json"), {
      year: "2026",
      month: "05",
      summary: { totalContributors: 1 },
      contributors: [{ id: "alice" }],
    });
    writeJson(path.join(tmpDir, "2026", "05", "public", "events.json"), {
      month: "05",
      events: [{ id: "evt-1", name: "Assembly", source: "luma" }],
    });
    writeJson(path.join(tmpDir, "2026", "05", "public", "calendars", "public.ics"), "BEGIN:VCALENDAR");
    writeJson(path.join(tmpDir, "latest", "public", "rooms.json"), {
      rooms: [{ id: "main", name: "Main room" }],
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousApiKey === undefined) delete process.env.MCP_API_KEY;
    else process.env.MCP_API_KEY = previousApiKey;
  });

  it("opens nothing when no key is configured", async () => {
    const { POST } = await loadRoute(tmpDir);
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "secret") as any);

    expect(response.status).toBe(401);
  });

  it("rejects requests without the bearer API key", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }) as any);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toBe("Unauthorized");
  });

  it("lists the read-only tools for the read-only key: the public dataset and the Luma calendar", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "secret") as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "list_periods",
      "list_dataset_files",
      "read_dataset_file",
      "query_dataset",
      "summarize_tokens",
      "luma_list_events",
      "luma_get_event",
    ]);
  });

  it("summarizes public periods and dataset files", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_periods", arguments: {} },
    }, "secret") as any);

    const body = await response.json();
    const data = JSON.parse(body.result.content[0].text);
    expect(data.periods).toEqual([{ year: "2026", months: ["05"] }]);
    expect(data.latest).toContain("rooms.json");
    expect(data.generatedFiles).toEqual(expect.arrayContaining([
      "transactions.json",
      "contributors.json",
      "events.json",
      "calendars/public.ics",
    ]));
  });

  it("reads only allowlisted public files", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const response = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "read_dataset_file",
        arguments: { year: "2026", month: "05", file: "transactions.json" },
      },
    }, "secret") as any);

    const body = await response.json();
    const data = JSON.parse(body.result.content[0].text);
    expect(data.transactions).toHaveLength(2);

    const privateResponse = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "read_dataset_file",
        arguments: { year: "2026", month: "05", file: "private/enrichment.json" },
      },
    }, "secret") as any);
    const privateBody = await privateResponse.json();
    expect(privateBody.error.message).toContain("not public");
  });

  it("queries first-class datasets and summarizes issued/burnt tokens", async () => {
    const { POST } = await loadRoute(tmpDir, "secret");
    const queryResponse = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "query_dataset",
        arguments: { dataset: "transactions", year: "2026", month: "05", limit: 1 },
      },
    }, "secret") as any);
    const queryBody = await queryResponse.json();
    const queryData = JSON.parse(queryBody.result.content[0].text);
    expect(queryData.items).toEqual([{ id: "tx-1", type: "MINT", amount: 100, timestamp: 1770000000 }]);
    expect(queryData.total).toBe(2);

    const tokenResponse = await POST(mcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "summarize_tokens", arguments: { year: "2026", month: "05" } },
    }, "secret") as any);
    const tokenBody = await tokenResponse.json();
    const tokenData = JSON.parse(tokenBody.result.content[0].text);
    expect(tokenData).toMatchObject({ minted: 100, burnt: 25, net: 75, transactionCount: 2 });
  });

  describe("Elinor's key", () => {
    const previousElinor = process.env.ELINOR_MCP_TOKEN;
    const previousLuma = process.env.LUMA_API_KEY;
    const realFetch = global.fetch;
    let calls: Array<{ url: string; body?: unknown }>;
    let memberRoles: string[];

    async function loadElinor() {
      jest.resetModules();
      process.env.DATA_DIR = tmpDir;
      process.env.ELINOR_MCP_TOKEN = "elinor-secret";
      process.env.LUMA_API_KEY = "luma-key";
      jest.doMock("@/lib/discord", () => ({
        discordFetch: async () => new Response(JSON.stringify({ roles: memberRoles }), { status: 200 }),
      }));
      return import("@/app/mcp/route");
    }

    beforeEach(() => {
      calls = [];
      memberRoles = ["1280559675292778617"];
      global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, body });
        if (url.startsWith("https://bot.opencollective.xyz/mcp")) {
          if (body.method === "tools/list") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [{ name: "propose_mint", description: "Propose a mint", inputSchema: { type: "object" } }] } }));
          return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "proposed" }] } }));
        }
        if (url.includes("/v1/calendars/events/lookup")) return new Response(JSON.stringify({}));
        if (url.includes("/v1/calendars/events/add")) return new Response(JSON.stringify({}));
        if (url.includes("/v1/events/get")) {
          return new Response(JSON.stringify({
            id: "evt-abcdefghij12", name: "Assembly", start_at: "2026-10-20T16:00:00Z", access: "manage",
            hosts: [{ id: "usr-1", email: "host@example.org", name: "Ann Host" }],
            guest_counts: { approved: { guests: 12, tickets: 12 }, waitlist: { guests: 3, tickets: 3 } },
          }));
        }
        return new Response("not found", { status: 404 });
      }) as typeof fetch;
    });

    afterEach(() => {
      global.fetch = realFetch;
      jest.dontMock("@/lib/discord");
      if (previousElinor === undefined) delete process.env.ELINOR_MCP_TOKEN;
      else process.env.ELINOR_MCP_TOKEN = previousElinor;
      if (previousLuma === undefined) delete process.env.LUMA_API_KEY;
      else process.env.LUMA_API_KEY = previousLuma;
    });

    const call = (name: string, args: Record<string, unknown>) => mcpRequest({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } }, "elinor-secret") as any;

    it("lists every tool in one place: ours and the Discord bot's", async () => {
      const { POST } = await loadElinor();
      const body = await (await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "elinor-secret") as any)).json();
      const names = body.result.tools.map((t: { name: string }) => t.name);
      expect(names).toEqual(expect.arrayContaining(["query_dataset", "luma_list_events", "luma_get_event", "luma_add_event", "luma_create_event", "propose_mint"]));
    });

    it("passes the Discord bot's tools through with Elinor's token", async () => {
      const { POST } = await loadElinor();
      const body = await (await POST(call("propose_mint", { amount: 1 }))).json();
      expect(body.result.content[0].text).toBe("proposed");
      const forwarded = calls.find((c) => (c.body as { method?: string })?.method === "tools/call");
      expect(forwarded?.body).toMatchObject({ params: { name: "propose_mint", arguments: { amount: 1 } } });
    });

    it("an event: participants by status, organizers by name only", async () => {
      const { POST } = await loadElinor();
      const body = await (await POST(call("luma_get_event", { event: "evt-abcdefghij12" }))).json();
      const data = JSON.parse(body.result.content[0].text);
      expect(data.participants).toEqual({ approved: 12, waitlist: 3 });
      expect(data.organizers).toEqual([{ name: "Ann Host" }]);
      expect(body.result.content[0].text).not.toContain("host@example.org");
    });

    it("a member's event goes straight on the calendar; anyone else's waits for an admin", async () => {
      const { POST } = await loadElinor();
      let data = JSON.parse((await (await POST(call("luma_add_event", { requestedBy: "123456789", event: "evt-abcdefghij12" }))).json()).result.content[0].text);
      expect(data).toMatchObject({ status: "added", member: true });
      expect(calls.find((c) => c.url.includes("/v1/calendars/events/add"))?.body).toEqual({ platform: "luma", event_id: "evt-abcdefghij12", submission_mode: "auto" });

      memberRoles = [];
      calls = [];
      data = JSON.parse((await (await POST(call("luma_add_event", { requestedBy: "987654321", event: "evt-abcdefghij12" }))).json()).result.content[0].text);
      expect(data).toMatchObject({ status: "pending", member: false });
      expect(calls.find((c) => c.url.includes("/v1/calendars/events/add"))?.body).toMatchObject({ submission_mode: "pending" });
    });

    it("only members create events; the answer says so", async () => {
      memberRoles = [];
      const { POST } = await loadElinor();
      const body = await (await POST(call("luma_create_event", { requestedBy: "987654321", name: "Talk", start: "2026-10-20T18:00:00+02:00", end: "2026-10-20T20:00:00+02:00" }))).json();
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toContain("Only members");
    });

    it("the read-only key can't act for anyone", async () => {
      const { POST } = await loadElinor();
      process.env.MCP_API_KEY = "secret";
      const body = await (await POST(mcpRequest({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "luma_add_event", arguments: { requestedBy: "1", event: "evt-x" } } }, "secret") as any)).json();
      expect(body.error.message).toContain("needs Elinor's key");
    });
  });
});
