import "../login.css";
import InputPassword from "../../components/auth/inputPassword.jsx";
import AuthFooter from "../../components/auth/authFooter.jsx";
import { useState, useEffect } from "react";
import { useRegister } from "../../context/registerContext.jsx";
import { useDebounce } from "use-debounce";
import { api } from "../../api/api";

export default function RegisterStep1({ step, setStep, totalSteps }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [emailAvailable, setEmailAvailable] = useState(true);
  const [handleAvailable, setHandleAvailable] = useState(true);
  const [emailError, setEmailError] = useState("");
  const [handleError, setHandleError] = useState("");

  const { updateFormData } = useRegister();
  const { formData } = useRegister();
  const [debounceEmail] = useDebounce(email, 500);
  const [debounceHandle] = useDebounce(handle, 500);

  const match = password === confirmPassword && password.length > 0;

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const hasPasswords = password.length > 0 && confirmPassword.length > 0;

  const isFormValid =
    match &&
    emailAvailable &&
    handleAvailable &&
    isValidEmail(email) &&
    hasPasswords;

  function handleNext(e) {
    e.preventDefault();
    updateFormData({ email, password, handle });
    setStep(step + 1);
  }

  useEffect(() => {
    if (formData.email) setEmail(formData.email);
    if (formData.password) setPassword(formData.password);
    if (formData.password) setConfirmPassword(formData.password);
    if (formData.handle) setHandle(formData.handle);
  }, [formData]);

  useEffect(() => {
    if (!debounceEmail) {
      setEmailAvailable(true);
      setEmailError("");
      return;
    }

    if (!isValidEmail(debounceEmail)) {
      setEmailAvailable(false);
      setEmailError("Format d'email invalide");
      return;
    }

    api(`/users/auth/check?email=${encodeURIComponent(debounceEmail)}`).then(
      (res) => {
        setEmailAvailable(res.email.available);
        setEmailError(res.email.message);
      },
    );
  }, [debounceEmail]);

  useEffect(() => {
    if (!debounceHandle) {
      setHandleAvailable(true);
      setHandleError("");
      return;
    }

    api(`/users/auth/check?handle=${encodeURIComponent(debounceHandle)}`).then(
      (res) => {
        setHandleAvailable(res.handle.available);
        setHandleError(res.handle.message);
      },
    );
  }, [debounceHandle]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Créer un compte</h1>

        <form className="auth-form" onSubmit={handleNext}>
          <label>
            Email<span className="required">*</span>
          </label>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {!emailAvailable && <p className="auth-error">{emailError}</p>}
          <label>
            Nom d'utilisateur<span className="required">*</span>
          </label>
          <input
            type="text"
            placeholder="User X"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
          />
          {!handleAvailable && <p className="auth-error">{handleError}</p>}

          <InputPassword
            label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <InputPassword
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" className="auth-button" disabled={!isFormValid}>
            Suivant
          </button>
          {!match && confirmPassword.length > 0 && (
            <p className="auth-error">
              Les mots de passes doivent correspondre
            </p>
          )}
        </form>
        <AuthFooter step={step} totalSteps={totalSteps} setStep={setStep} />
      </div>
    </div>
  );
}
