import json
import os
import pathlib
import time
from datetime import datetime, timedelta, timezone

from playwright.sync_api import expect, sync_playwright
from core_flow import BASE_URL, register, image_file

TYPES = ['text', 'voice', 'video', 'stage', 'announcement', 'forum', 'support', 'review', 'design', 'development', 'meeting', 'incident', 'task', 'ticket', 'wiki', 'documentation', 'resources', 'faq', 'gallery', 'poll', 'event', 'gated', 'ephemeral', 'spoiler']
OUT = pathlib.Path(os.environ.get('ARTIFACT_DIR', '/tmp/qweillo-channel-types'))
OUT.mkdir(parents=True, exist_ok=True)


def run():
    checks = []
    errors = []
    def mark(value):
        checks.append(value)
        print(json.dumps({"passed": value}), flush=True)
    suffix = str(int(time.time()))[-7:]
    next_request = 0

    def pace_requests(route):
        nonlocal next_request
        delay = max(0, next_request - time.monotonic())
        if delay:
            time.sleep(delay)
        next_request = time.monotonic() + 0.065
        route.continue_()
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
        actors = []
        for prefix, name in [('owner', 'Camille'), ('member', 'Noé'), ('other', 'Inès')]:
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, permissions=['camera', 'microphone'])
            context.route('**/api/v1/**', pace_requests)
            page = context.new_page()
            actor = {'context': context, 'page': page, 'name': name}
            page.on('pageerror', lambda error: errors.append(str(error)))
            def capture(response, actor=actor):
                if response.url.endswith('/auth/register') and response.status == 201:
                    actor.update(response.json())
            page.on('response', capture)
            register(page, f'ct{prefix}{suffix}', name)
            actors.append(actor)
        owner, member, other = actors

        def api(actor, method, path, data=None, status=200):
            response = actor['page'].request.fetch(BASE_URL + '/api/v1' + path, method=method, data=data, headers={'Authorization': 'Bearer ' + actor['token']})
            assert response.status == status, (method, path, response.status, response.text()[:500])
            return response.json() if response.status != 204 else None

        guild = api(owner, 'POST', '/guilds', {'name': 'Atelier des salons'}, 201)['guild']
        gid = guild['guildId']
        invite = api(owner, 'POST', f'/guilds/{gid}/invites', {'expiresInHours': 24}, 201)
        code = invite.get('code') or invite.get('invite', {}).get('code')
        assert code, invite
        for actor in [member, other]:
            api(actor, 'POST', f'/invites/{code}/accept', {}, 200)
        for actor in actors:
            actor['page'].reload()
            actor['page'].get_by_role('button', name='Atelier des salons', exact=True).click()
        page = owner['page']
        channels = {}
        for kind in TYPES:
            page.get_by_role('button', name='Créer un salon dans').first.click()
            dialog = page.get_by_role('dialog', name='Créer un salon')
            if kind in ['text', 'voice', 'announcement']:
                dialog.locator(f'label.channel-type-row:has(input[value="{kind}"])').click()
            else:
                dialog.get_by_label('Autre type').select_option(kind)
            dialog.get_by_label('Nom du salon', exact=True).fill('atelier-' + kind)
            with page.expect_response(lambda response: response.request.method == 'POST' and response.url.endswith(f'/guilds/{gid}/channels')) as created:
                dialog.get_by_role('button', name='Créer le salon', exact=True).click()
            response = created.value
            assert response.status == 201, response.text()
            channels[kind] = response.json()['channel']
            expect(dialog).not_to_be_visible()
            page.wait_for_timeout(600)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), kind
        mark('create-all-24-channel-types')

        def select_channel(actor, kind):
            target = channels[kind]
            actor['page'].locator(f'button.chan[data-channel-id="{target["channelId"]}"]').click()
            expect(actor['page'].locator('.chat-head-name').filter(has_text=target['name']).or_(actor['page'].get_by_role('heading', name=target['name'], exact=True)).first).to_be_visible()
            return target['channelId']

        for kind in ['text', 'announcement', 'incident', 'ephemeral', 'spoiler']:
            cid = select_channel(owner, kind)
            page.get_by_label('Écrire dans #' + channels[kind]['name']).fill('Publication ' + kind)
            page.get_by_label('Envoyer le message').click()
            if kind == 'spoiler':
                expect(page.get_by_text('Publication spoiler', exact=True)).not_to_be_visible()
                page.get_by_role('button', name='Révéler le contenu avec spoilers').click()
            expect(page.get_by_text('Publication ' + kind, exact=True)).to_be_visible()
        mark('text-announcements-incident-ephemeral-spoiler')

        for kind, action in [('forum', 'Nouveau sujet'), ('support', 'Nouvelle question'), ('review', 'Nouvelle revue'), ('development', 'Nouveau sujet')]:
            cid = select_channel(owner, kind)
            page.get_by_role('button', name=action, exact=True).click()
            dialog = page.get_by_role('dialog', name=action)
            dialog.get_by_label('Titre du sujet').fill('Discussion ' + kind)
            dialog.get_by_label('Premier message').fill('Contexte de la discussion ' + kind)
            dialog.get_by_role('button', name='Publier le sujet').click()
            expect(page.get_by_role('heading', name='Discussion ' + kind, exact=True)).to_be_visible()
            page.get_by_label('Répondre au sujet').fill('Réponse conservée')
            page.get_by_role('button', name='Publier la réponse').click()
            expect(page.get_by_text('Réponse conservée', exact=True)).to_be_visible()
            page.get_by_role('button', name='Marquer résolu', exact=True).click()
            expect(page.get_by_role('button', name='Marquer non résolu', exact=True)).to_be_visible()
            assert page.locator('.composer').count() == 0
        mark('forum-support-review-development-topics')

        cid = select_channel(owner, 'ticket')
        select_channel(member, 'ticket')
        select_channel(other, 'ticket')
        client = member['page']
        client.get_by_role('button', name='Nouvelle demande', exact=True).click()
        dialog = client.get_by_role('dialog', name='Nouvelle demande')
        dialog.get_by_label('Objet de la demande').fill('Accès au dépôt')
        dialog.get_by_label('Votre demande', exact=True).fill('Je souhaite rejoindre le projet de la communauté.')
        dialog.get_by_label('Priorité de votre demande').select_option('high')
        dialog.get_by_role('button', name='Ouvrir la demande').click()
        expect(client.get_by_role('heading', name='Accès au dépôt', exact=True)).to_be_visible()
        assert len(api(owner, 'GET', f'/channels/{cid}/tickets')['tickets']) == 1
        page.get_by_role('button', name='Accès au dépôt').click()
        expect(page.get_by_role('heading', name='Accès au dépôt', exact=True)).to_be_visible()
        page.get_by_role('combobox', name='Responsable', exact=True).select_option(str(owner['user']['userId']))
        page.get_by_role('combobox', name='Priorité', exact=True).select_option('urgent')
        page.get_by_role('button', name='Note interne', exact=True).click()
        page.get_by_label('Note visible uniquement par l’équipe').fill('Information réservée à la modération.')
        page.get_by_role('button', name='Ajouter la note interne').click()
        expect(page.get_by_text('Information réservée à la modération.', exact=True)).to_be_visible()
        expect(client.get_by_text('Information réservée à la modération.', exact=True)).not_to_be_visible()
        assert api(other, 'GET', f'/channels/{cid}/tickets')['tickets'] == []
        page.get_by_role('button', name='Réponse au demandeur', exact=True).click()
        page.get_by_label('Votre réponse', exact=True).fill('L’accès est disponible. Vous pouvez réessayer.')
        page.get_by_role('button', name='Envoyer la réponse').click()
        expect(client.get_by_text('L’accès est disponible. Vous pouvez réessayer.', exact=True)).to_be_visible()
        page.get_by_label('Statut de la demande').select_option('resolved')
        with client.expect_download() as download:
            client.get_by_role('button', name='Exporter l’échange').click()
        assert 'Information réservée' not in pathlib.Path(download.value.path()).read_text()
        client.get_by_role('button', name='Fermer ma demande').click()
        expect(page.get_by_label('Statut de la demande')).to_have_value('closed')
        page.get_by_label('Statut de la demande').select_option('open')
        mark('ticket-private-notes-replies-assignment-priority-status-export')

        cid = select_channel(owner, 'task')
        page.get_by_role('button', name='Nouvelle tâche').click()
        dialog = page.get_by_role('dialog', name='Nouvelle tâche')
        dialog.get_by_label('Intitulé').fill('Préparer la démonstration')
        dialog.get_by_role('textbox', name='Description', exact=True).fill('Présenter les parcours de la communauté.')
        dialog.get_by_label('Responsable').select_option(str(member['user']['userId']))
        dialog.get_by_label('Échéance').fill((datetime.now() + timedelta(days=2)).strftime('%Y-%m-%dT%H:%M'))
        dialog.get_by_role('button', name='Créer la tâche').click()
        page.get_by_role('button', name='Préparer la démonstration', exact=True).click()
        dialog = page.get_by_role('dialog', name='Modifier la tâche')
        expect(dialog.get_by_role('textbox', name='Description', exact=True)).to_have_value('Présenter les parcours de la communauté.')
        dialog.get_by_label('État de la tâche').select_option('doing')
        dialog.get_by_role('button', name='Enregistrer', exact=True).click()
        expect(page.get_by_role('region', name='En cours').get_by_text('Préparer la démonstration', exact=True)).to_be_visible()
        mark('task-details-assignment-deadline-status')

        for kind, add, title_label, body_label in [('wiki', 'Nouvelle page', 'Titre de la page', 'Contenu'), ('documentation', 'Nouvelle section', 'Titre de la section', 'Documentation'), ('resources', 'Nouvelle fiche', 'Nom de la ressource', 'Présentation, liens et conseils'), ('faq', 'Nouvelle question', 'Question', 'Réponse')]:
            cid = select_channel(owner, kind)
            for number in [1, 2]:
                page.get_by_role('button', name=add, exact=True).first.click()
                page.get_by_label(title_label, exact=True).fill(f'Contenu {kind} {number}')
                page.get_by_role('textbox', name=body_label, exact=True).fill(f'Description enregistrée {number}')
                page.get_by_role('button', name='Enregistrer', exact=True).click()
                expect(page.get_by_role('heading', name=f'Contenu {kind} {number}', exact=True)).to_be_visible()
            assert len(api(owner, 'GET', f'/channels/{cid}/documents')['documents']) == 2
            page.get_by_role('button', name='Modifier', exact=True).click()
            page.get_by_role('textbox', name=body_label, exact=True).fill('Révision du contenu')
            page.get_by_label('Résumé de cette modification').fill('Précision utile')
            page.get_by_role('button', name='Enregistrer', exact=True).click()
            page.get_by_role('button', name='Historique', exact=True).click()
            page.get_by_role('button', name='Restaurer cette version', exact=True).last.click()
            expect(page.get_by_text('Description enregistrée 2', exact=True)).to_be_visible()
        mark('all-document-types-create-second-edit-history-restore')

        for kind, action, body_label in [('event', 'Proposer un événement', 'Description'), ('meeting', 'Planifier une réunion', 'Ordre du jour')]:
            cid = select_channel(owner, kind)
            page.get_by_role('button', name=action, exact=True).click()
            dialog = page.get_by_role('dialog', name=action)
            dialog.get_by_label('Titre', exact=True).fill('Rencontre ' + kind)
            dialog.get_by_label('Début', exact=True).fill((datetime.now() + timedelta(days=2)).strftime('%Y-%m-%dT%H:%M'))
            dialog.get_by_label('Fin', exact=True).fill((datetime.now() + timedelta(days=2, hours=1)).strftime('%Y-%m-%dT%H:%M'))
            dialog.get_by_role('textbox', name=body_label, exact=True).fill('Présentation de Qweillo')
            dialog.get_by_role('button', name='Proposer', exact=True).click()
            expect(page.get_by_text('Rencontre ' + kind, exact=True)).to_be_visible()
            page.get_by_role('button', name='Modifier', exact=True).click()
            dialog = page.get_by_role('dialog', name='Modifier les informations')
            dialog.get_by_label('Lieu ou lien de réunion').fill('Salon de la communauté')
            dialog.get_by_role('button', name='Enregistrer', exact=True).click()
            expect(page.get_by_text('Salon de la communauté', exact=True)).to_be_visible()
            select_channel(member, kind)
            member['page'].get_by_role('button', name='Je viens', exact=True).click()
            expect(page.get_by_text('2 présents', exact=True)).to_be_visible()
            with page.expect_download() as download:
                page.get_by_role('button', name='Ajouter au calendrier').click()
            assert 'BEGIN:VEVENT' in pathlib.Path(download.value.path()).read_text()
            assert page.locator('.composer').count() == 0
        mark('events-and-meetings-edit-rsvp-calendar')

        cid = select_channel(owner, 'poll')
        select_channel(member, 'poll')
        page.get_by_role('button', name='Créer un sondage').click()
        dialog = page.get_by_role('dialog', name='Nouveau sondage')
        dialog.get_by_label('Question', exact=True).fill('Quel jour pour la prochaine rencontre ?')
        dialog.get_by_placeholder('Réponse 1').fill('Vendredi')
        dialog.get_by_placeholder('Réponse 2').fill('Samedi')
        dialog.get_by_role('button', name='Créer le sondage', exact=True).click()
        expect(page.get_by_role('heading', name='Quel jour pour la prochaine rencontre ?', exact=True)).to_be_visible()
        member['page'].get_by_role('button', name='Vendredi').click()
        expect(page.locator('.poll-card footer')).to_contain_text('1 vote')
        page.get_by_role('button', name='Terminer le sondage').click()
        expect(member['page'].locator('.poll-card footer')).to_contain_text('terminé')
        mark('poll-publish-live-vote-close')

        for kind in ['gallery', 'design']:
            select_channel(owner, kind)
            page.locator('.composer input[type=file]').first.set_input_files(image_file(f'visuel-{kind}.png'))
            expect(page.locator('.composer-files')).to_contain_text(f'visuel-{kind}.png')
            page.get_by_label('Écrire dans #' + channels[kind]['name']).fill('Proposition visuelle')
            page.get_by_label('Envoyer le message').click()
            page.get_by_role('button', name=f'Voir visuel-{kind}.png').click()
            expect(page.get_by_role('dialog', name=f'visuel-{kind}.png')).to_be_visible()
            page.get_by_label('Fermer', exact=True).click()
        mark('gallery-and-design-upload-open')

        gate = channels['gated']['channelId']
        member['page'].locator(f'button.chan[data-channel-id="{gate}"]').click()
        expect(member['page'].get_by_role('button', name='Demander l’accès')).to_be_visible()
        member['page'].get_by_label('Pourquoi souhaitez-vous rejoindre ce salon ?').fill('Participer à la préparation du projet.')
        member['page'].get_by_role('button', name='Demander l’accès').click()
        select_channel(owner, 'gated')
        page.get_by_role('button', name='Gérer les accès').click()
        dialog = page.get_by_role('dialog', name='Accès au salon')
        dialog.get_by_role('button', name='Autoriser', exact=True).click()
        expect(member['page'].get_by_label('Écrire dans #' + channels['gated']['name'])).to_be_visible()
        dialog.get_by_role('button', name='Retirer l’accès', exact=True).click()
        expect(member['page'].get_by_role('button', name='Demander l’accès')).to_be_visible()
        page.get_by_label('Fermer', exact=True).click()
        mark('gated-request-approve-revoke-live')

        assert not errors, errors
        OUT.joinpath('result.json').write_text(json.dumps({'status': 'passed', 'checks': checks, 'guildId': gid, 'channelIds': channels}, ensure_ascii=False, indent=2))
        print(json.dumps({'status': 'passed', 'checks': checks}, ensure_ascii=False))
        if os.environ.get('KEEP_BROWSER_STATE') == '1':
            for index, actor in enumerate(actors):
                state = OUT / f'actor-{index}-state.json'
                actor['context'].storage_state(path=str(state))
                state.chmod(0o600)
        browser.close()


if __name__ == '__main__':
    run()
