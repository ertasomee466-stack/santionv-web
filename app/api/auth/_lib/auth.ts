import crypto from "crypto";

export const SESSION_COOKIE = "santionv_session";
export const SESSION_DURATION = 60 * 60 * 12;

export type AuthRole =
  | "owner"
  | "admin"
  | "member";

export type AuthProvider =
  | "discord"
  | "google"
  | "password";

export type AuthSession = {
  accountId: string;
  provider: AuthProvider;
  email: string | null;
  username: string;
  displayName: string;
  avatar: string | null;
  role: AuthRole;
  permissions: string[];
  expiresAt: number;
};

export type StoredUser = {
  id: string;
  email: string | null;
  displayName: string;
  username: string;
  avatar: string | null;
  passwordHash?: string;
  googleSub?: string;
  discordId?: string;
  provider: AuthProvider;
  role: AuthRole;
  permissions: string[];
  createdAt: number;
  updatedAt: number;
};

export function getEnv(
  name: string
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    );
  }

  return value;
}

export function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase();
}

export function defaultPermissions(
  role: AuthRole
) {
  if (role === "owner") {
    return [
      "dashboard",
      "config",
      "players",
      "commands",
      "map",
      "logs",
      "lookup",
      "vehicles",
      "bans",
      "admins",
    ];
  }

  if (role === "admin") {
    return [
      "dashboard",
      "players",
      "commands",
      "map",
      "logs",
      "lookup",
    ];
  }

  return [
    "dashboard",
  ];
}

/* =========================================================
   UPSTASH REDIS REST
   ========================================================= */

async function redisCommand<T = unknown>(
  command: Array<
    string | number
  >
): Promise<T> {
  const url = getEnv(
    "UPSTASH_REDIS_REST_URL"
  );

  const token = getEnv(
    "UPSTASH_REDIS_REST_TOKEN"
  );

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${token}`,

        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(command),

      cache:
        "no-store",
    });

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Redis error ${response.status}: ${text}`
    );
  }

  const data =
    await response.json();

  return data.result as T;
}

function emailKey(
  email: string
) {
  return (
    "santionv:auth:email:" +
    normalizeEmail(email)
  );
}

function googleKey(
  sub: string
) {
  return (
    "santionv:auth:google:" +
    sub
  );
}

function userKey(
  id: string
) {
  return (
    "santionv:auth:user:" +
    id
  );
}

const USER_IDS_KEY =
  "santionv:auth:userids";

export async function getUserByEmail(
  email: string
): Promise<StoredUser | null> {
  const value =
    await redisCommand<
      string | null
    >([
      "GET",
      emailKey(email),
    ]);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(
      value
    ) as StoredUser;
  } catch {
    return null;
  }
}

export async function getUserByGoogleSub(
  sub: string
): Promise<StoredUser | null> {
  const id =
    await redisCommand<
      string | null
    >([
      "GET",
      googleKey(sub),
    ]);

  if (!id) {
    return null;
  }

  return getUserById(id);
}

export async function getUserById(
  id: string
): Promise<StoredUser | null> {
  const direct =
    await redisCommand<
      string | null
    >([
      "GET",
      userKey(id),
    ]);

  if (direct) {
    try {
      return JSON.parse(
        direct
      ) as StoredUser;
    } catch {
      // fallback below
    }
  }

  /*
    Compatibility for accounts created before the
    user-id index was added.
  */
  const keys =
    await redisCommand<
      string[]
    >([
      "KEYS",
      "santionv:auth:email:*",
    ]);

  if (!keys?.length) {
    return null;
  }

  const values =
    await redisCommand<
      Array<string | null>
    >([
      "MGET",
      ...keys,
    ]);

  for (const value of values) {
    if (!value) {
      continue;
    }

    try {
      const user =
        JSON.parse(
          value
        ) as StoredUser;

      if (user.id === id) {
        await saveUser(user);
        return user;
      }
    } catch {
      // ignore malformed records
    }
  }

  return null;
}

export async function getAllUsers():
  Promise<StoredUser[]> {
  const ids =
    await redisCommand<
      string[]
    >([
      "SMEMBERS",
      USER_IDS_KEY,
    ]);

  const users:
    StoredUser[] = [];

  if (ids?.length) {
    const values =
      await redisCommand<
        Array<string | null>
      >([
        "MGET",
        ...ids.map(userKey),
      ]);

    for (const value of values) {
      if (!value) {
        continue;
      }

      try {
        users.push(
          JSON.parse(
            value
          ) as StoredUser
        );
      } catch {
        // ignore malformed records
      }
    }
  }

  /*
    Add older email-based records that have not yet
    been migrated into the user-id index.
  */
  const oldKeys =
    await redisCommand<
      string[]
    >([
      "KEYS",
      "santionv:auth:email:*",
    ]);

  if (oldKeys?.length) {
    const oldValues =
      await redisCommand<
        Array<string | null>
      >([
        "MGET",
        ...oldKeys,
      ]);

    for (const value of oldValues) {
      if (!value) {
        continue;
      }

      try {
        const user =
          JSON.parse(
            value
          ) as StoredUser;

        if (
          !users.some(
            (item) =>
              item.id === user.id
          )
        ) {
          users.push(user);
          await saveUser(user);
        }
      } catch {
        // ignore malformed records
      }
    }
  }

  return users.sort(
    (a, b) =>
      b.createdAt -
      a.createdAt
  );
}

export async function saveUser(
  user: StoredUser
) {
  const json =
    JSON.stringify(user);

  await redisCommand([
    "SET",
    userKey(user.id),
    json,
  ]);

  await redisCommand([
    "SADD",
    USER_IDS_KEY,
    user.id,
  ]);

  if (user.email) {
    await redisCommand([
      "SET",
      emailKey(user.email),
      json,
    ]);
  }

  if (user.googleSub) {
    await redisCommand([
      "SET",
      googleKey(
        user.googleSub
      ),
      user.id,
    ]);
  }
}

/* =========================================================
   PASSWORD HASHING
   ========================================================= */

export async function hashPassword(
  password: string
) {
  const salt =
    crypto
      .randomBytes(16)
      .toString("hex");

  const hash =
    crypto.scryptSync(
      password,
      salt,
      64
    ).toString("hex");

  return (
    `scrypt$${salt}$${hash}`
  );
}

export async function verifyPassword(
  password: string,
  stored: string
) {
  const [
    algorithm,
    salt,
    hash,
  ] =
    stored.split("$");

  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hash
  ) {
    return false;
  }

  const calculated =
    crypto.scryptSync(
      password,
      salt,
      64
    );

  const expected =
    Buffer.from(
      hash,
      "hex"
    );

  if (
    calculated.length !==
    expected.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    calculated,
    expected
  );
}

/* =========================================================
   SESSION
   ========================================================= */

export function createSessionToken(
  data: Omit<
    AuthSession,
    "expiresAt"
  >
) {
  const payload: AuthSession = {
    ...data,

    expiresAt:
      Date.now() +
      SESSION_DURATION *
        1000,
  };

  const encoded =
    Buffer.from(
      JSON.stringify(payload)
    ).toString("base64url");

  const signature =
    crypto
      .createHmac(
        "sha256",
        getEnv(
          "AUTH_SECRET"
        )
      )
      .update(encoded)
      .digest("base64url");

  return (
    `${encoded}.${signature}`
  );
}

export function verifySessionToken(
  token: string
): AuthSession | null {
  try {
    const [
      encoded,
      signature,
    ] =
      token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          getEnv(
            "AUTH_SECRET"
          )
        )
        .update(encoded)
        .digest("base64url");

    const a =
      Buffer.from(
        signature
      );

    const b =
      Buffer.from(
        expected
      );

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(
        a,
        b
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      ) as AuthSession;

    if (
      !payload.accountId ||
      !payload.username ||
      !payload.displayName ||
      !payload.role ||
      !payload.expiresAt ||
      payload.expiresAt <=
        Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}