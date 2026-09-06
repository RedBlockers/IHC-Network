import { api } from "./api.js";

export const isSupported = () =>
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window;

export const permission = () =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission;

function toBytes(base64url) {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function deviceLabel() {
    const agent = navigator.userAgent;
    const browser = /Firefox/.test(agent)
        ? "Firefox"
        : /Edg\//.test(agent)
          ? "Edge"
          : /Chrome/.test(agent)
            ? "Chrome"
            : /Safari/.test(agent)
              ? "Safari"
              : "Navigateur";
    const system = /Android/.test(agent)
        ? "Android"
        : /iPhone|iPad/.test(agent)
          ? "iOS"
          : /Mac/.test(agent)
            ? "macOS"
            : /Windows/.test(agent)
              ? "Windows"
              : "Linux";
    return `${browser} sur ${system}`;
}

const register = () => navigator.serviceWorker.register("/push-worker.js");

export async function subscribe() {
    if (!isSupported()) throw new Error("Ce navigateur ne prend pas en charge les notifications poussées.");

    const decision = await Notification.requestPermission();
    if (decision !== "granted") return false;

    const registration = await register();
    const { publicKey } = await api("/notifications/push/key");

    const existing = await registration.pushManager.getSubscription();
    const subscription =
        existing ??
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toBytes(publicKey),
        }));

    await api("/notifications/push", {
        method: "POST",
        body: { subscription: subscription.toJSON(), deviceLabel: deviceLabel() },
    });
    return true;
}

export async function unsubscribe() {
    if (!isSupported()) return false;

    const registration = await navigator.serviceWorker.getRegistration("/push-worker.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    await api("/notifications/push", { method: "DELETE", body: { endpoint } }).catch(() => {});
    return true;
}

export async function isSubscribed() {
    if (!isSupported() || permission() !== "granted") return false;
    const registration = await navigator.serviceWorker.getRegistration("/push-worker.js");
    return Boolean(await registration?.pushManager.getSubscription());
}
