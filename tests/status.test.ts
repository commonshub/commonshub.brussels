/**
 * Test status endpoint
 */

describe("Status Endpoint", () => {
  it("should return valid status structure", async () => {
    const response = await fetch("http://localhost:3000/status.json");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");

    // Check deployment info
    expect(data.deployment).toBeDefined();
    expect(data.deployment.sha).toBeDefined();
    expect(data.deployment.shortSha).toBeDefined();
    expect(data.deployment.message).toBeDefined();
    expect(data.deployment.sha.length).toBeGreaterThan(0);
    expect(data.deployment.shortSha.length).toBe(7);

    // Check uptime info
    expect(data.uptime).toBeDefined();
    expect(data.uptime.started).toBeDefined();
    expect(data.uptime.startedFormatted).toBeDefined();
    expect(data.uptime.uptime).toBeDefined();
    expect(typeof data.uptime.uptimeSeconds).toBe("number");

    // Check server info
    expect(data.server).toBeDefined();
    expect(data.server.time).toBeDefined();
    expect(data.server.timeFormatted).toBeDefined();
    expect(data.server.timezone).toBeDefined();

    // Check environment
    expect(data.environment).toBeDefined();
  });

  it("should format uptime correctly", () => {
    const testCases = [
      { seconds: 30, expected: "30s" },
      { seconds: 90, expected: "1m 30s" },
      { seconds: 3661, expected: "1h 1m 1s" },
      { seconds: 86401, expected: "1d 0h 0m 1s" },
    ];

    // This tests the logic, not the actual API response
    testCases.forEach(({ seconds, expected }) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      let formatted = "";
      if (days > 0) formatted += `${days}d `;
      if (hours > 0 || days > 0) formatted += `${hours}h `;
      if (minutes > 0 || hours > 0) formatted += `${minutes}m `;
      formatted += `${secs}s`;

      expect(formatted.trim()).toBe(expected);
    });
  });

  it("should have consistent timezone", async () => {
    const response = await fetch("http://localhost:3000/status.json");
    const data = await response.json();

    // Should use TZ env var or default to Europe/Brussels
    expect(["Europe/Brussels", process.env.TZ].filter(Boolean)).toContain(
      data.server.timezone
    );
  });
});
