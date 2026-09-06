"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");
const { createLogger, format, transports } = require("winston");

const config = require("./config");

const requestContext = new AsyncLocalStorage();

const injectRequestId = format((info) => {
    const store = requestContext.getStore();
    if (store?.requestId) info.requestId = store.requestId;
    return info;
});

const prettyFormat = format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const head = `${timestamp} ${level.toUpperCase().padEnd(5)}${requestId ? ` [${requestId.slice(0, 8)}]` : ""} ${message}`;
    const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return head + rest;
});

const logger = createLogger({
    level: config.LOG_LEVEL,
    silent: config.isTest,
    format: format.combine(
        injectRequestId(),
        format.timestamp(),
        format.errors({ stack: true }),
        config.LOG_FORMAT === "json" ? format.json() : prettyFormat
    ),
    transports: [new transports.Console()],
});

function withRequestId(requestId, fn) {
    return requestContext.run({ requestId }, fn);
}

function currentRequestId() {
    return requestContext.getStore()?.requestId;
}

function serializeError(error) {
    if (!(error instanceof Error)) return { message: String(error) };
    return {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
        ...(error.cause ? { cause: serializeError(error.cause) } : {}),
    };
}

module.exports = { logger, withRequestId, currentRequestId, serializeError };
