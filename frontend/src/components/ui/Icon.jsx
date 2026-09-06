const paths = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    search: (
        <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
        </>
    ),
    home: (
        <>
            <path d="m3.5 11 8.5-7 8.5 7" />
            <path d="M6 10v10h12V10M10 20v-6h4v6" />
        </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3v-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.51V3h4v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.6.54.98 1.1 1H21v4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
        </>
    ),
    logout: (
        <>
            <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
        </>
    ),
    hash: (
        <>
            <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" />
        </>
    ),
    volume: (
        <>
            <path d="M5 10v4h4l5 4V6L9 10H5Z" />
            <path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
        </>
    ),
    chevron: <path d="m7 9 5 5 5-5" />,
    "chevron-up": <path d="m7 15 5-5 5 5" />,
    "chevron-down": <path d="m7 9 5 5 5-5" />,
    users: (
        <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4.5-6" />
        </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    invite: (
        <>
            <path d="M12 5h7v7M19 5l-8 8" />
            <path d="M17 14v5H5V7h5" />
        </>
    ),
    channels: (
        <>
            <path d="M4 6h16M4 12h10M4 18h13" />
            <circle cx="18" cy="12" r="2" />
        </>
    ),
    smile: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 10h.01M15.5 10h.01M8 14.5a5 5 0 0 0 8 0" />
        </>
    ),
    reply: (
        <>
            <path d="m9 8-5 4 5 4" />
            <path d="M5 12h8a6 6 0 0 1 6 6" />
        </>
    ),
    edit: (
        <>
            <path d="m14.5 5.5 4 4L9 19l-5 1 1-5 9.5-9.5Z" />
            <path d="m12.5 7.5 4 4" />
        </>
    ),
    trash: (
        <>
            <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </>
    ),
    crown: (
        <>
            <path d="m4 8 4 4 4-7 4 7 4-4-2 10H6L4 8Z" />
            <path d="M7 21h10" />
        </>
    ),
    send: (
        <>
            <path d="m3 11 18-8-8 18-2-8-8-2Z" />
            <path d="m11 13 5-5" />
        </>
    ),
    bell: (
        <>
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
        </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    calendar: (
        <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2" />
        </>
    ),
    download: (
        <>
            <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </>
    ),
    "chevron-left": <path d="m15 5-7 7 7 7" />,
    lock: (
        <>
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
        </>
    ),
    image: (
        <>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8" cy="8" r="1.5" />
            <path d="m3 17 5-5 4 4 4-6 5 7" />
        </>
    ),
    alert: (
        <>
            <path d="M12 4 2.5 20h19L12 4Z" />
            <path d="M12 10v4.5" />
            <path d="M12 17.6h.01" />
        </>
    ),
};

export default function Icon({ name, size = 18, strokeWidth = 1.8, className }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths[name]}
        </svg>
    );
}
