import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { dataCacheHeaders } from "@/lib/data-route";
import { OPENDATA_LICENSE, listOpendataPeriod, listOpendataPeriods, resolveOpendata } from "@/lib/opendata";
import { OPENDATA_ANNOTATION_KINDS, OPENDATA_UPSTREAM_ISSUES, loadOpendataAnnotations } from "@/lib/opendata-annotations";
import { OPENDATA_MONTHLY_FIELDS, buildOpendataMonthly, opendataCoverage } from "@/lib/opendata-monthly";
import { opendataSkill } from "@/lib/opendata-skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://commonshub.brussels";

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Open data is meant to be reused from anywhere, browsers included. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Link",
  Link: `<${OPENDATA_LICENSE.url}>; rel="license"`,
};

function json(body: unknown, hasContent: boolean, status = 200) {
  return NextResponse.json(body, { status, headers: { ...CORS, ...dataCacheHeaders(hasContent) } });
}

function notFound(message: string) {
  return json({ error: message, help: `${BASE_URL}/opendata` }, false, 404);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const segments = (await params).path ?? [];
  const target = resolveOpendata(segments);
  if (!target) return notFound("Not part of the open dataset");

  if (target.kind === "skill") {
    return new NextResponse(opendataSkill(BASE_URL), {
      headers: { ...CORS, "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  }

  if (target.kind === "index") {
    const periods = listOpendataPeriods();
    return json(
      {
        description: "Commons Hub Brussels open data: the public tier of the chb dataset.",
        documentation: `${BASE_URL}/opendata`,
        license: OPENDATA_LICENSE,
        latest: `${BASE_URL}/opendata/latest`,
        monthly: `${BASE_URL}/opendata/monthly.json`,
        annotations: `${BASE_URL}/opendata/annotations.json`,
        periods: periods.map((p) => ({
          year: p.year,
          href: `${BASE_URL}/opendata/${p.year}`,
          months: p.months.map((m) => ({ month: m, href: `${BASE_URL}/opendata/${p.year}/${m}` })),
        })),
      },
      periods.length > 0
    );
  }

  if (target.kind === "monthly") {
    const all = buildOpendataMonthly(BASE_URL);
    const months = target.year ? all.filter((m) => m.month.startsWith(`${target.year}-`)) : all;
    if (months.length === 0) return notFound(`No open data for ${target.year ?? "any period"}`);
    return json(
      {
        description: "Commons Hub Brussels open data, one row per month. Sections are null when the month has no such file.",
        documentation: `${BASE_URL}/opendata`,
        license: OPENDATA_LICENSE,
        ...(target.year ? { year: target.year } : {}),
        fields: OPENDATA_MONTHLY_FIELDS,
        coverage: opendataCoverage(all),
        months,
      },
      true
    );
  }

  if (target.kind === "annotations") {
    return json(
      {
        description: "Known one-off events in the Commons Hub Brussels open data, per month and monthly.json section. Also attached to monthly.json rows as notes.",
        documentation: `${BASE_URL}/opendata`,
        license: OPENDATA_LICENSE,
        kinds: OPENDATA_ANNOTATION_KINDS,
        annotations: loadOpendataAnnotations(),
        upstreamIssues: OPENDATA_UPSTREAM_ISSUES,
      },
      true
    );
  }

  if (target.kind === "listing") {
    const files = listOpendataPeriod(target.period, BASE_URL);
    if (files.length === 0) return notFound(`No open data for ${target.label}`);
    return json({ period: target.label, files }, true);
  }

  try {
    const st = fs.statSync(target.fsPath);
    if (!st.isFile()) return notFound(`${target.file} not found`);
    const body = fs.readFileSync(target.fsPath);
    const type = CONTENT_TYPES[path.extname(target.fsPath).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(body, {
      headers: {
        ...CORS,
        ...dataCacheHeaders(true),
        "Content-Type": type,
        "Content-Length": String(st.size),
        "Last-Modified": st.mtime.toUTCString(),
      },
    });
  } catch {
    return notFound(`${target.file} not found`);
  }
}
