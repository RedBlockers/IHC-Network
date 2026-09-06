import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "../lib/api";
import {
    CAMERA_DEGRADATION,
    CAMERA_SCALABILITY,
    SCREEN_AUDIO_ENCODING,
    SCREEN_CAPTURE,
    SCREEN_DEGRADATION,
    SCREEN_ENCODING,
    SCREEN_SCALABILITY,
    VOICE_ENCODING,
    AUDIO_PROCESSING,
    appliedAudioProcessing,
    audioConstraints,
    cameraCaptureFor,
    cameraEncodingFor,
    connectionReport,
    deservesUhd,
    screenCaptureFor,
    screenEncodingFor,
    preferredCodec,
    trackResolution,
} from "../lib/mediaQuality.js";
import { VoiceSessionContext } from "./voice-session-context.js";
import { announce } from "../lib/announce.js";
import { expectsCamera } from "../lib/voiceChannels.js";
import { getSocket } from "../lib/socket.js";

function RemoteAudioTrack({ track }) {
    const ref = useRef(null);
    useEffect(() => {
        const element = ref.current;
        if (!element || !track) return undefined;
        track.attach(element);
        return () => track.detach(element);
    }, [track]);
    return <audio ref={ref} autoPlay />;
}

function RemoteAudio({ participants }) {
    return (
        <div hidden>
            {participants
                .filter((participant) => !participant.isLocal)
                .flatMap((participant) =>
                    [...participant.audioTrackPublications.values()]
                        .filter((publication) => publication.track && !publication.isMuted)
                        .map((publication) => <RemoteAudioTrack key={publication.trackSid} track={publication.track} />)
                )}
        </div>
    );
}

export function VoiceSessionProvider({ children }) {
    const roomRef = useRef(null);
    const [room, setRoom] = useState(null);
    const [channel, setChannel] = useState(null);
    const [communityName, setCommunityName] = useState(null);
    const [phase, setPhase] = useState("idle");
    const [error, setError] = useState(null);
    const [captureQuality, setCaptureQuality] = useState(null);
    const [codec, setCodec] = useState(null);
    const [revision, setRevision] = useState(0);

    const [processing, setProcessing] = useState(AUDIO_PROCESSING);
    const processingRef = useRef(AUDIO_PROCESSING);
    const [dataSaver, setDataSaver] = useState(false);
    const dataSaverRef = useRef(false);
    const [appliedProcessing, setAppliedProcessing] = useState(null);
    const [report, setReport] = useState(null);

    const [publish, setPublish] = useState({ microphone: true, camera: true, screen: true });
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !channel) return undefined;
        const onPermissions = (update) => {
            if (Number(update.channelId) === Number(channel.channelId)) setPublish(update.publish);
        };
        socket.on("media:permissions", onPermissions);
        return () => socket.off("media:permissions", onPermissions);
    }, [channel]);

    const [hands, setHands] = useState({});
    const handsRef = useRef({});

    useEffect(() => {
        handsRef.current = hands;
    }, [hands]);

    const bump = useCallback(() => setRevision((value) => value + 1), []);

    useEffect(() => () => roomRef.current?.disconnect(), []);

    const reset = useCallback(() => {
        roomRef.current = null;
        setRoom(null);
        setChannel(null);
        setCommunityName(null);
        setCaptureQuality(null);
        setHands({});
        setReport(null);
        setAppliedProcessing(null);
        setPhase("idle");
    }, []);

    const join = useCallback(
        async (targetChannel, { communityName: name = null } = {}) => {
            if (!targetChannel) return;
            if (roomRef.current && channel?.channelId === targetChannel.channelId) return;
            if (roomRef.current) {
                await roomRef.current.disconnect();
                roomRef.current = null;
            }

            setPhase("connecting");
            setError(null);
            setChannel(targetChannel);
            setCommunityName(name);

            try {
                const { Room, RoomEvent, ScreenSharePresets, VideoPresets, supportsAV1, supportsVP9 } =
                    await import("livekit-client");
                const chosen = preferredCodec({ supportsAV1: supportsAV1(), supportsVP9: supportsVP9() });
                setCodec(chosen);
                const advancedCodec = chosen !== "vp8";
                const capture = cameraCaptureFor({ dataSaver: dataSaverRef.current });

                const session = await api(`/channels/${targetChannel.channelId}/media-token`, { method: "POST" });
                setPublish(session.publish ?? { microphone: true, camera: true, screen: true });
                let e2ee;
                if (session.e2eeRequired) {
                    const { mediaKeyForChannel } = await import("../lib/e2ee/session.js");
                    const { toBase64 } = await import("../lib/e2ee/crypto.js");
                    const raw = await mediaKeyForChannel(targetChannel.channelId);
                    if (!raw) {
                        throw new Error("Clé de salon indisponible : le média chiffré ne peut pas démarrer.");
                    }
                    const { ExternalE2EEKeyProvider } = await import("livekit-client");
                    const keyProvider = new ExternalE2EEKeyProvider();
                    await keyProvider.setKey(toBase64(raw));
                    const worker = new Worker(new URL("livekit-client/e2ee-worker", import.meta.url), {
                        type: "module",
                    });
                    e2ee = { keyProvider, worker };
                }
                const nextRoom = new Room({
                    ...(e2ee ? { encryption: e2ee, e2ee } : {}),
                    adaptiveStream: true,
                    dynacast: true,
                    disconnectOnPageLeave: true,
                    publishDefaults: {
                        videoCodec: chosen,
                        backupCodec: advancedCodec ? { codec: "vp8" } : false,
                        simulcast: !advancedCodec,
                        scalabilityMode: advancedCodec ? CAMERA_SCALABILITY : undefined,
                        videoEncoding: cameraEncodingFor({ dataSaver: dataSaverRef.current }),
                        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
                        screenShareEncoding: SCREEN_ENCODING,
                        screenShareSimulcastLayers: [ScreenSharePresets.h720fps5, ScreenSharePresets.h1080fps15],
                        degradationPreference: CAMERA_DEGRADATION,
                        audioPreset: VOICE_ENCODING,
                        dtx: true,
                        red: true,
                    },
                    videoCaptureDefaults: { resolution: capture },
                    audioCaptureDefaults: audioConstraints(processingRef.current),
                });

                [
                    RoomEvent.ParticipantConnected,
                    RoomEvent.ParticipantDisconnected,
                    RoomEvent.TrackSubscribed,
                    RoomEvent.TrackUnsubscribed,
                    RoomEvent.TrackPublished,
                    RoomEvent.TrackUnpublished,
                    RoomEvent.TrackMuted,
                    RoomEvent.TrackUnmuted,
                    RoomEvent.LocalTrackPublished,
                    RoomEvent.LocalTrackUnpublished,
                    RoomEvent.ActiveSpeakersChanged,
                    RoomEvent.ParticipantPermissionsChanged,
                ].forEach((event) => nextRoom.on(event, bump));
                nextRoom.on(RoomEvent.Reconnecting, () => {
                    setPhase("reconnecting");
                    announce("Connexion vocale interrompue, reprise en cours.");
                });
                nextRoom.on(RoomEvent.Reconnected, () => {
                    setPhase("connected");
                    announce("Connexion vocale rétablie.");
                });
                nextRoom.on(RoomEvent.Disconnected, reset);

                nextRoom.on(RoomEvent.ParticipantDisconnected, (participant) =>
                    setHands((current) => {
                        if (!(participant.identity in current)) return current;
                        const next = { ...current };
                        delete next[participant.identity];
                        return next;
                    })
                );

                const receiveHand = (identity, text) => {
                    if (!identity || text.length > 128 || roomRef.current !== nextRoom) return;
                    try {
                        const { raised } = JSON.parse(text);
                        if (typeof raised !== "boolean") return;
                        setHands((current) => {
                            const next = { ...current };
                            if (raised) next[identity] = Date.now();
                            else delete next[identity];
                            return next;
                        });
                        if (raised) {
                            const participant = nextRoom.remoteParticipants.get(identity);
                            announce(`${participant?.name || "Une personne"} lève la main.`);
                        }
                    } catch {}
                };
                nextRoom.registerTextStreamHandler("hand", async (reader, { identity }) => {
                    try {
                        receiveHand(identity, await reader.readAll());
                    } catch {}
                });
                nextRoom.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
                    if (topic === "hand" && participant) {
                        receiveHand(participant.identity, new TextDecoder().decode(payload));
                    }
                });

                roomRef.current = nextRoom;
                if (e2ee) await nextRoom.setE2EEEnabled(true);
                await nextRoom.connect(session.url, session.token, { autoSubscribe: true });
                await nextRoom.startAudio();
                await nextRoom.localParticipant.publishData(new Uint8Array([0]), {
                    reliable: false,
                    topic: "voice-presence",
                });
                if (expectsCamera(targetChannel.type)) {
                    await nextRoom.localParticipant
                        .setCameraEnabled(true)
                        .catch(() => announce("La caméra n’a pas pu démarrer : vous entrez sans image."));
                }

                setRoom(nextRoom);
                setPhase("connected");
                announce(expectsCamera(targetChannel.type) ? "Connecté au salon vidéo." : "Connecté au salon vocal.");
                bump();
            } catch (err) {
                await roomRef.current?.disconnect().catch(() => {});
                reset();
                setError(err instanceof ApiError ? err.message : "La connexion au salon vocal a échoué.");
            }
        },
        [bump, channel?.channelId, reset]
    );

    const leave = useCallback(() => {
        roomRef.current?.disconnect();
        reset();
        bump();
        announce("Salon vocal quitté.");
    }, [bump, reset]);

    const toggleMicrophone = useCallback(async () => {
        const local = roomRef.current?.localParticipant;
        if (!local) return;
        try {
            const enabling = !local.isMicrophoneEnabled;
            const publication = await local.setMicrophoneEnabled(enabling, audioConstraints(processingRef.current));
            announce(enabling ? "Micro activé." : "Micro coupé.");
            if (enabling) setAppliedProcessing(appliedAudioProcessing(publication?.track));
            bump();
        } catch {
            setError("Le navigateur n’a pas donné accès au microphone.");
        }
    }, [bump]);

    const toggleCamera = useCallback(async () => {
        const local = roomRef.current?.localParticipant;
        if (!local) return;
        try {
            const capture = cameraCaptureFor({ dataSaver: dataSaverRef.current });
            const publication = await local.setCameraEnabled(!local.isCameraEnabled, {
                resolution: capture,
                frameRate: capture.frameRate,
            });
            if (publication && deservesUhd(publication.track)) {
                await local
                    .setScreenShareEnabled(
                        true,
                        {
                            audio: true,
                            video: true,
                            contentHint: "detail",
                            resolution: screenCaptureFor({ uhd: true }),
                        },
                        {
                            screenShareEncoding: screenEncodingFor({ uhd: true }),
                            degradationPreference: SCREEN_DEGRADATION,
                        }
                    )
                    .catch(() => {});
            }

            setCaptureQuality(publication ? trackResolution(publication) : null);
            bump();
        } catch {
            setError("Le navigateur n’a pas donné accès à la caméra.");
        }
    }, [bump]);

    const setAudioProcessing = useCallback(
        async (next) => {
            const merged = { ...processingRef.current, ...next };
            processingRef.current = merged;
            setProcessing(merged);

            const local = roomRef.current?.localParticipant;
            if (!local?.isMicrophoneEnabled) return;

            try {
                await local.setMicrophoneEnabled(false);
                const publication = await local.setMicrophoneEnabled(true, audioConstraints(merged));
                setAppliedProcessing(appliedAudioProcessing(publication?.track));
                bump();
            } catch {
                setError("Le traitement audio n’a pas pu être appliqué.");
            }
        },
        [bump]
    );

    const setDataSaverMode = useCallback(
        async (enabled) => {
            dataSaverRef.current = enabled;
            setDataSaver(enabled);
            announce(enabled ? "Économie de données activée." : "Économie de données désactivée.");

            const local = roomRef.current?.localParticipant;
            if (!local?.isCameraEnabled) return;

            try {
                await local.setCameraEnabled(false);
                const capture = cameraCaptureFor({ dataSaver: enabled });
                const publication = await local.setCameraEnabled(true, {
                    resolution: capture,
                    frameRate: capture.frameRate,
                });
                setCaptureQuality(publication ? trackResolution(publication) : null);
                bump();
            } catch {
                setError("La qualité vidéo n’a pas pu être changée.");
            }
        },
        [bump]
    );

    const toggleHand = useCallback(async () => {
        const local = roomRef.current?.localParticipant;
        if (!local) return;

        const raised = !(local.identity in handsRef.current);
        setHands((current) => {
            const next = { ...current };
            if (raised) next[local.identity] = Date.now();
            else delete next[local.identity];
            return next;
        });
        announce(raised ? "Vous levez la main." : "Vous baissez la main.");

        try {
            await local.sendText(JSON.stringify({ raised }), { topic: "hand" });
        } catch {
            setError("La demande de parole n’a pas pu être transmise. Réessayez.");
            setHands((current) => {
                const next = { ...current };
                if (raised) delete next[local.identity];
                else next[local.identity] = Date.now();
                return next;
            });
        }
        bump();
    }, [bump]);

    useEffect(() => {
        if (phase !== "connected" || !roomRef.current) return undefined;
        let cancelled = false;

        const tick = async () => {
            const next = await connectionReport(roomRef.current).catch(() => null);
            if (!cancelled) setReport(next);
        };

        tick();
        const timer = setInterval(tick, 2000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [phase, revision]);

    const toggleScreen = useCallback(async () => {
        const local = roomRef.current?.localParticipant;
        if (!local) return;
        try {
            const enable = !local.isScreenShareEnabled;
            const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium/.test(navigator.userAgent);
            const publication = await local.setScreenShareEnabled(
                enable,
                {
                    audio: true,
                    video: true,
                    contentHint: "detail",
                    systemAudio: "include",
                    surfaceSwitching: "include",
                    ...(isSafari ? {} : { resolution: SCREEN_CAPTURE }),
                },
                {
                    screenShareEncoding: SCREEN_ENCODING,
                    audioPreset: SCREEN_AUDIO_ENCODING,
                    degradationPreference: SCREEN_DEGRADATION,
                    scalabilityMode: SCREEN_SCALABILITY,
                    forceStereo: true,
                    dtx: false,
                    red: false,
                }
            );
            setCaptureQuality(publication ? trackResolution(publication) : null);
            bump();
        } catch (err) {
            if (err?.name !== "NotAllowedError") setError("Le partage d’écran n’a pas pu démarrer.");
        }
    }, [bump]);

    const connected = phase === "connected" || phase === "reconnecting";

    const value = useMemo(() => {
        const local = room?.localParticipant ?? null;
        return {
            room,
            channel,
            communityName,
            phase,
            connected,
            connecting: phase === "connecting",
            error,
            clearError: () => setError(null),
            captureQuality,
            codec,
            revision,
            participants: room ? [room.localParticipant, ...room.remoteParticipants.values()] : [],
            micEnabled: Boolean(local?.isMicrophoneEnabled),
            cameraEnabled: Boolean(local?.isCameraEnabled),
            screenEnabled: Boolean(local?.isScreenShareEnabled),
            join,
            leave,
            toggleMicrophone,
            toggleCamera,
            toggleScreen,
            processing,
            appliedProcessing,
            setAudioProcessing,
            dataSaver,
            setDataSaver: setDataSaverMode,
            report,
            hands,
            handRaised: Boolean(local && local.identity in hands),
            toggleHand,
            publish,
            isAudience: !publish.microphone && !publish.camera && !publish.screen,
        };
    }, [
        room,
        channel,
        communityName,
        phase,
        connected,
        error,
        captureQuality,
        codec,
        revision,
        join,
        leave,
        toggleMicrophone,
        toggleCamera,
        toggleScreen,
        processing,
        appliedProcessing,
        setAudioProcessing,
        dataSaver,
        setDataSaverMode,
        hands,
        toggleHand,
        publish,
        report,
    ]);

    return (
        <VoiceSessionContext.Provider value={value}>
            {children}
            <RemoteAudio participants={value.participants} />
        </VoiceSessionContext.Provider>
    );
}
