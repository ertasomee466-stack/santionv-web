import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
} from "../_lib/auth";

export async function POST() {
  const response =
    NextResponse.json({
      success: true,
    });

  response.cookies.set({
    name:
      SESSION_COOKIE,

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
}

export async function GET(
  request: Request
) {
  const response =
    NextResponse.redirect(
      new URL(
        "/",
        request.url
      )
    );

  response.cookies.set({
    name:
      SESSION_COOKIE,

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
}