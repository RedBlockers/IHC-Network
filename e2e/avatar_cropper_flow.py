import base64
import json
import os

from playwright.sync_api import expect, sync_playwright


PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAFElEQVR42mNk+M/wn4GBgYGJAQoAHgQCAW2k9XYAAAAASUVORK5CYII="
)


with sync_playwright() as playwright:
    run_id = os.environ.get("RUN_ID", "local")
    handle = f"crop{run_id}"[:20]
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(os.environ["BASE_URL"])
    page.wait_for_load_state("networkidle")
    page.get_by_role("link", name="Créer un compte").click()
    page.get_by_label("Adresse e-mail").fill(f"{handle}@example.test")
    page.locator('input[autocomplete="new-password"]').fill("correct-horse-battery-staple")
    page.get_by_role("button", name="Continuer").click()
    page.locator('input[type="file"]').set_input_files({"name": "wide.png", "mimeType": "image/png", "buffer": PNG})

    dialog = page.get_by_role("dialog", name="Recadrer la photo")
    expect(dialog).to_be_visible()
    stage = dialog.get_by_role("application")
    expect(stage).to_be_visible()
    stage.press("ArrowLeft")
    dialog.locator('input[type="range"]').fill("1.4")
    expect(dialog.get_by_text("140 %", exact=True)).to_be_visible()

    screenshot = os.environ.get("SCREENSHOT")
    if screenshot:
        page.screenshot(path=screenshot, full_page=True)

    dialog.get_by_role("button", name="Utiliser cette photo").click()
    expect(dialog).not_to_be_visible()
    expect(page.locator(".avatar-picker-img")).to_be_visible()
    if os.environ.get("SUBMIT") == "1":
        page.locator('input[autocomplete="username"]').fill(handle)
        page.get_by_placeholder("Ada Lovelace").fill("Crop Check")
        submit = page.get_by_role("button", name="Créer mon compte")
        expect(submit).to_be_enabled(timeout=10000)
        submit.click()
        expect(page.get_by_role("button", name="Créer une communauté")).to_be_visible(timeout=15000)
    print(json.dumps({"status": "passed", "cropper": True, "zoom": "140%", "handle": handle}))
    browser.close()
