export function moved(list, from, to) {
    if (from < 0 || from >= list.length) return list;
    if (to < 0 || to >= list.length || from === to) return list;

    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}
