import { NextResponse } from "next/server";

import {
  createSessionToken,
  getUserByEmail,
  normalizeEmail,
  SESSION_COOKIE,
  SESSION_DURATION,
  verifyPassword,
} from "../_lib/auth";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const email =
      normalizeEmail(
        String(
          body?.email ?? ""
        )
      );

    const password =
      String(
        body?.password ?? ""
      );

    const user =
      await getUserByEmail(
        email
      );

    if (
      !user ||
      !user.passwordHash
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "E-posta veya şifre yanlış.",
        },
        {
          status: 401,
        }
      );
    }

    const valid =
      await verifyPassword(
        password,
        user.passwordHash
      );

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "E-posta veya şifre yanlış.",
        },
        {
          status: 401,
        }
      );
    }

    const token =
      createSessionToken({
        accountId:
          user.id,

        provider:
          "password",

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
      NextResponse.json({
        success:
          true,
      });

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

    return response;
  } catch (error) {
    console.error(
      "[SantionV Login]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Giriş yapılamadı.",
      },
      {
        status: 500,
      }
    );
  }
}