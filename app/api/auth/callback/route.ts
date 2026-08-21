import { NextResponse } from "next/server";

import {
  createSessionToken,
  defaultPermissions,
  getEnv,
  SESSION_COOKIE,
  SESSION_DURATION,
} from "../_lib/auth";

const STATE_COOKIE =
  "santionv_discord_oauth_state";

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordMember = {
  nick?: string | null;
};

function readCookie(
  request: Request,
  name: string
) {
  const header =
    request.headers.get(
      "cookie"
    ) ?? "";

  const item =
    header
      .split(";")
      .map(
        (part) =>
          part.trim()
      )
      .find(
        (part) =>
          part.startsWith(
            `${name}=`
          )
      );

  if (!item) {
    return null;
  }

  return decodeURIComponent(
    item.slice(
      name.length + 1
    )
  );
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const code =
      url.searchParams.get(
        "code"
      );

    const state =
      url.searchParams.get(
        "state"
      );

    const savedState =
      readCookie(
        request,
        STATE_COOKIE
      );

    if (
      !code ||
      !state ||
      !savedState ||
      state !== savedState
    ) {
      return NextResponse.redirect(
        new URL(
          "/?auth=state_error",
          request.url
        )
      );
    }

    const tokenResponse =
      await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              client_id:
                getEnv(
                  "DISCORD_CLIENT_ID"
                ),

              client_secret:
                getEnv(
                  "DISCORD_CLIENT_SECRET"
                ),

              grant_type:
                "authorization_code",

              code,

              redirect_uri:
                getEnv(
                  "DISCORD_REDIRECT_URI"
                ),
            }),

          cache:
            "no-store",
        }
      );

    if (
      !tokenResponse.ok
    ) {
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
        tokenData?.access_token ??
        ""
      );

    const userResponse =
      await fetch(
        "https://discord.com/api/users/@me",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    if (
      !userResponse.ok
    ) {
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

    const memberResponse =
      await fetch(
        `https://discord.com/api/users/@me/guilds/${getEnv(
          "DISCORD_GUILD_ID"
        )}/member`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    if (
      !memberResponse.ok
    ) {
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

    const isOwner =
      discordUser.id ===
      getEnv(
        "DISCORD_OWNER_ID"
      );

    const role =
      isOwner
        ? "owner" as const
        : "member" as const;

    const avatar =
      discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
        : null;

    const token =
      createSessionToken({
        accountId:
          `discord:${discordUser.id}`,

        provider:
          "discord",

        email:
          null,

        username:
          discordUser.username,

        displayName:
          member.nick ||
          discordUser.global_name ||
          discordUser.username,

        avatar,

        role,

        permissions:
          defaultPermissions(
            role
          ),
      });

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
        token,

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