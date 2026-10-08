import { describe, expect, test } from "@jest/globals"

import { publicOrigin } from "@/lib/public-origin"

const req = (headers: Record<string, string>) => new Request("https://0.0.0.0:3000/api/x", { headers })

describe("the site's public address, behind the proxy", () => {
  test("from the forwarded or Host header, never the container's own address", () => {
    expect(publicOrigin(req({ host: "0.0.0.0:3000", "x-forwarded-host": "commonshub.brussels", "x-forwarded-proto": "https" }))).toBe("https://commonshub.brussels")
    expect(publicOrigin(req({ host: "commonshub.brussels" }))).toBe("https://commonshub.brussels")
    expect(publicOrigin(req({ host: "localhost:3471" }))).toBe("http://localhost:3471")
    expect(publicOrigin(req({ host: "0.0.0.0:3000" }))).toBe("https://commonshub.brussels")
  })
})
