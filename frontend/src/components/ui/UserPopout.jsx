import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import { api, ApiError } from "../../lib/api.js";
import { bannerGradient } from "../../lib/banners.js";

export default function UserPopout({ member, position, ownerId, bannerKey, guildId, currentUserId, canManageRoles = false, canModerate = false, onSanction, onClose }) {
    const width = 300;
    const height = 340;
    const coords = {
        left: Math.max(12, Math.min(position.x - width - 12, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(position.y - 40, window.innerHeight - height - 12)),
    };

    const [assigned, setAssigned] = useState(member.roles ?? []);
    const [editing, setEditing] = useState(false);
    const [guildRoles, setGuildRoles] = useState(null);
    const [busyRoleId, setBusyRoleId] = useState(null);
    const [error, setError] = useState(null);
    const [note, setNote] = useState(null);
    const [noteDraft, setNoteDraft] = useState("");
    const [blocked, setBlocked] = useState(false);
    const isSelf = Number(member.userId) === Number(currentUserId);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        if (!editing || guildRoles || !guildId) return;
        let cancelled = false;
        api(`/guilds/${guildId}/roles`)
            .then(({ roles }) => !cancelled && setGuildRoles(roles.filter((role) => !role.isDefault && !role.isManaged)))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Rôles indisponibles."));
        return () => {
            cancelled = true;
        };
    }, [editing, guildId, guildRoles]);

    useEffect(() => {
        if (isSelf) return undefined;
        let cancelled = false;
        api(`/users/${member.userId}/note`)
            .then(({ note: found }) => {
                if (cancelled) return;
                setNote(found);
                setNoteDraft(found?.body ?? "");
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [member.userId, isSelf]);

    async function saveNote() {
        try {
            const { note: saved } = await api(`/users/${member.userId}/note`, {
                method: "PUT",
                body: { body: noteDraft },
            });
            setNote(saved);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Note non enregistrée.");
        }
    }

    async function toggleBlock() {
        try {
            await api(`/users/${member.userId}/block`, { method: blocked ? "DELETE" : "PUT" });
            setBlocked((current) => !current);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Blocage non modifié.");
        }
    }

    async function toggleRole(role, enable) {
        setBusyRoleId(role.roleId);
        setError(null);
        try {
            const { roles } = await api(`/guilds/${guildId}/members/${member.userId}/roles/${role.roleId}`, {
                method: enable ? "PUT" : "DELETE",
            });
            setAssigned(roles);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Rôle non modifié.");
        } finally {
            setBusyRoleId(null);
        }
    }

    const fallbackRoles = assigned.length
        ? assigned
        : [{
            roleId: member.role || "member",
            name: member.userId === ownerId ? "Propriétaire" : member.role === "admin" ? "Administration" : "Membre",
            color: member.userId === ownerId ? "#D9A441" : null,
        }];

    const assignedIds = new Set(assigned.map((role) => role.roleId));

    return createPortal(
        <>
            <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={onClose} />
            <div className="popout" style={{ left: coords.left, top: coords.top }} role="dialog" aria-label="Profil">
                <div
                    className={`popout-banner${member.bannerImage ? " has-image" : ""}`}
                    style={member.bannerImage ? { backgroundImage: `url("${member.bannerImage}")` } : { background: bannerGradient(bannerKey) }}
                />
                <div className="popout-head">
                    <div className="popout-av">
                        <Avatar user={member} size={64} presence={member.presence || "offline"} />
                    </div>
                </div>
                <div className="popout-body">
                    <div className="popout-name">{member.displayName || member.handle}</div>
                    <div className="popout-handle">@{member.handle}</div>

                    {member.activityText && <div className="popout-activity"><i />{member.activityText}</div>}

                    {member.aboutMe && (
                        <div className="popout-card">
                            <h4>À propos</h4>
                            <p>{member.aboutMe}</p>
                        </div>
                    )}

                    <div className="popout-card">
                        <div className="popout-card-head">
                            <h4>Rôles</h4>
                            {canManageRoles && guildId && member.userId !== ownerId && (
                                <button
                                    type="button"
                                    className="popout-manage"
                                    aria-expanded={editing}
                                    onClick={() => setEditing((open) => !open)}
                                >
                                    <Icon name={editing ? "close" : "plus"} size={13} />
                                    {editing ? "Terminer" : "Gérer"}
                                </button>
                            )}
                        </div>

                        <div className="popout-roles">
                            {fallbackRoles.map((role) => (
                                <span className="role-chip" style={role.color ? { "--role": role.color } : undefined} key={role.roleId}>
                                    {role.iconEmoji} {role.name}
                                </span>
                            ))}
                            {member.isBot && <span className="role-chip">Bot</span>}
                        </div>

                        {editing && (
                            <div className="popout-role-editor">
                                {guildRoles === null && !error && <p className="popout-role-empty">Chargement des rôles…</p>}
                                {guildRoles?.length === 0 && <p className="popout-role-empty">Aucun rôle attribuable dans cette communauté.</p>}
                                {guildRoles?.map((role) => {
                                    const on = assignedIds.has(role.roleId);
                                    return (
                                        <label key={role.roleId} className="popout-role-row">
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                disabled={busyRoleId === role.roleId}
                                                onChange={(event) => toggleRole(role, event.target.checked)}
                                            />
                                            <span className="role-color" style={{ background: role.color || "var(--text-muted)" }} />
                                            <span className="popout-role-name">{role.iconEmoji} {role.name}</span>
                                        </label>
                                    );
                                })}
                                {error && <p className="auth-error" role="alert">{error}</p>}
                            </div>
                        )}
                    </div>

                    {!isSelf && (
                        <div className="popout-card">
                            <h4>Note personnelle</h4>
                            <p className="popout-role-empty">Visible de vous seul.</p>
                            <textarea
                                className="field-input field-textarea"
                                rows={2}
                                maxLength={500}
                                value={noteDraft}
                                onChange={(event) => setNoteDraft(event.target.value)}
                                onBlur={saveNote}
                                placeholder="Se souvenir de quelque chose sur cette personne"
                            />
                            {note?.updatedAt && (
                                <small className="popout-role-empty">
                                    Modifiée le {new Date(note.updatedAt).toLocaleDateString("fr-FR")}
                                </small>
                            )}
                        </div>
                    )}

                    {!isSelf && (
                        <button type="button" className="popout-sanction" onClick={toggleBlock}>
                            {blocked ? "Débloquer" : "Bloquer cette personne"}
                        </button>
                    )}

                    {canModerate && guildId && member.userId !== ownerId && (
                        <button type="button" className="popout-sanction" onClick={() => { onClose(); onSanction?.(member); }}>
                            Modérer ce membre…
                        </button>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
