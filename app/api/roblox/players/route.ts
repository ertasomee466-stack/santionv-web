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

type ServerData = {
  serverId: string;

  placeId: number;
  gameId: number;

  playerCount: number;
  maxPlayers: number;

  lastSeen: number;
  timestamp?: number;

  players: RobloxPlayer[];
};

export async function GET() {
  try {
    // Aktif Roblox sunucusunu bul
    const activeServerId = await redis.get<string>(
      "santionv:active-server"
    );

    // Aktif sunucu yoksa site hata vermesin
    if (!activeServerId) {
      return Response.json({
        success: true,
        online: false,
        server: null,
        players: [],
      });
    }

    // Sunucu verilerini Redis'ten al
    const server = await redis.get<ServerData>(
      `santionv:server:${activeServerId}`
    );

    // Veri süresi dolmuşsa offline göster
    if (!server) {
      return Response.json({
        success: true,
        online: false,
        server: null,
        players: [],
      });
    }

    const players = Array.isArray(server.players)
      ? server.players
      : [];

    return Response.json({
      success: true,
      online: true,

      server: {
        serverId: server.serverId,
        placeId: server.placeId,
        gameId: server.gameId,

        playerCount: server.playerCount,
        maxPlayers: server.maxPlayers,

        lastSeen: server.lastSeen,
      },

      players,
    });
  } catch (error) {
    console.error("[SantionV Players API]", error);

    return Response.json(
      {
        success: false,
        online: false,
        message: "Player data could not be loaded.",
        server: null,
        players: [],
      },
      {
        status: 500,
      }
    );
  }
}