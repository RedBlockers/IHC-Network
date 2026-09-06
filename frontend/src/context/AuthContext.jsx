import { useCallback, useEffect, useMemo, useState } from "react";
import { api, tokenStore, onUnauthorized, refreshSession, resumeSession } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { AuthContext } from "./auth-context.js";
import { signInWithKey } from "../lib/securityKeys.js";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState("loading");
    const [expiresAt, setExpiresAt] = useState(null);
    const [authNotice, setAuthNotice] = useState(null);

    const clearSession = useCallback(() => {
        tokenStore.clear();
        disconnectSocket();
        setUser(null);
        setExpiresAt(null);
        setStatus("anon");
    }, []);

    const applySession = useCallback((session) => {
        setAuthNotice(null);
        tokenStore.set(session.token);
        setUser(session.user);
        setExpiresAt(Date.now() + session.expiresIn * 1000);
        setStatus("authed");
        connectSocket();
    }, []);

    const logout = useCallback(async () => {
        try {
            await api("/auth/logout", { method: "POST" });
        } finally {
            clearSession();
        }
    }, [clearSession]);

    useEffect(() => {
        let cancelled = false;
        resumeSession()
            .then((session) => {
                if (cancelled) return;
                if (session) applySession(session);
                else clearSession();
            })
            .catch(() => !cancelled && clearSession());
        return () => {
            cancelled = true;
        };
    }, [applySession, clearSession]);

    useEffect(() => {
        if (!expiresAt || status !== "authed") return undefined;
        const delay = Math.max(1_000, expiresAt - Date.now() - 60_000);
        const timer = window.setTimeout(() => {
            refreshSession().then(applySession).catch(clearSession);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [applySession, clearSession, expiresAt, status]);

    useEffect(() => {
        const handler = () => clearSession();
        onUnauthorized.addEventListener("unauthorized", handler);
        return () => onUnauthorized.removeEventListener("unauthorized", handler);
    }, [clearSession]);

    const login = useCallback(
        async (handle, password, secondFactor = {}) =>
            applySession(await api("/auth/login", { method: "POST", body: { handle, password, ...secondFactor } })),
        [applySession]
    );

    const loginWithSecurityKey = useCallback(async () => applySession(await signInWithKey()), [applySession]);

    const register = useCallback(
        async (formData) => applySession(await api("/auth/register", { method: "POST", body: formData })),
        [applySession]
    );

    const value = useMemo(
        () => ({ user, status, login, loginWithSecurityKey, register, logout, setUser, authNotice, setAuthNotice }),
        [user, status, login, loginWithSecurityKey, register, logout, authNotice]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
