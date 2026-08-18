import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type AdminPermission =
  | "players"
  | "commands"
  | "bans"
  | "vehicles"
  | "logs"
  | "config"
  | "admins";

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

type AdminRequest = {
  action?: "add" | "update" | "remove";

  userId?: number;

  username?: string;
  displayName?: string;

  role?: string;
  level?: number;

  permissions?: AdminPermission[];

  active?: boolean;

  addedBy?: string;
};

const ADMIN_SET_KEY = "santionv:admins";

const allowedPermissions: AdminPermission[] = [
  "players",
  "commands",
  "bans",
  "vehicles",
  "logs",
  "config",
  "admins",
];

function adminKey(userId: number) {
  return `santionv:admin:${userId}`;
}

function normalizePermissions(
  permissions: unknown
): AdminPermission[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions
    .map(String)
    .filter((permission): permission is AdminPermission =>
      allowedPermissions.includes(
        permission as AdminPermission
      )
    );
}

/* =========================================================
   GET
   /api/roblox/admins
   /api/roblox/admins?userId=123
   ========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const userIdValue =
      url.searchParams.get("userId");

    /* -----------------------------------------------------
       TEK ADMIN KONTROLÜ
       Roblox WebPanelService bunu kullanır.
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
            isAdmin: false,
            admin: null,
            message: "Invalid userId",
          },
          {
            status: 400,
          }
        );
      }

      const admin =
        await redis.get<AdminRecord>(
          adminKey(userId)
        );

      if (!admin) {
        return Response.json({
          success: true,
          isAdmin: false,
          admin: null,
        });
      }

      return Response.json({
        success: true,
        isAdmin: admin.active,
        admin,
      });
    }

    /* -----------------------------------------------------
       TÜM ADMINLER
       ----------------------------------------------------- */

    const ids =
      await redis.smembers(ADMIN_SET_KEY);

    const admins: AdminRecord[] = [];

    for (const rawId of ids) {
      const userId = Number(rawId);

      if (
        !Number.isFinite(userId) ||
        userId <= 0
      ) {
        await redis.srem(
          ADMIN_SET_KEY,
          String(rawId)
        );

        continue;
      }

      const admin =
        await redis.get<AdminRecord>(
          adminKey(userId)
        );

      if (!admin) {
        await redis.srem(
          ADMIN_SET_KEY,
          String(userId)
        );

        continue;
      }

      admins.push(admin);
    }

    admins.sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level;
      }

      return a.username.localeCompare(
        b.username
      );
    });

    return Response.json({
      success: true,
      admins,
      count: admins.length,
    });
  } catch (error) {
    console.error(
      "[SantionV Admins GET]",
      error
    );

    return Response.json(
      {
        success: false,
        admins: [],
        message:
          "Admin data could not be loaded",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   ADD / UPDATE / REMOVE
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as AdminRequest;

    const action = body.action;

    const userId = Number(body.userId);

    if (
      !action ||
      !["add", "update", "remove"].includes(
        action
      )
    ) {
      return Response.json(
        {
          success: false,
          message: "Invalid admin action",
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
          message: "Invalid userId",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       REMOVE ADMIN
       ===================================================== */

    if (action === "remove") {
      await redis.del(
        adminKey(userId)
      );

      await redis.srem(
        ADMIN_SET_KEY,
        String(userId)
      );

      return Response.json({
        success: true,
        message: "Admin removed",
        userId,
      });
    }

    /* =====================================================
       ADD / UPDATE
       ===================================================== */

    const existing =
      await redis.get<AdminRecord>(
        adminKey(userId)
      );

    const levelValue = Number(
      body.level ?? existing?.level ?? 1
    );

    const level =
      Number.isFinite(levelValue) &&
      levelValue > 0
        ? Math.floor(levelValue)
        : 1;

    const permissions =
      body.permissions !== undefined
        ? normalizePermissions(
            body.permissions
          )
        : existing?.permissions ?? [];

    const now = Date.now();

    const admin: AdminRecord = {
      userId,

      username:
        typeof body.username ===
          "string" &&
        body.username.trim()
          ? body.username.trim()
          : existing?.username ??
            `User_${userId}`,

      displayName:
        typeof body.displayName ===
        "string"
          ? body.displayName.trim()
          : existing?.displayName,

      role:
        typeof body.role === "string" &&
        body.role.trim()
          ? body.role.trim()
          : existing?.role ?? "Admin",

      level,

      permissions,

      active:
        body.active !== undefined
          ? Boolean(body.active)
          : existing?.active ?? true,

      addedBy:
        typeof body.addedBy ===
          "string" &&
        body.addedBy.trim()
          ? body.addedBy.trim()
          : existing?.addedBy ??
            "SantionV Web Panel",

      createdAt:
        existing?.createdAt ?? now,

      updatedAt: now,
    };

    await redis.set(
      adminKey(userId),
      admin
    );

    await redis.sadd(
      ADMIN_SET_KEY,
      String(userId)
    );

    return Response.json({
      success: true,

      message:
        action === "update"
          ? "Admin updated"
          : "Admin added",

      admin,
    });
  } catch (error) {
    console.error(
      "[SantionV Admins POST]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Admin operation failed",
      },
      {
        status: 500,
      }
    );
  }
}