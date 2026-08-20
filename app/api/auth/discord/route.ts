import { NextResponse } from "next/server";
import crypto from "crypto";

const STATE_COOKIE = "santionv_discord_oauth_state";
const STATE_MAX_AGE = 60 * 10; // 10 dakika

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function GET() {
  try {
    const clientId = getEnv("DISCORD_CLIENT_ID");
    const redirectUri = getEnv("DISCORD_REDIRECT_URI");

    // Discord OAuth güvenliği için rastgele state oluştur.
    const state = crypto.randomBytes(32).toString("hex");

    // Discord OAuth2 giriş adresi.
    const discordUrl = new URL(
      "https://discord.com/oauth2/authorize"
    );

    discordUrl.searchParams.set("client_id", clientId);
    discordUrl.searchParams.set("response_type", "code");
    discordUrl.searchParams.set("redirect_uri", redirectUri);

    // Kullanıcı bilgisi + SantionV sunucusundaki üyelik/rol bilgisi.
    discordUrl.searchParams.set(
      "scope",
      "identify guilds.members.read"
    );

    discordUrl.searchParams.set("state", state);
    discordUrl.searchParams.set("prompt", "consent");

    const response = NextResponse.redirect(discordUrl);

    // Callback geldiğinde state'i karşılaştıracağız.
    response.cookies.set({
      name: STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[SantionV Discord OAuth]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Discord login could not be started.",
      },
      {
        status: 500,
      }
    );
  }
}