"use strict";

const handlers = new Map();
let transactionDepth = 0;

function on(name, value) {
    handlers.set(name, typeof value === "function" ? value : () => value);
}

function reset() {
    handlers.clear();
}

async function run(name, params, sql, connection) {
    const handler = handlers.get(name);
    if (!handler) throw new Error(`db mock : aucune réponse branchée pour l'opération « ${name} »`);
    return handler(params, sql, connection);
}

async function query(name, sql, params = [], connection) {
    const result = await run(name, params, sql, connection);
    return result ?? [];
}

async function queryOne(name, sql, params = [], connection) {
    const result = await run(name, params, sql, connection);
    if (Array.isArray(result)) return result[0] ?? null;
    return result ?? null;
}

async function withTransaction(fn) {
    transactionDepth += 1;
    try {
        return await fn({ __txn: true });
    } finally {
        transactionDepth -= 1;
    }
}

const isTransactionActive = () => transactionDepth > 0;

const ping = async () => true;
const close = async () => {};

const mock = {
    pool: {},
    query,
    queryOne,
    withTransaction,
    ping,
    close,
    DUPLICATE_ENTRY: "ER_DUP_ENTRY",
};

module.exports = { mock, on, reset, isTransactionActive };
