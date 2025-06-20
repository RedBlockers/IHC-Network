export class Auth {
    static async authenticateToken(token) {
        try {
            const response = await axios.get("/users/authenticateToken", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.status === 200 && response.data.success) {
                localStorage.setItem("username", response.data.username);
                localStorage.setItem("avatar", response.data.avatar);
                localStorage.setItem("userId", response.data.userId);
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error(
                    "Erreur lors de l'authentification du token:",
                    error
                );
            }
        }
    }
    static invalidateToken() {
        alert("Token invalide veuillez vous reconnecter");
        localStorage.removeItem("token");
        window.location.href = "/pages/login.html";
    }
}
