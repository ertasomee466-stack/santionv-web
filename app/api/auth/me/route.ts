import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  verifySessionToken,
} from "../_lib/auth";

export async function GET() {
  try {
    const cookieStore =
      await cookies();

    const token =
      cookieStore.get(
        SESSION_COOKIE
      )?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
        },
        {
          status: 401,
        }
      );
    }

    const session =
      verifySessionToken(
        token
      );

    if (!session) {
      const response =
        NextResponse.json(
          {
            success: false,
            authenticated: false,
          },
          {
            status: 401,
          }
        );

      response.cookies.set({
        name:
          SESSION_COOKIE,

        value:
          "",

        path:
          "/",

        maxAge:
          0,
      });

      return response;
    }

    return NextResponse.json({
      success:
        true,

      authenticated:
        true,

      user: {
        accountId:
          session.accountId,

        provider:
          session.provider,

        email:
          session.email,

        username:
          session.username,

        displayName:
          session.displayName,

        avatar:
          session.avatar,

        role:
          session.role,

        permissions:
          session.permissions,
      },
    });
  } catch (error) {
    console.error(
      "[SantionV Auth Me]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
      },
      {
        status: 500,
      }
    );
  }
}