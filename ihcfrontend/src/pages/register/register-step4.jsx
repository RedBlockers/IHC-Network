import "../login.css";
import AuthFooter from "../../components/auth/authFooter.jsx";
import { useState, useEffect } from "react";
import { useRegister } from "../../context/registerContext.jsx";
import { FastAverageColor } from "fast-average-color";
import { api } from "../../api/api";

export default function RegisterStep3({ step, setStep, totalSteps }) {
  const { formData } = useRegister();
  const { updateFormData } = useRegister();
  const [userBannerColor, setUserBannerColor] = useState("#ffffff");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!formData.avatar) return;

    const fac = new FastAverageColor();
    fac
      .getColorAsync(URL.createObjectURL(formData.avatar), {
        algorithm: "dominant",
      })
      .then((color) => {
        setUserBannerColor(color.hex);
      });
  }, [formData.avatar, setUserBannerColor]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("email", formData.email);
      form.append("password", formData.password);
      form.append("handle", formData.handle);
      form.append("displayName", formData.displayName);
      form.append("bio", formData.bio);
      form.append("avatar", formData.avatar);

      const data = await api("/users/register", { method: "POST", body: form });
      localStorage.setItem("token", data.token);
      window.location.href = "/";
    } catch (err) {
      setError(err.error || err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Recapitulatif</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="user-info">
            <div
              className="user-banner"
              style={{ backgroundColor: userBannerColor }}
            ></div>
            <img
              src={
                formData.avatar
                  ? URL.createObjectURL(formData.avatar)
                  : "/default-avatar.png"
              }
              alt="avatar"
              className="user-avatar"
            />

            <p className="display-name">
              {formData.displayName || formData.handle}
            </p>
            <p className="handle">{formData.handle}</p>
            <p className="bio">{formData.bio}</p>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Création en cours..." : "Terminer et créer mon compte"}
          </button>
          {error && <p className="auth-error">⚠ {error}</p>}
        </form>

        <AuthFooter step={step} totalSteps={totalSteps} setStep={setStep} />
      </div>
    </div>
  );
}
