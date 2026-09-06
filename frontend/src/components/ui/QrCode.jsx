import { useEffect, useState } from "react";

export default function QrCode({ value, label }) {
    const [source, setSource] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        import("qrcode")
            .then(({ default: QRCode }) =>
                QRCode.toDataURL(value, {
                    width: 256,
                    margin: 4,
                    errorCorrectionLevel: "M",
                    color: { dark: "#101820", light: "#ffffff" },
                })
            )
            .then((url) => {
                if (!cancelled) setSource(url);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [value]);

    if (failed)
        return <p className="settings-p">Le code QR n’a pas pu être créé. Utilisez l’adresse ou la clé affichée.</p>;
    return source ? (
        <img className="qr-code" src={source} alt={label} width={256} height={256} />
    ) : (
        <p role="status">Création du code QR…</p>
    );
}
