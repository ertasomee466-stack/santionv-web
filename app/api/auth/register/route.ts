import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  createSessionToken,
  defaultPermissions,
  getUserByEmail,
  hashPassword,
  normalizeEmail,
  saveUser,
  SESSION_COOKIE,
  SESSION_DURATION,
  type StoredUser,
} from "../_lib/auth";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const displayName =
      String(
        body?.displayName ?? ""
      ).trim();

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

    if (
      displayName.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ad en az 2 karakter olmalı.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !email.includes("@") ||
      email.length > 200
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Geçerli bir e-posta gir.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password.length < 8
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Şifre en az 8 karakter olmalı.",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await getUserByEmail(
        email
      );

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bu e-posta ile zaten bir hesap var.",
        },
        {
          status: 409,
        }
      );
    }

    const now =
      Date.now();

    const role =
      "member" as const;

    const user: StoredUser = {
      id:
        crypto
          .randomUUID(),

      email,

      displayName,

      username:
        email.split("@")[0],

      avatar:
        null,

      passwordHash:
        await hashPassword(
          password
        ),

      provider:
        "password",

      role,

      permissions:
        defaultPermissions(
          role
        ),

      createdAt:
        now,

      updatedAt:
        now,
    };

    await saveUser(
      user
    );

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

        user: {
          email:
            user.email,

          displayName:
            user.displayName,

          role:
            user.role,
        },
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
      "[SantionV Register]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Hesap oluşturulamadı.",
      },
      {
        status: 500,
      }
    );
  }
}