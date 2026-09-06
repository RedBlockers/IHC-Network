import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { instanceOrigin, isLocalInstance, readInstances, rememberInstance } from "../../lib/instances.js";
import Modal from "../ui/Modal.jsx";
import Icon from "../ui/Icon.jsx";
import QrCode from "../ui/QrCode.jsx";

export default function InstanceSwitcher({ onClose }) {
    const current = window.location.origin;
    const [name, setName] = useState(window.location.host);
    const [entries, setEntries] = useState(readInstances);
    const [address, setAddress] = useState("");
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [busy, setBusy] = useState(false);
    const video = useRef(null);
    const input = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const mergeEntries = (values) =>
            setEntries((previous) =>
                [...new Map([...previous, ...values].map((entry) => [entry.origin, entry])).values()].slice(0, 8)
            );
        api("/status")
            .then(({ instance }) => {
                if (cancelled) return;
                const label = instance?.name || window.location.host;
                setName(label);
                mergeEntries(rememberInstance(current, label));
            })
            .catch(() => {});
        window.qweillo
            ?.listInstances?.()
            .then((values) => {
                if (!cancelled && Array.isArray(values))
                    mergeEntries(
                        values.map((entry) => ({
                            origin: instanceOrigin(entry.origin),
                            name: String(entry.name || new URL(entry.origin).host),
                        }))
                    );
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [current]);

    useEffect(() => {
        if (!scanning) return undefined;
        let cancelled = false;
        let stream;
        let timer;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        async function start() {
            try {
                const { default: decode } = await import("jsqr");
                if (cancelled) return;
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                video.current.srcObject = stream;
                await video.current.play();
                const scan = () => {
                    if (cancelled || !video.current) return;
                    const width = video.current.videoWidth;
                    const height = video.current.videoHeight;
                    if (width && height) {
                        canvas.width = Math.min(width, 640);
                        canvas.height = Math.round((height * canvas.width) / width);
                        context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
                        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
                        const result = decode(frame.data, frame.width, frame.height);
                        if (result) {
                            try {
                                setAddress(instanceOrigin(result.data));
                                setNotice("Adresse reconnue. Vérifiez-la avant d’ouvrir l’instance.");
                                setScanning(false);
                                input.current?.focus();
                                return;
                            } catch (err) {
                                setError(err.message);
                            }
                        }
                    }
                    timer = window.setTimeout(scan, 200);
                };
                scan();
            } catch {
                if (!cancelled) {
                    setError(
                        "La caméra n’est pas disponible. Autorisez son accès ou saisissez l’adresse de l’instance."
                    );
                    setScanning(false);
                }
            }
        }
        start();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            stream?.getTracks().forEach((track) => track.stop());
        };
    }, [scanning]);

    async function connect(value) {
        setError(null);
        try {
            const origin = instanceOrigin(value);
            if (origin === current) {
                onClose();
                return;
            }
            rememberInstance(current, name);
            rememberInstance(origin);
            setBusy(true);
            if (window.qweillo?.openInstance) await window.qweillo.openInstance(origin);
            else window.location.assign(origin);
        } catch (err) {
            setError(err.message || "L’instance n’a pas pu être ouverte.");
            setBusy(false);
        }
    }

    async function readImage(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setError(null);
        setScanning(false);
        let bitmap;
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error("L’image doit faire moins de 5 Mo.");
            const { default: decode } = await import("jsqr");
            bitmap = await createImageBitmap(file, { resizeWidth: 1024 });
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(bitmap, 0, 0);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = decode(frame.data, frame.width, frame.height);
            if (!result) throw new Error("Aucun code QR lisible dans cette image.");
            setAddress(instanceOrigin(result.data));
            setNotice("Adresse reconnue. Vérifiez-la avant d’ouvrir l’instance.");
            input.current?.focus();
        } catch (err) {
            setError(err.message || "Cette image n’a pas pu être lue.");
        } finally {
            bitmap?.close();
        }
    }

    return (
        <Modal open onClose={onClose} title="Vos instances" size="wide" className="modal-instances">
            <p className="instance-intro">Chaque instance possède ses comptes et ses communautés.</p>
            <section className="instance-current">
                <div>
                    <span className="settings-status is-enabled">Instance actuelle</span>
                    <h3>{name}</h3>
                    <p>{current}</p>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(current);
                                setNotice("Adresse copiée.");
                            } catch {
                                setError("Copiez l’adresse affichée ci-dessus.");
                            }
                        }}
                    >
                        <Icon name="link" size={16} /> Copier l’adresse
                    </button>
                </div>
                <QrCode value={current} label={`Code QR de l’instance ${name}`} />
            </section>
            {isLocalInstance(current) && (
                <p className="settings-p">
                    Adresse locale : utilisez l’accès Internet de l’assistant pour inviter d’autres appareils.
                </p>
            )}
            <form
                className="instance-connect"
                onSubmit={(event) => {
                    event.preventDefault();
                    connect(address);
                }}
            >
                <label className="field">
                    <span className="field-label">Rejoindre une autre instance</span>
                    <input
                        ref={input}
                        className="field-input"
                        value={address}
                        onChange={(event) => {
                            setAddress(event.target.value);
                            setError(null);
                        }}
                        autoComplete="url"
                        inputMode="url"
                        placeholder="communaute.exemple.fr"
                        required
                    />
                </label>
                <div className="settings-actions">
                    <button className="btn btn-accent" disabled={busy || !address.trim()}>
                        {busy ? "Ouverture…" : "Ouvrir l’instance"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setError(null);
                            setScanning(!scanning);
                        }}
                    >
                        {scanning ? "Arrêter la caméra" : "Scanner un code QR"}
                    </button>
                    <label className="btn btn-ghost instance-qr-upload">
                        Lire une image QR
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={readImage} />
                    </label>
                </div>
            </form>
            {scanning && <p className="settings-p">Pointez la caméra vers le code QR de l’instance.</p>}
            {scanning && (
                <video
                    className="instance-scanner"
                    ref={video}
                    muted
                    playsInline
                    aria-label="Caméra pour scanner le code QR"
                />
            )}
            {entries.some((entry) => entry.origin !== current) && (
                <section className="instance-history">
                    <h3>Instances enregistrées</h3>
                    {entries
                        .filter((entry) => entry.origin !== current)
                        .map((entry) => (
                            <button
                                type="button"
                                key={entry.origin}
                                onClick={() => connect(entry.origin)}
                                disabled={busy}
                            >
                                <Icon name="hash" size={20} />
                                <span>
                                    <strong>{entry.name}</strong>
                                    <small>{entry.origin}</small>
                                </span>
                                <Icon name="chevron" size={16} />
                            </button>
                        ))}
                </section>
            )}
            {notice && (
                <p className="settings-notice" role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className="auth-error" role="alert">
                    {error}
                </p>
            )}
        </Modal>
    );
}
