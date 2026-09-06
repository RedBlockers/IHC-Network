import { activityIframeSrc, activityReferrerPolicy, activitySandbox } from "../../lib/activityFrame.js";

export default function ActivityFrame({ session, onClose }) {
    let src = "";
    let error = null;
    try {
        src = activityIframeSrc(session.origin, session.token);
    } catch (err) {
        error = err.message;
    }

    return (
        <section className="activity-frame">
            <header>
                <h3>{session.name}</h3>
                <button type="button" className="btn" onClick={onClose}>
                    Fermer
                </button>
            </header>
            {error ? (
                <p role="alert">{error}</p>
            ) : (
                <iframe
                    title={session.name}
                    src={src}
                    sandbox={activitySandbox()}
                    referrerPolicy={activityReferrerPolicy()}
                    allow="autoplay; fullscreen"
                />
            )}
        </section>
    );
}
