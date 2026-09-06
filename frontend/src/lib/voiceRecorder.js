export const MAX_SECONDS = 300;

export function supportedMime() {
    if (typeof MediaRecorder === "undefined") return null;
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null;
}

export const isSupported = () =>
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(supportedMime());

export async function start({ onLevel, onTick, onAutoStop } = {}) {
    const mime = supportedMime();
    if (!mime) throw new Error("Ce navigateur ne sait pas enregistrer de son.");

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    recorder.start(250);

    const startedAt = Date.now();
    let cancelled = false;

    const context = new (window.AudioContext ?? window.webkitAudioContext)();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);

    const timer = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const level = Math.sqrt(samples.reduce((sum, v) => sum + (v - 128) ** 2, 0) / samples.length) / 128;
        onLevel?.(Math.min(1, level * 3));

        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        onTick?.(seconds);
        if (seconds >= MAX_SECONDS) {
            onAutoStop?.();
            stop();
        }
    }, 100);

    const release = () => {
        clearInterval(timer);
        context.close().catch(() => {});
        for (const track of stream.getTracks()) track.stop();
    };

    function stop() {
        return new Promise((resolve) => {
            if (recorder.state === "inactive") return resolve(null);
            recorder.onstop = () => {
                release();
                if (cancelled || chunks.length === 0) return resolve(null);
                const blob = new Blob(chunks, { type: mime });
                resolve({ blob, seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) });
            };
            recorder.stop();
            return undefined;
        });
    }

    return {
        stop,
        cancel() {
            cancelled = true;
            chunks.length = 0;
            return stop();
        },
    };
}
