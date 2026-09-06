import { useRef } from "react";

import { useVoiceSession } from "../../context/useVoiceSession.js";
import Icon from "../ui/Icon.jsx";
import useDraggable from "../../hooks/useDraggable.js";
import Tooltip from "../ui/Tooltip.jsx";

export default function CallDock({ onReturn }) {
    const {
        channel,
        communityName,
        connected,
        phase,
        participants,
        publish,
        micEnabled,
        cameraEnabled,
        screenEnabled,
        toggleMicrophone,
        toggleCamera,
        toggleScreen,
        leave,
    } = useVoiceSession();

    const dockRef = useRef(null);
    const drag = useDraggable(dockRef, "qweillo.dock.position");

    if (!connected || !channel) return null;

    return (
        <aside
            ref={dockRef}
            className={`call-dock${drag.position ? " is-moved" : ""}`}
            role="region"
            aria-label="Appel en cours"
            style={drag.position ? { left: `${drag.position.x}px`, top: `${drag.position.y}px` } : undefined}
        >
            <Tooltip label="Déplacer · double-clic pour replacer" placement="bottom">
                <span
                    className="call-dock-grip"
                    tabIndex={0}
                    role="button"
                    aria-label="Déplacer le dock d’appel. Utilisez les flèches."
                    onDoubleClick={drag.reset}
                    {...drag.handleProps}
                >
                    <Icon name="chevron" size={12} />
                </span>
            </Tooltip>
            <Tooltip label="Revenir au salon vocal" placement="bottom">
                <button
                    type="button"
                    className="call-dock-id"
                    onClick={() => onReturn(channel)}
                    aria-label="Revenir au salon vocal"
                >
                    <span className={`signal-led ${phase}`} aria-hidden="true" />
                    <span className="call-dock-text">
                        <strong>{channel.name}</strong>
                        <small>
                            {communityName ? `${communityName} · ` : ""}
                            {participants.length} participant{participants.length > 1 ? "s" : ""}
                            {phase === "reconnecting" ? " · reconnexion…" : ""}
                        </small>
                    </span>
                </button>
            </Tooltip>

            <div className="call-dock-controls">
                {publish.microphone && (
                    <Tooltip label={micEnabled ? "Micro actif" : "Micro coupé"}>
                        <button
                            type="button"
                            className={micEnabled ? "is-on" : ""}
                            onClick={toggleMicrophone}
                            aria-pressed={micEnabled}
                            aria-label={micEnabled ? "Couper le microphone" : "Activer le microphone"}
                        >
                            <Icon name="volume" size={16} />
                        </button>
                    </Tooltip>
                )}
                {publish.camera && (
                    <Tooltip label={cameraEnabled ? "Caméra active" : "Caméra coupée"}>
                        <button
                            type="button"
                            className={cameraEnabled ? "is-on" : ""}
                            onClick={toggleCamera}
                            aria-pressed={cameraEnabled}
                            aria-label={cameraEnabled ? "Couper la caméra" : "Activer la caméra"}
                        >
                            <Icon name="users" size={16} />
                        </button>
                    </Tooltip>
                )}
                {publish.screen && (
                    <Tooltip label={screenEnabled ? "Écran partagé" : "Partager l’écran"}>
                        <button
                            type="button"
                            className={screenEnabled ? "is-on" : ""}
                            onClick={toggleScreen}
                            aria-pressed={screenEnabled}
                            aria-label={screenEnabled ? "Arrêter le partage d’écran" : "Partager l’écran"}
                        >
                            <Icon name="channels" size={16} />
                        </button>
                    </Tooltip>
                )}
                <Tooltip label="Quitter l’appel">
                    <button type="button" className="call-dock-leave" onClick={leave} aria-label="Quitter l’appel">
                        <Icon name="logout" size={16} />
                    </button>
                </Tooltip>
            </div>
        </aside>
    );
}
