import { createContext, useContext, useState } from "react";

const authContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  return (
    <authContext.Provider value={{ user, setUser }}>
      {" "}
      {children}{" "}
    </authContext.Provider>
  );
};

export function useAuth() {
  return useContext(authContext);
}
