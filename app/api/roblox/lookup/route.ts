import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type PlayerPosition = {
  x: number;
  y: number;
  z: number;
};

type OnlinePlayer = {
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

type BanRecord = {
  userId: number;
  username?: string;

  reason: string;
  bannedBy: string;

  createdAt: number;
  expiresAt: number | null;

  permanent: boolean;
};

type AdminRecord = {
  userId: number;

  username: string;
  displayName?: string;

  role: string;
  level: number;

  permissions: string[];

  active: boolean;

  addedBy: string;

  createdAt: number;
  updatedAt: number;
};

const BAN_KEY = "santionv:bans";
const ADMIN_KEY = "santionv:admins";

/* =========================================================
   HELPERS
   ========================================================= */

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase();
}

function isActiveBan(
  ban: BanRecord
) {
  if (ban.permanent) {
    return true;
  }

  if (!ban.expiresAt) {
    return false;
  }

  return ban.expiresAt > Date.now();
}

/* =========================================================
   ROBLOX USERNAME -> USER ID
   ========================================================= */

async function getUserByUsername(
  username: string
) {
  try {
    const response = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: false,
        }),

        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (
      !Array.isArray(data.data) ||
      data.data.length === 0
    ) {
      return null;
    }

    return data.data[0];
  } catch (error) {
    console.error(
      "[SantionV Lookup Username]",
      error
    );

    return null;
  }
}

/* =========================================================
   ROBLOX USER ID -> PROFILE
   ========================================================= */

async function getUserById(
  userId: number
) {
  try {
    const response = await fetch(
      `https://users.roblox.com/v1/users/${userId}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(
      "[SantionV Lookup User ID]",
      error
    );

    return null;
  }
}

/* =========================================================
   GET ONLINE PLAYERS
   ========================================================= */

async function getOnlinePlayers() {
  try {
    /*
      players API'mizi doğrudan Redis üzerinden okumak yerine
      mevcut heartbeat kayıtlarını arıyoruz.

      Projede players route farklı key kullanıyorsa bile
      lookup Roblox profil sorgusunu çalıştırmaya devam eder.
    */

    const possibleKeys = [
      "santionv:players",
      "roblox:players",
      "santionv:online_players",
    ];

    for (const key of possibleKeys) {
      try {
        const data =
          await redis.get<
            OnlinePlayer[]
          >(key);

        if (Array.isArray(data)) {
          return data;
        }
      } catch {
        // sonraki key
      }
    }

    return [];
  } catch {
    return [];
  }
}

/* =========================================================
   GET
   /api/roblox/lookup?q=FarukErts
   /api/roblox/lookup?q=123456789
   ========================================================= */

export async function GET(
  request: Request
) {
  try {
    const url = new URL(
      request.url
    );

    const query =
      url.searchParams
        .get("q")
        ?.trim() ?? "";

    if (!query) {
      return Response.json(
        {
          success: false,
          message:
            "Username or User ID is required",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       FIND ROBLOX USER
       ===================================================== */

    let robloxUser: any = null;

    const numericId =
      Number(query);

    if (
      Number.isInteger(numericId) &&
      numericId > 0
    ) {
      robloxUser =
        await getUserById(
          numericId
        );
    } else {
      const usernameResult =
        await getUserByUsername(
          query
        );

      if (usernameResult?.id) {
        robloxUser =
          await getUserById(
            Number(
              usernameResult.id
            )
          );

        if (!robloxUser) {
          robloxUser =
            usernameResult;
        }
      }
    }

    if (
      !robloxUser ||
      !robloxUser.id
    ) {
      return Response.json(
        {
          success: false,
          found: false,
          message:
            "Roblox user not found",
        },
        {
          status: 404,
        }
      );
    }

    const userId =
      Number(robloxUser.id);

    /* =====================================================
       ONLINE STATUS
       ===================================================== */

    const onlinePlayers =
      await getOnlinePlayers();

    const onlinePlayer =
      onlinePlayers.find(
        (player) =>
          Number(
            player.userId
          ) === userId
      ) ?? null;

    /* =====================================================
       BAN STATUS
       ===================================================== */

    let ban: BanRecord | null =
      null;

    try {
      const bans =
        await redis.lrange<BanRecord>(
          BAN_KEY,
          0,
          499
        );

      ban =
        bans.find(
          (record) =>
            Number(
              record.userId
            ) === userId &&
            isActiveBan(record)
        ) ?? null;
    } catch {
      ban = null;
    }

    /* =====================================================
       ADMIN STATUS
       ===================================================== */

    let admin: AdminRecord | null =
      null;

    try {
      /*
        Admin route hash kullanıyorsa ilk olarak
        hash üzerinden kontrol ediyoruz.
      */

      const hashAdmin =
        await redis.hget<AdminRecord>(
          ADMIN_KEY,
          String(userId)
        );

      if (hashAdmin) {
        admin = hashAdmin;
      } else {
        /*
          Eski/list tabanlı kayıt desteği.
        */

        try {
          const adminList =
            await redis.lrange<AdminRecord>(
              ADMIN_KEY,
              0,
              499
            );

          admin =
            adminList.find(
              (record) =>
                Number(
                  record.userId
                ) === userId
            ) ?? null;
        } catch {
          admin = null;
        }
      }
    } catch {
      admin = null;
    }

    /* =====================================================
       RESPONSE
       ===================================================== */

    return Response.json({
      success: true,
      found: true,

      user: {
        userId,

        username:
          robloxUser.name ??
          query,

        displayName:
          robloxUser.displayName ??
          robloxUser.name ??
          query,

        description:
          robloxUser.description ??
          "",

        created:
          robloxUser.created ??
          null,

        isBanned:
          Boolean(
            robloxUser.isBanned
          ),
      },

      online: Boolean(
        onlinePlayer
      ),

      live: onlinePlayer,

      moderation: {
        banned:
          Boolean(ban),

        ban,
      },

      admin: {
        isAdmin:
          Boolean(
            admin?.active
          ),

        record: admin,
      },
    });
  } catch (error) {
    console.error(
      "[SantionV Lookup GET]",
      error
    );

    return Response.json(
      {
        success: false,
        found: false,

        message:
          "Lookup failed",
      },
      {
        status: 500,
      }
    );
  }
}