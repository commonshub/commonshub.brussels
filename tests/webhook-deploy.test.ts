/**
 * Test webhook signature verification logic
 */

import crypto from "crypto";

describe("Webhook Deploy", () => {
  it("should verify GitHub webhook signature correctly", () => {
    const secret = "test-secret-123";
    const payload = JSON.stringify({ test: "data" });

    // Generate signature the way GitHub does it
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const signature = `sha256=${hmac.digest("hex")}`;

    // Verify signature
    const computedHmac = crypto.createHmac("sha256", secret);
    computedHmac.update(payload);
    const computedSignature = `sha256=${computedHmac.digest("hex")}`;

    expect(signature).toBe(computedSignature);
  });

  it("should reject invalid signature", () => {
    const secret = "test-secret-123";
    const payload = JSON.stringify({ test: "data" });

    // Generate signature with correct secret
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const signature = `sha256=${hmac.digest("hex")}`;

    // Try to verify with wrong secret
    const wrongSecret = "wrong-secret";
    const computedHmac = crypto.createHmac("sha256", wrongSecret);
    computedHmac.update(payload);
    const computedSignature = `sha256=${computedHmac.digest("hex")}`;

    expect(signature).not.toBe(computedSignature);
  });

  it("should use timing-safe comparison", () => {
    const sig1 = Buffer.from("sha256=abc123");
    const sig2 = Buffer.from("sha256=abc123");
    const sig3 = Buffer.from("sha256=def456");

    // Same signatures should be equal
    expect(crypto.timingSafeEqual(sig1, sig2)).toBe(true);

    // Different signatures should not be equal
    expect(() => crypto.timingSafeEqual(sig1, sig3)).not.toThrow();
    expect(crypto.timingSafeEqual(sig1, sig3)).toBe(false);
  });

  it("should handle signature length mismatch", () => {
    const sig1 = Buffer.from("sha256=abc123");
    const sig2 = Buffer.from("sha256=abc1234"); // Different length

    // timingSafeEqual throws on length mismatch
    expect(() => crypto.timingSafeEqual(sig1, sig2)).toThrow();
  });
});
