import "../login.css";
import AuthFooter from "../../components/auth/authFooter.jsx";
import { useState, useEffect } from "react";
import { useRegister } from "../../context/registerContext.jsx";
import { FastAverageColor } from "fast-average-color";

export default function RegisterStep3({ step, setStep, totalSteps }) {
  const { formData } = useRegister();
  const { updateFormData } = useRegister();
  const [userBannerColor, setUserBannerColor] = useState("#ffffff");

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
    const form = new FormData();
    form.append("email", formData.email);
    form.append("password", formData.password);
    form.append("handle", formData.handle);
    form.append("displayName", formData.displayName);
    form.append("bio", formData.bio);
    form.append("avatar", formData.avatar);

    const res = await fetch("http://localhost:3000/users/register", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    localStorage.setItem("token", data.token);
    console.log(data);
    window.location.href = "/";
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

          <button type="submit" className="auth-button">
            terminer et créer mon compte
          </button>
        </form>

        <AuthFooter step={step} totalSteps={totalSteps} setStep={setStep} />
      </div>
    </div>
  );
}
