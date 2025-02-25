export function formatTimestamp(sentDate) {
    const messageDate = new Date(sentDate);
    const currentDate = new Date();

    if (
        messageDate.toLocaleDateString("fr-FR") ===
        currentDate.toLocaleDateString("fr-FR")
    ) {
        return messageDate.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    } else {
        return messageDate.toLocaleDateString("fr-FR");
    }
}
