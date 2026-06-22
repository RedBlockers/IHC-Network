import { createContext, useContext, useState } from "react";

const registerContext = createContext(null);

export const RegisterProvider = ({ children }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    handle: "",
    avatar: null,
    displayName: "",
    bio: "",
    cropperData: {},
  });
  function updateFormData(newData) {
    setFormData((prev) => ({ ...prev, ...newData }));
  }

  return (
    <registerContext.Provider value={{ formData, updateFormData }}>
      {children}
    </registerContext.Provider>
  );
};

export function useRegister() {
  return useContext(registerContext);
}
