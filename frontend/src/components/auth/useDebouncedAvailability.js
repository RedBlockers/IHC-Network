import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export function useDebouncedAvailability(handle) {
    const [status, setStatus] = useState("idle");

    useEffect(() => {
        const value = handle.trim();
        if (value.length < 3) return undefined;

        const controller = new AbortController();
        const timer = setTimeout(() => {
            setStatus("checking");
            api(`/auth/availability?handle=${encodeURIComponent(value)}`, { signal: controller.signal })
                .then((res) => setStatus(res.handle.available ? "free" : "taken"))
                .catch((err) => {
                    if (err.name !== "AbortError") setStatus("idle");
                });
        }, 400);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [handle]);

    return { status: handle.trim().length < 3 ? "idle" : status };
}
