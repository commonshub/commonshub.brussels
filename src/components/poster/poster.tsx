/**
 * Shared pieces for printable posters (/fridge/poster, /membership/poster):
 * black on white to save ink, sized in a unit that is 1mm on an A4 sheet
 * (1/√2 of it on A5) and shrinks on screen so the preview fits a phone.
 */

/** The hub's asterisk, drawn as an outline so a poster takes little ink. */
export function PosterLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="80 80 340 340" className={className} aria-hidden="true">
      <path
        d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
        fill="none"
        stroke="#000"
        strokeWidth="14"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** `u(12)` = 12 poster millimetres. */
export const u = (n: number) => `calc(var(--u) * ${n})`

/** Print CSS: one page of the given size, only the poster visible, nothing else printed. */
export function posterPrintCss(size: "A4" | "A5" = "A4"): string {
  return `
    .poster { --u: min(1mm, calc((100vw - 32px) / 210)); }
    @page { size: ${size} portrait; margin: 0; }
    @media print {
      .poster { --u: ${size === "A5" ? "0.7071mm" : "1mm"}; }
      html, body { background: #fff !important; height: auto !important; min-height: 0 !important; }
      header, footer, .print\\:hidden { display: none !important; }
      main { min-height: 0 !important; padding: 0 !important; }
      body * { visibility: hidden !important; }
      .poster, .poster * { visibility: visible !important; }
      .poster-sheet { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
      .poster { box-shadow: none !important; outline: 0 !important; --tw-ring-shadow: 0 0 #0000 !important; height: calc(var(--u) * 296) !important; overflow: hidden; break-after: avoid; page-break-after: avoid; }
    }
  `
}
