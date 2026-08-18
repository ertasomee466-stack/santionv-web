import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const CONFIG_KEY = "santionv:server-config";

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

const defaultConfig: ServerConfig = {
  maintenanceMode: false,
  serverLocked: false,

  joinMessage: "Welcome to SantionV.",
  maintenanceMessage:
    "SantionV is currently under maintenance.",

  maxPlayersOverride: null,

  commandsEnabled: true,
  bansEnabled: true,
  vehiclesEnabled: true,
  logsEnabled: true,

  autoKickBannedPlayers: true,

  heartbeatInterval: 5,
  commandInterval: 2,

  updatedAt: Date.now(),
  updatedBy: "System",
};

export async function GET() {
  try {
    const stored =
      await redis.get<ServerConfig>(CONFIG_KEY);

    const config: ServerConfig = {
      ...defaultConfig,
      ...(stored ?? {}),
    };

    return Response.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error(
      "[SantionV Config GET]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Configuration could not be loaded",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as Partial<ServerConfig>;

    const existing =
      await redis.get<ServerConfig>(CONFIG_KEY);

    const current: ServerConfig = {
      ...defaultConfig,
      ...(existing ?? {}),
    };

    const heartbeatInterval =
      body.heartbeatInterval !== undefined
        ? Math.max(
            2,
            Math.min(
              60,
              Number(body.heartbeatInterval)
            )
          )
        : current.heartbeatInterval;

    const commandInterval =
      body.commandInterval !== undefined
        ? Math.max(
            1,
            Math.min(
              60,
              Number(body.commandInterval)
            )
          )
        : current.commandInterval;

    let maxPlayersOverride =
      current.maxPlayersOverride;

    if (body.maxPlayersOverride === null) {
      maxPlayersOverride = null;
    } else if (
      body.maxPlayersOverride !== undefined
    ) {
      const parsed = Number(
        body.maxPlayersOverride
      );

      maxPlayersOverride =
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : null;
    }

    const config: ServerConfig = {
      maintenanceMode:
        body.maintenanceMode !== undefined
          ? Boolean(body.maintenanceMode)
          : current.maintenanceMode,

      serverLocked:
        body.serverLocked !== undefined
          ? Boolean(body.serverLocked)
          : current.serverLocked,

      joinMessage:
        typeof body.joinMessage === "string"
          ? body.joinMessage.slice(0, 500)
          : current.joinMessage,

      maintenanceMessage:
        typeof body.maintenanceMessage ===
        "string"
          ? body.maintenanceMessage.slice(
              0,
              500
            )
          : current.maintenanceMessage,

      maxPlayersOverride,

      commandsEnabled:
        body.commandsEnabled !== undefined
          ? Boolean(body.commandsEnabled)
          : current.commandsEnabled,

      bansEnabled:
        body.bansEnabled !== undefined
          ? Boolean(body.bansEnabled)
          : current.bansEnabled,

      vehiclesEnabled:
        body.vehiclesEnabled !== undefined
          ? Boolean(body.vehiclesEnabled)
          : current.vehiclesEnabled,

      logsEnabled:
        body.logsEnabled !== undefined
          ? Boolean(body.logsEnabled)
          : current.logsEnabled,

      autoKickBannedPlayers:
        body.autoKickBannedPlayers !==
        undefined
          ? Boolean(
              body.autoKickBannedPlayers
            )
          : current.autoKickBannedPlayers,

      heartbeatInterval,
      commandInterval,

      updatedAt: Date.now(),

      updatedBy:
        typeof body.updatedBy === "string" &&
        body.updatedBy.trim()
          ? body.updatedBy
              .trim()
              .slice(0, 100)
          : "SantionV Web Panel",
    };

    await redis.set(CONFIG_KEY, config);

    return Response.json({
      success: true,
      message: "Configuration updated",
      config,
    });
  } catch (error) {
    console.error(
      "[SantionV Config POST]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Configuration could not be updated",
      },
      {
        status: 500,
      }
    );
  }
}