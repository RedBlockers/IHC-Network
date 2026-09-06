import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Modal from "../ui/Modal.jsx";

export default function RoleTemplatePicker({ guild, open, onClose, onCreated }) {
    const [templates, setTemplates] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        api(`/guilds/${guild.guildId}/roles/templates`)
            .then(({ templates: loaded }) => {
                if (!cancelled) setTemplates(loaded);
            })
            .catch(() => {
                if (!cancelled) setTemplates([]);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, open]);

    async function apply(template) {
        setBusyId(template.id);
        setError(null);
        try {
            const { role } = await api(`/guilds/${guild.guildId}/roles/templates/${template.id}`, {
                method: "POST",
                body: {},
            });
            onCreated(role);
            onClose();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Le rôle n’a pas pu être créé.");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Partir d’un modèle">
            <p className="template-intro">
                Chaque modèle est un ensemble cohérent de permissions. Vous pourrez tout
                ajuster ensuite.
            </p>

            {error && <p className="form-error" role="alert">{error}</p>}

            {!templates && (
                <div className="template-grid" aria-hidden="true">
                    {[0, 1, 2].map((index) => <div className="template-card is-loading" key={index} />)}
                </div>
            )}

            {templates?.length === 0 && (
                <p className="admin-empty">Aucun modèle n’est disponible pour l’instant.</p>
            )}

            {templates && templates.length > 0 && (
                <ul className="template-grid">
                    {templates.map((template) => (
                        <li key={template.id}>
                            <button
                                type="button"
                                className="template-card"
                                style={{ "--role": template.color }}
                                onClick={() => apply(template)}
                                disabled={!template.available || busyId !== null}
                            >
                                <span className="template-head">
                                    <span className="template-emoji" aria-hidden="true">{template.iconEmoji}</span>
                                    <strong>{template.name}</strong>
                                </span>
                                <span className="template-summary">{template.summary}</span>
                                <span className="template-excludes">{template.excludes}</span>
                                <span className="template-count">
                                    {template.permissions.length} permission{template.permissions.length > 1 ? "s" : ""}
                                </span>
                                {!template.available && (
                                    <span className="template-blocked">
                                        Vous ne détenez pas {template.missing.length} de ces permissions.
                                    </span>
                                )}
                                {busyId === template.id && <span className="template-busy">Création…</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}
