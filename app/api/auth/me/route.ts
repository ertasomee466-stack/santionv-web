import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "santionv_session";

type SessionPayload = {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: "owner" | "admin";
  permissions: string[];
  expiresAt: number;
};

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    );
  }

  return value;
}

function verifySessionToken(
  token: string
): SessionPayload | null {
  try {
    const [payloadPart, signature] =
      token.split(".");

    if (!payloadPart || !signature) {
      return null;
    }

    const secret = getEnv("AUTH_SECRET");

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadPart)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);

    if (a.length !== b.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        payloadPart,
        "base64url"
      ).toString("utf8")
    ) as SessionPayload;

    if (
      !payload.discordId ||
      !payload.username ||
      !payload.role ||
      !payload.expiresAt
    ) {
      return null;
    }

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get(
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
      verifySessionToken(token);

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
        name: SESSION_COOKIE,
        value: "",
        path: "/",
        maxAge: 0,
      });

      return response;
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        discordId: session.discordId,
        username: session.username,
        displayName:
          session.displayName ??
          session.username,
        avatar: session.avatar ?? null,
        role: session.role,
        permissions:
          Array.isArray(
            session.permissions
          )
            ? session.permissions
            : [],
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
        message:
          "Session check failed.",
      },
      {
        status: 500,
      }
    );
  }
}