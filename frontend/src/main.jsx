import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/onest";
import "@fontsource-variable/space-grotesk";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/auth.css";
import "./styles/settings.css";
import "./styles/workflows.css";
import "./styles/decorations.css";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CustomizationProvider } from "./context/CustomizationContext.jsx";
import { VoiceSessionProvider } from "./context/VoiceSessionContext.jsx";
import LiveRegion from "./components/ui/LiveRegion.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <CustomizationProvider>
                    <VoiceSessionProvider>
                        <App />
                        <LiveRegion />
                    </VoiceSessionProvider>
                </CustomizationProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>
);
