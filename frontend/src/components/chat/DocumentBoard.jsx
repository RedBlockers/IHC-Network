import { lazy, Suspense, useId, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { downloadText } from "../../lib/calendar.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import BoardState from "./BoardState.jsx";

const SafeMarkdown = lazy(() => import("./SafeMarkdown.jsx"));
const LABELS = {
    wiki: {
        list: "Pages du wiki",
        add: "Nouvelle page",
        title: "Titre de la page",
        body: "Contenu",
        empty: "Construisez les connaissances de votre communauté.",
    },
    documentation: {
        list: "Sommaire",
        add: "Nouvelle section",
        title: "Titre de la section",
        body: "Documentation",
        empty: "Rassemblez vos guides et vos procédures.",
    },
    resources: {
        list: "Ressources",
        add: "Nouvelle fiche",
        title: "Nom de la ressource",
        body: "Présentation, liens et conseils",
        empty: "Partagez les liens et les ressources utiles.",
    },
    faq: {
        list: "Questions fréquentes",
        add: "Nouvelle question",
        title: "Question",
        body: "Réponse",
        empty: "Répondez aux questions qui reviennent souvent.",
    },
};
const EVENTS = "document:created document:updated document:removed";

export default function DocumentBoard({ channel, readOnly = false, canDelete = false }) {
    const bodyHintId = useId();
    const labels = LABELS[channel.type] || LABELS.wiki;
    const outline = useChannelResource(channel.channelId, "documents", EVENTS);
    const [selected, setSelected] = useState(null);
    const [editor, setEditor] = useState(null);
    const [draft, setDraft] = useState({ title: "", body: "", summary: "" });
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [revisionId, setRevisionId] = useState(null);
    const [removing, setRemoving] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const [search, setSearch] = useState("");
    const documents = outline.data?.documents ?? [];
    const activeId = documents.some((document) => document.documentId === selected)
        ? selected
        : (documents[0]?.documentId ?? null);
    const content = useChannelResource(channel.channelId, activeId ? `documents/${activeId}` : null, EVENTS);
    const history = useChannelResource(
        channel.channelId,
        activeId && historyOpen ? `documents/${activeId}/history` : null,
        EVENTS
    );
    const version = useChannelResource(
        channel.channelId,
        activeId && revisionId ? `documents/${activeId}/history/${revisionId}` : null
    );
    const page = content.data?.document;

    function beginEdit(create = false) {
        setEditor({
            documentId: create ? null : activeId,
            baseRevisionId: create ? null : content.data?.lastEdit?.revisionId,
        });
        setDraft(
            create
                ? { title: "", body: "", summary: "Création" }
                : { title: page.title, body: content.data.body, summary: "" }
        );
        setHistoryOpen(false);
        setError(null);
        setNotice(null);
    }

    async function act(run) {
        if (busy || readOnly) return;
        setBusy(true);
        setError(null);
        try {
            await run();
            outline.reload();
            content.reload();
            history.reload();
        } catch (failure) {
            setError(
                failure instanceof ApiError
                    ? failure.message
                    : "La page n’a pas été enregistrée. Votre brouillon est conservé."
            );
        } finally {
            setBusy(false);
        }
    }

    function save(event) {
        event.preventDefault();
        act(async () => {
            const result = await api(
                `/channels/${channel.channelId}/documents${editor.documentId ? `/${editor.documentId}` : ""}`,
                {
                    method: editor.documentId ? "PATCH" : "POST",
                    body: { ...draft, ...(editor.documentId ? { baseRevisionId: editor.baseRevisionId } : {}) },
                }
            );
            outline.replace({
                documents: editor.documentId
                    ? documents.map((entry) =>
                          entry.documentId === result.document.documentId ? { ...entry, ...result.document } : entry
                      )
                    : [...documents, result.document],
            });
            if (editor.documentId) content.replace(result);
            setSelected(result.document.documentId);
            setEditor(null);
            setNotice(
                result.redactedSecrets
                    ? "Le contenu a été enregistré. Les éléments ressemblant à des secrets ont été masqués."
                    : "Modifications enregistrées."
            );
        });
    }

    return (
        <section className={`doc-board workflow-documents${editor ? " is-editing" : ""}`} aria-label={labels.list}>
            <aside className="doc-outline">
                <h2>{labels.list}</h2>
                <label className="field">
                    <span className="field-label">Rechercher dans les titres</span>
                    <input
                        type="search"
                        className="field-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <BoardState loading={outline.loading} error={outline.error} onRetry={outline.reload}>
                    <ul>
                        {documents
                            .filter((entry) =>
                                entry.title.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))
                            )
                            .map((entry) => (
                                <li key={entry.documentId}>
                                    <button
                                        type="button"
                                        disabled={Boolean(editor) || busy}
                                        aria-current={entry.documentId === activeId && !editor ? "page" : undefined}
                                        className={entry.documentId === activeId && !editor ? "is-active" : undefined}
                                        onClick={() => {
                                            setSelected(entry.documentId);
                                            setHistoryOpen(false);
                                            setRevisionId(null);
                                            setError(null);
                                            setNotice(null);
                                        }}
                                    >
                                        {entry.title}
                                    </button>
                                </li>
                            ))}
                    </ul>
                </BoardState>
                {!readOnly && (
                    <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={Boolean(editor) || busy}
                        onClick={() => beginEdit(true)}
                    >
                        <Icon name="plus" size={16} />
                        {labels.add}
                    </button>
                )}
            </aside>
            <div className="doc-page">
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                {notice && (
                    <p className="workflow-notice" role="status">
                        {notice}
                    </p>
                )}
                {editor ? (
                    <form className="doc-editor workflow-form" onSubmit={save}>
                        <h2>{editor.documentId ? "Modifier le contenu" : labels.add}</h2>
                        <label className="field">
                            <span className="field-label">{labels.title}</span>
                            <input
                                className="field-input"
                                value={draft.title}
                                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                                maxLength={160}
                                required
                                autoFocus
                            />
                        </label>
                        <label className="field">
                            <span className="field-label">{labels.body}</span>
                            <textarea
                                className="field-input field-textarea doc-body"
                                aria-label={labels.body}
                                aria-describedby={bodyHintId}
                                value={draft.body}
                                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                                maxLength={100000}
                                rows={16}
                            />
                            <small id={bodyHintId}>
                                Le format Markdown permet d’ajouter des titres, des listes et des liens.
                            </small>
                        </label>
                        <label className="field">
                            <span className="field-label">Résumé de cette modification</span>
                            <input
                                className="field-input"
                                value={draft.summary}
                                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                                maxLength={200}
                            />
                        </label>
                        <div className="workflow-actions">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => downloadText("brouillon.md", `# ${draft.title}\n\n${draft.body}`)}
                            >
                                Télécharger le brouillon
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => setDiscarding(true)}
                            >
                                Annuler
                            </button>
                            <button className="btn btn-accent" disabled={busy || !draft.title.trim()}>
                                {busy ? "Enregistrement…" : "Enregistrer"}
                            </button>
                        </div>
                    </form>
                ) : activeId ? (
                    <BoardState loading={content.loading} error={content.error} onRetry={content.reload}>
                        {page && (
                            <>
                                <header className="doc-head">
                                    <h2>{page.title}</h2>
                                    <p>
                                        Modifiée le {fullTimestamp(page.updatedAt)}
                                        {content.data.lastEdit?.editor &&
                                            ` par ${content.data.lastEdit.editor.displayName || content.data.lastEdit.editor.handle}`}
                                    </p>
                                    <div className="document-actions">
                                        {!readOnly && (
                                            <button type="button" className="btn btn-ghost" onClick={() => beginEdit()}>
                                                <Icon name="edit" size={15} /> Modifier
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className={`btn btn-ghost${historyOpen ? " is-on" : ""}`}
                                            aria-expanded={historyOpen}
                                            onClick={() => {
                                                setHistoryOpen(!historyOpen);
                                                setRevisionId(null);
                                            }}
                                        >
                                            Historique
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() =>
                                                downloadText(
                                                    `page-${page.documentId}.md`,
                                                    `# ${page.title}\n\n${content.data.body}`
                                                )
                                            }
                                        >
                                            <Icon name="download" size={15} /> Exporter
                                        </button>
                                        {canDelete && !readOnly && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost"
                                                onClick={() => setRemoving(true)}
                                            >
                                                Supprimer
                                            </button>
                                        )}
                                    </div>
                                </header>
                                {historyOpen ? (
                                    <section className="document-history" aria-label="Historique des versions">
                                        <h3>Versions enregistrées</h3>
                                        <p>
                                            Restaurer crée une nouvelle version. Les versions précédentes restent
                                            accessibles.
                                        </p>
                                        <BoardState
                                            loading={history.loading}
                                            error={history.error}
                                            onRetry={history.reload}
                                        >
                                            <ol>
                                                {(history.data?.revisions ?? []).map((revision) => (
                                                    <li key={revision.revisionId}>
                                                        <button
                                                            type="button"
                                                            className={`document-revision${revision.revisionId === revisionId ? " is-selected" : ""}`}
                                                            onClick={() => setRevisionId(revision.revisionId)}
                                                        >
                                                            <strong>{revision.summary || "Modification"}</strong>
                                                            <span>
                                                                {fullTimestamp(revision.editedAt)} ·{" "}
                                                                {revision.editor.displayName || revision.editor.handle}
                                                            </span>
                                                        </button>
                                                        {!readOnly &&
                                                            revision.revisionId !==
                                                                content.data.lastEdit?.revisionId && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost"
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        act(async () => {
                                                                            const restored = await api(
                                                                                `/channels/${channel.channelId}/documents/${activeId}/restore`,
                                                                                {
                                                                                    method: "POST",
                                                                                    body: {
                                                                                        revisionId: revision.revisionId,
                                                                                    },
                                                                                }
                                                                            );
                                                                            content.replace(restored);
                                                                            setHistoryOpen(false);
                                                                            setRevisionId(null);
                                                                            setNotice("La version a été restaurée.");
                                                                        })
                                                                    }
                                                                >
                                                                    Restaurer cette version
                                                                </button>
                                                            )}
                                                    </li>
                                                ))}
                                            </ol>
                                        </BoardState>
                                        {revisionId && (
                                            <BoardState
                                                loading={version.loading}
                                                error={version.error}
                                                onRetry={version.reload}
                                            >
                                                <article className="doc-content">
                                                    <h3>{version.data?.title || "Aperçu de la version"}</h3>
                                                    <Suspense fallback={<p>{version.data?.body}</p>}>
                                                        <SafeMarkdown>{version.data?.body ?? ""}</SafeMarkdown>
                                                    </Suspense>
                                                </article>
                                            </BoardState>
                                        )}
                                    </section>
                                ) : (
                                    <article className="doc-content">
                                        <Suspense fallback={<p>{content.data.body}</p>}>
                                            <SafeMarkdown>{content.data.body}</SafeMarkdown>
                                        </Suspense>
                                    </article>
                                )}
                            </>
                        )}
                    </BoardState>
                ) : (
                    !outline.loading && (
                        <div className="workflow-empty">
                            <Icon name="channels" size={28} />
                            <h3>{labels.list}</h3>
                            <p>{labels.empty}</p>
                            {!readOnly && (
                                <button type="button" className="btn btn-accent" onClick={() => beginEdit(true)}>
                                    {labels.add}
                                </button>
                            )}
                        </div>
                    )
                )}
            </div>
            <Modal
                open={discarding}
                title="Abandonner ce brouillon ?"
                onClose={() => setDiscarding(false)}
                size="dialog"
            >
                <p>Les modifications non enregistrées seront perdues.</p>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => setDiscarding(false)}>
                        Continuer à écrire
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={() => {
                            setEditor(null);
                            setDiscarding(false);
                            setError(null);
                        }}
                    >
                        Abandonner le brouillon
                    </button>
                </div>
            </Modal>
            <Modal
                open={removing}
                title="Supprimer ce contenu ?"
                onClose={() => !busy && setRemoving(false)}
                size="dialog"
            >
                <p>« {page?.title} » et son historique seront supprimés.</p>
                <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setRemoving(false)}>
                        Conserver
                    </button>
                    <button
                        className="btn btn-danger"
                        disabled={busy}
                        onClick={() =>
                            act(async () => {
                                await api(`/channels/${channel.channelId}/documents/${activeId}`, { method: "DELETE" });
                                setSelected(null);
                                setRemoving(false);
                            })
                        }
                    >
                        Supprimer le contenu
                    </button>
                </div>
            </Modal>
        </section>
    );
}
