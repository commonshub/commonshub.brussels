import "@testing-library/jest-dom";

// Polyfill fetch for Node.js test environment
// jest-environment-jsdom should provide fetch, but ensure it's available
if (typeof global.fetch === "undefined") {
  // Try to use globalThis.fetch (Node.js 18+)
  if (typeof globalThis.fetch !== "undefined") {
    global.fetch = globalThis.fetch;
  } else {
    // Fallback: use node-fetch
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fetch = require("node-fetch");
    global.fetch = fetch.default || fetch;
  }
}
