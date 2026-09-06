import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../lib/api";
import Modal from "../ui/Modal.jsx";
import Icon from "../ui/Icon.jsx";
import { CHANNEL_GROUPS, CHANNEL_TYPES, PRIMARY_CHANNEL_TYPE_IDS, channelTypeOf } from "../../lib/channelTypes.js";

const VOICE_TYPES = new Set(["voice", "video", "stage"]);

function slugName(value) {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}_-]/gu, "")
        .slice(0, 50);
}

function TypeRow({ option, selected, onSelect }) {
    return (
        <label className={`channel-type-row${selected ? " is-active" : ""}`}>
            <input
                type="radio"
                name="channelType"
                value={option.id}
                checked={selected}
                onChange={() => onSelect(option.id)}
            />
            <span className="channel-type-glyph" aria-hidden="true">
                <Icon name={option.icon} size={18} />
            </span>
            <span className="channel-type-copy">
                <strong>{option.label}</strong>
                <em>{option.note}</em>
            </span>
        </label>
    );
}

export default function CreateChannelModal({ open, guild, defaultCategoryId = "", onClose, onCreated }) {
    const [type, setType] = useState("text");
    const [name, setName] = useState("");
    const [categoryId, setCategoryId] = useState(defaultCategoryId ? String(defaultCategoryId) : "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [customModes, setCustomModes] = useState([]);
    const [customModeId, setCustomModeId] = useState(null);
    const [expiresInHours, setExpiresInHours] = useState("24");
    useEffect(() => {
        let active = true;
        api(`/guilds/${guild.guildId}/channel-modes`)
            .then((result) => active && setCustomModes(result.modes))
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [guild.guildId]);

    const primary = useMemo(() => PRIMARY_CHANNEL_TYPE_IDS.map((id) => channelTypeOf(id)), []);
    const extra = useMemo(() => CHANNEL_TYPES.filter((option) => !PRIMARY_CHANNEL_TYPE_IDS.includes(option.id)), []);
    const prefix = VOICE_TYPES.has(type) ? "volume" : "hash";
    const categories = guild.categories ?? [];

    async function submit(event) {
        event.preventDefault();
        const slug = slugName(name);
        if (!slug) {
            setError("Donnez un nom au salon.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const { channel } = await api(`/guilds/${guild.guildId}/channels`, {
                method: "POST",
                body: {
                    type,
                    name: slug,
                    categoryId: categoryId ? Number(categoryId) : null,
                    customModeId,
                    ...(type === "ephemeral" ? { expiresInHours: Number(expiresInHours) } : {}),
                },
            });
            onCreated(channel);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Impossible de créer le salon.");
            setBusy(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Créer un salon" size="dialog">
            <form className="form form-discord" onSubmit={submit}>
                <fieldset className="channel-type-list">
                    <legend className="field-label">Type de salon</legend>
                    {primary.map((option) => (
                        <TypeRow
                            key={option.id}
                            option={option}
                            selected={type === option.id && !customModeId}
                            onSelect={(value) => {
                                setType(value);
                                setCustomModeId(null);
                            }}
                        />
                    ))}
                </fieldset>

                {extra.length > 0 && (
                    <label className="field">
                        <span className="field-label">Autre type</span>
                        <select
                            className="field-input field-select"
                            value={
                                customModeId
                                    ? `custom:${customModeId}`
                                    : PRIMARY_CHANNEL_TYPE_IDS.includes(type)
                                      ? ""
                                      : type
                            }
                            onChange={(event) => {
                                const value = event.target.value;
                                const preset = value.startsWith("custom:")
                                    ? customModes.find((entry) => entry.modeId === Number(value.slice(7)))
                                    : null;
                                setCustomModeId(preset?.modeId ?? null);
                                setType(preset?.baseType || value || "text");
                            }}
                        >
                            <option value="">Texte, vocal ou annonces</option>
                            {CHANNEL_GROUPS.map((group) => (
                                <optgroup key={group.id} label={group.label}>
                                    {group.types
                                        .filter((option) => !PRIMARY_CHANNEL_TYPE_IDS.includes(option.id))
                                        .map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                </optgroup>
                            ))}
                            {customModes.length > 0 && (
                                <optgroup label="Modes de cette communauté">
                                    {customModes.map((preset) => (
                                        <option key={preset.modeId} value={`custom:${preset.modeId}`}>
                                            {preset.name}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        <small>
                            {customModes.find((entry) => entry.modeId === customModeId)?.refusal ||
                                channelTypeOf(type).note}
                        </small>
                    </label>
                )}

                {type === "ephemeral" && (
                    <label className="field">
                        <span className="field-label">Fermer automatiquement après</span>
                        <select
                            className="field-input"
                            value={expiresInHours}
                            onChange={(event) => setExpiresInHours(event.target.value)}
                        >
                            <option value="1">1 heure</option>
                            <option value="6">6 heures</option>
                            <option value="24">24 heures</option>
                            <option value="168">7 jours</option>
                            <option value="720">30 jours</option>
                        </select>
                        <small>Le salon passe ensuite en lecture seule. Son historique est conservé.</small>
                    </label>
                )}

                <label className="field">
                    <span className="field-label">Nom du salon</span>
                    <span className="field-affix">
                        <span className="field-affix-mark" aria-hidden="true">
                            <Icon name={prefix} size={16} />
                        </span>
                        <input
                            className="field-input"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={() => setName((current) => slugName(current) || current)}
                            maxLength="50"
                            required
                            data-autofocus

                            placeholder="nouveau-salon"
                        />
                    </span>
                </label>

                <label className="field">
                    <span className="field-label">Catégorie</span>
                    <select
                        className="field-input field-select"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                    >
                        <option value="">Aucune</option>
                        {categories.map((category) => (
                            <option key={category.categoryId} value={category.categoryId}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </label>

                {error && (
                    <p className="auth-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>
                        Annuler
                    </button>
                    <button className="btn btn-accent" disabled={busy || !name.trim()}>
                        {busy ? "Création…" : "Créer le salon"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
