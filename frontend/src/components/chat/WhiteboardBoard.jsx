import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { getSocket } from "../../lib/socket.js";

export default function WhiteboardBoard({ channel }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const points = useRef([]);
    const [error, setError] = useState(null);
    const [color, setColor] = useState("#7c9cff");
    const [strokes, setStrokes] = useState([]);

    const paint = useCallback((list, extra = null) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        for (const stroke of extra ? [...list, extra] : list) {
            if (!stroke.points?.length) continue;
            context.strokeStyle = stroke.color;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
            context.stroke();
        }
    }, []);

    const apply = useCallback(
        (list) => {
            setStrokes(list);
            paint(list);
        },
        [paint]
    );

    const reload = () =>
        api(`/channels/${channel.channelId}/whiteboard`)
            .then((result) => apply(result.strokes ?? []))
            .catch((err) => setError(err instanceof ApiError ? err.message : "Tableau indisponible."));

    useEffect(() => {
        let cancelled = false;
        api(`/channels/${channel.channelId}/whiteboard`)
            .then((result) => {
                if (!cancelled) apply(result.strokes ?? []);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof ApiError ? err.message : "Tableau indisponible.");
            });
        const socket = getSocket();
        if (!socket)
            return () => {
                cancelled = true;
            };
        const onStroke = (stroke) => {
            if (stroke?.points) {
                setStrokes((current) => {
                    const next = [...current, stroke];
                    paint(next);
                    return next;
                });
                return;
            }
            api(`/channels/${channel.channelId}/whiteboard`)
                .then((result) => {
                    if (!cancelled) apply(result.strokes ?? []);
                })
                .catch(() => {});
        };
        const onCleared = () => {
            if (!cancelled) apply([]);
        };
        socket.on("whiteboard:stroke", onStroke);
        socket.on("whiteboard:cleared", onCleared);
        return () => {
            cancelled = true;
            socket.off("whiteboard:stroke", onStroke);
            socket.off("whiteboard:cleared", onCleared);
        };
    }, [channel.channelId, apply, paint]);

    function position(event) {
        const rect = canvasRef.current.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    return (
        <section className="whiteboard-board">
            <header>
                <h3>Tableau</h3>
                <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    aria-label="Couleur"
                />
                <button
                    type="button"
                    className="btn"
                    onClick={() =>
                        api(`/channels/${channel.channelId}/whiteboard`, { method: "DELETE" })
                            .then(reload)
                            .catch((err) => setError(err instanceof ApiError ? err.message : "Effacement refusé."))
                    }
                >
                    Effacer
                </button>
            </header>
            {error && <p role="alert">{error}</p>}
            <canvas
                ref={canvasRef}
                width={720}
                height={280}
                onPointerDown={(event) => {
                    drawing.current = true;
                    points.current = [position(event)];
                }}
                onPointerMove={(event) => {
                    if (!drawing.current) return;
                    points.current.push(position(event));
                    paint(strokes, { color, points: points.current });
                }}
                onPointerUp={async () => {
                    if (!drawing.current) return;
                    drawing.current = false;
                    if (points.current.length < 2) return;
                    try {
                        await api(`/channels/${channel.channelId}/whiteboard`, {
                            method: "POST",
                            body: { color, points: points.current },
                        });
                        await reload();
                    } catch (err) {
                        setError(err instanceof ApiError ? err.message : "Trait non enregistré.");
                    }
                }}
            />
        </section>
    );
}
