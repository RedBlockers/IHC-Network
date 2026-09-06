import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import Icon from "./Icon.jsx";

export default function ContextMenu({ items, position, onClose }) {
    const menuRef = useRef(null);
    const restoreRef = useRef(null);
    const [placement, setPlacement] = useState(position);

    useEffect(() => {
        restoreRef.current = document.activeElement;
        const first = menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)');
        first?.focus();
        return () => {
            if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
        };
    }, []);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        const box = menu.getBoundingClientRect();
        const margin = 8;
        let { x, y } = position;

        if (x + box.width + margin > window.innerWidth) x = Math.max(margin, window.innerWidth - box.width - margin);
        if (y + box.height + margin > window.innerHeight) y = Math.max(margin, y - box.height);

        setPlacement({ x, y });
    }, [position]);

    const move = useCallback((delta) => {
        const buttons = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') ?? [])];
        if (buttons.length === 0) return;
        const index = buttons.indexOf(document.activeElement);
        buttons[(index + delta + buttons.length) % buttons.length].focus();
    }, []);

    function onKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
        } else if (event.key === "Home") {
            event.preventDefault();
            menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
        } else if (event.key === "End") {
            event.preventDefault();
            [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])].at(-1)?.focus();
        } else if (event.key === "Tab") {
            onClose();
        }
    }

    return (
        <>
            <button
                type="button"
                className="context-scrim"
                aria-label="Fermer le menu"
                onClick={onClose}
                onContextMenu={(event) => {
                    event.preventDefault();
                    onClose();
                }}
            />
            <div
                ref={menuRef}
                className="context-menu"
                role="menu"
                aria-orientation="vertical"
                style={{ left: `${placement.x}px`, top: `${placement.y}px` }}
                onKeyDown={onKeyDown}
            >
                {items.map((item, index) =>
                    item.separator ? (
                        <hr key={`sep-${index}`} role="separator" />
                    ) : (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            className={item.danger ? "is-danger" : ""}
                            disabled={item.disabled}
                            onClick={() => {
                                item.run();
                                onClose();
                            }}
                        >
                            {item.icon && <Icon name={item.icon} size={15} />}
                            <span>{item.label}</span>
                            {item.hint && <small>{item.hint}</small>}
                        </button>
                    )
                )}
            </div>
        </>
    );
}
