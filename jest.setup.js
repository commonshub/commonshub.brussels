import "@testing-library/jest-dom";
import path from "path";

// Set DATA_DIR to tests/data for all tests
process.env.DATA_DIR = path.join(process.cwd(), "tests/data");

// Mock next-auth/react globally to avoid ESM import issues
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: "unauthenticated",
    update: jest.fn(),
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}));

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
