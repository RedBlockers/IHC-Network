import json
import time

from playwright.sync_api import expect, sync_playwright
from account_security_flow import sign_in
from core_flow import BASE_URL, PASSWORD, register


def run():
    checks = []
    suffix = str(int(time.time()) % 10000000)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch()
        first = browser.new_context(viewport={"width": 1440, "height": 1000})
        second = browser.new_context(viewport={"width": 1440, "height": 1000})
        alice = first.new_page()
        bob = second.new_page()
        register(alice, f"ownera{suffix}", "Alice Propriété")
        register(bob, f"ownerb{suffix}", "Bob Propriété")
        alice.get_by_role("button", name="Créer une communauté").click()
        create = alice.get_by_role("dialog", name="Créer un serveur")
        create.get_by_label("Nom du serveur").fill("Atelier partagé")
        create.get_by_role("button", name="Créer", exact=True).click()
        alice.get_by_label("Inviter des gens").click()
        invite = alice.get_by_role("dialog", name="Inviter des amis sur Atelier partagé")
        invite.get_by_role("button", name="Générer un lien").click()
        address = invite.locator("#invite-link-output").input_value()
        invite.get_by_role("button", name="Terminé").click()
        bob.get_by_role("button", name="Rejoindre avec un lien").click()
        join = bob.get_by_role("dialog", name="Rejoindre un serveur")
        join.get_by_label("Lien d’invitation").fill(address)
        join.get_by_role("button", name="Rejoindre", exact=True).click()
        expect(bob.get_by_text("Atelier partagé", exact=True).first).to_be_visible()
        alice.get_by_label("Réglages du compte").click()
        alice.get_by_role("button", name="Données personnelles").click()
        expect(alice.get_by_text("Transférez ou supprimez d’abord", exact=False)).to_be_visible()
        alice.get_by_label("Fermer", exact=True).click()
        checks.append("owned-community-protected")
        alice.get_by_label("Réglages du serveur").click()
        alice.get_by_role("button", name="Propriété", exact=True).click()
        alice.get_by_label("Nouveau propriétaire", exact=True).select_option(label=f"Bob Propriété · @ownerb{suffix}")
        alice.get_by_label("Nom de la communauté pour confirmer le transfert").fill("Atelier partagé")
        alice.get_by_role("button", name="Transférer la propriété").click()
        expect(alice.get_by_role("dialog", name="Administration du serveur")).not_to_be_visible()
        bob.get_by_label("Réglages du serveur").click()
        bob.get_by_role("button", name="Propriété", exact=True).click()
        checks.append("ownership-transfer")
        bob.get_by_label("Nom de la communauté pour confirmer la suppression").fill("Atelier partagé")
        bob.get_by_role("button", name="Supprimer définitivement la communauté").click()
        expect(bob.get_by_role("heading", name="Bonjour, Bob Propriété")).to_be_visible()
        expect(alice.get_by_role("heading", name="Bonjour, Alice Propriété")).to_be_visible()
        checks.append("community-deletion-realtime")
        bob.get_by_label("Réglages du compte").click()
        bob.get_by_role("button", name="Données personnelles").click()
        with bob.expect_download() as download:
            bob.get_by_role("button", name="Télécharger mes données").click()
        with open(download.value.path()) as file:
            exported = json.load(file)
        assert exported["account"]["handle"] == f"ownerb{suffix}"
        assert "password" not in exported["account"]
        checks.append("account-export")
        bob.get_by_role("button", name="Demander la suppression").click()
        bob.get_by_label("Votre mot de passe", exact=True).fill(PASSWORD)
        bob.get_by_role("button", name="Confirmer la demande de suppression").click()
        expect(bob.get_by_role("status").filter(has_text="Suppression demandée")).to_be_visible()
        sign_in(bob, f"ownerb{suffix}", PASSWORD)
        expect(bob.get_by_role("heading", name="Bonjour, Bob Propriété")).to_be_visible()
        bob.get_by_label("Réglages du compte").click()
        bob.get_by_role("button", name="Données personnelles").click()
        bob.get_by_role("button", name="Demander la suppression").click()
        bob.get_by_label("Votre mot de passe", exact=True).fill(PASSWORD)
        bob.get_by_role("button", name="Confirmer la demande de suppression").click()
        expect(bob.get_by_role("status").filter(has_text="Suppression demandée")).to_be_visible()
        checks.append("deletion-cancelled-by-login")
        browser.close()
    print(json.dumps({"status": "passed", "checks": checks}, ensure_ascii=False))


if __name__ == "__main__":
    run()
