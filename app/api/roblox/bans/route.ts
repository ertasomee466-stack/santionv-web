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

function getBanKey(userId: number) {
  return `santionv:ban:${userId}`;
}

const BAN_SET_KEY = "santionv:banned-users";

async function removeExpiredBan(
  userId: number,
  ban: BanRecord
) {
  if (
    ban.permanent ||
    ban.expiresAt === null
  ) {
    return false;
  }

  if (Date.now() < ban.expiresAt) {
    return false;
  }

  await redis.del(getBanKey(userId));

  await redis.srem(
    BAN_SET_KEY,
    String(userId)
  );

  return true;
}

/* =========================================================
   GET
   /api/roblox/bans
   /api/roblox/bans?userId=123
   ========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const userIdValue =
      url.searchParams.get("userId");

    /* -----------------------------------------------------
       TEK OYUNCU BAN KONTROLÜ
       Roblox WebPanelService bunu kullanıyor.
       ----------------------------------------------------- */

    if (userIdValue) {
      const userId = Number(userIdValue);

      if (
        !Number.isFinite(userId) ||
        userId <= 0
      ) {
        return Response.json(
          {
            success: false,
            banned: false,
            ban: null,
            message: "Invalid userId",
          },
          {
            status: 400,
          }
        );
      }

      const ban =
        await redis.get<BanRecord>(
          getBanKey(userId)
        );

      if (!ban) {
        return Response.json({
          success: true,
          banned: false,
          ban: null,
        });
      }

      const expired =
        await removeExpiredBan(
          userId,
          ban
        );

      if (expired) {
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

    /* -----------------------------------------------------
       TÜM BANLARI LİSTELE
       Web panel Bans sayfası bunu kullanıyor.
       ----------------------------------------------------- */

    const ids =
      await redis.smembers(BAN_SET_KEY);

    const bans: BanRecord[] = [];

    for (const rawId of ids) {
      const userId = Number(rawId);

      if (
        !Number.isFinite(userId) ||
        userId <= 0
      ) {
        await redis.srem(
          BAN_SET_KEY,
          String(rawId)
        );

        continue;
      }

      const ban =
        await redis.get<BanRecord>(
          getBanKey(userId)
        );

      if (!ban) {
        await redis.srem(
          BAN_SET_KEY,
          String(userId)
        );

        continue;
      }

      const expired =
        await removeExpiredBan(
          userId,
          ban
        );

      if (expired) {
        continue;
      }

      bans.push(ban);
    }

    bans.sort(
      (a, b) =>
        b.createdAt - a.createdAt
    );

    return Response.json({
      success: true,
      bans,
      count: bans.length,
    });
  } catch (error) {
    console.error(
      "[SantionV Bans GET]",
      error
    );

    return Response.json(
      {
        success: false,
        banned: false,
        bans: [],
        message:
          "Ban data could not be loaded",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   BAN / UNBAN
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as BanRequest;

    const action = body.action;

    const userId = Number(
      body.userId
    );

    if (
      !action ||
      !["ban", "unban"].includes(
        action
      )
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Invalid ban action",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(userId) ||
      userId <= 0
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Invalid userId",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       UNBAN
       ===================================================== */

    if (action === "unban") {
      await redis.del(
        getBanKey(userId)
      );

      await redis.srem(
        BAN_SET_KEY,
        String(userId)
      );

      return Response.json({
        success: true,
        message: "Player unbanned",
        userId,
      });
    }

    /* =====================================================
       BAN
       ===================================================== */

    const permanent =
      Boolean(body.permanent);

    const durationMinutes =
      Number(
        body.durationMinutes ?? 0
      );

    if (
      !permanent &&
      (
        !Number.isFinite(
          durationMinutes
        ) ||
        durationMinutes <= 0
      )
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Temporary ban requires a valid duration",
        },
        {
          status: 400,
        }
      );
    }

    const now = Date.now();

    const expiresAt =
      permanent
        ? null
        : now +
          durationMinutes *
            60 *
            1000;

    const ban: BanRecord = {
      userId,

      username:
        typeof body.username ===
          "string" &&
        body.username.trim()
          ? body.username.trim()
          : undefined,

      reason:
        typeof body.reason ===
          "string" &&
        body.reason.trim()
          ? body.reason.trim()
          : "No reason provided",

      bannedBy:
        typeof body.bannedBy ===
          "string" &&
        body.bannedBy.trim()
          ? body.bannedBy.trim()
          : "SantionV Web Panel",

      createdAt: now,
      expiresAt,
      permanent,
    };

    await redis.set(
      getBanKey(userId),
      ban
    );

    await redis.sadd(
      BAN_SET_KEY,
      String(userId)
    );

    /* -----------------------------------------------------
       Oyuncu online ise aynı zamanda command queue'ya
       KICK komutu gönder.
       ----------------------------------------------------- */

    await redis.rpush(
      "santionv:admin-command-queue",
      {
        id: crypto.randomUUID(),
        command: "kick",
        userId,
        targetUserId: null,
        reason:
          `Banned: ${ban.reason}`,
        createdAt: Date.now(),
      }
    );

    await redis.expire(
      "santionv:admin-command-queue",
      300
    );

    return Response.json({
      success: true,
      message: "Player banned",
      ban,
    });
  } catch (error) {
    console.error(
      "[SantionV Bans POST]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Ban operation failed",
      },
      {
        status: 500,
      }
    );
  }
}