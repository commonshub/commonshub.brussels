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

/** True when the text carries markup, not just a stray "<" in prose. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
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
