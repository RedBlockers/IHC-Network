import { Fragment, useState } from "react";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { languageFromClass, tokenize } from "../../lib/codeHighlight.js";
import { splitReferences } from "../../lib/codeReferences.js";
import CodeReference from "./CodeReference.jsx";

export default function SafeMarkdown({ children, roles = [], emojis = [] }) {
    return (
        <div className="message-markdown">
            <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                    a: ({ children: label, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer nofollow">{label}</a>
                    ),
                    p: ({ children: content }) => <p>{decorate(content, roles, emojis)}</p>,
                    li: ({ children: content }) => <li>{decorate(content, roles, emojis)}</li>,
                    code: CodeBlock,
                }}
            >
                {children}
            </Markdown>
        </div>
    );
}

function CodeBlock({ className, children, ...props }) {
    const language = languageFromClass(className);
    const source = String(children ?? "").replace(/\n$/, "");
    const isBlock = Boolean(className) || source.includes("\n");

    if (!isBlock) return <code {...props}>{children}</code>;

    const segments = tokenize(source, language);
    return (
        <code className={`code-block${language ? ` language-${language}` : ""}`} data-language={language || undefined} {...props}>
            {segments.map((segment, index) =>
                segment.type === "plain" ? (
                    <Fragment key={index}>{segment.value}</Fragment>
                ) : (
                    <span className={`tok tok-${segment.type}`} key={index}>{segment.value}</span>
                )
            )}
        </code>
    );
}

function Spoiler({ children }) {
    const [revealed, setRevealed] = useState(false);
    return (
        <button
            type="button"
            className={`spoiler${revealed ? " is-revealed" : ""}`}
            aria-expanded={revealed}
            aria-label={revealed ? "Masquer le passage" : "Révéler le passage masqué"}
            onClick={() => setRevealed((open) => !open)}
        >
            {children}
        </button>
    );
}

const MENTION = /^@(?:everyone|here|[a-zA-Z0-9._-]{3,20})$/i;

function decorate(children, roles = [], emojis = []) {
    const values = Array.isArray(children) ? children : [children];

    return values.flatMap((child, childIndex) => {
        if (typeof child !== "string") return [child];

        return child.split(/(\|\|[\s\S]+?\|\|)/g).filter(Boolean).flatMap((chunk, chunkIndex) => {
            const key = `${childIndex}:${chunkIndex}`;
            if (chunk.startsWith("||") && chunk.endsWith("||") && chunk.length > 4) {
                return [<Spoiler key={key}>{mentions(chunk.slice(2, -2), key, roles, emojis)}</Spoiler>];
            }
            return mentions(chunk, key, roles, emojis);
        });
    });
}

function codeLinks(text, key) {
    const parts = splitReferences(text);
    if (parts.length === 1 && !parts[0].reference) return [text];

    return parts.map((part, index) =>
        part.reference ? (
            <CodeReference key={`${key}:ref:${index}`} reference={part.reference} label={part.text} />
        ) : (
            part.text
        )
    );
}

const ROLE_MENTION = /^@&(\d{1,20})$/;

const CUSTOM_EMOJI = /^:([a-z0-9_]{2,32}):$/;

function mentions(text, keyPrefix, roles = [], emojis = []) {
    const byId = new Map(roles.map((role) => [String(role.roleId), role]));
    const byName = new Map(emojis.map((emoji) => [emoji.name, emoji]));

    return text
        .split(/(@everyone\b|@here\b|@&\d{1,20}\b|@[a-zA-Z0-9._-]{3,20}\b|:[a-z0-9_]{2,32}:)/gi)
        .filter(Boolean)
        .map((part, index) => {
            const key = `${keyPrefix}:${index}`;
            const roleMatch = ROLE_MENTION.exec(part);
            const emojiMatch = CUSTOM_EMOJI.exec(part);

            if (emojiMatch && byName.has(emojiMatch[1])) {
                const emoji = byName.get(emojiMatch[1]);
                return (
                    <img
                        className="custom-emoji"
                        key={key}
                        src={emoji.url}
                        alt={`:${emoji.name}:`}
                        title={`:${emoji.name}:`}
                        loading="lazy"
                    />
                );
            }

            if (roleMatch) {
                const role = byId.get(roleMatch[1]);
                return (
                    <span
                        className="mention-token mention-role"
                        key={key}
                        style={role?.color ? { "--role": role.color } : undefined}
                    >
                        @{role ? role.name : "rôle supprimé"}
                    </span>
                );
            }

            if (MENTION.test(part)) return <span className="mention-token" key={key}>{part}</span>;

            return <Fragment key={key}>{codeLinks(part, key)}</Fragment>;
        });
}
