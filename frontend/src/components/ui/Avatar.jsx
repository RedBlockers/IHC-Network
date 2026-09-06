import PresenceDot from "./PresenceDot.jsx";
import AvatarDecoration from "./AvatarDecoration.jsx";

const HUES = [8, 28, 150, 190, 265, 320];

function hueFor(seed) {
    const s = String(seed);
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    return HUES[Math.abs(hash) % HUES.length];
}

export default function Avatar({ user, size = 40, presence, density = false }) {
    const decoration = user?.avatarDecoration && user.avatarDecoration !== "none" ? user.avatarDecoration : null;
    const hasImage = user?.avatar && !user.avatar.startsWith("/assets/");
    const initial = (user?.displayName || user?.handle || "?").charAt(0).toUpperCase();
    const hue = hueFor(user?.userId ?? initial);

    return (
        <span
            className={`avatar${density ? " avatar-density" : ""}${decoration ? " has-decoration" : ""}`}
            data-decoration={decoration ?? undefined}
            style={density ? undefined : { width: size, height: size }}
        >
            {hasImage ? (
                <img
                    src={user.avatar}
                    alt=""
                    className="avatar-img"
                    loading="lazy"
                    {...(density ? {} : { width: size, height: size })}
                />
            ) : (
                <span
                    className="avatar-fallback"
                    style={{
                        background: `linear-gradient(140deg, hsl(${hue} 70% 52%), hsl(${hue + 24} 66% 42%))`,
                        ...(density ? {} : { fontSize: size * 0.42 }),
                    }}
                >
                    {initial}
                </span>
            )}
            {decoration && <AvatarDecoration type={decoration} seed={user?.userId ?? initial} />}
            {presence && <PresenceDot status={presence} ring />}
        </span>
    );
}
