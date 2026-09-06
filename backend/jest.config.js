"use strict";

module.exports = {
    testEnvironment: "node",
    setupFiles: ["<rootDir>/tests/setup-env.js"],
    setupFilesAfterEnv: ["<rootDir>/tests/setup-after.js"],
    clearMocks: true,
    collectCoverageFrom: ["src/**/*.js", "!src/server.js", "!src/db/migrate.js"],
    coverageThreshold: {
        global: { branches: 60, functions: 70, lines: 70, statements: 70 },
    },
    testMatch: ["<rootDir>/tests/**/*.test.js"],
};
