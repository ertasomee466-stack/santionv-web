import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type AdminRecord = {
  userId: number;
  username: string;
  displayName?: string;

  level: number;
  role: string;

  permissions: string[];

  addedBy: string;
  createdAt: number;

  active: boolean;
};

type AdminRequest = {
  action?: "add" | "remove" | "update";

  userId?: number;
  username?: string;
  displayName?: string;

  level?: number;
  role?: string;

  permissions?: string[];

  addedBy?: string;
};

function adminKey(userId: number) {
  return `santionv:admin:${userId}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const userIdParam =
      url.searchParams.get("userId");

    if (userIdParam) {
      const userId = Number(userIdParam);

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

    const ids =
      await redis.smembers(
        "santionv:admins"
      );

    const admins: AdminRecord[] = [];

    for (const rawId of ids) {
      const userId = Number(rawId);

      if (!Number.isFinite(userId)) {
        continue;
      }

      const admin =
        await redis.get<AdminRecord>(
          adminKey(userId)
        );

      if (!admin) {
        await redis.srem(
          "santionv:admins",
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
    });
  } catch (error) {
    console.error(
      "[SantionV Admins GET]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Admin data could not be loaded",
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
      (await request.json()) as AdminRequest;

    const action = body.action;

    const userId = Number(body.userId);

    if (
      !action ||
      !["add", "remove", "update"].includes(
        action
      ) ||
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

    if (action === "remove") {
      await redis.del(adminKey(userId));

      await redis.srem(
        "santionv:admins",
        String(userId)
      );

      return Response.json({
        success: true,
        message: "Admin removed",
        userId,
      });
    }

    const existing =
      await redis.get<AdminRecord>(
        adminKey(userId)
      );

    const level = Number(
      body.level ?? existing?.level ?? 1
    );

    const permissions =
      Array.isArray(body.permissions)
        ? body.permissions.map(String)
        : existing?.permissions ?? [];

    const admin: AdminRecord = {
      userId,

      username:
        typeof body.username === "string" &&
        body.username.trim()
          ? body.username.trim()
          : existing?.username ??
            `User_${userId}`,

      displayName:
        typeof body.displayName === "string"
          ? body.displayName
          : existing?.displayName,

      level:
        Number.isFinite(level) && level > 0
          ? level
          : 1,

      role:
        typeof body.role === "string" &&
        body.role.trim()
          ? body.role.trim()
          : existing?.role ?? "Admin",

      permissions,

      addedBy:
        typeof body.addedBy === "string" &&
        body.addedBy.trim()
          ? body.addedBy.trim()
          : existing?.addedBy ??
            "SantionV Web Panel",

      createdAt:
        existing?.createdAt ?? Date.now(),

      active: true,
    };

    await redis.set(
      adminKey(userId),
      admin
    );

    await redis.sadd(
      "santionv:admins",
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