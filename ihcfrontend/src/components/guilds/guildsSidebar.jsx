//import mockGuilds from "../../assets/mocks/guildsMock.json";

import { BsFillPlusCircleFill } from "react-icons/bs";
import "./guildsSidebar.css";
import { GuildProvider, useGuild, HOME } from "../../context/guildContext";
import { useState } from "react";
import "./guildsState.css";
//import guildsMock from "../../assets/mocks/guildsMock.json";
import Modal from "../ui/modal.jsx";

function getStateClass(guild, hoveredGuild, selectedGuild) {
  if (selectedGuild.id === guild.id) {
    return "selected";
  } else if (hoveredGuild === guild.id) {
    console.log("Hovering over guild:", guild.id);
    return "hovered";
  } else if (guild.unread) {
    return "unread";
  } else {
    return "";
  }
}

export default function GuildsSidebar() {
  const [hoveredGuild, setHoveredGuild] = useState(null);
  const { selectedGuild, setSelectedGuild } = useGuild();
  const [open, setOpen] = useState(false);
  const guildsMock = null;

  return (
    <aside className="guild-sidebar">
      <ul className="guild-list">
        <li
          className="guild-item"
          key={HOME.id}
          onClick={() => {
            setSelectedGuild(HOME);
            setHoveredGuild(null);
          }}
          onMouseEnter={() =>
            selectedGuild !== "home" && setHoveredGuild("home")
          }
          onMouseLeave={() => setHoveredGuild(null)}
        >
          <div
            className={`guild-state ${getStateClass(HOME, hoveredGuild, selectedGuild)}`}
          ></div>
          <div className="guild-icon-container">
            <img src="/qweillo_monocrhome.png" className="guild-icon"></img>
          </div>
        </li>
        <hr className="guild-sidebar-separator" />
        {guildsMock &&
          guildsMock.map((guild) => (
            <li
              className="guild-item"
              key={guild.id}
              onClick={() => {
                setSelectedGuild(guild);
                setHoveredGuild(null);
              }}
              onMouseEnter={() =>
                selectedGuild !== guild.id && setHoveredGuild(guild.id)
              }
              onMouseLeave={() => setHoveredGuild(null)}
            >
              <div
                className={`guild-state ${getStateClass(guild, hoveredGuild, selectedGuild)}`}
              ></div>
              <div className="guild-icon-container">
                <img
                  className="guild-icon"
                  src={guild.icon}
                  alt={`${guild.name} icon`}
                />
              </div>
            </li>
          ))}
        <li className="guild-item" key="new-guild-button">
          <div
            className="guild-icon-container guild-add"
            onClick={() => setOpen(true)}
          >
            <BsFillPlusCircleFill size={24} color="white" />
          </div>
        </li>
      </ul>
      <Modal
        open={open}
        title={"Créer une guilde"}
        onClose={() => setOpen(false)}
      >
        
      </Modal>
    </aside>
  );
}
