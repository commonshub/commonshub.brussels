import crypto from "crypto";

const IMOU_API_URL = "https://openapi.easy4ip.com";

interface ImouSystemParams {
  ver: string;
  sign: string;
  appId: string;
  time: number;
  nonce: string;
}

interface ImouApiResponse {
  result: {
    code: string;
    msg: string;
    data?: Record<string, unknown>;
  };
  id: string;
}

function buildSystemParams(): ImouSystemParams {
  const appId = process.env.IMOU_APP_ID;
  const appSecret = process.env.IMOU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("IMOU_APP_ID and IMOU_APP_SECRET must be set");
  }

  const time = Math.round(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const sign = crypto
    .createHash("md5")
    .update(`time:${time},nonce:${nonce},appSecret:${appSecret}`)
    .digest("hex");

  return { ver: "1.0", sign, appId, time, nonce };
}

async function callImouApi(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const system = buildSystemParams();
  const id = crypto.randomUUID();

  const response = await fetch(`${IMOU_API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, params, id }),
  });

  if (!response.ok) {
    throw new Error(`Imou API HTTP ${response.status}`);
  }

  const body = (await response.json()) as ImouApiResponse;

  if (body.result.code !== "0") {
    throw new Error(`Imou API error: ${body.result.code} - ${body.result.msg}`);
  }

  return body.result.data || {};
}

// Cache the access token (valid for a while)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const data = await callImouApi("/openapi/accessToken", {});
  const token = data.accessToken as string;

  // Cache for 6 hours (tokens typically last 7 days, but refresh often)
  cachedToken = { token, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return token;
}

export async function bindDeviceLive(
  deviceId: string,
  channelId: string = "0"
): Promise<{ streams: unknown }> {
  const token = await getAccessToken();
  const data = await callImouApi("/openapi/bindDeviceLive", {
    token,
    deviceId,
    channelId,
  });
  return data as { streams: unknown };
}

export async function getLiveStreamInfo(
  deviceId: string,
  channelId: string = "0"
): Promise<{ streams: Array<{ hls: string; streamId: number }> }> {
  const token = await getAccessToken();
  const data = await callImouApi("/openapi/getLiveStreamInfo", {
    token,
    deviceId,
    channelId,
  });
  return data as { streams: Array<{ hls: string; streamId: number }> };
}
