import { useEffect, useId, useRef } from "react";
import { observeDecoration } from "../../lib/decorationMotion.js";

const TYPES = new Set(["laurier", "couronne", "flammes", "vagues", "etoiles", "circuit"]);
const LEAVES = [
    [30, 80, -55],
    [21, 69, -37],
    [16, 56, -16],
    [17, 42, 5],
    [22, 29, 23],
    [30, 19, 43],
];
const STARS = [
    [19, 25, 6.6],
    [73, 13, 7.5],
    [91, 48, 4.3],
    [75, 82, 6],
    [24, 84, 4.5],
];
const TRACES = ["M11 45V32L23 20H32", "M67 13H77L89 25V35", "M91 59V72L80 83H67", "M40 89H26L12 75V66"];

function Star({ x, y, radius, index }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <path
                className="deco-star deco-motion"
                style={{ "--star-delay": `${index * -1.17}s` }}
                d={`M0 ${-radius}Q${radius * 0.17} ${-radius * 0.17} ${radius} 0Q${radius * 0.17} ${radius * 0.17} 0 ${radius}Q${-radius * 0.17} ${radius * 0.17} ${-radius} 0Q${-radius * 0.17} ${-radius * 0.17} 0 ${-radius}Z`}
            />
        </g>
    );
}

export default function AvatarDecoration({ type, seed = 0 }) {
    const id = useId().replace(/:/g, "");
    const ref = useRef(null);
    useEffect(() => observeDecoration(ref.current), []);
    if (!TYPES.has(type)) return null;
    const gradient = `${id}-material`;
    const shine = `${id}-shine`;
    const mask = `${id}-portrait`;
    const crown = `${id}-crown`;
    const phase =
        -(
            String(seed)
                .split("")
                .reduce((sum, character) => sum + character.charCodeAt(0), 0) % 61
        ) / 10;
    const colors = {
        laurier: ["#e4f5aa", "#8fae50", "#335d43"],
        couronne: ["#fff1bb", "#deb354", "#8f5929"],
        flammes: ["#ffe4a1", "#ff923d", "#db3e2f"],
        vagues: ["#d9faff", "#5ecbe0", "#2885bc"],
        etoiles: ["#fff7da", "#d5c2ff", "#9476d5"],
        circuit: ["#d5fff0", "#4bdfb8", "#188c76"],
    }[type];
    return (
        <svg
            ref={ref}
            className={`avatar-decoration decoration-${type}`}
            data-animating="false"
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 100 100"
            fill="none"
            style={{ "--deco-phase": `${phase}s` }}
        >
            <defs>
                <linearGradient id={gradient} x1="18" y1="10" x2="79" y2="90" gradientUnits="userSpaceOnUse">
                    <stop stopColor={colors[0]} />
                    <stop offset=".42" stopColor={colors[1]} />
                    <stop offset="1" stopColor={colors[2]} />
                </linearGradient>
                <linearGradient id={shine}>
                    <stop stopColor="#fff" stopOpacity="0" />
                    <stop offset=".5" stopColor="#fff" stopOpacity=".8" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <mask id={mask}>
                    <rect width="100" height="100" fill="white" />
                    <circle cx="50" cy="50" r="34.5" fill="black" />
                </mask>
                <clipPath id={crown}>
                    <path d="M28 28 24 10 38 18 50 5 62 18 76 10 72 28Q50 38 28 28Z" />
                </clipPath>
            </defs>
            {type === "laurier" && (
                <g className="deco-wreath" fill={`url(#${gradient})`} stroke="#496d3c" strokeWidth=".65">
                    {[false, true].map((mirror) => (
                        <g key={String(mirror)} transform={mirror ? "translate(100 0) scale(-1 1)" : undefined}>
                            <g className={`deco-leaf-branch deco-motion${mirror ? " is-right" : ""}`}>
                                <path
                                    d="M47 89C26 84 11 65 16 43 19 30 25 20 33 15"
                                    fill="none"
                                    stroke="#9db86c"
                                    strokeWidth="1.2"
                                />
                                {LEAVES.map(([x, y, angle], index) => (
                                    <g key={index} transform={`translate(${x} ${y}) rotate(${angle})`}>
                                        <path d="M0 1C-9 0-13-6-11-12-3-12 3-6 0 1Z" />
                                        <path d="M-9-10-1-1" stroke="#d4eaa1" strokeWidth=".65" />
                                        <path d="M1 2C8-2 11-7 8-12 1-10-1-5 1 2Z" opacity=".85" />
                                    </g>
                                ))}
                            </g>
                        </g>
                    ))}
                    <path d="m44 87 6 3 6-3M50 90v4" fill="none" stroke="#c3d88e" strokeWidth="1.6" />
                </g>
            )}
            {type === "couronne" && (
                <g className="deco-crown deco-motion">
                    <path
                        d="M28 28 24 10 38 18 50 5 62 18 76 10 72 28Q50 38 28 28Z"
                        fill={`url(#${gradient})`}
                        stroke="#9f722e"
                        strokeWidth="1"
                        strokeLinejoin="round"
                    />
                    <path d="m29 24 2 7Q50 37 69 31l2-7Q50 31 29 24Z" fill="#b98636" />
                    <path d="M30 25Q50 32 70 25M32 30Q50 36 68 30" stroke="#ffe4a0" strokeWidth=".8" />
                    <path d="m50 15 3 5-3 4-3-4Z" fill="#286c6b" stroke="#f7d68e" strokeWidth=".7" />
                    <circle cx="24" cy="9.5" r="2.1" fill="#f5d480" />
                    <circle cx="50" cy="4.7" r="2.2" fill="#fff0b2" />
                    <circle cx="76" cy="9.5" r="2.1" fill="#f5d480" />
                    <g clipPath={`url(#${crown})`}>
                        <path
                            className="deco-crown-shine deco-motion"
                            d="m-20-8 18-7 29 61-18 7Z"
                            fill={`url(#${shine})`}
                        />
                    </g>
                    <path
                        d="M17 45A35 35 0 0 0 38 82M83 45A35 35 0 0 1 62 82"
                        stroke="#c4a15d"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        opacity=".8"
                    />
                </g>
            )}
            {type === "flammes" && (
                <g mask={`url(#${mask})`}>
                    <g className="deco-fire-left deco-motion">
                        <path
                            d="M22 83C6 74 10 64 12 56 15 45 10 41 9 36 21 42 25 47 21 29 36 43 33 56 29 65 35 63 36 57 35 53 47 71 39 85 22 83Z"
                            fill={`url(#${gradient})`}
                        />
                        <path
                            d="M22 78C17 67 24 64 21 51 30 58 32 68 28 73 33 73 35 69 36 66 37 76 30 82 22 78Z"
                            fill="#ffe6ab"
                        />
                    </g>
                    <g className="deco-fire-right deco-motion">
                        <path
                            d="M77 81C95 72 87 61 91 50 82 53 80 60 80 65 69 57 73 48 77 40 61 50 61 67 68 73 61 74 56 71 55 66 50 80 63 90 77 81Z"
                            fill={`url(#${gradient})`}
                        />
                        <path d="M78 77C83 71 79 65 83 61 73 64 74 75 68 75 73 80 76 79 78 77Z" fill="#ffdc88" />
                    </g>
                    <path
                        className="deco-fire-base deco-motion"
                        d="M30 87C35 79 38 76 37 69 46 77 41 82 49 84 57 77 57 74 54 69 71 81 62 94 49 93 42 93 34 93 30 87Z"
                        fill={`url(#${gradient})`}
                    />
                    {[
                        [13, 41, 0],
                        [84, 42, 1.4],
                        [29, 20, 2.6],
                        [70, 25, 3.7],
                    ].map(([x, y, delay], index) => (
                        <circle
                            key={index}
                            className="deco-ember deco-motion"
                            cx={x}
                            cy={y}
                            r={index % 2 ? 1.1 : 1.6}
                            fill="#ffc96f"
                            style={{ "--ember-delay": `${-delay}s` }}
                        />
                    ))}
                </g>
            )}
            {type === "vagues" && (
                <g mask={`url(#${mask})`} strokeLinecap="round" strokeLinejoin="round">
                    <path
                        d="M14 47C5 69 27 93 48 90 61 88 61 77 54 77 49 77 47 82 50 83 41 90 21 80 20 69 17 63 19 60 22 61M85 54C95 32 73 8 52 11 39 13 39 24 46 24 51 24 53 19 50 18 59 11 79 21 80 32 83 38 81 41 78 40"
                        stroke={`url(#${gradient})`}
                        strokeWidth="3.3"
                    />
                    <path
                        className="deco-current deco-motion"
                        pathLength="100"
                        d="M11 50C9 77 31 97 53 92 66 89 73 81 83 78M89 50C92 24 68 4 47 9 33 12 28 19 16 23"
                        stroke="#97e8ed"
                        strokeWidth="1.3"
                        strokeDasharray="18 32"
                    />
                    <path
                        className="deco-foam deco-motion"
                        d="M16 63C18 74 26 81 36 84M64 15C74 19 80 27 82 35"
                        stroke="#e4fcff"
                        strokeWidth="1.3"
                    />
                    <path d="M24 25c-9 6-13 11-14 19M76 76c9-6 13-11 14-19" stroke="#4198c3" strokeWidth="1" />
                </g>
            )}
            {type === "etoiles" && (
                <g>
                    <path
                        d="m19 25 6-13 15-3m25 2 8 2 13 13 5 22-6 18-10 16-20 8-19 1-12-7-12-14"
                        stroke="#ab95d0"
                        strokeWidth=".65"
                        strokeDasharray="1 3.5"
                        opacity=".65"
                    />
                    <g fill={`url(#${gradient})`} stroke="#e9dfff" strokeWidth=".45">
                        {STARS.map(([x, y, radius], index) => (
                            <Star key={index} x={x} y={y} radius={radius} index={index} />
                        ))}
                    </g>
                    <g fill="#d5c6ed">
                        <circle cx="39" cy="9" r="1.2" />
                        <circle cx="87" cy="28" r="1" />
                        <circle cx="54" cy="91" r="1.2" />
                        <circle cx="11" cy="63" r=".9" />
                    </g>
                    <path
                        className="deco-star-trail deco-motion"
                        d="m13 42 4-4"
                        stroke="#eadcff"
                        strokeWidth="1"
                        strokeLinecap="round"
                    />
                </g>
            )}
            {type === "circuit" && (
                <g strokeLinecap="round" strokeLinejoin="round">
                    <g stroke="#258d7d" strokeWidth="1.25">
                        {TRACES.map((path, index) => (
                            <path key={index} d={path} />
                        ))}
                        <path
                            d="M17 47V35l9-9h9M65 19h9l9 9v10M85 56v13l-8 8H65M42 83H29L18 72v-7"
                            opacity=".6"
                            strokeWidth=".7"
                        />
                    </g>
                    <g stroke={`url(#${gradient})`} strokeWidth="2">
                        {TRACES.map((path, index) => (
                            <path
                                key={index}
                                className="deco-packet deco-motion"
                                d={path}
                                pathLength="100"
                                strokeDasharray="9 110"
                                style={{ "--packet-delay": `${index * -1.5}s` }}
                            />
                        ))}
                    </g>
                    <g fill="#122e2c" stroke="#73dfbd" strokeWidth="1">
                        {[
                            [11, 45],
                            [32, 20],
                            [67, 13],
                            [89, 35],
                            [91, 59],
                            [67, 83],
                            [40, 89],
                            [12, 66],
                        ].map(([x, y], index) => (
                            <circle key={index} cx={x} cy={y} r="1.9" />
                        ))}
                    </g>
                    <path d="m83 12 3-3 3 3-3 3Zm-72 77 3-3 3 3-3 3Z" fill="#68d4b5" />
                </g>
            )}
        </svg>
    );
}
