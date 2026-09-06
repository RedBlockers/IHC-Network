import { useCallback, useEffect, useState } from "react";

const STEP = 24;

export default function useResizablePanel(storageKey, { min = 200, max = 480, initial = 270 } = {}) {
    const [width, setWidth] = useState(() => {
        if (typeof localStorage === "undefined") return initial;
        const saved = Number(localStorage.getItem(storageKey));
        return Number.isFinite(saved) && saved >= min && saved <= max ? saved : initial;
    });
    const [dragging, setDragging] = useState(false);

    const place = useCallback(
        (next) => {
            const bounded = Math.min(Math.max(Math.round(next), min), max);
            setWidth(bounded);
            try {
                localStorage.setItem(storageKey, String(bounded));
            } catch {}
        },
        [max, min, storageKey]
    );

    useEffect(() => {
        if (!dragging) return undefined;

        const onMove = (event) => place(window.innerWidth - event.clientX);
        const onUp = () => setDragging(false);

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        document.body.style.userSelect = "none";

        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            document.body.style.userSelect = "";
        };
    }, [dragging, place]);

    return {
        width,
        dragging,
        reset: () => place(initial),
        handleProps: {
            onPointerDown: (event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                setDragging(true);
            },
            onDoubleClick: () => place(initial),
            onKeyDown: (event) => {
                const delta = event.key === "ArrowLeft" ? STEP : event.key === "ArrowRight" ? -STEP : 0;
                if (!delta) return;
                event.preventDefault();
                place(width + delta);
            },
            role: "separator",
            tabIndex: 0,
            "aria-orientation": "vertical",
            "aria-valuenow": width,
            "aria-valuemin": min,
            "aria-valuemax": max,
            "aria-label": "Redimensionner le panneau. Flèches gauche et droite.",
        },
    };
}

export { STEP };
