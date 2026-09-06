import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DELAY_MS = 400;

let shown = null;

function claim(setBox) {
    if (shown && shown !== setBox) shown(null);
    shown = setBox;
}

function release(setBox) {
    if (shown === setBox) shown = null;
}

const MARGIN = 8;

export default function Tooltip({ label, shortcut, placement = "top", children }) {
    const [box, setBox] = useState(null);
    const timer = useRef(null);
    const id = useId();

    function place(anchor) {
        claim(setBox);

        const element = anchor.firstElementChild ?? anchor;
        const rect = element.getBoundingClientRect();

        if (placement === "right") {
            setBox({ top: rect.top + rect.height / 2, left: rect.right + MARGIN, placement });
            return;
        }
        setBox({
            top: placement === "bottom" ? rect.bottom + MARGIN : rect.top - MARGIN,
            left: Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60),
            placement,
        });
    }

    function hide() {
        clearTimeout(timer.current);
        release(setBox);
        setBox(null);
    }

    function onPointerEnter(event) {
        if (event.pointerType === "touch") return;
        const anchor = event.currentTarget;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => place(anchor), DELAY_MS);
    }

    function onFocus(event) {
        clearTimeout(timer.current);
        place(event.currentTarget);
    }

    return (
        <span
            className="tooltip-anchor"
            onPointerEnter={onPointerEnter}
            onPointerLeave={hide}
            onFocus={onFocus}
            onBlur={hide}
            onClick={hide}
            aria-describedby={box ? id : undefined}
        >
            {children}
            {box &&
                createPortal(
                    <span
                        id={id}
                        role="tooltip"
                        className={`tooltip tooltip-${box.placement}`}
                        style={{ top: `${box.top}px`, left: `${box.left}px` }}
                    >
                        {label}
                        {shortcut && <kbd>{shortcut}</kbd>}
                    </span>,
                    document.body
                )}
        </span>
    );
}
