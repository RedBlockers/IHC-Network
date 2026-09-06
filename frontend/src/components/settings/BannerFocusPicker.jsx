import { useRef, useState } from "react";

const STEP = 2;

export default function BannerFocusPicker({ url, focusX = 50, focusY = 50, onChange }) {
    const frame = useRef(null);
    const [dragging, setDragging] = useState(false);

    if (!url) return null;

    const place = (event) => {
        const rect = frame.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
        onChange({ focusX: Math.min(100, Math.max(0, x)), focusY: Math.min(100, Math.max(0, y)) });
    };

    function onKeyDown(event) {
        const moves = {
            ArrowLeft: { focusX: focusX - STEP, focusY },
            ArrowRight: { focusX: focusX + STEP, focusY },
            ArrowUp: { focusX, focusY: focusY - STEP },
            ArrowDown: { focusX, focusY: focusY + STEP },
        };
        const next = moves[event.key];
        if (!next) return;
        event.preventDefault();
        onChange({
            focusX: Math.min(100, Math.max(0, next.focusX)),
            focusY: Math.min(100, Math.max(0, next.focusY)),
        });
    }

    return (
        <div className="banner-focus">
            <div
                ref={frame}
                className="banner-focus-frame"
                role="application"
                aria-label={`Point focal de la bannière, actuellement à ${focusX} % horizontalement et ${focusY} % verticalement. Utilisez les flèches.`}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(true);
                    place(event);
                }}
                onPointerMove={(event) => dragging && place(event)}
                onPointerUp={() => setDragging(false)}
            >
                <img src={url} alt="" />
                <span className="banner-focus-dot" style={{ left: `${focusX}%`, top: `${focusY}%` }} />
            </div>

            <div className="banner-focus-previews">
                {[
                    { label: "Ordinateur", ratio: "5 / 1" },
                    { label: "Tablette", ratio: "3 / 1" },
                    { label: "Téléphone", ratio: "16 / 9" },
                ].map((shape) => (
                    <figure key={shape.label}>
                        <div
                            style={{
                                aspectRatio: shape.ratio,
                                backgroundImage: `url("${url}")`,
                                backgroundSize: "cover",
                                backgroundPosition: `${focusX}% ${focusY}%`,
                            }}
                        />
                        <figcaption>{shape.label}</figcaption>
                    </figure>
                ))}
            </div>
        </div>
    );
}
