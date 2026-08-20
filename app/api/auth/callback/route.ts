import { NextResponse } from "next/server";
import crypto from "crypto";

/* =========================================================
   SANTIONV DISCORD OAUTH CALLBACK
   ========================================================= */

const SESSION_COOKIE =
  "santionv_session";

const STATE_COOKIE =
  "santionv_discord_oauth_state";

const SESSION_DURATION =
  60 * 60 * 12; // 12 saat

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordMember = {
  roles: string[];
  nick?: string | null;
};

/* =========================================================
   ENV
   ========================================================= */

function getEnv(name: string) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    );
  }

  return value;
}

/* =========================================================
   SESSION TOKEN
   ========================================================= */

function createSessionToken(data: {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string | null;

  role: "owner" | "admin";

  permissions: string[];
}) {
  const secret =
    getEnv("AUTH_SECRET");

  const payload = {
    ...data,

    expiresAt:
      Date.now() +
      SESSION_DURATION * 1000,
  };

  const encodedPayload =
    Buffer.from(
      JSON.stringify(payload)
    ).toString("base64url");

  const signature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(encodedPayload)
      .digest("base64url");

  return (
    encodedPayload +
    "." +
    signature
  );
}

/* =========================================================
   CALLBACK
   ========================================================= */

export async function GET(
  request: Request
) {
  try {
    const requestUrl =
      new URL(request.url);

    const code =
      requestUrl.searchParams.get(
        "code"
      );

    const state =
      requestUrl.searchParams.get(
        "state"
      );

    const error =
      requestUrl.searchParams.get(
        "error"
      );

    if (error) {
      console.error(
        "[SantionV OAuth] Discord error:",
        error
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=cancelled",
          request.url
        )
      );
    }

    if (
      !code ||
      !state
    ) {
      return NextResponse.redirect(
        new URL(
          "/?auth=invalid",
          request.url
        )
      );
    }

    /* =====================================================
       STATE COOKIE KONTROL
       ===================================================== */

    const cookieHeader =
      request.headers.get(
        "cookie"
      ) ?? "";

    const stateCookie =
      cookieHeader
        .split(";")
        .map(
          (item) =>
            item.trim()
        )
        .find((item) =>
          item.startsWith(
            `${STATE_COOKIE}=`
          )
        )
        ?.split("=")
        .slice(1)
        .join("=");

    if (
      !stateCookie ||
      stateCookie !== state
    ) {
      console.error(
        "[SantionV OAuth] Invalid state"
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=state_error",
          request.url
        )
      );
    }

    /* =====================================================
       ENV
       ===================================================== */

    const clientId =
      getEnv(
        "DISCORD_CLIENT_ID"
      );

    const clientSecret =
      getEnv(
        "DISCORD_CLIENT_SECRET"
      );

    const redirectUri =
      getEnv(
        "DISCORD_REDIRECT_URI"
      );

    const guildId =
      getEnv(
        "DISCORD_GUILD_ID"
      );

    /* =====================================================
       CODE -> ACCESS TOKEN
       ===================================================== */

    const tokenBody =
      new URLSearchParams();

    tokenBody.set(
      "client_id",
      clientId
    );

    tokenBody.set(
      "client_secret",
      clientSecret
    );

    tokenBody.set(
      "grant_type",
      "authorization_code"
    );

    tokenBody.set(
      "code",
      code
    );

    tokenBody.set(
      "redirect_uri",
      redirectUri
    );

    const tokenResponse =
      await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            tokenBody.toString(),

          cache: "no-store",
        }
      );

    if (!tokenResponse.ok) {
      const tokenError =
        await tokenResponse.text();

      console.error(
        "[SantionV OAuth] Token error:",
        tokenError
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=token_error",
          request.url
        )
      );
    }

    const tokenData =
      await tokenResponse.json();

    const accessToken =
      String(
        tokenData.access_token ?? ""
      );

    if (!accessToken) {
      return NextResponse.redirect(
        new URL(
          "/?auth=token_error",
          request.url
        )
      );
    }

    /* =====================================================
       DISCORD USER
       ===================================================== */

    const userResponse =
      await fetch(
        "https://discord.com/api/users/@me",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    if (!userResponse.ok) {
      return NextResponse.redirect(
        new URL(
          "/?auth=user_error",
          request.url
        )
      );
    }

    const discordUser =
      (await userResponse.json()) as
        DiscordUser;

    /* =====================================================
       SANTIONV SERVER MEMBER
       ===================================================== */

    const memberResponse =
      await fetch(
        `https://discord.com/api/users/@me/guilds/${guildId}/member`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    if (!memberResponse.ok) {
      console.log(
        "[SantionV OAuth] User is not in SantionV server:",
        discordUser.username
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=not_member",
          request.url
        )
      );
    }

    const member =
      (await memberResponse.json()) as
        DiscordMember;

    /* =====================================================
       OWNER / ADMIN YETKİSİ
       ===================================================== */

    const ownerDiscordId =
      process.env
        .DISCORD_OWNER_ID ??
      "";

    const adminRoleIds =
      (
        process.env
          .DISCORD_ADMIN_ROLE_IDS ??
        ""
      )
        .split(",")
        .map(
          (role) =>
            role.trim()
        )
        .filter(Boolean);

    const isOwner =
      ownerDiscordId !== "" &&
      discordUser.id ===
        ownerDiscordId;

    const isAdmin =
      member.roles.some(
        (roleId) =>
          adminRoleIds.includes(
            roleId
          )
      );

    if (
      !isOwner &&
      !isAdmin
    ) {
      console.log(
        "[SantionV OAuth] Permission denied:",
        discordUser.username,
        discordUser.id
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=no_permission",
          request.url
        )
      );
    }

    /* =====================================================
       PERMISSIONS
       ===================================================== */

    const ownerPermissions = [
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

    const adminPermissions = [
      "dashboard",
      "players",
      "commands",
      "map",
      "logs",
      "lookup",
    ];

    const role:
      | "owner"
      | "admin" =
      isOwner
        ? "owner"
        : "admin";

    const permissions =
      isOwner
        ? ownerPermissions
        : adminPermissions;

    /* =====================================================
       AVATAR
       ===================================================== */

    const avatar =
      discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

    /* =====================================================
       SESSION
       ===================================================== */

    const sessionToken =
      createSessionToken({
        discordId:
          discordUser.id,

        username:
          discordUser.username,

        displayName:
          discordUser.global_name ??
          discordUser.username,

        avatar,

        role,

        permissions,
      });

    /* =====================================================
       PANEL'E DÖN
       ===================================================== */

    const response =
      NextResponse.redirect(
        new URL(
          "/?auth=success",
          request.url
        )
      );

    response.cookies.set({
      name:
        SESSION_COOKIE,

      value:
        sessionToken,

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        SESSION_DURATION,
    });

    /* OAuth state artık lazım değil */

    response.cookies.set({
      name:
        STATE_COOKIE,

      value:
        "",

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        0,
    });

    console.log(
      "[SantionV OAuth] LOGIN:",
      discordUser.username,
      discordUser.id,
      role
    );

    return response;
  } catch (error) {
    console.error(
      "[SantionV Discord Callback]",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/?auth=server_error",
        request.url
      )
    );
  }
}