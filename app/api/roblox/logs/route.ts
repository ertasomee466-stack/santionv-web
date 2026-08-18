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

const LOG_LIST_KEY = "santionv:logs";
const MAX_LOGS = 500;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const limitParam = Number(
      url.searchParams.get("limit") ?? 100
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.isFinite(limitParam)
          ? limitParam
          : 100,
        500
      )
    );

    const logs =
      await redis.lrange<LogRecord>(
        LOG_LIST_KEY,
        0,
        limit - 1
      );

    return Response.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error(
      "[SantionV Logs GET]",
      error
    );

    return Response.json(
      {
        success: false,
        message: "Logs could not be loaded",
        logs: [],
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as LogRequest;

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

    const level =
      body.level &&
      allowedLevels.includes(body.level)
        ? body.level
        : "info";

    const message =
      typeof body.message === "string"
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

    const log: LogRecord = {
      id: crypto.randomUUID(),

      level,

      message,

      userId:
        body.userId !== undefined
          ? Number(body.userId)
          : null,

      username:
        typeof body.username === "string"
          ? body.username
          : null,

      action:
        typeof body.action === "string"
          ? body.action
          : null,

      source:
        typeof body.source === "string"
          ? body.source
          : null,

      metadata:
        body.metadata &&
        typeof body.metadata === "object"
          ? body.metadata
          : undefined,

      createdAt: Date.now(),
    };

    await redis.lpush(
      LOG_LIST_KEY,
      log
    );

    await redis.ltrim(
      LOG_LIST_KEY,
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
        message: "Log could not be stored",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE() {
  try {
    await redis.del(LOG_LIST_KEY);

    return Response.json({
      success: true,
      message: "Logs cleared",
    });
  } catch (error) {
    console.error(
      "[SantionV Logs DELETE]",
      error
    );

    return Response.json(
      {
        success: false,
        message: "Logs could not be cleared",
      },
      {
        status: 500,
      }
    );
  }
}