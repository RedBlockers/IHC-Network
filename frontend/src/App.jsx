import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./context/useAuth.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AccountRecovery from "./pages/AccountRecovery.jsx";
import InvitePage from "./pages/InvitePage.jsx";
import Splash from "./components/ui/Splash.jsx";
import SuspendedNotice from "./components/workspace/SuspendedNotice.jsx";
import MaintenanceNotice from "./components/workspace/MaintenanceNotice.jsx";
import useMaintenance from "./hooks/useMaintenance.js";
import { safeReturnPath } from "./lib/returnPath.js";

const Workspace = lazy(() => import("./pages/Workspace.jsx"));

function RequireAuth({ children }) {
    const { status, user, logout } = useAuth();
    if (status === "loading") return <Splash />;
    if (status === "anon") return <Navigate to="/login" replace />;

    if (user?.isBanned && (!user.bannedUntil || new Date(user.bannedUntil) > new Date())) {
        return <SuspendedNotice until={user.bannedUntil} reason={user.suspensionReason} onSignOut={logout} />;
    }

    return children;
}

function RedirectIfAuthed({ children }) {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <Splash />;
    if (status === "authed") return <Navigate to={safeReturnPath(location.search)} replace />;
    return children;
}

export default function App() {
    const maintenance = useMaintenance();

    if (maintenance.active) {
        return <MaintenanceNotice reason={maintenance.reason} />;
    }

    return (
        <Routes>
            <Route
                path="/"
                element={
                    <RequireAuth>
                        <Suspense fallback={<Splash />}>
                            <Workspace />
                        </Suspense>
                    </RequireAuth>
                }
            />

            <Route path="/invite/:code" element={<InvitePage />} />
            <Route path="/forgot-password" element={<AccountRecovery key="forgot" mode="forgot" />} />
            <Route path="/reset-password" element={<AccountRecovery key="reset" mode="reset" />} />
            <Route path="/verify-email" element={<AccountRecovery key="verify" mode="verify" />} />

            <Route
                path="/login"
                element={
                    <RedirectIfAuthed>
                        <Login />
                    </RedirectIfAuthed>
                }
            />
            <Route
                path="/register"
                element={
                    <RedirectIfAuthed>
                        <Register />
                    </RedirectIfAuthed>
                }
            />

            <Route path="/app/*" element={<Navigate to="/" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
