import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type LogLevel =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "admin"
  | "vehicle"
  | "ban"
  | "player";

type LogRecord = {
  id: string;
  level: LogLevel;

  message: string;

  userId?: number | null;
  username?: string | null;

  action?: string | null;
  source?: string | null;

  metadata?: Record<string, unknown>;

  createdAt: number;
};

type LogRequest = {
  level?: LogLevel;
  message?: string;

  userId?: number | null;
  username?: string | null;

  action?: string | null;
  source?: string | null;

  metadata?: Record<string, unknown>;
};

const LOG_KEY = "santionv:logs";
const MAX_LOGS = 500;

const allowedLevels: LogLevel[] = [
  "info",
  "success",
  "warning",
  "error",
  "admin",
  "vehicle",
  "ban",
  "player",
];

/* =========================================================
   GET
   /api/roblox/logs
   /api/roblox/logs?limit=100
   /api/roblox/logs?level=admin
   /api/roblox/logs?userId=123
   ========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const limitRaw = Number(
      url.searchParams.get("limit") ?? 100
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.isFinite(limitRaw)
          ? Math.floor(limitRaw)
          : 100,
        MAX_LOGS
      )
    );

    const levelFilter =
      url.searchParams.get("level");

    const userIdRaw =
      url.searchParams.get("userId");

    const userIdFilter =
      userIdRaw !== null
        ? Number(userIdRaw)
        : null;

    const logs =
      await redis.lrange<LogRecord>(
        LOG_KEY,
        0,
        MAX_LOGS - 1
      );

    let filtered = Array.isArray(logs)
      ? logs
      : [];

    if (
      levelFilter &&
      allowedLevels.includes(
        levelFilter as LogLevel
      )
    ) {
      filtered = filtered.filter(
        (log) =>
          log.level === levelFilter
      );
    }

    if (
      userIdFilter !== null &&
      Number.isFinite(userIdFilter)
    ) {
      filtered = filtered.filter(
        (log) =>
          Number(log.userId) ===
          userIdFilter
      );
    }

    filtered = filtered
      .sort(
        (a, b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      )
      .slice(0, limit);

    return Response.json({
      success: true,
      logs: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error(
      "[SantionV Logs GET]",
      error
    );

    return Response.json(
      {
        success: false,
        logs: [],
        message:
          "Logs could not be loaded",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   Roblox / WebPanelService buraya log gönderir
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as LogRequest;

    const level: LogLevel =
      body.level &&
      allowedLevels.includes(
        body.level
      )
        ? body.level
        : "info";

    const message =
      typeof body.message ===
        "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return Response.json(
        {
          success: false,
          message:
            "Log message is required",
        },
        {
          status: 400,
        }
      );
    }

    const userIdValue =
      body.userId !== undefined &&
      body.userId !== null
        ? Number(body.userId)
        : null;

    const log: LogRecord = {
      id: crypto.randomUUID(),

      level,

      message: message.slice(
        0,
        2000
      ),

      userId:
        userIdValue !== null &&
        Number.isFinite(userIdValue)
          ? userIdValue
          : null,

      username:
        typeof body.username ===
          "string"
          ? body.username
              .trim()
              .slice(0, 100)
          : null,

      action:
        typeof body.action ===
          "string"
          ? body.action
              .trim()
              .slice(0, 100)
          : null,

      source:
        typeof body.source ===
          "string"
          ? body.source
              .trim()
              .slice(0, 100)
          : null,

      metadata:
        body.metadata &&
        typeof body.metadata ===
          "object" &&
        !Array.isArray(
          body.metadata
        )
          ? body.metadata
          : undefined,

      createdAt: Date.now(),
    };

    await redis.lpush(
      LOG_KEY,
      log
    );

    await redis.ltrim(
      LOG_KEY,
      0,
      MAX_LOGS - 1
    );

    return Response.json({
      success: true,
      message: "Log stored",
      log,
    });
  } catch (error) {
    console.error(
      "[SantionV Logs POST]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Log could not be stored",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   DELETE
   /api/roblox/logs
   Tüm logları temizler
   ========================================================= */

export async function DELETE() {
  try {
    await redis.del(LOG_KEY);

    return Response.json({
      success: true,
      message: "All logs cleared",
    });
  } catch (error) {
    console.error(
      "[SantionV Logs DELETE]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Logs could not be cleared",
      },
      {
        status: 500,
      }
    );
  }
}