import { NextResponse } from "next/server";
import { bindDeviceLive, getLiveStreamInfo } from "@/lib/imou";

// Force dynamic — env vars must be read at request time, not build time
export const dynamic = "force-dynamic";

export async function GET() {
  const DEVICE_ID = process.env.IMOU_DEVICE_ID || "";
  const CHANNEL_ID = process.env.IMOU_CHANNEL_ID || "0";

  console.log("[camera] IMOU_DEVICE_ID:", DEVICE_ID ? `${DEVICE_ID.slice(0, 4)}...` : "NOT SET");
  console.log("[camera] IMOU_APP_ID:", process.env.IMOU_APP_ID ? "set" : "NOT SET");
  console.log("[camera] IMOU_APP_SECRET:", process.env.IMOU_APP_SECRET ? "set" : "NOT SET");

  if (!DEVICE_ID) {
    return NextResponse.json(
      { error: "Camera not configured" },
      { status: 503 }
    );
  }

  try {
    // First, try to get existing live stream info
    let streamData;
    try {
      streamData = await getLiveStreamInfo(DEVICE_ID, CHANNEL_ID);
    } catch {
      // If no live stream exists, bind one first
      await bindDeviceLive(DEVICE_ID, CHANNEL_ID);
      streamData = await getLiveStreamInfo(DEVICE_ID, CHANNEL_ID);
    }

    const streams = streamData.streams || [];
    const hlsStream = streams.find((s) => s.hls);

    if (!hlsStream) {
      return NextResponse.json(
        { error: "No HLS stream available" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      url: hlsStream.hls,
      streamId: hlsStream.streamId,
    });
  } catch (error) {
    console.error("Camera stream error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get camera stream",
      },
      { status: 500 }
    );
  }
}
