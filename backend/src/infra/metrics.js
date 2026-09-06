"use strict";

const client = require("prom-client");

const registry = new client.Registry();
registry.setDefaultLabels({ service: "qweillo-backend" });
client.collectDefaultMetrics({ register: registry });

const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Durée des requêtes HTTP",
    labelNames: ["method", "route", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
});

const messagesSent = new client.Counter({
    name: "messages_sent_total",
    help: "Nombre de messages persistés et diffusés",
    registers: [registry],
});

const socketsConnected = new client.Gauge({
    name: "socket_connections_active",
    help: "Sockets temps réel actuellement connectées à cette instance",
    registers: [registry],
});

function httpMetricsMiddleware(req, res, next) {
    const end = httpDuration.startTimer();
    res.on("finish", () => {
        const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : "unmatched";
        end({ method: req.method, route, status: res.statusCode });
    });
    next();
}

async function render() {
    return registry.metrics();
}

module.exports = {
    registry,
    httpMetricsMiddleware,
    render,
    contentType: registry.contentType,
    messagesSent,
    socketsConnected,
};
