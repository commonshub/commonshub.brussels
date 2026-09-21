import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

/**
 * Which dataset files may be served. Only images, and only from places
 * meant for everyone: the `public/` audience tier (event covers live in
 * `YYYY/MM/public/events/images/`), and — until chb copies them into a
 * tier — the Discord attachments it downloaded under
 * `YYYY/MM/providers/discord/images/`. Nothing else under /data is a served
 * surface: not `members/`, not `stewards/`, not the raw provider archives.
 */
export function isServableDataPath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return false;
  if (!IMAGE_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) return false;
  const [year, second, third] = parts;
  if (year === "latest") return second === "public";
  if (!/^\d{4}$/.test(year)) return false;
  if (second === "public") return true;
  if (/^\d{2}$/.test(second) && third === "public") return true;
  return /^\d{2}$/.test(second) && third === "providers" && parts[3] === "discord" && parts[4] === "images" && parts.length === 6;
}

