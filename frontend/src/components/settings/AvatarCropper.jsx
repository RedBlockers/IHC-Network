import { useEffect, useMemo, useRef, useState } from "react";

import { clampCropOffset, coverScale, exportAvatarCrop } from "../../lib/avatarCrop.js";
import Modal from "../ui/Modal.jsx";

const FRAME_SIZE = 320;

export default function AvatarCropper({ file, onCancel, onConfirm }) {
    if (!file) return null;
    return <AvatarCropSession key={`${file.name}:${file.size}:${file.lastModified}`} file={file} onCancel={onCancel} onConfirm={onConfirm} />;
}

function AvatarCropSession({ file, onCancel, onConfirm }) {
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const source = useMemo(() => URL.createObjectURL(file), [file]);
    const [size, setSize] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [busy, setBusy] = useState(false);

    useEffect(() => () => URL.revokeObjectURL(source), [source]);

    const scale = size ? coverScale(size.width, size.height, FRAME_SIZE, zoom) : 1;
    const rendered = size ? { width: size.width * scale, height: size.height * scale } : null;

    function move(next) {
        if (!size) return;
        setOffset(clampCropOffset(next, size.width, size.height, FRAME_SIZE, scale));
    }

    function pointerDown(event) {
        if (!size) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, offset };
    }

    function pointerMove(event) {
        if (!dragRef.current) return;
        move({
            x: dragRef.current.offset.x + event.clientX - dragRef.current.x,
            y: dragRef.current.offset.y + event.clientY - dragRef.current.y,
        });
    }

    function changeZoom(value) {
        const nextZoom = Number(value);
        setZoom(nextZoom);
        if (size) {
            const nextScale = coverScale(size.width, size.height, FRAME_SIZE, nextZoom);
            setOffset((current) => clampCropOffset(current, size.width, size.height, FRAME_SIZE, nextScale));
        }
    }

    async function confirm() {
        if (!imageRef.current || !size) return;
        setBusy(true);
        try {
            await onConfirm(await exportAvatarCrop(imageRef.current, FRAME_SIZE, scale, offset));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open onClose={onCancel} title="Recadrer la photo" className="modal-avatar-crop">
            <div className="avatar-crop-shell">
                <div
                    className="avatar-crop-stage"
                    role="application"
                    aria-label="Zone de recadrage. Déplacez l’image avec la souris, le doigt ou les flèches."
                    tabIndex={0}
                    onPointerDown={pointerDown}
                    onPointerMove={pointerMove}
                    onPointerUp={() => { dragRef.current = null; }}
                    onPointerCancel={() => { dragRef.current = null; }}
                    onKeyDown={(event) => {
                        const step = event.shiftKey ? 12 : 3;
                        const delta = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
                        if (!delta) return;
                        event.preventDefault();
                        move({ x: offset.x + delta[0], y: offset.y + delta[1] });
                    }}
                >
                    {source && <img
                        ref={imageRef}
                        src={source}
                        alt=""
                        draggable="false"
                        onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                        style={rendered ? { width: rendered.width, height: rendered.height, marginLeft: offset.x, marginTop: offset.y } : undefined}
                    />}
                    <span className="avatar-crop-mask" aria-hidden="true" />
                </div>
                <label className="avatar-crop-zoom">
                    <span>Zoom</span>
                    <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(event.target.value)} />
                    <output>{Math.round(zoom * 100)} %</output>
                </label>
                <p>Le cercle montre exactement la zone visible sur votre profil.</p>
                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
                    <button type="button" className="btn btn-accent" onClick={confirm} disabled={busy || !size}>{busy ? "Préparation…" : "Utiliser cette photo"}</button>
                </div>
            </div>
        </Modal>
    );
}
