import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { localDateTime } from "../../lib/calendar.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import BoardState from "./BoardState.jsx";

const COLUMNS = [
    { id: "todo", label: "À faire" },
    { id: "doing", label: "En cours" },
    { id: "done", label: "Terminées" },
];
const EMPTY = { title: "", details: "", assigneeId: "", dueAt: "", status: "todo" };

export default function TaskBoard({ channel, currentUserId, members = [], readOnly = false }) {
    const resource = useChannelResource(channel.channelId, "tasks", "task:created task:updated task:removed");
    const [editor, setEditor] = useState(null);
    const [draft, setDraft] = useState(EMPTY);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [mine, setMine] = useState(false);
    const [search, setSearch] = useState("");

    function edit(task = null) {
        setEditor(task || { taskId: null });
        setDraft(
            task
                ? {
                      title: task.title,
                      details: task.details || "",
                      assigneeId: task.assigneeId ?? task.assignee?.userId ?? "",
                      dueAt: localDateTime(task.dueAt),
                      status: task.status,
                  }
                : EMPTY
        );
        setError(null);
    }

    async function act(run) {
        if (busy || readOnly) return;
        setBusy(true);
        setError(null);
        try {
            await run();
            resource.reload();
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : "La tâche n’a pas été enregistrée. Réessayez.");
        } finally {
            setBusy(false);
        }
    }

    function save(event) {
        event.preventDefault();
        act(async () => {
            const body = {
                ...draft,
                assigneeId: draft.assigneeId ? Number(draft.assigneeId) : null,
                dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
            };
            if (!editor.taskId) delete body.status;
            await api(`/channels/${channel.channelId}/tasks${editor.taskId ? `/${editor.taskId}` : ""}`, {
                method: editor.taskId ? "PATCH" : "POST",
                body,
            });
            setEditor(null);
        });
    }

    return (
        <section className="task-board workflow-board" aria-label={`Tâches de ${channel.name}`}>
            <header className="workflow-heading">
                <div>
                    <h2>Tableau des tâches</h2>
                    <p>Un responsable, une échéance et un état pour chaque tâche.</p>
                </div>
                {!readOnly && (
                    <button type="button" className="btn btn-accent" onClick={() => edit()}>
                        <Icon name="plus" size={16} /> Nouvelle tâche
                    </button>
                )}
            </header>
            <div className="workflow-toolbar">
                <label className="field">
                    <span className="field-label">Rechercher une tâche</span>
                    <input
                        type="search"
                        className="field-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <label className="workflow-checkbox">
                    <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} /> Mes
                    tâches
                </label>
                {resource.data?.overdue > 0 && (
                    <span className="task-overdue">
                        {resource.data.overdue} tâche{resource.data.overdue > 1 ? "s" : ""} en retard
                    </span>
                )}
            </div>
            {error && !editor && !removing && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            <BoardState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
                <div className="task-columns">
                    {COLUMNS.map((column, index) => {
                        const tasks = (resource.data?.columns[column.id] ?? []).filter(
                            (task) =>
                                (!mine || Number(task.assigneeId ?? task.assignee?.userId) === Number(currentUserId)) &&
                                `${task.title} ${task.details}`
                                    .toLocaleLowerCase("fr")
                                    .includes(search.toLocaleLowerCase("fr"))
                        );
                        return (
                            <section key={column.id} className="task-column" aria-label={column.label}>
                                <h3>
                                    {column.label}
                                    <span>{tasks.length}</span>
                                </h3>
                                {tasks.length === 0 ? (
                                    <p className="task-empty">
                                        {mine || search
                                            ? "Aucune tâche ne correspond."
                                            : "Aucune tâche dans cette colonne."}
                                    </p>
                                ) : (
                                    <ul>
                                        {tasks.map((task) => (
                                            <li key={task.taskId} className={task.overdue ? "is-overdue" : undefined}>
                                                <div className="task-card-body">
                                                    <button
                                                        type="button"
                                                        className="task-open"
                                                        onClick={() => edit(task)}
                                                        disabled={readOnly}
                                                    >
                                                        <strong>{task.title}</strong>
                                                    </button>
                                                    {task.details && <p>{task.details}</p>}
                                                    <span className="task-meta">
                                                        {task.assignee && (
                                                            <>
                                                                <Avatar user={task.assignee} size={22} />
                                                                {task.assignee.displayName || task.assignee.handle}
                                                            </>
                                                        )}
                                                        {task.dueAt && (
                                                            <time dateTime={task.dueAt}>
                                                                {task.overdue ? "En retard · " : "Échéance · "}
                                                                {fullTimestamp(task.dueAt)}
                                                            </time>
                                                        )}
                                                    </span>
                                                </div>
                                                {!readOnly && (
                                                    <div className="task-actions">
                                                        {index > 0 && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-ghost"
                                                                disabled={busy}
                                                                aria-label={`Reculer « ${task.title} » vers ${COLUMNS[index - 1].label}`}
                                                                onClick={() =>
                                                                    act(() =>
                                                                        api(
                                                                            `/channels/${channel.channelId}/tasks/${task.taskId}`,
                                                                            {
                                                                                method: "PATCH",
                                                                                body: { status: COLUMNS[index - 1].id },
                                                                            }
                                                                        )
                                                                    )
                                                                }
                                                            >
                                                                <Icon name="chevron-up" size={14} />
                                                                {COLUMNS[index - 1].label}
                                                            </button>
                                                        )}
                                                        {index < 2 && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-ghost"
                                                                disabled={busy}
                                                                aria-label={`Avancer « ${task.title} » vers ${COLUMNS[index + 1].label}`}
                                                                onClick={() =>
                                                                    act(() =>
                                                                        api(
                                                                            `/channels/${channel.channelId}/tasks/${task.taskId}`,
                                                                            {
                                                                                method: "PATCH",
                                                                                body: { status: COLUMNS[index + 1].id },
                                                                            }
                                                                        )
                                                                    )
                                                                }
                                                            >
                                                                {COLUMNS[index + 1].label}
                                                                <Icon name="chevron-down" size={14} />
                                                            </button>
                                                        )}
                                                        {Number(task.createdBy) === Number(currentUserId) && (
                                                            <button
                                                                type="button"
                                                                className="icon-button"
                                                                aria-label={`Supprimer « ${task.title} »`}
                                                                onClick={() => {
                                                                    setRemoving(task);
                                                                    setError(null);
                                                                }}
                                                            >
                                                                <Icon name="trash" size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            </BoardState>
            <Modal
                open={Boolean(editor)}
                title={editor?.taskId ? "Modifier la tâche" : "Nouvelle tâche"}
                onClose={() => !busy && setEditor(null)}
                size="dialog"
            >
                <form className="form workflow-form" onSubmit={save}>
                    <label className="field">
                        <span className="field-label">Intitulé</span>
                        <input
                            className="field-input"
                            value={draft.title}
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            maxLength={160}
                            required
                            data-autofocus
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Description</span>
                        <textarea
                            className="field-input field-textarea"
                            value={draft.details}
                            onChange={(event) => setDraft({ ...draft, details: event.target.value })}
                            maxLength={2000}
                            rows={5}
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Responsable</span>
                        <select
                            className="field-input"
                            value={draft.assigneeId}
                            onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}
                        >
                            <option value="">Non attribuée</option>
                            {members.map((person) => (
                                <option key={person.userId} value={person.userId}>
                                    {person.displayName || person.handle}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">Échéance</span>
                        <input
                            type="datetime-local"
                            className="field-input"
                            value={draft.dueAt}
                            onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
                        />
                    </label>
                    {editor?.taskId && (
                        <label className="field">
                            <span className="field-label">État de la tâche</span>
                            <select
                                className="field-input"
                                value={draft.status}
                                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                            >
                                {COLUMNS.map((column) => (
                                    <option key={column.id} value={column.id}>
                                        {column.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditor(null)}>
                            Annuler
                        </button>
                        <button className="btn btn-accent" disabled={busy || !draft.title.trim()}>
                            {busy ? "Enregistrement…" : editor?.taskId ? "Enregistrer" : "Créer la tâche"}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={Boolean(removing)}
                title="Supprimer cette tâche ?"
                onClose={() => !busy && setRemoving(null)}
                size="dialog"
            >
                <p>« {removing?.title} » sera supprimée du tableau.</p>
                {error && (
                    <p role="alert" className="form-error">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setRemoving(null)}>
                        Conserver
                    </button>
                    <button
                        className="btn btn-danger"
                        disabled={busy}
                        onClick={() =>
                            act(async () => {
                                await api(`/channels/${channel.channelId}/tasks/${removing.taskId}`, {
                                    method: "DELETE",
                                });
                                setRemoving(null);
                            })
                        }
                    >
                        Supprimer la tâche
                    </button>
                </div>
            </Modal>
        </section>
    );
}
