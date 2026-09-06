import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.jsx";
import AvatarCropper from "../settings/AvatarCropper.jsx";

const MAX_BYTES = 5 * 1024 * 1024;

export default function AvatarPicker({ onChange, displayName }) {
    const inputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [pending, setPending] = useState(null);
    const [error, setError] = useState(null);

    const previewRef = useRef(null);

    useEffect(() => () => previewRef.current && URL.revokeObjectURL(previewRef.current), []);

    function pick(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_BYTES) {
            setError("5 Mo max.");
            return;
        }
        setError(null);
        setPending(file);
        event.target.value = "";
    }

    function confirm(file) {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(file);
        setPreview(previewRef.current);
        setPending(null);
        onChange(file);
    }

    const initial = (displayName || "?").charAt(0).toUpperCase();

    return (
        <div className="avatar-picker">
            <button
                type="button"
                className="avatar-picker-btn"
                onClick={() => inputRef.current?.click()}
                aria-label="Choisir une photo de profil"
            >
                {preview ? (
                    <img src={preview} alt="" className="avatar-picker-img" />
                ) : (
                    <span className="avatar-picker-fallback">{initial}</span>
                )}
                <span className="avatar-picker-badge"><Icon name="plus" size={15} strokeWidth={2.2} /></span>
            </button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
            {error ? <span className="avatar-picker-error">{error}</span> : <span className="avatar-picker-hint">Photo</span>}
            <AvatarCropper file={pending} onCancel={() => setPending(null)} onConfirm={confirm} />
        </div>
    );
}
