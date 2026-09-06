import { useEffect } from "react";

export default function useViewportInset() {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return undefined;

        const apply = () => {
            const hidden = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(hidden)}px`);
        };

        apply();
        viewport.addEventListener("resize", apply);
        viewport.addEventListener("scroll", apply);
        return () => {
            viewport.removeEventListener("resize", apply);
            viewport.removeEventListener("scroll", apply);
            document.documentElement.style.removeProperty("--keyboard-inset");
        };
    }, []);
}
