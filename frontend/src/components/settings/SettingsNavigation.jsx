import { useId, useRef, useState } from "react";
import Icon from "../ui/Icon.jsx";

export default function SettingsNavigation({ groups, section, onSelect, identity, label }) {
    const [expanded, setExpanded] = useState(false);
    const navId = useId();
    const trigger = useRef(null);
    const current = groups.flatMap((group) => group.items).find((item) => item.id === section);

    function select(id) {
        onSelect(id);
        setExpanded(false);
        if (window.matchMedia("(max-width: 700px)").matches) trigger.current?.focus();
    }

    return (
        <aside
            className={`settings-navigation${expanded ? " is-expanded" : ""}`}
            onKeyDown={(event) => {
                if (expanded && event.key === "Escape") {
                    event.preventDefault();
                    setExpanded(false);
                    trigger.current?.focus();
                }
            }}
        >
            <div className="settings-navigation-identity">{identity}</div>
            <button
                ref={trigger}
                type="button"
                className="settings-navigation-trigger"
                aria-label="Choisir une rubrique"
                aria-expanded={expanded}
                aria-controls={navId}
                onClick={() => setExpanded(!expanded)}
            >
                <Icon name={current?.icon || "settings"} size={18} />
                <span>{current?.label}</span>
                <Icon name="chevron-down" size={16} />
            </button>
            <nav id={navId} aria-label={label} className="settings-navigation-items">
                {groups.map((group) => (
                    <div className="settings-navigation-group" key={group.label}>
                        <p>{group.label}</p>
                        {group.items.map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                className={`settings-navigation-item${section === item.id ? " is-active" : ""}`}
                                aria-current={section === item.id ? "page" : undefined}
                                onClick={() => select(item.id)}
                            >
                                <Icon name={item.icon} size={18} />
                                <span>{item.label}</span>
                                {section === item.id && <Icon name="check" size={14} />}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>
        </aside>
    );
}
