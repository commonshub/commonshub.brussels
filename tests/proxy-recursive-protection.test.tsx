/**
 * @jest-environment node
 */
/**
 * Test to ensure image proxy rejects recursive proxying attempts
 * Tests the route handler directly without requiring a running server
 */

import { GET } from "../src/app/api/image-proxy/route";
import { NextRequest } from "next/server";

describe("Image Proxy Recursive Protection", () => {
  it("should reject image-proxy URLs being passed to image-proxy", async () => {
    const proxyUrl =
      "http://localhost:3000/api/image-proxy?url=https://example.com/image.jpg";

    const request = new NextRequest(
      `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(proxyUrl)}`
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Cannot proxy a proxy URL");
  });
});
