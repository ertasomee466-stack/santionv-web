import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type PlayerPosition = {
  x: number;
  y: number;
  z: number;
};

type RobloxPlayer = {
  userId: number;
  username: string;
  displayName: string;
  accountAge?: number;

  health?: number;
  maxHealth?: number;

  position?: PlayerPosition;

  team?: string;
  department?: string;

  inVehicle?: boolean;
  vehicleName?: string | null;

  humanoidState?: string;
};

type HeartbeatPayload = {
  serverId?: string;
  placeId?: number;
  gameId?: number;
  playerCount?: number;
  maxPlayers?: number;
  players?: RobloxPlayer[];
  timestamp?: number;
};

export async function GET() {
  return Response.json({
    success: true,
    message: "SantionV Roblox API is online",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HeartbeatPayload;

    const serverId =
      typeof body.serverId === "string" && body.serverId.length > 0
        ? body.serverId
        : "studio-server";

    const players = Array.isArray(body.players) ? body.players : [];

    const normalizedPlayers = players.map((player) => ({
      userId: Number(player.userId ?? 0),

      username: String(player.username ?? "Unknown"),
      displayName: String(
        player.displayName ?? player.username ?? "Unknown"
      ),

      accountAge: Number(player.accountAge ?? 0),

      health: Number(player.health ?? 0),
      maxHealth: Number(player.maxHealth ?? 0),

      position: {
        x: Number(player.position?.x ?? 0),
        y: Number(player.position?.y ?? 0),
        z: Number(player.position?.z ?? 0),
      },

      team: String(player.team ?? "None"),
      department: String(player.department ?? "None"),

      inVehicle: Boolean(player.inVehicle),

      vehicleName:
        player.vehicleName === null ||
        player.vehicleName === undefined
          ? null
          : String(player.vehicleName),

      humanoidState: String(player.humanoidState ?? "Unknown"),
    }));

    const serverData = {
      serverId,

      placeId: Number(body.placeId ?? 0),
      gameId: Number(body.gameId ?? 0),

      playerCount: Number(
        body.playerCount ?? normalizedPlayers.length
      ),

      maxPlayers: Number(body.maxPlayers ?? 0),

      players: normalizedPlayers,

      timestamp: Number(
        body.timestamp ?? Math.floor(Date.now() / 1000)
      ),

      lastSeen: Date.now(),
    };

    await redis.set(
      `santionv:server:${serverId}`,
      serverData,
      {
        ex: 60,
      }
    );

    await redis.set(
      "santionv:active-server",
      serverId,
      {
        ex: 60,
      }
    );

    return Response.json({
      success: true,
      message: "Heartbeat stored",

      serverId,

      playerCount: serverData.playerCount,

      playersStored: normalizedPlayers.length,
    });
  } catch (error) {
    console.error("[SantionV Heartbeat API]", error);

    return Response.json(
      {
        success: false,
        message: "Heartbeat could not be stored",
      },
      {
        status: 500,
      }
    );
  }
}