import { BsFillPlusCircleFill } from "react-icons/bs";
import "./guildsSidebar.css";
import { useGuild, HOME } from "../../context/guildContext";
import { useState } from "react";
import "./guildsState.css";
import Modal from "../ui/modal.jsx";
import NewGuildForm from "./newGuildForms/newGuildForm.jsx";

function getStateClass(guild, hoveredGuild, selectedGuild) {
  if (selectedGuild.id === guild.id) {
    return "selected";
  } else if (hoveredGuild === guild.id) {
    return "hovered";
  } else if (guild.unread) {
    return "unread";
  } else {
    return "";
  }
}

function GuildIcon({ guild }) {
  if (guild.image) {
    return <img className="guild-icon" src={guild.image} alt={guild.name} />;
  }
  return (
    <span className="guild-icon-letter">
      {guild.name?.charAt(0).toUpperCase()}
    </span>
  );
}

export default function GuildsSidebar({ guilds = [], onGuildCreated }) {
  const [hoveredGuild, setHoveredGuild] = useState(null);
  const { selectedGuild, setSelectedGuild } = useGuild();
  const [open, setOpen] = useState(false);

  const handleGuildCreated = (data) => {
    onGuildCreated?.();
  };

  return (
    <aside className="guild-sidebar">
      <ul className="guild-list">
        {/* Accueil */}
        <li
          className="guild-item"
          key={HOME.id}
          onClick={() => { setSelectedGuild(HOME); setHoveredGuild(null); }}
          onMouseEnter={() => selectedGuild !== "home" && setHoveredGuild("home")}
          onMouseLeave={() => setHoveredGuild(null)}
        >
          <div className={`guild-state ${getStateClass(HOME, hoveredGuild, selectedGuild)}`} />
          <div className="guild-icon-container">
            <img src="/qweillo_monocrhome.png" className="guild-icon" alt="Home" />
          </div>
        </li>

        <hr className="guild-sidebar-separator" />

        {/* Guildes */}
        {guilds.map((guild) => (
          <li
            className="guild-item"
            key={guild.guildId}
            onClick={() => { setSelectedGuild(guild); setHoveredGuild(null); }}
            onMouseEnter={() => selectedGuild?.guildId !== guild.guildId && setHoveredGuild(guild.guildId)}
            onMouseLeave={() => setHoveredGuild(null)}
            title={guild.name}
          >
            <div className={`guild-state ${getStateClass({ id: guild.guildId, unread: false }, hoveredGuild, { id: selectedGuild?.guildId })}`} />
            <div className="guild-icon-container">
              <GuildIcon guild={guild} />
            </div>
          </li>
        ))}

        {/* Créer une guilde */}
        <li className="guild-item" key="new-guild-button">
          <div className="guild-icon-container guild-add" onClick={() => setOpen(true)}>
            <BsFillPlusCircleFill size={24} color="white" />
          </div>
        </li>
      </ul>

      <Modal open={open} title={"Créer une guilde"} onClose={() => setOpen(false)}>
        <NewGuildForm
          onClose={() => setOpen(false)}
          onCreated={handleGuildCreated}
        />
      </Modal>
    </aside>
  );
}
