import { lazy, Suspense, useState } from "react";
import Icon from "../ui/Icon.jsx";

const InstanceSwitcher = lazy(() => import("./InstanceSwitcher.jsx"));

export default function InstanceButton() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="instance-button"
                aria-label="Changer d’instance"
                onClick={() => setOpen(true)}
            >
                <Icon name="hash" size={17} />
                <span>Instances</span>
            </button>
            {open && (
                <Suspense fallback={null}>
                    <InstanceSwitcher onClose={() => setOpen(false)} />
                </Suspense>
            )}
        </>
    );
}
