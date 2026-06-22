import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./modal.css";
import { IoMdCloseCircle } from "react-icons/io";

export default function Modal({ open, onClose, title, children }) {
  // Fermer avec ESC
  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Empêcher le scroll du body
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";

    return () => (document.body.style.overflow = "");
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()} // Empêche la fermeture si on clique dans le modal
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}>
            <IoMdCloseCircle size={"100%"} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.getElementById("modal-root"),
  );
}
