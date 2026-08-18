import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type BanRecord = {
  userId: number;
  username?: string;
  reason: string;
  bannedBy: string;
  createdAt: number;
  expiresAt: number | null;
  permanent: boolean;
};

type BanRequest = {
  action?: "ban" | "unban";
  userId?: number;
  username?: string;
  reason?: string;
  bannedBy?: string;
  durationMinutes?: number;
  permanent?: boolean;
};

function banKey(userId: number) {
  return `santionv:ban:${userId}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get("userId");

    if (userIdParam) {
      const userId = Number(userIdParam);

      if (!Number.isFinite(userId) || userId <= 0) {
        return Response.json(
          {
            success: false,
            message: "Invalid userId",
          },
          {
            status: 400,
          }
        );
      }

      const ban = await redis.get<BanRecord>(banKey(userId));

      if (!ban) {
        return Response.json({
          success: true,
          banned: false,
          ban: null,
        });
      }

      if (
        !ban.permanent &&
        ban.expiresAt !== null &&
        Date.now() >= ban.expiresAt
      ) {
        await redis.del(banKey(userId));
        await redis.srem("santionv:banned-users", String(userId));

        return Response.json({
          success: true,
          banned: false,
          ban: null,
        });
      }

      return Response.json({
        success: true,
        banned: true,
        ban,
      });
    }

    const ids = await redis.smembers("santionv:banned-users");

    const bans: BanRecord[] = [];

    for (const rawId of ids) {
      const userId = Number(rawId);

      if (!Number.isFinite(userId)) {
        continue;
      }

      const ban = await redis.get<BanRecord>(banKey(userId));

      if (!ban) {
        await redis.srem("santionv:banned-users", String(userId));
        continue;
      }

      if (
        !ban.permanent &&
        ban.expiresAt !== null &&
        Date.now() >= ban.expiresAt
      ) {
        await redis.del(banKey(userId));
        await redis.srem("santionv:banned-users", String(userId));
        continue;
      }

      bans.push(ban);
    }

    bans.sort((a, b) => b.createdAt - a.createdAt);

    return Response.json({
      success: true,
      bans,
    });
  } catch (error) {
    console.error("[SantionV Bans GET]", error);

    return Response.json(
      {
        success: false,
        message: "Ban data could not be loaded",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BanRequest;

    const action = body.action;
    const userId = Number(body.userId);

    if (
      !action ||
      !["ban", "unban"].includes(action) ||
      !Number.isFinite(userId) ||
      userId <= 0
    ) {
      return Response.json(
        {
          success: false,
          message: "Invalid request",
        },
        {
          status: 400,
        }
      );
    }

    if (action === "unban") {
      await redis.del(banKey(userId));
      await redis.srem("santionv:banned-users", String(userId));

      return Response.json({
        success: true,
        message: "Player unbanned",
        userId,
      });
    }

    const permanent = Boolean(body.permanent);

    const durationMinutes = Number(body.durationMinutes ?? 0);

    if (!permanent && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
      return Response.json(
        {
          success: false,
          message: "Temporary bans require durationMinutes > 0",
        },
        {
          status: 400,
        }
      );
    }

    const now = Date.now();

    const expiresAt = permanent
      ? null
      : now + durationMinutes * 60 * 1000;

    const ban: BanRecord = {
      userId,
      username:
        typeof body.username === "string"
          ? body.username
          : undefined,

      reason:
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : "No reason provided",

      bannedBy:
        typeof body.bannedBy === "string" && body.bannedBy.trim()
          ? body.bannedBy.trim()
          : "SantionV Web Panel",

      createdAt: now,
      expiresAt,
      permanent,
    };

    await redis.set(banKey(userId), ban);

    await redis.sadd(
      "santionv:banned-users",
      String(userId)
    );

    return Response.json({
      success: true,
      message: "Player banned",
      ban,
    });
  } catch (error) {
    console.error("[SantionV Bans POST]", error);

    return Response.json(
      {
        success: false,
        message: "Ban operation failed",
      },
      {
        status: 500,
      }
    );
  }
}