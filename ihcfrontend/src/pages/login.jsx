import "./login.css";
import InputPassword from "../components/auth/inputPassword.jsx";
import { useState } from "react";
import { api } from "../api/api";

export default function Login() {
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    await api(
      "/users/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
      },
      false,
    )
      .then((response) => {
        localStorage.setItem("token", response.token);
        window.location.href = "/";
      })
      .catch((error) => setError(error.message));
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Connexion</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            nom d'utilisateur<span className="required">*</span>
          </label>
          <input
            type="text"
            placeholder="user x"
            onChange={(e) => setHandle(e.target.value)}
            required
          />

          <InputPassword
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <a href="/forgot-password" className="auth-link small">
            Mot de passe oublié
          </a>

          <button type="submit" className="auth-button">
            Se connecter
          </button>
          {error && <p className="auth-error">⚠ {error}</p>}
        </form>

        <p className="auth-footer">
          Pas de compte ? <a href="/register">Créer un compte</a>
        </p>
      </div>
    </div>
  );
}
