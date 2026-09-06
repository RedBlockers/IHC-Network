import { useCallback, useState } from "react";

export default function useContextMenu() {
    const [state, setState] = useState(null);

    const open = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();

        const point =
            event.clientX || event.clientY
                ? { x: event.clientX, y: event.clientY }
                : (() => {
                      const box = event.currentTarget.getBoundingClientRect();
                      return { x: box.left, y: box.bottom };
                  })();

        setState(point);
    }, []);

    const close = useCallback(() => setState(null), []);

    const triggerProps = {
        onContextMenu: open,
        onKeyDown: (event) => {
            if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) open(event);
        },
    };

    return { position: state, open, close, triggerProps };
}
