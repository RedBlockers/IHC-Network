export default function BoardState({ loading, error, onRetry, children }) {
    if (error)
        return (
            <div className="board-state" role="alert">
                <p>{error}</p>
                <button type="button" className="btn btn-ghost" onClick={onRetry}>
                    Réessayer
                </button>
            </div>
        );
    if (loading)
        return (
            <p className="board-state" role="status">
                Chargement…
            </p>
        );
    return children;
}
