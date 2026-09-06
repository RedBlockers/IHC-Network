import hashlib
import json
import os
import pathlib
import pty
import select
import shutil
import subprocess
import tempfile
import time

SOURCE = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('ARTIFACT_DIR', '/tmp/qweillo-installer-check'))
OUT.mkdir(parents=True, exist_ok=True)


def fixture(root):
    for relative in ['qweillo', 'scripts/setup.sh', 'scripts/setup.mjs', 'scripts/terminal.mjs', 'infra/livekit/livekit.local.yaml.template']:
        destination = root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SOURCE / relative, destination)
        destination.chmod(0o755)


def session(root, steps, expected=0, arguments=None):
    master, slave = pty.openpty()
    process = subprocess.Popen(['node', str(root / 'scripts/setup.mjs'), *(arguments or [])], stdin=slave, stdout=slave, stderr=slave, cwd=root, close_fds=True)
    os.close(slave)
    output = b''
    pending = list(steps)
    marker = 0
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        ready, _, _ = select.select([master], [], [], .15)
        if ready:
            try:
                block = os.read(master, 65536)
                if not block:
                    break
                output += block
            except OSError:
                break
        if pending:
            wanted, answer = pending[0]
            if wanted.encode() in output[marker:]:
                os.write(master, answer.encode())
                marker = len(output)
                pending.pop(0)
        if process.poll() is not None:
            break
    if process.poll() is None:
        process.kill()
    code = process.wait()
    os.close(master)
    assert not pending, [entry[0] for entry in pending]
    assert code == expected, (code, output.decode(errors='replace')[-1500:])
    return output.decode(errors='replace')


def command(root, arguments, expected=0):
    result = subprocess.run(['node', str(root / 'scripts/setup.mjs'), *arguments], cwd=root, capture_output=True, text=True, timeout=15)
    assert result.returncode == expected, (result.returncode, result.stderr)
    return result


with tempfile.TemporaryDirectory(prefix='qweillo-terminal-') as folder:
    root = pathlib.Path(folder)
    fixture(root)
    log = session(root, [('Nom de votre instance', 'Atelier Qweillo\r'), ('Où voulez-vous', '\r'), ('Port de l’instance', '19191\r'), ('Lancer l’installation', '\r')])
    assert (root / '.env').stat().st_mode & 0o777 == 0o600
    before = hashlib.sha256((root / '.env').read_bytes()).hexdigest()
    assert (root / '.runtime/action').read_text() == 'start'
    assert (root / '.runtime/start-url').read_text() == 'http://localhost:19191'
    log += session(root, [('Que souhaitez-vous faire', '\x1b[B\r')])
    assert (root / '.runtime/action').read_text() == 'status'
    assert hashlib.sha256((root / '.env').read_bytes()).hexdigest() == before
    log += session(root, [('Que souhaitez-vous faire', '\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\r'), ('Arrêter cette instance', '\r')])
    assert (root / '.runtime/action').read_text() == 'exit'
    assert hashlib.sha256((root / '.env').read_bytes()).hexdigest() == before
    secret = ' SMTP-test-$phrase-"confidentielle"\\! '
    email_log = session(root, [('Que souhaitez-vous faire', '\x1b[B\x1b[B\x1b[B\r'), ('Serveur SMTP', 'smtp.example.test\r'), ('Connexion au serveur', '\x1b[B\x1b[B\x1b[B\r'), ('Port SMTP', '2525\r'), ('Identifiant SMTP', 'mailer\r'), ('Mot de passe SMTP', secret+'\r'), ('Adresse d’expédition', 'contact@example.test\r')])
    assert secret not in email_log
    env = (root / '.env').read_text()
    assert 'smtp.example.test' in env and '2525' in env
    password_line = next(line for line in env.splitlines() if line.startswith('SMTP_PASSWORD='))
    assert json.loads(password_line.split('=', 1)[1]).replace('$$', '$') == secret
    assert (root / '.runtime/action').read_text() == 'start'
    assert list((root / '.runtime').glob('config-*.env'))
    log += email_log
    kept_log = session(root, [('Que souhaitez-vous faire', '4\r'), ('Serveur SMTP', '\r'), ('Connexion au serveur', '\r'), ('Port SMTP', '\r'), ('Identifiant SMTP', '\r'), ('Mot de passe SMTP', '\r'), ('Adresse d’expédition', '\r')])
    assert password_line in (root / '.env').read_text().splitlines()
    assert secret not in kept_log
    log += kept_log
    before = (root / '.env').read_bytes()
    session(root, [], arguments=['--name', 'Atelier "$communauté" \\ locale'])
    assert password_line in (root / '.env').read_text().splitlines()
    assert (root / '.runtime/start-url').read_text() == 'http://localhost:19191'
    named_log = session(root, [('Que souhaitez-vous faire', '7\r')])
    assert 'Atelier "$communauté" \\ locale' in named_log
    before = (root / '.env').read_bytes()
    session(root, [('Que souhaitez-vous faire', '4\r'), ('Serveur SMTP', 'smtp.other.test\r'), ('Connexion au serveur', '\x1b')], expected=130)
    assert (root / '.env').read_bytes() == before
    command(root, ['--external-proxy'], expected=1)
    command(root, ['--action', 'status', '--name', 'Changement'], expected=1)
    command(root, ['--name', '   '], expected=1)
    assert (root / '.env').read_bytes() == before
    (root / '.env').chmod(0o644)
    command(root, ['--yes'])
    assert (root / '.env').stat().st_mode & 0o777 == 0o600
    assert (root / '.env').read_bytes() == before
    OUT.joinpath('terminal-session.ansi').write_text(log)
with tempfile.TemporaryDirectory(prefix='qweillo-terminal-cancel-') as folder:
    root = pathlib.Path(folder)
    fixture(root)
    session(root, [('Nom de votre instance', '\x1b')], expected=130)
    assert not (root / '.env').exists()
    command(root, ['--yes', '--url', 'http://localhost:0'], expected=1)
    command(root, ['--yes', '--url', 'http://localhost:19292', '--external-proxy'], expected=1)
    command(root, ['--yes', '--action', 'backup'], expected=1)
    result = command(root, ['--action', 'unknown'], expected=1)
    assert 'Action inconnue' in result.stderr and ' at ' not in result.stderr
    result = command(root, ['--unknown'], expected=1)
    assert '--help' in result.stderr and ' at ' not in result.stderr
    assert not (root / '.env').exists()
    session(root, [('Nom de votre instance', '\r'), ('Où voulez-vous', '\r'), ('Port de l’instance', '0\r'), ('Choisissez un port', '\x15'+'19292\r'), ('Lancer l’installation', '\x1b[B\r')], expected=130)
    assert not (root / '.env').exists()
    result = subprocess.run([str(root / 'qweillo'), '--yes', '--help'], cwd=root, capture_output=True, text=True, timeout=15)
    assert result.returncode == 0 and 'Usage' in result.stdout
    assert not (root / '.env').exists()
with tempfile.TemporaryDirectory(prefix='qweillo-terminal-internet-') as folder:
    root = pathlib.Path(folder)
    fixture(root)
    command(root, ['--yes', '--url', 'https://chat.example.test', '--media-domain', 'chat.example.test', '--node-ip', '192.0.2.10'], expected=1)
    assert not (root / '.env').exists()
    session(root, [('Nom de votre instance', '\r'), ('Domaine de l’application', 'chat.example.test\r'), ('Domaine du vocal', 'media.example.test\r'), ('Lancer l’installation', '\r')], arguments=['--external-proxy', '--node-ip', '192.0.2.10'])
    assert (root / '.runtime/start-mode').read_text() == 'production'
    assert (root / '.runtime/start-proxy').read_text() == 'external'
    before = (root / '.env').read_bytes()
    command(root, ['--yes', '--local-only'], expected=1)
    command(root, ['--node-ip', '192.0.2.11'], expected=1)
    command(root, ['--yes', '--external-proxy', '--node-ip', '192.0.2.10'])
    assert (root / '.env').read_bytes() == before
print(json.dumps({'status':'passed','checks':['terminal-arrow-selection','fresh-config','protected-secrets','existing-status-preserves-env','stop-can-be-cancelled','escape-does-not-install','smtp-custom-port','masked-password','config-change-backup','smtp-special-characters-preserved','smtp-edit-cancellation','explicit-options-skip-management-menu','special-instance-name-roundtrip','invalid-options-preserve-config','invalid-port-retry','final-cancellation','help-any-argument-position','external-proxy-option','internet-profile-preserved','unknown-option-diagnostics','existing-permissions-repaired']}))
