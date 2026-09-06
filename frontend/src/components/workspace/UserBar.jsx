import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { useAuth } from "../../context/useAuth.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import PresenceDot from "../ui/PresenceDot.jsx";
import Tooltip from "../ui/Tooltip.jsx";

const STATUSES = [
    { id: "online", label: "En ligne", note: "Visible et joignable." },
    { id: "idle", label: "Absent", note: "Présent sans être disponible." },
    { id: "dnd", label: "Ne pas déranger", note: "Aucune notification de bureau." },
    { id: "invisible", label: "Invisible", note: "Vous apparaissez hors ligne." },
];

export default function UserBar({ user, onOpenSettings }) {
    const { setUser } = useAuth();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [activity, setActivity] = useState(user?.activityText || "");
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const [syncedActivity, setSyncedActivity] = useState(user?.activityText || "");
    if ((user?.activityText || "") !== syncedActivity) {
        setSyncedActivity(user?.activityText || "");
        setActivity(user?.activityText || "");
    }

    const close = useCallback(
        ({ restoreFocus = true } = {}) => {
            setOpen(false);
            setError(null);
            if (restoreFocus) triggerRef.current?.focus();
        },
        []
    );

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) close({ restoreFocus: false });
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                close();
            }
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [close, open]);

    useEffect(() => {
        if (open) menuRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"], [role="menuitemradio"]')?.focus();
    }, [open]);

    const onMenuKeyDown = (event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const items = [...menuRef.current.querySelectorAll('[role="menuitemradio"], [role="menuitem"]')];
        const index = items.indexOf(document.activeElement);
        const next = event.key === "ArrowDown" ? index + 1 : index - 1;
        items[(next + items.length) % items.length]?.focus();
    };

    async function patchProfile(patch, { keepOpen = false } = {}) {
        setBusy(true);
        setError(null);
        try {
            const { user: updated } = await api("/users/me", { method: "PATCH", body: patch });
            setUser(updated);
            if (!keepOpen) close();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Statut non enregistré.");
        } finally {
            setBusy(false);
        }
    }

    if (!user) return null;

    const current = user.statusPreference || "online";
    const shown = current === "invisible" ? "offline" : current;
    const currentLabel = STATUSES.find((s) => s.id === current)?.label ?? "En ligne";

    return (
        <div className="userbar" ref={rootRef}>
            <Tooltip label="Changer de statut">
            <button
                ref={triggerRef}
                type="button"
                className="userbar-identity"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => (open ? close() : setOpen(true))}
            >
                <Avatar user={user} size={34} presence={shown} />
                <span className="userbar-id">
                    <span className="userbar-name">{user.displayName || user.handle}</span>
                    <span className="userbar-status">{user.activityText || currentLabel}</span>
                </span>
            </button>
            </Tooltip>

            <Tooltip label="Réglages">
                <button className="userbar-btn" onClick={onOpenSettings} aria-label="Réglages du compte">
                    <Icon name="settings" size={18} />
                </button>
            </Tooltip>

            {open && (
                <div className="status-menu" role="menu" aria-label="Statut et activité" ref={menuRef} onKeyDown={onMenuKeyDown}>
                    <p className="status-menu-head">
                        {user.displayName || user.handle}
                        <span>@{user.handle}</span>
                    </p>

                    {STATUSES.map((status) => (
                        <button
                            key={status.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={current === status.id}
                            className={`status-menu-item${current === status.id ? " is-on" : ""}`}
                            disabled={busy}
                            onClick={() => patchProfile({ statusPreference: status.id })}
                        >
                            <PresenceDot status={status.id === "invisible" ? "offline" : status.id} size={10} />
                            <span>
                                <strong>{status.label}</strong>
                                <small>{status.note}</small>
                            </span>
                            {current === status.id && <Icon name="check" size={14} />}
                        </button>
                    ))}

                    <form
                        className="status-menu-activity"
                        onSubmit={(event) => {
                            event.preventDefault();
                            patchProfile({ activityText: activity.trim() });
                        }}
                    >
                        <label className="field">
                            <span className="field-label">Activité</span>
                            <input
                                className="field-input"
                                value={activity}
                                maxLength={80}
                                placeholder="Ce que vous faites en ce moment"
                                onChange={(event) => setActivity(event.target.value)}
                            />
                        </label>
                        <div className="status-menu-activity-actions">
                            {user.activityText && (
                                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setActivity(""); patchProfile({ activityText: "" }); }}>
                                    Effacer
                                </button>
                            )}
                            <button className="btn btn-accent" disabled={busy || activity.trim() === (user.activityText || "")}>
                                {busy ? "…" : "Définir"}
                            </button>
                        </div>
                    </form>

                    {error && <p className="auth-error" role="alert">{error}</p>}

                    <button
                        type="button"
                        role="menuitem"
                        className="status-menu-item status-menu-settings"
                        onClick={() => {
                            close({ restoreFocus: false });
                            onOpenSettings();
                        }}
                    >
                        <Icon name="settings" size={14} />
                        <span><strong>Paramètres du compte</strong></span>
                    </button>
                </div>
            )}
        </div>
    );
}
