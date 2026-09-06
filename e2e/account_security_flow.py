import hashlib
import hmac
import json
import os
import re
import struct
import time
import urllib.request
from base64 import b32decode

from playwright.sync_api import expect, sync_playwright
from core_flow import BASE_URL, PASSWORD, register

MAIL_URL = os.environ.get("MAIL_URL", "http://127.0.0.1:18025")


def message_link(email, subject, path):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        with urllib.request.urlopen(f"{MAIL_URL}/api/v1/messages", timeout=5) as response:
            messages = json.load(response)["messages"]
        for message in messages:
            if message["Subject"] == subject and any(recipient["Address"] == email for recipient in message["To"]):
                with urllib.request.urlopen(f"{MAIL_URL}/api/v1/message/{message['ID']}", timeout=5) as response:
                    text = json.load(response)["Text"]
                url = re.search(r"https?://\S+" + re.escape(path) + r"\?token=[A-Za-z0-9_-]+", text)
                if url:
                    assert url.group().startswith(BASE_URL), "Le courrier doit utiliser l’adresse de cette instance."
                    return url.group()
        time.sleep(0.2)
    raise AssertionError("Le courrier attendu n’est pas arrivé.")


def totp(secret, step):
    key = b32decode(secret + "=" * ((8 - len(secret) % 8) % 8))
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return f"{(struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000:06d}"


def sign_in(page, handle, password):
    page.get_by_label("Pseudo", exact=True).fill(handle)
    page.get_by_label("Mot de passe", exact=True).fill(password)
    page.get_by_role("button", name="Se connecter", exact=True).click()


def run():
    checks = []
    errors = []
    handle = f"securite{int(time.time()) % 10000000}"
    email = f"{handle}@example.test"
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        register(page, handle, "Camille Sécurité")
        verify_url = message_link(email, "Confirmez votre adresse", "/verify-email")
        page.goto(verify_url)
        page.get_by_role("button", name="Confirmer mon adresse").click()
        expect(page.get_by_role("heading", name="Adresse confirmée")).to_be_visible()
        assert "token=" not in page.url
        checks.append("email-verification")
        page.get_by_role("link", name="Retrouver mes communautés").click()
        page.get_by_label("Réglages du compte").click()
        page.get_by_role("button", name="Sécurité", exact=True).click()
        expect(page.get_by_text("Vérifiée", exact=True)).to_be_visible()
        page.get_by_role("button", name="Configurer la double authentification").click()
        secret = page.get_by_label("Clé de configuration").input_value()
        expect(page.get_by_alt_text("Code QR de configuration de la double authentification")).to_be_visible()
        valid_codes = {totp(secret, int(time.time()) // 30 + offset) for offset in (-1, 0, 1)}
        invalid = next(value for value in ("000000", "111111", "222222", "333333") if value not in valid_codes)
        page.get_by_label("Code à 6 chiffres").fill(invalid)
        page.get_by_role("button", name="Activer la double authentification").click()
        expect(page.get_by_role("alert")).to_contain_text("Code incorrect")
        expect(page.get_by_role("dialog", name="Paramètres du compte")).to_be_visible()
        page.get_by_label("Code à 6 chiffres").fill(totp(secret, int(time.time()) // 30 - 1))
        page.get_by_role("button", name="Activer la double authentification").click()
        expect(page.locator(".recovery-codes li")).to_have_count(10)
        codes = page.locator(".recovery-codes code").all_text_contents()
        with page.expect_download() as download:
            page.get_by_role("button", name="Télécharger les codes").click()
        assert handle in download.value.suggested_filename and download.value.suggested_filename.endswith("-codes.txt")
        with open(download.value.path()) as file:
            assert BASE_URL in file.read()
        checks.append("two-factor-setup-and-backup")
        page.get_by_label("Fermer", exact=True).click()
        page.get_by_label("Se déconnecter", exact=True).click()
        sign_in(page, handle, PASSWORD)
        page.get_by_label("Code de votre application").fill(totp(secret, int(time.time()) // 30))
        page.get_by_role("button", name="Se connecter", exact=True).click()
        expect(page.get_by_role("heading", name="Bonjour, Camille Sécurité")).to_be_visible()
        checks.append("two-factor-login")
        page.get_by_label("Se déconnecter", exact=True).click()
        sign_in(page, handle, PASSWORD)
        page.get_by_role("button", name="Utiliser un code de secours").click()
        page.get_by_label("Code de secours", exact=True).fill(codes[0])
        page.get_by_role("button", name="Se connecter", exact=True).click()
        expect(page.get_by_role("heading", name="Bonjour, Camille Sécurité")).to_be_visible()
        checks.append("recovery-code-login")
        stale_context = browser.new_context()
        stale_page = stale_context.new_page()
        stale_page.goto(f"{BASE_URL}/login")
        sign_in(stale_page, handle, PASSWORD)
        stale_page.get_by_role("button", name="Utiliser un code de secours").click()
        stale_page.get_by_label("Code de secours", exact=True).fill(codes[2])
        stale_page.get_by_role("button", name="Se connecter", exact=True).click()
        expect(stale_page.get_by_role("heading", name="Bonjour, Camille Sécurité")).to_be_visible()
        page.get_by_label("Se déconnecter", exact=True).click()
        page.get_by_role("link", name="Mot de passe oublié ?").click()
        page.get_by_label("Adresse e-mail").fill(email)
        page.get_by_role("button", name="Envoyer le lien").click()
        expect(page.get_by_role("heading", name="Consultez votre messagerie")).to_be_visible()
        reset_url = message_link(email, "Réinitialiser votre mot de passe", "/reset-password")
        page.goto(reset_url)
        replacement = "Une nouvelle phrase de passe 2026!"
        page.get_by_label("Nouveau mot de passe", exact=True).fill(replacement)
        page.get_by_label("Confirmer le mot de passe", exact=True).fill(replacement)
        page.get_by_role("button", name="Enregistrer le mot de passe").click()
        expect(page.get_by_role("heading", name="Mot de passe enregistré")).to_be_visible()
        session = stale_context.request.post(f"{BASE_URL}/api/v1/auth/session")
        assert session.status == 401, "La session précédente doit être révoquée."
        page.get_by_role("link", name="Se connecter", exact=True).click()
        sign_in(page, handle, replacement)
        page.get_by_role("button", name="Utiliser un code de secours").click()
        page.get_by_label("Code de secours", exact=True).fill(codes[1])
        page.get_by_role("button", name="Se connecter", exact=True).click()
        expect(page.get_by_role("heading", name="Bonjour, Camille Sécurité")).to_be_visible()
        checks.append("password-reset-and-new-login")
        page.goto(reset_url)
        page.get_by_label("Nouveau mot de passe", exact=True).fill(replacement + " autre")
        page.get_by_label("Confirmer le mot de passe", exact=True).fill(replacement + " autre")
        page.get_by_role("button", name="Enregistrer le mot de passe").click()
        expect(page.get_by_role("alert")).to_contain_text("Ce lien n'est plus valable")
        checks.append("reset-token-single-use")
        stale_context.close()
        browser.close()
    assert not errors, errors
    print(json.dumps({"status": "passed", "checks": checks}, ensure_ascii=False))


if __name__ == "__main__":
    run()
