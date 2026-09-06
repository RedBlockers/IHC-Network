const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parseUnifiedDiff(patch) {
    const files = [];
    let file = null;
    let hunk = null;
    let oldNo = 0;
    let newNo = 0;

    const ensureFile = () => {
        if (!file) {
            file = { oldPath: null, newPath: null, hunks: [] };
            files.push(file);
        }
        return file;
    };

    const lines = String(patch ?? "").split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    for (const raw of lines) {
        if (raw.startsWith("diff --git ")) {
            file = { oldPath: null, newPath: null, hunks: [] };
            files.push(file);
            hunk = null;
            continue;
        }
        if (raw.startsWith("--- ")) {
            ensureFile().oldPath = raw.slice(4).replace(/^a\//, "");
            continue;
        }
        if (raw.startsWith("+++ ")) {
            ensureFile().newPath = raw.slice(4).replace(/^b\//, "");
            continue;
        }
        if (raw.startsWith("index ") || raw.startsWith("new file mode") || raw.startsWith("deleted file mode") || raw.startsWith("similarity ") || raw.startsWith("rename ")) {
            continue;
        }
        const header = HUNK.exec(raw);
        if (header) {
            oldNo = Number(header[1]);
            newNo = Number(header[3]);
            hunk = { header: header[5].trim(), oldStart: oldNo, newStart: newNo, lines: [] };
            ensureFile().hunks.push(hunk);
            continue;
        }
        if (raw.startsWith("\\ ")) continue;
        if (!hunk) {
            if (raw === "" && files.length === 0) continue;
            hunk = { header: "", oldStart: 1, newStart: 1, lines: [] };
            ensureFile().hunks.push(hunk);
            oldNo = 1;
            newNo = 1;
        }
        const marker = raw[0];
        const text = raw.slice(1);
        if (marker === "+") {
            hunk.lines.push({ type: "add", oldNo: null, newNo: newNo++, text });
        } else if (marker === "-") {
            hunk.lines.push({ type: "del", oldNo: oldNo++, newNo: null, text });
        } else {
            hunk.lines.push({ type: "ctx", oldNo: oldNo++, newNo: newNo++, text: marker === " " ? text : raw });
        }
    }

    return { files: files.filter((entry) => entry.hunks.length > 0) };
}

export function diffStats(patch) {
    let added = 0;
    let removed = 0;
    for (const entry of parseUnifiedDiff(patch).files) {
        for (const hunk of entry.hunks) {
            for (const line of hunk.lines) {
                if (line.type === "add") added += 1;
                else if (line.type === "del") removed += 1;
            }
        }
    }
    return { added, removed };
}
