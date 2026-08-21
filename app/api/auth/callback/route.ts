import { NextResponse } from "next/server";
import crypto from "crypto";

const SESSION_COOKIE = "santionv_session";
const STATE_COOKIE = "santionv_discord_oauth_state";
const SESSION_DURATION = 60 * 60 * 12;

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordMember = {
  roles?: string[];
  nick?: string | null;
};

type SessionRole = "owner" | "admin";

function getEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createSessionToken(data: {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: SessionRole;
  permissions: string[];
}) {
  const secret = getEnv("AUTH_SECRET");

  const payload = {
    ...data,
    expiresAt: Date.now() + SESSION_DURATION * 1000,
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  const item = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!item) {
    return null;
  }

  return decodeURIComponent(
    item.substring(name.length + 1)
  );
}

function getAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) {
    return null;
  }

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);

    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const discordError = requestUrl.searchParams.get("error");

    if (discordError) {
      return NextResponse.redirect(
        new URL("/?auth=cancelled", request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?auth=invalid", request.url)
      );
    }

    const savedState = getCookie(request, STATE_COOKIE);

    if (!savedState || savedState !== state) {
      console.error("[SantionV OAuth] State mismatch");

      return NextResponse.redirect(
        new URL("/?auth=state_error", request.url)
      );
    }

    const clientId = getEnv("DISCORD_CLIENT_ID");
    const clientSecret = getEnv("DISCORD_CLIENT_SECRET");
    const redirectUri = getEnv("DISCORD_REDIRECT_URI");
    const guildId = getEnv("DISCORD_GUILD_ID");
    const ownerDiscordId = getEnv("DISCORD_OWNER_ID");

    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
        cache: "no-store",
      }
    );

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();

      console.error(
        "[SantionV OAuth] Token error:",
        tokenResponse.status,
        text
      );

      return NextResponse.redirect(
        new URL("/?auth=token_error", request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = String(tokenData?.access_token ?? "");

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/?auth=token_error", request.url)
      );
    }

    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!userResponse.ok) {
      return NextResponse.redirect(
        new URL("/?auth=user_error", request.url)
      );
    }

    const discordUser =
      (await userResponse.json()) as DiscordUser;

    const memberResponse = await fetch(
      `https://discord.com/api/users/@me/guilds/${guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!memberResponse.ok) {
      console.error(
        "[SantionV OAuth] User is not in SantionV server:",
        discordUser.username,
        discordUser.id
      );

      return NextResponse.redirect(
        new URL("/?auth=not_member", request.url)
      );
    }

    const member =
      (await memberResponse.json()) as DiscordMember;

    const isOwner =
      discordUser.id === ownerDiscordId;

    const role: SessionRole =
      isOwner ? "owner" : "admin";

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
      "map",
      "logs",
      "lookup",
    ];

    const sessionToken = createSessionToken({
      discordId: discordUser.id,
      username: discordUser.username,
      displayName:
        member.nick ||
        discordUser.global_name ||
        discordUser.username,
      avatar: getAvatarUrl(discordUser),
      role,
      permissions:
        isOwner
          ? ownerPermissions
          : adminPermissions,
    });

    const response = NextResponse.redirect(
      new URL("/?auth=success", request.url)
    );

    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION,
    });

    response.cookies.set({
      name: STATE_COOKIE,
      value: "",
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    console.log(
      "[SantionV OAuth] LOGIN SUCCESS",
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
      new URL("/?auth=server_error", request.url)
    );
  }
}