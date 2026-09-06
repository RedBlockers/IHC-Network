import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { calendarEvent, downloadText, localDateTime } from "../../lib/calendar.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import BoardState from "./BoardState.jsx";

const RESPONSES = [
    ["going", "Je viens"],
    ["maybe", "Peut-être"],
    ["no", "Je ne peux pas"],
];
const STATUS = { upcoming: "À venir", live: "En cours", past: "Passé", cancelled: "Annulé" };
const EMPTY = { title: "", startsAt: "", endsAt: "", location: "", description: "" };

export default function EventBoard({ channel, currentUserId, readOnly = false }) {
    const resource = useChannelResource(channel.channelId, "events", "event:created event:updated event:cancelled");
    const [editor, setEditor] = useState(null);
    const [draft, setDraft] = useState(EMPTY);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [cancelling, setCancelling] = useState(null);
    const [filter, setFilter] = useState("active");
    const meeting = channel.type === "meeting";
    const events = (resource.data?.events ?? []).filter(
        (event) =>
            filter === "all" ||
            (filter === "active" ? ["upcoming", "live"].includes(event.status) : event.status === filter)
    );

    function edit(event = null) {
        setEditor(event || { eventId: null });
        setDraft(
            event
                ? {
                      title: event.title,
                      description: event.description,
                      location: event.location,
                      startsAt: localDateTime(event.startsAt),
                      endsAt: localDateTime(event.endsAt),
                  }
                : EMPTY
        );
        setError(null);
    }

    async function act(run) {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await run();
            resource.reload();
        } catch (failure) {
            setError(
                failure instanceof ApiError ? failure.message : "La modification n’a pas été enregistrée. Réessayez."
            );
        } finally {
            setBusy(false);
        }
    }

    function save(event) {
        event.preventDefault();
        if (draft.endsAt && new Date(draft.endsAt) <= new Date(draft.startsAt)) {
            setError("La fin doit être postérieure au début.");
            return;
        }
        act(async () => {
            await api(`/channels/${channel.channelId}/events${editor.eventId ? `/${editor.eventId}` : ""}`, {
                method: editor.eventId ? "PATCH" : "POST",
                body: {
                    ...draft,
                    startsAt: new Date(draft.startsAt).toISOString(),
                    endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
                },
            });
            setEditor(null);
        });
    }

    return (
        <section className="event-board workflow-board" aria-label={meeting ? "Réunions" : "Événements"}>
            <header className="workflow-heading">
                <div>
                    <h2>{meeting ? "Réunions" : "Événements"}</h2>
                    <p>
                        {meeting
                            ? "Planifiez un créneau, partagez l’ordre du jour et confirmez votre présence."
                            : "Retrouvez les prochaines dates et indiquez votre participation."}
                    </p>
                </div>
                {!readOnly && (
                    <button type="button" className="btn btn-accent" onClick={() => edit()}>
                        <Icon name="plus" size={16} />
                        {meeting ? "Planifier une réunion" : "Proposer un événement"}
                    </button>
                )}
            </header>
            <div className="workflow-toolbar">
                <label className="field">
                    <span className="field-label">Afficher</span>
                    <select className="field-input" value={filter} onChange={(event) => setFilter(event.target.value)}>
                        <option value="active">À venir et en cours</option>
                        <option value="past">Passés</option>
                        <option value="cancelled">Annulés</option>
                        <option value="all">Toutes les dates</option>
                    </select>
                </label>
                <span>Horaires dans votre fuseau : {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            {error && !editor && !cancelling && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            <BoardState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
                {events.length === 0 ? (
                    <div className="workflow-empty">
                        <Icon name="calendar" size={28} />
                        <h3>Aucune date {filter === "active" ? "prévue" : "à afficher"}</h3>
                        <p>
                            {readOnly
                                ? "Les prochaines dates apparaîtront ici."
                                : meeting
                                  ? "Planifiez la première réunion de ce salon."
                                  : "Proposez un événement pour réunir votre communauté."}
                        </p>
                    </div>
                ) : (
                    <ul className="event-list">
                        {events.map((event) => (
                            <li
                                key={event.eventId}
                                className={`event-entry${event.status === "cancelled" ? " is-cancelled" : ""}`}
                            >
                                <div className="event-date" aria-hidden="true">
                                    <strong>{new Date(event.startsAt).getDate()}</strong>
                                    <span>
                                        {new Date(event.startsAt).toLocaleDateString("fr-FR", { month: "short" })}
                                    </span>
                                </div>
                                <div className="event-content">
                                    <div className="event-head">
                                        <span>
                                            <strong>{event.title}</strong>
                                            <small>
                                                <time dateTime={event.startsAt}>
                                                    {new Date(event.startsAt).toLocaleString("fr-FR", {
                                                        dateStyle: "full",
                                                        timeStyle: "short",
                                                    })}
                                                </time>
                                                {event.endsAt && (
                                                    <>
                                                        {" "}
                                                        —{" "}
                                                        <time dateTime={event.endsAt}>
                                                            {new Date(event.endsAt).toLocaleString("fr-FR", {
                                                                dateStyle: "short",
                                                                timeStyle: "short",
                                                            })}
                                                        </time>
                                                    </>
                                                )}
                                                {event.location && (
                                                    <span className="event-location">{event.location}</span>
                                                )}
                                            </small>
                                        </span>
                                        <span className={`event-status event-status-${event.status}`}>
                                            {STATUS[event.status]}
                                        </span>
                                    </div>
                                    {event.description && <p className="event-description">{event.description}</p>}
                                    <div className="event-foot">
                                        {event.author && <Avatar user={event.author} size={24} />}
                                        <span className="event-counts">
                                            {event.going} présent{event.going > 1 ? "s" : ""}
                                            {event.maybe > 0 && ` · ${event.maybe} peut-être`}
                                        </span>
                                        {!readOnly && ["upcoming", "live"].includes(event.status) && (
                                            <div
                                                className="event-responses"
                                                role="group"
                                                aria-label={`Votre réponse à ${event.title}`}
                                            >
                                                {RESPONSES.map(([id, label]) => (
                                                    <button
                                                        key={id}
                                                        type="button"
                                                        aria-pressed={event.yourResponse === id}
                                                        className={event.yourResponse === id ? "is-on" : ""}
                                                        disabled={busy}
                                                        onClick={() =>
                                                            act(() =>
                                                                api(
                                                                    `/channels/${channel.channelId}/events/${event.eventId}/response`,
                                                                    { method: "PUT", body: { response: id } }
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="event-actions">
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() =>
                                                downloadText(
                                                    `evenement-${event.eventId}.ics`,
                                                    calendarEvent(event),
                                                    "text/calendar;charset=utf-8"
                                                )
                                            }
                                        >
                                            <Icon name="calendar" size={15} /> Ajouter au calendrier
                                        </button>
                                        {!readOnly &&
                                            Number(event.createdBy) === Number(currentUserId) &&
                                            event.status !== "cancelled" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        onClick={() => edit(event)}
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        onClick={() => {
                                                            setCancelling(event);
                                                            setError(null);
                                                        }}
                                                    >
                                                        Annuler {meeting ? "la réunion" : "l’événement"}
                                                    </button>
                                                </>
                                            )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </BoardState>
            <Modal
                open={Boolean(editor)}
                onClose={() => !busy && setEditor(null)}
                title={
                    editor?.eventId
                        ? "Modifier les informations"
                        : meeting
                          ? "Planifier une réunion"
                          : "Proposer un événement"
                }
                size="dialog"
            >
                <form className="form workflow-form" onSubmit={save}>
                    <label className="field">
                        <span className="field-label">Titre</span>
                        <input
                            className="field-input"
                            value={draft.title}
                            maxLength={120}
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            required
                            data-autofocus
                        />
                    </label>
                    <div className="workflow-form-grid">
                        <label className="field">
                            <span className="field-label">Début</span>
                            <input
                                className="field-input"
                                type="datetime-local"
                                value={draft.startsAt}
                                onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
                                required
                            />
                        </label>
                        <label className="field">
                            <span className="field-label">Fin</span>
                            <input
                                className="field-input"
                                type="datetime-local"
                                value={draft.endsAt}
                                onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
                            />
                        </label>
                    </div>
                    <label className="field">
                        <span className="field-label">Lieu ou lien de réunion</span>
                        <input
                            className="field-input"
                            value={draft.location}
                            maxLength={160}
                            onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">{meeting ? "Ordre du jour" : "Description"}</span>
                        <textarea
                            className="field-input field-textarea"
                            rows={5}
                            value={draft.description}
                            maxLength={2000}
                            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                        />
                    </label>
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditor(null)}>
                            Annuler
                        </button>
                        <button className="btn btn-accent" disabled={busy || !draft.title.trim() || !draft.startsAt}>
                            {busy ? "Enregistrement…" : editor?.eventId ? "Enregistrer" : "Proposer"}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={Boolean(cancelling)}
                onClose={() => !busy && setCancelling(null)}
                title={meeting ? "Annuler cette réunion ?" : "Annuler cet événement ?"}
                size="dialog"
            >
                <p>
                    Les personnes inscrites à « {cancelling?.title} » seront prévenues. La date restera consultable dans
                    les événements annulés.
                </p>
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setCancelling(null)}>
                        Conserver
                    </button>
                    <button
                        className="btn btn-danger"
                        disabled={busy}
                        onClick={() =>
                            act(async () => {
                                await api(`/channels/${channel.channelId}/events/${cancelling.eventId}`, {
                                    method: "DELETE",
                                });
                                setCancelling(null);
                            })
                        }
                    >
                        Confirmer l’annulation
                    </button>
                </div>
            </Modal>
        </section>
    );
}
