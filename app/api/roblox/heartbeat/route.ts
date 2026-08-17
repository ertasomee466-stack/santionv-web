import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type RobloxPlayer = {
  userId: number;
  username: string;
  displayName: string;
  accountAge?: number;
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

    const serverData = {
      serverId,
      placeId: Number(body.placeId ?? 0),
      gameId: Number(body.gameId ?? 0),
      playerCount: Number(body.playerCount ?? players.length),
      maxPlayers: Number(body.maxPlayers ?? 0),

      players: players.map((player) => ({
        userId: Number(player.userId),
        username: String(player.username),
        displayName: String(player.displayName),
        accountAge: Number(player.accountAge ?? 0),
      })),

      timestamp: Number(body.timestamp ?? Math.floor(Date.now() / 1000)),
      lastSeen: Date.now(),
    };

    // Bu sunucunun son heartbeat verisi.
    await redis.set(`santionv:server:${serverId}`, serverData, {
      ex: 60,
    });

    // Panelin kolayca okuyacağı aktif sunucu.
    await redis.set("santionv:active-server", serverId, {
      ex: 60,
    });

    return Response.json({
      success: true,
      message: "Heartbeat stored",
      serverId,
      playerCount: serverData.playerCount,
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