import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type RobloxPlayer = {
  userId: number;
  username: string;
  displayName: string;
  accountAge?: number;
};

type ServerData = {
  serverId: string;
  placeId: number;
  gameId: number;
  playerCount: number;
  maxPlayers: number;
  players: RobloxPlayer[];
  timestamp: number;
  lastSeen: number;
};

export async function GET() {
  try {
    const activeServerId = await redis.get<string>("santionv:active-server");

    if (!activeServerId) {
      return Response.json({
        success: true,
        online: false,
        server: null,
        players: [],
      });
    }

    const serverData = await redis.get<ServerData>(
      `santionv:server:${activeServerId}`
    );

    if (!serverData) {
      return Response.json({
        success: true,
        online: false,
        server: null,
        players: [],
      });
    }

    return Response.json({
      success: true,
      online: true,

      server: {
        serverId: serverData.serverId,
        placeId: serverData.placeId,
        gameId: serverData.gameId,
        playerCount: serverData.playerCount,
        maxPlayers: serverData.maxPlayers,
        lastSeen: serverData.lastSeen,
      },

      players: serverData.players,
    });
  } catch (error) {
    console.error("[SantionV Players API]", error);

    return Response.json(
      {
        success: false,
        online: false,
        message: "Player data could not be loaded",
        players: [],
      },
      {
        status: 500,
      }
    );
  }
}