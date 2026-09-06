import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { getSocket } from "../../lib/socket.js";
import { fullTimestamp } from "../../lib/format.js";
import { parseUnifiedDiff, diffStats } from "../../lib/diff.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import WhiteboardBoard from "./WhiteboardBoard.jsx";

const TABS = [
    { id: "files", label: "Fichiers" },
    { id: "commits", label: "Commits" },
    { id: "review", label: "Revue" },
    { id: "pipelines", label: "Pipelines" },
    { id: "decisions", label: "Décisions" },
    { id: "whiteboard", label: "Tableau" },
    { id: "terminal", label: "Terminal" },
];

const FILE_STATUS = { modified: "modifié", added: "ajouté", deleted: "supprimé", clean: "propre" };
const PIPELINE_STATUS = { queued: "en attente", running: "en cours", passed: "réussi", failed: "échoué" };
const REVIEW_STATUS = { open: "ouverte", approved: "approuvée", merged: "fusionnée", closed: "fermée" };
const ROLE = { owner: "propriétaire", pair: "pair", mob: "mob", reviewer: "relecture" };

const same = (a, b) => Number(a) === Number(b);

function CliPanel({ channelId, worktreeName, onClose }) {
    const name = worktreeName || "mon-sujet";
    const lines = [
        `qweillo login --url ${window.location.origin} --token <jeton>`,
        `qweillo worktree push --channel ${channelId} --name ${name} --watch`,
        `qweillo worktree pipeline --channel ${channelId} --name ${name} --pipeline tests --status passed`,
        `qweillo worktree terminal --channel ${channelId} --name ${name}`,
    ];
    return (
        <div className="wt-cli" role="region" aria-label="Connecter la CLI">
            <div className="wt-cli-head">
                <strong>Connecter la CLI</strong>
                <button type="button" className="tool" onClick={onClose} aria-label="Fermer">
                    <Icon name="close" size={16} />
                </button>
            </div>
            <ol className="wt-cli-steps">
                <li>
                    Créez un jeton dans <em>Paramètres du compte › Sécurité › Jetons d’accès</em>, puis installez la
                    CLI depuis le dépôt : <code>npm install -g ./cli</code>.
                </li>
                <li>
                    Depuis votre dépôt Git :
                    <pre className="wt-cli-code">{lines.join("\n")}</pre>
                </li>
            </ol>
            <p className="wt-hint">
                Identifiant du salon : <code>{channelId}</code>. Le serveur reçoit branches, diffs et rapports ; il
                n’exécute jamais Git.
            </p>
        </div>
    );
}

function DiffView({ patch, path, onLine }) {
    const parsed = useMemo(() => parseUnifiedDiff(patch), [patch]);
    if (!patch) return <p className="wt-empty">Aucun extrait de diff pour ce fichier.</p>;
    return (
        <div className="wt-diff">
            {parsed.files.map((file, fileIndex) =>
                file.hunks.map((hunk, hunkIndex) => (
                    <table key={`${fileIndex}-${hunkIndex}`} className="wt-diff-hunk">
                        <caption>
                            @@ -{hunk.oldStart} +{hunk.newStart} @@ {hunk.header}
                        </caption>
                        <tbody>
                            {hunk.lines.map((line, index) => {
                                const number = line.newNo ?? line.oldNo;
                                return (
                                    <tr key={index} className={`wt-diff-line is-${line.type}`}>
                                        <td className="wt-diff-no">{line.oldNo ?? ""}</td>
                                        <td className="wt-diff-no">{line.newNo ?? ""}</td>
                                        <td className="wt-diff-mark">{line.type === "add" ? "+" : line.type === "del" ? "−" : ""}</td>
                                        <td className="wt-diff-text">
                                            <code>{line.text}</code>
                                            {onLine && (
                                                <button
                                                    type="button"
                                                    className="wt-diff-comment"
                                                    onClick={() => onLine(path, number)}
                                                    aria-label={`Commenter la ligne ${number}`}
                                                >
                                                    <Icon name="reply" size={13} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ))
            )}
        </div>
    );
}

export default function WorktreeBoard({ channel, currentUserId }) {
    const [board, setBoard] = useState(null);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [tab, setTab] = useState("files");
    const [name, setName] = useState("");
    const [showCli, setShowCli] = useState(false);
    const [activePath, setActivePath] = useState(null);
    const [comment, setComment] = useState({ path: "", lineStart: 1, body: "" });
    const [decision, setDecision] = useState({ title: "", body: "" });
    const [terminalLine, setTerminalLine] = useState("");
    const [transcript, setTranscript] = useState({ sessionId: null, chunks: [] });
    const transcriptRef = useRef(null);
    const channelId = channel.channelId;

    const worktrees = board?.worktrees ?? [];
    const selected = worktrees.find((tree) => same(tree.worktreeId, selectedId)) ?? worktrees[0] ?? null;
    const you = selected?.members?.find((member) => same(member.userId, currentUserId)) ?? null;
    const session = (selected?.terminals ?? []).find((item) => item.status === "open") ?? null;
    const files = selected?.files ?? [];
    const activeFile = files.find((file) => file.path === activePath) ?? files.find((file) => file.patch) ?? files[0] ?? null;
    const review = selected?.reviews?.[0] ?? null;
    const worktreeId = selected?.worktreeId ?? null;
    const sessionId = session?.sessionId ?? null;
    const isMember = Boolean(you);
    const transcriptLines = useMemo(
        () => (sessionId && same(transcript.sessionId, sessionId) ? transcript.chunks : []),
        [sessionId, transcript]
    );

    const applyBoard = useCallback((result, preferId) => {
        setBoard(result);
        setSelectedId((current) => {
            const wanted = preferId ?? current;
            const next = result.worktrees.find((tree) => same(tree.worktreeId, wanted)) ?? result.worktrees[0] ?? null;
            return next?.worktreeId ?? null;
        });
    }, []);

    const reload = useCallback(
        (preferId) =>
            api(`/channels/${channelId}/worktrees`)
                .then((result) => applyBoard(result, preferId))
                .catch((err) => setError(err instanceof ApiError ? err.message : "Worktrees indisponibles.")),
        [applyBoard, channelId]
    );

    useEffect(() => {
        let cancelled = false;
        api(`/channels/${channelId}/worktrees`)
            .then((result) => !cancelled && applyBoard(result))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Worktrees indisponibles."));
        const socket = getSocket();
        if (!socket) return () => {
            cancelled = true;
        };
        const onUpdate = (tree) => {
            if (!same(tree.channelId, channelId)) return;
            api(`/channels/${channelId}/worktrees`)
                .then((result) => !cancelled && applyBoard(result, tree.worktreeId))
                .catch(() => {});
        };
        const onCursor = (cursor) => {
            if (!same(cursor.channelId, channelId)) return;
            setBoard((current) =>
                current && {
                    worktrees: current.worktrees.map((tree) =>
                        !same(tree.worktreeId, cursor.worktreeId)
                            ? tree
                            : { ...tree, cursors: [...(tree.cursors ?? []).filter((item) => !same(item.userId, cursor.userId)), cursor] }
                    ),
                }
            );
        };
        const onComment = (payload) => {
            if (!same(payload.channelId, channelId)) return;
            setBoard((current) =>
                current && {
                    worktrees: current.worktrees.map((tree) =>
                        !same(tree.worktreeId, payload.worktreeId)
                            ? tree
                            : {
                                  ...tree,
                                  reviews: (tree.reviews ?? []).map((item) =>
                                      same(item.reviewId, payload.reviewId) ? { ...item, comments: payload.comments } : item
                                  ),
                              }
                    ),
                }
            );
        };
        const onTerminal = (chunk) => {
            if (!same(chunk.channelId, channelId)) return;
            setTranscript((current) => {
                if (!same(current.sessionId, chunk.sessionId)) return current;
                if (current.chunks.some((item) => same(item.chunkId, chunk.chunkId))) return current;
                return { ...current, chunks: [...current.chunks.slice(-400), chunk] };
            });
        };
        socket.on("worktree:updated", onUpdate);
        socket.on("worktree:cursor", onCursor);
        socket.on("worktree:review-comment", onComment);
        socket.on("worktree:terminal", onTerminal);
        return () => {
            cancelled = true;
            socket.off("worktree:updated", onUpdate);
            socket.off("worktree:cursor", onCursor);
            socket.off("worktree:review-comment", onComment);
            socket.off("worktree:terminal", onTerminal);
        };
    }, [applyBoard, channelId]);

    useEffect(() => {
        if (!sessionId || !worktreeId || !isMember) return undefined;
        let cancelled = false;
        api(`/channels/${channelId}/worktrees/${worktreeId}/terminal/${sessionId}?limit=300`)
            .then((log) => !cancelled && setTranscript({ sessionId, chunks: log.chunks }))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [channelId, worktreeId, sessionId, isMember]);

    useEffect(() => {
        if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }, [transcriptLines]);

    async function act(run, fallback = "L’opération n’a pas abouti.") {
        setError(null);
        try {
            const result = await run();
            await reload(result?.worktree?.worktreeId);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : fallback);
        }
    }

    const create = (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        act(async () => {
            const result = await api(`/channels/${channelId}/worktrees`, { method: "POST", body: { name: trimmed, baseBranch: "main" } });
            setName("");
            return result;
        });
    };

    const join = (tree) => act(() => api(`/channels/${channelId}/worktrees/${tree.worktreeId}/join`, { method: "POST" }));

    const openReview = (tree) =>
        act(() =>
            api(`/channels/${channelId}/worktrees/${tree.worktreeId}/reviews`, {
                method: "POST",
                body: { title: `Revue de ${tree.headBranch}`, ...(tree.headSha ? { baseSha: tree.headSha, headSha: tree.headSha } : {}) },
            })
        );

    const setReviewStatus = (tree, item, status) =>
        act(() => api(`/channels/${channelId}/worktrees/${tree.worktreeId}/reviews/${item.reviewId}`, { method: "PATCH", body: { status } }));

    const submitComment = (event) => {
        event.preventDefault();
        if (!review || !comment.path || !comment.body.trim()) return;
        act(async () => {
            await api(`/channels/${channelId}/worktrees/${selected.worktreeId}/reviews/${review.reviewId}/comments`, {
                method: "POST",
                body: { path: comment.path, lineStart: Number(comment.lineStart) || 1, body: comment.body.trim() },
            });
            setComment({ path: "", lineStart: 1, body: "" });
        });
    };

    const submitDecision = (event) => {
        event.preventDefault();
        if (!decision.title.trim() || !decision.body.trim()) return;
        act(async () => {
            const result = await api(`/channels/${channelId}/worktrees/${selected.worktreeId}/decisions`, {
                method: "POST",
                body: { title: decision.title.trim(), body: decision.body.trim() },
            });
            setDecision({ title: "", body: "" });
            return result;
        });
    };

    const consent = (value) =>
        act(() => api(`/channels/${channelId}/worktrees/${selected.worktreeId}/consent`, { method: "PUT", body: { consent: value } }));

    const openTerminal = () => act(() => api(`/channels/${channelId}/worktrees/${selected.worktreeId}/terminal`, { method: "POST" }));

    const closeTerminal = () =>
        act(() => api(`/channels/${channelId}/worktrees/${selected.worktreeId}/terminal/${session.sessionId}`, { method: "DELETE" }));

    const sendTerminal = (event) => {
        event.preventDefault();
        const line = terminalLine.trim();
        if (!session || !line) return;
        setTerminalLine("");
        api(`/channels/${channelId}/worktrees/${selected.worktreeId}/terminal/${session.sessionId}`, {
            method: "POST",
            body: { data: `${line}\n`, direction: "input" },
        }).catch((err) => setError(err instanceof ApiError ? err.message : "Commande non relayée."));
    };

    const commentOnLine = (path, line) => {
        setComment((current) => ({ ...current, path, lineStart: line || 1 }));
        setTab("review");
    };

    const pickFile = (file) => {
        setActivePath(file.path);
        if (you) {
            api(`/channels/${channelId}/worktrees/${selected.worktreeId}/cursor`, {
                method: "PUT",
                body: { path: file.path, line: 1, column: 0 },
            }).catch(() => {});
        }
    };

    const counts = selected
        ? {
              files: files.length,
              commits: selected.commits?.length ?? 0,
              review: review?.comments?.length ?? 0,
              pipelines: selected.pipelines?.length ?? 0,
              decisions: selected.decisions?.length ?? 0,
              terminal: session ? 1 : 0,
          }
        : {};

    const lastPipeline = (tree) => tree.pipelines?.[0] ?? null;

    return (
        <section className="wt" aria-label="Worktrees">
            <header className="wt-head">
                <div>
                    <h2>Worktrees</h2>
                    <p>
                        {worktrees.length === 0
                            ? "Un worktree par sujet, plusieurs personnes dessus."
                            : `${worktrees.length} worktree${worktrees.length > 1 ? "s" : ""} · ${worktrees.filter((tree) => tree.dirty).length} avec des changements`}
                    </p>
                </div>
                <div className="wt-head-actions">
                    <button type="button" className={`btn btn-ghost${showCli ? " is-on" : ""}`} onClick={() => setShowCli((open) => !open)}>
                        <Icon name="channels" size={15} /> Connecter la CLI
                    </button>
                    <form className="wt-new" onSubmit={create}>
                        <input
                            className="field-input"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Nouveau worktree"
                            aria-label="Nom du worktree"
                            maxLength={80}
                        />
                        <button className="btn btn-accent" type="submit" disabled={!name.trim()}>
                            <Icon name="plus" size={15} /> Ouvrir
                        </button>
                    </form>
                </div>
            </header>

            {showCli && <CliPanel channelId={channelId} worktreeName={selected?.name} onClose={() => setShowCli(false)} />}
            {error && <p className="wt-error" role="alert">{error}</p>}

            {board && worktrees.length === 0 && (
                <div className="wt-blank">
                    <strong>Aucun worktree pour l’instant.</strong>
                    <p>Ouvrez-en un ici, ou depuis un dépôt avec <code>qweillo worktree push --channel {channelId} --name &lt;nom&gt;</code>.</p>
                </div>
            )}

            {selected && (
                <div className="wt-layout">
                    <ul className="wt-list" role="listbox" aria-label="Worktrees du salon">
                        {worktrees.map((tree) => {
                            const pipeline = lastPipeline(tree);
                            const isOn = same(tree.worktreeId, selected.worktreeId);
                            return (
                                <li key={tree.worktreeId}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isOn}
                                        className={`wt-item${isOn ? " is-on" : ""}`}
                                        onClick={() => {
                                            setSelectedId(tree.worktreeId);
                                            setActivePath(null);
                                        }}
                                    >
                                        <span className="wt-item-top">
                                            <strong>{tree.name}</strong>
                                            {tree.dirty && <span className="wt-dot is-dirty" title="Modifications non commitées" />}
                                        </span>
                                        <span className="wt-item-branch">
                                            <code>{tree.headBranch}</code>
                                            {tree.headSha && <span className="wt-sha">{tree.headSha.slice(0, 7)}</span>}
                                        </span>
                                        <span className="wt-item-meta">
                                            <span className="wt-avatars">
                                                {(tree.members ?? []).slice(0, 4).map((member) => (
                                                    <Avatar key={member.userId} user={member} size={18} />
                                                ))}
                                            </span>
                                            {tree.collaboration && tree.collaboration !== "solo" && <span className="wt-chip">{tree.collaboration}</span>}
                                            {pipeline && <span className={`wt-chip is-${pipeline.status}`}>{PIPELINE_STATUS[pipeline.status] ?? pipeline.status}</span>}
                                            {tree.reviews?.[0] && <span className={`wt-chip is-review-${tree.reviews[0].status}`}>revue {REVIEW_STATUS[tree.reviews[0].status]}</span>}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    <article className="wt-detail">
                        <header className="wt-detail-head">
                            <div className="wt-detail-title">
                                <h3>{selected.name}</h3>
                                <p>
                                    <code>{selected.baseBranch}</code> <span aria-hidden="true">→</span> <code>{selected.headBranch}</code>
                                    {selected.headSha && <span className="wt-sha">{selected.headSha.slice(0, 7)}</span>}
                                    <span className={`wt-chip is-status-${selected.status}`}>{selected.status}</span>
                                    {selected.updatedAt && <span className="wt-when">mis à jour {fullTimestamp(selected.updatedAt)}</span>}
                                </p>
                            </div>
                            <div className="wt-members">
                                {(selected.members ?? []).map((member) => (
                                    <span key={member.userId} className="wt-member" title={`${member.displayName} · ${ROLE[member.role] ?? member.role}`}>
                                        <Avatar user={member} size={26} />
                                        <span>
                                            <strong>{member.displayName}</strong>
                                            <small>{ROLE[member.role] ?? member.role}</small>
                                        </span>
                                    </span>
                                ))}
                                {!you && (
                                    <button type="button" className="btn btn-accent" onClick={() => join(selected)}>
                                        Rejoindre
                                    </button>
                                )}
                            </div>
                        </header>

                        <nav className="wt-tabs" role="tablist" aria-label="Sections du worktree">
                            {TABS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.id}
                                    className={`wt-tab${tab === item.id ? " is-on" : ""}`}
                                    onClick={() => setTab(item.id)}
                                >
                                    {item.label}
                                    {counts[item.id] > 0 && <span className="wt-count">{counts[item.id]}</span>}
                                </button>
                            ))}
                        </nav>

                        <div className="wt-panel" role="tabpanel">
                            {tab === "files" && (
                                files.length === 0 ? (
                                    <p className="wt-empty">
                                        Aucun fichier poussé. Depuis le dépôt : <code>qweillo worktree push --channel {channelId} --name {selected.name}</code>
                                    </p>
                                ) : (
                                    <div className="wt-files">
                                        <ul className="wt-file-list">
                                            {files.map((file) => {
                                                const stats = diffStats(file.patch);
                                                const here = (selected.cursors ?? []).filter((cursor) => cursor.path === file.path && !same(cursor.userId, currentUserId));
                                                return (
                                                    <li key={file.fileId ?? file.path}>
                                                        <button
                                                            type="button"
                                                            className={`wt-file${activeFile?.path === file.path ? " is-on" : ""}`}
                                                            onClick={() => pickFile(file)}
                                                        >
                                                            <span className={`wt-file-status is-${file.status}`}>{(FILE_STATUS[file.status] ?? file.status).charAt(0).toUpperCase()}</span>
                                                            <span className="wt-file-path">{file.path}</span>
                                                            <span className="wt-file-stats">
                                                                {stats.added > 0 && <em className="is-add">+{stats.added}</em>}
                                                                {stats.removed > 0 && <em className="is-del">−{stats.removed}</em>}
                                                            </span>
                                                            {here.length > 0 && (
                                                                <span className="wt-avatars" title={here.map((cursor) => `${cursor.displayName ?? cursor.handle} · ligne ${cursor.line}`).join(", ")}>
                                                                    {here.map((cursor) => (
                                                                        <Avatar key={cursor.userId} user={cursor} size={16} />
                                                                    ))}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <div className="wt-file-view">
                                            {activeFile && (
                                                <>
                                                    <div className="wt-file-head">
                                                        <code>{activeFile.path}</code>
                                                        <span className="wt-chip">{FILE_STATUS[activeFile.status] ?? activeFile.status}</span>
                                                        {activeFile.language && <span className="wt-chip">{activeFile.language}</span>}
                                                    </div>
                                                    <DiffView patch={activeFile.patch} path={activeFile.path} onLine={you ? commentOnLine : null} />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            )}

                            {tab === "commits" && (
                                (selected.commits ?? []).length === 0 ? (
                                    <p className="wt-empty">Aucun commit poussé.</p>
                                ) : (
                                    <ul className="wt-commits">
                                        {selected.commits.map((commit) => (
                                            <li key={commit.commitId ?? commit.sha}>
                                                <span className="wt-sha">{commit.sha.slice(0, 7)}</span>
                                                <span className="wt-commit-subject">{commit.subject}</span>
                                                <span className="wt-commit-meta">
                                                    {commit.authorHandle}
                                                    {commit.committedAt ? ` · ${fullTimestamp(commit.committedAt)}` : ""}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            )}

                            {tab === "review" && (
                                !review ? (
                                    <div className="wt-blank">
                                        <strong>Aucune revue ouverte.</strong>
                                        <p>Une revue fige les SHA de base et de tête ; les commentaires s’ancrent sur un fichier et une ligne.</p>
                                        {you && (
                                            <button type="button" className="btn btn-accent" onClick={() => openReview(selected)}>
                                                Ouvrir une revue
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="wt-review">
                                        <div className="wt-review-head">
                                            <div>
                                                <strong>{review.title}</strong>
                                                <small>
                                                    <span className="wt-sha">{review.baseSha.slice(0, 7)}</span> → <span className="wt-sha">{review.headSha.slice(0, 7)}</span> · ouverte {fullTimestamp(review.createdAt)}
                                                </small>
                                            </div>
                                            <div className="wt-review-actions">
                                                <span className={`wt-chip is-review-${review.status}`}>{REVIEW_STATUS[review.status] ?? review.status}</span>
                                                {you && review.status === "open" && (
                                                    <button type="button" className="btn" onClick={() => setReviewStatus(selected, review, "approved")}>Approuver</button>
                                                )}
                                                {you && review.status === "approved" && (
                                                    <button type="button" className="btn btn-accent" onClick={() => setReviewStatus(selected, review, "merged")}>Marquer fusionnée</button>
                                                )}
                                                {you && ["open", "approved"].includes(review.status) && (
                                                    <button type="button" className="btn btn-ghost" onClick={() => setReviewStatus(selected, review, "closed")}>Fermer</button>
                                                )}
                                            </div>
                                        </div>

                                        {(review.comments ?? []).length === 0 ? (
                                            <p className="wt-empty">Aucun commentaire. Cliquez une ligne dans l’onglet Fichiers pour en ancrer un.</p>
                                        ) : (
                                            <ul className="wt-comments">
                                                {review.comments.map((item) => (
                                                    <li key={item.commentId}>
                                                        <Avatar user={item.author ?? item} size={24} />
                                                        <div>
                                                            <span className="wt-comment-meta">
                                                                <strong>{item.author?.displayName ?? item.displayName ?? item.handle}</strong>
                                                                <code>{item.path}:{item.lineStart}{item.lineEnd && item.lineEnd !== item.lineStart ? `-${item.lineEnd}` : ""}</code>
                                                                <small>{fullTimestamp(item.createdAt)}</small>
                                                            </span>
                                                            <p>{item.body}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {you && review.status !== "closed" && (
                                            <form className="wt-comment-form" onSubmit={submitComment}>
                                                <select
                                                    className="field-input"
                                                    value={comment.path}
                                                    onChange={(event) => setComment({ ...comment, path: event.target.value })}
                                                    aria-label="Fichier"
                                                    required
                                                >
                                                    <option value="">Fichier…</option>
                                                    {files.map((file) => (
                                                        <option key={file.path} value={file.path}>{file.path}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    className="field-input wt-line-input"
                                                    type="number"
                                                    min={1}
                                                    value={comment.lineStart}
                                                    onChange={(event) => setComment({ ...comment, lineStart: event.target.value })}
                                                    aria-label="Ligne"
                                                />
                                                <input
                                                    className="field-input"
                                                    value={comment.body}
                                                    onChange={(event) => setComment({ ...comment, body: event.target.value })}
                                                    placeholder="Votre remarque"
                                                    aria-label="Commentaire"
                                                    maxLength={2000}
                                                />
                                                <button className="btn btn-accent" type="submit" disabled={!comment.path || !comment.body.trim()}>
                                                    <Icon name="send" size={15} /> Commenter
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )
                            )}

                            {tab === "pipelines" && (
                                (selected.pipelines ?? []).length === 0 ? (
                                    <p className="wt-empty">
                                        Aucun rapport. Depuis votre CI : <code>qweillo worktree pipeline --channel {channelId} --name {selected.name} --pipeline tests --status passed</code>
                                    </p>
                                ) : (
                                    <ul className="wt-pipelines">
                                        {selected.pipelines.map((pipeline) => (
                                            <li key={pipeline.pipelineId}>
                                                <span className={`wt-dot is-${pipeline.status}`} />
                                                <div>
                                                    <span className="wt-pipeline-head">
                                                        <strong>{pipeline.name}</strong>
                                                        <span className={`wt-chip is-${pipeline.status}`}>{PIPELINE_STATUS[pipeline.status] ?? pipeline.status}</span>
                                                        <small>{fullTimestamp(pipeline.finishedAt ?? pipeline.startedAt)}</small>
                                                    </span>
                                                    {pipeline.logExcerpt && <pre className="wt-log">{pipeline.logExcerpt}</pre>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            )}

                            {tab === "decisions" && (
                                <div className="wt-decisions">
                                    {(selected.decisions ?? []).length === 0 ? (
                                        <p className="wt-empty">Aucune décision consignée. Une décision dit ce qui a été choisi et pourquoi.</p>
                                    ) : (
                                        <ul>
                                            {selected.decisions.map((item) => (
                                                <li key={item.decisionId}>
                                                    <strong>{item.title}</strong>
                                                    <p>{item.body}</p>
                                                    <small>
                                                        {item.author?.displayName ?? item.author?.handle} · {fullTimestamp(item.createdAt)}
                                                    </small>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {you && (
                                        <form className="wt-decision-form" onSubmit={submitDecision}>
                                            <input
                                                className="field-input"
                                                value={decision.title}
                                                onChange={(event) => setDecision({ ...decision, title: event.target.value })}
                                                placeholder="Titre de la décision"
                                                aria-label="Titre"
                                                maxLength={160}
                                            />
                                            <textarea
                                                className="field-input"
                                                value={decision.body}
                                                onChange={(event) => setDecision({ ...decision, body: event.target.value })}
                                                placeholder="Ce qui est retenu, et pourquoi"
                                                aria-label="Motif"
                                                rows={3}
                                                maxLength={4000}
                                            />
                                            <button className="btn btn-accent" type="submit" disabled={!decision.title.trim() || !decision.body.trim()}>
                                                Consigner
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                            {tab === "whiteboard" && <WhiteboardBoard channel={channel} />}

                            {tab === "terminal" && (
                                <div className="wt-terminal">
                                    <div className="wt-consent">
                                        <div>
                                            <strong>Terminal partagé</strong>
                                            <p className="wt-hint">
                                                Les commandes envoyées ici s’exécutent sur la machine qui héberge la session (
                                                <code>qweillo worktree terminal --channel {channelId} --name {selected.name}</code>). Il s’ouvre
                                                seulement quand chaque membre a consenti.
                                            </p>
                                        </div>
                                        <ul className="wt-consent-list">
                                            {(selected.members ?? []).map((member) => (
                                                <li key={member.userId} className={member.consentTerminal ? "is-ok" : ""}>
                                                    <Avatar user={member} size={20} />
                                                    <span>{member.displayName}</span>
                                                    <small>{member.consentTerminal ? "a consenti" : "en attente"}</small>
                                                </li>
                                            ))}
                                        </ul>
                                        {you && (
                                            <div className="wt-consent-actions">
                                                <button type="button" className={`btn${you.consentTerminal ? " btn-ghost" : " btn-accent"}`} onClick={() => consent(!you.consentTerminal)}>
                                                    {you.consentTerminal ? "Retirer mon consentement" : "Je consens"}
                                                </button>
                                                {!session && (
                                                    <button type="button" className="btn" onClick={openTerminal} disabled={!selected.terminalReady || (selected.members?.length ?? 0) < 2}>
                                                        Ouvrir une session
                                                    </button>
                                                )}
                                                {session && (
                                                    <button type="button" className="btn btn-danger" onClick={closeTerminal}>
                                                        Fermer la session
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {session && (
                                        <>
                                            <pre className="wt-term" ref={transcriptRef} aria-live="polite" aria-label="Transcription du terminal">
                                                {transcriptLines.length === 0 && <span className="wt-term-empty">Session ouverte. En attente de sortie…</span>}
                                                {transcriptLines.map((chunk) => (
                                                    <span key={chunk.chunkId} className={`wt-term-chunk is-${chunk.direction}`}>
                                                        {chunk.direction === "input" ? `${chunk.handle} $ ${chunk.data}` : chunk.data}
                                                    </span>
                                                ))}
                                            </pre>
                                            {you && (
                                                <form className="wt-term-form" onSubmit={sendTerminal}>
                                                    <span className="wt-term-prompt">$</span>
                                                    <input
                                                        className="field-input"
                                                        value={terminalLine}
                                                        onChange={(event) => setTerminalLine(event.target.value)}
                                                        placeholder="Commande à exécuter sur la machine hôte"
                                                        aria-label="Commande"
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                    />
                                                    <button className="btn btn-accent" type="submit" disabled={!terminalLine.trim()}>
                                                        Envoyer
                                                    </button>
                                                </form>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </article>
                </div>
            )}
        </section>
    );
}
