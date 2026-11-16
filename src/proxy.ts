import { type NextRequest, NextResponse } from "next/server"

import { pickLang } from "@/lib/vat-i18n"

/**
 * /2023-2024 is cached per language (ISR), so the language cannot be read
 * inside the page: it is picked here, from ?lang=, the lang cookie or the
 * browser, and the request is served from /2023-2024/en or /2023-2024/fr.
 * The address in the browser does not change.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  if (url.pathname === "/2023-2024/winbooks") {
    url.pathname = "/2023-2024/en/winbooks"
  } else {
    const lang = pickLang(url.searchParams.get("lang"), request.cookies.get("lang")?.value, request.headers.get("accept-language"))
    url.pathname = `/2023-2024/${lang}`
  }
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ["/2023-2024", "/2023-2024/winbooks"],
}
