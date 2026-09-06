export function collectRoomAudioTracks(room) {
    if (!room) return [];
    const participants = [room.localParticipant, ...[...(room.remoteParticipants?.values?.() ?? [])]];
    const tracks = [];
    for (const participant of participants) {
        if (!participant) continue;
        const publications = participant.audioTrackPublications?.values?.() ?? [];
        for (const publication of publications) {
            const media = publication?.track?.mediaStreamTrack;
            if (media && !publication.isMuted) tracks.push(media);
        }
    }
    return tracks;
}

export function mixTracks(tracks, audioContext) {
    if (!audioContext || tracks.length === 0) return null;
    const destination = audioContext.createMediaStreamDestination();
    for (const track of tracks) {
        const source = audioContext.createMediaStreamSource(new MediaStream([track]));
        source.connect(destination);
    }
    return destination.stream;
}

export function downloadBlob(blob, filename, opener = globalThis) {
    const url = opener.URL.createObjectURL(blob);
    const link = opener.document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    opener.document.body.appendChild(link);
    link.click();
    link.remove();
    opener.URL.revokeObjectURL(url);
}

export function startLocalRecording(stream, { mimeType, onStop } = {}) {
    if (!stream || typeof MediaRecorder === "undefined") return null;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        onStop?.(blob);
    };
    recorder.start();
    return recorder;
}
