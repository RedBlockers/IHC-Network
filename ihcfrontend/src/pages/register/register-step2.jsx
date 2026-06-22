import { useState, useRef, useCallback, useEffect } from "react";
import "../login.css";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import AuthFooter from "../../components/auth/authFooter.jsx";
import { useRegister } from "../../context/registerContext.jsx";

const API_URL = "http://localhost:3001";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

async function getDefaultAvatarBlob() {
  const response = await fetch("/qweillo_colored.png");
  const blob = await response.blob();
  return blob;
}

function Spinner() {
  return <span className="btn-spinner" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RegisterStep2({ step, setStep, totalSteps }) {
  const cropperRef = useRef(null);
  const fileInputRef = useRef(null);
  const { updateFormData } = useRegister();
  const { formData } = useRegister();

  // raw URL créée par createObjectURL (à révoquer pour éviter les fuites mémoire)
  const rawObjectUrl = useRef(null);
  const croppedObjectUrl = useRef(null);

  const [rawFile, setRawFile] = useState(null); // File original
  const [imageUrl, setImageUrl] = useState(null); // URL pour react-cropper
  const [croppedUrl, setCroppedUrl] = useState(null); // URL du résultat
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blob, setBlob] = useState(null);

  // "idle" | "cropping" | "preview"
  const [uiState, setUiState] = useState("idle");

  useEffect(() => {
    if (!formData.avatar || formData.isAvatarDefault) return;

    const url = URL.createObjectURL(formData.avatar);
    const url2 = URL.createObjectURL(formData.cropperData?.rawFile) || null;
    rawObjectUrl.current = url2;

    croppedObjectUrl.current = url;

    setCroppedUrl(url);
    setBlob(formData.avatar);
    setUiState("preview");
    setRawFile(formData.cropperData?.rawFile || null);
    setImageUrl(url2);
    fileInputRef.current = formData.cropperData?.fileInputRef || null;

    return () => {
      if (croppedObjectUrl.current) {
        URL.revokeObjectURL(croppedObjectUrl.current);
        croppedObjectUrl.current = null;
      }
    };
  }, []);

  // Nettoyage des object URLs à la destruction du composant
  useEffect(() => {
    return () => {
      if (rawObjectUrl.current) URL.revokeObjectURL(rawObjectUrl.current);
      if (croppedObjectUrl.current)
        URL.revokeObjectURL(croppedObjectUrl.current);
    };
  }, []);

  // ── Sélection de fichier ───────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Nettoie l'ancien objet URL s'il existe
    if (rawObjectUrl.current) URL.revokeObjectURL(rawObjectUrl.current);

    const url = URL.createObjectURL(file);
    rawObjectUrl.current = url;

    setRawFile(file);
    setImageUrl(url);
    setError(null);
    setCroppedUrl(null);
    setUiState("cropping");
  }, []);

  // ── Envoi au serveur pour crop ─────────────────────────────────────────────
  const handleCrop = async () => {
    const cropperInstance = cropperRef.current?.cropper;
    if (!cropperInstance || !rawFile) return;

    setLoading(true);
    setError(null);

    try {
      // getData(true) → coordonnées en pixels entiers, relatives à l'image originale
      const data = cropperInstance.getData(true);

      const formData = new FormData();
      formData.append("image", rawFile);
      formData.append("x", data.x);
      formData.append("y", data.y);
      formData.append("width", data.width);
      formData.append("height", data.height);

      const response = await fetch(`${API_URL}/api/avatar/crop`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || `Erreur serveur (${response.status})`);
      }

      const blob = await response.blob();

      // Nettoie l'ancienne URL croppée
      if (croppedObjectUrl.current)
        URL.revokeObjectURL(croppedObjectUrl.current);

      const url = URL.createObjectURL(blob);
      croppedObjectUrl.current = url;

      setBlob(blob);
      setCroppedUrl(url);
      setUiState("preview");
    } catch (err) {
      setError(
        "Une erreur interne s'est produite. Veuillez réessayer plus tard.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Reset complet ──────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setRawFile(null);
    setImageUrl(null);
    setCroppedUrl(null);
    setError(null);
    setBlob(null);

    setUiState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (rawObjectUrl.current) {
      URL.revokeObjectURL(rawObjectUrl.current);
      rawObjectUrl.current = null;
    }
    if (croppedObjectUrl.current) {
      URL.revokeObjectURL(croppedObjectUrl.current);
      croppedObjectUrl.current = null;
    }
  }, []);

  // ── Continuer vers l'étape 3 ───────────────────────────────────────────────
  const handleNext = async () => {
    updateFormData({ avatar: blob ? blob : await getDefaultAvatarBlob() });
    updateFormData({ isAvatarDefault: blob ? false : true });
    updateFormData({
      cropperData: {
        rawFile: rawFile,
        imageUrl: imageUrl,
        fileInputRef: fileInputRef,
      },
    });
    setStep(step + 1);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="auth-container">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="auth-card">
        <h1 className="auth-title">Importer une photo de profil</h1>

        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          {/* ── IDLE : zone de dépôt ─────────────────────────────────────── */}
          {uiState === "idle" && (
            <>
              <div
                className="avatar-upload"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) =>
                  e.key === "Enter" && fileInputRef.current?.click()
                }
                role="button"
                tabIndex={0}
                aria-label="Importer une image ou un GIF"
              >
                <div className="avatar-upload-content">
                  <div className="avatar-upload-icon">
                    <UploadIcon />
                  </div>
                  <p className="avatar-upload-text">
                    Cliquez pour importer une image ou un GIF
                  </p>
                  <p className="avatar-upload-subtext">
                    JPG · PNG · GIF · WebP — max 10 Mo
                  </p>
                </div>{" "}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="avatar-input"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="auth-button secondary-button"
                onClick={handleNext}
              >
                Ignorer →
              </button>
            </>
          )}

          {/* ── CROPPING : react-cropper ─────────────────────────────────── */}
          {uiState === "cropping" && imageUrl && (
            <>
              <Cropper
                src={imageUrl}
                style={{
                  height: 280,
                  width: "100%",
                  borderRadius: "var(--border-radius-small)",
                }}
                aspectRatio={1} // carré pour un avatar
                viewMode={1} // interdit de sortir de l'image
                guides={true}
                autoCropArea={0.8}
                background={false}
                responsive={true}
                ref={cropperRef}
              />

              <div className="cropper-actions">
                <button
                  type="button"
                  className="auth-button secondary"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="auth-button"
                  onClick={handleCrop}
                  disabled={loading}
                >
                  {loading && <Spinner />}
                  {loading ? "Traitement..." : "Recadrer"}
                </button>
              </div>
            </>
          )}

          {/* ── PREVIEW : aperçu de l'avatar croppé ─────────────────────── */}
          {uiState === "preview" && croppedUrl && (
            <>
              <div className="avatar-preview-container">
                <img
                  src={croppedUrl}
                  alt="Aperçu de votre avatar"
                  className="avatar-preview"
                />
              </div>

              <div className="cropper-actions">
                <button
                  type="button"
                  className="auth-button secondary"
                  onClick={() => setUiState("cropping")}
                >
                  Recadrer à nouveau
                </button>
                <button
                  type="button"
                  className="auth-button"
                  onClick={handleNext}
                >
                  Continuer →
                </button>
              </div>
            </>
          )}

          {/* ── Erreur ───────────────────────────────────────────────────── */}
          {error && <p className="auth-error">⚠ {error}</p>}
        </form>
        <AuthFooter step={step} totalSteps={totalSteps} setStep={setStep} />
      </div>
    </div>
  );
}
