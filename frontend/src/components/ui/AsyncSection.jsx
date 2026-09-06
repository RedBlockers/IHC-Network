export default function AsyncSection({
    status,
    count = 0,
    skeleton = null,
    empty,
    error = "Le chargement a échoué. Réessayez dans un instant.",
    announce = (n) => `${n} élément${n > 1 ? "s" : ""} chargé${n > 1 ? "s" : ""}.`,
    children,
}) {
    if (status === "loading") {
        return (
            <>
                {skeleton}
                <span className="sr-only" role="status">Chargement en cours…</span>
            </>
        );
    }

    if (status === "failed") {
        return <p className="admin-empty" role="alert">{error}</p>;
    }

    if (count === 0) {
        return (
            <p className="admin-empty" role="status">{empty}</p>
        );
    }

    return (
        <>
            <span className="sr-only" role="status">{announce(count)}</span>
            {children}
        </>
    );
}
