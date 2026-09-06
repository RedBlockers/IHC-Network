const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const full = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function messageTimestamp(date) {
    const d = new Date(date);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay(d, now)) return time.format(d);
    if (isSameDay(d, yesterday)) return `hier ${time.format(d)}`;
    return `${dayMonth.format(d)} ${time.format(d)}`;
}

export function dayLabel(date) {
    const d = new Date(date);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(d, now)) return "Aujourd'hui";
    if (isSameDay(d, yesterday)) return "Hier";
    return dayMonth.format(d);
}

export const fullTimestamp = (date) => full.format(new Date(date));

export function shouldGroup(previous, current) {
    if (!previous) return false;
    if (previous.author.userId !== current.author.userId) return false;
    return new Date(current.createdAt) - new Date(previous.createdAt) < 5 * 60 * 1000;
}
