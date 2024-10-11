document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Empêche le rechargement de la page

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Vérification que le mot de passe et la confirmation correspondent
    if (password !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas.');
        return;
    }

    // Envoi des données d'inscription
    axios.post('/register', { username, password })
        .then(response => {
            if (response.data.success) {
                alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
                window.location.href = 'login.html'; // Rediriger vers la page de connexion
            } else {
                alert('Erreur : ' + response.data.message);
            }
        })
        .catch(error => {
            console.error('Erreur lors de l\'inscription:', error);
            alert('Une erreur s\'est produite. Veuillez réessayer.');
        });
});
