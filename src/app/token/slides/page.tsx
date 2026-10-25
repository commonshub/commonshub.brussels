import type { Metadata } from "next"

import { TokenSlides } from "./slides"

export const metadata: Metadata = {
  title: "The Commons Hub Token (slides) | Commons Hub Brussels",
  description: "How members earn tokens by taking care of the community, and what they use them for, as slides.",
}

export default function TokenSlidesPage() {
  return <TokenSlides />
}
