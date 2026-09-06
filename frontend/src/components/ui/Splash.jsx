import Logo from "./Logo.jsx";

export default function Splash() {
    return (
        <div className="splash">
            <div className="splash-mark">
                <Logo size={56} />
            </div>
            <span className="splash-pulse" />
        </div>
    );
}
