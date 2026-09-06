"use strict";

const { EventEmitter } = require("node:events");

const turnHealth = require("../../src/infra/turnHealth");

describe("Sonde TURN", () => {
    afterEach(() => turnHealth.resetCache());

    it("reconnaît une réponse STUN Binding sans jamais porter de secret", () => {
        const { packet, transactionId } = turnHealth.bindingRequest();
        expect(packet.length).toBe(20);
        expect(packet.readUInt16BE(0)).toBe(0x0001);

        const success = Buffer.from(packet);
        success.writeUInt16BE(0x0101, 0);
        expect(turnHealth.isStunResponse(success, transactionId)).toBe(true);

        const error = Buffer.from(packet);
        error.writeUInt16BE(0x0111, 0);
        expect(turnHealth.isStunResponse(error, transactionId)).toBe(true);

        expect(turnHealth.isStunResponse(success, Buffer.alloc(12))).toBe(false);
        expect(JSON.stringify(turnHealth.publicView({ configured: true, reachable: true, host: "turn.example", port: 3478 }))).not.toMatch(
            /secret|password|credential/i
        );
    });

    it("rend configuré:faux si l'hôte n'est pas posé", async () => {
        await expect(turnHealth.probeTurn({ host: "" })).resolves.toEqual({ configured: false });
        expect(turnHealth.publicView({ configured: false })).toEqual({ configured: false });
    });

    it("marque joignable quand le relais répond au Binding", async () => {
        const result = await turnHealth.probeTurn({
            host: "turn.example",
            port: 3478,
            createSocket: () => {
                const socket = new EventEmitter();
                socket.send = (packet, _port, _host, callback) => {
                    callback(null);
                    const reply = Buffer.from(packet);
                    reply.writeUInt16BE(0x0101, 0);
                    queueMicrotask(() => socket.emit("message", reply));
                };
                socket.close = () => {};
                return socket;
            },
        });

        expect(result).toEqual({
            configured: true,
            reachable: true,
            host: "turn.example",
            port: 3478,
        });
    });

    it("n'expose que la vue publique de /readyz", () => {
        expect(
            turnHealth.publicView({
                configured: true,
                reachable: false,
                host: "turn.example",
                port: 3478,
                secret: "ne-jamais-sortir",
            })
        ).toEqual({
            configured: true,
            reachable: false,
            host: "turn.example",
            port: 3478,
        });
    });
});
