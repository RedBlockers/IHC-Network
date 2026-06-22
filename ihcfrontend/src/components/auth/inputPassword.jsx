import { useState } from "react";
import "./inputPassword.css";
import { FaEyeSlash, FaEye } from "react-icons/fa";

export default function InputPassword({ label = "Mot de passe", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <label>
        {label}
        <span className="required">*</span>
      </label>

      <div className="password-wrapper">
        <input type={visible ? "text" : "password"} {...props} />

        <button
          type="button"
          className="password-toggle"
          tabindex="-1"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    </div>
  );
}
