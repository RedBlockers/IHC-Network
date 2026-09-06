const COMMON = {
    comment: [/\/\/[^\n]*/y, /\/\*[\s\S]*?\*\//y],
    string: [/"(?:[^"\\\n]|\\.)*"/y, /'(?:[^'\\\n]|\\.)*'/y, /`(?:[^`\\]|\\.)*`/y],
    number: [/\b\d+(?:\.\d+)?\b/y],
};

const KEYWORDS = {
    javascript: "await async break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield true false null undefined",
    typescript: "await async break case catch class const continue default delete do else export extends finally for from function if implements import in instanceof interface let new of return static super switch this throw try type typeof var void while yield true false null undefined",
    python: "and as assert async await break class continue def del elif else except finally for from global if import in is lambda none not or pass raise return true false try while with yield",
    sql: "select from where insert into values update set delete join left right inner outer on group by order limit offset having union create table alter drop index primary key foreign references not null distinct as and or",
    bash: "if then else elif fi for while do done case esac function return export local echo cd set unset source exit",
    css: "important media supports keyframes from to and not only",
    json: "true false null",
    html: "",
};

const ALIASES = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", sh: "bash", shell: "bash", zsh: "bash",
    yml: "yaml", md: "markdown",
};

export const SUPPORTED = Object.keys(KEYWORDS);

export const normalizeLanguage = (raw) => {
    const value = String(raw ?? "").trim().toLowerCase();
    return ALIASES[value] ?? value;
};

export function tokenize(code, language) {
    const lang = normalizeLanguage(language);
    const source = String(code ?? "");
    if (!Object.hasOwn(KEYWORDS, lang)) return [{ type: "plain", value: source }];

    const keywords = new Set(KEYWORDS[lang].split(" ").filter(Boolean));
    const segments = [];
    let buffer = "";
    let index = 0;

    const flush = () => {
        if (buffer) segments.push({ type: "plain", value: buffer });
        buffer = "";
    };

    const tryPatterns = (patterns, type) => {
        for (const pattern of patterns) {
            pattern.lastIndex = index;
            const match = pattern.exec(source);
            if (match && match.index === index) {
                flush();
                segments.push({ type, value: match[0] });
                index += match[0].length;
                return true;
            }
        }
        return false;
    };

    const wordPattern = /[A-Za-z_$][\w$]*/y;

    while (index < source.length) {
        const character = source[index];

        if (character === "#" && (lang === "bash" || lang === "python")) {
            const end = source.indexOf("\n", index);
            flush();
            const stop = end === -1 ? source.length : end;
            segments.push({ type: "comment", value: source.slice(index, stop) });
            index = stop;
            continue;
        }

        if (lang !== "json" && tryPatterns(COMMON.comment, "comment")) continue;
        if (tryPatterns(COMMON.string, "string")) continue;
        if (tryPatterns(COMMON.number, "number")) continue;

        wordPattern.lastIndex = index;
        const word = wordPattern.exec(source);
        if (word && word.index === index) {
            flush();
            segments.push({ type: keywords.has(word[0].toLowerCase()) ? "keyword" : "plain", value: word[0] });
            index += word[0].length;
            continue;
        }

        buffer += character;
        index += 1;
    }

    flush();
    return segments.reduce((acc, segment) => {
        const previous = acc[acc.length - 1];
        if (previous && previous.type === segment.type) previous.value += segment.value;
        else acc.push({ ...segment });
        return acc;
    }, []);
}

export function languageFromClass(className) {
    const match = /language-([A-Za-z0-9_+-]+)/.exec(String(className ?? ""));
    return match ? normalizeLanguage(match[1]) : "";
}
