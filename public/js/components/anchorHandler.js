export function handleAnchor() {
    document.querySelectorAll("a").forEach((anchor) => {
        anchor.addEventListener(
            "click",
            (e) => {
                e.preventDefault();
                console.log("test");
                if (
                    confirm(
                        "Voulez-vous vraiment ouvrir ce lien dans un nouvel onglet ?"
                    )
                ) {
                    window.open(anchor.href, "_blank");
                }
            },
            { once: true }
        );
    });
}
