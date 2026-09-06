const PATTERNS = [
    { id: "aws-access-key", label: "clé d'accès AWS", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { id: "github-token", label: "jeton GitHub", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
    { id: "slack-token", label: "jeton Slack", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
    { id: "google-api-key", label: "clé d'API Google", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
    { id: "stripe-key", label: "clé Stripe", pattern: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}\b/g },
    { id: "private-key", label: "clé privée", pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g },
    { id: "jwt", label: "jeton JWT", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    {
        id: "connection-string",
        label: "chaîne de connexion avec mot de passe",
        pattern: /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]+@\S+/g,
    },
    {
        id: "assignment",
        label: "secret affecté à une variable",
        pattern: /\b(?:pass(?:word|wd)?|secret|token|api[_-]?key|access[_-]?key|auth)\s*[:=]\s*["']?([^\s"'<>{}]{8,})["']?/gi,
        capture: 1,
    },
];

const PLACEHOLDER = /^(?:[x*.]+|changeme|your[_-]?\w+|<[^>]+>|\$\{[^}]+\}|xxx+|example|redacted|null|undefined)$/i;

export function scan(text) {
    if (typeof text !== "string" || text.length === 0) return [];

    const findings = [];
    for (const rule of PATTERNS) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match = regex.exec(text);
        while (match !== null) {
            const value = rule.capture ? match[rule.capture] : match[0];
            const start = rule.capture ? match.index + match[0].lastIndexOf(value) : match.index;

            if (value && !PLACEHOLDER.test(value)) {
                findings.push({ id: rule.id, label: rule.label, start, end: start + value.length, value });
            }
            match = regex.exec(text);
        }
    }

    findings.sort((a, b) => a.start - b.start || b.end - a.end);
    return findings.filter((finding, index) => index === 0 || finding.start >= findings[index - 1].end);
}

export function redact(text, findings = scan(text)) {
    if (findings.length === 0) return text;
    let output = "";
    let cursor = 0;
    for (const finding of findings) {
        output += text.slice(cursor, finding.start) + "‹secret masqué›";
        cursor = finding.end;
    }
    return output + text.slice(cursor);
}

export const hasSecret = (text) => scan(text).length > 0;

export const PATTERN_IDS = PATTERNS.map((rule) => rule.id);
