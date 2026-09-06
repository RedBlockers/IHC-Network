import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import BoardState from "./BoardState.jsx";

export default function PollCard({ channelId, messageId, currentUserId }) {
    const resource = useChannelResource(channelId, `polls/${messageId}`, "poll:updated poll:closed");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const poll = resource.data?.poll;
    async function act(path, method, body) {
        if (busy || poll.closed) return;
        setBusy(true);
        setError(null);
        try {
            await api(`/channels/${channelId}/polls/${messageId}${path}`, { method, body });
            resource.reload();
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : "Le vote n’a pas été enregistré. Réessayez.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <BoardState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
            {poll && (
                <section className="poll-card" aria-label={`Sondage : ${poll.question}`}>
                    <h4>{poll.question}</h4>
                    <ul>
                        {poll.options.map((option) => (
                            <li key={option.optionId}>
                                <button
                                    type="button"
                                    className={poll.yourVote === option.optionId ? "is-mine" : ""}
                                    aria-pressed={poll.yourVote === option.optionId}
                                    disabled={poll.closed || busy}
                                    onClick={() => act("/vote", "PUT", { optionId: option.optionId })}
                                >
                                    <span
                                        className="poll-fill"
                                        style={{ width: `${option.share}%` }}
                                        aria-hidden="true"
                                    />
                                    <span className="poll-label">
                                        {option.label}
                                        {poll.yourVote === option.optionId && <em> · votre voix</em>}
                                    </span>
                                    <span className="poll-share">{option.share}%</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <footer>
                        {poll.totalVotes} vote{poll.totalVotes > 1 ? "s" : ""}
                        {poll.anonymous ? " · anonyme" : ""}
                        {poll.closed ? " · terminé" : " · vous pouvez changer votre vote"}
                        {!poll.closed &&
                            poll.closesAt &&
                            ` · fin le ${new Date(poll.closesAt).toLocaleString("fr-FR")}`}
                    </footer>
                    {!poll.closed && Number(poll.createdBy) === Number(currentUserId) && (
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => act("", "DELETE")}
                        >
                            Terminer le sondage
                        </button>
                    )}
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                </section>
            )}
        </BoardState>
    );
}
