import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../lib/api";
import { bannerGradient } from "../../lib/banners.js";
import Modal from "../ui/Modal.jsx";
import Icon from "../ui/Icon.jsx";
import SettingsNavigation from "../settings/SettingsNavigation.jsx";
import DiscardChangesDialog from "../settings/DiscardChangesDialog.jsx";
import GuildLifecycleSettings from "./GuildLifecycleSettings.jsx";
import { useAuth } from "../../context/useAuth.js";
import BannerAccentPicker from "../settings/BannerAccentPicker.jsx";
import RoleAdministration from "./RoleAdministration.jsx";
import AuditLog from "./AuditLog.jsx";
import ReportQueue from "./ReportQueue.jsx";
import OnboardingAdmin from "./OnboardingAdmin.jsx";
import AutomodAdmin from "./AutomodAdmin.jsx";
import GuildOverview from "./GuildOverview.jsx";
import GuildSuspension from "./GuildSuspension.jsx";
import BannerFocusPicker from "../settings/BannerFocusPicker.jsx";
import ThemeStudio from "./ThemeStudio.jsx";
import MediaLibraryAdmin from "./MediaLibraryAdmin.jsx";
import CommunityAppsAdmin from "./CommunityAppsAdmin.jsx";
import MemberDirectory from "./MemberDirectory.jsx";

const ADMIN_SECTIONS = [
    {
        label: "Identité",
        items: [
            { id: "overview", label: "Vue d’ensemble", icon: "hash" },
            { id: "identity", label: "Profil & bannière", icon: "settings" },
            { id: "theme", label: "Thème", icon: "smile" },
        ],
    },
    {
        label: "Personnes",
        items: [
            { id: "roles", label: "Rôles & permissions", icon: "users" },
            { id: "members", label: "Membres", icon: "users" },
            { id: "onboarding", label: "Accueil", icon: "invite" },
        ],
    },
    {
        label: "Plateforme",
        items: [
            { id: "media", label: "Emojis & autocollants", icon: "smile" },
            { id: "integrations", label: "Intégrations", icon: "invite" },
        ],
    },
    {
        label: "Sécurité",
        items: [
            { id: "reports", label: "Signalements", icon: "bell" },
            { id: "automod", label: "Filtres automatiques", icon: "hash" },
            { id: "audit", label: "Journal d’audit", icon: "crown" },
            { id: "suspension", label: "Suspension", icon: "alert" },
        ],
    },
];

const SECTION_META = {
    overview: {
        eyebrow: "Identité",
        title: "Vue d’ensemble",
        description: "L’essentiel de la communauté en un coup d’œil.",
    },
    identity: {
        eyebrow: "Identité",
        title: "Profil & bannière",
        description: "Le nom, le visage et la couverture du serveur.",
    },
    theme: { eyebrow: "Identité", title: "Thème", description: "L’ambiance visuelle du serveur." },
    roles: { eyebrow: "Personnes", title: "Rôles & permissions", description: "Qui peut quoi, et où." },
    members: {
        eyebrow: "Personnes",
        title: "Membres",
        description: "Les personnes présentes, leurs rôles et leur activité.",
    },
    onboarding: {
        eyebrow: "Personnes",
        title: "Accueil",
        description: "Ce qu’un arrivant doit faire avant de participer.",
    },
    media: {
        eyebrow: "Plateforme",
        title: "Emojis & autocollants",
        description: "La bibliothèque d’expressions de la communauté.",
    },
    integrations: {
        eyebrow: "Plateforme",
        title: "Intégrations",
        description: "Les applications branchées sur le serveur.",
    },
    reports: {
        eyebrow: "Sécurité",
        title: "Signalements",
        description: "Les messages signalés par les membres, à traiter.",
    },
    automod: {
        eyebrow: "Sécurité",
        title: "Filtres automatiques",
        description: "Les règles qui agissent avant qu’un modérateur n’intervienne.",
    },
    audit: { eyebrow: "Sécurité", title: "Journal d’audit", description: "La mémoire des actions de modération." },
    suspension: {
        eyebrow: "Sécurité",
        title: "Suspension",
        description: "La mesure d’urgence du serveur, réversible en un clic.",
    },
    lifecycle: { title: "Propriété", description: "Transférer ou supprimer votre communauté." },
};

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp,image/gif";

function useObjectUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(
        () => () => {
            if (url) URL.revokeObjectURL(url);
        },
        [url]
    );
    return url;
}

function initials(name) {
    return name.trim().slice(0, 2).toUpperCase() || "Q";
}

export default function ServerSettingsModal({ open, guild, channelId = null, onClose, onUpdated, onDeleted }) {
    const { user } = useAuth();
    const [name, setName] = useState(guild?.name || "");
    const [description, setDescription] = useState(guild?.description || "");
    const [banner, setBanner] = useState(guild?.banner || "nebula");
    const [accent, setAccent] = useState(guild?.accent || "#12b5a2");
    const [icon, setIcon] = useState(null);
    const [bannerImage, setBannerImage] = useState(null);
    const [focus, setFocus] = useState({
        focusX: guild?.bannerFocusX ?? 50,
        focusY: guild?.bannerFocusY ?? 50,
    });
    const [removeIcon, setRemoveIcon] = useState(false);
    const [removeBannerImage, setRemoveBannerImage] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [section, setSection] = useState("overview");
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const iconObjectUrl = useObjectUrl(icon);
    const bannerObjectUrl = useObjectUrl(bannerImage);

    const iconPreview = iconObjectUrl || (!removeIcon ? guild?.icon : null);
    const bannerPreview = bannerObjectUrl || (!removeBannerImage ? guild?.bannerImage : null);

    const dirty =
        Boolean(guild) &&
        (icon !== null ||
            bannerImage !== null ||
            removeIcon ||
            removeBannerImage ||
            name !== (guild.name || "") ||
            description !== (guild.description || "") ||
            banner !== (guild.banner || "nebula") ||
            accent !== (guild.accent || "#12b5a2") ||
            focus.focusX !== (guild.bannerFocusX ?? 50) ||
            focus.focusY !== (guild.bannerFocusY ?? 50));

    function chooseIcon(event) {
        const file = event.target.files?.[0] ?? null;
        setIcon(file);
        if (file) setRemoveIcon(false);
        event.target.value = "";
    }

    function chooseBanner(event) {
        const file = event.target.files?.[0] ?? null;
        setBannerImage(file);
        if (file) setRemoveBannerImage(false);
        event.target.value = "";
    }

    function selectGradient(value) {
        setBanner(value);
        setBannerImage(null);
        if (guild.bannerImage) setRemoveBannerImage(true);
    }

    function reset() {
        setName(guild.name || "");
        setDescription(guild.description || "");
        setBanner(guild.banner || "nebula");
        setAccent(guild.accent || "#12b5a2");
        setIcon(null);
        setBannerImage(null);
        setRemoveIcon(false);
        setRemoveBannerImage(false);
        setFocus({ focusX: guild.bannerFocusX ?? 50, focusY: guild.bannerFocusY ?? 50 });
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

    async function submit(event) {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const body = new FormData();
            body.append("name", name.trim());
            body.append("description", description.trim());
            body.append("banner", banner);
            body.append("accent", accent);
            body.append("removeIcon", String(removeIcon));
            body.append("removeBannerImage", String(removeBannerImage));
            if (icon) body.append("icon", icon);
            if (bannerImage) body.append("bannerImage", bannerImage);
            body.append("bannerFocusX", String(focus.focusX));
            body.append("bannerFocusY", String(focus.focusY));
            const { guild: updated } = await api(`/guilds/${guild.guildId}`, { method: "PATCH", body });
            onUpdated(updated);
            onClose();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
        } finally {
            setBusy(false);
        }
    }

    if (!guild) return null;

    const meta = SECTION_META[section];
    const groups =
        Number(guild.ownerId) === Number(user.userId)
            ? [...ADMIN_SECTIONS, { label: "Gestion", items: [{ id: "lifecycle", label: "Propriété", icon: "crown" }] }]
            : ADMIN_SECTIONS;

    return (
        <Modal open={open} onClose={requestClose} title="Administration du serveur" className="modal-server-admin">
            <div className="server-admin-shell" style={{ "--admin-accent": accent }}>
                <SettingsNavigation
                    groups={groups}
                    section={section}
                    onSelect={setSection}
                    label="Rubriques du serveur"
                    identity={
                        <>
                            <span>{iconPreview ? <img src={iconPreview} alt="" /> : initials(name)}</span>
                            <div>
                                <strong>{name || guild.name}</strong>
                                <small>Paramètres du serveur</small>
                            </div>
                        </>
                    }
                />

                <div className={`settings-main${section === "suspension" ? " is-danger" : ""}`} key={section}>
                    <header className="settings-section-head">
                        <h2>{meta.title}</h2>
                        <p>{meta.description}</p>
                    </header>

                    {section === "overview" ? (
                        <GuildOverview guild={guild} onGo={setSection} />
                    ) : section === "lifecycle" ? (
                        <GuildLifecycleSettings
                            guild={guild}
                            onTransferred={(updated) => {
                                onUpdated(updated);
                                onClose();
                            }}
                            onDeleted={onDeleted}
                        />
                    ) : section === "members" ? (
                        <MemberDirectory guild={guild} />
                    ) : section === "media" ? (
                        <MediaLibraryAdmin guild={guild} />
                    ) : section === "integrations" ? (
                        <CommunityAppsAdmin guild={guild} channelId={channelId} />
                    ) : section === "identity" ? (
                        <form className="server-admin-content" onSubmit={submit}>
                            <section className="server-admin-preview" aria-label="Aperçu du serveur">
                                <div
                                    className={`server-admin-preview-cover${bannerPreview ? " has-image" : ""}`}
                                    style={
                                        bannerPreview
                                            ? { backgroundImage: `url("${bannerPreview}")` }
                                            : { background: bannerGradient(banner) }
                                    }
                                />
                                <div className="server-admin-preview-body">
                                    <span className="server-admin-preview-logo">
                                        {iconPreview ? <img src={iconPreview} alt="" /> : initials(name)}
                                    </span>
                                    <div>
                                        <span>Aperçu du serveur</span>
                                        <strong>{name || guild.name}</strong>
                                        <small>{description || "Votre espace communautaire"}</small>
                                    </div>
                                </div>
                            </section>

                            <div className="server-admin-fields">
                                <label className="field">
                                    <span className="field-label">Nom du serveur</span>
                                    <input
                                        className="field-input"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        minLength={3}
                                        maxLength={50}
                                    />
                                </label>
                                <label className="field">
                                    <span className="field-label">Description</span>
                                    <textarea
                                        className="field-input field-textarea"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        maxLength={200}
                                        rows={3}
                                    />
                                </label>
                            </div>

                            <div className="server-admin-assets">
                                <section className="server-asset-card">
                                    <div>
                                        <strong>Logo</strong>
                                        <span>Carré, 512 × 512 conseillé</span>
                                    </div>
                                    <label className="server-asset-upload">
                                        Choisir une image
                                        <input type="file" accept={ACCEPTED_IMAGES} onChange={chooseIcon} />
                                    </label>
                                    {iconPreview && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => {
                                                setIcon(null);
                                                setRemoveIcon(true);
                                            }}
                                        >
                                            Retirer
                                        </button>
                                    )}
                                </section>
                                <section className="server-asset-card">
                                    <div>
                                        <strong>Image de bannière</strong>
                                        <span>Format large, 1600 × 560 conseillé</span>
                                    </div>
                                    <label className="server-asset-upload">
                                        Choisir une image
                                        <input type="file" accept={ACCEPTED_IMAGES} onChange={chooseBanner} />
                                    </label>
                                    {bannerPreview && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => {
                                                setBannerImage(null);
                                                setRemoveBannerImage(true);
                                            }}
                                        >
                                            Utiliser un dégradé
                                        </button>
                                    )}
                                </section>
                            </div>

                            {bannerPreview && (
                                <BannerFocusPicker
                                    url={bannerPreview}
                                    focusX={focus.focusX}
                                    focusY={focus.focusY}
                                    onChange={setFocus}
                                />
                            )}

                            <BannerAccentPicker
                                banner={banner}
                                onBanner={selectGradient}
                                accent={accent}
                                onAccent={setAccent}
                            />

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
                                            disabled={busy || name.trim().length < 3}
                                        >
                                            {busy ? "Enregistrement…" : "Enregistrer les modifications"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    ) : section === "onboarding" ? (
                        <OnboardingAdmin guild={guild} />
                    ) : section === "automod" ? (
                        <AutomodAdmin guild={guild} />
                    ) : section === "reports" ? (
                        <ReportQueue guild={guild} />
                    ) : section === "audit" ? (
                        <AuditLog guild={guild} />
                    ) : section === "suspension" ? (
                        <GuildSuspension guild={guild} onChanged={onUpdated} />
                    ) : section === "theme" ? (
                        <ThemeStudio guild={guild} />
                    ) : (
                        <RoleAdministration guild={guild} />
                    )}
                </div>

                {confirmDiscard && (
                    <DiscardChangesDialog onCancel={() => setConfirmDiscard(false)} onDiscard={onClose} />
                )}
            </div>
        </Modal>
    );
}
