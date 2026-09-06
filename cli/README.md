# CLI qweillo

Relie un dépôt Git local à un salon de développement. Le serveur ne fait que
stocker ce que la CLI lui envoie : il n'exécute jamais Git lui-même.

```sh
npm install -g ./cli            # depuis la racine du dépôt
qweillo login --url https://app.exemple.tld --token qwp_…
```

Le jeton se crée dans l'application : Paramètres du compte › Sécurité ›
Jetons d'accès. L'identifiant du salon apparaît dans le tableau des worktrees
(bouton « Connecter la CLI »).

```sh
qweillo worktree push --channel 42 --name feature-login --watch
qweillo worktree pipeline --channel 42 --name feature-login --pipeline tests --status passed --log "128 tests, 0 échec"
qweillo worktree review --channel 42 --name feature-login --title "Connexion par clé"
qweillo worktree decide --channel 42 --name feature-login --title "Argon2" --body "On garde argon2id, bcrypt part."
qweillo worktree cursor --channel 42 --name feature-login --file src/auth.js --line 120
qweillo worktree terminal --channel 42 --name feature-login
```

Le terminal partagé ne s'ouvre qu'avec le consentement de chaque membre du
worktree. Les commandes envoyées depuis le salon s'exécutent sur la machine
qui héberge la session ; Ctrl-C la ferme.
