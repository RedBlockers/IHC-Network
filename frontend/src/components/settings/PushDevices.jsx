import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { isSubscribed, isSupported, permission, subscribe, unsubscribe } from "../../lib/pushNotifications.js";
import Icon from "../ui/Icon.jsx";

export default function PushDevices() {
    const [devices, setDevices] = useState([]);
    const [here, setHere] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [unavailable, setUnavailable] = useState(null);

    const supported = isSupported();
    const decision = permission();

    const [refresh, setRefresh] = useState(0);
    const reload = () => setRefresh((count) => count + 1);

    useEffect(() => {
        if (!supported) return undefined;
        let cancelled = false;

        api("/notifications/push/devices")
            .then(async (result) => {
                if (cancelled) return;
                setDevices(result.devices);
                setHere(await isSubscribed());
            })
            .catch((err) => {
                if (!cancelled && err instanceof ApiError && err.status === 503) setUnavailable(err.message);
            });

        return () => {
            cancelled = true;
        };
    }, [supported, refresh]);

    async function enable() {
        setBusy(true);
        setError(null);
        try {
            const granted = await subscribe();
            if (!granted) setError("Le navigateur n’a pas donné son autorisation.");
            reload();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "L’abonnement n’a pas abouti.");
        } finally {
            setBusy(false);
        }
    }

    async function disable() {
        setBusy(true);
        setError(null);
        try {
            await unsubscribe();
            reload();
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="settings-section">
            <h3 className="settings-h">Notifications sur téléphone</h3>
            <p className="settings-p">
                Être prévenu même quand qweillo n’est pas ouvert. Seul le nom de la personne et celui
                du salon sont envoyés — jamais le contenu du message, qui s’afficherait sur un écran
                verrouillé.
            </p>

            {error && <p className="form-error" role="alert">{error}</p>}

            {!supported ? (
                <p className="settings-p">
                    Ce navigateur ne prend pas en charge les notifications hors application. Sur une
                    adresse en <code>http://</code>, elles sont désactivées par le navigateur lui-même.
                </p>
            ) : unavailable ? (
                <p className="settings-p">{unavailable}</p>
            ) : (
                <>
                    {devices.length > 0 && (
                        <ul className="key-list">
                            {devices.map((device) => (
                                <li key={device.endpointHash}>
                                    <Icon name="bell" size={16} />
                                    <div>
                                        <strong>{device.deviceLabel}</strong>
                                        <small>
                                            Abonné le {fullTimestamp(device.createdAt)}
                                            {device.lastSentAt
                                                ? ` · dernière notification le ${fullTimestamp(device.lastSentAt)}`
                                                : " · aucune notification envoyée"}
                                        </small>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {here ? (
                        <button type="button" className="btn btn-ghost" disabled={busy} onClick={disable}>
                            Ne plus recevoir sur cet appareil
                        </button>
                    ) : (
                        <button type="button" className="btn btn-accent" disabled={busy} onClick={enable}>
                            {busy ? "En attente du navigateur…" : "Recevoir sur cet appareil"}
                        </button>
                    )}

                    {decision === "denied" && (
                        <p className="settings-p">
                            Les notifications sont bloquées pour ce site. Le navigateur ne redemandera
                            pas : il faut les réautoriser depuis ses propres réglages.
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
