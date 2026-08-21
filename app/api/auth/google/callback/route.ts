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
  const cookieHeader =
    request.headers.get("cookie") ?? "";

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) =>
      part.startsWith(`${name}=`)
    );

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(
    cookie.substring(name.length + 1)
  );
}

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

    const googleError =
      requestUrl.searchParams.get(
        "error"
      );

    if (googleError) {
      console.error(
        "[SantionV Google] OAuth cancelled:",
        googleError
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=google_cancelled",
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          "/?auth=google_invalid",
          request.url
        )
      );
    }

    /* ======================================================
       STATE CONTROL
       ====================================================== */

    const savedState =
      readCookie(
        request,
        STATE_COOKIE
      );

    if (
      !savedState ||
      savedState !== state
    ) {
      console.error(
        "[SantionV Google] State mismatch"
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=google_state_error",
          request.url
        )
      );
    }

    /* ======================================================
       GOOGLE AUTH CODE -> ACCESS TOKEN
       ====================================================== */

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",

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

          cache: "no-store",
        }
      );

    if (!tokenResponse.ok) {
      const errorText =
        await tokenResponse.text();

      console.error(
        "[SantionV Google] Token error:",
        tokenResponse.status,
        errorText
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
        tokenData?.access_token ?? ""
      );

    if (!accessToken) {
      return NextResponse.redirect(
        new URL(
          "/?auth=google_token_error",
          request.url
        )
      );
    }

    /* ======================================================
       GOOGLE USER INFO
       ====================================================== */

    const userResponse =
      await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    if (!userResponse.ok) {
      console.error(
        "[SantionV Google] User request failed:",
        userResponse.status
      );

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

    if (
      !googleUser.sub ||
      !googleUser.email
    ) {
      return NextResponse.redirect(
        new URL(
          "/?auth=google_user_error",
          request.url
        )
      );
    }

    const email =
      normalizeEmail(
        googleUser.email
      );

    /* ======================================================
       FIND / CREATE ACCOUNT
       ====================================================== */

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

    if (!user) {
      const role =
        "member" as const;

      user = {
        id:
          crypto.randomUUID(),

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

        displayName:
          googleUser.name ||
          user.displayName,

        avatar:
          googleUser.picture ??
          user.avatar,

        updatedAt:
          now,
      };
    }

    await saveUser(user);

    /* ======================================================
       SESSION COOKIE
       ====================================================== */

    const sessionToken =
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

    /* ======================================================
       CLEAR GOOGLE STATE COOKIE
       ====================================================== */

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
      "[SantionV Google] LOGIN SUCCESS",
      {
        email:
          user.email,

        displayName:
          user.displayName,

        role:
          user.role,
      }
    );

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