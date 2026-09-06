export function localDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function downloadText(name, text, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function calendarEvent(event) {
    const escape = (value) =>
        String(value ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/\r\n|\r|\n/g, "\\n")
            .replace(/;/g, "\\;")
            .replace(/,/g, "\\,");
    const date = (value) =>
        new Date(value)
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}Z$/, "Z");
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Qweillo//Calendrier//FR",
        "BEGIN:VEVENT",
        `UID:${event.channelId}-${event.eventId}@qweillo`,
        `DTSTAMP:${date(new Date())}`,
        `DTSTART:${date(event.startsAt)}`,
        `DTEND:${date(event.endsAt || new Date(new Date(event.startsAt).getTime() + 7_200_000))}`,
        `SUMMARY:${escape(event.title)}`,
        `DESCRIPTION:${escape(event.description)}`,
        `LOCATION:${escape(event.location)}`,
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ].join("\r\n");
}
