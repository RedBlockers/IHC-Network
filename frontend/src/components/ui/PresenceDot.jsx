const LABELS = { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", busy: "Occupé", offline: "Hors ligne" };

export default function PresenceDot({ status = "offline", ring = false, size = 12 }) {
    return (
        <span
            className={`presence presence-${status}${ring ? " presence-ring" : ""}`}
            style={{ width: size, height: size }}
            role="img"
            aria-label={LABELS[status] || LABELS.offline}
            title={LABELS[status] || LABELS.offline}
        />
    );
}
