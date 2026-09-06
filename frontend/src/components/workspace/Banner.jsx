import { bannerGradient } from "../../lib/banners.js";
import { useCustomization } from "../../context/useCustomization.js";
import Icon from "../ui/Icon.jsx";
import Tooltip from "../ui/Tooltip.jsx";

export default function Banner({ guild, onOpenSettings, onCreateInvite, canEdit, scrolled = false }) {
    const { bannerBehaviour } = useCustomization();

    if (bannerBehaviour === "hidden") {
        return (
            <header className="banner banner-text">
                <div className="banner-title">{guild.name}</div>
                {guild.description && <div className="banner-sub">{guild.description}</div>}
                <div className="banner-tools">
                    {onCreateInvite && (
                        <Tooltip label="Inviter des gens">
                            <button className="banner-gear" onClick={onCreateInvite} aria-label="Inviter des gens">
                                <Icon name="invite" size={17} />
                            </button>
                        </Tooltip>
                    )}
                    {canEdit && (
                        <Tooltip label="Réglages du serveur">
                            <button className="banner-gear" onClick={onOpenSettings} aria-label="Réglages du serveur">
                                <Icon name="settings" size={17} />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </header>
        );
    }

    const compact = bannerBehaviour === "compact" || (bannerBehaviour === "auto" && scrolled);
    const background = guild.bannerImage
        ? {
              backgroundImage: `url("${guild.bannerImage}")`,
              backgroundPosition: `${guild.bannerFocusX ?? 50}% ${guild.bannerFocusY ?? 50}%`,
          }
        : { background: bannerGradient(guild.banner) };

    return (
        <header className={`banner${compact ? " is-compact" : ""}`}>
            <div className={`banner-grad${guild.bannerImage ? " has-image" : ""}`} style={background} />
            <div className="banner-tools">
                {onCreateInvite && (
                    <Tooltip label="Inviter des gens">
                        <button className="banner-gear" onClick={onCreateInvite} aria-label="Inviter des gens">
                            <Icon name="invite" size={17} />
                        </button>
                    </Tooltip>
                )}
                {canEdit && (
                    <Tooltip label="Réglages du serveur">
                        <button className="banner-gear" onClick={onOpenSettings} aria-label="Réglages du serveur">
                            <Icon name="settings" size={17} />
                        </button>
                    </Tooltip>
                )}
            </div>
            <div className="banner-title">{guild.name}</div>
            {guild.description && <div className="banner-sub">{guild.description}</div>}
        </header>
    );
}
