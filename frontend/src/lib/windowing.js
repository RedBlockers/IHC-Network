export const WINDOW_SIZE = 60;
export const WINDOW_STEP = 40;

export function windowOf(items, size = WINDOW_SIZE) {
    if (!Array.isArray(items)) return [];
    if (items.length <= size) return items;
    return items.slice(items.length - size);
}

export const hiddenBefore = (items, size = WINDOW_SIZE) =>
    Math.max(0, (Array.isArray(items) ? items.length : 0) - size);

export const grow = (size, total, step = WINDOW_STEP) => Math.min(size + step, Math.max(total, 0));
