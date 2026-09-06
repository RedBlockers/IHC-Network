"use strict";

const crypto = require("node:crypto");
const webpush = require("web-push");

const pushRepository = require("../repositories/pushRepository");
const config = require("../config");
const { BadRequest, NotFound, ServiceUnavailable } = require("../errors");
const { logger, serializeError } = require("../logger");

const MAX_FAILURES = 5;

const enabled = () => Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);

if (enabled()) {
    webpush.setVapidDetails(
        config.VAPID_SUBJECT || "mailto:contact@qweillo.local",
        config.VAPID_PUBLIC_KEY,
        config.VAPID_PRIVATE_KEY
    );
}

const hash = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("hex");

function publicKey() {
    if (!enabled()) {
        throw new ServiceUnavailable("Les notifications poussées ne sont pas configurées sur ce service.");
    }
    return { publicKey: config.VAPID_PUBLIC_KEY };
}

async function subscribe(user, subscription, deviceLabel) {
    if (!enabled()) {
        throw new ServiceUnavailable("Les notifications poussées ne sont pas configurées sur ce service.");
    }

    const endpoint = String(subscription?.endpoint ?? "");
    const p256dh = String(subscription?.keys?.p256dh ?? "");
    const auth = String(subscription?.keys?.auth ?? "");
    if (!endpoint || !p256dh || !auth) throw new BadRequest("Abonnement incomplet.");

    await pushRepository.upsert({
        userId: user.userId,
        endpoint,
        endpointHash: hash(endpoint),
        p256dh,
        auth,
        deviceLabel: String(deviceLabel ?? "").slice(0, 120),
    });

    return { subscribed: true };
}

async function unsubscribe(user, endpoint) {
    const { affectedRows } = await pushRepository.remove(hash(String(endpoint ?? "")), user.userId);
    if (!affectedRows) throw new NotFound("Abonnement introuvable.");
    return { subscribed: false };
}

async function list(userId) {
    const rows = await pushRepository.listForUser(userId);
    return rows.map((row) => ({
        endpointHash: crypto.createHash("sha256").update(row.endpoint).digest("hex"),
        deviceLabel: row.deviceLabel || "Appareil inconnu",
        createdAt: row.createdAt,
        lastSentAt: row.lastSentAt,
    }));
}

async function deliver(userId, notification) {
    if (!enabled()) return { sent: 0 };

    const rows = await pushRepository.listForUser(userId).catch(() => []);
    if (rows.length === 0) return { sent: 0 };

    const payload = JSON.stringify({
        title: notification.title,
        body: notification.summary,
        url: notification.url ?? "/",
        tag: `qweillo-${notification.type}`,
    });

    const results = await Promise.all(
        rows.map(async (row) => {
            try {
                await webpush.sendNotification(
                    { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
                    payload
                );
                await pushRepository.recordSuccess(row.subscriptionId);
                return true;
            } catch (error) {
                const gone = error?.statusCode === 404 || error?.statusCode === 410;
                if (gone) {
                    await pushRepository.removeByHash(hash(row.endpoint)).catch(() => {});
                    return false;
                }

                await pushRepository.recordFailure(row.subscriptionId).catch(() => {});
                if (Number(row.failures) + 1 >= MAX_FAILURES) {
                    await pushRepository.removeByHash(hash(row.endpoint)).catch(() => {});
                }
                logger.warn("notification poussée non délivrée", {
                    statusCode: error?.statusCode ?? null,
                    error: serializeError(error),
                });
                return false;
            }
        })
    );

    return { sent: results.filter(Boolean).length };
}

module.exports = { enabled, publicKey, subscribe, unsubscribe, list, deliver, MAX_FAILURES };
