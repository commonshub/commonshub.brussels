import { MUTED, s } from "./screen"

/**
 * The call to action every big-screen page ends with, bottom right: a line or
 * two of text and a QR code to the public page.
 */
export function ScreenQr({ qrSvg, cta, url }: { qrSvg: string; cta: string; url: string }) {
  return (
    <div className="flex shrink-0 items-center" style={{ gap: s(1.2) }}>
      <div className="text-right" style={{ fontSize: s(1.5), lineHeight: 1.25 }}>
        <div style={{ fontWeight: 700, fontSize: s(2) }}>{cta}</div>
        <div style={{ color: MUTED }}>{url.replace(/^https:\/\//, "")}</div>
      </div>
      <div className="rounded-[0.4em] bg-white" style={{ width: s(7.5), height: s(7.5), padding: s(0.6) }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
    </div>
  )
}
