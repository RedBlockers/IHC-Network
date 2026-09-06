"use strict";

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    js.configs.recommended,
    {
        files: ["eslint.config.js", "jest.config.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: { ...globals.node },
        },
    },
    {
        files: ["src/**/*.js", "tests/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: { ...globals.node },
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "no-var": "error",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "prefer-const": "error",
            eqeqeq: ["error", "smart"],
            "no-throw-literal": "error",
            "no-return-await": "error",
            "require-atomic-updates": "error",
        },
    },
    {
        files: ["tests/**/*.js"],
        languageOptions: {
            globals: { ...globals.node, ...globals.jest },
        },
    },
];
