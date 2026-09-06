import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import FriendsPanel from "./FriendsPanel.jsx";

export default function HomeView({
    user,
    guilds,
    conversations,
    onSelectGuild,
    onSelectConversation,
    onCreate,
    onJoin,
    onOpenFriend,
    onDirectChannelsChanged,
}) {
    return (
        <section className="home-view">
            <header className="home-hero">
                <h1>Bonjour, {user.displayName || user.handle}</h1>
                <p>Retrouvez vos communautés, vos amis et vos conversations.</p>
                <div className="home-actions">
                    <button className="btn btn-accent" onClick={onCreate}>
                        <Icon name="plus" size={17} /> Créer une communauté
                    </button>
                    <button className="btn btn-ghost" onClick={onJoin}>
                        <Icon name="invite" size={17} /> Rejoindre avec un lien
                    </button>
                </div>
            </header>

            <FriendsPanel onOpenFriend={onOpenFriend} onDirectChannelsChanged={onDirectChannelsChanged} />

            <section className="home-section">
                <div className="home-section-head">
                    <h2>Vos communautés</h2>
                    <span>{guilds.length}</span>
                </div>
                {guilds.length > 0 ? (
                    <div className="home-community-grid">
                        {guilds.map((guild) => (
                            <button
                                key={guild.guildId}
                                className="home-community-card"
                                onClick={() => onSelectGuild(guild.guildId)}
                            >
                                <span
                                    className="home-community-icon"
                                    style={guild.accent ? { "--accent": guild.accent } : undefined}
                                >
                                    {guild.icon ? <img src={guild.icon} alt="" /> : guild.name.charAt(0).toUpperCase()}
                                </span>
                                <span>
                                    <strong>{guild.name}</strong>
                                    {guild.description && <small>{guild.description}</small>}
                                </span>
                                <Icon name="chevron" size={16} />
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="home-section-empty">
                        Créez votre communauté ou rejoignez-en une avec son lien d’invitation.
                    </p>
                )}
            </section>

            {conversations.length > 0 && (
                <section className="home-section">
                    <div className="home-section-head">
                        <h2>Conversations</h2>
                        <span>{conversations.length}</span>
                    </div>
                    <div className="home-conversations">
                        {conversations.map((channel) => (
                            <button key={channel.channelId} onClick={() => onSelectConversation(channel.channelId)}>
                                <Avatar user={channel.user} size={38} presence={channel.user?.presence} />
                                <span>
                                    <strong>{channel.user?.displayName || channel.user?.handle}</strong>
                                    <small>@{channel.user?.handle}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}
        </section>
    );
}
