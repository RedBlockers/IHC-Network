import { useEffect, useState } from "react";

import { subscribe } from "../../lib/announce.js";

export default function LiveRegion() {
    const [message, setMessage] = useState("");

    useEffect(() => subscribe(setMessage), []);

    return (
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {message}
        </div>
    );
}
