/**
 * Test to ensure image proxy rejects recursive proxying attempts
 */

describe("Image Proxy Recursive Protection", () => {
  it("should reject discord-proxy URLs being passed to image-proxy", async () => {
    const proxyUrl =
      "http://localhost:3000/api/discord-image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251127";

    const response = await fetch(
      `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(proxyUrl)}`
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Cannot proxy a proxy URL");
  });

  it("should reject image-proxy URLs being passed to image-proxy", async () => {
    const proxyUrl =
      "http://localhost:3000/api/image-proxy?url=https://example.com/image.jpg";

    const response = await fetch(
      `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(proxyUrl)}`
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Cannot proxy a proxy URL");
  });
});
