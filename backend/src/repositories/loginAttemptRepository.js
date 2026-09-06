"use strict";

const { query } = require("../db/pool");

const loginAttemptRepository = {
    record: (ip, handle, connection) =>
        query("loginAttempts.record", "INSERT INTO login_attempts (ip, handle) VALUES (?, ?)", [ip, handle], connection),

    purgeOlderThan: (windowMinutes, connection) =>
        query(
            "loginAttempts.purge",
            "DELETE FROM login_attempts WHERE attemptedAt < (NOW() - INTERVAL ? MINUTE)",
            [windowMinutes],
            connection
        ),
};

module.exports = loginAttemptRepository;
