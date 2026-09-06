const targets = new Map();
let observer;

function update(node) {
    node.dataset.animating = String(Boolean(targets.get(node)) && !document.hidden);
}

function visibilityChanged() {
    for (const node of targets.keys()) update(node);
}

export function observeDecoration(node) {
    if (!node) return () => {};
    if (!observer && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!targets.has(entry.target)) continue;
                    targets.set(entry.target, entry.isIntersecting);
                    update(entry.target);
                }
            },
            { rootMargin: "16px", threshold: 0.1 }
        );
    }
    if (!targets.size) document.addEventListener("visibilitychange", visibilityChanged);
    targets.set(node, !observer);
    update(node);
    observer?.observe(node);
    return () => {
        observer?.unobserve(node);
        targets.delete(node);
        if (!targets.size) {
            observer?.disconnect();
            observer = null;
            document.removeEventListener("visibilitychange", visibilityChanged);
        }
    };
}
