export function showsTabBar({ channel = null, call = null } = {}) {
    return !channel && !call;
}

export function activeTab({ notificationsOpen, settingsOpen, atHome, channel }) {
    if (notificationsOpen) return "alerts";
    if (settingsOpen) return "profile";
    if (!atHome) return "communities";
    return channel ? "messages" : "home";
}
