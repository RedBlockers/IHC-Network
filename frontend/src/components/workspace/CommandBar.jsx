import Icon from "../ui/Icon.jsx";
import Logo from "../ui/Logo.jsx";
import InstanceButton from "./InstanceButton.jsx";

export default function CommandBar({ context, onOpenSwitcher, onToggleChannels, unreadCount, onOpenNotifications }) {
    return (
        <header className="command-bar">
            <button className="command-menu" onClick={onToggleChannels} aria-label="Afficher les salons">
                <Icon name="menu" />
            </button>
            <button className="command-brand" onClick={onOpenSwitcher} aria-label="Ouvrir la navigation rapide">
                <Logo size={23} withWordmark />
            </button>
            <button
                className="command-search"
                onClick={onOpenSwitcher}
                aria-label="Rechercher une communauté ou un salon"
            >
                <Icon name="search" size={16} />
                <span>Aller à une communauté ou un salon…</span>
                <kbd>⌘ K</kbd>
            </button>
            <span className="command-context">{context}</span>
            <InstanceButton />
            <button
                className="command-notifications"
                onClick={onOpenNotifications}
                aria-label={`${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`}
            >
                <Icon name="bell" size={19} />
                {unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
        </header>
    );
}
