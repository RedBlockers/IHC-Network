

from __future__ import annotations

import json
import os
import sys
import time
from base64 import urlsafe_b64decode
from pathlib import Path

from playwright.sync_api import TimeoutError, expect, sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core_flow import BASE_URL, register


SECRET = "preuve-e2ee-deux-navigateurs"


def _b64url_json(segment: str) -> dict:
    padding = "=" * (-len(segment) % 4)
    return json.loads(urlsafe_b64decode(segment + padding))


def run() -> None:
    suffix = os.environ.get("RUN_ID", str(int(time.time()))[-6:])
    ada_handle = f"e2eea{suffix}"
    alan_handle = f"e2eeb{suffix}"
    errors: list[str] = []
    checks: list[str] = []

    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        ada_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        alan_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        ada = ada_context.new_page()
        alan = alan_context.new_page()
        devices = {"ada": 0, "alan": 0}
        auth = {}

        def _on_response(name, response):
            if "/e2ee/devices" in response.url and response.request.method == "POST" and response.ok:
                devices[name] += 1

        def _on_request(request):
            header = request.headers.get("authorization")
            if header:
                auth["authorization"] = header

        for name, page in (("ada", ada), ("alan", alan)):
            page.on("pageerror", lambda error, n=name: errors.append(f"{n}:pageerror:{error}"))
            page.on(
                "console",
                lambda message, n=name: errors.append(f"{n}:console:{message.text}")
                if message.type == "error"
                else None,
            )
            page.on("response", lambda response, n=name: _on_response(n, response))
        ada.on("request", _on_request)

        register(ada, ada_handle, "Ada E2EE")
        register(alan, alan_handle, "Alan E2EE")

        ada.get_by_role("button", name="Créer une communauté").click()
        create = ada.get_by_role("dialog", name="Créer un serveur")
        create.get_by_label("Nom du serveur").fill("Chambre forte")
        create.get_by_role("button", name="Créer", exact=True).click()
        expect(ada.get_by_text("Chambre forte", exact=True).first).to_be_visible(timeout=15000)

        ada.get_by_label("Inviter des gens").click()
        invite = ada.get_by_role("dialog", name="Inviter des amis sur Chambre forte")
        invite.get_by_role("button", name="Générer un lien").click()
        invite_url = invite.locator("#invite-link-output").input_value()
        invite.get_by_role("button", name="Terminé").click()

        alan.get_by_role("button", name="Rejoindre avec un lien").click()
        join = alan.get_by_role("dialog", name="Rejoindre un serveur")
        join.get_by_label("Lien d’invitation").fill(invite_url)
        join.get_by_role("button", name="Rejoindre", exact=True).click()
        expect(alan.get_by_text("Chambre forte", exact=True).first).to_be_visible(timeout=15000)
        checks.append("guild")

        ada.get_by_label("Configurer général").click()
        permissions = ada.get_by_role("dialog", name="Permissions · général")
        with ada.expect_response(lambda response: "/e2ee" in response.url and response.request.method == "PATCH") as enabled:
            permissions.locator(".channel-encryption input[type=checkbox]").click()
        if enabled.value.status != 200:
            raise AssertionError(f"activation e2ee refusée: {enabled.value.status}")
        body = enabled.value.json()
        if body.get("e2eeEnabled") is not True:
            raise AssertionError(f"e2eeEnabled attendu, reçu {body}")
        permissions.get_by_label("Fermer").click()
        checks.append("e2ee-on")

        alan.reload()
        alan.get_by_label("Chambre forte").click()
        alan.locator(".chan", has_text="général").click()
        ada.locator(".chan", has_text="général").click()
        deadline = time.time() + 15
        while time.time() < deadline and (devices["ada"] < 1 or devices["alan"] < 1):
            ada.wait_for_timeout(100)
        if devices["ada"] < 1 or devices["alan"] < 1:
            raise AssertionError(f"appareils non enregistrés: {devices}")
        checks.append("devices")

        ada.get_by_label("Écrire dans #général").fill(SECRET)
        try:
            with ada.expect_response(lambda response: "/messages" in response.url and response.request.method == "POST") as posted:
                ada.get_by_label("Envoyer le message").click()
        except TimeoutError:
            seen = " | ".join(errors) or "aucune erreur navigateur collectée"
            raise AssertionError(f"envoi chiffré sans réponse serveur — {seen}")
        if posted.value.status != 201:
            raise AssertionError(f"envoi chiffré refusé: {posted.value.status}")
        created = posted.value.json().get("message") or {}
        stored = created.get("content") or ""
        request_body = posted.value.request.post_data or ""
        if SECRET in stored or SECRET in request_body:
            raise AssertionError("le serveur a reçu le clair")
        if not stored.startswith("QW1:"):
            raise AssertionError(f"enveloppe absente: {stored[:40]!r}")
        expect(alan.get_by_text(SECRET, exact=False)).to_be_visible(timeout=15000)
        checks.append("plaintext-peer")

        history = [SECRET]
        for index in range(2, 5):
            clear = f"historique-e2ee-message-{index}"
            history.append(clear)
            ada.get_by_label("Écrire dans #général").fill(clear)
            with ada.expect_response(lambda response: "/messages" in response.url and response.request.method == "POST") as posted:
                ada.get_by_label("Envoyer le message").click()
            if posted.value.status != 201 or not posted.value.json().get("message", {}).get("content", "").startswith("QW1:"):
                raise AssertionError("message d’historique chiffré non enregistré")
            if clear in (posted.value.request.post_data or ""):
                raise AssertionError("le serveur a reçu un message d’historique en clair")
        alan.reload()
        alan.get_by_label("Chambre forte").click()
        alan.locator(".chan", has_text="général").click()
        for clear in history:
            expect(alan.get_by_text(clear, exact=True)).to_be_visible(timeout=15000)
        checks.append("encrypted-history-after-reload")

        ada.get_by_role("button", name="Créer un salon dans").first.click()
        forum_modal = ada.get_by_role("dialog", name="Créer un salon")
        forum_modal.get_by_label("Autre type").select_option("forum")
        forum_modal.get_by_label("Nom du salon").fill("coffre-sujets")
        forum_modal.get_by_role("button", name="Créer le salon").click()
        expect(ada.get_by_role("region", name="Sujets de discussion", exact=True)).to_be_visible(timeout=15000)
        ada.get_by_label("Configurer coffre-sujets").click()
        forum_permissions = ada.get_by_role("dialog", name="Permissions · coffre-sujets")
        with ada.expect_response(lambda response: "/e2ee" in response.url and response.request.method == "PATCH") as forum_enabled:
            forum_permissions.locator(".channel-encryption input[type=checkbox]").click()
        if forum_enabled.value.status != 200 or not forum_enabled.value.json().get("e2eeEnabled"):
            raise AssertionError("chiffrement du forum non activé")
        forum_permissions.get_by_label("Fermer").click()

        topic_title = "Discussion chiffrée de contrôle"
        topic_history = ["contenu initial du sujet chiffré", "première réponse chiffrée", "seconde réponse chiffrée"]
        ada.get_by_role("button", name="Nouveau sujet", exact=True).click()
        topic_modal = ada.get_by_role("dialog", name="Nouveau sujet")
        topic_modal.get_by_label("Titre du sujet").fill(topic_title)
        topic_modal.get_by_label("Premier message").fill(topic_history[0])
        with ada.expect_response(lambda response: "/topics" in response.url and response.request.method == "POST") as opened:
            topic_modal.get_by_role("button", name="Publier le sujet").click()
        if opened.value.status != 201:
            raise AssertionError(f"sujet chiffré refusé : {opened.value.status}")
        thread = opened.value.json()["thread"]
        root_id = str(thread["rootId"])
        topic_request = json.loads(opened.value.request.post_data or "{}")
        if not topic_request.get("content", "").startswith("QW1:") or topic_history[0] in (opened.value.request.post_data or ""):
            raise AssertionError("le sujet n’a pas été chiffré avant son envoi")
        saved_topic = ada_context.request.get(
            f"{BASE_URL}/api/v1/channels/{thread['channelId']}/threads/{root_id}/messages",
            headers={"Authorization": auth["authorization"]},
        )
        if saved_topic.status != 200:
            raise AssertionError(f"lecture du sujet chiffré refusée : {saved_topic.status}")
        saved_root = next((message for message in saved_topic.json().get("messages", []) if str(message["messageId"]) == root_id), {})
        if not saved_root.get("content", "").startswith("QW1:") or topic_history[0] in saved_root.get("content", ""):
            raise AssertionError("le contenu enregistré du sujet n’est pas chiffré")
        for clear in topic_history[1:]:
            ada.get_by_label("Répondre au sujet").fill(clear)
            with ada.expect_response(lambda response: f"/threads/{root_id}/messages" in response.url and response.request.method == "POST") as replied:
                ada.get_by_role("button", name="Publier la réponse").click()
            if replied.value.status != 201 or not replied.value.json().get("message", {}).get("content", "").startswith("QW1:"):
                raise AssertionError("réponse chiffrée non enregistrée")
            if clear in (replied.value.request.post_data or ""):
                raise AssertionError("une réponse au sujet a quitté le navigateur en clair")
            expect(ada.locator(".thread-messages").get_by_text(clear, exact=True)).to_be_visible(timeout=15000)

        alan.reload()
        alan.get_by_label("Chambre forte").click()
        alan.locator(".chan", has_text="coffre-sujets").click()
        alan.locator(".forum-topics button", has_text=topic_title).click()
        for clear in topic_history:
            expect(alan.locator(".thread-messages").get_by_text(clear, exact=True)).to_be_visible(timeout=15000)
        checks.append("encrypted-topic-history-after-reload")

        current_text = topic_history[0]
        for replacement in ("première édition du sujet conservée", "seconde édition du sujet conservée"):
            message_row = ada.locator(".thread-messages > li").filter(has=ada.get_by_text(current_text, exact=True))
            message_row.get_by_role("button", name="Modifier le message", exact=True).click()
            edit_modal = ada.get_by_role("dialog", name="Modifier le message")
            editor = edit_modal.get_by_role("textbox", name="Message", exact=True)
            expect(editor).to_have_value(current_text)
            editor.fill(replacement)
            with ada.expect_response(lambda response: f"/messages/{root_id}" in response.url and response.request.method == "PATCH") as edited:
                edit_modal.get_by_role("button", name="Enregistrer", exact=True).click()
            if edited.value.status != 200 or not edited.value.json().get("message", {}).get("content", "").startswith("QW1:"):
                raise AssertionError("édition chiffrée non enregistrée")
            if replacement in (edited.value.request.post_data or ""):
                raise AssertionError("le serveur a reçu une édition en clair")
            for page in (ada, alan):
                expect(page.locator(".thread-messages").get_by_text(replacement, exact=True)).to_be_visible(timeout=15000)
                expect(page.locator(".thread-messages").get_by_text(current_text, exact=True)).to_have_count(0)
            current_text = replacement
        checks.append("encrypted-topic-two-successive-edits")

        ada.get_by_role("button", name="Créer un salon dans").first.click()
        channel = ada.get_by_role("dialog", name="Créer un salon")
        channel.get_by_text("Salon vocal", exact=True).click()
        channel.get_by_label("Nom du salon").fill("cave")
        channel.get_by_role("button", name="Créer le salon").click()
        expect(ada.get_by_role("heading", name="cave")).to_be_visible(timeout=10000)
        voice_id = ada.locator('.chan[data-channel-id]', has_text="cave").get_attribute("data-channel-id")

        ada.get_by_label("Configurer cave").click()
        voice_permissions = ada.get_by_role("dialog", name="Permissions · cave")
        with ada.expect_response(lambda response: "/e2ee" in response.url and response.request.method == "PATCH"):
            voice_permissions.locator(".channel-encryption input[type=checkbox]").click()
        voice_permissions.get_by_label("Fermer").click()

        if "authorization" not in auth:
            raise AssertionError("aucun jeton de session capturé")
        token_response = ada_context.request.post(
            f"{BASE_URL}/api/v1/channels/{voice_id}/media-token",
            headers={"Authorization": auth["authorization"]},
        )
        if token_response.status != 200:
            raise AssertionError(f"jeton média refusé: {token_response.status} {token_response.text()}")
        media = token_response.json()
        if media.get("e2eeRequired") is not True:
            raise AssertionError(f"e2eeRequired absent du jeton média: {media}")
        if any(key in media for key in ("epochKey", "wrappedKey", "mediaKey")):
            raise AssertionError("le jeton média porte une clé")
        claims = _b64url_json(media["token"].split(".")[1])
        if any(key in claims for key in ("epochKey", "e2eeKey", "wrappedKey", "mediaKey")):
            raise AssertionError("le JWT média porte une clé")
        checks.append("media-token")

        ada_context.close()
        alan_context.close()
        browser.close()

    if errors:
        raise AssertionError("\n".join(errors))
    result = json.dumps({"status": "passed", "checks": checks}, ensure_ascii=False)
    if os.environ.get("RESULT_PATH"):
        Path(os.environ["RESULT_PATH"]).write_text(result, encoding="utf-8")
    print(result)


if __name__ == "__main__":
    try:
        run()
    except BaseException as error:
        if os.environ.get("RESULT_PATH"):
            Path(os.environ["RESULT_PATH"]).write_text(
                json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False),
                encoding="utf-8",
            )
        raise
