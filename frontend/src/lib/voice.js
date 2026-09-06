export function formatVoiceDuration(joinedAt, now = new Date()) {
    const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(joinedAt).getTime()) / 1000));
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
