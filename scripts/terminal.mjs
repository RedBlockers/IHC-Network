import { emitKeypressEvents } from "node:readline";

const ansi = { reset: "\u001b[0m", accent: "\u001b[38;5;43m", muted: "\u001b[38;5;245m", strong: "\u001b[1m" };

export class Terminal {
    constructor({ input = process.stdin, output = process.stdout } = {}) {
        this.input = input;
        this.output = output;
        this.color = !process.env.NO_COLOR && output.isTTY;
        emitKeypressEvents(input);
    }

    paint(text, tone) {
        return this.color ? `${ansi[tone]}${text}${ansi.reset}` : text;
    }

    intro(existing = false) {
        this.output.write(
            `\n  ${this.paint("qweillo.", "accent")}\n  ${this.paint(existing ? "Votre serveur, à portée de main." : "Votre communauté commence ici.", "muted")}\n\n`
        );
    }

    async prompt(render, handle) {
        let lines = 0;
        const redraw = () => {
            if (lines) this.output.write(`\u001b[${lines}A\u001b[0J`);
            const text = render();
            this.output.write(text + "\n");
            lines = text.split("\n").length;
        };
        this.input.setRawMode(true);
        this.input.resume();
        this.output.write("\u001b[?25l");
        try {
            return await new Promise((resolve, reject) => {
                const cleanup = () => this.input.off("keypress", keypress);
                const keypress = (text, key = {}) => {
                    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
                        cleanup();
                        reject(
                            Object.assign(
                                new Error("Installation interrompue. Aucune étape suivante ne sera exécutée."),
                                { code: "CANCELLED" }
                            )
                        );
                        return;
                    }
                    const result = handle(text, key);
                    if (result?.done) {
                        cleanup();
                        resolve(result.value);
                        return;
                    }
                    redraw();
                };
                this.input.on("keypress", keypress);
                redraw();
            });
        } finally {
            this.input.setRawMode(false);
            this.input.pause();
            this.output.write("\u001b[?25h");
        }
    }

    async select(title, options, initial = 0) {
        let selected = Math.max(0, Math.min(initial, options.length - 1));
        const width = Math.max(32, (this.output.columns || 80) - 10);
        const shorten = (value) => (value.length > width ? value.slice(0, width - 1) + "…" : value);
        const value = await this.prompt(
            () =>
                [
                    `  ${this.paint(title, "strong")}`,
                    ...options.map(
                        (option, index) =>
                            `  ${index === selected ? this.paint("›", "accent") : " "} ${index === selected ? this.paint(shorten(option.label), "accent") : shorten(option.label)}`
                    ),
                    "",
                    `    ${this.paint(shorten(options[selected].description || ""), "muted")}`,
                    `    ${this.paint("↑ ↓ choisir  ·  Entrée valider  ·  Échap quitter", "muted")}`,
                    "",
                ].join("\n"),
            (_text, key) => {
                if (key.name === "up" || key.name === "k") selected = (selected + options.length - 1) % options.length;
                if (key.name === "down" || key.name === "j") selected = (selected + 1) % options.length;
                if (key.name === "home") selected = 0;
                if (key.name === "end") selected = options.length - 1;
                if (/^[1-9]$/.test(key.name || "") && Number(key.name) <= options.length)
                    selected = Number(key.name) - 1;
                return key.name === "return" ? { done: true, value: options[selected].value } : null;
            }
        );
        return value;
    }

    async text(label, fallback = "", { secret = false, validate } = {}) {
        let value = "";
        let cursor = 0;
        let error = "";
        const width = Math.max(24, (this.output.columns || 80) - 8);
        const result = await this.prompt(
            () => {
                const displayed = secret ? "•".repeat(value.length) : value;
                const visible = displayed.slice(Math.max(0, cursor - width + 2), Math.max(width, cursor + 1));
                return [
                    `  ${this.paint(label, "strong")}`,
                    `  ${this.paint("›", "accent")} ${visible || this.paint(fallback || (secret ? "Saisie masquée" : ""), "muted")}`,
                    error ? `    ${error}` : `    ${this.paint("Entrée valider  ·  Échap quitter", "muted")}`,
                    "",
                ].join("\n");
            },
            (text, key) => {
                error = "";
                if (key.name === "return") {
                    const answer = (secret ? value : value.trim()) || fallback;
                    error = validate?.(answer) || "";
                    return error ? null : { done: true, value: answer };
                }
                if (key.ctrl && key.name === "u") {
                    value = "";
                    cursor = 0;
                } else if (key.name === "left") cursor = Math.max(0, cursor - 1);
                else if (key.name === "right") cursor = Math.min(value.length, cursor + 1);
                else if (key.name === "home") cursor = 0;
                else if (key.name === "end") cursor = value.length;
                else if (key.name === "backspace" && cursor) {
                    value = value.slice(0, cursor - 1) + value.slice(cursor);
                    cursor--;
                } else if (key.name === "delete") value = value.slice(0, cursor) + value.slice(cursor + 1);
                else if (!key.ctrl && !key.meta && text && !/[\x00-\x1f\x7f]/.test(text)) {
                    value = value.slice(0, cursor) + text + value.slice(cursor);
                    cursor += text.length;
                }
                return null;
            }
        );
        return result;
    }

    summary(entries) {
        const width = Math.max(...entries.map(([key]) => key.length));
        this.output.write(`\n  ${this.paint("Prêt à installer", "strong")}\n\n`);
        for (const [key, value] of entries)
            this.output.write(`  ${this.paint(key.padEnd(width), "muted")}  ${value}\n`);
        this.output.write("\n");
    }

    close() {
        if (this.input.isRaw) this.input.setRawMode(false);
        this.input.pause();
        this.output.write("\u001b[?25h");
    }
}
