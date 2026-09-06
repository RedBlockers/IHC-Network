import json
import os
from pathlib import Path
import time

from playwright.sync_api import Error as PlaywrightError, expect, sync_playwright

from core_flow import register, image_file

OUT = Path(os.environ.get('ARTIFACT_DIR', '/tmp/qweillo-attachment-composer'))
OUT.mkdir(parents=True, exist_ok=True)


def run():
    checks = []
    requests = []
    pending = []
    settled = set()
    errors = []
    suffix = os.environ.get('RUN_ID', str(int(time.time()))[-8:])
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.add_init_script('''
            window.attachmentAbortCount = 0;
            const open = XMLHttpRequest.prototype.open;
            const abort = XMLHttpRequest.prototype.abort;
            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this.attachmentTestUrl = String(url);
                return open.call(this, method, url, ...rest);
            };
            XMLHttpRequest.prototype.abort = function(...args) {
                if (/\\/attachments$/.test(this.attachmentTestUrl || '')) window.attachmentAbortCount++;
                return abort.apply(this, args);
            };
        ''')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))

        def hold_upload(route):
            if route.request.method == 'POST':
                pending.append(route)
            else:
                route.continue_()

        def observe_message(request):
            if request.method == 'POST' and request.url.endswith('/messages'):
                requests.append(json.loads(request.post_data or '{}'))

        page.route('**/api/v1/channels/*/attachments', hold_upload)
        page.on('request', observe_message)

        def wait_upload(index):
            deadline = time.monotonic() + 10
            while len(pending) <= index and time.monotonic() < deadline:
                page.wait_for_timeout(25)
            assert len(pending) > index, f'Upload {index + 1} non démarré'
            return pending[index]

        try:
            register(page, 'attach' + suffix, 'Mina Fichiers')
            page.get_by_role('button', name='Créer une communauté').click()
            dialog = page.get_by_role('dialog', name='Créer un serveur')
            dialog.get_by_label('Nom du serveur').fill('Atelier des pièces jointes')
            dialog.get_by_role('button', name='Créer', exact=True).click()
            page.get_by_role('button', name='Créer un salon dans').first.click()
            dialog = page.get_by_role('dialog', name='Créer un salon')
            dialog.get_by_label('Nom du salon').fill('autre-salon')
            dialog.get_by_role('button', name='Créer le salon', exact=True).click()
            expect(dialog).not_to_be_visible()
            page.locator('.chan', has_text='général').click()

            editor = page.get_by_label('Écrire dans #général')
            send = page.get_by_label('Envoyer le message')
            text = 'Ces deux images doivent partir ensemble.'
            editor.fill(text)
            file_input = page.locator('.composer input[type=file]:not([webkitdirectory])')
            file_input.set_input_files([image_file('premiere.png'), image_file('seconde.png')])
            first = wait_upload(0)
            send.evaluate('(button) => button.click()')
            editor.press('Enter')
            page.wait_for_timeout(200)
            assert not requests, f'Message envoyé avant les fichiers : {requests}'
            expect(send).to_be_disabled()
            expect(editor).to_have_value(text)
            expect(page.locator('.composer-files .is-uploading')).to_have_count(2)
            checks.append('whole-batch-queued-before-upload')
            checks.append('click-and-enter-blocked-during-first-upload')

            first.continue_()
            settled.add(first)
            second = wait_upload(1)
            expect(page.get_by_role('button', name='Retirer premiere.png')).to_be_visible()
            expect(page.locator('.composer-files .is-uploading')).to_have_count(1)
            send.evaluate('(button) => button.click()')
            editor.press('Enter')
            page.wait_for_timeout(200)
            assert not requests, f'Envoi partiel entre deux fichiers : {requests}'
            expect(send).to_be_disabled()
            expect(editor).to_have_value(text)
            checks.append('click-and-enter-blocked-between-files')

            second.continue_()
            settled.add(second)
            expect(page.locator('.composer-files .is-uploading')).to_have_count(0, timeout=15000)
            expect(page.get_by_role('button', name='Retirer seconde.png')).to_be_visible()
            expect(send).to_be_enabled()
            page.locator('.composer').screenshot(path=str(OUT / 'complete-batch.png'))
            with page.expect_response(lambda response: response.request.method == 'POST' and response.url.endswith('/messages')) as posted:
                send.click()
            assert posted.value.status == 201, posted.value.status
            message = posted.value.json()['message']
            assert len(requests) == 1 and len(set(requests[0].get('attachmentIds', []))) == 2, requests
            assert {attachment['name'] for attachment in message['attachments']} == {'premiere.png', 'seconde.png'}
            expect(page.locator('.composer-files')).to_have_count(0)
            expect(editor).to_have_value('')
            checks.append('all-attachments-preserved-in-single-message')

            file_input.set_input_files([image_file('annuler-premiere.png'), image_file('annuler-seconde.png')])
            wait_upload(2)
            page.locator('.chan', has_text='autre-salon').click()
            page.wait_for_function('window.attachmentAbortCount > 0')
            page.wait_for_timeout(200)
            assert len(pending) == 3, 'Un fichier en attente a démarré après le changement de salon'
            expect(page.locator('.composer-files')).to_have_count(0)
            other = page.get_by_label('Écrire dans #autre-salon')
            other.fill('Le nouveau salon reste utilisable.')
            with page.expect_response(lambda response: response.request.method == 'POST' and response.url.endswith('/messages')) as posted:
                page.get_by_label('Envoyer le message').click()
            assert posted.value.status == 201, posted.value.status
            assert requests[-1].get('attachmentIds', []) == []
            checks.append('channel-change-aborts-upload-and-queued-files')
            checks.append('next-channel-remains-usable')
            assert not errors, errors
            result = {'status': 'passed', 'checks': checks}
            (OUT / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps(result, ensure_ascii=False))
        except BaseException as error:
            page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
            (OUT / 'result.json').write_text(json.dumps({'status': 'failed', 'checks': checks, 'error': str(error)}, ensure_ascii=False, indent=2) + '\n')
            raise
        finally:
            for route in pending:
                if route not in settled:
                    try:
                        route.abort('aborted')
                    except PlaywrightError:
                        pass
            page.unroute_all(behavior='ignoreErrors')
            context.close()
            browser.close()


if __name__ == '__main__':
    run()
