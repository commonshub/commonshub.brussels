import { Fragment } from "react"

const URL = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g

/** Text with its web addresses as links, shown without "https://" (a note's "https://bread.coop" reads "bread.coop"). */
export function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(URL)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    parts.push(
      <a key={i} href={m[0]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">
        {m[0].replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </a>,
    )
    last = i + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
