import { lazy, Suspense, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { downloadText } from "../../lib/calendar.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import BoardState from "./BoardState.jsx";

const SafeMarkdown = lazy(() => import("./SafeMarkdown.jsx"));
const STATUSES = [
    { id: "open", label: "Ouvert" },
    { id: "pending", label: "En attente" },
    { id: "resolved", label: "Résolu" },
    { id: "closed", label: "Fermé" },
];
const labelOf = (status) => STATUSES.find((entry) => entry.id === status)?.label ?? status;
const EVENTS = "ticket:opened ticket:updated";
const PRIORITIES = [
    ["low", "Basse"],
    ["normal", "Normale"],
    ["high", "Haute"],
    ["urgent", "Urgente"],
];

export default function TicketBoard({ channel, readOnly = false }) {
    const [filter, setFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState(null);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState({ title: "", body: "", priority: "normal" });
    const [reply, setReply] = useState("");
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const queue = useChannelResource(
        channel.channelId,
        `tickets?limit=50&page=${page}&search=${encodeURIComponent(search)}${filter ? `&status=${filter}` : ""}`,
        EVENTS
    );
    const conversation = useChannelResource(channel.channelId, selected ? `tickets/${selected}` : null, EVENTS);
    const support = Boolean(queue.data?.support);
    const assignees = useChannelResource(channel.channelId, support ? "ticket-assignees" : null);
    const ticket = conversation.data?.ticket;
    const messages = conversation.data?.messages ?? [];
    const tickets = queue.data?.tickets ?? [];

    async function act(run) {
        if (busy || readOnly) return;
        setBusy(true);
        setError(null);
        try {
            await run();
            queue.reload();
            conversation.reload();
        } catch (failure) {
            setError(
                failure instanceof ApiError ? failure.message : "La modification n’a pas été enregistrée. Réessayez."
            );
        } finally {
            setBusy(false);
        }
    }

    function open(event) {
        event.preventDefault();
        act(async () => {
            const result = await api(`/channels/${channel.channelId}/tickets`, { method: "POST", body: draft });
            setDraft({ title: "", body: "", priority: "normal" });
            setPage(0);
            setCreating(false);
            setFilter("");
            setSearch("");
            setSelected(result.ticket.ticketId);
            setReply("");
            setInternal(false);
        });
    }

    function send(event) {
        event.preventDefault();
        act(async () => {
            await api(`/channels/${channel.channelId}/tickets/${selected}/messages`, {
                method: "POST",
                body: { body: reply.trim(), internal: support && internal },
            });
            setReply("");
        });
    }

    function setStatus(status) {
        act(() =>
            api(`/channels/${channel.channelId}/tickets/${selected}/status`, { method: "PATCH", body: { status } })
        );
    }

    function exportConversation() {
        const text = [
            `${channel.name} — ticket #${ticket.number}`,
            ticket.title,
            `État : ${labelOf(ticket.status)}`,
            "",
            ...messages.flatMap((message) => [
                `${fullTimestamp(message.createdAt)} — ${message.author.displayName || message.author.handle}${message.internal ? " [Note interne]" : ""}`,
                message.body,
                "",
            ]),
        ].join("\n");
        downloadText(`ticket-${ticket.number}.txt`, text);
    }

    return (
        <section
            className={`ticket-board workflow-board${selected ? " has-selection" : ""}`}
            aria-label={`Tickets de ${channel.name}`}
        >
            <header className="workflow-heading">
                <div>
                    <h2>Demandes d’assistance</h2>
                    <p>
                        {support
                            ? "Suivez les demandes et répondez avec votre équipe."
                            : "Vos échanges restent privés entre vous et l’équipe d’assistance."}
                    </p>
                </div>
                {!readOnly && (
                    <button
                        type="button"
                        className="btn btn-accent"
                        onClick={() => {
                            setCreating(true);
                            setError(null);
                        }}
                    >
                        <Icon name="plus" size={16} /> Nouvelle demande
                    </button>
                )}
            </header>
            {error && !creating && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            <div className="ticket-workspace">
                <aside className="ticket-queue" aria-label="Liste des demandes">
                    <label className="field">
                        <span className="field-label">Rechercher une demande</span>
                        <input
                            className="field-input"
                            type="search"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(0);
                            }}
                            placeholder="Objet, numéro ou personne"
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">État</span>
                        <select
                            className="field-input"
                            value={filter}
                            onChange={(event) => {
                                setFilter(event.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="">Tous les états</option>
                            {STATUSES.map((status) => (
                                <option key={status.id} value={status.id}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <BoardState loading={queue.loading} error={queue.error} onRetry={queue.reload}>
                        {tickets.length === 0 ? (
                            <p className="board-state">
                                {search || filter
                                    ? "Aucune demande ne correspond à ces critères."
                                    : "Aucune demande pour le moment."}
                            </p>
                        ) : (
                            <ul className="ticket-list">
                                {tickets.map((entry) => (
                                    <li key={entry.ticketId}>
                                        <button
                                            type="button"
                                            className={`ticket-row${entry.ticketId === selected ? " is-selected" : ""}`}
                                            aria-current={entry.ticketId === selected ? "true" : undefined}
                                            onClick={() => {
                                                setSelected(entry.ticketId);
                                                setReply("");
                                                setInternal(false);
                                                setError(null);
                                            }}
                                        >
                                            <span className="ticket-row-meta">
                                                <span>#{entry.number}</span>
                                                <span className={`ticket-status is-${entry.status}`}>
                                                    {labelOf(entry.status)}
                                                </span>
                                            </span>
                                            <strong>{entry.title}</strong>
                                            {entry.priority !== "normal" && (
                                                <span className={`ticket-priority is-${entry.priority}`}>
                                                    Priorité{" "}
                                                    {PRIORITIES.find(
                                                        ([id]) => id === entry.priority
                                                    )?.[1].toLowerCase()}
                                                </span>
                                            )}
                                            <small>
                                                {entry.opener?.displayName ||
                                                    entry.opener?.handle ||
                                                    "Demande personnelle"}
                                            </small>
                                            <time dateTime={entry.updatedAt}>{fullTimestamp(entry.updatedAt)}</time>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </BoardState>
                    {(page > 0 || queue.data?.hasMore) && (
                        <div className="workflow-actions">
                            <button
                                className="btn btn-ghost"
                                disabled={page === 0 || queue.loading}
                                onClick={() => setPage(page - 1)}
                            >
                                Précédentes
                            </button>
                            <span>Page {page + 1}</span>
                            <button
                                className="btn btn-ghost"
                                disabled={!queue.data?.hasMore || queue.loading}
                                onClick={() => setPage(page + 1)}
                            >
                                Suivantes
                            </button>
                        </div>
                    )}
                </aside>
                <div className="ticket-conversation">
                    {!selected ? (
                        <div className="workflow-empty">
                            <Icon name="invite" size={28} />
                            <h3>Chaque demande a son échange</h3>
                            <p>Sélectionnez un ticket pour retrouver son historique et poursuivre la conversation.</p>
                        </div>
                    ) : (
                        <BoardState
                            loading={conversation.loading}
                            error={conversation.error}
                            onRetry={conversation.reload}
                        >
                            {ticket && (
                                <>
                                    <header className="ticket-detail-heading">
                                        <button
                                            type="button"
                                            className="btn btn-ghost ticket-back"
                                            onClick={() => setSelected(null)}
                                        >
                                            <Icon name="chevron-left" size={16} /> Toutes les demandes
                                        </button>
                                        <div>
                                            <span className="ticket-reference">Ticket #{ticket.number}</span>
                                            <h3>{ticket.title}</h3>
                                            <p>
                                                Ouvert le {fullTimestamp(ticket.createdAt)}
                                                {ticket.opener &&
                                                    ` par ${ticket.opener.displayName || ticket.opener.handle}`}
                                            </p>
                                        </div>
                                        <button type="button" className="btn btn-ghost" onClick={exportConversation}>
                                            <Icon name="download" size={16} /> Exporter l’échange
                                        </button>
                                    </header>
                                    <div className="ticket-controls">
                                        {support ? (
                                            <>
                                                <label className="field">
                                                    <span className="field-label">Statut de la demande</span>
                                                    <select
                                                        className="field-input"
                                                        value={ticket.status}
                                                        disabled={busy || readOnly}
                                                        onChange={(event) => setStatus(event.target.value)}
                                                    >
                                                        {STATUSES.map((status) => (
                                                            <option key={status.id} value={status.id}>
                                                                {status.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="field">
                                                    <span className="field-label">Priorité</span>
                                                    <select
                                                        className="field-input"
                                                        value={ticket.priority}
                                                        disabled={busy || readOnly}
                                                        onChange={(event) =>
                                                            act(() =>
                                                                api(
                                                                    `/channels/${channel.channelId}/tickets/${selected}`,
                                                                    {
                                                                        method: "PATCH",
                                                                        body: { priority: event.target.value },
                                                                    }
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {PRIORITIES.map(([id, label]) => (
                                                            <option key={id} value={id}>
                                                                {label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="field">
                                                    <span className="field-label">Responsable</span>
                                                    <select
                                                        className="field-input"
                                                        value={ticket.assigneeId ?? ""}
                                                        disabled={busy || readOnly || !assignees.data}
                                                        onChange={(event) =>
                                                            act(() =>
                                                                api(
                                                                    `/channels/${channel.channelId}/tickets/${selected}/assignee`,
                                                                    {
                                                                        method: "PUT",
                                                                        body: {
                                                                            assigneeId: event.target.value
                                                                                ? Number(event.target.value)
                                                                                : null,
                                                                        },
                                                                    }
                                                                )
                                                            )
                                                        }
                                                    >
                                                        <option value="">Non attribué</option>
                                                        {(assignees.data?.members ?? []).map((person) => (
                                                            <option key={person.userId} value={person.userId}>
                                                                {person.displayName || person.handle}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                {assignees.error && (
                                                    <p className="form-error" role="alert">
                                                        {assignees.error}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className={`ticket-status is-${ticket.status}`}>
                                                    {labelOf(ticket.status)}
                                                </span>
                                                {ticket.assignee && (
                                                    <span className="ticket-assignee">
                                                        <Avatar user={ticket.assignee} size={24} />
                                                        {ticket.assignee.displayName || ticket.assignee.handle}
                                                    </span>
                                                )}
                                                {ticket.status !== "closed" && !readOnly && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        disabled={busy}
                                                        onClick={() => setStatus("closed")}
                                                    >
                                                        Fermer ma demande
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <ol className="ticket-messages" aria-label="Historique de la demande">
                                        {messages.map((message) => (
                                            <li
                                                key={message.ticketMessageId}
                                                className={message.internal ? "is-internal" : undefined}
                                            >
                                                <Avatar user={message.author} size={32} />
                                                <div>
                                                    <header>
                                                        <strong>
                                                            {message.author.displayName || message.author.handle}
                                                        </strong>
                                                        <time dateTime={message.createdAt}>
                                                            {fullTimestamp(message.createdAt)}
                                                        </time>
                                                        {message.internal && (
                                                            <span className="ticket-note-label">
                                                                Note interne · équipe uniquement
                                                            </span>
                                                        )}
                                                    </header>
                                                    <Suspense fallback={<p>{message.body}</p>}>
                                                        <SafeMarkdown>{message.body}</SafeMarkdown>
                                                    </Suspense>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                    {ticket.status === "closed" ? (
                                        <p className="board-state">
                                            Cette demande est fermée.
                                            {support
                                                ? " Vous pouvez la rouvrir en changeant son statut."
                                                : " Son historique reste disponible. Vous pouvez ouvrir une nouvelle demande si nécessaire."}
                                        </p>
                                    ) : (
                                        !readOnly && (
                                            <form
                                                className={`ticket-reply${internal ? " is-internal" : ""}`}
                                                onSubmit={send}
                                            >
                                                {support && (
                                                    <div
                                                        className="segmented"
                                                        role="group"
                                                        aria-label="Visibilité du message"
                                                    >
                                                        <button
                                                            type="button"
                                                            className={!internal ? "is-on" : ""}
                                                            aria-pressed={!internal}
                                                            onClick={() => setInternal(false)}
                                                        >
                                                            Réponse au demandeur
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={internal ? "is-on" : ""}
                                                            aria-pressed={internal}
                                                            onClick={() => setInternal(true)}
                                                        >
                                                            Note interne
                                                        </button>
                                                    </div>
                                                )}
                                                <label className="field">
                                                    <span className="field-label">
                                                        {internal
                                                            ? "Note visible uniquement par l’équipe"
                                                            : "Votre réponse"}
                                                    </span>
                                                    <textarea
                                                        className="field-input field-textarea"
                                                        rows={4}
                                                        value={reply}
                                                        onChange={(event) => setReply(event.target.value)}
                                                        maxLength={3400}
                                                        required
                                                    />
                                                </label>
                                                <div className="workflow-actions">
                                                    <span>{reply.length}/3 400</span>
                                                    <button className="btn btn-accent" disabled={busy || !reply.trim()}>
                                                        {busy
                                                            ? "Enregistrement…"
                                                            : internal
                                                              ? "Ajouter la note interne"
                                                              : "Envoyer la réponse"}
                                                    </button>
                                                </div>
                                            </form>
                                        )
                                    )}
                                </>
                            )}
                        </BoardState>
                    )}
                </div>
            </div>
            <Modal open={creating} onClose={() => !busy && setCreating(false)} title="Nouvelle demande" size="dialog">
                <form className="form workflow-form" onSubmit={open}>
                    <p>Décrivez votre besoin. Seule l’équipe d’assistance pourra consulter cet échange.</p>
                    <label className="field">
                        <span className="field-label">Objet de la demande</span>
                        <input
                            className="field-input"
                            value={draft.title}
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            maxLength={140}
                            required
                            data-autofocus
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Votre demande</span>
                        <textarea
                            className="field-input field-textarea"
                            rows={7}
                            value={draft.body}
                            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                            maxLength={3400}
                            required
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Priorité de votre demande</span>
                        <select
                            className="field-input"
                            value={draft.priority}
                            onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                        >
                            {PRIORITIES.map(([id, label]) => (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => setCreating(false)}
                        >
                            Annuler
                        </button>
                        <button className="btn btn-accent" disabled={busy || !draft.title.trim() || !draft.body.trim()}>
                            {busy ? "Ouverture…" : "Ouvrir la demande"}
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
