import * as path from "path";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

// Data type/provider path segments (consistent with calendars/ and finance/)
export const DISCORD_SUBDIR = path.join("channels", "discord");
export const DISCORD_URL_SEGMENT = "channels/discord";
