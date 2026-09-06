const fold = (value) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase("fr");

function subsequence(haystack, needle) {
    let index = 0;
    for (const character of haystack) {
        if (character === needle[index]) index += 1;
        if (index === needle.length) return true;
    }
    return needle.length === 0;
}

export function score(label, query) {
    const needle = fold(query).trim();
    if (!needle) return 0;

    const haystack = fold(label);
    if (haystack.startsWith(needle)) return 1000 - haystack.length;
    if (haystack.split(/[\s\-_#/]+/).some((word) => word.startsWith(needle))) return 800 - haystack.length;
    if (haystack.includes(needle)) return 600 - haystack.length;
    if (subsequence(haystack, needle)) return 400 - haystack.length;
    return null;
}

export function rank(items, query) {
    return items
        .map((item) => ({ item, value: score(item.label, query) }))
        .filter((entry) => entry.value !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry) => entry.item);
}
