import "./authFooter.css";

export default function AuthFooter({ step, totalSteps, setStep }) {
  return (
    <div className="auth-footer-container">
      <p className="auth-footer">
        Déjà un compte ? <a href="/login">Se connecter</a>
      </p>
      <p className="auth-step">
        {step} / {totalSteps}
      </p>
      {step > 1 && (
        <p className="auth-back-link" onClick={() => setStep(step - 1)}>
          retour
        </p>
      )}
    </div>
  );
}
