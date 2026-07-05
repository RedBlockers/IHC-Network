import { useState, useRef, useCallback } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { API_URL, api } from "../../../api/api";
import "./newGuildForm.css";

export default function NewGuildForm({ onClose, onCreated }) {
  const [guildName, setGuildName] = useState("");
  const [guildDescription, setGuildDescription] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [uiState, setUiState] = useState("idle"); // idle | cropping | preview
  const [rawFile, setRawFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [croppedUrl, setCroppedUrl] = useState(null);

  const cropperRef = useRef(null);
  const fileInputRef = useRef(null);
  const rawObjectUrl = useRef(null);
  const croppedObjectUrl = useRef(null);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (rawObjectUrl.current) URL.revokeObjectURL(rawObjectUrl.current);
    const url = URL.createObjectURL(file);
    rawObjectUrl.current = url;
    setRawFile(file);
    setImageUrl(url);
    setUiState("cropping");
  }, []);

  const handleCrop = async () => {
    const cropperInstance = cropperRef.current?.cropper;
    if (!cropperInstance || !rawFile) return;

    setLoading(true);
    setError(null);
    try {
      const data = cropperInstance.getData(true);
      const formData = new FormData();
      formData.append("image", rawFile);
      formData.append("x", data.x);
      formData.append("y", data.y);
      formData.append("width", data.width);
      formData.append("height", data.height);

      const response = await fetch(`${API_URL}/avatar/crop`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || `Erreur serveur (${response.status})`);
      }

      const blob = await response.blob();
      if (croppedObjectUrl.current)
        URL.revokeObjectURL(croppedObjectUrl.current);
      const url = URL.createObjectURL(blob);
      croppedObjectUrl.current = url;
      setCroppedBlob(blob);
      setCroppedUrl(url);
      setUiState("preview");
    } catch (err) {
      setError("Erreur lors du recadrage. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetImage = useCallback(() => {
    setRawFile(null);
    setImageUrl(null);
    setCroppedBlob(null);
    setCroppedUrl(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("guildName", guildName.trim());
      form.append("guildDescription", guildDescription.trim());
      if (croppedBlob) form.append("guildImage", croppedBlob);

      const data = await api("/guilds", { method: "POST", body: form });
      onCreated?.(data);
      onClose();
    } catch (err) {
      setError(err.error || err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="new-guild-form" onSubmit={handleSubmit}>
      {/* ── Section avatar ── */}
      <div className="guild-avatar-section">
        {uiState === "idle" && (
          <div
            className="guild-avatar-upload"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" && fileInputRef.current?.click()
            }
          >
            <span className="guild-avatar-upload-plus">+</span>
            <p className="guild-avatar-upload-text">Ajouter une icône</p>
          </div>
        )}

        {uiState === "cropping" && imageUrl && (
          <div className="guild-cropper-wrapper">
            <Cropper
              src={imageUrl}
              style={{
                height: 200,
                width: "100%",
                borderRadius: "var(--border-radius-small)",
              }}
              aspectRatio={1}
              viewMode={1}
              guides={false}
              autoCropArea={1}
              background={false}
              responsive={true}
              ref={cropperRef}
            />
            <div className="guild-cropper-actions">
              <button
                type="button"
                className="guild-btn-secondary"
                onClick={handleResetImage}
                disabled={loading}
              >
                Annuler
              </button>
              <button
                type="button"
                className="guild-btn-primary"
                onClick={handleCrop}
                disabled={loading}
              >
                {loading ? "Traitement..." : "Recadrer"}
              </button>
            </div>
          </div>
        )}

        {uiState === "preview" && croppedUrl && (
          <div className="guild-avatar-preview-wrapper">
            <img
              src={croppedUrl}
              alt="Icône de la guilde"
              className="guild-avatar-preview"
            />
            <div className="guild-avatar-preview-actions">
              <button
                type="button"
                className="guild-avatar-change"
                onClick={() => setUiState("cropping")}
              >
                Recadrer
              </button>
              <button
                type="button"
                className="guild-avatar-change guild-avatar-remove"
                onClick={handleResetImage}
              >
                Supprimer
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {/* ── Champs ── */}
      <label>
        Nom de la guilde <span className="required">*</span>
      </label>
      <input
        type="text"
        value={guildName}
        onChange={(e) => setGuildName(e.target.value)}
        placeholder="Ma super guilde"
        required
        minLength={3}
        maxLength={50}
      />

      <label>Description</label>
      <textarea
        value={guildDescription}
        onChange={(e) => setGuildDescription(e.target.value)}
        placeholder="À propos de cette guilde..."
        maxLength={200}
        rows={3}
      />

      {error && <p className="guild-form-error">⚠ {error}</p>}

      <div className="guild-form-actions">
        <button
          type="button"
          className="guild-btn-secondary"
          onClick={onClose}
          disabled={loading}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="guild-btn-primary"
          disabled={loading || guildName.trim().length < 3}
        >
          {loading ? "Création..." : "Créer la guilde"}
        </button>
      </div>
    </form>
  );
}
