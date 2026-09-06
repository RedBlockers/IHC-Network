"use strict";

const crypto = require("node:crypto");

const { withRequestId } = require("../logger");

function requestContext(req, res, next) {
    const incoming = req.headers["x-request-id"];
    const requestId = typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();

    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);

    withRequestId(requestId, () => next());
}

module.exports = requestContext;
