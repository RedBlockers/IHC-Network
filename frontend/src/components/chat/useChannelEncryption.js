import { useCallback, useEffect, useMemo, useState } from "react";

import { parseEnvelope } from "../../lib/e2ee/crypto.js";
import {
    decryptForChannel,
    encryptForChannel,
    ensureDevice,
    forgetChannel,
    supported,
} from "../../lib/e2ee/session.js";

export const UNREADABLE = Symbol("unreadable");

export function useChannelEncryption(channel, messages) {
    const channelId = channel.channelId;
    const enabled = Boolean(channel.e2eeEnabled);
    const available = supported();
    const [plaintexts, setPlaintexts] = useState(() => new Map());
    const [error, setError] = useState(null);

    const [seenChannel, setSeenChannel] = useState(channelId);
    if (seenChannel !== channelId) {
        setSeenChannel(channelId);
        setPlaintexts(new Map());
        setError(null);
    }

    useEffect(() => () => forgetChannel(channelId), [channelId]);

    useEffect(() => {
        if (!enabled || !available) return undefined;
        let cancelled = false;
        ensureDevice().catch((err) => {
            console.warn("chiffrement de bout en bout indisponible", err);
            if (!cancelled) setError(err?.message ?? "Appareil de chiffrement indisponible.");
        });
        return () => {
            cancelled = true;
        };
    }, [channelId, enabled, available]);

    useEffect(() => {
        if (!enabled || !available) return undefined;
        let cancelled = false;

        const todo = messages.filter(
            (message) =>
                (plaintexts.get(message.messageId)?.content !== message.content ||
                    plaintexts.get(message.messageId)?.channelId !== channelId) &&
                parseEnvelope(message.content) !== null
        );
        if (todo.length === 0) return undefined;

        (async () => {
            const decoded = new Map();
            for (const message of todo) {
                const envelope = parseEnvelope(message.content);
                let clear;
                try {
                    clear = await decryptForChannel(channelId, message.content, envelope.epoch);
                } catch {
                    clear = null;
                }
                if (cancelled) return;
                decoded.set(message.messageId, { channelId, content: message.content, value: clear ?? UNREADABLE });
            }
            setPlaintexts((current) => new Map([...current, ...decoded]));
        })().catch((err) => {
            if (!cancelled) setError(err?.message ?? "Clés du salon indisponibles.");
        });

        return () => {
            cancelled = true;
        };
    }, [channelId, enabled, available, messages, plaintexts]);

    const readable = useCallback(
        (message) => {
            if (parseEnvelope(message.content) === null) return message.content;
            if (!available) return UNREADABLE;
            const value = plaintexts.get(message.messageId);
            return value?.channelId === channelId && value.content === message.content ? value.value : null;
        },
        [channelId, available, plaintexts]
    );

    const encryptOutgoing = useCallback(
        async (content) => {
            if (!enabled) return content;
            if (!supported())
                throw new Error("Le chiffrement est indisponible dans ce navigateur. Aucun message n’a été envoyé.");
            return encryptForChannel(channelId, content);
        },
        [channelId, enabled]
    );

    return useMemo(
        () => ({
            enabled,
            supported: available,
            error:
                enabled && !available
                    ? "Le chiffrement est indisponible dans ce navigateur. Utilisez un navigateur compatible pour ce salon."
                    : error,
            readable,
            encryptOutgoing,
        }),
        [enabled, available, error, readable, encryptOutgoing]
    );
}
