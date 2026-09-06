const isMobileLike = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    return (coarse && narrow) || weak;
};

const DESKTOP_CAMERA = Object.freeze({ width: 1280, height: 720, frameRate: 30 });
const MOBILE_CAMERA = Object.freeze({ width: 960, height: 540, frameRate: 30 });

export function cameraCapture() {
    return isMobileLike() ? MOBILE_CAMERA : DESKTOP_CAMERA;
}

export function cameraEncoding() {
    return isMobileLike()
        ? { maxBitrate: 1_200_000, maxFramerate: 30, priority: "high" }
        : { maxBitrate: 2_500_000, maxFramerate: 30, priority: "high" };
}

export const CAMERA_DEGRADATION = "maintain-framerate";
export const SCREEN_DEGRADATION = "maintain-resolution";

export const SCREEN_CAPTURE = Object.freeze({ width: 2560, height: 1440, frameRate: 30 });
export const SCREEN_ENCODING = Object.freeze({ maxBitrate: 6_000_000, maxFramerate: 30, priority: "high" });

export const VOICE_ENCODING = Object.freeze({ maxBitrate: 96_000, priority: "high" });
export const SCREEN_AUDIO_ENCODING = Object.freeze({ maxBitrate: 128_000, priority: "high" });

export const CAMERA_CAPTURE = DESKTOP_CAMERA;
export const CAMERA_ENCODING = Object.freeze({ maxBitrate: 2_500_000, maxFramerate: 30, priority: "high" });

export function preferredCodec({ supportsAV1, supportsVP9 }, { screenShare = false } = {}) {
    if (screenShare && supportsAV1 && !isMobileLike()) return "av1";
    if (supportsVP9) return "vp9";
    return "vp8";
}

export const CAMERA_SCALABILITY = "L1T3";
export const SCREEN_SCALABILITY = "L1T2";

export function trackResolution(publication) {
    const settings = publication?.track?.mediaStreamTrack?.getSettings?.();
    if (!settings?.width || !settings?.height) return null;
    return `${settings.width} × ${settings.height}`;
}

export function trackOrientation(publication) {
    const settings = publication?.track?.mediaStreamTrack?.getSettings?.();
    if (!settings?.width || !settings?.height) return "landscape";
    if (settings.height > settings.width * 1.1) return "portrait";
    if (Math.abs(settings.height - settings.width) <= settings.width * 0.1) return "square";
    return "landscape";
}

export const MOBILE_LIKE = isMobileLike;

export const AUDIO_PROCESSING = Object.freeze({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
});

export function audioConstraints(processing = AUDIO_PROCESSING) {
    return {
        channelCount: 1,
        autoGainControl: processing.autoGainControl !== false,
        echoCancellation: processing.echoCancellation !== false,
        noiseSuppression: processing.noiseSuppression !== false,
        voiceIsolation: processing.noiseSuppression !== false,
    };
}

export function appliedAudioProcessing(track) {
    const settings = track?.mediaStreamTrack?.getSettings?.() ?? track?.getSettings?.();
    if (!settings) return null;

    const read = (key) => (typeof settings[key] === "boolean" ? settings[key] : null);
    return {
        noiseSuppression: read("noiseSuppression"),
        echoCancellation: read("echoCancellation"),
        autoGainControl: read("autoGainControl"),
    };
}

export const SAVER_CAMERA = Object.freeze({ width: 320, height: 180, frameRate: 15 });
export const SAVER_ENCODING = Object.freeze({ maxBitrate: 150_000, maxFramerate: 15, priority: "medium" });

export function cameraCaptureFor({ dataSaver = false } = {}) {
    return dataSaver ? SAVER_CAMERA : cameraCapture();
}

export function cameraEncodingFor({ dataSaver = false } = {}) {
    return dataSaver ? SAVER_ENCODING : cameraEncoding();
}

export const SCREEN_CAPTURE_UHD = Object.freeze({ width: 3840, height: 2160, frameRate: 30 });
export const SCREEN_ENCODING_UHD = Object.freeze({ maxBitrate: 12_000_000, maxFramerate: 30, priority: "high" });

export function deservesUhd(track) {
    const settings = track?.mediaStreamTrack?.getSettings?.() ?? track?.getSettings?.();
    return Number(settings?.width ?? 0) > 2560;
}

export function screenCaptureFor({ uhd = false } = {}) {
    return uhd ? SCREEN_CAPTURE_UHD : SCREEN_CAPTURE;
}

export function screenEncodingFor({ uhd = false } = {}) {
    return uhd ? SCREEN_ENCODING_UHD : SCREEN_ENCODING;
}

export async function connectionReport(room) {
    const publisher = room?.engine?.pcManager?.publisher;
    const raw = publisher?._pc ?? publisher?.pc;
    if (!raw?.getStats) return null;

    const report = { sending: null, resolution: null, framerate: null, limitedBy: null, roundTrip: null, lost: null };

    const stats = [...(await raw.getStats()).values()];
    const selectedPair = stats.find(
        (stat) => stat.type === "transport" && stat.selectedCandidatePairId
    )?.selectedCandidatePairId;
    for (const stat of stats) {
        if (stat.type === "outbound-rtp" && stat.kind === "video") {
            report.resolution = stat.frameWidth ? `${stat.frameWidth}×${stat.frameHeight}` : report.resolution;
            report.framerate = stat.framesPerSecond ?? report.framerate;
            report.limitedBy = stat.qualityLimitationReason ?? report.limitedBy;
        }
        if (
            stat.type === "candidate-pair" &&
            stat.state === "succeeded" &&
            (selectedPair ? stat.id === selectedPair : stat.nominated)
        ) {
            report.roundTrip = stat.currentRoundTripTime != null ? Math.round(stat.currentRoundTripTime * 1000) : null;
            report.sending = stat.availableOutgoingBitrate ?? null;
        }
        if (stat.type === "remote-inbound-rtp" && stat.kind === "video") {
            report.lost = stat.fractionLost != null ? Math.round(stat.fractionLost * 100) : null;
        }
    }

    return report;
}
