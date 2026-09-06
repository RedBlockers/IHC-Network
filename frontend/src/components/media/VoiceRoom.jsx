import { useEffect, useRef, useState } from "react";
import { RoomEvent, Track } from "livekit-client";

import { useVoiceSession } from "../../context/useVoiceSession.js";
import Icon from "../ui/Icon.jsx";
import { trackOrientation } from "../../lib/mediaQuality.js";
import { focusOrder } from "../../lib/focusOrder.js";
import AudioSettings from "./AudioSettings.jsx";
import { api } from "../../lib/api.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import { CAPTION_METHOD, startLiveCaptions } from "../../lib/liveCaptions.js";
import { collectRoomAudioTracks, downloadBlob, mixTracks, startLocalRecording } from "../../lib/callRecorder.js";
import { VOICE_TOPICS, decodePayload, encodePayload, isSafeSoundUrl } from "../../lib/voiceData.js";

const LIMIT_REASONS = {
    bandwidth: "définition réduite : débit insuffisant",
    cpu: "définition réduite : machine chargée",
    other: "définition réduite",
};

function signalLabel(report) {
    if (!report) return "Connexion";
    if (report.lost != null && report.lost >= 5) return `Pertes ${report.lost} %`;
    if (report.roundTrip != null && report.roundTrip > 250) return `Latence ${report.roundTrip} ms`;
    if (report.limitedBy && report.limitedBy !== "none") return "Qualité adaptée";
    return "Signal stable";
}

function participantInfo(participant) {
    try {
        return JSON.parse(participant.metadata || "{}");
    } catch {
        return {};
    }
}

function MediaElement({ track, video, mirror = false }) {
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element || !track) return undefined;
        track.attach(element);
        if (video && "playoutDelayHint" in element) element.playoutDelayHint = 0;
        return () => track.detach(element);
    }, [track, video]);

    if (video) return <video ref={ref} autoPlay playsInline muted={track.isLocal} className={mirror ? "mirror" : ""} />;
    return <audio ref={ref} autoPlay />;
}

function ParticipantTiles({ participants, hands = {}, focusMode = false }) {
    const tiles = participants.flatMap((participant) => {
        const info = participantInfo(participant);
        const videos = [...participant.trackPublications.values()].filter(
            (publication) => publication.kind === Track.Kind.Video && publication.track && !publication.isMuted
        );
        if (videos.length === 0) return [{ participant, info, publication: null }];
        return videos.map((publication) => ({ participant, info, publication }));
    });

    const ordered = focusMode
        ? focusOrder(
              tiles.map((tile) => ({
                  ...tile,
                  identity: tile.participant.identity,
                  isSpeaking: tile.participant.isSpeaking,
                  isScreenShare: tile.publication?.source === Track.Source.ScreenShare,
              })),
              hands
          )
        : tiles;

    return (
        <div className={`voice-grid voice-grid-${Math.min(tiles.length, 6)}${focusMode ? " is-focus" : ""}`}>
            {ordered.map(({ participant, info, publication }, index) => {
                const isScreen = publication?.source === Track.Source.ScreenShare;
                const name = participant.name || info.displayName || info.handle || participant.identity;
                const orientation = publication ? trackOrientation(publication) : "landscape";
                return (
                    <article
                        data-orientation={orientation}
                        className={`voice-tile${participant.isSpeaking ? " is-speaking" : ""}${isScreen ? " is-screen" : ""}`}
                        key={`${participant.identity}:${publication?.trackSid || index}`}
                    >
                        {publication?.track ? (
                            <MediaElement
                                track={publication.track}
                                video
                                mirror={publication.source === Track.Source.Camera && publication.track.isLocal}
                            />
                        ) : (
                            <div className="voice-avatar">{name.charAt(0).toUpperCase()}</div>
                        )}
                        <span className="voice-name">
                            <i aria-hidden="true" /> {name}
                            {isScreen ? " · écran" : ""}
                        </span>
                        {participant.identity in hands && !isScreen && (
                            <span className="voice-hand" title={`${name} lève la main`}>
                                <Icon name="chevron-up" size={15} />
                                <span className="sr-only">{name} lève la main</span>
                            </span>
                        )}
                    </article>
                );
            })}
        </div>
    );
}

export default function VoiceRoom({ channel, communityName, onToggleMembers }) {
    const context = useChannelResource(channel.channelId, "context", "channel:permissions");
    const [stageBusy, setStageBusy] = useState(null);
    const [stageError, setStageError] = useState(null);
    const [focusMode, setFocusMode] = useState(false);
    const [captions, setCaptions] = useState([]);
    const [captioning, setCaptioning] = useState(false);
    const [recording, setRecording] = useState(false);
    const [consentOpen, setConsentOpen] = useState(null);
    const [sounds, setSounds] = useState([]);
    const [transcriptError, setTranscriptError] = useState(null);
    const recognitionRef = useRef(null);
    const recorderRef = useRef(null);
    const mixContextRef = useRef(null);

    const {
        channel: activeVoiceChannel,
        phase,
        connected,
        connecting,
        error,
        captureQuality,
        codec,
        room,
        report,
        publish,
        isAudience,
        hands,
        handRaised,
        toggleHand,
        processing,
        appliedProcessing,
        setAudioProcessing,
        dataSaver,
        setDataSaver,
        revision,
        participants,
        micEnabled,
        cameraEnabled,
        screenEnabled,
        join,
        leave,
        toggleMicrophone,
        toggleCamera,
        toggleScreen,
    } = useVoiceSession();

    async function setSpeaker(participant, speaking) {
        const userId = participantInfo(participant).userId;
        if (!userId || stageBusy) return;
        setStageBusy(userId);
        setStageError(null);
        try {
            await api(`/channels/${channel.channelId}/speakers/${userId}`, { method: "PATCH", body: { speaking } });
        } catch (failure) {
            setStageError(failure.message || "La parole n’a pas pu être mise à jour.");
        } finally {
            setStageBusy(null);
        }
    }

    useEffect(() => {
        if (!channel.guildId) return undefined;
        api(`/guilds/${channel.guildId}/emojis?kind=sound`)
            .then((result) => setSounds(result.emojis ?? result.media ?? []))
            .catch(() => setSounds([]));
        return undefined;
    }, [channel.guildId]);

    useEffect(
        () => () => {
            recognitionRef.current?.stop();
            recorderRef.current?.stop();
            mixContextRef.current?.close?.();
        },
        []
    );

    useEffect(() => {
        if (!room) return undefined;
        const onData = (payload, participant, _kind, topic) => {
            const data = decodePayload(payload);
            if (!data) return;
            if (topic === VOICE_TOPICS.captions && typeof data.text === "string") {
                const identity = participant?.identity || "distant";
                const name = participant?.name || identity;
                setCaptions((current) => {
                    const next = current.filter((line) => line.id !== identity || line.final);
                    next.push({
                        id: identity,
                        name,
                        text: data.text.slice(0, 400),
                        final: Boolean(data.final),
                        method: CAPTION_METHOD,
                    });
                    return next.slice(-8);
                });
            }
            if (topic === VOICE_TOPICS.soundboard && isSafeSoundUrl(data.url)) {
                const audio = new Audio(data.url);
                audio.play().catch(() => {});
            }
        };
        room.on(RoomEvent.DataReceived, onData);
        return () => room.off(RoomEvent.DataReceived, onData);
    }, [room]);

    function toggleCaptions() {
        if (captioning) {
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            setCaptioning(false);
            return;
        }
        const handle = startLiveCaptions({
            onText: ({ text, final }) => {
                setCaptions((current) => {
                    const next = current.filter((line) => line.id !== "local" || line.final);
                    next.push({ id: "local", name: "Vous", text, final, method: CAPTION_METHOD });
                    return next.slice(-8);
                });
                room?.localParticipant
                    ?.publishData(encodePayload({ text, final }), { reliable: false, topic: VOICE_TOPICS.captions })
                    .catch(() => {});
            },
            onError: () => setCaptioning(false),
        });
        if (!handle.supported) {
            setCaptions([
                {
                    id: "local",
                    name: "Système",
                    text: "Les sous-titres ne sont pas disponibles dans ce navigateur. Rien n’est inventé à la place.",
                    final: true,
                    method: CAPTION_METHOD,
                },
            ]);
            return;
        }
        recognitionRef.current = handle;
        setCaptioning(true);
    }

    async function saveTranscript() {
        const text = captions
            .map((line) => line.text)
            .join(" ")
            .trim();
        if (!text) return;
        setConsentOpen("transcript");
    }

    async function confirmTranscript() {
        const text = captions
            .map((line) => line.text)
            .join(" ")
            .trim();
        setTranscriptError(null);
        try {
            await api(`/channels/${channel.channelId}/transcripts`, {
                method: "POST",
                body: { text, consented: true },
            });
            setConsentOpen(null);
        } catch {
            setTranscriptError("La transcription n’a pas été enregistrée.");
        }
    }

    function toggleRecording() {
        if (recording) {
            recorderRef.current?.stop();
            recorderRef.current = null;
            mixContextRef.current?.close?.();
            mixContextRef.current = null;
            setRecording(false);
            return;
        }
        setConsentOpen("record");
    }

    async function confirmRecording() {
        const tracks = collectRoomAudioTracks(room);
        if (tracks.length === 0) {
            setTranscriptError("Aucune piste audio à enregistrer dans cet appel.");
            setConsentOpen(null);
            return;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            setTranscriptError("Ce navigateur ne peut pas mélanger l’appel localement.");
            setConsentOpen(null);
            return;
        }
        const context = new AudioCtx();
        const mixed = mixTracks(tracks, context);
        if (!mixed) {
            await context.close();
            setTranscriptError("Le mélange local n’a pas pu démarrer.");
            setConsentOpen(null);
            return;
        }
        mixContextRef.current = context;
        const recorder = startLocalRecording(mixed, {
            onStop: (blob) => {
                downloadBlob(blob, `qweillo-${channel.channelId}.webm`);
                context.close().catch(() => {});
                mixContextRef.current = null;
            },
        });
        if (!recorder) {
            await context.close();
            setTranscriptError("MediaRecorder est indisponible.");
            setConsentOpen(null);
            return;
        }
        recorderRef.current = recorder;
        setRecording(true);
        setConsentOpen(null);
    }

    function playSound(entry) {
        if (!isSafeSoundUrl(entry.url)) return;
        const audio = new Audio(entry.url);
        audio.play().catch(() => {});
        room?.localParticipant
            ?.publishData(encodePayload({ soundId: entry.emojiId, url: entry.url, name: entry.name }), {
                reliable: true,
                topic: VOICE_TOPICS.soundboard,
            })
            .catch(() => {});
    }

    const liveLines = captions.filter((line) => line.text);
    const captionText = liveLines.map((line) => line.text).join(" ");

    const isThisChannel = activeVoiceChannel?.channelId === channel.channelId;
    const live = connected && isThisChannel;
    const elsewhere = connected && !isThisChannel;

    return (
        <section className="voice-room" data-revision={revision}>
            <header className="voice-head">
                <div>
                    <span className="voice-kicker">{communityName}</span>
                    <h1>{channel.name}</h1>
                    {channel.description && <p>{channel.description}</p>}
                </div>
                {onToggleMembers && (
                    <button className="tool" onClick={onToggleMembers} aria-label="Afficher les membres">
                        <Icon name="users" />
                    </button>
                )}
            </header>

            {!live ? (
                <div className="voice-welcome">
                    <div className="signal-orbit" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                    <h2>
                        {channel.type === "stage"
                            ? "Prenez place dans le public"
                            : channel.type === "video"
                              ? "Retrouvez-vous en vidéo"
                              : "Entrez à votre rythme"}
                    </h2>
                    <p>
                        {channel.type === "stage"
                            ? "Le public écoute. L’équipe peut vous donner la parole pendant la scène."
                            : channel.type === "video"
                              ? "Votre caméra s’active en entrant. Vous pourrez la couper à tout moment."
                              : "Le micro et la caméra restent coupés tant que vous ne les activez pas."}
                    </p>
                    {elsewhere && (
                        <p className="voice-elsewhere" role="status">
                            Vous êtes déjà connecté à <strong>{activeVoiceChannel.name}</strong>. Rejoindre ce salon
                            vous y déplacera.
                        </p>
                    )}
                    {error && (
                        <p className="auth-error" role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        className="btn btn-accent"
                        onClick={() => join(channel, { communityName })}
                        disabled={connecting}
                    >
                        {connecting ? "Connexion…" : elsewhere ? "Déplacer ma connexion ici" : "Rejoindre le salon"}
                    </button>
                </div>
            ) : (
                <>
                    <ParticipantTiles participants={participants} hands={hands} focusMode={focusMode} />
                    {channel.type === "stage" &&
                        context.data?.permissions.includes("MUTE_MEMBERS") &&
                        participants.length > 1 && (
                            <section className="stage-speakers" aria-label="Gestion des intervenants">
                                <h3>Intervenants et public</h3>
                                {participants
                                    .filter((participant) => !participant.isLocal)
                                    .map((participant) => {
                                        const info = participantInfo(participant);
                                        const speaking = Boolean(participant.permissions?.canPublish);
                                        const name = participant.name || info.displayName || info.handle;
                                        return (
                                            <div key={participant.identity}>
                                                <span>
                                                    <strong>{name}</strong>
                                                    <small>
                                                        {speaking ? "Intervenant" : "Public"}
                                                        {participant.identity in hands ? " · main levée" : ""}
                                                    </small>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost"
                                                    disabled={Boolean(stageBusy)}
                                                    onClick={() => setSpeaker(participant, !speaking)}
                                                    aria-label={`${speaking ? "Retirer la parole à" : "Donner la parole à"} ${name}`}
                                                >
                                                    {speaking ? "Replacer dans le public" : "Donner la parole"}
                                                </button>
                                            </div>
                                        );
                                    })}
                            </section>
                        )}
                    {stageError && (
                        <p className="form-error" role="alert">
                            {stageError}
                        </p>
                    )}
                    {error && (
                        <p className="voice-error" role="alert">
                            {error}
                        </p>
                    )}
                    {isAudience && (
                        <p className="voice-audience" role="status">
                            Vous écoutez. Levez la main pour demander la parole ; un organisateur peut vous donner le
                            droit d’intervenir.
                        </p>
                    )}
                    <footer className="signal-ribbon">
                        <div className="signal-state">
                            <span className={`signal-led ${phase}`} />
                            <span>
                                <strong>{phase === "reconnecting" ? "Reconnexion" : signalLabel(report)}</strong>
                                {participants.length} participant{participants.length > 1 ? "s" : ""} ·{" "}
                                {(codec || "").toUpperCase()}
                                {captureQuality ? ` · ${captureQuality}` : " · définition adaptée à l’appareil"}
                                {report?.limitedBy && report.limitedBy !== "none" && (
                                    <em className="signal-reason">
                                        {" "}
                                        · {LIMIT_REASONS[report.limitedBy] ?? report.limitedBy}
                                    </em>
                                )}
                            </span>
                        </div>
                        <div className="media-controls">
                            <AudioSettings
                                processing={processing}
                                applied={appliedProcessing}
                                onChange={setAudioProcessing}
                                dataSaver={dataSaver}
                                onDataSaver={setDataSaver}
                            />
                            {publish.microphone && (
                                <button
                                    className={micEnabled ? "is-on" : ""}
                                    onClick={toggleMicrophone}
                                    aria-label="Activer ou couper le microphone"
                                >
                                    {micEnabled ? "Micro actif" : "Micro coupé"}
                                </button>
                            )}
                            {publish.camera && (
                                <button
                                    className={cameraEnabled ? "is-on" : ""}
                                    onClick={toggleCamera}
                                    aria-label="Activer ou couper la caméra"
                                >
                                    {cameraEnabled ? "Caméra active" : "Caméra"}
                                </button>
                            )}
                            {publish.screen && (
                                <button
                                    className={screenEnabled ? "is-on" : ""}
                                    onClick={toggleScreen}
                                    aria-label="Partager ou arrêter le partage d’écran"
                                >
                                    {screenEnabled ? "Écran partagé" : "Partager l’écran"}
                                </button>
                            )}
                            <button
                                className={handRaised ? "is-on" : ""}
                                onClick={toggleHand}
                                aria-pressed={handRaised}
                                aria-label={handRaised ? "Baisser la main" : "Lever la main"}
                            >
                                {handRaised ? "Main levée" : "Lever la main"}
                            </button>
                            <button
                                className={focusMode ? "is-on" : ""}
                                onClick={() => setFocusMode((current) => !current)}
                                aria-pressed={focusMode}
                                aria-label="Mode focus sur les locuteurs"
                            >
                                {focusMode ? "Focus actif" : "Focus"}
                            </button>
                            <button
                                className={captioning ? "is-on" : ""}
                                onClick={toggleCaptions}
                                aria-pressed={captioning}
                            >
                                Sous-titres
                            </button>
                            <button type="button" onClick={saveTranscript} disabled={!captionText.trim()}>
                                Consigner
                            </button>
                            <button
                                className={recording ? "is-on" : ""}
                                onClick={toggleRecording}
                                aria-pressed={recording}
                            >
                                {recording ? "Arrêter l’enregistrement" : "Enregistrer localement"}
                            </button>
                            {sounds.length > 0 && (
                                <div className="soundboard" role="group" aria-label="Soundboard">
                                    {sounds.map((sound) => (
                                        <button
                                            key={sound.emojiId ?? sound.name}
                                            type="button"
                                            onClick={() => playSound(sound)}
                                        >
                                            {sound.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button className="leave" onClick={leave}>
                                Quitter
                            </button>
                        </div>
                    </footer>
                    {liveLines.length > 0 && (
                        <div className="voice-captions" role="status">
                            <p className="voice-captions-method">
                                Reconnaissance vocale du navigateur — rien n’est envoyé à un modèle Qweillo.
                            </p>
                            {liveLines.map((line) => (
                                <p key={`${line.id}-${line.text.slice(0, 12)}`}>
                                    <strong>{line.name} · </strong>
                                    {line.text}
                                </p>
                            ))}
                        </div>
                    )}
                    {transcriptError && (
                        <p className="auth-error" role="alert">
                            {transcriptError}
                        </p>
                    )}
                    {consentOpen === "transcript" && (
                        <div className="voice-consent" role="dialog" aria-labelledby="transcript-consent">
                            <p id="transcript-consent">
                                Enregistrer cette transcription sur le serveur ? Elle ne part que si vous confirmez.
                            </p>
                            <button type="button" className="btn btn-accent" onClick={confirmTranscript}>
                                J’accepte d’enregistrer
                            </button>
                            <button type="button" className="btn" onClick={() => setConsentOpen(null)}>
                                Annuler
                            </button>
                        </div>
                    )}
                    {consentOpen === "record" && (
                        <div className="voice-consent" role="dialog" aria-labelledby="record-consent">
                            <p id="record-consent">
                                Enregistrer l’appel sur cet appareil seulement ? Le fichier n’est pas envoyé au serveur.
                            </p>
                            <button type="button" className="btn btn-accent" onClick={confirmRecording}>
                                Enregistrer ici
                            </button>
                            <button type="button" className="btn" onClick={() => setConsentOpen(null)}>
                                Annuler
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
