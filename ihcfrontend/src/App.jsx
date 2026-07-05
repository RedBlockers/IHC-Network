import { Routes, Route, Link } from "react-router-dom";
import GuildsSidebar from "./components/guilds/guildsSidebar";
import { GuildProvider, useGuild } from "./context/guildContext";
import { useAuth } from "./context/authContext";

import ContextHeader from "./components/context header/contextHeader";
import UserCard from "./components/userCard/userCard";
import LoadingScreen from "./components/ui/loadingScreen";
import { useEffect, useState, useCallback } from "react";
import { api } from "./api/api";
import "./css/global.css";
import "./css/layout.css";

function App() {
  const { user, setUser } = useAuth();
  const [guilds, setGuilds] = useState([]);

  const refreshGuilds = useCallback(async () => {
    const data = await api("/users/me/guilds");
    setGuilds(data);
  }, []);

  useEffect(() => {
    async function loadUser() {
      const me = await api("/users/me");
      setUser(me.user);
      await refreshGuilds();
    }
    loadUser();
  }, [setUser, refreshGuilds]);

  if (!user) return <LoadingScreen />;

  return (
    <GuildProvider>
      <div className="layout">
        <ContextHeader />

        <GuildsSidebar guilds={guilds} onGuildCreated={refreshGuilds} />
        <aside className="navigation-sidebar">navigation</aside>
        <header className="toolbar"></header>

        <main className="main">
          <section className="content">Content</section>
        </main>

        <aside className="activity-sidebar">Activity</aside>
        <UserCard />
      </div>
    </GuildProvider>
  );
}

export default App;
