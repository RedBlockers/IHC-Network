import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../context/useAuth.js";
import { api, ApiError } from "../lib/api";
import { bannerGradient } from "../lib/banners.js";
import Logo from "../components/ui/Logo.jsx";
import Splash from "../components/ui/Splash.jsx";

export default function InvitePage() {
    const { code } = useParams();
    const navigate = useNavigate();
    const { status } = useAuth();
    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        api(`/invites/${encodeURIComponent(code)}`, { signal: controller.signal })
            .then(({ invite: preview }) => setInvite(preview))
            .catch((err) => {
                if (err.name !== "AbortError") {
                    setError(err instanceof ApiError ? err.message : "Cette invitation est inaccessible.");
                }
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [code]);

    async function accept() {
        setBusy(true);
        setError(null);
        try {
            const { guildId } = await api(`/invites/${encodeURIComponent(code)}/accept`, { method: "POST" });
            navigate(`/?guild=${guildId}`, { replace: true });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Impossible de rejoindre cette communauté.");
            setBusy(false);
        }
    }

    if (loading || status === "loading") return <Splash />;

    const returnTo = `/invite/${code}`;
    const authQuery = `?returnTo=${encodeURIComponent(returnTo)}`;

    return (
        <main className="invite-page">
            <Link className="invite-brand" to="/" aria-label="qweillo">
                <Logo size={34} withWordmark />
            </Link>

            <section className="invite-card" aria-labelledby="invite-title">
                <div
                    className="invite-banner"
                    style={{ background: bannerGradient(invite?.guild?.banner) }}
                    aria-hidden="true"
                >
                    <span className="invite-mark">
                        {invite?.guild?.icon ? <img src={invite.guild.icon} alt="" /> : invite?.guild?.name?.charAt(0)}
                    </span>
                </div>
                <div className="invite-body">
                    {invite ? (
                        <>
                            <p className="invite-eyebrow">Vous êtes invité·e</p>
                            <h1 id="invite-title">{invite.guild.name}</h1>
                            {invite.guild.description && <p className="invite-description">{invite.guild.description}</p>}
                            <div className="invite-facts">
                                <span>{invite.guild.memberCount.toLocaleString("fr-FR")} membres</span>
                                {invite.expiresAt && (
                                    <span>Valable jusqu’au {new Date(invite.expiresAt).toLocaleDateString("fr-FR")}</span>
                                )}
                            </div>

                            {error && <p className="auth-error" role="alert">{error}</p>}

                            {status === "authed" ? (
                                <button className="btn btn-accent btn-block" onClick={accept} disabled={busy}>
                                    {busy ? "Entrée en cours…" : `Rejoindre ${invite.guild.name}`}
                                </button>
                            ) : (
                                <div className="invite-actions">
                                    <Link className="btn btn-accent" to={`/register${authQuery}`}>Créer un compte</Link>
                                    <Link className="btn btn-ghost" to={`/login${authQuery}`}>Se connecter</Link>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="invite-eyebrow">Invitation indisponible</p>
                            <h1 id="invite-title">Ce lien n’est plus valable</h1>
                            <p className="invite-description">Demandez un nouveau lien à un membre de la communauté.</p>
                            {error && <p className="auth-error" role="alert">{error}</p>}
                            <Link className="btn btn-ghost btn-block" to="/">Retour à qweillo</Link>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
}
