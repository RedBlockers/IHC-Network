import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

const dialogs = [];
let previousOverflow = "";
let initialFocus = null;

export default function Modal({
    open,
    onClose,
    title,
    children,
    className = "",
    size = "dialog",
    dialogRole = "dialog",
}) {
    const dialogRef = useRef(null);
    const restoreRef = useRef(null);
    const closeRef = useRef(onClose);

    useLayoutEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;
        restoreRef.current = document.activeElement;
        const dialog = dialogRef.current;
        if (!dialogs.length) {
            initialFocus = restoreRef.current;
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        dialogs.push(dialog);
        const focusable = focusableItems(dialog);
        const preferred = dialog?.querySelector("[data-autofocus], [autofocus]");
        (preferred || focusable[0] || dialog)?.focus();

        function onKey(event) {
            if (dialogs.at(-1) !== dialog) return;
            if (event.key === "Escape" && !event.defaultPrevented) {
                event.preventDefault();
                closeRef.current();
            }
            if (event.key === "Tab") trapFocus(event, dialog);
        }
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("keydown", onKey);
            const wasTop = dialogs.at(-1) === dialog;
            const index = dialogs.indexOf(dialog);
            if (index !== -1) dialogs.splice(index, 1);
            if (!dialogs.length) {
                document.body.style.overflow = previousOverflow;
                if (initialFocus?.isConnected) initialFocus.focus?.();
                initialFocus = null;
            } else if (wasTop && restoreRef.current?.isConnected) restoreRef.current.focus?.();
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div className="modal-scrim" onMouseDown={onClose}>
            <div
                className={`modal modal-${size}${className ? ` ${className}` : ""}`}
                role={dialogRole}
                aria-modal="true"
                aria-label={title}
                ref={dialogRef}
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="modal-head">
                    <h2>{title}</h2>
                    <button className="modal-close" onClick={onClose} aria-label="Fermer">
                        <Icon name="close" size={18} />
                    </button>
                </header>
                <div className="modal-body">{children}</div>
            </div>
        </div>,
        document.body
    );
}

function focusableItems(container) {
    return [
        ...(container?.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]') ||
            []),
    ].filter(
        (item) => !item.disabled && item.tabIndex >= 0 && item.getClientRects().length && !item.closest("[inert]")
    );
}

function trapFocus(event, container) {
    const items = focusableItems(container);
    if (items.length === 0) {
        event.preventDefault();
        container?.focus();
        return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
    }
}
