import { NextRequest, NextResponse } from "next/server";

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

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
};

function redirectToHome(
  request: NextRequest,
  params?: Record<string, string>
) {
  const url = new URL("/", request.url);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    const code =
      request.nextUrl.searchParams.get("code");

    const oauthError =
      request.nextUrl.searchParams.get("error");

    if (oauthError) {
      return redirectToHome(request, {
        auth_error: "google_denied",
      });
    }

    if (!code) {
      return redirectToHome(request, {
        auth_error: "google_code_missing",
      });
    }

    const clientId =
      getEnv("GOOGLE_CLIENT_ID");

    const clientSecret =
      getEnv("GOOGLE_CLIENT_SECRET");

    const redirectUri =
      getEnv("GOOGLE_REDIRECT_URI");

    /*
     * Google authorization code ->
     * access token
     */
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),

        cache: "no-store",
      }
    );

    const tokenData =
      (await tokenResponse.json()) as GoogleTokenResponse;

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        "[Google OAuth Token Error]",
        tokenData
      );

      return redirectToHome(request, {
        auth_error: "google_token_failed",
      });
    }

    /*
     * Google account information
     */
    const userResponse = await fetch(
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
      (await userResponse.json()) as GoogleUserInfo;

    if (
      !userResponse.ok ||
      !googleUser.sub ||
      !googleUser.email
    ) {
      console.error(
        "[Google OAuth User Error]",
        googleUser
      );

      return redirectToHome(request, {
        auth_error: "google_user_failed",
      });
    }

    const email =
      normalizeEmail(
        googleUser.email
      );

    /*
     * Önce Google ID ile hesabı ara.
     */
    let existingUser =
      await getUserByGoogleSub(
        googleUser.sub
      );

    /*
     * Google ID bulunamazsa aynı e-posta ile
     * daha önce açılmış hesabı kontrol et.
     */
    if (!existingUser) {
      existingUser =
        await getUserByEmail(email);
    }

    /*
     * OWNER kontrolü.
     *
     * GOOGLE_OWNER_EMAIL varsa onu kullanır.
     * Yoksa DISCORD_OWNER_EMAIL varsa onu dener.
     *
     * İkisi de yoksa mevcut owner hesabının
     * rolünü değiştirmez.
     */
    const configuredOwnerEmail =
      process.env.GOOGLE_OWNER_EMAIL?.trim() ||
      process.env.OWNER_EMAIL?.trim() ||
      "";

    const isConfiguredOwner =
      configuredOwnerEmail
        ? normalizeEmail(
            configuredOwnerEmail
          ) === email
        : false;

    let role: AuthRole =
      existingUser?.role ??
      "member";

    if (isConfiguredOwner) {
      role = "owner";
    }

    /*
     * Mevcut owner hiçbir zaman yanlışlıkla
     * member/admin yapılmaz.
     */
    if (
      existingUser?.role === "owner"
    ) {
      role = "owner";
    }

    const now =
      Date.now();

    const accountId =
      existingUser?.id ??
      `google:${googleUser.sub}`;

    const username =
      existingUser?.username ||
      email.split("@")[0] ||
      "google-user";

    const displayName =
      googleUser.name?.trim() ||
      existingUser?.displayName ||
      username;

    const user: StoredUser = {
      id: accountId,

      email,

      displayName,

      username,

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

      provider: "google",

      role,

      permissions:
        defaultPermissions(role),

      createdAt:
        existingUser?.createdAt ??
        now,

      updatedAt: now,
    };

    /*
     * Redis'e hesabı kaydet / güncelle.
     */
    await saveUser(user);

    /*
     * Yeni session oluştur.
     */
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
      redirectToHome(request, {
        auth_success: "google",
      });

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

    return response;
  } catch (error) {
    console.error(
      "[Google OAuth Callback]",
      error
    );

    return redirectToHome(request, {
      auth_error: "google_callback_failed",
    });
  }
}