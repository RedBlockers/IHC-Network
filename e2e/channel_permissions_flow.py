import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from core_flow import BASE_URL, register


def run():
    suffix = os.environ.get("RUN_ID", str(int(time.time()))[-5:])
    owner_handle = f"cowner{suffix}"
    member_handle = f"cmember{suffix}"
    errors = []

    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        owner_context = browser.new_context(viewport={"width": 1600, "height": 1000})
        member_context = browser.new_context(viewport={"width": 1440, "height": 900})
        owner = owner_context.new_page()
        member = member_context.new_page()
        member_auth = {}

        def capture_member_auth(request):
            authorization = request.headers.get("authorization")
            if authorization:
                member_auth["authorization"] = authorization

        member.on("request", capture_member_auth)
        for name, page in (("owner", owner), ("member", member)):
            page.on("pageerror", lambda error, n=name: errors.append(f"{n}:pageerror:{error}"))
            page.on("console", lambda message, n=name: errors.append(f"{n}:console:{message.text}") if message.type == "error" and "Failed to load resource" not in message.text else None)

        register(owner, owner_handle, "Owner Channels")
        register(member, member_handle, "Member Channels")

        owner.get_by_role("button", name="Créer une communauté").click()
        create = owner.get_by_role("dialog", name="Créer un serveur")
        create.get_by_label("Nom du serveur").fill("Atelier Salons")
        create.get_by_role("button", name="Créer", exact=True).click()
        expect(owner.get_by_text("Atelier Salons", exact=True).first).to_be_visible(timeout=15000)

        owner.get_by_label("Inviter des gens").click()
        invite = owner.get_by_role("dialog", name="Inviter des amis sur Atelier Salons")
        invite.get_by_role("button", name="Générer un lien").click()
        invite_url = invite.locator("#invite-link-output").input_value()
        invite.get_by_role("button", name="Terminé").click()

        member.get_by_role("button", name="Rejoindre avec un lien").click()
        join = member.get_by_role("dialog", name="Rejoindre un serveur")
        join.get_by_label("Lien d’invitation").fill(invite_url)
        join.get_by_role("button", name="Rejoindre", exact=True).click()
        expect(member.get_by_text("Atelier Salons", exact=True).first).to_be_visible(timeout=15000)

        owner.get_by_label("Configurer général").click()
        permissions = owner.get_by_role("dialog", name="Permissions · général")
        expect(permissions.get_by_text("@everyone", exact=True).first).to_be_visible(timeout=10000)
        send_rule = permissions.locator(".permission-row", has_text="Envoyer des messages")
        send_rule.get_by_role("button", name="Refuser").click()
        with owner.expect_response(lambda response: "/permissions/role/" in response.url and response.request.method == "PUT") as saved:
            permissions.get_by_role("button", name="Enregistrer", exact=True).click()
        if saved.value.status != 200:
            raise AssertionError(f"sauvegarde rôle refusée: {saved.value.status}")
        expect(permissions.get_by_text("Toutes les modifications sont enregistrées", exact=True)).to_be_visible()

        artifact = os.environ.get("ARTIFACT_PATH")
        if artifact:
            permissions.screenshot(path=artifact)

        member.locator(".chan", has_text="général").click()
        expect(member.get_by_label("Écrire dans #général")).to_have_count(0)
        channel_id = member.locator(".chan", has_text="général").get_attribute("data-channel-id")
        rejected = member_context.request.post(
            f"{BASE_URL}/api/v1/channels/{channel_id}/messages",
            headers={"Authorization": member_auth["authorization"]},
            data={"content": "Message interdit"},
        )
        if rejected.status != 403:
            raise AssertionError(f"écriture attendue en 403, reçue en {rejected.status}")

        permissions.locator(".channel-target-list button", has_text="Member Channels").click()
        view_rule = permissions.locator(".permission-row", has_text="Voir les salons")
        view_rule.get_by_role("button", name="Refuser").click()
        with owner.expect_response(lambda response: "/permissions/member/" in response.url and response.request.method == "PUT") as hidden:
            permissions.get_by_role("button", name="Enregistrer", exact=True).click()
        if hidden.value.status != 200:
            raise AssertionError(f"sauvegarde membre refusée: {hidden.value.status}")

        member.reload()
        member.get_by_label("Atelier Salons").click()
        expect(member.locator('[data-channel-id]')).to_have_count(0, timeout=10000)

        permissions.locator(".channel-target-list button", has_text="Member Channels").click()
        view_rule = permissions.locator(".permission-row", has_text="Voir les salons")
        view_rule.get_by_role("button", name="Hériter").click()
        with owner.expect_response(lambda response: "/permissions/member/" in response.url and response.request.method == "PUT") as restored:
            permissions.get_by_role("button", name="Enregistrer", exact=True).click()
        if restored.value.status != 200:
            raise AssertionError(f"restauration membre refusée: {restored.value.status}")

        permissions.locator(".channel-target-list button", has_text="@everyone").click()
        send_rule = permissions.locator(".permission-row", has_text="Envoyer des messages")
        send_rule.get_by_role("button", name="Hériter").click()
        permissions.get_by_role("button", name="Enregistrer", exact=True).click()

        member.reload()
        member.get_by_label("Atelier Salons").click()
        expect(member.locator(".chan", has_text="général")).to_be_visible(timeout=10000)
        member.locator(".chan", has_text="général").click()
        expect(member.get_by_label("Écrire dans #général")).to_be_visible(timeout=10000)

        owner_context.close()
        member_context.close()
        browser.close()

    if errors:
        raise AssertionError("\n".join(errors))
    result = json.dumps({
        "status": "passed",
        "checks": ["role-override", "composer-hidden", "send-denied", "member-override", "hidden-not-disclosed", "inherit-restored"],
    }, ensure_ascii=False)
    if os.environ.get("RESULT_PATH"):
        Path(os.environ["RESULT_PATH"]).write_text(result, encoding="utf-8")
    print(result, file=sys.stderr, flush=True)


if __name__ == "__main__":
    try:
        run()
    except BaseException as error:
        if os.environ.get("RESULT_PATH"):
            Path(os.environ["RESULT_PATH"]).write_text(json.dumps({
                "status": "failed",
                "error": repr(error),
            }, ensure_ascii=False), encoding="utf-8")
        raise
