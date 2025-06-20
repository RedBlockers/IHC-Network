// login.js
document
    .getElementById("loginForm")
    .addEventListener("submit", function (event) {
        event.preventDefault(); // Empêche le rechargement de la page

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        axios
            .post("/users/login", { username: username, password: password })
            .then((response) => {
                console.log("Inscription réussie !", response.data);
                localStorage.setItem("token", response.data.token);
                window.location.href = "../../index.html";
            })
            .catch((error) => {
                if (error.response && error.response.status === 401) {
                    alert("Identifiants incorrects. Veuillez réessayer.");
                } else if (error.response && error.response.status === 409) {
                    alert(
                        error.response.data.message ||
                            "Nom d'utilisateur ou mot de passe incorrect."
                    );
                } else if (error.response && error.response.status === 500) {
                    alert(
                        "Erreur interne du serveur. Veuillez réessayer plus tard."
                    );
                } else {
                    alert("Une erreur est survenue. Veuillez réessayer.");
                }
            });
    });
