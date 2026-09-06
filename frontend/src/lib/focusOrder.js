export const SCREEN = 0;
export const SPEAKING = 1;
export const HAND = 2;
export const OTHER = 3;

export function rankOf(tile, hands = {}) {
    if (tile.isScreenShare) return SCREEN;
    if (tile.isSpeaking) return SPEAKING;
    if (tile.identity in hands) return HAND;
    return OTHER;
}

export function focusOrder(tiles, hands = {}) {
    return tiles
        .map((tile, index) => ({ tile, index, rank: rankOf(tile, hands) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((entry) => entry.tile);
}
