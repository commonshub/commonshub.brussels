const nextJest = require("next/jest")

const createJestConfig = nextJest({
  dir: "./",
})

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(next-auth)/)",
  ],
  testEnvironment: "node", // Default to node for API tests
  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },
}

module.exports = createJestConfig(customJestConfig)
