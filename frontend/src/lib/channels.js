export const UNCATEGORIZED_LABEL = "AUTRES SALONS";

const byPosition = (a, b) => a.position - b.position || a.channelId - b.channelId;

export function groupChannelsByCategory(categories = [], channels = []) {
    const groups = [...categories]
        .sort((a, b) => a.position - b.position || a.categoryId - b.categoryId)
        .map((category) => ({
            categoryId: category.categoryId,
            name: category.name,
            position: category.position,
            channels: channels.filter((channel) => channel.categoryId === category.categoryId).sort(byPosition),
        }));

    const orphans = channels.filter((channel) => !channel.categoryId).sort(byPosition);
    if (orphans.length > 0) {
        groups.push({
            categoryId: null,
            name: UNCATEGORIZED_LABEL,
            position: Number.MAX_SAFE_INTEGER,
            channels: orphans,
        });
    }

    return groups;
}
