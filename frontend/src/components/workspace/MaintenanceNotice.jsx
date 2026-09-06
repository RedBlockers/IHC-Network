import Icon from "../ui/Icon.jsx";

export default function MaintenanceNotice({ reason }) {
    return (
        <section className="suspended" role="status" aria-live="polite">
            <span className="suspended-mark" aria-hidden="true"><Icon name="alert" size={24} /></span>

            <h1>Le service est en maintenance</h1>

            <p className="suspended-until">{reason}</p>

            <p className="suspended-appeal">
                Rien n’est perdu : vos messages, vos communautés et vos fichiers vous attendent.
                Cette page se rouvrira d’elle-même dès le retour du service.
            </p>

            <p className="suspended-reason">
                <span>Vérification</span>
                La disponibilité est vérifiée toutes les quinze secondes.
            </p>
        </section>
    );
}
