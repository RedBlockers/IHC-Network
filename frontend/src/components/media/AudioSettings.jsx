import { useState } from "react";

import Icon from "../ui/Icon.jsx";

const OPTIONS = [
    {
        id: "noiseSuppression",
        label: "Suppression du bruit",
        hint: "Atténue ventilateur, clavier et bruit de fond.",
    },
    {
        id: "echoCancellation",
        label: "Annulation d’écho",
        hint: "Empêche vos haut-parleurs de revenir dans votre micro.",
    },
    {
        id: "autoGainControl",
        label: "Gain automatique",
        hint: "Égalise le volume quand vous vous éloignez du micro.",
    },
];

export default function AudioSettings({ processing, applied, onChange, dataSaver, onDataSaver }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="audio-settings">
            <button
                type="button"
                className={`audio-settings-toggle${open ? " is-open" : ""}`}
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
            >
                <Icon name="settings" size={15} /> Audio et données
            </button>

            {open && (
                <div className="audio-settings-panel">
                    {OPTIONS.map((option) => {
                        const wanted = processing[option.id] !== false;
                        const real = applied?.[option.id];
                        const mismatch = wanted && real === false;

                        return (
                            <label className="audio-option" key={option.id}>
                                <input
                                    type="checkbox"
                                    checked={wanted}
                                    onChange={(event) => onChange({ [option.id]: event.target.checked })}
                                />
                                <span className="audio-option-copy">
                                    <strong>{option.label}</strong>
                                    <small>{option.hint}</small>
                                    {mismatch && (
                                        <small className="audio-option-warn">
                                            Votre navigateur n’applique pas ce traitement.
                                        </small>
                                    )}
                                    {wanted && real === null && (
                                        <small className="audio-option-unknown">
                                            Votre navigateur n’indique pas s’il l’applique.
                                        </small>
                                    )}
                                </span>
                            </label>
                        );
                    })}

                    <hr />

                    <label className="audio-option">
                        <input
                            type="checkbox"
                            checked={dataSaver}
                            onChange={(event) => onDataSaver(event.target.checked)}
                        />
                        <span className="audio-option-copy">
                            <strong>Économie de données</strong>
                            <small>Vidéo en 320×180. La voix n’est pas dégradée.</small>
                        </span>
                    </label>
                </div>
            )}
        </div>
    );
}
