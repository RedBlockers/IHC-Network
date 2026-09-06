import json
import os
import time

from playwright.sync_api import expect, sync_playwright

from core_flow import BASE_URL, register


def run():
    suffix = os.environ.get("RUN_ID", str(int(time.time()))[-5:])
    alice_handle = f"ralice{suffix}"
    bob_handle = f"rbob{suffix}"
    errors = []

    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        alice_context = browser.new_context(viewport={"width": 1600, "height": 1000})
        bob_context = browser.new_context(viewport={"width": 1440, "height": 900})
        alice = alice_context.new_page()
        bob = bob_context.new_page()
        for name, page in (("alice", alice), ("bob", bob)):
            page.on("pageerror", lambda error, n=name: errors.append(f"{n}:pageerror:{error}"))
            page.on("console", lambda message, n=name: errors.append(f"{n}:console:{message.text}") if message.type == "error" else None)

        register(alice, alice_handle, "Alice Roles")
        register(bob, bob_handle, "Bob Roles")

        alice.get_by_role("button", name="Créer une communauté").click()
        create = alice.get_by_role("dialog", name="Créer un serveur")
        create.get_by_label("Nom du serveur").fill("Atelier Permissions")
        create.get_by_role("button", name="Créer", exact=True).click()
        expect(alice.get_by_text("Atelier Permissions", exact=True).first).to_be_visible(timeout=15000)

        alice.get_by_label("Inviter des gens").click()
        invite = alice.get_by_role("dialog", name="Inviter des amis sur Atelier Permissions")
        invite.get_by_role("button", name="Générer un lien").click()
        invite_url = invite.locator("#invite-link-output").input_value()
        invite.get_by_role("button", name="Terminé").click()

        bob.get_by_role("button", name="Rejoindre avec un lien").click()
        join = bob.get_by_role("dialog", name="Rejoindre un serveur")
        join.get_by_label("Lien d’invitation").fill(invite_url)
        join.get_by_role("button", name="Rejoindre", exact=True).click()
        expect(bob.get_by_text("Atelier Permissions", exact=True).first).to_be_visible(timeout=15000)

        expect(bob.locator(".command-notifications span")).to_have_count(0)

        alice.get_by_label("Réglages du serveur").click()
        admin = alice.get_by_role("dialog", name="Administration du serveur")
        admin.get_by_role("button", name="Rôles & permissions").click()
        expect(admin.get_by_text("Rôles ·", exact=False)).to_be_visible(timeout=10000)
        admin.get_by_role("button", name="+ Vierge", exact=True).click()
        role_name = admin.locator(".role-name input")
        role_name.click()
        role_name.press("ControlOrMeta+A")
        role_name.press_sequentially("Relecteurs")
        role_emoji = admin.locator(".role-emoji input")
        role_emoji.click()
        role_emoji.press("ControlOrMeta+A")
        role_emoji.press_sequentially("🔎")
        admin.locator('.role-color-input input[type="color"]').fill("#4c7df0")
        permission = admin.locator(".permission-row", has_text="Gérer les messages")
        permission.get_by_role("button", name="Autoriser").click()
        expect(admin.locator(".role-name input")).to_have_value("Relecteurs")
        expect(admin.locator(".role-emoji input")).to_have_value("🔎")
        with alice.expect_response(lambda response: "/roles/" in response.url and response.request.method == "PATCH") as saved:
            admin.get_by_role("button", name="Enregistrer", exact=True).click()
        if saved.value.status != 200:
            raise AssertionError(f"édition du rôle refusée: {saved.value.status}")
        payload = saved.value.request.post_data_json
        if payload.get("name") != "Relecteurs" or payload.get("iconEmoji") != "🔎":
            raise AssertionError(f"brouillon de rôle incohérent: {payload}")
        expect(admin.get_by_text("Toutes les modifications sont enregistrées", exact=True)).to_be_visible(timeout=10000)

        admin.get_by_role("button", name="Membres ·", exact=False).click()
        bob_member = admin.locator(".role-members label", has_text="Bob Roles")
        expect(bob_member).to_be_visible()
        bob_member.locator('input[type="checkbox"]').check()
        expect(admin.get_by_role("button", name="Membres · 1")).to_be_visible(timeout=10000)

        artifact = os.environ.get("ARTIFACT_PATH")
        if artifact:
            admin.screenshot(path=artifact)
        admin.get_by_role("button", name="Fermer").click()
        alice.reload()
        alice.get_by_label("Atelier Permissions").click()
        expect(alice.get_by_text("🔎 Relecteurs", exact=False)).to_be_visible(timeout=10000)

        alice.locator(".chan", has_text="général").click()
        bob.locator(".chan", has_text="général").click()

        bob.evaluate(
            """
            window.__badgeTrace = [];
            let last = null;
            setInterval(() => {
                const value = document.querySelector(".command-notifications span")?.textContent ?? "0";
                if (value !== last) {
                    window.__badgeTrace.push(`${Math.round(performance.now() / 100) / 10}s:${value}`);
                    last = value;
                }
            }, 100);
            """
        )

        content = f"Salut @{bob_handle} **revue prête** [lien](javascript:alert(1)) <img src=x onerror=alert(2)>"
        alice.get_by_label("Écrire dans #général").fill(content)
        alice.get_by_label("Envoyer le message").click()
        expect(bob.get_by_text("revue prête", exact=True)).to_be_visible(timeout=10000)
        unsafe_link = bob.get_by_role("link", name="lien")
        if unsafe_link.count() and (unsafe_link.get_attribute("href") or "").lower().startswith("javascript:"):
            raise AssertionError("le Markdown a conservé une URL javascript")
        if bob.locator('.msg-text img[src="x"]').count():
            raise AssertionError("le Markdown a injecté un élément HTML brut")

        try:
            expect(bob.locator(".command-notifications span")).to_have_text("1", timeout=10000)
            bob.locator(".command-notifications").click()
            notification = bob.locator(".notification-item", has_text="Alice Roles")
            expect(notification).to_be_visible()
            notification.click()
            expect(bob.get_by_text("revue prête", exact=True)).to_be_visible()

            alice.get_by_label("Écrire dans #général").fill("Annonce de groupe @everyone")
            alice.get_by_label("Envoyer le message").click()
            expect(bob.get_by_text("@everyone", exact=True)).to_be_visible(timeout=10000)
            expect(bob.locator(".command-notifications span")).to_have_text("1", timeout=10000)
        except AssertionError as error:
            trace = bob.evaluate("window.__badgeTrace")
            seen = " | ".join(errors) or "aucune erreur navigateur"
            raise AssertionError(f"{error} — trace pastille: {trace} — {seen}")
        bob.locator(".command-notifications").click()
        everyone_notification = bob.locator(".notification-item.is-unread", has_text="Alice Roles")
        expect(everyone_notification).to_be_visible()
        bob.get_by_role("button", name="Tout marquer comme lu").click()
        bob.locator(".notification-center").get_by_role("button", name="Fermer", exact=True).click()
        expect(bob.locator(".command-notifications span")).to_have_count(0)

        alice.get_by_label("Écrire dans #général").fill("Ping des présents @here")
        alice.get_by_label("Envoyer le message").click()
        expect(bob.locator(".mention-pulse", has_text="Alice Roles")).to_be_visible(timeout=10000)
        expect(bob.locator(".command-notifications span")).to_have_count(0)

        bob.get_by_label("Réglages").first.click()
        settings = bob.get_by_role("dialog", name="Paramètres du compte")
        settings.get_by_label("Activité").fill("Relit la branche principale")
        settings.get_by_label("Biographie").fill("Relecteur technique")
        settings.get_by_label("Statut").select_option("dnd")
        settings.get_by_role("button", name="Enregistrer le profil").click()
        expect(alice.get_by_text("Relit la branche principale", exact=True)).to_be_visible(timeout=10000)

        alice_context.close()
        bob_context.close()
        browser.close()

    if errors:
        raise AssertionError("\n".join(errors))
    print(json.dumps({
        "status": "passed",
        "checks": ["role-create", "role-permission", "role-assign", "markdown-sanitize", "mention-notification", "everyone-notification", "here-ephemeral", "profile-realtime"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    run()
