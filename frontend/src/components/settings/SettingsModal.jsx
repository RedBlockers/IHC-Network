import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { useAuth } from "../../context/useAuth.js";
import { useCustomization } from "../../context/useCustomization.js";
import { THEMES, DENSITIES, BANNER_BEHAVIOURS, ACCENT_PRESETS } from "../../context/customization-options.js";
import { contrastRatio } from "../../lib/contrast.js";
import { backgroundForTheme } from "../../lib/roleColors.js";
import Modal from "../ui/Modal.jsx";
import Icon from "../ui/Icon.jsx";
import Avatar from "../ui/Avatar.jsx";
import AvatarCropper from "./AvatarCropper.jsx";
import SecuritySettings from "./SecuritySettings.jsx";
import NotificationSettings from "./NotificationSettings.jsx";
import SettingsNavigation from "./SettingsNavigation.jsx";
import DiscardChangesDialog from "./DiscardChangesDialog.jsx";
import AccountPrivacy from "./AccountPrivacy.jsx";
import { EDITORS } from "../../lib/codeReferences.js";
import { readEditorPreference, writeEditorPreference } from "../../lib/editorPreference.js";

const STATUS = [
    ["online", "En ligne"],
    ["idle", "Absent"],
    ["dnd", "Ne pas déranger"],
    ["invisible", "Invisible"],
];

const ACCOUNT_SECTIONS = [
    {
        label: "Compte",
        items: [
            { id: "profile", label: "Mon profil", icon: "users" },
            { id: "security", label: "Sécurité", icon: "check" },
            { id: "privacy", label: "Données personnelles", icon: "settings" },
        ],
    },
    {
        label: "Interface",
        items: [
            { id: "appearance", label: "Apparence", icon: "smile" },
            { id: "notifications", label: "Notifications", icon: "bell" },
        ],
    },
    {
        label: "Outils",
        items: [{ id: "advanced", label: "Avancé", icon: "settings" }],
    },
];

const ACCOUNT_META = {
    profile: {
        eyebrow: "Compte",
        title: "Mon profil",
        description: "Comment les autres vous voient : nom, visage, activité.",
    },
    security: { eyebrow: "Compte", title: "Sécurité", description: "Clés d’accès, appareils et connexions." },
    privacy: {
        title: "Données personnelles",
        description: "Récupérer vos données et gérer la fermeture de votre compte.",
    },
    appearance: { eyebrow: "Interface", title: "Apparence", description: "Thème, densité et accent de l’interface." },
    notifications: { eyebrow: "Interface", title: "Notifications", description: "Ce qui vous prévient, et où." },
    advanced: { eyebrow: "Outils", title: "Avancé", description: "Des réglages qui ne concernent que cet appareil." },
};

function useObjectUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
    return url;
}

export default function SettingsModal({ open, onClose, guilds = [] }) {
    const { user, setUser } = useAuth();
    const { theme, setTheme, userAccent, setUserAccent, preferences, update } = useCustomization();
    const [section, setSection] = useState("profile");
    const [handle, setHandle] = useState(user.handle);
    const [displayName, setDisplayName] = useState(user.displayName || "");
    const [aboutMe, setAboutMe] = useState(user.aboutMe || "");
    const [activityText, setActivityText] = useState(user.activityText || "");
    const [decoration, setDecoration] = useState(user.avatarDecoration || "none");
    const [catalogue, setCatalogue] = useState([]);
    const [editor, setEditor] = useState(() => readEditorPreference());
    const [statusPreference, setStatusPreference] = useState(user.statusPreference || "online");
    const [avatar, setAvatar] = useState(null);
    const [pendingAvatar, setPendingAvatar] = useState(null);
    const [bannerImage, setBannerImage] = useState(null);
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const [removeBannerImage, setRemoveBannerImage] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const avatarUrl = useObjectUrl(avatar) || (!removeAvatar ? user.avatar : null);
    const bannerUrl = useObjectUrl(bannerImage) || (!removeBannerImage ? user.bannerImage : null);

    const dirty =
        avatar !== null ||
        bannerImage !== null ||
        removeAvatar ||
        removeBannerImage ||
        handle !== user.handle ||
        displayName !== (user.displayName || "") ||
        aboutMe !== (user.aboutMe || "") ||
        activityText !== (user.activityText || "") ||
        statusPreference !== (user.statusPreference || "online") ||
        decoration !== (user.avatarDecoration || "none");

    function reset() {
        setHandle(user.handle);
        setDisplayName(user.displayName || "");
        setAboutMe(user.aboutMe || "");
        setActivityText(user.activityText || "");
        setStatusPreference(user.statusPreference || "online");
        setDecoration(user.avatarDecoration || "none");
        setAvatar(null);
        setBannerImage(null);
        setRemoveAvatar(false);
        setRemoveBannerImage(false);
        setError(null);
    }

    function requestClose() {
        if (confirmDiscard) {
            setConfirmDiscard(false);
            return;
        }
        if (dirty) {
            setConfirmDiscard(true);
            return;
        }
        onClose();
    }

    async function saveProfile(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const body = new FormData();
            body.append("handle", handle.trim());
            body.append("displayName", displayName.trim());
            body.append("aboutMe", aboutMe.trim());
            body.append("activityText", activityText.trim());
            body.append("statusPreference", statusPreference);
            body.append("avatarDecoration", decoration);
            body.append("removeAvatar", String(removeAvatar));
            body.append("removeBannerImage", String(removeBannerImage));
            if (avatar) body.append("avatar", avatar);
            if (bannerImage) body.append("bannerImage", bannerImage);
            const { user: updated } = await api("/users/me", { method: "PATCH", body });
            setUser(updated);
            onClose();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Profil non enregistré.");
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        let cancelled = false;
        api("/users/decorations")
            .then((result) => !cancelled && setCatalogue(result.decorations))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const preview = {
        ...user,
        handle,
        displayName,
        aboutMe,
        activityText,
        avatar: avatarUrl,
        avatarDecoration: decoration,
    };
    const accentRatio = contrastRatio(userAccent, backgroundForTheme(theme));
    const meta = ACCOUNT_META[section];

    return (
        <Modal open={open} onClose={requestClose} title="Paramètres du compte" className="modal-account-settings">
            <div className="account-settings-shell">
                <SettingsNavigation
                    groups={ACCOUNT_SECTIONS}
                    section={section}
                    onSelect={setSection}
                    label="Rubriques du compte"
                    identity={
                        <>
                            <span>
                                <Avatar
                                    user={preview}
                                    size={38}
                                    presence={statusPreference === "invisible" ? "offline" : statusPreference}
                                />
                            </span>
                            <div>
                                <strong>{user.displayName || user.handle}</strong>
                                <small>Paramètres du compte</small>
                            </div>
                        </>
                    }
                />

                <div className="settings-main" key={section}>
                    <header className="settings-section-head">
                        <h2>{meta.title}</h2>
                        <p>{meta.description}</p>
                    </header>

                    {section === "notifications" ? (
                        <div className="account-settings-content">
                            <NotificationSettings guilds={guilds} />
                        </div>
                    ) : section === "security" ? (
                        <div className="account-settings-content">
                            <SecuritySettings />
                        </div>
                    ) : section === "privacy" ? (
                        <div className="account-settings-content">
                            <AccountPrivacy guilds={guilds} />
                        </div>
                    ) : section === "advanced" ? (
                        <div className="account-settings-content">
                            <section className="settings-section">
                                <h3 className="settings-h">Ouvrir le code dans votre éditeur</h3>
                                <p className="settings-p">
                                    Une référence comme <code>src/lib/outbox.js:42</code> écrite dans un message devient
                                    un lien qui ouvre le fichier à la bonne ligne. Ce réglage reste sur cet appareil.
                                </p>
                                <div className="automod-pair">
                                    <label className="field">
                                        <span className="field-label">Éditeur</span>
                                        <select
                                            className="field-input"
                                            value={editor.editor}
                                            onChange={(event) => {
                                                const next = { ...editor, editor: event.target.value };
                                                setEditor(next);
                                                writeEditorPreference(next);
                                            }}
                                        >
                                            {Object.values(EDITORS).map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Racine du dépôt sur cet appareil</span>
                                        <input
                                            className="field-input"
                                            value={editor.root}
                                            placeholder="/home/vous/projets/qweillo"
                                            onChange={(event) => {
                                                const next = { ...editor, root: event.target.value };
                                                setEditor(next);
                                                writeEditorPreference(next);
                                            }}
                                        />
                                        <span className="field-hint">
                                            Sans elle, l’éditeur ouvrirait un chemin relatif depuis son propre
                                            répertoire de travail.
                                        </span>
                                    </label>
                                </div>
                            </section>
                        </div>
                    ) : section === "profile" ? (
                        <div className="account-settings-content">
                            <form className="profile-settings" onSubmit={saveProfile}>
                                <section className="profile-preview-card">
                                    <div
                                        className={`profile-preview-banner${bannerUrl ? " has-image" : ""}`}
                                        style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
                                    />
                                    <div className="profile-preview-main">
                                        <Avatar
                                            user={preview}
                                            size={72}
                                            presence={statusPreference === "invisible" ? "offline" : statusPreference}
                                        />
                                        <div>
                                            <strong>{displayName || handle}</strong>
                                            <span>@{handle}</span>
                                            {activityText && <small>{activityText}</small>}
                                        </div>
                                    </div>
                                    {aboutMe && <p>{aboutMe}</p>}
                                </section>

                                <section className="settings-section">
                                    <h3 className="settings-h">Avatar, bannière & décoration</h3>
                                    <div className="profile-assets">
                                        <label>
                                            Changer l’avatar
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/gif"
                                                onChange={(e) => {
                                                    setPendingAvatar(e.target.files?.[0] || null);
                                                    e.target.value = "";
                                                }}
                                            />
                                        </label>
                                        {avatarUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAvatar(null);
                                                    setRemoveAvatar(true);
                                                }}
                                            >
                                                Retirer l’avatar
                                            </button>
                                        )}
                                        <label>
                                            Changer la bannière
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/gif"
                                                onChange={(e) => {
                                                    setBannerImage(e.target.files?.[0] || null);
                                                    setRemoveBannerImage(false);
                                                }}
                                            />
                                        </label>
                                        {bannerUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBannerImage(null);
                                                    setRemoveBannerImage(true);
                                                }}
                                            >
                                                Retirer la bannière
                                            </button>
                                        )}
                                    </div>
                                    {catalogue.length > 0 && (
                                        <div
                                            className="decoration-picker"
                                            role="radiogroup"
                                            aria-label="Décoration de profil"
                                        >
                                            {catalogue.map((item, index) => (
                                                <button
                                                    type="button"
                                                    key={item.id}
                                                    role="radio"
                                                    aria-checked={decoration === item.id}
                                                    aria-label={item.label}
                                                    tabIndex={decoration === item.id ? 0 : -1}
                                                    className={`decoration-option${decoration === item.id ? " is-on" : ""}`}
                                                    onClick={() => setDecoration(item.id)}
                                                    onKeyDown={(event) => {
                                                        if (event.altKey || event.ctrlKey || event.metaKey) return;
                                                        const direction = ["ArrowRight", "ArrowDown"].includes(
                                                            event.key
                                                        )
                                                            ? 1
                                                            : ["ArrowLeft", "ArrowUp"].includes(event.key)
                                                              ? -1
                                                              : 0;
                                                        if (!direction && !["Home", "End"].includes(event.key)) return;
                                                        event.preventDefault();
                                                        const next =
                                                            event.key === "Home"
                                                                ? 0
                                                                : event.key === "End"
                                                                  ? catalogue.length - 1
                                                                  : (index + direction + catalogue.length) %
                                                                    catalogue.length;
                                                        setDecoration(catalogue[next].id);
                                                        const options =
                                                            event.currentTarget.parentElement.querySelectorAll(
                                                                '[role="radio"]'
                                                            );
                                                        options[next]?.focus();
                                                    }}
                                                >
                                                    <Avatar
                                                        user={{ ...preview, avatarDecoration: item.id }}
                                                        size={52}
                                                    />
                                                    <small>{item.label}</small>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className="settings-section">
                                    <h3 className="settings-h">À votre sujet</h3>
                                    <div className="profile-fields-grid">
                                        <label className="field">
                                            <span className="field-label">Pseudo</span>
                                            <input
                                                className="field-input"
                                                value={handle}
                                                onChange={(e) => setHandle(e.target.value)}
                                                minLength={3}
                                                maxLength={20}
                                                required
                                            />
                                        </label>
                                        <label className="field">
                                            <span className="field-label">Nom affiché</span>
                                            <input
                                                className="field-input"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                maxLength={32}
                                                required
                                            />
                                        </label>
                                    </div>
                                    <label className="field">
                                        <span className="field-label">Activité</span>
                                        <input
                                            className="field-input"
                                            value={activityText}
                                            onChange={(e) => setActivityText(e.target.value)}
                                            maxLength={80}
                                            placeholder="Ce que vous faites en ce moment"
                                        />
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Biographie</span>
                                        <textarea
                                            className="field-input field-textarea"
                                            value={aboutMe}
                                            onChange={(e) => setAboutMe(e.target.value)}
                                            maxLength={200}
                                            rows={3}
                                        />
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Statut</span>
                                        <select
                                            className="field-input"
                                            value={statusPreference}
                                            onChange={(e) => setStatusPreference(e.target.value)}
                                        >
                                            {STATUS.map(([value, label]) => (
                                                <option value={value} key={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </section>
                                {error && (
                                    <p className="auth-error" role="alert">
                                        {error}
                                    </p>
                                )}

                                {dirty && (
                                    <div className="settings-savebar" role="status">
                                        <p>
                                            <Icon name="alert" size={14} /> Modifications non enregistrées
                                        </p>
                                        <div>
                                            <button type="button" className="btn btn-ghost" onClick={reset}>
                                                Réinitialiser
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-accent"
                                                disabled={busy || handle.trim().length < 3}
                                            >
                                                {busy ? "Enregistrement…" : "Enregistrer le profil"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    ) : (
                        <div className="account-settings-content appearance-settings">
                            <section className="settings-section">
                                <h3 className="settings-h">Thème</h3>
                                <p className="settings-p">
                                    L’ambiance de toute l’interface. Un thème de communauté s’y superpose sans jamais le
                                    remplacer.
                                </p>
                                <div className="theme-row" role="radiogroup" aria-label="Thème de l’interface">
                                    {THEMES.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={theme === item.id}
                                            className={`theme-swatch${theme === item.id ? " is-on" : ""}`}
                                            onClick={() => setTheme(item.id)}
                                        >
                                            <span className="theme-chip">
                                                {item.swatch.map((color) => (
                                                    <span key={color} style={{ background: color }} />
                                                ))}
                                            </span>
                                            <span className="theme-name">{item.label}</span>
                                            <small className="theme-note">{item.note}</small>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="settings-section">
                                <h3 className="settings-h">Densité</h3>
                                <p className="settings-p">La quantité d’information visible sans défilement.</p>
                                <div className="segmented" role="radiogroup" aria-label="Densité d’affichage">
                                    {DENSITIES.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={preferences.density === item.id}
                                            className={preferences.density === item.id ? "is-on" : ""}
                                            onClick={() => update({ density: item.id })}
                                        >
                                            {item.label}
                                            <small>{item.note}</small>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="settings-section">
                                <h3 className="settings-h">Couleur d’accent</h3>
                                <p className="settings-p">Utilisée quand aucune communauté n’impose la sienne.</p>
                                <div className="accent-row">
                                    {ACCENT_PRESETS.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={`accent-dot${userAccent.toLowerCase() === item.value.toLowerCase() ? " is-on" : ""}`}
                                            style={{ background: item.value }}
                                            onClick={() => setUserAccent(item.value)}
                                            aria-label={item.name}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        className="accent-custom"
                                        value={userAccent}
                                        onChange={(e) => setUserAccent(e.target.value)}
                                        aria-label="Couleur d’accent personnalisée"
                                    />
                                </div>
                                {accentRatio < 3 && (
                                    <p className="settings-warning" role="status">
                                        Contraste {accentRatio.toFixed(2)}:1 sur le fond du thème — sous le seuil de 3:1
                                        des surfaces colorées. Les libellés basculent sur le texte standard pour rester
                                        lisibles.
                                    </p>
                                )}
                            </section>

                            <section className="settings-section">
                                <h3 className="settings-h">Accessibilité</h3>
                                <p className="settings-p">
                                    Ces réglages priment toujours sur le cosmétique d’une communauté.
                                </p>
                                <ul className="settings-toggles">
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={preferences.reduceMotion}
                                                onChange={(e) => update({ reduceMotion: e.target.checked })}
                                            />
                                            <span>
                                                <strong>Réduire les animations</strong>
                                                <small>Remplace tous les mouvements par des fondus de 80 ms.</small>
                                            </span>
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={preferences.highContrast}
                                                onChange={(e) => update({ highContrast: e.target.checked })}
                                            />
                                            <span>
                                                <strong>Contraste renforcé</strong>
                                                <small>Bordures et textes secondaires plus marqués.</small>
                                            </span>
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={preferences.hideBanners}
                                                onChange={(e) => update({ hideBanners: e.target.checked })}
                                            />
                                            <span>
                                                <strong>Masquer les bannières</strong>
                                                <small>Remplace chaque bannière par sa version texte.</small>
                                            </span>
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={preferences.neutralizeCommunityThemes}
                                                onChange={(e) =>
                                                    update({ neutralizeCommunityThemes: e.target.checked })
                                                }
                                            />
                                            <span>
                                                <strong>Neutraliser les thèmes de communauté</strong>
                                                <small>Conserve partout votre accent et vos formes.</small>
                                            </span>
                                        </label>
                                    </li>
                                </ul>
                            </section>

                            <section className="settings-section">
                                <h3 className="settings-h">Bannières de salon</h3>
                                <div className="segmented" role="radiogroup" aria-label="Comportement des bannières">
                                    {BANNER_BEHAVIOURS.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={preferences.bannerBehaviour === item.id}
                                            className={preferences.bannerBehaviour === item.id ? "is-on" : ""}
                                            disabled={preferences.hideBanners}
                                            onClick={() => update({ bannerBehaviour: item.id })}
                                        >
                                            {item.label}
                                            <small>{item.note}</small>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {confirmDiscard && (
                    <DiscardChangesDialog onCancel={() => setConfirmDiscard(false)} onDiscard={onClose} />
                )}
            </div>
            <AvatarCropper
                file={pendingAvatar}
                onCancel={() => setPendingAvatar(null)}
                onConfirm={(file) => {
                    setAvatar(file);
                    setPendingAvatar(null);
                    setRemoveAvatar(false);
                }}
            />
        </Modal>
    );
}
