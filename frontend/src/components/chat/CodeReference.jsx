import { openTarget } from "../../lib/codeReferences.js";
import { readEditorPreference } from "../../lib/editorPreference.js";
import Tooltip from "../ui/Tooltip.jsx";

export default function CodeReference({ reference, label }) {
    const preference = readEditorPreference();
    const target = openTarget(reference, preference);

    if (!target) return <code className="code-ref">{label}</code>;

    if (target.kind === "command") {
        return (
            <Tooltip label={`Copier : ${target.value}`}>
                <button
                    type="button"
                    className="code-ref code-ref-copy"
                    onClick={() => navigator.clipboard?.writeText(target.value)}
                >
                    {label}
                </button>
            </Tooltip>
        );
    }

    return (
        <Tooltip label={`Ouvrir dans ${target.label}`}>
            <a className="code-ref code-ref-link" href={target.value}>
                {label}
            </a>
        </Tooltip>
    );
}
