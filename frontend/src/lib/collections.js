export function appendUniqueBy(items, candidate, key) {
    return items.some((item) => item[key] === candidate[key]) ? items : [...items, candidate];
}
