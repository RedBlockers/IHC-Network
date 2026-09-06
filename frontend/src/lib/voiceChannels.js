const VOICE_TYPES = new Set(["voice", "stage", "video"]);

export const isVoiceChannel = (type) => VOICE_TYPES.has(type);

export const expectsCamera = (type) => type === "video";
