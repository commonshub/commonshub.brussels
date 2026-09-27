import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

import { formatEventWhen } from "@/lib/event-dates";
import { getHostedEvent, hostedEvents } from "@/lib/hosted-events";

export const runtime = "nodejs";
export const alt = "Event at the Commons Hub Brussels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return hostedEvents.map((event) => ({ slug: event.slug }));
}

/** The cover as a data URL: from public/ for local paths, fetched otherwise. */
async function loadCover(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    if (src.startsWith("/")) {
      const file = await readFile(join(process.cwd(), "public", src));
      const type = src.endsWith(".png") ? "image/png" : "image/jpeg";
      return `data:${type};base64,${file.toString("base64")}`;
    }
    const response = await fetch(src);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") || "image/png";
    // Satori renders PNG and JPEG only.
    if (!/png|jpe?g/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** "1200 / 630" -> 1.9; square when unset, like the event page. */
function coverRatio(aspect: string | undefined): number {
  const [w, h] = (aspect || "1 / 1").split("/").map((n) => parseFloat(n));
  return w > 0 && h > 0 ? w / h : 1;
}

function Logo({ size: px }: { size: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 500 500">
      <rect width="500" height="500" rx="250" fill="#FF4C02" />
      <path
        d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
        fill="#FBF4F2"
      />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getHostedEvent(slug);
  const cover = await loadCover(event?.coverImage);
  // A shared link outlives the year, so the image always says which one.
  const when = event ? formatEventWhen(event.startAt, event.endAt, new Date(0)) : "";
  const title = event?.name ?? "Commons Hub Brussels";

  // A cover already made for sharing (e.g. 1200 × 630) is used as it is.
  if (cover && coverRatio(event?.coverAspectRatio) >= 1.8) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
          <img src={cover} width={1200} height={630} style={{ objectFit: "cover" }} />
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FBF4F2" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 48px 44px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: "#FF4C02" }}>
            <Logo size={52} />
            Commons Hub Brussels
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: title.length > 24 ? 52 : 60, lineHeight: 1.1, color: "#1a1a1a" }}>{title}</div>
            {event?.tagline && (
              <div style={{ fontSize: 24, lineHeight: 1.35, color: "#555" }}>{event.tagline}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 24 }}>
            {when && <div style={{ color: "#FF4C02" }}>{when}</div>}
            <div style={{ color: "#555" }}>Rue de la Madeleine 51, Brussels</div>
          </div>
        </div>
        {cover && (
          <div style={{ width: 630, height: 630, display: "flex", background: "#1a1a1a" }}>
            <img src={cover} width={630} height={630} style={{ objectFit: "cover" }} />
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
