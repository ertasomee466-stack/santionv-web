import {
  NextRequest,
  NextResponse,
} from "next/server";

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
  type AuthRole,
  type StoredUser,
} from "../../_lib/auth";

const STATE_COOKIE =
  "santionv_google_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfo = {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
};

export async function GET(
  request: NextRequest
) {
  try {
    const code =
      request.nextUrl.searchParams.get(
        "code"
      );

    const state =
      request.nextUrl.searchParams.get(
        "state"
      );

    const oauthError =
      request.nextUrl.searchParams.get(
        "error"
      );

    if (oauthError) {
      return NextResponse.redirect(
        new URL(
          "/?auth=google_cancelled",
          request.url
        )
      );
    }

    const savedState =
      request.cookies.get(
        STATE_COOKIE
      )?.value;

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

    /* ===============================
       GOOGLE TOKEN
       =============================== */

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
              code,

              client_id:
                getEnv(
                  "GOOGLE_CLIENT_ID"
                ),

              client_secret:
                getEnv(
                  "GOOGLE_CLIENT_SECRET"
                ),

              redirect_uri:
                getEnv(
                  "GOOGLE_REDIRECT_URI"
                ),

              grant_type:
                "authorization_code",
            }),

          cache: "no-store",
        }
      );

    const tokenData =
      (await tokenResponse.json()) as
        GoogleTokenResponse;

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        "[Google OAuth] Token error"
      );

      return NextResponse.redirect(
        new URL(
          "/?auth=google_token_error",
          request.url
        )
      );
    }

    /* ===============================
       GOOGLE USER
       =============================== */

    const userResponse =
      await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: {
            Authorization:
              `Bearer ${tokenData.access_token}`,
          },

          cache: "no-store",
        }
      );

    const googleUser =
      (await userResponse.json()) as
        GoogleUserInfo;

    if (
      !userResponse.ok ||
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

    /* ===============================
       ACCOUNT
       =============================== */

    let existingUser =
      await getUserByGoogleSub(
        googleUser.sub
      );

    if (!existingUser) {
      existingUser =
        await getUserByEmail(
          email
        );
    }

    const ownerEmail =
      process.env
        .GOOGLE_OWNER_EMAIL
        ?.trim()
        .toLowerCase();

    let role: AuthRole =
      existingUser?.role ??
      "member";

    if (
      ownerEmail &&
      email === ownerEmail
    ) {
      role = "owner";
    }

    if (
      existingUser?.role ===
      "owner"
    ) {
      role = "owner";
    }

    const now =
      Date.now();

    const user: StoredUser = {
      id:
        existingUser?.id ??
        `google:${googleUser.sub}`,

      email,

      displayName:
        googleUser.name ||
        existingUser?.displayName ||
        email.split("@")[0],

      username:
        existingUser?.username ||
        email.split("@")[0],

      avatar:
        googleUser.picture ||
        existingUser?.avatar ||
        null,

      passwordHash:
        existingUser?.passwordHash,

      googleSub:
        googleUser.sub,

      discordId:
        existingUser?.discordId,

      provider:
        "google",

      role,

      permissions:
        defaultPermissions(
          role
        ),

      createdAt:
        existingUser?.createdAt ??
        now,

      updatedAt:
        now,
    };

    await saveUser(user);

    /* ===============================
       SESSION
       =============================== */

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

    /*
      ÖNEMLİ:
      page.tsx ?auth=success bekliyor.
    */
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

    response.cookies.set({
      name:
        STATE_COOKIE,

      value: "",

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(
      "[Google OAuth Callback]",
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