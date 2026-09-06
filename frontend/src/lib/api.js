const BASE = import.meta.env?.VITE_API_URL || "/api/v1";

let accessToken = null;
let refreshPromise = null;

export const tokenStore = {
    get: () => accessToken,
    set: (token) => {
        accessToken = token;
    },
    clear: () => {
        accessToken = null;
    },
};

export class ApiError extends Error {
    constructor({ status, code, message, details, requestId }) {
        super(message || "Une erreur est survenue.");
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
        this.requestId = requestId;
    }
}

export const onUnauthorized = new EventTarget();

export const onMaintenance = new EventTarget();

async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
    const token = tokenStore.get();
    const isForm = body instanceof FormData;
    const response = await fetch(`${BASE}${path}`, {
        method,
        signal,
        credentials: "include",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = payload.error || {};
        if (error.code === "maintenance") {
            onMaintenance.dispatchEvent(new CustomEvent("maintenance", { detail: { reason: error.message } }));
        }
        throw new ApiError({
            status: response.status,
            code: error.code,
            message:
                error.message ||
                (response.status === 429
                    ? "Trop de requêtes. Patientez quelques secondes, puis réessayez."
                    : undefined),
            details: error.details,
            requestId: error.requestId,
        });
    }
    return payload;
}

export async function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = request("/auth/refresh", { method: "POST" })
            .then((session) => {
                tokenStore.set(session.token);
                return session;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

export async function resumeSession() {
    const session = await request("/auth/session", { method: "POST" });
    if (session) tokenStore.set(session.token);
    return session;
}

export async function api(path, options = {}) {
    try {
        return await request(path, options);
    } catch (error) {
        const isSessionRoute = [
            "/auth/login",
            "/auth/register",
            "/auth/session",
            "/auth/refresh",
            "/auth/logout",
        ].includes(path);
        if (error.status !== 401 || isSessionRoute || !error.details?.sessionExpired) throw error;

        try {
            await refreshSession();
        } catch (refreshError) {
            tokenStore.clear();
            onUnauthorized.dispatchEvent(new Event("unauthorized"));
            throw refreshError;
        }
        return request(path, options);
    }
}
