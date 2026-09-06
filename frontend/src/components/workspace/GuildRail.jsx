import { useAuth } from "../../context/useAuth.js";
import Icon from "../ui/Icon.jsx";
import Tooltip from "../ui/Tooltip.jsx";

export default function GuildRail({ guilds, activeGuildId, onSelect, onCreate, onOpenSettings }) {
    const { logout } = useAuth();

    return (
        <nav className="community-rail" aria-label="Communautés">
            <ul className="rail-list">
                <li>
                    <Tooltip label="Messages privés" placement="right">
                        <button
                            className={`rail-item${activeGuildId === "home" ? " is-active" : ""}`}
                            aria-label="Messages privés"
                            onClick={() => onSelect("home")}
                        >
                            <span className="rail-pill" />
                            <span className="rail-tile rail-tile-home"><Icon name="home" size={21} /></span>
                        </button>
                    </Tooltip>
                </li>
                <li className="rail-divider" aria-hidden="true" />
                {guilds.map((guild) => (
                    <li key={guild.guildId}>
                        <Tooltip label={guild.name} placement="right">
                        <button
                            className={`rail-item${activeGuildId === guild.guildId ? " is-active" : ""}`}
                            aria-label={guild.name}
                            onClick={() => onSelect(guild.guildId)}
                            style={guild.accent ? { "--accent": guild.accent } : undefined}
                        >
                            <span className="rail-pill" />
                            <span className="rail-tile">
                                {guild.icon ? (
                                    <img className="rail-tile-img" src={guild.icon} alt="" />
                                ) : (
                                    guild.name.charAt(0).toUpperCase()
                                )}
                            </span>
                        </button>
                        </Tooltip>
                    </li>
                ))}
                <li>
                    <Tooltip label="Créer ou rejoindre une communauté" placement="right">
                        <button className="rail-item" aria-label="Créer ou rejoindre une communauté" onClick={onCreate}>
                            <span className="rail-pill" />
                            <span className="rail-tile rail-tile-add"><Icon name="plus" size={22} /></span>
                        </button>
                    </Tooltip>
                </li>
            </ul>
            <div className="rail-foot">
                <Tooltip label="Réglages" placement="right">
                    <button className="rail-mini" onClick={onOpenSettings} aria-label="Réglages">
                        <Icon name="settings" size={19} />
                    </button>
                </Tooltip>
                <Tooltip label="Se déconnecter" placement="right">
                    <button className="rail-mini" onClick={logout} aria-label="Se déconnecter">
                        <Icon name="logout" size={19} />
                    </button>
                </Tooltip>
            </div>
        </nav>
    );
}
