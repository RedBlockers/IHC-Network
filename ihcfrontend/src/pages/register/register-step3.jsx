import "../login.css";
import AuthFooter from "../../components/auth/authFooter.jsx";
import { useState, useEffect } from "react";
import { useRegister } from "../../context/registerContext.jsx";

export default function RegisterStep3({ step, setStep, totalSteps }) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const { formData } = useRegister();
  const { updateFormData } = useRegister();

  useEffect(() => {
    if (formData.displayName) setDisplayName(formData.displayName);
    if (formData.bio) setBio(formData.bio);
  }, [formData]);

  //async function handleSubmit(e) {
  //  e.preventDefault();
  //  const form = new FormData();
  //  form.append("email", formData.email);
  //  form.append("password", formData.password);
  //  form.append("handle", formData.handle);
  //  form.append("displayName", displayName);
  //  form.append("bio", bio);
  //  form.append("avatar", formData.avatar);
  //
  //  const res = await fetch("http://localhost:3000/users/register", {
  //    method: "POST",
  //    body: form,
  //  });
  //  const data = await res.json();
  //  console.log(data);
  //}

  async function handleNext(e) {
    e.preventDefault();
    updateFormData({ displayName, bio });
    setStep(step + 1);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">A propos de vous</h1>

        <form className="auth-form" onSubmit={handleNext}>
          <lablel>Nom d'affichage</lablel>
          <input
            type="text"
            placeholder="Votre nom d'affichage"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <lablel>Bio</lablel>
          <textarea
            placeholder="Parlez-nous de vous..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          ></textarea>
          <button type="submit" className="auth-button">
            Suivant
          </button>
        </form>

        <AuthFooter step={step} totalSteps={totalSteps} setStep={setStep} />
      </div>
    </div>
  );
}
