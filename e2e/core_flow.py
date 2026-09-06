import json
import os
import time
from base64 import b64decode, b64encode
from base64 import urlsafe_b64encode
from hashlib import sha256
from hmac import new as hmac_new

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:18888")
PASSWORD = "E2E-only-password-2026!"
PNG = b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def b64url(value):
    return urlsafe_b64encode(value).rstrip(b"=").decode()


def sign_webhook(body):
    now = int(time.time())
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64url(json.dumps({
        "iss": os.environ.get("LIVEKIT_API_KEY", "e2e-livekit-key"),
        "nbf": now - 1,
        "exp": now + 60,
        "sha256": b64encode(sha256(body.encode()).digest()).decode(),
    }, separators=(",", ":")).encode())
    unsigned = f"{header}.{payload}"
    signature = hmac_new(
        os.environ.get("LIVEKIT_API_SECRET", "e2e-livekit-secret-abcdefghijklmnopqrstuvwxyz-1234567890").encode(),
        unsigned.encode(),
        sha256,
    ).digest()
    return f"{unsigned}.{b64url(signature)}"


def register(page, handle, display_name):
    for attempt in range(3):
        response = page.request.get(f"{BASE_URL}/api/v1/auth/availability?handle=qweillo_probe")
        headers = {key.lower(): value for key, value in response.headers.items()}
        if response.status not in (200, 429):
            raise AssertionError(f"Le service d’inscription ne répond pas : {response.status}")
        if int(headers.get("ratelimit-remaining", "20")) >= 12:
            break
        delay = min(60, max(1, int(headers.get("ratelimit-reset", "60"))))
        print(json.dumps({"rateLimitWaitSeconds": delay}), flush=True)
        page.wait_for_timeout(delay * 1000 + 250)
    else:
        raise AssertionError("Le service reste limité après le délai indiqué.")
    page.goto(f"{BASE_URL}/register")
    page.get_by_label("Adresse e-mail").fill(f"{handle}@example.test")
    page.locator('input[type="password"]').fill(PASSWORD)
    page.get_by_role("button", name="Continuer").click()
    page.get_by_label("Pseudo").fill(handle)
    page.get_by_label("Nom affiché").fill(display_name)
    page.get_by_role("button", name="Créer mon compte").click()
    expect(page.get_by_role("heading", name=f"Bonjour, {display_name}")).to_be_visible(timeout=15000)


def image_file(name):
    return {"name": name, "mimeType": "image/png", "buffer": PNG}


def run():
    failures = []
    checks = []
    suffix = os.environ.get("RUN_ID", str(int(time.time()))[-6:])
    alice_handle = f"alice{suffix}"
    bob_handle = f"bob{suffix}"
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        alice_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        bob_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        alice = alice_context.new_page()
        bob = bob_context.new_page()

        for name, page in (("alice", alice), ("bob", bob)):
            page.on("pageerror", lambda error, n=name: failures.append(f"{n}:pageerror:{error}"))
            page.on("console", lambda message, n=name: failures.append(f"{n}:console:{message.text}") if message.type == "error" else None)

        register(alice, alice_handle, "Alice E2E")
        register(bob, bob_handle, "Bob E2E")
        checks.append("accounts")

        alice.get_by_role("button", name="Créer une communauté").click()
        modal = alice.get_by_role("dialog", name="Créer un serveur")
        modal.locator('input[type="file"]').set_input_files(image_file("logo.png"))
        crop = alice.get_by_role("dialog", name="Recadrer la photo")
        crop.get_by_role("button", name="Utiliser cette photo").click()
        modal.get_by_label("Nom du serveur").fill("Studio E2E")
        modal.get_by_role("button", name="Créer", exact=True).click()
        expect(alice.get_by_text("Studio E2E", exact=True).first).to_be_visible(timeout=15000)
        checks.append("guild-create")

        alice.get_by_label("Réglages du serveur").click()
        admin = alice.get_by_role("dialog", name="Administration du serveur")
        admin.get_by_role("button", name="Profil & bannière").click()
        expect(admin.get_by_text("Aperçu du serveur", exact=True)).to_be_visible()
        uploads = admin.locator('input[type="file"]')
        uploads.nth(0).set_input_files(image_file("new-logo.png"))
        uploads.nth(1).set_input_files(image_file("banner.png"))
        admin.get_by_label("Nom du serveur").fill("Studio sécurisé")
        admin.get_by_role("button", name="Enregistrer les modifications").click()
        expect(alice.get_by_text("Studio sécurisé", exact=True).first).to_be_visible(timeout=15000)

        icon_url = alice.locator(".rail-tile-img").first.get_attribute("src")
        banner_style = alice.locator(".banner-grad.has-image").get_attribute("style")
        if not icon_url or not icon_url.startswith("/media/") or "/media/" not in (banner_style or ""):
            raise AssertionError("les médias persistants ne sont pas exposés par le serveur")
        icon_response = alice_context.request.get(f"{BASE_URL}{icon_url}")
        if icon_response.status != 200 or icon_response.headers.get("content-type") != "image/webp":
            raise AssertionError("le logo normalisé n'est pas servi en WebP")
        checks.append("guild-media")

        alice.get_by_role("button", name="Créer un salon dans").first.click()
        channel_modal = alice.get_by_role("dialog", name="Créer un salon")
        channel_modal.get_by_text("Salon vocal", exact=True).click()
        channel_modal.get_by_label("Nom du salon").fill("ultra")
        channel_modal.get_by_role("button", name="Créer le salon").click()
        expect(alice.get_by_role("heading", name="ultra")).to_be_visible(timeout=10000)
        voice_channel_id = int(alice.locator('.chan[data-channel-id]', has_text="ultra").get_attribute("data-channel-id"))
        joined = json.dumps({
            "event": "participant_joined",
            "id": f"voice-{suffix}",
            "createdAt": int(time.time()),
            "room": {"name": f"channel:{voice_channel_id}"},
            "participant": {
                "identity": "user:9999",
                "name": "Voice Tester",
                "metadata": json.dumps({"userId": 9999, "handle": "voice-test", "displayName": "Voice Tester", "avatar": None}),
                "joinedAt": int(time.time()) - 4,
            },
        }, separators=(",", ":"))
        webhook = alice_context.request.post(
            f"{BASE_URL}/api/v1/media/webhook",
            data=joined,
            headers={"Content-Type": "application/webhook+json", "Authorization": sign_webhook(joined)},
        )
        if webhook.status != 204:
            raise AssertionError(f"webhook vocal refusé: {webhook.status}")
        expect(alice.locator(".voice-member-name", has_text="Voice Tester")).to_be_visible(timeout=10000)
        expect(alice.locator(".voice-member-duration")).to_contain_text("00:0")
        checks.append("voice-presence")

        alice.get_by_label("Inviter des gens").click()
        invite_modal = alice.get_by_role("dialog", name="Inviter des amis sur Studio sécurisé")
        invite_modal.get_by_role("button", name="Générer un lien").click()
        invite_url = invite_modal.locator("#invite-link-output").input_value()
        invite_modal.get_by_role("button", name="Terminé").click()

        bob.get_by_role("button", name="Rejoindre avec un lien").click()
        join_modal = bob.get_by_role("dialog", name="Rejoindre un serveur")
        join_modal.get_by_label("Lien d’invitation").fill(invite_url)
        join_modal.get_by_role("button", name="Rejoindre", exact=True).click()
        expect(bob.get_by_text("Studio sécurisé", exact=True).first).to_be_visible(timeout=15000)
        checks.append("invite-join")

        alice.get_by_role("button", name="Fermer les salons").count()
        alice.locator(".chan", has_text="général").click()
        bob.locator(".chan", has_text="général").click()
        message = "Message temps réel E2E navigateur"
        bob.get_by_label("Écrire dans #général").fill(message)
        bob.get_by_label("Envoyer le message").click()
        expect(alice.get_by_text(message, exact=True)).to_be_visible(timeout=10000)
        alice.reload()
        alice.get_by_label("Studio sécurisé").click()
        alice.locator(".chan", has_text="général").click()
        expect(alice.get_by_text(message, exact=True)).to_be_visible(timeout=15000)
        checks.append("realtime-persistence")

        alice.get_by_label("Messages privés").click()
        alice.get_by_placeholder("Rechercher par pseudo…").fill(bob_handle)
        alice.get_by_role("button", name="Ajouter").click()
        bob.get_by_label("Messages privés").click()
        expect(bob.get_by_text("Demandes reçues")).to_be_visible(timeout=10000)
        bob.get_by_role("button", name="Accepter").click()
        expect(bob.get_by_text("Vos amis")).to_be_visible(timeout=10000)
        bob.get_by_role("button", name="Écrire").click()
        bob.get_by_label("Écrire à Alice E2E").fill("DM réel")
        bob.get_by_label("Envoyer le message").click()
        alice.get_by_label("Messages privés").click()
        alice.get_by_role("button", name="Écrire").first.click()
        expect(alice.get_by_text("DM réel", exact=True)).to_be_visible(timeout=10000)
        checks.append("friend-dm")

        alice_context.close()
        bob_context.close()
        browser.close()

    if failures:
        raise AssertionError("\n".join(failures))
    print(json.dumps({"status": "passed", "checks": checks}, ensure_ascii=False))


if __name__ == "__main__":
    run()
