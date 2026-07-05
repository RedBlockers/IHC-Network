import { GuildProvider, useGuild, HOME } from "../../context/guildContext";
import "./centextHeader.css";

export default function ContextHeader() {
  const { selectedGuild, setSelectedGuild } = useGuild();

  return (
    <header className="context-header">
      <img
        src={selectedGuild.image}
        alt={`${selectedGuild.name} icon`}
        className="context-header-icon"
      />
      <h1>{selectedGuild.name}</h1>
    </header>
  );
}
