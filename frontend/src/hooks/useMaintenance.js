import { useEffect, useState } from "react";

import { api, onMaintenance } from "../lib/api.js";

const EVERY_MS = 15_000;

export default function useMaintenance() {
    const [state, setState] = useState({ active: false, reason: null });

    useEffect(() => {
        const onRefused = (event) =>
            setState({ active: true, reason: event.detail?.reason ?? "Le service est en maintenance." });
        onMaintenance.addEventListener("maintenance", onRefused);
        return () => onMaintenance.removeEventListener("maintenance", onRefused);
    }, []);

    const active = state.active;
    useEffect(() => {
        let alive = true;

        const check = async () => {
            try {
                const payload = await api("/status");
                if (alive) setState(payload.maintenance ?? { active: false, reason: null });
            } catch {}
        };

        const first = setTimeout(check, 0);
        const timer = active ? setInterval(check, EVERY_MS) : null;

        return () => {
            alive = false;
            clearTimeout(first);
            if (timer) clearInterval(timer);
        };
    }, [active]);

    return state;
}
