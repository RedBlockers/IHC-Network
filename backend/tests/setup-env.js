"use strict";

process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.JWT_SECRET = "x".repeat(48);
process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_DATABASE = "qweillo_test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.REDIS_URL = "";
process.env.METRICS_ENABLED = "false";
process.env.S3_ENDPOINT = "";
process.env.LIVEKIT_URL = "wss://media.qweillo.test";
process.env.LIVEKIT_API_KEY = "qweillo-test-key";
process.env.LIVEKIT_API_SECRET = "y".repeat(48);
process.env.LIVEKIT_TOKEN_TTL_SECONDS = "300";

process.env.MAINTENANCE_FILE = require("node:path").join(
    require("node:os").tmpdir(),
    `qweillo-maintenance-test-${process.pid}`
);
