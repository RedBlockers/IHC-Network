import { createContext, useContext, useState } from "react";

export const HOME = {
  id: "home",
  name: "Home",
  icon: "/qweillo_monocrhome.png",
  unread: false,
};

const guildContext = createContext(HOME);

export const GuildProvider = ({ children }) => {
  const [selectedGuild, setSelectedGuild] = useState(HOME);
  return (
    <guildContext.Provider value={{ selectedGuild, setSelectedGuild }}>
      {" "}
      {children}{" "}
    </guildContext.Provider>
  );
};

export function useGuild() {
  return useContext(guildContext);
}
