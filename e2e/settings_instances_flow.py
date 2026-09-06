import json
import os
import time
from base64 import b64decode

from playwright.sync_api import expect, sync_playwright
from core_flow import BASE_URL, register


def run():
    checks = []
    errors = []
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        context = browser.new_context(viewport={"width": 1440, "height": 960}, permissions=["camera"])
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        register(page, f"rubriques{int(time.time()) % 10000000}", "Camille Menus")
        page.get_by_label("Réglages du compte").click()
        field = page.get_by_label("Nom affiché", exact=True)
        field.focus()
        field.press("End")
        field.press_sequentially(" Test")
        expect(field).to_have_value("Camille Menus Test")
        expect(field).to_be_focused()
        page.get_by_label("Fermer", exact=True).click()
        discard = page.get_by_role("alertdialog", name="Modifications non enregistrées")
        expect(discard).to_be_visible()
        page.keyboard.press("Escape")
        expect(discard).not_to_be_visible()
        expect(page.get_by_role("dialog", name="Paramètres du compte")).to_be_visible()
        page.get_by_role("button", name="Réinitialiser", exact=True).click()
        checks.append("typing-focus")
        page.set_viewport_size({"width": 390, "height": 844})
        page.get_by_role("button", name="Choisir une rubrique").click()
        page.get_by_role("button", name="Sécurité", exact=True).click()
        expect(page.get_by_role("heading", name="Adresse e-mail", exact=True)).to_be_visible()
        page.get_by_role("button", name="Choisir une rubrique").click()
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog", name="Paramètres du compte")).to_be_visible()
        expect(page.get_by_role("button", name="Choisir une rubrique")).to_have_attribute("aria-expanded", "false")
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog", name="Paramètres du compte")).not_to_be_visible()
        checks.append("mobile-navigation-and-escape")
        profile = page.get_by_role("navigation", name="Navigation principale").get_by_role("button", name="Profil")
        profile.click()
        page.get_by_label("Nom affiché", exact=True).fill("Nom non enregistré")
        page.get_by_label("Fermer", exact=True).click()
        page.get_by_role("button", name="Fermer sans enregistrer").click()
        expect(profile).to_be_focused()
        checks.append("nested-dialog-focus-return")
        page.get_by_label("Changer d’instance").click()
        dialog = page.get_by_role("dialog", name="Vos instances")
        qr = dialog.locator(".qr-code")
        expect(qr).to_be_visible()
        dialog.get_by_role("button", name="Scanner un code QR").click()
        page.wait_for_function("document.querySelector('.instance-scanner')?.readyState >= 2")
        page.evaluate("window.qrCameraTracks = document.querySelector('.instance-scanner').srcObject.getTracks()")
        dialog.get_by_role("button", name="Arrêter la caméra").click()
        page.wait_for_function("window.qrCameraTracks.every(track => track.readyState === 'ended')")
        checks.append("qr-camera-stopped")
        png = b64decode(qr.get_attribute("src").split(",", 1)[1])
        dialog.get_by_label("Lire une image QR").set_input_files({"name": "instance.png", "mimeType": "image/png", "buffer": png})
        expect(dialog.get_by_label("Rejoindre une autre instance")).to_have_value(BASE_URL)
        expect(dialog.get_by_role("status")).to_contain_text("Adresse reconnue")
        checks.append("qr-image-read")
        address = dialog.get_by_label("Rejoindre une autre instance")
        address.fill("javascript:alert(1)")
        dialog.get_by_role("button", name="Ouvrir l’instance").click()
        expect(dialog.get_by_role("alert")).to_be_visible()
        assert page.url.startswith(BASE_URL)
        checks.append("unsafe-instance-rejected")
        second = os.environ.get("SECOND_BASE_URL")
        if second:
            address.fill(second)
            dialog.get_by_role("button", name="Ouvrir l’instance").click()
            expect(page).to_have_url(second + "/login")
            expect(page.get_by_role("heading", name="Ravi de vous revoir")).to_be_visible()
            checks.append("independent-instance-navigation")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Débordement horizontal sur mobile"
        browser.close()
    assert not errors, errors
    print(json.dumps({"status": "passed", "checks": checks}, ensure_ascii=False))


if __name__ == "__main__":
    run()
