"""Two real browser clients: audience, raised hand, speaker and return to audience."""
import json
import os
import time

from playwright.sync_api import expect, sync_playwright

from core_flow import register
from media_flow import expect_connected, install_rtc_probe, received_audio, received_video, rtc_summary


def create_channel(page, kind, name):
    page.get_by_role("button", name="Créer un salon dans").first.click()
    dialog = page.get_by_role("dialog", name="Créer un salon")
    dialog.get_by_label("Autre type").select_option(kind)
    dialog.get_by_label("Nom du salon").fill(name)
    dialog.get_by_role("button", name="Créer le salon").click()
    expect(page.get_by_role("heading", name=name, exact=True)).to_be_visible(timeout=15000)


def run():
    suffix = os.environ.get("RUN_ID", str(int(time.time()))[-6:])
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True, args=[
            "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
        ])
        try:
            alice_context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["camera", "microphone"])
            bob_context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["camera", "microphone"])
            install_rtc_probe(alice_context)
            install_rtc_probe(bob_context)
            alice = alice_context.new_page()
            bob = bob_context.new_page()
            register(alice, f"stagea{suffix}", "Stage Alice")
            register(bob, f"stageb{suffix}", "Stage Bob")

            alice.get_by_role("button", name="Créer une communauté").click()
            dialog = alice.get_by_role("dialog", name="Créer un serveur")
            dialog.get_by_label("Nom du serveur").fill("Stage Lab")
            dialog.get_by_role("button", name="Créer", exact=True).click()
            expect(alice.get_by_text("Stage Lab", exact=True).first).to_be_visible(timeout=15000)
            create_channel(alice, "stage", "scene-lab")

            alice.get_by_label("Inviter des gens").click()
            dialog = alice.get_by_role("dialog", name="Inviter des amis sur Stage Lab")
            dialog.get_by_role("button", name="Générer un lien").click()
            invite_url = dialog.locator("#invite-link-output").input_value()
            dialog.get_by_role("button", name="Terminé").click()
            bob.get_by_role("button", name="Rejoindre avec un lien").click()
            dialog = bob.get_by_role("dialog", name="Rejoindre un serveur")
            dialog.get_by_label("Lien d’invitation").fill(invite_url)
            dialog.get_by_role("button", name="Rejoindre", exact=True).click()
            expect(bob.get_by_text("Stage Lab", exact=True).first).to_be_visible(timeout=15000)
            bob.locator(".chan", has_text="scene-lab").click()

            alice.get_by_role("button", name="Rejoindre le salon").click()
            bob.get_by_role("button", name="Rejoindre le salon").click()
            expect_connected(alice)
            expect_connected(bob)
            expect(bob.locator(".voice-audience")).to_be_visible()
            expect(bob.get_by_role("button", name="Activer ou couper le microphone")).to_have_count(0)
            expect(bob.get_by_role("button", name="Activer ou couper la caméra")).to_have_count(0)
            bob.get_by_role("button", name="Lever la main", exact=True).click()
            expect(alice.locator(".stage-speakers").get_by_text("Public · main levée", exact=True)).to_be_visible(timeout=15000)

            alice.get_by_role("button", name="Donner la parole à Stage Bob", exact=True).click()
            expect(bob.locator(".voice-audience")).to_have_count(0, timeout=15000)
            expect(bob.get_by_role("button", name="Activer ou couper le microphone")).to_be_visible(timeout=15000)
            expect(bob.get_by_role("button", name="Activer ou couper la caméra")).to_have_count(0)
            bob.get_by_role("button", name="Activer ou couper le microphone").click()
            audio = received_audio(alice)
            bob.get_by_role("button", name="Baisser la main", exact=True).click()
            expect(alice.locator(".voice-hand")).to_have_count(0, timeout=15000)
            alice.get_by_role("button", name="Retirer la parole à Stage Bob", exact=True).click()
            expect(bob.locator(".voice-audience")).to_be_visible(timeout=15000)
            expect(alice.locator("audio")).to_have_count(0, timeout=15000)
            expect_connected(alice)
            expect_connected(bob)

            bob.get_by_role("button", name="Quitter", exact=True).click()
            bob.get_by_role("button", name="Rejoindre le salon").click()
            expect_connected(bob)
            expect(bob.locator(".voice-audience")).to_be_visible(timeout=15000)
            expect(bob.get_by_role("button", name="Lever la main", exact=True)).to_be_visible()

            create_channel(alice, "video", "video-lab")
            alice.get_by_role("button", name="Déplacer ma connexion ici").click()
            expect_connected(alice)
            expect(alice.get_by_text("Caméra active", exact=True)).to_be_visible(timeout=15000)
            bob.locator(".chan", has_text="video-lab").click()
            bob.get_by_role("button", name="Déplacer ma connexion ici").click()
            expect_connected(bob)
            expect(bob.get_by_text("Caméra active", exact=True)).to_be_visible(timeout=15000)
            expect(bob.locator(".voice-tile video")).to_have_count(2, timeout=20000)
            remote_video = received_video(bob, ".voice-tile:nth-child(2) video")
            print(json.dumps({"status": "passed", "audienceByDefault": True, "raisedHandReceived": True,
                "speakerAudio": audio, "revokedAudioUnpublished": True, "audienceAfterRejoin": True,
                "automaticVideo": remote_video}), flush=True)
        except Exception:
            for name, page in (("alice", alice), ("bob", bob)):
                print(json.dumps({"participant": name, "rtc": rtc_summary(page)}), flush=True)
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    run()
