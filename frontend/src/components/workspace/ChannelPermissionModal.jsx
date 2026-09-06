import { useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import { isVoiceChannel } from "../../lib/voiceChannels.js";
import { PERMISSION_GROUPS, PERMISSION_STATES } from "./permissionDefinitions.js";
import ChannelSettings from "./ChannelSettings.jsx";

const CHANNEL_GROUPS = PERMISSION_GROUPS.slice(0, 2);

function targetKey(target) {
    return `${target.targetType}:${target.targetId}`;
}

function sameRules(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

export default function ChannelPermissionModal({ open, guild, channel, onClose, onChannelUpdated }) {
    const [roles, setRoles] = useState([]);
    const [overrides, setOverrides] = useState([]);
    const [selectedKey, setSelectedKey] = useState(null);
    const [draft, setDraft] = useState({});
    const draftRef = useRef({});
    const [filter, setFilter] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [encrypted, setEncrypted] = useState(Boolean(channel?.e2eeEnabled));
    const [encryptionBusy, setEncryptionBusy] = useState(false);
    const structured = [
        "ticket",
        "task",
        "wiki",
        "documentation",
        "resources",
        "faq",
        "event",
        "meeting",
        "poll",
    ].includes(channel?.type);

    const [seenChannel, setSeenChannel] = useState(channel?.channelId ?? null);
    if (seenChannel !== (channel?.channelId ?? null)) {
        setSeenChannel(channel?.channelId ?? null);
        setEncrypted(Boolean(channel?.e2eeEnabled));
    }

    async function toggleEncryption(next) {
        setEncryptionBusy(true);
        setError(null);
        try {
            const result = await api(`/channels/${channel.channelId}/e2ee`, {
                method: "PATCH",
                body: { enabled: next },
            });
            setEncrypted(result.e2eeEnabled);
            onChannelUpdated?.({ ...channel, e2eeEnabled: result.e2eeEnabled });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Réglage de chiffrement non enregistré.");
        } finally {
            setEncryptionBusy(false);
        }
    }

    useEffect(() => {
        if (!open || !guild || !channel) return undefined;
        let cancelled = false;
        Promise.all([
            api(`/guilds/${guild.guildId}/roles`),
            api(`/guilds/${guild.guildId}/channels/${channel.channelId}/permissions`),
        ])
            .then(([roleResult, permissionResult]) => {
                if (cancelled) return;
                setError(null);
                setRoles(roleResult.roles);
                setOverrides(permissionResult.overrides);
                const defaultRole = roleResult.roles.find((role) => role.isDefault) ?? roleResult.roles[0];
                const key = defaultRole
                    ? `role:${defaultRole.roleId}`
                    : guild.members[0]
                      ? `member:${guild.members[0].userId}`
                      : null;
                setSelectedKey(key);
                const initial = permissionResult.overrides.find((item) => targetKey(item) === key)?.permissions ?? {};
                draftRef.current = { ...initial };
                setDraft({ ...initial });
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : "Chargement impossible."));
        return () => {
            cancelled = true;
        };
    }, [open, guild, channel]);

    const targets = useMemo(
        () => [
            ...roles.map((role) => ({
                targetType: "role",
                targetId: role.roleId,
                targetName: role.name,
                targetIcon: role.iconEmoji,
                targetColor: role.color,
                isDefault: role.isDefault,
            })),
            ...(guild?.members ?? []).map((member) => ({
                targetType: "member",
                targetId: member.userId,
                targetName: member.displayName || member.handle,
                handle: member.handle,
                member,
            })),
        ],
        [roles, guild]
    );
    const selected = targets.find((target) => targetKey(target) === selectedKey) ?? null;
    const initialRules = overrides.find((item) => targetKey(item) === selectedKey)?.permissions ?? {};
    const visibleTargets = targets.filter((target) =>
        `${target.targetName} ${target.handle || ""}`.toLowerCase().includes(filter.toLowerCase())
    );
    const changed = !sameRules(draft, initialRules);

    function chooseTarget(target) {
        const key = targetKey(target);
        const initial = overrides.find((item) => targetKey(item) === key)?.permissions ?? {};
        setSelectedKey(key);
        draftRef.current = { ...initial };
        setDraft({ ...initial });
        setError(null);
    }

    function setPermission(permission, effect) {
        const next = { ...draftRef.current, [permission]: effect };
        draftRef.current = next;
        setDraft(next);
    }

    function resetDraft() {
        draftRef.current = { ...initialRules };
        setDraft({ ...initialRules });
    }

    async function save() {
        if (!selected || !changed) return;
        setBusy(true);
        setError(null);
        try {
            const path =
                selected.targetType === "role"
                    ? `/guilds/${guild.guildId}/channels/${channel.channelId}/permissions/role/${selected.targetId}`
                    : `/guilds/${guild.guildId}/channels/${channel.channelId}/permissions/member/${selected.targetId}`;
            const result = await api(path, { method: "PUT", body: { permissions: draftRef.current } });
            setOverrides(result.overrides);
            const saved = result.overrides.find((item) => targetKey(item) === selectedKey)?.permissions ?? {};
            draftRef.current = { ...saved };
            setDraft({ ...saved });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Permissions · ${channel?.name || "salon"}`}
            className="modal-channel-permissions"
        >
            <ChannelSettings
                key={channel.channelId}
                channel={channel}
                onUpdated={onChannelUpdated}
                onDeleted={onClose}
            />
            <div className="channel-permission-shell">
                <aside className="channel-permission-targets">
                    <div className="channel-permission-context">
                        <span>
                            <Icon name={channel?.type === "voice" ? "volume" : "hash"} size={16} />
                        </span>
                        <div>
                            <strong>{channel?.name}</strong>
                            <small>Accès par rôle ou membre</small>
                        </div>
                    </div>
                    <div className="channel-encryption">
                        <label>
                            <input
                                type="checkbox"
                                checked={encrypted}
                                disabled={encryptionBusy || (structured && !encrypted)}
                                onChange={(event) => toggleEncryption(event.target.checked)}
                            />
                            <span>
                                <strong>Chiffrement des messages de bout en bout</strong>
                                <small>
                                    {structured
                                        ? "Les contenus structurés de ce type de salon sont conservés sur l’instance. Le chiffrement des messages ne s’y applique pas."
                                        : encrypted
                                          ? isVoiceChannel(channel?.type)
                                              ? "Le serveur ne conserve que des enveloppes. La clé d’époque reste sur les appareils ; le jeton média n’annonce que l’obligation de chiffrer."
                                              : "Le serveur ne conserve que des messages chiffrés. Un appareil qui rejoint plus tard ne lira pas l’historique antérieur."
                                          : "Les messages restent lisibles par le serveur, donc par la recherche et la modération."}
                                </small>
                            </span>
                        </label>
                    </div>
                    <label className="role-filter">
                        <Icon name="search" size={14} />
                        <input
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            placeholder="Filtrer les accès…"
                        />
                    </label>
                    <div className="channel-target-list">
                        {visibleTargets.map((target) => {
                            const key = targetKey(target);
                            const configured = overrides.some((item) => targetKey(item) === key);
                            return (
                                <button
                                    type="button"
                                    key={key}
                                    className={key === selectedKey ? "is-active" : ""}
                                    onClick={() => chooseTarget(target)}
                                >
                                    {target.targetType === "member" ? (
                                        <Avatar user={target.member} size={26} />
                                    ) : (
                                        <span
                                            className="channel-target-role"
                                            style={{ "--target-color": target.targetColor }}
                                        >
                                            {target.targetIcon || "@"}
                                        </span>
                                    )}
                                    <span>
                                        <strong>{target.targetName}</strong>
                                        <small>
                                            {target.targetType === "role"
                                                ? target.isDefault
                                                    ? "Rôle par défaut"
                                                    : "Rôle"
                                                : `@${target.handle}`}
                                        </small>
                                    </span>
                                    {configured && <i title="Règles personnalisées" />}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section className="channel-permission-editor">
                    {selected ? (
                        <>
                            <header>
                                <span className="channel-permission-badge">
                                    {selected.targetType === "role" ? (
                                        selected.targetIcon || "@"
                                    ) : (
                                        <Avatar user={selected.member} size={30} />
                                    )}
                                </span>
                                <div>
                                    <span>Règles spécifiques pour</span>
                                    <strong>{selected.targetName}</strong>
                                </div>
                            </header>
                            <p className="channel-permission-help">
                                Une règle explicite remplace l’autorisation du serveur uniquement dans ce salon. Les
                                refus restent prioritaires.
                            </p>
                            <div className="permission-groups">
                                {CHANNEL_GROUPS.map(([group, permissions]) => (
                                    <section key={group} className="permission-group">
                                        <h3>{group}</h3>
                                        {permissions.map(([key, label, detail]) => {
                                            const value = draft[key] || "inherit";
                                            return (
                                                <div className="permission-row" key={key}>
                                                    <div>
                                                        <strong>{label}</strong>
                                                        <span>{detail}</span>
                                                    </div>
                                                    <div className="permission-segmented" aria-label={label}>
                                                        {PERMISSION_STATES.map(([state, text]) => (
                                                            <button
                                                                type="button"
                                                                key={state}
                                                                className={value === state ? `is-${state}` : ""}
                                                                onClick={() => setPermission(key, state)}
                                                            >
                                                                {text}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </section>
                                ))}
                            </div>
                            {error && (
                                <p className="auth-error" role="alert">
                                    {error}
                                </p>
                            )}
                            <div className="role-savebar channel-permission-savebar">
                                <span>
                                    {changed
                                        ? "Modifications non enregistrées"
                                        : "Toutes les modifications sont enregistrées"}
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={resetDraft}
                                    disabled={!changed || busy}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-accent"
                                    onClick={save}
                                    disabled={!changed || busy}
                                >
                                    {busy ? "Enregistrement…" : "Enregistrer"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="admin-loading">Aucune cible disponible.</div>
                    )}
                </section>
            </div>
        </Modal>
    );
}
