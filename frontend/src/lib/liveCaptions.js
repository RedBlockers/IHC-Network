export const CAPTION_METHOD = "browser-speech-recognition";

export function speechEngine(globalObject = globalThis) {
    return globalObject.SpeechRecognition || globalObject.webkitSpeechRecognition || null;
}

export function startLiveCaptions({ lang = "fr-FR", onText, onError } = {}, globalObject = globalThis) {
    const Speech = speechEngine(globalObject);
    if (!Speech) {
        return { supported: false, method: CAPTION_METHOD, stop() {} };
    }

    const recognition = new Speech();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
        const last = event.results?.[event.results.length - 1];
        const text = last?.[0]?.transcript ?? "";
        onText?.({ text, final: Boolean(last?.isFinal) });
    };
    recognition.onerror = (event) => {
        onError?.(event?.error || "recognition-error");
    };
    recognition.start();

    return {
        supported: true,
        method: CAPTION_METHOD,
        stop() {
            try {
                recognition.stop();
            } catch {}
        },
    };
}
