import { fullTimestamp } from "../../lib/format.js";
import Icon from "../ui/Icon.jsx";

export default function SuspendedNotice({ until, reason, onSignOut }) {
    return (
        <section className="suspended" role="alert">
            <span className="suspended-mark" aria-hidden="true"><Icon name="bell" size={24} /></span>

            <h1>Votre compte est suspendu</h1>

            {until ? (
                <p className="suspended-until">
                    La suspension prend fin le <strong>{fullTimestamp(until)}</strong>. Vous
                    retrouverez alors votre compte tel que vous l’avez laissé.
                </p>
            ) : (
                <p className="suspended-until">Cette suspension n’a pas de date de fin.</p>
            )}

            {reason && (
                <p className="suspended-reason">
                    <span>Motif</span>
                    {reason}
                </p>
            )}

            <p className="suspended-appeal">
                Vous pouvez contester cette décision auprès de l’équipe de modération
                pendant 14 jours. Vos messages et vos communautés restent intacts.
            </p>

            <button type="button" className="btn btn-ghost" onClick={onSignOut}>
                Se déconnecter
            </button>
        </section>
    );
}
