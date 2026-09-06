export const COMMANDS = [
    {
        name: "aide",
        summary: "Liste les commandes disponibles",
        args: "",
        action: "help",
    },
    {
        name: "moi",
        summary: "Écrit à la troisième personne",
        args: "<texte>",
        action: "me",
        needsArgs: true,
    },
    {
        name: "epingler",
        summary: "Épingle le dernier message du salon",
        args: "",
        action: "pin",
        permission: "MANAGE_MESSAGES",
    },
    {
        name: "sondage",
        summary: "Ouvre un sondage",
        args: "[<question> | <choix> | <choix>]",
        action: "poll",
    },
    {
        name: "silence",
        summary: "Coupe les notifications de ce salon",
        args: "",
        action: "mute",
    },
    {
        name: "lu",
        summary: "Marque le salon comme lu",
        args: "",
        action: "read",
    },
];

export function parse(text) {
    const match = /^\/([a-zà-ÿ]+)(?:\s+([\s\S]*))?$/i.exec(String(text ?? "").trim());
    if (!match) return null;

    const command = COMMANDS.find((entry) => entry.name === match[1].toLowerCase());
    if (!command) return null;

    const args = (match[2] ?? "").trim();
    return { command, args, missingArgs: Boolean(command.needsArgs) && args.length === 0 };
}

export function suggest(text, { permissions = [] } = {}) {
    const match = /^\/([a-zà-ÿ]*)$/i.exec(String(text ?? ""));
    if (!match) return [];

    const prefix = match[1].toLowerCase();
    return COMMANDS.filter(
        (command) =>
            command.name.startsWith(prefix) &&
            (!command.permission || permissions.includes(command.permission))
    );
}
