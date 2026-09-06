import { useCallback, useEffect, useRef, useState } from "react";

const STEP = 16;
const MARGIN = 8;

function clamp(position, size) {
    const maxX = Math.max(MARGIN, window.innerWidth - size.width - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - size.height - MARGIN);
    return {
        x: Math.min(Math.max(position.x, MARGIN), maxX),
        y: Math.min(Math.max(position.y, MARGIN), maxY),
    };
}

export default function useDraggable(ref, storageKey, fallback = null) {
    const originRef = useRef(null);
    const [position, setPosition] = useState(() => {
        if (!storageKey || typeof localStorage === "undefined") return fallback;
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : fallback;
        } catch {
            return fallback;
        }
    });

    const place = useCallback(
        (next) => {
            const box = ref.current?.getBoundingClientRect();
            const bounded = clamp(next, { width: box?.width ?? 0, height: box?.height ?? 0 });
            setPosition(bounded);
            if (storageKey) localStorage.setItem(storageKey, JSON.stringify(bounded));
        },
        [ref, storageKey]
    );

    useEffect(() => {
        if (!position) return undefined;
        const onResize = () => place(position);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [place, position]);

    const onPointerDown = useCallback(
        (event) => {
            if (event.button !== 0) return;
            const box = ref.current?.getBoundingClientRect();
            if (!box) return;

            originRef.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        },
        [ref]
    );

    const onPointerMove = useCallback(
        (event) => {
            const origin = originRef.current;
            if (!origin) return;
            place({ x: event.clientX - origin.dx, y: event.clientY - origin.dy });
        },
        [place]
    );

    const onPointerUp = useCallback((event) => {
        originRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);

    const onKeyDown = useCallback(
        (event) => {
            const deltas = {
                ArrowLeft: { x: -STEP, y: 0 },
                ArrowRight: { x: STEP, y: 0 },
                ArrowUp: { x: 0, y: -STEP },
                ArrowDown: { x: 0, y: STEP },
            };
            const delta = deltas[event.key];
            if (!delta) return;

            event.preventDefault();
            const box = ref.current?.getBoundingClientRect();
            const from = position ?? { x: box?.left ?? MARGIN, y: box?.top ?? MARGIN };
            place({ x: from.x + delta.x, y: from.y + delta.y });
        },
        [place, position, ref]
    );

    const reset = useCallback(() => {
        setPosition(null);
        if (storageKey) localStorage.removeItem(storageKey);
    }, [storageKey]);

    return {
        position,
        reset,
        handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
    };
}

export { clamp, MARGIN, STEP };
