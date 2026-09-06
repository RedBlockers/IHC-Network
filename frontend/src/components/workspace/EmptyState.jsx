import Logo from "../ui/Logo.jsx";

export default function EmptyState({ mode }) {
    return (
        <div className="empty">
            <div className="empty-mark">
                <Logo size={64} />
            </div>
            <h2 className="empty-title">
                {mode === "home" ? "Vos conversations vous attendent" : "Choisissez un salon"}
            </h2>
            <p className="empty-sub">
                {mode === "home"
                    ? "Ajoutez un ami pour démarrer une conversation privée."
                    : "Sélectionnez un salon dans la colonne de gauche pour rejoindre la discussion."}
            </p>
        </div>
    );
}
