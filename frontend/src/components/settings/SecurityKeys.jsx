import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { isSupported, registerKey } from "../../lib/securityKeys.js";
import Icon from "../ui/Icon.jsx";

export default function SecurityKeys() {
    const [keys, setKeys] = useState([]);
    const [label, setLabel] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const supported = isSupported();

    const [refresh, setRefresh] = useState(0);
    const reload = () => setRefresh((count) => count + 1);

    useEffect(() => {
        let cancelled = false;
        api("/auth/security-keys")
            .then((result) => !cancelled && setKeys(result.keys))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [refresh]);

    async function add() {
        setBusy(true);
        setError(null);
        try {
            await registerKey(label.trim());
            setLabel("");
            reload();
        } catch (err) {
            if (err?.name === "NotAllowedError") setError("Aucune clé n’a été présentée.");
            else setError(err instanceof ApiError ? err.message : "Cette clé n’a pas pu être inscrite.");
        } finally {
            setBusy(false);
        }
    }

    async function revoke(credentialId) {
        setError(null);
        try {
            await api(`/auth/security-keys/${credentialId}`, { method: "DELETE" });
            reload();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Cette clé n’a pas pu être révoquée.");
        }
    }

    return (
        <section className="settings-section">
            <h3 className="settings-h">Clés de sécurité</h3>
            <p className="settings-p">
                Une clé de sécurité (YubiKey, Touch ID, Windows Hello) est liée à ce site et résiste à
                l’hameçonnage. Une fois inscrite, elle vous connecte sans mot de passe.
            </p>

            {error && <p className="form-error" role="alert">{error}</p>}

            {!supported ? (
                <p className="settings-p">
                    Ce navigateur ne prend pas en charge les clés de sécurité. Sur une adresse en
                    <code> http://</code>, elles sont désactivées par le navigateur lui-même.
                </p>
            ) : (
                <>
                    {keys.length > 0 && (
                        <ul className="key-list">
                            {keys.map((key) => (
                                <li key={key.credentialId}>
                                    <Icon name="check" size={16} />
                                    <div>
                                        <strong>{key.label}</strong>
                                        <small>
                                            Inscrite le {fullTimestamp(key.createdAt)}
                                            {key.lastUsedAt
                                                ? ` · dernier usage le ${fullTimestamp(key.lastUsedAt)}`
                                                : " · jamais utilisée"}
                                        </small>
                                        {!key.backedUp && (
                                            <small className="key-warning">
                                                Cette clé n’est pas sauvegardée : la perdre vous
                                                priverait de ce moyen de connexion.
                                            </small>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() => revoke(key.credentialId)}
                                    >
                                        Révoquer
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="key-add">
                        <label className="field field-grow">
                            <span className="field-label">Nom de la clé</span>
                            <input
                                className="field-input"
                                value={label}
                                onChange={(event) => setLabel(event.target.value)}
                                placeholder="YubiKey bleue, iPhone, portable du bureau…"
                                maxLength={60}
                            />
                        </label>
                        <button type="button" className="btn btn-accent" disabled={!label.trim() || busy} onClick={add}>
                            {busy ? "En attente de la clé…" : "Inscrire cette clé"}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
