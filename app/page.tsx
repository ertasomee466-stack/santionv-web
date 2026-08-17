"use client";

import { useState } from "react";

type Player = {
  id: number;
  username: string;
  displayName: string;
  risk: number;
  flags: number;
};

const players: Player[] = [
  { id: 10, username: "FlameDrift", displayName: "FlameDrift", risk: 95, flags: 0 },
  { id: 8, username: "IceVenom", displayName: "IceVenom", risk: 78, flags: 0 },
  { id: 6, username: "ShadowBlitz", displayName: "ShadowBlitz", risk: 67, flags: 0 },
  { id: 5, username: "RazeEffect", displayName: "RazeEffect", risk: 15, flags: 3 },
];

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
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [search, setSearch] = useState("");

  const filteredPlayers = players.filter((player) =>
    player.username.toLowerCase().includes(search.toLowerCase())
  );

  function renderPage() {
    if (activePage === "Dashboard") {
      return (
        <div className="modulePage">
          <div className="statsGrid">
            <div className="statCard">
              <span>PLAYERS ONLINE</span>
              <strong>4</strong>
              <small>Current server</small>
            </div>

            <div className="statCard">
              <span>ACTIVE ADMINS</span>
              <strong>2</strong>
              <small>Staff online</small>
            </div>

            <div className="statCard">
              <span>TOTAL BANS</span>
              <strong>23</strong>
              <small>Stored bans</small>
            </div>

            <div className="statCard">
              <span>SERVER STATUS</span>
              <strong className="greenText">ONLINE</strong>
              <small>Roblox server</small>
            </div>
          </div>

          <div className="largePanel">
            <h2>Server Overview</h2>
            <p>
              This dashboard will show live Roblox server information when the
              backend connection is completed.
            </p>
          </div>
        </div>
      );
    }

    if (activePage === "Configuration") {
      return (
        <div className="modulePage">
          <div className="largePanel">
            <h2>Server Configuration</h2>

            <div className="settingRow">
              <div>
                <strong>Server Lock</strong>
                <span>Prevent new players from joining.</span>
              </div>

              <button className="greenButton">Enable</button>
            </div>

            <div className="settingRow">
              <div>
                <strong>Maintenance Mode</strong>
                <span>Put the Roblox server into maintenance.</span>
              </div>

              <button>Disabled</button>
            </div>

            <div className="settingRow">
              <div>
                <strong>Anti-Cheat Logging</strong>
                <span>Send detected activity to the web panel.</span>
              </div>

              <button className="greenButton">Enabled</button>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Players") {
      return (
        <div className="modulePage">
          <div className="largePanel">
            <div className="panelHeading">
              <div>
                <h2>Players</h2>
                <p>Players currently connected to the Roblox server.</p>
              </div>

              <input
                className="normalInput"
                placeholder="Search player..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="table">
              <div className="tableHead">
                <span>PLAYER</span>
                <span>SERVER ID</span>
                <span>RISK</span>
                <span>FLAGS</span>
                <span>ACTION</span>
              </div>

              {filteredPlayers.map((player) => (
                <div className="tableRow" key={player.id}>
                  <span>{player.username}</span>
                  <span>#{player.id}</span>
                  <span>{player.risk}%</span>
                  <span>{player.flags}</span>

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
          </div>
        </div>
      );
    }

    if (activePage === "Live Monitor") {
      return (
        <div className="monitor">
          <div className="monitorMain">
            <div className="monitorToolbar">
              <select
                value={selectedPlayer?.id ?? ""}
                onChange={(event) => {
                  const id = Number(event.target.value);

                  setSelectedPlayer(
                    players.find((player) => player.id === id) ?? null
                  );
                }}
              >
                <option value="">Select Player...</option>

                {players.map((player) => (
                  <option value={player.id} key={player.id}>
                    {player.username}
                  </option>
                ))}
              </select>

              <button className="greenButton">Start Watch</button>
              <button>Recently Connected</button>
              <button className="yellowButton">Watch Admins</button>
              <button className="redButton">Stop All</button>

              <span className="ready">
                Players ready: <b>{players.length}</b>
              </span>
            </div>

            <div className="watchArea">
              {selectedPlayer ? (
                <div className="selectedCard">
                  <div className="selectedAvatar">
                    {selectedPlayer.username.charAt(0)}
                  </div>

                  <p>NOW WATCHING</p>
                  <h2>{selectedPlayer.username}</h2>

                  <div className="selectedStats">
                    <div>
                      <span>SERVER ID</span>
                      <strong>{selectedPlayer.id}</strong>
                    </div>

                    <div>
                      <span>RISK SCORE</span>
                      <strong>{selectedPlayer.risk}%</strong>
                    </div>

                    <div>
                      <span>FLAGS</span>
                      <strong>{selectedPlayer.flags}</strong>
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
                    Select a Roblox player and press Start Watch to begin
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
                onChange={(event) => setSearch(event.target.value)}
              />

              <label>
                <input type="checkbox" />
                Show Only Dangerous
              </label>
            </div>

            <div className="playerList">
              {filteredPlayers.map((player) => (
                <div
                  className="playerCard"
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                >
                  <div className="playerAvatar">
                    {player.username.charAt(0)}
                  </div>

                  <div className="playerInfo">
                    <div className="playerName">
                      <strong>{player.username}</strong>
                      <span>[{player.id}]</span>
                    </div>

                    <div
                      className={
                        player.risk <= 30 ? "risk dangerous" : "risk safe"
                      }
                    >
                      SCORE: {player.risk}%
                    </div>

                    <div
                      className={
                        player.flags > 0 ? "flags dangerFlags" : "flags"
                      }
                    >
                      ● {player.flags} CHEAT FLAGS
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
              ))}
            </div>
          </aside>
        </div>
      );
    }

    if (activePage === "Interactive Map") {
      return (
        <div className="modulePage">
          <div className="largePanel mapPanel">
            <div className="mapGrid">
              <span className="mapPlayer mapPlayer1">● FlameDrift</span>
              <span className="mapPlayer mapPlayer2">● IceVenom</span>
              <span className="mapPlayer mapPlayer3">● ShadowBlitz</span>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Console") {
      return (
        <div className="modulePage">
          <div className="consoleBox">
            <div className="consoleLine">
              <span>[SYSTEM]</span> SantionV server started.
            </div>

            <div className="consoleLine">
              <span>[PLAYER]</span> FlameDrift joined the server.
            </div>

            <div className="consoleLine">
              <span>[ADMIN]</span> FarukErtas authenticated.
            </div>

            <div className="consoleInput">
              <span>&gt;</span>
              <input placeholder="Enter server command..." />
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Lookup") {
      return (
        <div className="modulePage">
          <div className="largePanel">
            <h2>Player Lookup</h2>
            <p>Search a Roblox username or UserId.</p>

            <div className="lookupBox">
              <input placeholder="Username or UserId..." />
              <button className="greenButton">Search</button>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Vehicles") {
      return (
        <div className="modulePage">
          <div className="largePanel">
            <h2>Vehicles</h2>

            <div className="vehicleGrid">
              <div className="vehicleCard">
                <strong>Police Cruiser</strong>
                <span>Police</span>
                <button>Spawn</button>
              </div>

              <div className="vehicleCard">
                <strong>Ambulance</strong>
                <span>EMS</span>
                <button>Spawn</button>
              </div>

              <div className="vehicleCard">
                <strong>Sedan</strong>
                <span>Civilian</span>
                <button>Spawn</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Bans") {
      return (
        <div className="modulePage">
          <div className="largePanel">
            <div className="panelHeading">
              <div>
                <h2>Bans</h2>
                <p>Roblox moderation ban records.</p>
              </div>

              <button className="redButton">New Ban</button>
            </div>

            <div className="table">
              <div className="tableHead">
                <span>PLAYER</span>
                <span>USER ID</span>
                <span>REASON</span>
                <span>ADMIN</span>
                <span>ACTION</span>
              </div>

              <div className="tableRow">
                <span>ExamplePlayer</span>
                <span>123456789</span>
                <span>Exploiting</span>
                <span>FarukErtas</span>
                <span>
                  <button className="smallButton">UNBAN</button>
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Admins") {
      return (
        <div className="modulePage">
          <div className="largePanel">
            <div className="panelHeading">
              <div>
                <h2>Admins</h2>
                <p>Roblox administration permissions.</p>
              </div>

              <button className="greenButton">Add Admin</button>
            </div>

            <div className="adminCard">
              <div className="adminAvatar">F</div>

              <div>
                <strong>FarukErtas</strong>
                <span>Owner</span>
              </div>

              <div className="adminStatus">ONLINE</div>
            </div>
          </div>
        </div>
      );
    }

    return null;
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
          <span className="serverDot" />

          <div>
            <small>SERVER</small>
            <strong>SantionV Roleplay</strong>
          </div>

          <span>⌄</span>
        </div>

        <nav>
          <p className="menuTitle">GENERAL</p>

          <button
            className={activePage === "Dashboard" ? "navItem active" : "navItem"}
            onClick={() => setActivePage("Dashboard")}
          >
            <span>▣</span>
            Dashboard
          </button>

          <p className="menuTitle">SERVER</p>

          {menu.slice(1).map((item) => (
            <button
              key={item}
              className={activePage === item ? "navItem active" : "navItem"}
              onClick={() => setActivePage(item)}
            >
              <span>▣</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="account">
          <div className="avatar">F</div>

          <div>
            <strong>FarukErtas</strong>
            <span>Owner</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <span className="statusDot" />
            <span>SERVER ONLINE</span>
          </div>

          <div className="topRight">
            <span>4 Players</span>
            <button>⚙</button>
          </div>
        </header>

        <div className="pageHeader">
          <div>
            <p>SANTIONV / SERVER</p>
            <h1>{activePage}</h1>
          </div>

          <div className="onlineBadge">
            <span />
            LIVE
          </div>
        </div>

        {renderPage()}
      </section>
    </main>
  );
}