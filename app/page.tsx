"use client";

import { useEffect, useState } from "react";

type PlayerPosition = {
  x: number;
  y: number;
  z: number;
};

type RobloxPlayer = {
  userId: number;
  username: string;
  displayName: string;
  accountAge: number;

  health: number;
  maxHealth: number;

  position: PlayerPosition;

  team: string;
  department: string;

  inVehicle: boolean;
  vehicleName: string | null;

  humanoidState: string;
};

type ServerInfo = {
  serverId: string;
  placeId: number;
  gameId: number;
  playerCount: number;
  maxPlayers: number;
  lastSeen: number;
};

type PlayersApiResponse = {
  success: boolean;
  online: boolean;
  server: ServerInfo | null;
  players: RobloxPlayer[];
};

const menu = [
  "Dashboard",
  "Configuration",
  "Players",
  "Live Monitor",
  "Interactive Map",
  "Console",
  "Lookup",
  "Vehicles",
  "Bans",
  "Admins",
];

export default function Home() {
  const [activePage, setActivePage] = useState("Live Monitor");

  const [players, setPlayers] = useState<RobloxPlayer[]>([]);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [serverOnline, setServerOnline] = useState(false);

  const [selectedPlayer, setSelectedPlayer] =
    useState<RobloxPlayer | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPlayers() {
    try {
      const response = await fetch("/api/roblox/players", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: PlayersApiResponse = await response.json();

      const loadedPlayers = Array.isArray(data.players)
        ? data.players
        : [];

      setPlayers(loadedPlayers);
      setServer(data.server ?? null);
      setServerOnline(Boolean(data.online));
      setLoading(false);

      setSelectedPlayer((current) => {
        if (!current) {
          return null;
        }

        return (
          loadedPlayers.find(
            (player) => player.userId === current.userId
          ) ?? null
        );
      });
    } catch (error) {
      console.error(
        "[SantionV Panel] Players could not be loaded:",
        error
      );

      setPlayers([]);
      setServer(null);
      setServerOnline(false);
      setSelectedPlayer(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlayers();

    const interval = window.setInterval(() => {
      loadPlayers();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const filteredPlayers = players.filter((player) => {
    const query = search.toLowerCase();

    return (
      player.username.toLowerCase().includes(query) ||
      player.displayName.toLowerCase().includes(query) ||
      String(player.userId).includes(query)
    );
  });

  function renderDashboard() {
    return (
      <div className="modulePage">
        <div className="statsGrid">
          <div className="statCard">
            <span>PLAYERS ONLINE</span>
            <strong>{server?.playerCount ?? 0}</strong>
            <small>Current Roblox server</small>
          </div>

          <div className="statCard">
            <span>MAX PLAYERS</span>
            <strong>{server?.maxPlayers ?? 0}</strong>
            <small>Server capacity</small>
          </div>

          <div className="statCard">
            <span>PLACE ID</span>
            <strong className="smallStat">
              {server?.placeId ?? "-"}
            </strong>
            <small>Roblox Place</small>
          </div>

          <div className="statCard">
            <span>SERVER STATUS</span>

            <strong
              className={
                serverOnline ? "greenText" : "redText"
              }
            >
              {serverOnline ? "ONLINE" : "OFFLINE"}
            </strong>

            <small>Heartbeat status</small>
          </div>
        </div>

        <div className="largePanel">
          <h2>Server Overview</h2>

          {serverOnline && server ? (
            <>
              <p>
                SantionV Roblox server is connected to the web panel.
              </p>

              <div className="serverDetails">
                <div>
                  <span>SERVER ID</span>
                  <strong>{server.serverId}</strong>
                </div>

                <div>
                  <span>GAME ID</span>
                  <strong>{server.gameId}</strong>
                </div>

                <div>
                  <span>PLAYERS</span>
                  <strong>
                    {server.playerCount} / {server.maxPlayers}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <p>No active Roblox server heartbeat.</p>
          )}
        </div>
      </div>
    );
  }

  function renderPlayers() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>Players</h2>

              <p>
                Real players currently connected to the Roblox server.
              </p>
            </div>

            <input
              className="normalInput"
              placeholder="Search player..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {loading ? (
            <div className="panelMessage">
              Loading players...
            </div>
          ) : !serverOnline ? (
            <div className="panelMessage">
              Roblox server is offline.
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="panelMessage">
              No players found.
            </div>
          ) : (
            <div className="table">
              <div className="tableHead">
                <span>PLAYER</span>
                <span>HEALTH</span>
                <span>TEAM</span>
                <span>STATE</span>
                <span>ACTION</span>
              </div>

              {filteredPlayers.map((player) => (
                <div
                  className="tableRow"
                  key={player.userId}
                >
                  <span className="tablePlayer">
                    <div className="tablePlayerAvatar">
                      {player.username
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    {player.username}
                  </span>

                  <span>
                    {player.health} / {player.maxHealth}
                  </span>

                  <span>{player.team}</span>

                  <span>{player.humanoidState}</span>

                  <span>
                    <button
                      className="smallButton"
                      onClick={() => {
                        setSelectedPlayer(player);
                        setActivePage("Live Monitor");
                      }}
                    >
                      WATCH
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderLiveMonitor() {
    return (
      <div className="monitor">
        <div className="monitorMain">
          <div className="monitorToolbar">
            <select
              value={selectedPlayer?.userId ?? ""}
              onChange={(event) => {
                const userId = Number(event.target.value);

                setSelectedPlayer(
                  players.find(
                    (player) => player.userId === userId
                  ) ?? null
                );
              }}
            >
              <option value="">Select Player...</option>

              {players.map((player) => (
                <option
                  value={player.userId}
                  key={player.userId}
                >
                  {player.username}
                </option>
              ))}
            </select>

            <button
              className="greenButton"
              onClick={() => {
                if (!selectedPlayer && players.length > 0) {
                  setSelectedPlayer(players[0]);
                }
              }}
            >
              Start Watch
            </button>

            <button onClick={loadPlayers}>
              Refresh
            </button>

            <button className="yellowButton">
              Watch Admins
            </button>

            <button
              className="redButton"
              onClick={() => setSelectedPlayer(null)}
            >
              Stop All
            </button>

            <span className="ready">
              Players ready: <b>{players.length}</b>
            </span>
          </div>

          <div className="watchArea">
            {!serverOnline ? (
              <div className="emptyState">
                <div className="radar">
                  <div className="radarDot offlineDot" />
                </div>

                <h2>Server Offline</h2>

                <p>
                  Waiting for Roblox heartbeat.
                </p>
              </div>
            ) : selectedPlayer ? (
              <div className="selectedCard livePlayerCard">
                <div className="selectedAvatar">
                  {selectedPlayer.username
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <p>NOW WATCHING</p>

                <h2>{selectedPlayer.username}</h2>

                <span className="displayNameText">
                  {selectedPlayer.displayName}
                </span>

                <div className="healthBlock">
                  <div className="healthHeader">
                    <span>HEALTH</span>

                    <strong>
                      {selectedPlayer.health} /{" "}
                      {selectedPlayer.maxHealth}
                    </strong>
                  </div>

                  <div className="healthBar">
                    <div
                      className="healthFill"
                      style={{
                        width: `${
                          selectedPlayer.maxHealth > 0
                            ? Math.max(
                                0,
                                Math.min(
                                  100,
                                  (selectedPlayer.health /
                                    selectedPlayer.maxHealth) *
                                    100
                                )
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="liveStatsGrid">
                  <div>
                    <span>USER ID</span>
                    <strong>
                      {selectedPlayer.userId}
                    </strong>
                  </div>

                  <div>
                    <span>ACCOUNT AGE</span>
                    <strong>
                      {selectedPlayer.accountAge} days
                    </strong>
                  </div>

                  <div>
                    <span>STATE</span>
                    <strong className="greenText">
                      {selectedPlayer.humanoidState}
                    </strong>
                  </div>

                  <div>
                    <span>TEAM</span>
                    <strong>
                      {selectedPlayer.team || "None"}
                    </strong>
                  </div>

                  <div>
                    <span>DEPARTMENT</span>
                    <strong>
                      {selectedPlayer.department || "None"}
                    </strong>
                  </div>

                  <div>
                    <span>VEHICLE</span>
                    <strong>
                      {selectedPlayer.inVehicle
                        ? selectedPlayer.vehicleName ??
                          "Vehicle"
                        : "On Foot"}
                    </strong>
                  </div>
                </div>

                <div className="positionPanel">
                  <div className="positionTitle">
                    LIVE POSITION
                  </div>

                  <div className="positionGrid">
                    <div>
                      <span>X</span>
                      <strong>
                        {selectedPlayer.position?.x ?? 0}
                      </strong>
                    </div>

                    <div>
                      <span>Y</span>
                      <strong>
                        {selectedPlayer.position?.y ?? 0}
                      </strong>
                    </div>

                    <div>
                      <span>Z</span>
                      <strong>
                        {selectedPlayer.position?.z ?? 0}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="emptyState">
                <div className="radar">
                  <div className="radarDot" />
                </div>

                <h2>Live Monitor</h2>

                <p>
                  Select a real Roblox player to start
                  monitoring.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="playerPanel">
          <div className="playerSearch">
            <input
              placeholder="Search player..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <div className="serverConnection">
              <span
                className={
                  serverOnline
                    ? "connectionDot"
                    : "connectionDot offline"
                }
              />

              {serverOnline
                ? "Roblox server connected"
                : "Roblox server offline"}
            </div>
          </div>

          <div className="playerList">
            {loading ? (
              <div className="playerPanelMessage">
                Loading...
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="playerPanelMessage">
                No online players.
              </div>
            ) : (
              filteredPlayers.map((player) => (
                <div
                  className={
                    selectedPlayer?.userId === player.userId
                      ? "playerCard selectedPlayerRow"
                      : "playerCard"
                  }
                  key={player.userId}
                  onClick={() =>
                    setSelectedPlayer(player)
                  }
                >
                  <div className="playerAvatar">
                    {player.username
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="playerInfo">
                    <div className="playerName">
                      <strong>{player.username}</strong>
                    </div>

                    <div className="realPlayerId">
                      HP: {player.health}/{player.maxHealth}
                    </div>

                    <div className="flags">
                      ● {player.humanoidState}
                    </div>
                  </div>

                  <button
                    className="watchButton"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPlayer(player);
                    }}
                  >
                    WATCH
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    );
  }

  function renderPlaceholder(title: string) {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>{title}</h2>

          <p>
            This module will be connected to the SantionV
            Roblox backend next.
          </p>
        </div>
      </div>
    );
  }

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return renderDashboard();

      case "Players":
        return renderPlayers();

      case "Live Monitor":
        return renderLiveMonitor();

      case "Configuration":
        return renderPlaceholder("Configuration");

      case "Interactive Map":
        return renderPlaceholder("Interactive Map");

      case "Console":
        return renderPlaceholder("Console");

      case "Lookup":
        return renderPlaceholder("Lookup");

      case "Vehicles":
        return renderPlaceholder("Vehicles");

      case "Bans":
        return renderPlaceholder("Bans");

      case "Admins":
        return renderPlaceholder("Admins");

      default:
        return renderLiveMonitor();
    }
  }

  return (
    <main className="panel">
      <aside className="sidebar">
        <div className="logo">
          <div className="logoIcon">S</div>

          <div>
            <strong>SantionV</strong>
            <span>ROBLOX ADMIN</span>
          </div>
        </div>

        <div className="serverSelector">
          <span
            className={
              serverOnline
                ? "serverDot"
                : "serverDot serverDotOffline"
            }
          />

          <div>
            <small>SERVER</small>

            <strong>
              {serverOnline
                ? "SantionV Roleplay"
                : "Server Offline"}
            </strong>
          </div>

          <span>⌄</span>
        </div>

        <nav>
          <p className="menuTitle">GENERAL</p>

          <button
            className={
              activePage === "Dashboard"
                ? "navItem active"
                : "navItem"
            }
            onClick={() =>
              setActivePage("Dashboard")
            }
          >
            <span>▣</span>
            Dashboard
          </button>

          <p className="menuTitle">SERVER</p>

          {menu.slice(1).map((item) => (
            <button
              key={item}
              className={
                activePage === item
                  ? "navItem active"
                  : "navItem"
              }
              onClick={() => setActivePage(item)}
            >
              <span>▣</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="account">
          <div className="avatar">S</div>

          <div>
            <strong>SantionV</strong>
            <span>Web Panel</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <span
              className={
                serverOnline
                  ? "statusDot"
                  : "statusDot statusDotOffline"
              }
            />

            <span>
              {serverOnline
                ? "SERVER ONLINE"
                : "SERVER OFFLINE"}
            </span>
          </div>

          <div className="topRight">
            <span>
              {players.length} Player
              {players.length === 1 ? "" : "s"}
            </span>

            <button onClick={loadPlayers}>
              ↻
            </button>
          </div>
        </header>

        <div className="pageHeader">
          <div>
            <p>SANTIONV / ROBLOX</p>
            <h1>{activePage}</h1>
          </div>

          <div
            className={
              serverOnline
                ? "onlineBadge"
                : "onlineBadge offlineBadge"
            }
          >
            <span />

            {serverOnline ? "LIVE" : "OFFLINE"}
          </div>
        </div>

        {renderPage()}
      </section>
    </main>
  );
}