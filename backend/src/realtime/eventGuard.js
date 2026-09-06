"use strict";

function consumeEventBudget(socket, name, limit, windowMs, now = Date.now()) {
    const budgets = socket.data.eventBudgets ?? new Map();
    socket.data.eventBudgets = budgets;
    const current = budgets.get(name);
    if (!current || current.resetAt <= now) {
        budgets.set(name, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
}

function canEmitTyping(socket, channelId, now = Date.now()) {
    const id = Number(channelId);
    return (
        Number.isInteger(id) &&
        id > 0 &&
        socket.rooms.has(`channel:${id}`) &&
        consumeEventBudget(socket, "typing", 15, 5_000, now)
    );
}

module.exports = { consumeEventBudget, canEmitTyping };
