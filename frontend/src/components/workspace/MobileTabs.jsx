import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";

const TABS = [
    { id: "home", label: "Accueil", icon: "home" },
    { id: "communities", label: "Communautés", icon: "channels" },
    { id: "messages", label: "Messages", icon: "hash" },
    { id: "alerts", label: "Alertes", icon: "bell" },
];

export default function MobileTabs({ active, counts = {}, user, onSelect, hidden }) {
    if (hidden) return null;

    return (
        <nav className="mobile-tabs" aria-label="Navigation principale">
            {TABS.map((tab) => {
                const count = counts[tab.id] ?? 0;
                return (
                    <button
                        type="button"
                        key={tab.id}
                        className={`mobile-tab${active === tab.id ? " is-active" : ""}`}
                        aria-current={active === tab.id ? "page" : undefined}
                        onClick={() => onSelect(tab.id)}
                    >
                        <span className="mobile-tab-glyph">
                            <Icon name={tab.icon} size={20} />
                            {count > 0 && <span className="mobile-tab-count">{count > 99 ? "99+" : count}</span>}
                        </span>
                        {tab.label}
                    </button>
                );
            })}

            <button
                type="button"
                className={`mobile-tab${active === "profile" ? " is-active" : ""}`}
                aria-current={active === "profile" ? "page" : undefined}
                onClick={() => onSelect("profile")}
            >
                <span className="mobile-tab-glyph">
                    <Avatar user={user} size={20} />
                </span>
                Profil
            </button>
        </nav>
    );
}
