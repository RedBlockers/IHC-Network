import json
import os
import tempfile
import time

from playwright.sync_api import expect, sync_playwright

from core_flow import BASE_URL, register


RTC_PROBE = """(() => {
    const Original = window.RTCPeerConnection;
    window.rtcConnections = [];
    window.RTCPeerConnection = class extends Original {
        constructor(...args) {
            super(...args);
            window.rtcConnections.push(this);
            this.samples = [];
            this.addEventListener('connectionstatechange', async () => {
                const stats = [...(await this.getStats()).values()];
                this.samples.push({state: this.connectionState, ice: this.iceConnectionState,
                    transports: stats.filter(s => s.type === 'transport').map(s => ({dtls: s.dtlsState})),
                    pairs: stats.filter(s => s.type === 'candidate-pair').map(s => ({state: s.state,
                        nominated: s.nominated, sent: s.bytesSent, received: s.bytesReceived}))});
            });
        }
    };
})();"""


def install_rtc_probe(context):
    context.add_init_script(RTC_PROBE)


def rtc_summary(page):
    return page.evaluate("""async () => Promise.all(window.rtcConnections.map(async pc => ({
        state: pc.connectionState, ice: pc.iceConnectionState, samples: pc.samples,
        data: [...(await pc.getStats()).values()].filter(s => s.type === 'data-channel').map(s => ({
            label: s.label, state: s.state, sent: s.messagesSent, received: s.messagesReceived
        })),
        inbound: [...(await pc.getStats()).values()].filter(s => s.type === 'inbound-rtp').map(s => ({
            kind: s.kind, bytes: s.bytesReceived, packets: s.packetsReceived,
            frames: s.framesDecoded, width: s.frameWidth, height: s.frameHeight
        }))
    })))""")


def expect_connected(page):
    try:
        expect(page.locator(".signal-led.connected")).to_be_visible(timeout=25000)
    except Exception:
        print(json.dumps({"connectionFailure": rtc_summary(page)}), flush=True)
        raise


def received_audio(page):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        sample = page.evaluate("""async () => {
            for (const pc of window.rtcConnections) {
                const stats = [...(await pc.getStats()).values()];
                const audio = stats.filter(s => s.type === 'inbound-rtp' && s.kind === 'audio' && s.packetsReceived > 3);
                if (audio.length) return audio.map(s => ({kind: s.kind, packets: s.packetsReceived, bytes: s.bytesReceived}));
            }
            return [];
        }""")
        if sample:
            return sample
        page.wait_for_timeout(200)
    raise AssertionError(f"Aucun paquet audio reçu : {rtc_summary(page)}")


def received_video(page, selector):
    page.wait_for_function("""selector => {
        const el = document.querySelector(selector);
        return el && el.videoWidth > 0 && el.videoHeight > 0 && el.getVideoPlaybackQuality().totalVideoFrames > 2;
    }""", arg=selector, timeout=30000)
    first = page.locator(selector).evaluate("el => el.getVideoPlaybackQuality().totalVideoFrames")
    page.wait_for_function("""({selector, first}) => {
        const el = document.querySelector(selector);
        return el && el.getVideoPlaybackQuality().totalVideoFrames > first + 2;
    }""", arg={"selector": selector, "first": first}, timeout=15000)
    return page.locator(selector).evaluate("""el => ({width: el.videoWidth, height: el.videoHeight,
        frames: el.getVideoPlaybackQuality().totalVideoFrames})""")


def fake_4k_video():
    width = 3840
    height = 2160
    target = tempfile.NamedTemporaryFile(suffix=".y4m", delete=False)
    target.write(f"YUV4MPEG2 W{width} H{height} F30:1 Ip A1:1 C420\nFRAME\n".encode())
    target.write(bytes([16]) * (width * height))
    target.write(bytes([128]) * (width * height // 2))
    target.close()
    return target.name


def run():
    suffix = os.environ.get("RUN_ID", str(int(time.time()))[-6:])
    video_file = fake_4k_video()
    try:
        args = [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            f"--use-file-for-fake-video-capture={video_file}",
            "--auto-select-desktop-capture-source=Entire screen",
            "--enable-usermedia-screen-capturing",
            "--allow-http-screen-capture",
            "--window-size=3840,2160",
        ]

        with sync_playwright() as runtime:
            browser = runtime.chromium.launch(headless=True, args=args)
            alice_context = browser.new_context(viewport={"width": 3840, "height": 2160}, permissions=["camera", "microphone"])
            bob_context = browser.new_context(viewport={"width": 1920, "height": 1080}, permissions=["camera", "microphone"])
            for context in (alice_context, bob_context):
                context.add_init_script("Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 })")
            install_rtc_probe(alice_context)
            install_rtc_probe(bob_context)
            alice = alice_context.new_page()
            bob = bob_context.new_page()

            register(alice, f"mediaa{suffix}", "Media Alice")
            register(bob, f"mediab{suffix}", "Media Bob")

            alice.get_by_role("button", name="Créer une communauté").click()
            create = alice.get_by_role("dialog", name="Créer un serveur")
            create.get_by_label("Nom du serveur").fill("Media Lab")
            create.get_by_role("button", name="Créer", exact=True).click()
            expect(alice.get_by_text("Media Lab", exact=True).first).to_be_visible(timeout=15000)

            alice.get_by_role("button", name="Créer un salon dans").first.click()
            channel = alice.get_by_role("dialog", name="Créer un salon")
            channel.get_by_text("Salon vocal", exact=True).click()
            channel.get_by_label("Nom du salon").fill("4k-lab")
            channel.get_by_role("button", name="Créer le salon").click()
            expect(alice.get_by_role("heading", name="4k-lab")).to_be_visible(timeout=10000)

            alice.get_by_label("Inviter des gens").click()
            invite = alice.get_by_role("dialog", name="Inviter des amis sur Media Lab")
            invite.get_by_role("button", name="Générer un lien").click()
            invite_url = invite.locator("#invite-link-output").input_value()
            invite.get_by_role("button", name="Terminé").click()

            bob.get_by_role("button", name="Rejoindre avec un lien").click()
            join = bob.get_by_role("dialog", name="Rejoindre un serveur")
            join.get_by_label("Lien d’invitation").fill(invite_url)
            join.get_by_role("button", name="Rejoindre", exact=True).click()
            expect(bob.get_by_text("Media Lab", exact=True).first).to_be_visible(timeout=15000)
            bob.locator(".chan", has_text="4k-lab").click()

            alice.get_by_role("button", name="Rejoindre le salon").click()
            bob.get_by_role("button", name="Rejoindre le salon").click()
            expect_connected(alice)
            expect_connected(bob)
            expect(alice.locator(".voice-member-name")).to_have_count(2, timeout=15000)

            alice.get_by_text("Micro coupé", exact=True).click()
            expect(alice.get_by_text("Micro actif", exact=True)).to_be_visible(timeout=10000)
            remote_audio = received_audio(bob)
            alice.get_by_text("Caméra", exact=True).click()
            expect(bob.locator(".voice-tile video")).to_have_count(1, timeout=20000)
            local_camera = received_video(alice, ".voice-tile:not(.is-screen) video")
            if local_camera["width"] < 1280:
                raise AssertionError(f"capture locale: {local_camera}")
            remote_camera = received_video(bob, ".voice-tile:not(.is-screen) video")

            alice.get_by_text("Partager l’écran", exact=True).click()
            expect(alice.get_by_text("Écran partagé", exact=True)).to_be_visible(timeout=20000)
            expect(bob.locator(".voice-tile video")).to_have_count(2, timeout=20000)
            remote_screen = received_video(bob, ".voice-tile.is-screen video")

            audio_before_navigation = bob.locator("audio").first.evaluate("""el => {
                window.callAudioForTest = el;
                return el.currentTime;
            }""")
            bob.get_by_role("button", name="général", exact=True).click()
            expect(bob.get_by_role("region", name="Appel en cours")).to_be_visible(timeout=10000)
            bob.wait_for_function("""before => window.callAudioForTest.isConnected &&
                !window.callAudioForTest.paused && window.callAudioForTest.currentTime > before + 0.1
            """, arg=audio_before_navigation, timeout=10000)
            bob.locator(".chan", has_text="4k-lab").click()
            expect_connected(bob)
            expect(bob.locator(".voice-tile video")).to_have_count(2, timeout=15000)
            received_video(bob, ".voice-tile:not(.is-screen) video")

            result = {
                "status": "passed",
                "localCamera": local_camera,
                "remoteCamera": remote_camera,
                "remoteScreen": remote_screen,
                "remoteAudio": remote_audio,
                "remoteVideoTracks": bob.locator(".voice-tile video").count(),
                "voiceParticipants": alice.locator(".voice-member-name").count(),
                "screenShare": True,
                "callContinuesAcrossNavigation": True,
            }
            print(json.dumps(result))

            alice_context.close()
            bob_context.close()
            browser.close()
    finally:
        os.unlink(video_file)


if __name__ == "__main__":
    run()
