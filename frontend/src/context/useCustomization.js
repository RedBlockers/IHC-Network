import { useContext } from "react";

import { CustomizationContext } from "./customization-context.js";

export function useCustomization() {
    const context = useContext(CustomizationContext);
    if (!context) throw new Error("useCustomization doit être utilisé dans un CustomizationProvider.");
    return context;
}
