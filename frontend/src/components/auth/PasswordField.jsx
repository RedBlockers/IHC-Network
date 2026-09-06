import { useId, useState } from "react";

export default function PasswordField({ label, value, onChange, autoComplete, hint, minLength, maxLength = 200 }) {
    const [visible, setVisible] = useState(false);
    const id = useId();

    return (
        <div className="field">
            <label className="field-label" htmlFor={id}>
                {label}
            </label>
            <span className="field-affix">
                <input
                    id={id}
                    className="field-input"
                    type={visible ? "text" : "password"}
                    autoComplete={autoComplete}
                    placeholder="••••••••"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    minLength={minLength}
                    maxLength={maxLength}
                    aria-describedby={hint ? `${id}-hint` : undefined}
                />
                <button
                    type="button"
                    className="field-affix-btn"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                    {visible ? "Masquer" : "Afficher"}
                </button>
            </span>
            {hint && (
                <span className="field-hint" id={`${id}-hint`}>
                    {hint}
                </span>
            )}
        </div>
    );
}
