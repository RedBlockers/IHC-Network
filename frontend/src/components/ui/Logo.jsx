export default function Logo({ size = 30, withWordmark = false }) {
    return (
        <span className="logo" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="12.5" stroke="var(--accent)" strokeWidth="5" />
                <path d="M29 29 L41 41" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
            </svg>
            {withWordmark && (
                <span className="wordmark">
                    qweillo<span className="dot">.</span>
                </span>
            )}
        </span>
    );
}
