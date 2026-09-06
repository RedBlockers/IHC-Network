"use strict";

const mysql = require("mysql2/promise");

const config = require("../config");
const { logger, serializeError } = require("../logger");

const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: config.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    timezone: "Z",
    dateStrings: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    namedPlaceholders: false,
});

const LIMIT_PLACEHOLDER = /\b(LIMIT|OFFSET)\s+\?/i;

async function query(name, sql, params = [], connection = pool) {
    const startedAt = process.hrtime.bigint();
    try {
        const [rows] = LIMIT_PLACEHOLDER.test(sql)
            ? await connection.query(sql, params)
            : await connection.execute(sql, params);
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        if (durationMs >= config.SLOW_QUERY_MS) {
            logger.warn("requête lente", { query: name, durationMs: Math.round(durationMs) });
        }
        return rows;
    } catch (error) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        logger.error("échec de requête", {
            query: name,
            durationMs: Math.round(durationMs),
            sqlState: error.sqlState,
            errno: error.errno,
            error: serializeError(error),
        });
        throw error;
    }
}

async function queryOne(name, sql, params = [], connection = pool) {
    const rows = await query(name, sql, params, connection);
    return rows.length > 0 ? rows[0] : null;
}

async function withTransaction(fn) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback().catch((rollbackError) => {
            logger.error("échec du rollback", { error: serializeError(rollbackError) });
        });
        throw error;
    } finally {
        connection.release();
    }
}

async function ping() {
    const connection = await pool.getConnection();
    try {
        await connection.ping();
        return true;
    } finally {
        connection.release();
    }
}

async function close() {
    await pool.end();
}

const DUPLICATE_ENTRY = "ER_DUP_ENTRY";

module.exports = { pool, query, queryOne, withTransaction, ping, close, DUPLICATE_ENTRY };
