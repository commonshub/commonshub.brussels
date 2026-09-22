/**
 * Event descriptions come from other people's calendars — Luma, Google, a
 * pasted newsletter — and now and then arrive as HTML rather than text. The
 * site renders descriptions as text, so a stray `<a href="…">` would show up
 * literally on the card. This turns such a description back into the plain
 * text the author meant.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * True when the text carries markup, not just a stray "<" in prose. A tag
 * cut off before its ">" (a description truncated mid-attribute) counts too.
 */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value) || /<[a-z][a-z0-9]*(\s+[a-z-]+(=("[^"]*"?|'[^']*'?|[^\s>]*))?)*\s*$/i.test(value);
}

/**
 * HTML → plain text, keeping what a reader would keep: link text (or the
 * address when the text is the address), line breaks for block elements,
 * and decoded entities. Plain text passes through untouched.
 */
export function htmlToPlainText(value: string): string {
  if (!value || !looksLikeHtml(value)) return value;

  const text = value
    .replace(/\r\n/g, "\n")
    // A link keeps its text; when the text is empty or is the address itself,
    // the address stands alone rather than twice.
    .replace(/<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, "").trim();
      if (!label) return href;
      const same = label.replace(/\/$/, "") === href.replace(/\/$/, "") || href.endsWith(label);
      return same ? href : `${label} (${href})`;
    })
    // An anchor that was cut off before its closing tag (a truncated
    // description) still has an address worth keeping; the dangling text
    // is usually the start of that same address.
    .replace(/<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([^<]*)$/i, (_, href: string, tail: string) => {
      const label = tail.trim();
      return !label || href.startsWith(label) ? href : `${label} (${href})`;
    })
    // A tag cut off before its ">" (no closing bracket anywhere after it):
    // keep the address if the fragment got that far, otherwise drop it.
    .replace(/<[a-z][^<>]*$/i, (fragment: string) => {
      const href = fragment.match(/href=["']?([^"'\s>]+)/i);
      return href ? href[1] : "";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Room bookings arrive with the organiser's contact details in the
 * description ("Jane Doe, jane@example.com, +32 4xx"). Those are for the
 * stewards, not for a public event card. A line that held nothing but a
 * contact detail disappears with it.
 */
export function redactContactDetails(value: string): string {
  const scrub = (line: string) =>
    line
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
      .replace(/(?:\+|00)\d[\d\s().\/-]{7,}\d/g, "")
      .replace(/(?<!\d)0\d(?:[\s.\/-]?\d{2,3}){3,4}(?!\d)/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([,.;:])/g, "$1")
      .trim();

  const lines: string[] = [];
  for (const raw of value.split("\n")) {
    const line = scrub(raw);
    if (line === "" && raw.trim() !== "") continue; // only a contact detail was here
    if (line === "" && lines[lines.length - 1] === "") continue; // keep one blank at most
    lines.push(line);
  }
  return lines.join("\n").trim();
}

/**
 * A URL as a reader should see it: without the protocol, and — when it is
 * long — the host plus its first path segment only.
 *
 * A URL is a single unbreakable word. A Discord message link is about ninety
 * characters, which is wider than a phone screen, so a description carrying
 * one pushed the whole day page sideways. Cutting at a path boundary keeps
 * what tells you where the link goes and drops the ids that tell you
 * nothing.
 */
export function shortenUrl(url: string, maxLength = 32): string {
  const bare = url.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/+$/, "");
  if (bare.length <= maxLength) return bare;
  const [host, ...segments] = bare.split("/");
  const first = segments.find(Boolean);
  const head = first && `${host}/${first}`.length <= maxLength ? `${host}/${first}` : host;
  return `${head}/…`;
}

/** Every URL inside a piece of text, shortened for display. */
export function shortenUrls(value: string, maxLength = 32): string {
  return value.replace(/\bhttps?:\/\/[^\s<>"']+/gi, (match) => {
    // A URL at the end of a sentence keeps the punctuation out of the link.
    const trailing = match.match(/[.,;:!?)\]]+$/)?.[0] ?? "";
    return shortenUrl(trailing ? match.slice(0, -trailing.length) : match, maxLength) + trailing;
  });
}

/**
 * The token is called "tokens" in everything we publish. The booking bot
 * writes "1.50 CHT" into the calendar entry it creates, so that ticker
 * reaches the site through other people's descriptions; this puts our own
 * wording back. Only the standalone ticker is touched, never a word that
 * merely contains those letters.
 */
export function tokensWording(value: string): string {
  return value.replace(/\bCHT\b/g, "tokens");
}
