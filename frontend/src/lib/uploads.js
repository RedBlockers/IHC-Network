import { ApiError, tokenStore } from "./api.js";

const BASE = import.meta.env?.VITE_API_URL || "/api/v1";

export function uploadAttachment(channelId, file, { relativePath = "", onProgress, signal } = {}) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const body = new FormData();
        body.append("file", file);
        if (relativePath) body.append("path", relativePath);

        request.open("POST", `${BASE}/channels/${channelId}/attachments`);
        request.withCredentials = true;
        const token = tokenStore.get();
        if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);

        request.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) onProgress?.(event.loaded / event.total);
        });

        request.addEventListener("load", () => {
            let payload;
            try {
                payload = JSON.parse(request.responseText);
            } catch {
                payload = null;
            }
            if (request.status >= 200 && request.status < 300 && payload?.attachment) {
                resolve(payload.attachment);
                return;
            }
            const error = payload?.error ?? {};
            const fallback =
                request.status === 413
                    ? {
                          code: "payload_too_large",
                          message: "Ce fichier dépasse la taille maximale autorisée par l’instance.",
                      }
                    : request.status === 507
                      ? {
                            code: "insufficient_storage",
                            message: "Le stockage disponible ne permet pas de recevoir ce fichier.",
                        }
                      : { message: "Envoi refusé." };
            reject(
                new ApiError({
                    status: request.status,
                    code: error.code ?? fallback.code,
                    message: error.message ?? fallback.message,
                    details: error.details,
                    requestId: error.requestId,
                })
            );
        });

        request.addEventListener("error", () => reject(new Error("Envoi interrompu.")));
        request.addEventListener("abort", () => reject(new Error("Envoi annulé.")));
        signal?.addEventListener("abort", () => request.abort());

        request.send(body);
    });
}

export const relativeFolderPath = (file) => {
    const full = file.webkitRelativePath || "";
    return full.includes("/") ? full.slice(0, full.lastIndexOf("/")) : "";
};
