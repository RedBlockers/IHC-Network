import Modal from "../ui/Modal.jsx";

export default function DiscardChangesDialog({ onCancel, onDiscard }) {
    return (
        <Modal open title="Modifications non enregistrées" dialogRole="alertdialog" onClose={onCancel}>
            <p className="settings-p">Vos modifications seront perdues si vous fermez sans les enregistrer.</p>
            <div className="modal-actions">
                <button type="button" className="btn btn-ghost" data-autofocus onClick={onCancel}>
                    Continuer à modifier
                </button>
                <button type="button" className="btn btn-danger" onClick={onDiscard}>
                    Fermer sans enregistrer
                </button>
            </div>
        </Modal>
    );
}
