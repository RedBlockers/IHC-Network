// login.js
document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Empêche le rechargement de la page

    const username = document.getElementById('username').value;

    // Simule une connexion et stocke le nom d'utilisateur dans le stockage local
    if (username.trim() !== '') {
        localStorage.setItem('username', username); // Stocke le nom d'utilisateur
        window.location.href = '../index.html'; // Redirige vers la page d'accueil
    }
});
