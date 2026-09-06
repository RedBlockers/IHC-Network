import Icon from "../ui/Icon.jsx";

export default function SidebarReorder({ label, index, count, onMove, disabled = false }) {
    const first = index === 0;
    const last = index === count - 1;

    return (
        <span className="reorder-controls">
            <button
                type="button"
                className="reorder-button"
                onClick={(event) => { event.stopPropagation(); onMove(index, index - 1); }}
                disabled={disabled || first}
                aria-label={`Monter ${label}`}
            >
                <Icon name="chevron-up" size={13} />
            </button>
            <button
                type="button"
                className="reorder-button"
                onClick={(event) => { event.stopPropagation(); onMove(index, index + 1); }}
                disabled={disabled || last}
                aria-label={`Descendre ${label}`}
            >
                <Icon name="chevron-down" size={13} />
            </button>
        </span>
    );
}
