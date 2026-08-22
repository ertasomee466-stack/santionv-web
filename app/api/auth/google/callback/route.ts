import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  createSessionToken,
  defaultPermissions,
  getEnv,
  getUserByEmail,
  getUserByGoogleSub,
  normalizeEmail,
  saveUser,
  SESSION_COOKIE,
  SESSION_DURATION,
  type StoredUser,
} from "../../_lib/auth";

const STATE_COOKIE =
  "santionv_google_oauth_state";

type GoogleUser = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
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
          "/?auth=google_state_error",
          request.url
        )
      );
    }

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
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
                  "GOOGLE_CLIENT_ID"
                ),

              client_secret:
                getEnv(
                  "GOOGLE_CLIENT_SECRET"
                ),

              code,

              grant_type:
                "authorization_code",

              redirect_uri:
                getEnv(
                  "GOOGLE_REDIRECT_URI"
                ),
            }),

          cache:
            "no-store",
        }
      );

    if (
      !tokenResponse.ok
    ) {
      const text =
        await tokenResponse.text();

      console.error(
        "[SantionV Google Token]",
        text
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=google_token_error",
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
        "https://openidconnect.googleapis.com/v1/userinfo",
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
          "/?auth=google_user_error",
          request.url
        )
      );
    }

    const googleUser =
      (await userResponse.json()) as
        GoogleUser;

    const email =
      normalizeEmail(
        googleUser.email
      );

    if (
      !googleUser.sub ||
      !email
    ) {
      return NextResponse.redirect(
        new URL(
          "/?auth=google_user_error",
          request.url
        )
      );
    }

    let user =
      await getUserByGoogleSub(
        googleUser.sub
      );

    if (!user) {
      user =
        await getUserByEmail(
          email
        );
    }

    const now =
      Date.now();

    const ownerEmail =
      process.env.GOOGLE_OWNER_EMAIL
        ?.trim()
        .toLowerCase();

    const googleRole =
      ownerEmail &&
      email === ownerEmail
        ? "owner" as const
        : "member" as const;

    if (!user) {
      const role =
        googleRole;

      user = {
        id:
          crypto
            .randomUUID(),

        email,

        displayName:
          googleUser.name ||
          email.split("@")[0],

        username:
          email.split("@")[0],

        avatar:
          googleUser.picture ??
          null,

        googleSub:
          googleUser.sub,

        provider:
          "google",

        role,

        permissions:
          defaultPermissions(
            role
          ),

        createdAt:
          now,

        updatedAt:
          now,
      } satisfies StoredUser;
    } else {
      user = {
        ...user,

        googleSub:
          googleUser.sub,

        avatar:
          googleUser.picture ??
          user.avatar,

        displayName:
          googleUser.name ||
          user.displayName,

        role:
          googleRole,

        permissions:
          defaultPermissions(
            googleRole
          ),

        updatedAt:
          now,
      };
    }

    await saveUser(
      user
    );

    const token =
      createSessionToken({
        accountId:
          user.id,

        provider:
          "google",

        email:
          user.email,

        username:
          user.username,

        displayName:
          user.displayName,

        avatar:
          user.avatar,

        role:
          user.role,

        permissions:
          user.permissions,
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
      "[SantionV Google Callback]",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/?auth=google_server_error",
        request.url
      )
    );
  }
}