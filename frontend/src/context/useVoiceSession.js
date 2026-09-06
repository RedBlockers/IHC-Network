import { useContext } from "react";

import { VoiceSessionContext } from "./voice-session-context.js";

export function useVoiceSession() {
    const context = useContext(VoiceSessionContext);
    if (!context) throw new Error("useVoiceSession doit être utilisé dans un VoiceSessionProvider.");
    return context;
}
