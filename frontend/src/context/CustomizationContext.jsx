import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { contrastRatio, correctForContrast } from "../lib/contrast.js";
import { useAuth } from "./useAuth.js";
import { CustomizationContext } from "./customization-context.js";
import { DEFAULT_PREFERENCES, PREFERENCE_KEYS, sanitizePreferences } from "./customization-options.js";

const STORAGE_KEY = "qweillo.preferences";
const SYNC_DELAY = 400;

const media = (query) => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query) : null);

function systemDefaults() {
    const reduceMotion = media("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const prefersLight = media("(prefers-color-scheme: light)")?.matches ?? false;
    const prefersContrast = media("(prefers-contrast: more)")?.matches ?? false;
    return {
        ...DEFAULT_PREFERENCES,
        theme: prefersContrast ? "contrast" : prefersLight ? "light" : "dark",
        reduceMotion,
        highContrast: prefersContrast,
    };
}

function storedPreferences() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return sanitizePreferences(JSON.parse(raw));
    } catch {
        return null;
    }
}

function applyPreferences(preferences, { productAccent, communityAccent }) {
    const root = document.documentElement;

    if (preferences.theme === "dark") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", preferences.theme);

    root.setAttribute("data-density", preferences.density);
    root.setAttribute("data-motion", preferences.reduceMotion ? "reduced" : "full");
    root.setAttribute("data-contrast", preferences.highContrast ? "high" : "normal");
    root.setAttribute("data-com-theme", preferences.neutralizeCommunityThemes ? "off" : "on");
    root.setAttribute("data-banners", preferences.hideBanners ? "hidden" : preferences.bannerBehaviour);

    root.style.setProperty("--accent-bg", productAccent);
    root.style.setProperty(
        "--on-accent",
        contrastRatio("#06251f", productAccent) >= contrastRatio("#ffffff", productAccent) ? "#06251f" : "#ffffff"
    );
    root.style.setProperty(
        "--accent-text",
        correctForContrast(productAccent, preferences.theme === "light" ? "#e9edf2" : "#1b212b", { target: 5 })
    );
    root.style.setProperty("--com-accent", communityAccent);
}

export function CustomizationProvider({ children }) {
    const { user, status, setUser } = useAuth();
    const [preferences, setPreferences] = useState(() => storedPreferences() ?? systemDefaults());
    const [community, setCommunity] = useState({ accent: null, radiusDelta: 0, surfaceTint: null });
    const adoptedForUser = useRef(null);
    const syncTimer = useRef(null);

    const neutralized = preferences.neutralizeCommunityThemes;
    const productAccent = preferences.accent || DEFAULT_PREFERENCES.accent;
    const communityAccent = neutralized ? productAccent : community.accent || productAccent;

    useEffect(() => {
        applyPreferences(preferences, { productAccent, communityAccent });
    }, [preferences, productAccent, communityAccent]);

    useEffect(() => {
        const root = document.documentElement;
        const delta = neutralized ? 0 : Math.max(-4, Math.min(4, community.radiusDelta || 0));
        root.style.setProperty("--com-radius-delta", `${delta}px`);
        root.style.setProperty(
            "--com-surface-tint",
            neutralized ? "transparent" : community.surfaceTint || "transparent"
        );
    }, [community.radiusDelta, community.surfaceTint, neutralized]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }, [preferences]);

    useEffect(() => {
        if (status !== "authed" || !user?.preferences) return;
        if (adoptedForUser.current === user.userId) return;
        adoptedForUser.current = user.userId;
        setPreferences(sanitizePreferences(user.preferences));
    }, [status, user]);

    useEffect(() => {
        if (status !== "authed") {
            adoptedForUser.current = null;
            return undefined;
        }
        const socket = getSocket();
        if (!socket) return undefined;
        const handler = (next) => setPreferences(sanitizePreferences(next));
        socket.on("user:preferences", handler);
        return () => socket.off("user:preferences", handler);
    }, [status]);

    const persist = useCallback(
        (patch) => {
            if (status !== "authed") return;
            window.clearTimeout(syncTimer.current);
            syncTimer.current = window.setTimeout(() => {
                api("/users/me/preferences", { method: "PATCH", body: patch })
                    .then(({ preferences: saved }) => {
                        setUser((current) => (current ? { ...current, preferences: saved } : current));
                    })
                    .catch(() => {});
            }, SYNC_DELAY);
        },
        [setUser, status]
    );

    const update = useCallback(
        (patch) => {
            const clean = sanitizePreferences({ ...preferences, ...patch });
            setPreferences(clean);
            const changed = Object.fromEntries(
                PREFERENCE_KEYS.filter((key) => key in patch).map((key) => [key, clean[key]])
            );
            if (Object.keys(changed).length > 0) persist(changed);
        },
        [persist, preferences]
    );

    const value = useMemo(
        () => ({
            preferences,
            update,
            theme: preferences.theme,
            setTheme: (theme) => update({ theme }),
            density: preferences.density,
            setDensity: (density) => update({ density }),
            reduceMotion: preferences.reduceMotion,
            highContrast: preferences.highContrast,
            hideBanners: preferences.hideBanners,
            bannerBehaviour: preferences.hideBanners ? "hidden" : preferences.bannerBehaviour,
            neutralizeCommunityThemes: neutralized,
            userAccent: preferences.accent || DEFAULT_PREFERENCES.accent,
            setUserAccent: (accent) => update({ accent }),
            communityAccent,
            setCommunityTheme: setCommunity,
            setGuildAccent: (accent) => setCommunity((current) => ({ ...current, accent })),
        }),
        [preferences, update, neutralized, communityAccent]
    );

    return <CustomizationContext.Provider value={value}>{children}</CustomizationContext.Provider>;
}
