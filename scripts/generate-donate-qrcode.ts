/**
 * Generates public/images/donate-qrcode.png: an EPC069-12 SEPA transfer QR
 * code built from src/lib/bank-details.ts, with a phone + bank icon in the
 * middle.
 *
 * Usage: bun run generate:donate-qrcode
 */
import path from "node:path"
import QRCode from "qrcode"
import sharp from "sharp"

import { epcQrPayload } from "../src/lib/bank-details"

const OUTPUT = path.join(
  __dirname,
  "..",
  "public",
  "images",
  "donate-qrcode.png"
)
const SIZE_PX = 1095
const QUIET_ZONE = 2 // modules
const ACCENT = "#f04e23"
const DARK = "#3a3a3a"

// Width of the cleared centre area, in modules. With error correction "H"
// (30% recoverable) this stays well within limits.
const LOGO_FRACTION = 0.3

// Tiny stylised QR code shown on the phone screen: three finder patterns and
// a fixed data pattern on a 17x17 grid. Cells covered by a finder or its
// light separator must stay empty.
const MINI_QR_DATA = [
  "........##.......",
  "........#........",
  ".......##........",
  ".......#.#.......",
  "........##.......",
  ".......#.#.......",
  ".......##........",
  "..#.##..#.##..##.",
  "##..#.##.#..##.#.",
  ".#.#..#.####..#.#",
  "........#..##...#",
  ".........#.##.#..",
  ".......#.##..###.",
  ".......##.#.#..##",
  "........#.###.#..",
  ".......##..#..##.",
  ".......#.#.#.#.##",
]

function miniQrSvg(x: number, y: number, size: number): string {
  const grid = MINI_QR_DATA.length
  const u = size / grid
  const cell = (c: number, r: number, w = 1, h = 1, fill = DARK) =>
    `<rect x="${x + c * u}" y="${y + r * u}" width="${w * u}" height="${h * u}" fill="${fill}"/>`
  // 6x6 finder: dark ring, light ring, 2x2 dark centre
  const finder = (c: number, r: number) =>
    cell(c, r, 6, 6) +
    cell(c + 1, r + 1, 4, 4, "#fff") +
    cell(c + 2, r + 2, 2, 2)

  let data = ""
  MINI_QR_DATA.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === "#") data += cell(c, r)
    })
  )
  return finder(0, 0) + finder(grid - 6, 0) + finder(0, grid - 6) + data
}

function iconSvg(x: number, y: number, size: number): string {
  // Drawn in a 100x100 box, then scaled into place.
  const s = size / 100
  const qr = miniQrSvg(30, 31, 30)

  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="22" y="4" width="46" height="84" rx="7" fill="${DARK}"/>
    <rect x="25.5" y="13" width="39" height="66" rx="2" fill="#fff"/>
    <rect x="39" y="7.5" width="12" height="2" rx="1" fill="#fff"/>
    <rect x="39" y="82" width="12" height="2.5" rx="1.25" fill="#fff"/>
    <g fill="none" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round">
      <path d="M28 31v-4h4M58 27h4v4M62 61v4h-4M32 65h-4v-4"/>
    </g>
    ${qr}
    <line x1="28" y1="46" x2="62" y2="46" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="68" cy="72" r="15" fill="${ACCENT}" stroke="#fff" stroke-width="2.5"/>
    <g fill="#fff">
      <path d="M68 62.5l9 4.5h-18z"/>
      <rect x="59" y="68" width="18" height="1.8"/>
      <rect x="61" y="70.5" width="2.4" height="7"/>
      <rect x="66.8" y="70.5" width="2.4" height="7"/>
      <rect x="72.6" y="70.5" width="2.4" height="7"/>
      <rect x="59" y="78.2" width="18" height="2"/>
    </g>
  </g>`
}

async function main() {
  const payload = epcQrPayload()
  const qr = QRCode.create(payload, { errorCorrectionLevel: "H" })
  const count = qr.modules.size
  const total = count + QUIET_ZONE * 2

  // Odd-sized, centred hole so it lines up with the module grid.
  let hole = Math.round(count * LOGO_FRACTION)
  if (hole % 2 !== count % 2) hole += 1
  const holeStart = (count - hole) / 2
  const inHole = (r: number, c: number) =>
    r >= holeStart &&
    r < holeStart + hole &&
    c >= holeStart &&
    c < holeStart + hole

  let modulesPath = ""
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c) && !inHole(r, c)) {
        modulesPath += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`
      }
    }
  }

  const iconPadding = 0.6
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${SIZE_PX}" height="${SIZE_PX}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#fff"/>
  <path d="${modulesPath}" fill="#000"/>
  <g shape-rendering="geometricPrecision">
    ${iconSvg(
      holeStart + QUIET_ZONE + iconPadding,
      holeStart + QUIET_ZONE + iconPadding,
      hole - iconPadding * 2
    )}
  </g>
</svg>`

  await sharp(Buffer.from(svg)).png().toFile(OUTPUT)
  console.log(
    `Wrote ${OUTPUT} (QR version ${qr.version}, ${count}x${count} modules)`
  )
  console.log(`Payload:\n${payload}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
