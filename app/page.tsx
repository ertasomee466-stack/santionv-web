"use client";

import { useEffect, useMemo, useState } from "react";

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

type ConsoleItem = {
  id: number;
  time: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
};

const pages = [
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

function healthPercent(player: RobloxPlayer) {
  if (!player.maxHealth || player.maxHealth <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, (player.health / player.maxHealth) * 100)
  );
}

function formatPosition(value?: number) {
  if (typeof value !== "number") {
    return "0.0";
  }

  return value.toFixed(1);
}

function getNowTime() {
  return new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Home() {
  const [activePage, setActivePage] = useState("Live Monitor");

  const [players, setPlayers] = useState<RobloxPlayer[]>([]);
  const [server, setServer] = useState<ServerInfo | null>(null);

  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] =
    useState<RobloxPlayer | null>(null);

  const [search, setSearch] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");

  const [consoleItems, setConsoleItems] = useState<ConsoleItem[]>([]);
  const [lastPlayerCount, setLastPlayerCount] = useState<number | null>(
    null
  );

  function addConsole(
    type: ConsoleItem["type"],
    message: string
  ) {
    setConsoleItems((current) => {
      const next: ConsoleItem = {
        id: Date.now() + Math.random(),
        time: getNowTime(),
        type,
        message,
      };

      return [next, ...current].slice(0, 100);
    });
  }

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

      setSelectedPlayer((currentPlayer) => {
        if (!currentPlayer) {
          return null;
        }

        return (
          loadedPlayers.find(
            (player) =>
              player.userId === currentPlayer.userId
          ) ?? null
        );
      });

      if (lastPlayerCount !== null) {
        if (loadedPlayers.length > lastPlayerCount) {
          addConsole(
            "success",
            `Player joined. Online players: ${loadedPlayers.length}`
          );
        }

        if (loadedPlayers.length < lastPlayerCount) {
          addConsole(
            "warning",
            `Player left. Online players: ${loadedPlayers.length}`
          );
        }
      }

      setLastPlayerCount(loadedPlayers.length);
    } catch (error) {
      console.error(
        "[SantionV Panel] Player API error:",
        error
      );

      setPlayers([]);
      setServer(null);
      setServerOnline(false);
      setSelectedPlayer(null);
      setLoading(false);

      addConsole(
        "error",
        "Roblox player API could not be loaded."
      );
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

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return players;
    }

    return players.filter((player) => {
      return (
        player.username.toLowerCase().includes(query) ||
        player.displayName.toLowerCase().includes(query) ||
        String(player.userId).includes(query) ||
        player.team.toLowerCase().includes(query) ||
        player.department.toLowerCase().includes(query)
      );
    });
  }, [players, search]);

  const lookupResults = useMemo(() => {
    const query = lookupQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return players.filter((player) => {
      return (
        player.username.toLowerCase().includes(query) ||
        player.displayName.toLowerCase().includes(query) ||
        String(player.userId).includes(query)
      );
    });
  }, [players, lookupQuery]);

  const playersInVehicles = players.filter(
    (player) => player.inVehicle
  );

  const teams = useMemo(() => {
    const teamMap = new Map<string, number>();

    players.forEach((player) => {
      const name =
        player.team && player.team !== ""
          ? player.team
          : "None";

      teamMap.set(name, (teamMap.get(name) ?? 0) + 1);
    });

    return Array.from(teamMap.entries());
  }, [players]);

  function watchPlayer(player: RobloxPlayer) {
    setSelectedPlayer(player);
    setActivePage("Live Monitor");

    addConsole(
      "info",
      `Monitoring started for ${player.username}.`
    );
  }

  function renderDashboard() {
    return (
      <div className="modulePage">
        <div className="statsGrid">
          <div className="statCard">
            <span>PLAYERS ONLINE</span>
            <strong>{players.length}</strong>
            <small>Current connected players</small>
          </div>

          <div className="statCard">
            <span>SERVER CAPACITY</span>

            <strong>
              {server?.playerCount ?? 0}/
              {server?.maxPlayers ?? 0}
            </strong>

            <small>Current server usage</small>
          </div>

          <div className="statCard">
            <span>VEHICLES IN USE</span>
            <strong>{playersInVehicles.length}</strong>
            <small>Players currently seated</small>
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

            <small>Heartbeat connection</small>
          </div>
        </div>

        <div className="largePanel">
          <h2>Server Overview</h2>

          {server ? (
            <div className="serverDetails">
              <div>
                <span>SERVER ID</span>
                <strong>{server.serverId}</strong>
              </div>

              <div>
                <span>PLACE ID</span>
                <strong>{server.placeId}</strong>
              </div>

              <div>
                <span>GAME ID</span>
                <strong>{server.gameId}</strong>
              </div>
            </div>
          ) : (
            <div className="panelMessage">
              No active server.
            </div>
          )}
        </div>

        <div className="largePanel">
          <h2>Teams / Departments</h2>

          {teams.length === 0 ? (
            <div className="panelMessage">
              No team data available.
            </div>
          ) : (
            <div className="simpleGrid">
              {teams.map(([team, count]) => (
                <div
                  className="simpleInfoCard"
                  key={team}
                >
                  <span>{team}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderConfiguration() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>Server Configuration</h2>

          <div className="serverDetails">
            <div>
              <span>HEARTBEAT</span>
              <strong>3s panel refresh</strong>
            </div>

            <div>
              <span>SERVER</span>
              <strong>
                {serverOnline ? "Connected" : "Offline"}
              </strong>
            </div>

            <div>
              <span>MAX PLAYERS</span>
              <strong>{server?.maxPlayers ?? 0}</strong>
            </div>

            <div>
              <span>PLACE ID</span>
              <strong>{server?.placeId ?? "-"}</strong>
            </div>

            <div>
              <span>GAME ID</span>
              <strong>{server?.gameId ?? "-"}</strong>
            </div>

            <div>
              <span>DATA SOURCE</span>
              <strong>Upstash Redis</strong>
            </div>
          </div>
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
              <h2>Online Players</h2>

              <p>
                Real-time Roblox player information.
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
              Loading...
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="panelMessage">
              No online players.
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

                    <div>
                      <strong>{player.username}</strong>

                      <small>
                        {player.displayName}
                      </small>
                    </div>
                  </span>

                  <span>
                    {player.health}/{player.maxHealth}
                  </span>

                  <span>
                    {player.team || "None"}
                  </span>

                  <span>{player.humanoidState}</span>

                  <span>
                    <button
                      className="smallButton"
                      onClick={() =>
                        watchPlayer(player)
                      }
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
                const id = Number(event.target.value);

                const found =
                  players.find(
                    (player) => player.userId === id
                  ) ?? null;

                setSelectedPlayer(found);
              }}
            >
              <option value="">
                Select Player...
              </option>

              {players.map((player) => (
                <option
                  key={player.userId}
                  value={player.userId}
                >
                  {player.username}
                </option>
              ))}
            </select>

            <button
              className="greenButton"
              onClick={() => {
                if (
                  !selectedPlayer &&
                  players.length > 0
                ) {
                  watchPlayer(players[0]);
                }
              }}
            >
              Start Watch
            </button>

            <button onClick={loadPlayers}>
              Refresh
            </button>

            <button
              className="yellowButton"
              onClick={() => {
                const adminPlayer = players.find(
                  (player) =>
                    player.team
                      .toLowerCase()
                      .includes("admin") ||
                    player.department
                      .toLowerCase()
                      .includes("admin")
                );

                if (adminPlayer) {
                  watchPlayer(adminPlayer);
                }
              }}
            >
              Watch Admins
            </button>

            <button
              className="redButton"
              onClick={() => {
                setSelectedPlayer(null);

                addConsole(
                  "warning",
                  "Monitoring stopped."
                );
              }}
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
            ) : !selectedPlayer ? (
              <div className="emptyState">
                <div className="radar">
                  <div className="radarDot" />
                </div>

                <h2>Live Monitor</h2>

                <p>
                  Select a Roblox player to monitor.
                </p>
              </div>
            ) : (
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
                        width: `${healthPercent(
                          selectedPlayer
                        )}%`,
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
                      {selectedPlayer.accountAge}d
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
                      {selectedPlayer.department ||
                        "None"}
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
                        {formatPosition(
                          selectedPlayer.position?.x
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Y</span>
                      <strong>
                        {formatPosition(
                          selectedPlayer.position?.y
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Z</span>
                      <strong>
                        {formatPosition(
                          selectedPlayer.position?.z
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="commandPreview">
                  <div className="positionTitle">
                    ADMIN ACTIONS
                  </div>

                  <div className="commandGrid">
                    <button disabled>HEAL</button>
                    <button disabled>RESPAWN</button>
                    <button disabled>BRING</button>
                    <button disabled>GOTO</button>
                    <button disabled>FREEZE</button>
                    <button disabled>KICK</button>
                  </div>

                  <small>
                    Command backend will be connected next.
                  </small>
                </div>
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
            {filteredPlayers.map((player) => (
              <div
                key={player.userId}
                className={
                  selectedPlayer?.userId === player.userId
                    ? "playerCard selectedPlayerRow"
                    : "playerCard"
                }
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
                    {player.username}
                  </div>

                  <div className="realPlayerId">
                    HP: {player.health}/
                    {player.maxHealth}
                  </div>

                  <div className="flags">
                    ● {player.humanoidState}
                  </div>
                </div>

                <button
                  className="watchButton"
                  onClick={(event) => {
                    event.stopPropagation();

                    watchPlayer(player);
                  }}
                >
                  WATCH
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    );
  }

  function renderInteractiveMap() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>Interactive Map</h2>
              <p>
                Live X / Z player positions.
              </p>
            </div>
          </div>

          <div className="mapBoard">
            {players.map((player) => {
              const x =
                ((player.position?.x ?? 0) % 500) / 10;

              const z =
                ((player.position?.z ?? 0) % 500) / 10;

              return (
                <button
                  key={player.userId}
                  className="mapPlayerDot"
                  style={{
                    left: `${50 + x}%`,
                    top: `${50 + z}%`,
                  }}
                  onClick={() =>
                    watchPlayer(player)
                  }
                  title={player.username}
                >
                  {player.username
                    .charAt(0)
                    .toUpperCase()}
                </button>
              );
            })}

            <div className="mapCenterCross">
              +
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderConsole() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>Console</h2>
              <p>Web panel activity log.</p>
            </div>

            <button
              className="smallButton"
              onClick={() => setConsoleItems([])}
            >
              CLEAR
            </button>
          </div>

          <div className="consoleBox">
            {consoleItems.length === 0 ? (
              <div className="panelMessage">
                No console events.
              </div>
            ) : (
              consoleItems.map((item) => (
                <div
                  className={`consoleLine ${item.type}`}
                  key={item.id}
                >
                  <span>{item.time}</span>
                  <strong>{item.type}</strong>
                  <p>{item.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderLookup() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>Player Lookup</h2>

              <p>
                Search currently connected players.
              </p>
            </div>

            <input
              className="normalInput"
              placeholder="Username / User ID..."
              value={lookupQuery}
              onChange={(event) =>
                setLookupQuery(event.target.value)
              }
            />
          </div>

          {lookupQuery && lookupResults.length === 0 ? (
            <div className="panelMessage">
              Player not found on current server.
            </div>
          ) : (
            <div className="lookupGrid">
              {lookupResults.map((player) => (
                <div
                  className="lookupCard"
                  key={player.userId}
                >
                  <div className="playerAvatar">
                    {player.username
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <h3>{player.username}</h3>

                  <span>{player.displayName}</span>

                  <p>User ID: {player.userId}</p>
                  <p>
                    Account: {player.accountAge} days
                  </p>
                  <p>
                    HP: {player.health}/
                    {player.maxHealth}
                  </p>
                  <p>Team: {player.team}</p>

                  <button
                    className="smallButton"
                    onClick={() =>
                      watchPlayer(player)
                    }
                  >
                    WATCH
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderVehicles() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>Active Vehicles</h2>

          <p>
            Vehicles currently occupied by players.
          </p>

          {playersInVehicles.length === 0 ? (
            <div className="panelMessage">
              No occupied vehicles.
            </div>
          ) : (
            <div className="vehicleGrid">
              {playersInVehicles.map((player) => (
                <div
                  className="vehicleCard"
                  key={player.userId}
                >
                  <span>VEHICLE</span>

                  <h3>
                    {player.vehicleName ?? "Vehicle"}
                  </h3>

                  <p>Driver: {player.username}</p>

                  <p>
                    Position:{" "}
                    {formatPosition(
                      player.position?.x
                    )}
                    ,{" "}
                    {formatPosition(
                      player.position?.y
                    )}
                    ,{" "}
                    {formatPosition(
                      player.position?.z
                    )}
                  </p>

                  <button
                    className="smallButton"
                    onClick={() =>
                      watchPlayer(player)
                    }
                  >
                    WATCH DRIVER
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderBans() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>Bans</h2>

          <p>
            Ban database and Roblox command system will be
            connected in the next backend stage.
          </p>

          <div className="panelMessage">
            No ban backend connected yet.
          </div>
        </div>
      </div>
    );
  }

  function renderAdmins() {
    const adminPlayers = players.filter(
      (player) =>
        player.team
          .toLowerCase()
          .includes("admin") ||
        player.department
          .toLowerCase()
          .includes("admin")
    );

    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>Online Admins</h2>

          {adminPlayers.length === 0 ? (
            <div className="panelMessage">
              No detected admins online.
            </div>
          ) : (
            <div className="lookupGrid">
              {adminPlayers.map((player) => (
                <div
                  className="lookupCard"
                  key={player.userId}
                >
                  <h3>{player.username}</h3>

                  <p>Team: {player.team}</p>

                  <p>
                    Department: {player.department}
                  </p>

                  <button
                    className="smallButton"
                    onClick={() =>
                      watchPlayer(player)
                    }
                  >
                    WATCH
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return renderDashboard();

      case "Configuration":
        return renderConfiguration();

      case "Players":
        return renderPlayers();

      case "Live Monitor":
        return renderLiveMonitor();

      case "Interactive Map":
        return renderInteractiveMap();

      case "Console":
        return renderConsole();

      case "Lookup":
        return renderLookup();

      case "Vehicles":
        return renderVehicles();

      case "Bans":
        return renderBans();

      case "Admins":
        return renderAdmins();

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

          {pages.map((page, index) => (
            <div key={page}>
              {index === 1 && (
                <p className="menuTitle">
                  SERVER
                </p>
              )}

              <button
                className={
                  activePage === page
                    ? "navItem active"
                    : "navItem"
                }
                onClick={() =>
                  setActivePage(page)
                }
              >
                <span>▣</span>
                {page}
              </button>
            </div>
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