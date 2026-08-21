"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type AdminCommand =
  | "heal"
  | "respawn"
  | "freeze"
  | "unfreeze"
  | "kick"
  | "bring"
  | "goto";

type AdminPermission =
  | "players"
  | "commands"
  | "bans"
  | "vehicles"
  | "logs"
  | "config"
  | "admins";

type BanRecord = {
  userId: number;
  username?: string;
  reason: string;
  bannedBy: string;

  createdAt: number;
  expiresAt: number | null;

  permanent: boolean;
};

type AdminRecord = {
  userId: number;

  username: string;
  displayName?: string;

  role: string;
  level: number;

  permissions: AdminPermission[];

  active: boolean;

  addedBy: string;

  createdAt: number;
  updatedAt: number;
};

type VehicleRecord = {
  id: string;

  name: string;
  model?: string;

  ownerUserId?: number | null;
  ownerUsername?: string | null;

  driverUserId?: number | null;
  driverUsername?: string | null;

  locked: boolean;
  engineOn: boolean;
  spawned: boolean;

  health?: number;
  fuel?: number;

  position?: PlayerPosition;

  createdAt: number;
  updatedAt: number;
};

type LogRecord = {
  id: string;

  level:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "admin"
    | "vehicle"
    | "ban"
    | "player";

  message: string;

  userId?: number | null;
  username?: string | null;

  action?: string | null;
  source?: string | null;

  createdAt: number;
};

type ServerConfig = {
  maintenanceMode: boolean;
  serverLocked: boolean;

  joinMessage: string;
  maintenanceMessage: string;

  maxPlayersOverride: number | null;

  commandsEnabled: boolean;
  bansEnabled: boolean;
  vehiclesEnabled: boolean;
  logsEnabled: boolean;

  autoKickBannedPlayers: boolean;

  heartbeatInterval: number;
  commandInterval: number;

  updatedAt: number;
  updatedBy: string;
};

type LookupUser = {
  userId: number;
  username: string;
  displayName: string;
  description: string;
  created: string | null;
  isBanned: boolean;
};

type ToastKind = "success" | "error" | "info" | "warning";

type ToastState = {
  message: string;
  kind: ToastKind;
};

type ConfirmModalState = {
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

type LookupApiResponse = {
  success: boolean;
  found?: boolean;
  message?: string;

  user?: LookupUser;

  online?: boolean;
  live?: RobloxPlayer | null;

  moderation?: {
    banned: boolean;
    ban: BanRecord | null;
  };

  admin?: {
    isAdmin: boolean;
    record: AdminRecord | null;
  };
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

const permissionOptions: {
  key: AdminPermission;
  label: string;
}[] = [
  {
    key: "players",
    label: "Players",
  },
  {
    key: "commands",
    label: "Commands",
  },
  {
    key: "bans",
    label: "Bans",
  },
  {
    key: "vehicles",
    label: "Vehicles",
  },
  {
    key: "logs",
    label: "Logs",
  },
  {
    key: "config",
    label: "Config",
  },
  {
    key: "admins",
    label: "Admins",
  },
];

function formatPosition(value?: number) {
  return typeof value === "number"
    ? value.toFixed(1)
    : "0.0";
}

function healthPercent(player: RobloxPlayer) {
  if (
    !player.maxHealth ||
    player.maxHealth <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      (player.health / player.maxHealth) *
        100
    )
  );
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(
    "tr-TR"
  );
}

type AuthUser = {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: "owner" | "admin";
  permissions: string[];
};

export default function Home() {
  const [activePage, setActivePage] =
    useState("Live Monitor");

  const [players, setPlayers] = useState<
    RobloxPlayer[]
  >([]);

  const [server, setServer] =
    useState<ServerInfo | null>(null);

  const [serverOnline, setServerOnline] =
    useState(false);

  const [authUser, setAuthUser] =
    useState<AuthUser | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);


  const [
    logoutModalOpen,
    setLogoutModalOpen,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState<RobloxPlayer | null>(null);

  const [
    targetPlayerId,
    setTargetPlayerId,
  ] = useState<number | null>(null);

  const [search, setSearch] =
    useState("");

  const [lookupQuery, setLookupQuery] =
    useState("");

  const [
    lookupResult,
    setLookupResult,
  ] = useState<LookupApiResponse | null>(
    null
  );

  const [
    lookupLoading,
    setLookupLoading,
  ] = useState(false);

  const [
    lookupError,
    setLookupError,
  ] = useState("");

  const [
    selectedMapPlayer,
    setSelectedMapPlayer,
  ] = useState<RobloxPlayer | null>(null);

  const [bans, setBans] = useState<
    BanRecord[]
  >([]);

  const [admins, setAdmins] = useState<
    AdminRecord[]
  >([]);

  const [vehicles, setVehicles] =
    useState<VehicleRecord[]>([]);

  const [logs, setLogs] = useState<
    LogRecord[]
  >([]);

  const [config, setConfig] =
    useState<ServerConfig | null>(null);

  const [
    commandLoading,
    setCommandLoading,
  ] = useState(false);


  const [toast, setToast] =
    useState<ToastState | null>(null);


  const panelRef =
    useRef<HTMLElement | null>(null);

  const cursorRef =
    useRef<HTMLDivElement | null>(null);

  const trailCanvasRef =
    useRef<HTMLCanvasElement | null>(null);


  const [
    confirmModal,
    setConfirmModal,
  ] = useState<ConfirmModalState | null>(
    null
  );

  const [
    confirmLoading,
    setConfirmLoading,
  ] = useState(false);

  function showToast(
    message: string,
    kind: ToastKind = "success"
  ) {
    setToast({
      message,
      kind,
    });

    window.setTimeout(() => {
      setToast((current) =>
        current?.message === message
          ? null
          : current
      );
    }, 3200);
  }

  function requestConfirm(
    modal: ConfirmModalState
  ) {
    setConfirmModal(modal);
  }

  async function confirmCurrentAction() {
    if (!confirmModal) {
      return;
    }

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } catch (error) {
      console.error(
        "[SantionV Confirm Action]",
        error
      );

      showToast(
        "Action failed.",
        "error"
      );
    } finally {
      setConfirmLoading(false);
    }
  }

  /* ======================================================
     BAN FORM
     ====================================================== */

  const [banUserId, setBanUserId] =
    useState("");

  const [banUsername, setBanUsername] =
    useState("");

  const [banReason, setBanReason] =
    useState("");

  const [banDuration, setBanDuration] =
    useState("60");

  const [
    banPermanent,
    setBanPermanent,
  ] = useState(false);

  /* ======================================================
     ADMIN FORM
     ====================================================== */

  const [adminUserId, setAdminUserId] =
    useState("");

  const [
    adminUsername,
    setAdminUsername,
  ] = useState("");

  const [
    adminDisplayName,
    setAdminDisplayName,
  ] = useState("");

  const [adminRole, setAdminRole] =
    useState("Admin");

  const [adminLevel, setAdminLevel] =
    useState("1");

  const [
    adminPermissions,
    setAdminPermissions,
  ] = useState<AdminPermission[]>([
    "players",
    "commands",
  ]);

  const [adminActive, setAdminActive] =
    useState(true);

  const [
    editingAdminId,
    setEditingAdminId,
  ] = useState<number | null>(null);

  /* ======================================================
     OTHER
     ====================================================== */

  const [kickReason, setKickReason] =
    useState("");

  const [logSearch, setLogSearch] =
    useState("");

  const [logLevelFilter, setLogLevelFilter] =
    useState("all");

  const [logUserIdFilter, setLogUserIdFilter] =
    useState("");

  const [
    liveLogsEnabled,
    setLiveLogsEnabled,
  ] = useState(true);

  const [
    newLogCount,
    setNewLogCount,
  ] = useState(0);

  const [
    lastLogRefresh,
    setLastLogRefresh,
  ] = useState<number | null>(null);

  /* ======================================================
     LOAD AUTH USER
     ====================================================== */

  async function loadAuthUser() {
    try {
      const response = await fetch(
        "/api/auth/me",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        setAuthUser(null);
        setAuthLoading(false);
        return;
      }

      const data =
        await response.json();

      setAuthUser(
        data?.authenticated
          ? data.user ?? null
          : null
      );
    } catch {
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );
    } finally {
      window.location.href = "/";
    }
  }

  /* ======================================================
     LOAD PLAYERS
     ====================================================== */

  async function loadPlayers() {
    try {
      const response = await fetch(
        "/api/roblox/players",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Players API: ${response.status}`
        );
      }

      const data: PlayersApiResponse =
        await response.json();

      const loadedPlayers =
        Array.isArray(data.players)
          ? data.players
          : [];

      setPlayers(loadedPlayers);

      setServer(data.server ?? null);

      setServerOnline(
        Boolean(data.online)
      );

      setLoading(false);

      setSelectedPlayer((current) => {
        if (!current) {
          return null;
        }

        return (
          loadedPlayers.find(
            (player) =>
              player.userId ===
              current.userId
          ) ?? null
        );
      });
    } catch (error) {
      console.error(
        "[SantionV Players]",
        error
      );

      setPlayers([]);
      setServer(null);
      setServerOnline(false);
      setLoading(false);
    }
  }

  /* ======================================================
     LOAD BANS
     ====================================================== */

  async function loadBans() {
    try {
      const response = await fetch(
        "/api/roblox/bans",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setBans(
        Array.isArray(data.bans)
          ? data.bans
          : []
      );
    } catch {
      setBans([]);
    }
  }

  /* ======================================================
     LOAD ADMINS
     ====================================================== */

  async function loadAdmins() {
    try {
      const response = await fetch(
        "/api/roblox/admins",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setAdmins(
        Array.isArray(data.admins)
          ? data.admins
          : []
      );
    } catch {
      setAdmins([]);
    }
  }

  /* ======================================================
     LOAD VEHICLES
     ====================================================== */

  async function loadVehicles() {
    try {
      const response = await fetch(
        "/api/roblox/vehicles",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setVehicles(
        Array.isArray(data.vehicles)
          ? data.vehicles
          : []
      );
    } catch {
      setVehicles([]);
    }
  }

  /* ======================================================
     LOAD LOGS
     ====================================================== */

  async function loadLogs(
    countNew = false
  ) {
    try {
      const response = await fetch(
        "/api/roblox/logs?limit=100",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      const nextLogs: LogRecord[] =
        Array.isArray(data.logs)
          ? data.logs
          : [];

      setLogs((currentLogs) => {
        if (
          countNew &&
          currentLogs.length > 0 &&
          nextLogs.length > 0
        ) {
          const knownIds =
            new Set(
              currentLogs.map(
                (log) => log.id
              )
            );

          const incoming =
            nextLogs.filter(
              (log) =>
                !knownIds.has(log.id)
            ).length;

          if (incoming > 0) {
            setNewLogCount(
              (current) =>
                current + incoming
            );
          }
        }

        return nextLogs;
      });

      setLastLogRefresh(
        Date.now()
      );
    } catch {
      setLogs([]);
    }
  }

  /* ======================================================
     LOAD CONFIG
     ====================================================== */

  async function loadConfig() {
    try {
      const response = await fetch(
        "/api/roblox/config",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setConfig(
        data.config ?? null
      );
    } catch {
      setConfig(null);
    }
  }

  async function loadEverything() {
    await Promise.all([
      loadPlayers(),
      loadBans(),
      loadAdmins(),
      loadVehicles(),
      loadLogs(),
      loadConfig(),
    ]);
  }

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const authResult =
      params.get("auth");

    if (authResult === "success") {
      void loadAuthUser();

      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );

      return;
    }

    void fetch(
      "/api/auth/logout",
      {
        method: "POST",
      }
    ).finally(() => {
      setAuthUser(null);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (authLoading || !authUser) {
      return;
    }

    void loadEverything();

    const interval =
      window.setInterval(() => {
        void loadPlayers();
      }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authLoading, authUser]);

  useEffect(() => {
    if (
      authLoading ||
      !authUser ||
      !liveLogsEnabled
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        void loadLogs(true);
      }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authLoading, authUser, liveLogsEnabled]);

  useEffect(() => {
    const panel =
      panelRef.current;

    const cursor =
      cursorRef.current;

    const canvas =
      trailCanvasRef.current;

    if (
      !panel ||
      !cursor ||
      !canvas
    ) {
      return;
    }

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    type TrailPoint = {
      x: number;
      y: number;
      time: number;
    };

    let points: TrailPoint[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resizeCanvas = () => {
      dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      width =
        window.innerWidth;

      height =
        window.innerHeight;

      canvas.width =
        Math.floor(width * dpr);

      canvas.height =
        Math.floor(height * dpr);

      canvas.style.width =
        `${width}px`;

      canvas.style.height =
        `${height}px`;

      context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resizeCanvas();

    const handlePointerMove = (
      event: PointerEvent
    ) => {
      const x = event.clientX;
      const y = event.clientY;

      panel.style.setProperty(
        "--mouse-x",
        `${x}px`
      );

      panel.style.setProperty(
        "--mouse-y",
        `${y}px`
      );

      cursor.style.left =
        `${x}px`;

      cursor.style.top =
        `${y}px`;

      points.push({
        x,
        y,
        time: performance.now(),
      });

      if (points.length > 42) {
        points =
          points.slice(-42);
      }
    };

    const drawTrail = () => {
      const now =
        performance.now();

      points = points.filter(
        (point) =>
          now - point.time < 520
      );

      context.clearRect(
        0,
        0,
        width,
        height
      );

      if (points.length > 1) {
        context.save();

        context.lineCap =
          "round";

        context.lineJoin =
          "round";

        for (
          let i = 1;
          i < points.length;
          i++
        ) {
          const previous =
            points[i - 1];

          const current =
            points[i];

          const age =
            now - current.time;

          const life =
            Math.max(
              0,
              1 - age / 520
            );

          const gradient =
            context.createLinearGradient(
              previous.x,
              previous.y,
              current.x,
              current.y
            );

          gradient.addColorStop(
            0,
            `rgba(0, 102, 255, ${
              life * 0.12
            })`
          );

          gradient.addColorStop(
            1,
            `rgba(0, 168, 255, ${
              life * 0.95
            })`
          );

          context.beginPath();

          context.moveTo(
            previous.x,
            previous.y
          );

          const midX =
            (previous.x +
              current.x) /
            2;

          const midY =
            (previous.y +
              current.y) /
            2;

          context.quadraticCurveTo(
            previous.x,
            previous.y,
            midX,
            midY
          );

          context.lineWidth =
            1.5 + life * 3.3;

          context.strokeStyle =
            gradient;

          context.shadowColor =
            "rgba(0, 168, 255, 0.85)";

          context.shadowBlur =
            7 + life * 10;

          context.stroke();
        }

        context.restore();
      }

      frame =
        window.requestAnimationFrame(
          drawTrail
        );
    };

    frame =
      window.requestAnimationFrame(
        drawTrail
      );

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      {
        passive: true,
      }
    );

    window.addEventListener(
      "resize",
      resizeCanvas
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "resize",
        resizeCanvas
      );

      window.cancelAnimationFrame(
        frame
      );
    };
  }, []);

  /* ======================================================
     FILTERS
     ====================================================== */

  const filteredPlayers =
    useMemo(() => {
      const q = search
        .trim()
        .toLowerCase();

      if (!q) {
        return players;
      }

      return players.filter(
        (player) =>
          player.username
            .toLowerCase()
            .includes(q) ||
          player.displayName
            .toLowerCase()
            .includes(q) ||
          String(player.userId).includes(q)
      );
    }, [players, search]);

  /* ======================================================
     LOOKUP
     ====================================================== */

  async function searchLookup() {
    const query = lookupQuery.trim();

    if (!query) {
      setLookupResult(null);
      setLookupError(
        "Enter a Roblox username or User ID."
      );
      return;
    }

    setLookupLoading(true);
    setLookupError("");

    try {
      const response = await fetch(
        `/api/roblox/lookup?q=${encodeURIComponent(
          query
        )}`,
        {
          cache: "no-store",
        }
      );

      const data: LookupApiResponse =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.found
      ) {
        setLookupResult(null);
        setLookupError(
          data.message ||
            "Roblox user not found."
        );
        return;
      }

      setLookupResult(data);
    } catch (error) {
      console.error(
        "[SantionV Lookup]",
        error
      );

      setLookupResult(null);
      setLookupError(
        "Lookup request failed."
      );
    } finally {
      setLookupLoading(false);
    }
  }

  function openLookupPlayerInMonitor() {
    const live =
      lookupResult?.live ?? null;

    if (!live) {
      return;
    }

    setSelectedPlayer(live);
    setActivePage("Live Monitor");
  }

  function prepareLookupBan() {
    const user =
      lookupResult?.user;

    if (!user) {
      return;
    }

    setBanUserId(
      String(user.userId)
    );

    setBanUsername(
      user.username
    );

    setBanReason("");
    setBanDuration("60");
    setBanPermanent(false);

    setActivePage("Bans");
  }

  /* ======================================================
     ADMIN COMMANDS
     ====================================================== */

  async function sendAdminCommand(
    command: AdminCommand
  ) {
    if (!selectedPlayer) {
      return;
    }

    if (
      (command === "bring" ||
        command === "goto") &&
      !targetPlayerId
    ) {
      return;
    }

    setCommandLoading(true);

    try {
      const response = await fetch(
        "/api/roblox/commands",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            command,

            userId:
              selectedPlayer.userId,

            targetUserId:
              command === "bring" ||
              command === "goto"
                ? targetPlayerId
                : undefined,

            reason:
              command === "kick"
                ? kickReason ||
                  "Removed by SantionV Admin"
                : undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Command failed"
        );
      }

      showToast(
        `${command.toUpperCase()} command sent to ${selectedPlayer.username}.`,
        "success"
      );

      window.setTimeout(() => {
        loadPlayers();
      }, 1200);
    } catch (error) {
      console.error(
        "[SantionV Command]",
        error
      );
    } finally {
      setCommandLoading(false);
    }
  }

  /* ======================================================
     BAN
     ====================================================== */

  async function banPlayer() {
    const userId = Number(banUserId);

    if (!userId) {
      return;
    }

    await fetch(
      "/api/roblox/bans",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action: "ban",

          userId,

          username:
            banUsername || undefined,

          reason:
            banReason ||
            "No reason provided",

          bannedBy:
            "SantionV Web Panel",

          permanent:
            banPermanent,

          durationMinutes:
            banPermanent
              ? undefined
              : Number(banDuration),
        }),
      }
    );

    setBanUserId("");
    setBanUsername("");
    setBanReason("");
    setBanDuration("60");
    setBanPermanent(false);

    await loadBans();

    showToast(
      `Ban saved for ${banUsername || userId}.`,
      "success"
    );
  }

  async function performUnban(
    userId: number
  ) {
    await fetch(
      "/api/roblox/bans",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action: "unban",
          userId,
        }),
      }
    );

    await loadBans();
  }

  function unbanPlayer(
    userId: number
  ) {
    requestConfirm({
      title: "Unban Player",
      message:
        "Remove this player's active SantionV ban?",
      confirmText: "UNBAN",
      onConfirm: async () => {
        await performUnban(userId);

        showToast(
          "Player unbanned.",
          "success"
        );
      },
    });
  }

  /* ======================================================
     ADMIN PERMISSIONS
     ====================================================== */

  function toggleAdminPermission(
    permission: AdminPermission
  ) {
    setAdminPermissions(
      (current) => {
        if (
          current.includes(permission)
        ) {
          return current.filter(
            (item) =>
              item !== permission
          );
        }

        return [
          ...current,
          permission,
        ];
      }
    );
  }

  function giveAllPermissions() {
    setAdminPermissions(
      permissionOptions.map(
        (permission) =>
          permission.key
      )
    );
  }

  function clearPermissions() {
    setAdminPermissions([]);
  }

  function resetAdminForm() {
    setAdminUserId("");
    setAdminUsername("");
    setAdminDisplayName("");

    setAdminRole("Admin");
    setAdminLevel("1");

    setAdminPermissions([
      "players",
      "commands",
    ]);

    setAdminActive(true);

    setEditingAdminId(null);
  }

  function editAdmin(
    admin: AdminRecord
  ) {
    setAdminUserId(
      String(admin.userId)
    );

    setAdminUsername(
      admin.username
    );

    setAdminDisplayName(
      admin.displayName ?? ""
    );

    setAdminRole(admin.role);

    setAdminLevel(
      String(admin.level)
    );

    setAdminPermissions(
      admin.permissions ?? []
    );

    setAdminActive(
      admin.active
    );

    setEditingAdminId(
      admin.userId
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveAdmin() {
    const userId =
      Number(adminUserId);

    if (!userId) {
      return;
    }

    const action =
      editingAdminId !== null
        ? "update"
        : "add";

    const response = await fetch(
      "/api/roblox/admins",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action,

          userId,

          username:
            adminUsername ||
            `User_${userId}`,

          displayName:
            adminDisplayName ||
            undefined,

          role:
            adminRole || "Admin",

          level:
            Number(adminLevel) || 1,

          permissions:
            adminPermissions,

          active:
            adminActive,

          addedBy:
            "SantionV Web Panel",
        }),
      }
    );

    if (!response.ok) {
      return;
    }

    resetAdminForm();

    await loadAdmins();

    showToast(
      action === "add"
        ? "Admin added."
        : "Admin updated.",
      "success"
    );
  }

  async function performRemoveAdmin(
    userId: number
  ) {
    await fetch(
      "/api/roblox/admins",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action: "remove",
          userId,
        }),
      }
    );

    if (
      editingAdminId === userId
    ) {
      resetAdminForm();
    }

    await loadAdmins();
  }

  function removeAdmin(
    userId: number
  ) {
    requestConfirm({
      title: "Remove Admin",
      message:
        "This admin will lose their SantionV panel permissions.",
      confirmText: "REMOVE",
      danger: true,
      onConfirm: async () => {
        await performRemoveAdmin(
          userId
        );

        showToast(
          "Admin removed.",
          "success"
        );
      },
    });
  }

  async function toggleAdminActive(
    admin: AdminRecord
  ) {
    await fetch(
      "/api/roblox/admins",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action: "update",

          userId: admin.userId,

          username:
            admin.username,

          displayName:
            admin.displayName,

          role: admin.role,

          level: admin.level,

          permissions:
            admin.permissions,

          active:
            !admin.active,

          addedBy:
            admin.addedBy,
        }),
      }
    );

    await loadAdmins();

    showToast(
      admin.active
        ? "Admin disabled."
        : "Admin enabled.",
      "info"
    );
  }

  /* ======================================================
     CONFIG
     ====================================================== */

  async function updateConfig(
    changes: Partial<ServerConfig>
  ) {
    if (!config) {
      return;
    }

    const response = await fetch(
      "/api/roblox/config",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          ...config,
          ...changes,

          updatedBy:
            "SantionV Web Panel",
        }),
      }
    );

    const data =
      await response.json();

    if (data.config) {
      setConfig(data.config);

      showToast(
        "Configuration updated.",
        "success"
      );
    }
  }

  /* ======================================================
     LOGS
     ====================================================== */

  async function performClearLogs() {
    await fetch(
      "/api/roblox/logs",
      {
        method: "DELETE",
      }
    );

    await loadLogs();
  }

  function clearLogs() {
    requestConfirm({
      title: "Clear Console Logs",
      message:
        "All stored console logs will be deleted. This cannot be undone.",
      confirmText: "CLEAR LOGS",
      danger: true,
      onConfirm: async () => {
        await performClearLogs();

        showToast(
          "Console logs cleared.",
          "success"
        );
      },
    });
  }

  function watchPlayer(
    player: RobloxPlayer
  ) {
    setSelectedPlayer(player);

    setActivePage(
      "Live Monitor"
    );
  }

  /* ======================================================
     DASHBOARD
     ====================================================== */

  function renderDashboard() {
    const capacity =
      server?.maxPlayers
        ? Math.round(
            ((server.playerCount ?? players.length) /
              server.maxPlayers) *
              100
          )
        : 0;

    const activeVehicles =
      vehicles.filter(
        (vehicle) => vehicle.spawned
      ).length;

    const activeAdmins =
      admins.filter(
        (admin) => admin.active
      ).length;

    const recentLogs =
      [...logs]
        .sort(
          (a, b) =>
            b.createdAt - a.createdAt
        )
        .slice(0, 6);

    const heartbeatAge =
      server?.lastSeen
        ? Math.max(
            0,
            Math.round(
              (Date.now() -
                server.lastSeen) /
                1000
            )
          )
        : null;

    const healthyPlayers =
      players.filter(
        (player) =>
          healthPercent(player) >= 70
      ).length;

    return (
      <div className="modulePage dashboardV2">
        <section className="dashboardHero">
          <div>
            <span className="dashboardEyebrow">
              SANTIONV / CONTROL CENTER
            </span>

            <h2>
              Server Dashboard
            </h2>

            <p>
              Live Roblox server status,
              players, moderation and
              activity in one place.
            </p>
          </div>

          <div
            className={
              serverOnline
                ? "dashboardLive online"
                : "dashboardLive offline"
            }
          >
            <span className="dashboardLiveDot" />

            {serverOnline
              ? "SERVER ONLINE"
              : "SERVER OFFLINE"}
          </div>
        </section>

        <div className="dashboardMetricGrid">
          <button
            className="dashboardMetricCard"
            onClick={() =>
              setActivePage("Players")
            }
          >
            <span className="dashboardMetricLabel">
              ONLINE PLAYERS
            </span>

            <strong>
              {players.length}
            </strong>

            <small>
              {server?.maxPlayers
                ? `${capacity}% capacity`
                : "Live player count"}
            </small>

            <div className="dashboardProgress">
              <span
                style={{
                  width: `${Math.min(
                    100,
                    capacity
                  )}%`,
                }}
              />
            </div>
          </button>

          <button
            className="dashboardMetricCard"
            onClick={() =>
              setActivePage("Vehicles")
            }
          >
            <span className="dashboardMetricLabel">
              ACTIVE VEHICLES
            </span>

            <strong>
              {activeVehicles}
            </strong>

            <small>
              {vehicles.length} stored
              vehicle
              {vehicles.length === 1
                ? ""
                : "s"}
            </small>

            <span className="dashboardCardLink">
              OPEN VEHICLES →
            </span>
          </button>

          <button
            className="dashboardMetricCard"
            onClick={() =>
              setActivePage("Bans")
            }
          >
            <span className="dashboardMetricLabel">
              ACTIVE BANS
            </span>

            <strong>
              {bans.length}
            </strong>

            <small>
              Moderation records
            </small>

            <span className="dashboardCardLink">
              OPEN BANS →
            </span>
          </button>

          <button
            className="dashboardMetricCard"
            onClick={() =>
              setActivePage("Admins")
            }
          >
            <span className="dashboardMetricLabel">
              ACTIVE ADMINS
            </span>

            <strong>
              {activeAdmins}
            </strong>

            <small>
              {admins.length} registered
            </small>

            <span className="dashboardCardLink">
              MANAGE ADMINS →
            </span>
          </button>
        </div>

        <div className="dashboardMainGrid">
          <section className="dashboardPanel">
            <div className="dashboardPanelHeader">
              <div>
                <span className="dashboardEyebrow">
                  LIVE STATUS
                </span>

                <h3>
                  Server Health
                </h3>
              </div>

              <button
                className="dashboardRefreshButton"
                onClick={() => {
                  void loadPlayers();
                  void loadLogs();
                  void loadVehicles();
                  void loadBans();
                  void loadAdmins();

                  showToast(
                    "Dashboard refreshed.",
                    "success"
                  );
                }}
              >
                REFRESH
              </button>
            </div>

            <div className="dashboardHealthGrid">
              <div>
                <span>STATUS</span>
                <strong
                  className={
                    serverOnline
                      ? "greenText"
                      : "redText"
                  }
                >
                  {serverOnline
                    ? "ONLINE"
                    : "OFFLINE"}
                </strong>
              </div>

              <div>
                <span>
                  HEARTBEAT AGE
                </span>
                <strong>
                  {heartbeatAge === null
                    ? "-"
                    : `${heartbeatAge}s`}
                </strong>
              </div>

              <div>
                <span>
                  HEALTHY PLAYERS
                </span>
                <strong>
                  {healthyPlayers}/
                  {players.length}
                </strong>
              </div>

              <div>
                <span>
                  CAPACITY
                </span>
                <strong>
                  {server?.playerCount ??
                    players.length}
                  /
                  {server?.maxPlayers ??
                    "-"}
                </strong>
              </div>

              <div>
                <span>PLACE ID</span>
                <strong>
                  {server?.placeId ?? "-"}
                </strong>
              </div>

              <div>
                <span>GAME ID</span>
                <strong>
                  {server?.gameId ?? "-"}
                </strong>
              </div>
            </div>

            <div className="dashboardServerId">
              <span>SERVER ID</span>
              <code>
                {server?.serverId ??
                  "Waiting for Roblox heartbeat..."}
              </code>
            </div>
          </section>

          <section className="dashboardPanel">
            <div className="dashboardPanelHeader">
              <div>
                <span className="dashboardEyebrow">
                  QUICK CONTROL
                </span>

                <h3>
                  Quick Actions
                </h3>
              </div>
            </div>

            <div className="dashboardQuickGrid">
              <button
                onClick={() =>
                  setActivePage("Players")
                }
              >
                <strong>Players</strong>
                <span>
                  View and manage online
                  players
                </span>
              </button>

              <button
                onClick={() =>
                  setActivePage(
                    "Live Monitor"
                  )
                }
              >
                <strong>
                  Live Monitor
                </strong>
                <span>
                  Open real-time player
                  monitor
                </span>
              </button>

              <button
                onClick={() =>
                  setActivePage("Console")
                }
              >
                <strong>Console</strong>
                <span>
                  Inspect live server logs
                </span>
              </button>

              <button
                onClick={() =>
                  setActivePage(
                    "Configuration"
                  )
                }
              >
                <strong>
                  Configuration
                </strong>
                <span>
                  Server lock and
                  maintenance controls
                </span>
              </button>
            </div>
          </section>
        </div>

        <div className="dashboardBottomGrid">
          <section className="dashboardPanel">
            <div className="dashboardPanelHeader">
              <div>
                <span className="dashboardEyebrow">
                  ACTIVITY
                </span>

                <h3>
                  Recent Activity
                </h3>
              </div>

              <button
                className="dashboardTextButton"
                onClick={() =>
                  setActivePage("Console")
                }
              >
                VIEW ALL
              </button>
            </div>

            <div className="dashboardActivityList">
              {recentLogs.length === 0 ? (
                <div className="dashboardEmpty">
                  No activity recorded yet.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    className="dashboardActivityItem"
                    key={log.id}
                  >
                    <span
                      className={`dashboardActivityDot ${log.level}`}
                    />

                    <div>
                      <strong>
                        {log.message}
                      </strong>

                      <span>
                        {log.username
                          ? `@${log.username} • `
                          : ""}
                        {formatDate(
                          log.createdAt
                        )}
                      </span>
                    </div>

                    <em>
                      {log.level.toUpperCase()}
                    </em>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="dashboardPanel">
            <div className="dashboardPanelHeader">
              <div>
                <span className="dashboardEyebrow">
                  LIVE PLAYERS
                </span>

                <h3>
                  Player Snapshot
                </h3>
              </div>

              <button
                className="dashboardTextButton"
                onClick={() =>
                  setActivePage("Players")
                }
              >
                VIEW ALL
              </button>
            </div>

            <div className="dashboardPlayerList">
              {players.length === 0 ? (
                <div className="dashboardEmpty">
                  No players online.
                </div>
              ) : (
                players
                  .slice(0, 5)
                  .map((player) => (
                    <button
                      key={player.userId}
                      onClick={() =>
                        watchPlayer(player)
                      }
                    >
                      <span className="dashboardAvatar">
                        {(
                          player.displayName ||
                          player.username
                        )
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>

                      <span className="dashboardPlayerIdentity">
                        <strong>
                          {player.displayName}
                        </strong>

                        <small>
                          @{player.username}
                        </small>
                      </span>

                      <span className="dashboardPlayerMeta">
                        {Math.round(
                          healthPercent(
                            player
                          )
                        )}
                        % HP
                      </span>
                    </button>
                  ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  /* ======================================================
     CONFIGURATION
     ====================================================== */

  function renderConfiguration() {
    if (!config) {
      return (
        <div className="modulePage">
          <div className="panelMessage">
            Loading config...
          </div>
        </div>
      );
    }

    const toggles: {
      label: string;
      key: keyof ServerConfig;
    }[] = [
      {
        label:
          "Maintenance Mode",
        key: "maintenanceMode",
      },
      {
        label:
          "Server Locked",
        key: "serverLocked",
      },
      {
        label:
          "Commands Enabled",
        key: "commandsEnabled",
      },
      {
        label:
          "Bans Enabled",
        key: "bansEnabled",
      },
      {
        label:
          "Vehicles Enabled",
        key: "vehiclesEnabled",
      },
      {
        label:
          "Logs Enabled",
        key: "logsEnabled",
      },
      {
        label:
          "Auto Kick Banned",
        key:
          "autoKickBannedPlayers",
      },
    ];

    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>
            Server Configuration
          </h2>

          <div className="configGrid">
            {toggles.map(
              ({ label, key }) => (
                <label
                  className="configToggle"
                  key={key}
                >
                  <span>
                    {label}
                  </span>

                  <input
                    type="checkbox"
                    checked={Boolean(
                      config[key]
                    )}
                    onChange={(
                      event
                    ) =>
                      updateConfig(
                        {
                          [key]:
                            event
                              .target
                              .checked,
                        } as Partial<ServerConfig>
                      )
                    }
                  />
                </label>
              )
            )}
          </div>

          <div className="configTextGrid">
            <label>
              Join Message

              <input
                value={
                  config.joinMessage
                }
                onChange={(
                  event
                ) =>
                  setConfig({
                    ...config,

                    joinMessage:
                      event
                        .target
                        .value,
                  })
                }
                onBlur={() =>
                  updateConfig({
                    joinMessage:
                      config.joinMessage,
                  })
                }
              />
            </label>

            <label>
              Maintenance Message

              <input
                value={
                  config.maintenanceMessage
                }
                onChange={(
                  event
                ) =>
                  setConfig({
                    ...config,

                    maintenanceMessage:
                      event
                        .target
                        .value,
                  })
                }
                onBlur={() =>
                  updateConfig({
                    maintenanceMessage:
                      config.maintenanceMessage,
                  })
                }
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  /* ======================================================
     PLAYERS
     ====================================================== */

  function renderPlayers() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>
                Online Players
              </h2>

              <p>
                Live Roblox
                players.
              </p>
            </div>

            <input
              className="normalInput"
              placeholder="Search player..."
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          {loading ? (
            <div className="skeletonList">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  className="skeletonRow"
                  key={index}
                >
                  <div className="skeletonCircle" />
                  <div className="skeletonLines">
                    <span />
                    <span />
                  </div>
                  <div className="skeletonBlock" />
                </div>
              ))}
            </div>
          ) : filteredPlayers.length ===
            0 ? (
            <div className="panelMessage">
              No players.
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

              {filteredPlayers.map(
                (player) => (
                  <div
                    className="tableRow"
                    key={
                      player.userId
                    }
                  >
                    <span>
                      {
                        player.username
                      }
                    </span>

                    <span>
                      {player.health}/
                      {
                        player.maxHealth
                      }
                    </span>

                    <span>
                      {player.team}
                    </span>

                    <span>
                      {
                        player.humanoidState
                      }
                    </span>

                    <span>
                      <button
                        className="smallButton"
                        onClick={() =>
                          watchPlayer(
                            player
                          )
                        }
                      >
                        WATCH
                      </button>
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ======================================================
     LIVE MONITOR
     ====================================================== */

  function renderLiveMonitor() {
    const otherPlayers =
      players.filter(
        (player) =>
          player.userId !==
          selectedPlayer?.userId
      );

    return (
      <div className="monitor">
        <div className="monitorMain">
          <div className="monitorToolbar">
            <select
              value={
                selectedPlayer?.userId ??
                ""
              }
              onChange={(
                event
              ) => {
                const id = Number(
                  event.target.value
                );

                setSelectedPlayer(
                  players.find(
                    (player) =>
                      player.userId ===
                      id
                  ) ?? null
                );
              }}
            >
              <option value="">
                Select Player...
              </option>

              {players.map(
                (player) => (
                  <option
                    value={
                      player.userId
                    }
                    key={
                      player.userId
                    }
                  >
                    {
                      player.username
                    }
                  </option>
                )
              )}
            </select>

            <button
              onClick={
                loadPlayers
              }
            >
              Refresh
            </button>

            <span className="ready">
              Players:{" "}
              <b>
                {players.length}
              </b>
            </span>
          </div>

          <div className="watchArea">
            {!selectedPlayer ? (
              <div className="emptyState">
                <h2>
                  Live Monitor
                </h2>

                <p>
                  Select a player.
                </p>
              </div>
            ) : (
              <div className="selectedCard livePlayerCard">
                <div className="selectedAvatar">
                  {selectedPlayer.username
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <p>
                  NOW WATCHING
                </p>

                <h2>
                  {
                    selectedPlayer.username
                  }
                </h2>

                <div className="healthBlock">
                  <div className="healthHeader">
                    <span>
                      HEALTH
                    </span>

                    <strong>
                      {
                        selectedPlayer.health
                      }
                      /
                      {
                        selectedPlayer.maxHealth
                      }
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
                    <span>
                      USER ID
                    </span>

                    <strong>
                      {
                        selectedPlayer.userId
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      STATE
                    </span>

                    <strong>
                      {
                        selectedPlayer.humanoidState
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      TEAM
                    </span>

                    <strong>
                      {
                        selectedPlayer.team
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      VEHICLE
                    </span>

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
                          selectedPlayer
                            .position?.x
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Y</span>

                      <strong>
                        {formatPosition(
                          selectedPlayer
                            .position?.y
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Z</span>

                      <strong>
                        {formatPosition(
                          selectedPlayer
                            .position?.z
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
                    <button
                      disabled={
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "heal"
                        )
                      }
                    >
                      HEAL
                    </button>

                    <button
                      disabled={
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "respawn"
                        )
                      }
                    >
                      RESPAWN
                    </button>

                    <button
                      disabled={
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "freeze"
                        )
                      }
                    >
                      FREEZE
                    </button>

                    <button
                      disabled={
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "unfreeze"
                        )
                      }
                    >
                      UNFREEZE
                    </button>

                    <button
                      disabled={
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "kick"
                        )
                      }
                    >
                      KICK
                    </button>
                  </div>

                  <select
                    className="commandSelect"
                    value={
                      targetPlayerId ??
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      setTargetPlayerId(
                        Number(
                          event
                            .target
                            .value
                        ) ||
                          null
                      )
                    }
                  >
                    <option value="">
                      Target for
                      BRING/GOTO
                    </option>

                    {otherPlayers.map(
                      (player) => (
                        <option
                          key={
                            player.userId
                          }
                          value={
                            player.userId
                          }
                        >
                          {
                            player.username
                          }
                        </option>
                      )
                    )}
                  </select>

                  <div className="commandGrid two">
                    <button
                      disabled={
                        !targetPlayerId ||
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "bring"
                        )
                      }
                    >
                      BRING
                    </button>

                    <button
                      disabled={
                        !targetPlayerId ||
                        commandLoading
                      }
                      onClick={() =>
                        sendAdminCommand(
                          "goto"
                        )
                      }
                    >
                      GOTO
                    </button>
                  </div>

                  <input
                    className="kickReasonInput"
                    placeholder="Kick reason..."
                    value={
                      kickReason
                    }
                    onChange={(
                      event
                    ) =>
                      setKickReason(
                        event.target
                          .value
                      )
                    }
                  />
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
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <div className="playerList">
            {filteredPlayers.map(
              (player) => (
                <div
                  className="playerCard"
                  key={
                    player.userId
                  }
                  onClick={() =>
                    setSelectedPlayer(
                      player
                    )
                  }
                >
                  <div className="playerAvatar">
                    {player.username
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="playerInfo">
                    <div className="playerName">
                      {
                        player.username
                      }
                    </div>

                    <div className="realPlayerId">
                      HP:{" "}
                      {
                        player.health
                      }
                      /
                      {
                        player.maxHealth
                      }
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </aside>
      </div>
    );
  }

  /* ======================================================
     MAP
     ====================================================== */

  function renderInteractiveMap() {
    const mapPlayers = players.filter(
      (player) =>
        player.position &&
        Number.isFinite(
          player.position.x
        ) &&
        Number.isFinite(
          player.position.z
        )
    );

    const xValues = mapPlayers.map(
      (player) =>
        player.position.x
    );

    const zValues = mapPlayers.map(
      (player) =>
        player.position.z
    );

    const minX =
      xValues.length > 0
        ? Math.min(...xValues)
        : -100;

    const maxX =
      xValues.length > 0
        ? Math.max(...xValues)
        : 100;

    const minZ =
      zValues.length > 0
        ? Math.min(...zValues)
        : -100;

    const maxZ =
      zValues.length > 0
        ? Math.max(...zValues)
        : 100;

    const xRange =
      Math.max(
        50,
        maxX - minX
      );

    const zRange =
      Math.max(
        50,
        maxZ - minZ
      );

    function mapLeft(
      player: RobloxPlayer
    ) {
      return Math.max(
        4,
        Math.min(
          96,
          8 +
            ((player.position.x -
              minX) /
              xRange) *
              84
        )
      );
    }

    function mapTop(
      player: RobloxPlayer
    ) {
      return Math.max(
        4,
        Math.min(
          96,
          8 +
            ((player.position.z -
              minZ) /
              zRange) *
              84
        )
      );
    }

    return (
      <div className="modulePage">
        <div className="mapLayout">
          <div className="largePanel mapMainPanel">
            <div className="panelHeading">
              <div>
                <h2>
                  Interactive Map
                </h2>

                <p>
                  Live player positions
                  from the active Roblox
                  server.
                </p>
              </div>

              <div className="inlineButtons">
                <span className="mapPlayerCount">
                  {mapPlayers.length} LIVE
                </span>

                <button
                  className="smallButton"
                  onClick={
                    loadPlayers
                  }
                >
                  REFRESH
                </button>
              </div>
            </div>

            <div className="mapBoard advancedMapBoard">
              <div className="mapAxis mapAxisX">
                X
              </div>

              <div className="mapAxis mapAxisZ">
                Z
              </div>

              <div className="mapCrosshair mapCrosshairX" />
              <div className="mapCrosshair mapCrosshairZ" />

              {mapPlayers.length ===
              0 ? (
                <div className="mapEmptyState">
                  No live player
                  positions available.
                </div>
              ) : (
                mapPlayers.map(
                  (player) => {
                    const selected =
                      selectedMapPlayer
                        ?.userId ===
                      player.userId;

                    return (
                      <button
                        key={
                          player.userId
                        }
                        className={
                          selected
                            ? "mapPlayerDot mapPlayerDotSelected"
                            : "mapPlayerDot"
                        }
                        style={{
                          left: `${mapLeft(
                            player
                          )}%`,
                          top: `${mapTop(
                            player
                          )}%`,
                        }}
                        title={`${player.username} | X ${formatPosition(
                          player.position.x
                        )} Z ${formatPosition(
                          player.position.z
                        )}`}
                        onClick={() =>
                          setSelectedMapPlayer(
                            player
                          )
                        }
                      >
                        {player.username
                          .charAt(0)
                          .toUpperCase()}

                        <span className="mapPlayerLabel">
                          {
                            player.username
                          }
                        </span>
                      </button>
                    );
                  }
                )
              )}
            </div>

            <div className="mapLegend">
              <span>
                <i className="legendDot" />
                Live player
              </span>

              <span>
                Grid is scaled to
                currently visible
                players
              </span>
            </div>
          </div>

          <aside className="largePanel mapDetailsPanel">
            {!selectedMapPlayer ? (
              <div className="panelMessage">
                Select a player dot
                on the map.
              </div>
            ) : (
              <>
                <div className="mapSelectedHeader">
                  <div className="selectedAvatar mapSelectedAvatar">
                    {selectedMapPlayer
                      .username
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <span>
                      SELECTED PLAYER
                    </span>

                    <h2>
                      {
                        selectedMapPlayer
                          .username
                      }
                    </h2>

                    <p>
                      {
                        selectedMapPlayer
                          .displayName
                      }
                    </p>
                  </div>
                </div>

                <div className="mapDetailGrid">
                  <div>
                    <span>
                      USER ID
                    </span>

                    <strong>
                      {
                        selectedMapPlayer
                          .userId
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      HEALTH
                    </span>

                    <strong>
                      {
                        selectedMapPlayer
                          .health
                      }
                      /
                      {
                        selectedMapPlayer
                          .maxHealth
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      STATE
                    </span>

                    <strong>
                      {
                        selectedMapPlayer
                          .humanoidState
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      TEAM
                    </span>

                    <strong>
                      {
                        selectedMapPlayer
                          .team
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      DEPARTMENT
                    </span>

                    <strong>
                      {
                        selectedMapPlayer
                          .department
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      VEHICLE
                    </span>

                    <strong>
                      {selectedMapPlayer
                        .inVehicle
                        ? selectedMapPlayer
                            .vehicleName ??
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
                          selectedMapPlayer
                            .position.x
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Y</span>

                      <strong>
                        {formatPosition(
                          selectedMapPlayer
                            .position.y
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Z</span>

                      <strong>
                        {formatPosition(
                          selectedMapPlayer
                            .position.z
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  className="adminSaveButton mapWatchButton"
                  onClick={() =>
                    watchPlayer(
                      selectedMapPlayer
                    )
                  }
                >
                  WATCH IN LIVE MONITOR
                </button>
              </>
            )}
          </aside>
        </div>
      </div>
    );
  }

  /* ======================================================
     CONSOLE
     ====================================================== */

  function renderConsole() {
    const filteredLogs = logs
      .filter((log) => {
        const query = logSearch
          .trim()
          .toLowerCase();

        const matchesSearch =
          !query ||
          log.message
            .toLowerCase()
            .includes(query) ||
          String(log.username ?? "")
            .toLowerCase()
            .includes(query) ||
          String(log.action ?? "")
            .toLowerCase()
            .includes(query) ||
          String(log.source ?? "")
            .toLowerCase()
            .includes(query);

        const matchesLevel =
          logLevelFilter === "all" ||
          log.level === logLevelFilter;

        const matchesUserId =
          !logUserIdFilter.trim() ||
          String(log.userId ?? "").includes(
            logUserIdFilter.trim()
          );

        return (
          matchesSearch &&
          matchesLevel &&
          matchesUserId
        );
      })
      .sort(
        (a, b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );

    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>
                Console
              </h2>

              <p>
                Persistent Roblox server logs
                and admin activity.
              </p>
            </div>

            <div className="inlineButtons">
              <button
                className={
                  liveLogsEnabled
                    ? "smallButton liveLogsButton liveLogsButtonActive"
                    : "smallButton liveLogsButton"
                }
                onClick={() =>
                  setLiveLogsEnabled(
                    (current) =>
                      !current
                  )
                }
              >
                {liveLogsEnabled
                  ? "LIVE LOGS: ON"
                  : "LIVE LOGS: OFF"}
              </button>

              <button
                className="smallButton"
                onClick={() => {
                  setNewLogCount(0);
                  loadLogs();
                }}
              >
                REFRESH
              </button>

              <button
                className="dangerButton"
                onClick={
                  clearLogs
                }
              >
                CLEAR
              </button>
            </div>
          </div>

          <div className="consoleLiveStatus">
            <div>
              <span
                className={
                  liveLogsEnabled
                    ? "consoleLiveDot"
                    : "consoleLiveDot consoleLiveDotOff"
                }
              />

              <strong>
                {liveLogsEnabled
                  ? "LIVE"
                  : "PAUSED"}
              </strong>

              <span>
                Auto refresh every 3s
              </span>
            </div>

            <div>
              <span>
                New logs:{" "}
                <b>
                  {newLogCount}
                </b>
              </span>

              <span>
                Last refresh:{" "}
                <b>
                  {lastLogRefresh
                    ? new Date(
                        lastLogRefresh
                      ).toLocaleTimeString(
                        "tr-TR"
                      )
                    : "-"}
                </b>
              </span>
            </div>
          </div>

          <div className="consoleFilters">
            <input
              placeholder="Search message / username / action / source..."
              value={
                logSearch
              }
              onChange={(
                event
              ) =>
                setLogSearch(
                  event.target.value
                )
              }
            />

            <select
              value={
                logLevelFilter
              }
              onChange={(
                event
              ) =>
                setLogLevelFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Levels
              </option>

              <option value="info">
                Info
              </option>

              <option value="success">
                Success
              </option>

              <option value="warning">
                Warning
              </option>

              <option value="error">
                Error
              </option>

              <option value="admin">
                Admin
              </option>

              <option value="player">
                Player
              </option>

              <option value="vehicle">
                Vehicle
              </option>

              <option value="ban">
                Ban
              </option>
            </select>

            <input
              placeholder="User ID filter..."
              value={
                logUserIdFilter
              }
              onChange={(
                event
              ) =>
                setLogUserIdFilter(
                  event.target.value
                )
              }
            />

            <button
              className="smallButton"
              onClick={() => {
                setLogSearch("");
                setLogLevelFilter("all");
                setLogUserIdFilter("");
              }}
            >
              RESET FILTERS
            </button>
          </div>

          <div className="consoleStats">
            <span>
              Loaded:{" "}
              <b>
                {logs.length}
              </b>
            </span>

            <span>
              Showing:{" "}
              <b>
                {filteredLogs.length}
              </b>
            </span>
          </div>

          <div className="consoleBox">
            {filteredLogs.length === 0 ? (
              <div className="panelMessage">
                No matching logs.
              </div>
            ) : (
              filteredLogs.map(
                (log) => (
                  <div
                    className={`consoleLogCard ${log.level}`}
                    key={log.id}
                  >
                    <div className="consoleLogTop">
                      <div>
                        <span
                          className={`consoleLevelBadge ${log.level}`}
                        >
                          {log.level.toUpperCase()}
                        </span>

                        <strong>
                          {log.message}
                        </strong>
                      </div>

                      <time>
                        {new Date(
                          log.createdAt
                        ).toLocaleString(
                          "tr-TR"
                        )}
                      </time>
                    </div>

                    <div className="consoleLogMeta">
                      <div>
                        <span>
                          PLAYER
                        </span>

                        <strong>
                          {log.username ??
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          USER ID
                        </span>

                        <strong>
                          {log.userId ??
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          ACTION
                        </span>

                        <strong>
                          {log.action ??
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          SOURCE
                        </span>

                        <strong>
                          {log.source ??
                            "-"}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ======================================================
     LOOKUP
     ====================================================== */

  function renderLookup() {
    const user =
      lookupResult?.user;

    const live =
      lookupResult?.live ?? null;

    const ban =
      lookupResult?.moderation?.ban ??
      null;

    const admin =
      lookupResult?.admin?.record ??
      null;

    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>
                Player Lookup
              </h2>

              <p>
                Search any Roblox account
                by username or User ID.
              </p>
            </div>

            <div className="inlineButtons">
              <input
                className="normalInput"
                placeholder="Username / User ID"
                value={
                  lookupQuery
                }
                onChange={(
                  event
                ) =>
                  setLookupQuery(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key === "Enter"
                  ) {
                    searchLookup();
                  }
                }}
              />

              <button
                className="smallButton"
                disabled={
                  lookupLoading
                }
                onClick={
                  searchLookup
                }
              >
                {lookupLoading
                  ? "SEARCHING..."
                  : "SEARCH"}
              </button>
            </div>
          </div>

          {lookupError && (
            <div className="panelMessage redText">
              {lookupError}
            </div>
          )}

          {!lookupError &&
            !lookupResult && (
              <div className="panelMessage">
                Search a Roblox username
                or User ID.
              </div>
            )}

          {user && lookupResult && (
            <>
              <div className="statsGrid">
                <div className="statCard">
                  <span>
                    ROBLOX USER
                  </span>

                  <strong>
                    {user.username}
                  </strong>

                  <small>
                    {user.displayName}
                  </small>
                </div>

                <div className="statCard">
                  <span>
                    USER ID
                  </span>

                  <strong>
                    {user.userId}
                  </strong>

                  <small>
                    Permanent Roblox ID
                  </small>
                </div>

                <div className="statCard">
                  <span>
                    SERVER STATUS
                  </span>

                  <strong
                    className={
                      lookupResult.online
                        ? "greenText"
                        : "redText"
                    }
                  >
                    {lookupResult.online
                      ? "ONLINE"
                      : "OFFLINE"}
                  </strong>

                  <small>
                    SantionV server
                  </small>
                </div>

                <div className="statCard">
                  <span>
                    MODERATION
                  </span>

                  <strong
                    className={
                      lookupResult
                        .moderation
                        ?.banned
                        ? "redText"
                        : "greenText"
                    }
                  >
                    {lookupResult
                      .moderation
                      ?.banned
                      ? "BANNED"
                      : "CLEAR"}
                  </strong>

                  <small>
                    SantionV ban status
                  </small>
                </div>
              </div>

              <div className="largePanel">
                <div className="panelHeading">
                  <div>
                    <h2>
                      Roblox Profile
                    </h2>

                    <p>
                      Account information
                      returned by Roblox.
                    </p>
                  </div>

                  <div className="inlineButtons">
                    {live && (
                      <button
                        className="smallButton"
                        onClick={
                          openLookupPlayerInMonitor
                        }
                      >
                        WATCH LIVE
                      </button>
                    )}

                    {!lookupResult
                      .moderation
                      ?.banned && (
                      <button
                        className="dangerButton"
                        onClick={
                          prepareLookupBan
                        }
                      >
                        PREPARE BAN
                      </button>
                    )}
                  </div>
                </div>

                <div className="serverDetails">
                  <div>
                    <span>
                      USERNAME
                    </span>

                    <strong>
                      {user.username}
                    </strong>
                  </div>

                  <div>
                    <span>
                      DISPLAY NAME
                    </span>

                    <strong>
                      {user.displayName}
                    </strong>
                  </div>

                  <div>
                    <span>
                      USER ID
                    </span>

                    <strong>
                      {user.userId}
                    </strong>
                  </div>

                  <div>
                    <span>
                      CREATED
                    </span>

                    <strong>
                      {user.created
                        ? new Date(
                            user.created
                          ).toLocaleString(
                            "tr-TR"
                          )
                        : "-"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ROBLOX BAN
                    </span>

                    <strong
                      className={
                        user.isBanned
                          ? "redText"
                          : "greenText"
                      }
                    >
                      {user.isBanned
                        ? "BANNED"
                        : "NOT BANNED"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ADMIN STATUS
                    </span>

                    <strong
                      className={
                        lookupResult
                          .admin
                          ?.isAdmin
                          ? "greenText"
                          : ""
                      }
                    >
                      {lookupResult
                        .admin
                        ?.isAdmin
                        ? admin?.role ??
                          "ADMIN"
                        : "NOT ADMIN"}
                    </strong>
                  </div>
                </div>

                {user.description && (
                  <div className="positionPanel">
                    <div className="positionTitle">
                      DESCRIPTION
                    </div>

                    <p>
                      {user.description}
                    </p>
                  </div>
                )}
              </div>

              {live && (
                <div className="largePanel">
                  <div className="panelHeading">
                    <div>
                      <h2>
                        Live Player Data
                      </h2>

                      <p>
                        Real-time data from
                        the active Roblox
                        server.
                      </p>
                    </div>

                    <button
                      className="smallButton"
                      onClick={
                        openLookupPlayerInMonitor
                      }
                    >
                      OPEN LIVE MONITOR
                    </button>
                  </div>

                  <div className="liveStatsGrid">
                    <div>
                      <span>
                        HEALTH
                      </span>

                      <strong>
                        {live.health}/
                        {live.maxHealth}
                      </strong>
                    </div>

                    <div>
                      <span>
                        STATE
                      </span>

                      <strong>
                        {live.humanoidState}
                      </strong>
                    </div>

                    <div>
                      <span>
                        TEAM
                      </span>

                      <strong>
                        {live.team}
                      </strong>
                    </div>

                    <div>
                      <span>
                        DEPARTMENT
                      </span>

                      <strong>
                        {live.department}
                      </strong>
                    </div>

                    <div>
                      <span>
                        VEHICLE
                      </span>

                      <strong>
                        {live.inVehicle
                          ? live.vehicleName ??
                            "Vehicle"
                          : "On Foot"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        ACCOUNT AGE
                      </span>

                      <strong>
                        {live.accountAge}d
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
                            live.position?.x
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Y</span>

                        <strong>
                          {formatPosition(
                            live.position?.y
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Z</span>

                        <strong>
                          {formatPosition(
                            live.position?.z
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="largePanel">
                <div className="panelHeading">
                  <div>
                    <h2>
                      Moderation
                    </h2>

                    <p>
                      Ban and admin status.
                    </p>
                  </div>
                </div>

                <div className="serverDetails">
                  <div>
                    <span>
                      SANTIONV BAN
                    </span>

                    <strong
                      className={
                        lookupResult
                          .moderation
                          ?.banned
                          ? "redText"
                          : "greenText"
                      }
                    >
                      {lookupResult
                        .moderation
                        ?.banned
                        ? "ACTIVE BAN"
                        : "NO BAN"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      BAN REASON
                    </span>

                    <strong>
                      {ban?.reason ??
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      BAN TYPE
                    </span>

                    <strong>
                      {ban
                        ? ban.permanent
                          ? "Permanent"
                          : "Temporary"
                        : "-"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ADMIN
                    </span>

                    <strong>
                      {lookupResult
                        .admin
                        ?.isAdmin
                        ? "YES"
                        : "NO"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ADMIN ROLE
                    </span>

                    <strong>
                      {admin?.role ??
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ADMIN LEVEL
                    </span>

                    <strong>
                      {admin?.level ??
                        "-"}
                    </strong>
                  </div>
                </div>

                {admin && (
                  <div className="adminPermissionList">
                    {admin.permissions
                      .length > 0 ? (
                      admin.permissions.map(
                        (
                          permission
                        ) => (
                          <span
                            key={
                              permission
                            }
                          >
                            {permission}
                          </span>
                        )
                      )
                    ) : (
                      <span className="noPermission">
                        No permissions
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ======================================================
     VEHICLES
     ====================================================== */

  function renderVehicles() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>
                Vehicle Database
              </h2>

              <p>
                Stored Roblox
                vehicle records.
              </p>
            </div>

            <button
              className="smallButton"
              onClick={
                loadVehicles
              }
            >
              REFRESH
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="panelMessage">
              No vehicles stored
              yet.
            </div>
          ) : (
            <div className="vehicleGrid">
              {vehicles.map(
                (vehicle) => (
                  <div
                    className="vehicleCard"
                    key={
                      vehicle.id
                    }
                  >
                    <span>
                      {vehicle.id}
                    </span>

                    <h3>
                      {vehicle.name}
                    </h3>

                    <p>
                      Model:{" "}
                      {vehicle.model ??
                        "-"}
                    </p>

                    <p>
                      Owner:{" "}
                      {vehicle.ownerUsername ??
                        "None"}
                    </p>

                    <p>
                      Driver:{" "}
                      {vehicle.driverUsername ??
                        "None"}
                    </p>

                    <p>
                      Engine:{" "}
                      {vehicle.engineOn
                        ? "ON"
                        : "OFF"}
                    </p>

                    <p>
                      Lock:{" "}
                      {vehicle.locked
                        ? "LOCKED"
                        : "OPEN"}
                    </p>

                    <p>
                      Fuel:{" "}
                      {vehicle.fuel ??
                        "-"}
                    </p>

                    <p>
                      Health:{" "}
                      {vehicle.health ??
                        "-"}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ======================================================
     BANS
     ====================================================== */

  function renderBans() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <h2>Ban Player</h2>

          <div className="formGrid">
            <input
              placeholder="User ID"
              value={
                banUserId
              }
              onChange={(
                event
              ) =>
                setBanUserId(
                  event.target.value
                )
              }
            />

            <input
              placeholder="Username"
              value={
                banUsername
              }
              onChange={(
                event
              ) =>
                setBanUsername(
                  event.target.value
                )
              }
            />

            <input
              placeholder="Reason"
              value={banReason}
              onChange={(
                event
              ) =>
                setBanReason(
                  event.target.value
                )
              }
            />

            <input
              placeholder="Minutes"
              disabled={
                banPermanent
              }
              value={
                banDuration
              }
              onChange={(
                event
              ) =>
                setBanDuration(
                  event.target.value
                )
              }
            />

            <label className="checkboxLine">
              <input
                type="checkbox"
                checked={
                  banPermanent
                }
                onChange={(
                  event
                ) =>
                  setBanPermanent(
                    event.target
                      .checked
                  )
                }
              />

              Permanent
            </label>

            <button
              className="dangerButton"
              onClick={banPlayer}
            >
              BAN PLAYER
            </button>
          </div>
        </div>

        <div className="largePanel">
          <div className="panelHeading">
            <h2>
              Active Bans
            </h2>

            <button
              className="smallButton"
              onClick={
                loadBans
              }
            >
              REFRESH
            </button>
          </div>

          {bans.length === 0 ? (
            <div className="panelMessage">
              No active bans.
            </div>
          ) : (
            <div className="banList">
              {bans.map(
                (ban) => (
                  <div
                    className="banCard"
                    key={
                      ban.userId
                    }
                  >
                    <div>
                      <strong>
                        {ban.username ??
                          ban.userId}
                      </strong>

                      <span>
                        User ID:{" "}
                        {
                          ban.userId
                        }
                      </span>

                      <span>
                        {
                          ban.reason
                        }
                      </span>

                      <span>
                        {ban.permanent
                          ? "Permanent"
                          : `Expires: ${formatDate(
                              ban.expiresAt ??
                                0
                            )}`}
                      </span>
                    </div>

                    <button
                      className="smallButton"
                      onClick={() =>
                        unbanPlayer(
                          ban.userId
                        )
                      }
                    >
                      UNBAN
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ======================================================
     ADMINS
     ====================================================== */

  function renderAdmins() {
    return (
      <div className="modulePage">
        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>
                {editingAdminId
                  ? "Edit Admin"
                  : "Add Admin"}
              </h2>

              <p>
                Configure role,
                level and individual
                permissions.
              </p>
            </div>

            {editingAdminId && (
              <button
                className="smallButton"
                onClick={
                  resetAdminForm
                }
              >
                CANCEL EDIT
              </button>
            )}
          </div>

          <div className="adminFormGrid">
            <label>
              Roblox User ID

              <input
                placeholder="User ID"
                value={
                  adminUserId
                }
                disabled={
                  editingAdminId !==
                  null
                }
                onChange={(
                  event
                ) =>
                  setAdminUserId(
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label>
              Username

              <input
                placeholder="Username"
                value={
                  adminUsername
                }
                onChange={(
                  event
                ) =>
                  setAdminUsername(
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label>
              Display Name

              <input
                placeholder="Display Name"
                value={
                  adminDisplayName
                }
                onChange={(
                  event
                ) =>
                  setAdminDisplayName(
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label>
              Role

              <select
                value={
                  adminRole
                }
                onChange={(
                  event
                ) =>
                  setAdminRole(
                    event.target.value
                  )
                }
              >
                <option value="Moderator">
                  Moderator
                </option>

                <option value="Admin">
                  Admin
                </option>

                <option value="Senior Admin">
                  Senior Admin
                </option>

                <option value="Head Admin">
                  Head Admin
                </option>

                <option value="Management">
                  Management
                </option>

                <option value="Owner">
                  Owner
                </option>
              </select>
            </label>

            <label>
              Admin Level

              <input
                type="number"
                min="1"
                max="100"
                value={
                  adminLevel
                }
                onChange={(
                  event
                ) =>
                  setAdminLevel(
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label className="adminActiveControl">
              <span>
                Admin Active
              </span>

              <input
                type="checkbox"
                checked={
                  adminActive
                }
                onChange={(
                  event
                ) =>
                  setAdminActive(
                    event.target
                      .checked
                  )
                }
              />
            </label>
          </div>

          <div className="permissionSection">
            <div className="permissionHeader">
              <div>
                <h3>
                  Permissions
                </h3>

                <p>
                  Select exactly
                  what this admin can
                  access.
                </p>
              </div>

              <div className="inlineButtons">
                <button
                  className="smallButton"
                  onClick={
                    giveAllPermissions
                  }
                >
                  SELECT ALL
                </button>

                <button
                  className="dangerButton"
                  onClick={
                    clearPermissions
                  }
                >
                  CLEAR
                </button>
              </div>
            </div>

            <div className="permissionGrid">
              {permissionOptions.map(
                (permission) => {
                  const checked =
                    adminPermissions.includes(
                      permission.key
                    );

                  return (
                    <label
                      key={
                        permission.key
                      }
                      className={
                        checked
                          ? "permissionCard permissionCardActive"
                          : "permissionCard"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          checked
                        }
                        onChange={() =>
                          toggleAdminPermission(
                            permission.key
                          )
                        }
                      />

                      <div>
                        <strong>
                          {
                            permission.label
                          }
                        </strong>

                        <span>
                          {
                            permission.key
                          }
                        </span>
                      </div>
                    </label>
                  );
                }
              )}
            </div>
          </div>

          <div className="adminSaveArea">
            <button
              className="adminSaveButton"
              onClick={
                saveAdmin
              }
            >
              {editingAdminId
                ? "UPDATE ADMIN"
                : "ADD ADMIN"}
            </button>
          </div>
        </div>

        <div className="largePanel">
          <div className="panelHeading">
            <div>
              <h2>
                Registered Admins
              </h2>

              <p>
                {admins.length} admin
                account
                {admins.length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <button
              className="smallButton"
              onClick={
                loadAdmins
              }
            >
              REFRESH
            </button>
          </div>

          {admins.length === 0 ? (
            <div className="panelMessage">
              No registered
              admins.
            </div>
          ) : (
            <div className="adminGrid">
              {admins.map(
                (admin) => (
                  <div
                    className={
                      admin.active
                        ? "adminCard"
                        : "adminCard adminCardDisabled"
                    }
                    key={
                      admin.userId
                    }
                  >
                    <div className="adminCardHeader">
                      <div className="adminAvatar">
                        {admin.username
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <h3>
                          {
                            admin.username
                          }
                        </h3>

                        <span>
                          {admin.role}
                        </span>
                      </div>

                      <div
                        className={
                          admin.active
                            ? "adminStatus active"
                            : "adminStatus"
                        }
                      >
                        {admin.active
                          ? "ACTIVE"
                          : "DISABLED"}
                      </div>
                    </div>

                    <div className="adminInfoGrid">
                      <div>
                        <span>
                          USER ID
                        </span>

                        <strong>
                          {
                            admin.userId
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          LEVEL
                        </span>

                        <strong>
                          {
                            admin.level
                          }
                        </strong>
                      </div>
                    </div>

                    <div className="adminPermissionList">
                      {admin.permissions
                        .length ===
                      0 ? (
                        <span className="noPermission">
                          No permissions
                        </span>
                      ) : (
                        admin.permissions.map(
                          (
                            permission
                          ) => (
                            <span
                              key={
                                permission
                              }
                            >
                              {
                                permission
                              }
                            </span>
                          )
                        )
                      )}
                    </div>

                    <div className="adminMeta">
                      Added by:{" "}
                      {
                        admin.addedBy
                      }
                    </div>

                    <div className="adminActions">
                      <button
                        className="smallButton"
                        onClick={() =>
                          editAdmin(
                            admin
                          )
                        }
                      >
                        EDIT
                      </button>

                      <button
                        className="adminToggleButton"
                        onClick={() =>
                          toggleAdminActive(
                            admin
                          )
                        }
                      >
                        {admin.active
                          ? "DISABLE"
                          : "ENABLE"}
                      </button>

                      <button
                        className="dangerButton"
                        onClick={() =>
                          removeAdmin(
                            admin.userId
                          )
                        }
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ======================================================
     PAGE ROUTER
     ====================================================== */

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
        return renderDashboard();
    }
  }

  /* ======================================================
     AUTH GATE
     ====================================================== */

  if (authLoading) {
    return (
      <main className="authScreen">
        <section className="authLoadingCard">
          <div className="authBrandIcon">S</div>
          <span className="authLoadingSpinner" />
          <p>OTURUM KONTROL EDİLİYOR</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="authScreen">
        <div className="authGrid" />
        <div className="authAmbient authAmbientOne" />
        <div className="authAmbient authAmbientTwo" />

        <section className="authCard">
          <div className="authBrand">
            <div className="authBrandIcon">S</div>
            <div>
              <strong>SantionV</strong>
              <span>ROBLOX ADMINISTRATION</span>
            </div>
          </div>

          <div className="authCardContent">
            <p className="authEyebrow">SECURE ACCESS</p>
            <h1>Yönetim Paneline Giriş</h1>
            <p className="authDescription">
              SantionV yönetim paneline erişmek için hesabınla güvenli şekilde giriş yap.
            </p>

            <div className="authLoginButtons">
              <a className="authLoginButton authDiscordButton" href="/api/auth/discord">
                <span className="authProviderIcon">D</span>
                <span>
                  <strong>Discord ile Giriş Yap</strong>
                  <small>Discord hesabınla devam et</small>
                </span>
                <b>→</b>
              </a>

              <button
                className="authLoginButton authGoogleButton"
                type="button"
                disabled
                title="Google girişi yakında eklenecek"
              >
                <span className="authProviderIcon">G</span>
                <span>
                  <strong>Google ile Giriş Yap</strong>
                  <small>Yakında kullanılabilir</small>
                </span>
                <b>→</b>
              </button>
            </div>

            <div className="authRegisterNote">
              <span>Hesabın yok mu?</span>
              <strong>İlk girişte hesabın otomatik oluşturulur.</strong>
            </div>
          </div>

          <footer className="authFooter">
            <span className="authSecureDot" />
            SECURE OAUTH LOGIN
            <i />
            SANTIONV CONTROL SYSTEM
          </footer>
        </section>
      </main>
    );
  }

  /* ======================================================
     MAIN
     ====================================================== */

  return (
    <main
      ref={panelRef}
      className="panel"
    >
      <aside className="sidebar">
        <div className="logo">
          <div className="logoIcon">
            S
          </div>

          <div>
            <strong>
              SantionV
            </strong>

            <span>
              ROBLOX ADMIN
            </span>
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
            <small>
              SERVER
            </small>

            <strong>
              {serverOnline
                ? "SantionV Roleplay"
                : "Server Offline"}
            </strong>
          </div>
        </div>

        <nav>
          <p className="menuTitle">
            PANEL
          </p>

          {pages.map((page) => (
            <button
              key={page}
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
          ))}
        </nav>

        <div className="account">
          <div className="avatar">
            S
          </div>

          <div>
            <strong>
              SantionV
            </strong>

            <span>
              Web Panel
            </span>
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
            <span className="topPlayerCount">
              {players.length}{" "}
              Players
            </span>

            <button
              className="topRefreshButton"
              onClick={
                loadEverything
              }
              aria-label="Refresh"
            >
              ↻
            </button>
          </div>
        </header>

        <div className="pageHeader">
          <div>
            <p>
              SANTIONV / ROBLOX
            </p>

            <h1>
              {activePage}
            </h1>
          </div>

          <div className="pageHeaderActions">
            {!authLoading && authUser && (
              <button
                className="discordProfileCard"
                onClick={() => {
                  setLogoutModalOpen(true);
                }}
                title="Çıkış yapmak için tıkla"
              >
                {authUser.avatar ? (
                  <img
                    src={authUser.avatar}
                    alt={authUser.displayName}
                    className="discordProfileAvatar"
                  />
                ) : (
                  <span className="discordProfileAvatar discordProfileAvatarFallback">
                    {(
                      authUser.displayName ||
                      authUser.username
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}

                <span className="discordProfileText">
                  <strong>
                    {authUser.displayName ||
                      authUser.username}
                  </strong>

                  <small>
                    {authUser.role.toUpperCase()}
                  </small>
                </span>
              </button>
            )}

            <div
              className={
                serverOnline
                  ? "onlineBadge"
                  : "onlineBadge offlineBadge"
              }
            >
              <span />

              {serverOnline
                ? "LIVE"
                : "OFFLINE"}
            </div>
          </div>
        </div>

        <div
          className="pageTransition"
          key={activePage}
        >
          {renderPage()}
        </div>
      </section>

      <div
        ref={cursorRef}
        className="customCursor"
        aria-hidden="true"
      />

      <canvas
        ref={trailCanvasRef}
        className="cursorTrailCanvas"
        aria-hidden="true"
      />

      {toast && (
        <div
          className={`toast toast-${toast.kind}`}
          role="status"
        >
          <span className="toastDot" />
          <strong>
            {toast.message}
          </strong>

          <button
            onClick={() =>
              setToast(null)
            }
          >
            ×
          </button>
        </div>
      )}

      {logoutModalOpen && (
        <div
          className="logoutModalBackdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setLogoutModalOpen(false);
            }
          }}
        >
          <div
            className="logoutModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
          >
            <div className="logoutModalIcon">
              ↪
            </div>

            <h2 id="logout-modal-title">
              Çıkış yapılsın mı?
            </h2>

            <p>
              Discord oturumun kapatılacak ve
              SantionV panelinden çıkış yapılacak.
            </p>

            <div className="logoutModalActions">
              <button
                className="logoutCancelButton"
                onClick={() =>
                  setLogoutModalOpen(false)
                }
              >
                İPTAL
              </button>

              <button
                className="logoutConfirmButton"
                onClick={() => {
                  setLogoutModalOpen(false);
                  void logout();
                }}
              >
                ÇIKIŞ
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div
          className="modalBackdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !confirmLoading
            ) {
              setConfirmModal(null);
            }
          }}
        >
          <div className="confirmModal">
            <div className="confirmModalIcon">
              !
            </div>

            <h2>
              {confirmModal.title}
            </h2>

            <p>
              {confirmModal.message}
            </p>

            <div className="confirmModalActions">
              <button
                className="smallButton modalCancelButton"
                disabled={
                  confirmLoading
                }
                onClick={() =>
                  setConfirmModal(null)
                }
              >
                CANCEL
              </button>

              <button
                className={
                  confirmModal.danger
                    ? "dangerButton"
                    : "adminSaveButton"
                }
                disabled={
                  confirmLoading
                }
                onClick={
                  confirmCurrentAction
                }
              >
                {confirmLoading
                  ? "WORKING..."
                  : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}