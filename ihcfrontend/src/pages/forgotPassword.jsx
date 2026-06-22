import "./login.css";

export default function ForgotPassword() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Mot de passe oublié</h1>

        <form className="auth-form">
          <label>Email</label>
          <input type="email" placeholder="email@example.com" />

          <button type="submit" className="auth-button">
            Réinitialiser le mot de passe
          </button>
        </form>

        <p className="auth-footer">
          <a href="/login">Retour à la connexion</a>
        </p>
      </div>
    </div>
  );
}
