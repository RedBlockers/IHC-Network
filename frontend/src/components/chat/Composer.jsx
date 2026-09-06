import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "./EmojiPicker.jsx";
import Icon from "../ui/Icon.jsx";
import { FORMATS, TOOLBAR_ORDER, activeFormats, applyFormat, shortcutFor } from "../../lib/markdownFormat.js";
import { redact, scan } from "../../lib/secretScanner.js";
import { relativeFolderPath, uploadAttachment } from "../../lib/uploads.js";
import { connectComposer } from "../../lib/composerBridge.js";
import { parse as parseCommand, suggest } from "../../lib/slashCommands.js";
import { isSupported as recorderSupported, start as startRecorder } from "../../lib/voiceRecorder.js";
import Tooltip from "../ui/Tooltip.jsx";

const SafeMarkdown = lazy(() => import("./SafeMarkdown.jsx"));

export default function Composer({
    onSend,
    placeholder,
    replyTo,
    onCancelReply,
    onTyping,
    channelId,
    guildId,
    permissions = [],
    onCommand,
}) {
    const [value, setValue] = useState("");
    const [commandIndex, setCommandIndex] = useState(0);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [preview, setPreview] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [attachments, setAttachments] = useState([]);
    const [uploads, setUploads] = useState([]);
    const uploadBatchesRef = useRef(new Set());
    const [storageFull, setStorageFull] = useState(null);
    const textareaRef = useRef(null);
    const lastTypingRef = useRef(0);

    useEffect(() => {
        const batches = uploadBatchesRef.current;
        return () => {
            for (const batch of batches) batch.controller.abort();
            batches.clear();
        };
    }, [channelId]);

    useEffect(
        () =>
            connectComposer((text) => {
                setValue((current) => {
                    const separator = current && !current.endsWith(" ") ? " " : "";
                    return `${current}${separator}${text}`;
                });
                textareaRef.current?.focus();
            }),
        []
    );

    const recorderAvailable = useMemo(() => recorderSupported(), []);
    const commands = suggest(value, { permissions });
    const started = parseCommand(value);
    const template = started?.missingArgs ? started.command : null;

    const [lastCount, setLastCount] = useState(commands.length);
    if (lastCount !== commands.length) {
        setLastCount(commands.length);
        if (commandIndex >= commands.length) setCommandIndex(0);
    }
    const active = activeFormats(value, selection.start, selection.end);
    const secrets = scan(value);

    function autosize() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }

    function syncSelection(event) {
        const el = event?.target ?? textareaRef.current;
        if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd });
    }

    function onChange(e) {
        setValue(e.target.value);
        syncSelection(e);
        autosize();
        if (e.timeStamp - lastTypingRef.current > 2500) {
            lastTypingRef.current = e.timeStamp;
            onTyping?.();
        }
    }

    function format(formatId) {
        const el = textareaRef.current;
        const start = el ? el.selectionStart : selection.start;
        const end = el ? el.selectionEnd : selection.end;
        const next = applyFormat(value, start, end, formatId);

        setValue(next.value);
        setSelection({ start: next.selectionStart, end: next.selectionEnd });
        requestAnimationFrame(() => {
            const field = textareaRef.current;
            if (!field) return;
            field.focus();
            field.setSelectionRange(next.selectionStart, next.selectionEnd);
            autosize();
        });
    }

    const [recording, setRecording] = useState(null);
    const [level, setLevel] = useState(0);
    const [seconds, setSeconds] = useState(0);

    async function startRecording() {
        setError(null);
        try {
            const handle = await startRecorder({
                onLevel: setLevel,
                onTick: setSeconds,
                onAutoStop: () => setError("Enregistrement arrêté : cinq minutes au maximum."),
            });
            setSeconds(0);
            setRecording(handle);
        } catch {
            setError("Le navigateur n’a pas donné accès au microphone.");
        }
    }

    async function finishRecording() {
        const handle = recording;
        setRecording(null);
        setLevel(0);
        const result = await handle?.stop();
        if (!result) return;

        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const extension = result.blob.type.includes("mp4") ? "m4a" : "weba";
        await addFiles([new File([result.blob], `message-vocal-${stamp}.${extension}`, { type: result.blob.type })]);
    }

    async function cancelRecording() {
        const handle = recording;
        setRecording(null);
        setLevel(0);
        await handle?.cancel();
    }

    async function addFiles(fileList) {
        const files = [...fileList];
        if (files.length === 0) return;

        const entries = files.map((file) => ({ id: `${file.name}:${file.size}:${Math.random()}`, file }));
        const batch = { controller: new AbortController() };
        const { signal } = batch.controller;
        const ids = new Set(entries.map((entry) => entry.id));
        uploadBatchesRef.current.add(batch);
        setUploads((current) => [...current, ...entries.map(({ id, file }) => ({ id, name: file.name, progress: 0 }))]);
        try {
            for (const { id, file } of entries) {
                if (signal.aborted) return;
                try {
                    const attachment = await uploadAttachment(channelId, file, {
                        relativePath: relativeFolderPath(file),
                        signal,
                        onProgress: (ratio) => {
                            if (!signal.aborted)
                                setUploads((current) =>
                                    current.map((item) => (item.id === id ? { ...item, progress: ratio } : item))
                                );
                        },
                    });
                    if (signal.aborted) return;
                    setAttachments((current) => [...current, attachment]);
                } catch (err) {
                    if (signal.aborted) return;
                    if (err.code === "insufficient_storage") {
                        setStorageFull({ message: err.message, ...err.details });
                        return;
                    }
                    setError(err.message || "Envoi refusé.");
                } finally {
                    if (!signal.aborted) setUploads((current) => current.filter((item) => item.id !== id));
                }
            }
        } finally {
            uploadBatchesRef.current.delete(batch);
            if (!signal.aborted) setUploads((current) => current.filter((item) => !ids.has(item.id)));
        }
    }

    async function submit() {
        const content = value.trim();
        if (
            (!content && attachments.length === 0) ||
            sending ||
            uploads.length > 0 ||
            uploadBatchesRef.current.size > 0
        )
            return;

        const command = parseCommand(content);
        if (command) {
            if (command.missingArgs) {
                setError(`/${command.command.name} attend : ${command.command.args}`);
                return;
            }
            const handled = await onCommand?.(command.command, command.args);
            if (handled !== false) {
                setValue("");
                setSelection({ start: 0, end: 0 });
                requestAnimationFrame(autosize);
                return;
            }
        }

        setSending(true);
        setError(null);
        try {
            await onSend(
                content,
                attachments.map((file) => file.attachmentId)
            );
            setValue("");
            setAttachments([]);
            setSelection({ start: 0, end: 0 });
            requestAnimationFrame(autosize);
        } catch (failure) {
            setError(failure.message || "Message non envoyé. Réessayez.");
        } finally {
            setSending(false);
        }
    }

    function complete(command) {
        setValue(`/${command.name} `);
        setCommandIndex(0);
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            autosize();
        });
    }

    function onKeyDown(e) {
        if (commands.length > 0) {
            const typedInFull = commands.length === 1 && value === `/${commands[0].name}` && !commands[0].needsArgs;
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !typedInFull)) {
                e.preventDefault();
                complete(commands[Math.min(commandIndex, commands.length - 1)]);
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setCommandIndex((index) => (index + 1) % commands.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setCommandIndex((index) => (index - 1 + commands.length) % commands.length);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setValue("");
                return;
            }
        }

        const shortcut = shortcutFor(e);
        if (shortcut) {
            e.preventDefault();
            format(shortcut);
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    }

    function insertEmoji(emoji) {
        setValue((v) => v + emoji);
        setEmojiOpen(false);
        textareaRef.current?.focus();
    }

    return (
        <div className="composer" style={{ position: "relative" }}>
            {storageFull && (
                <div className="composer-blocked" role="alert">
                    <Icon name="alert" size={17} />
                    <div>
                        <strong>{storageFull.message}</strong>
                        <p>
                            Supprimez des fichiers depuis la médiathèque du salon, ou demandez à un responsable
                            d’augmenter le plafond de la communauté.
                        </p>
                    </div>
                    <button className="btn btn-quiet" onClick={() => setStorageFull(null)}>
                        Fermer
                    </button>
                </div>
            )}
            {error && <p className="composer-error">{error}</p>}
            {replyTo && (
                <div className="composer-reply">
                    Réponse à <b>{replyTo.author.displayName || replyTo.author.handle}</b>
                    <button className="composer-reply-x" onClick={onCancelReply} aria-label="Annuler la réponse">
                        <Icon name="close" size={15} />
                    </button>
                </div>
            )}

            {secrets.length > 0 && (
                <div className="composer-secret" role="status">
                    <span>
                        Ce message contient ce qui ressemble à{" "}
                        {secrets.length === 1 ? "un secret" : `${secrets.length} secrets`} (
                        {[...new Set(secrets.map((s) => s.label))].join(", ")}). Il sera masqué à l’envoi.
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            const masked = redact(value);
                            setValue(masked);
                            setSelection({ start: masked.length, end: masked.length });
                            requestAnimationFrame(() => textareaRef.current?.focus());
                        }}
                    >
                        Masquer maintenant
                    </button>
                </div>
            )}

            <div className="composer-toolbar" role="toolbar" aria-label="Mise en forme du message">
                {TOOLBAR_ORDER.map((id) => {
                    const item = FORMATS[id];
                    const on = active.has(id);
                    return (
                        <Tooltip
                            key={id}
                            label={item.label}
                            shortcut={item.shortcut ? `Ctrl+${item.shortcut.toUpperCase()}` : undefined}
                        >
                            <button
                                type="button"
                                className={`composer-format${on ? " is-on" : ""}`}
                                data-format={id}
                                aria-pressed={on}
                                aria-label={item.label}
                                disabled={preview}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => format(id)}
                            >
                                <span aria-hidden="true">{item.glyph}</span>
                            </button>
                        </Tooltip>
                    );
                })}
            </div>

            {(attachments.length > 0 || uploads.length > 0) && (
                <ul className="composer-files">
                    {attachments.map((file) => (
                        <li key={file.attachmentId}>
                            <span>
                                <strong>{file.name}</strong>
                                <small>{file.size}</small>
                            </span>
                            <button
                                type="button"
                                aria-label={`Retirer ${file.name}`}
                                onClick={() =>
                                    setAttachments((current) =>
                                        current.filter((item) => item.attachmentId !== file.attachmentId)
                                    )
                                }
                            >
                                <Icon name="close" size={13} />
                            </button>
                        </li>
                    ))}
                    {uploads.map((item) => (
                        <li key={item.id} className="is-uploading">
                            <span>
                                <strong>{item.name}</strong>
                                <small>{Math.round(item.progress * 100)} %</small>
                            </span>
                            <span
                                className="composer-file-bar"
                                style={{ width: `${item.progress * 100}%` }}
                                aria-hidden="true"
                            />
                        </li>
                    ))}
                </ul>
            )}

            <div className="composer-box">
                {preview && value.trim() ? (
                    <div className="composer-markdown-preview">
                        <Suspense fallback={<p>{value}</p>}>
                            <SafeMarkdown>{value}</SafeMarkdown>
                        </Suspense>
                    </div>
                ) : (
                    <textarea
                        ref={textareaRef}
                        className="composer-input"
                        rows={1}
                        placeholder={placeholder}
                        value={value}
                        maxLength={2000}
                        onChange={onChange}
                        onKeyDown={onKeyDown}
                        onKeyUp={syncSelection}
                        onSelect={syncSelection}
                        onClick={syncSelection}
                        aria-label={placeholder}
                    />
                )}
                <Tooltip label="Aperçu Markdown">
                    <button
                        className={`composer-btn${preview ? " is-on" : ""}`}
                        onClick={() => setPreview((open) => !open)}
                        aria-pressed={preview}
                        aria-label="Aperçu Markdown"
                    >
                        MD
                    </button>
                </Tooltip>
                {recorderAvailable && !recording && (
                    <Tooltip label="Enregistrer un message vocal">
                        <button
                            type="button"
                            className="composer-btn"
                            onClick={startRecording}
                            aria-label="Enregistrer un message vocal"
                        >
                            <Icon name="volume" size={19} />
                        </button>
                    </Tooltip>
                )}

                {recording && (
                    <span className="voice-recording" role="status">
                        <i className="voice-recording-dot" style={{ transform: `scale(${1 + level * 0.6})` }} />
                        <time>
                            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                        </time>
                        <button type="button" className="btn btn-quiet" onClick={cancelRecording}>
                            Annuler
                        </button>
                        <button type="button" className="btn btn-accent" onClick={finishRecording}>
                            Envoyer
                        </button>
                    </span>
                )}

                <Tooltip label="Joindre un fichier">
                    <label className="composer-btn">
                        <Icon name="plus" size={19} />
                        <input
                            type="file"
                            multiple
                            hidden
                            disabled={sending}
                            onChange={(event) => {
                                addFiles(event.target.files);
                                event.target.value = "";
                            }}
                        />
                        <span className="sr-only">Joindre un fichier</span>
                    </label>
                </Tooltip>
                <Tooltip label="Envoyer un dossier">
                    <label className="composer-btn">
                        <Icon name="channels" size={19} />
                        <input
                            type="file"
                            multiple
                            hidden
                            disabled={sending}
                            webkitdirectory=""
                            directory=""
                            onChange={(event) => {
                                addFiles(event.target.files);
                                event.target.value = "";
                            }}
                        />
                        <span className="sr-only">Envoyer un dossier</span>
                    </label>
                </Tooltip>
                <Tooltip label="Emoji">
                    <button
                        className="composer-btn"
                        onClick={() => setEmojiOpen((o) => !o)}
                        aria-label="Insérer un emoji"
                    >
                        <Icon name="smile" size={19} />
                    </button>
                </Tooltip>
                <Tooltip label="Envoyer" shortcut="Entrée">
                    <button
                        className="composer-send"
                        onClick={submit}
                        disabled={(!value.trim() && attachments.length === 0) || sending || uploads.length > 0}
                        aria-label="Envoyer le message"
                    >
                        <Icon name="send" size={20} />
                    </button>
                </Tooltip>
            </div>
            {template && (
                <p className="command-template" aria-live="polite">
                    <code>/{template.name}</code> {template.args}
                    <small>{template.summary}</small>
                </p>
            )}

            {commands.length > 0 && (
                <ul className="command-suggestions" role="listbox" aria-label="Commandes">
                    {commands.map((command, index) => (
                        <li key={command.name}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === commandIndex}
                                className={index === commandIndex ? "is-active" : ""}
                                onMouseEnter={() => setCommandIndex(index)}
                                onClick={() => setValue(`/${command.name} `)}
                            >
                                <strong>/{command.name}</strong>
                                {command.args && <code>{command.args}</code>}
                                <small>{command.summary}</small>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {emojiOpen && <EmojiPicker guildId={guildId} onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}
        </div>
    );
}
