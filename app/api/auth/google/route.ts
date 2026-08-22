import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  getEnv,
} from "../_lib/auth";

const STATE_COOKIE =
  "santionv_google_oauth_state";

export async function GET() {
  try {
    const state =
      crypto
        .randomBytes(32)
        .toString("hex");

    const url =
      new URL(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );

    url.searchParams.set(
      "client_id",
      getEnv(
        "GOOGLE_CLIENT_ID"
      )
    );

    url.searchParams.set(
      "redirect_uri",
      getEnv(
        "GOOGLE_REDIRECT_URI"
      )
    );

    url.searchParams.set(
      "response_type",
      "code"
    );

    url.searchParams.set(
      "scope",
      "openid email profile"
    );

    url.searchParams.set(
      "state",
      state
    );

    url.searchParams.set(
      "prompt",
      "select_account"
    );

    const response =
      NextResponse.redirect(url);

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
        60 * 10,
    });

    return response;
  } catch (error) {
    console.error(
      "[SantionV Google Start]",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/?auth=google_config_error",
        getEnv(
          "GOOGLE_REDIRECT_URI"
        )
      )
    );
  }
}