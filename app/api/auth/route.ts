import { NextResponse } from "next/server";
import crypto from "crypto";

/* =========================================================
   SANTIONV DISCORD AUTH
   START OAUTH LOGIN
   ========================================================= */

const STATE_COOKIE =
  "santionv_discord_oauth_state";

const STATE_MAX_AGE =
  60 * 10; // 10 dakika

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

export async function GET() {
  try {
    const clientId =
      getEnv(
        "DISCORD_CLIENT_ID"
      );

    const redirectUri =
      getEnv(
        "DISCORD_REDIRECT_URI"
      );

    /* =====================================================
       CSRF STATE
       ===================================================== */

    const state =
      crypto
        .randomBytes(32)
        .toString("hex");

    /* =====================================================
       DISCORD AUTHORIZE URL
       ===================================================== */

    const authorizeUrl =
      new URL(
        "https://discord.com/oauth2/authorize"
      );

    authorizeUrl.searchParams.set(
      "client_id",
      clientId
    );

    authorizeUrl.searchParams.set(
      "response_type",
      "code"
    );

    authorizeUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    /*
      identify:
      Discord kullanıcı bilgilerini almamız için.

      guilds.members.read:
      Kullanıcının SantionV sunucusundaki
      üyelik/rol bilgisini kontrol etmek için.
    */

    authorizeUrl.searchParams.set(
      "scope",
      "identify guilds.members.read"
    );

    authorizeUrl.searchParams.set(
      "state",
      state
    );

    authorizeUrl.searchParams.set(
      "prompt",
      "consent"
    );

    /* =====================================================
       REDIRECT
       ===================================================== */

    const response =
      NextResponse.redirect(
        authorizeUrl
      );

    /* =====================================================
       STATE COOKIE
       ===================================================== */

    response.cookies.set({
      name:
        STATE_COOKIE,

      value:
        state,

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
        STATE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error(
      "[SantionV Discord Auth]",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Discord login could not be started.",
      },
      {
        status:
          500,
      }
    );
  }
}