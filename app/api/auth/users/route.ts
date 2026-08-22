import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  defaultPermissions,
  getAllUsers,
  getUserById,
  saveUser,
  SESSION_COOKIE,
  verifySessionToken,
  type AuthRole,
  type StoredUser,
} from "../_lib/auth";

function publicUser(
  user: StoredUser
) {
  return {
    id:
      user.id,

    email:
      user.email,

    displayName:
      user.displayName,

    username:
      user.username,

    avatar:
      user.avatar,

    provider:
      user.provider,

    role:
      user.role,

    permissions:
      user.permissions,

    createdAt:
      user.createdAt,

    updatedAt:
      user.updatedAt,
  };
}

async function requireOwner() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE
    )?.value;

  if (!token) {
    return null;
  }

  const session =
    verifySessionToken(
      token
    );

  if (
    !session ||
    session.role !== "owner"
  ) {
    return null;
  }

  return session;
}

export async function GET() {
  try {
    const owner =
      await requireOwner();

    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Owner permission required.",
        },
        {
          status: 403,
        }
      );
    }

    const users =
      await getAllUsers();

    return NextResponse.json({
      success:
        true,

      users:
        users.map(
          publicUser
        ),
    });
  } catch (error) {
    console.error(
      "[SantionV Users GET]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Accounts could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const owner =
      await requireOwner();

    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Owner permission required.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const accountId =
      String(
        body?.accountId ?? ""
      ).trim();

    const role =
      String(
        body?.role ?? ""
      ) as AuthRole;

    if (
      !accountId ||
      ![
        "admin",
        "member",
      ].includes(role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid account or role.",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await getUserById(
        accountId
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Account not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      user.role === "owner"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Owner role cannot be changed here.",
        },
        {
          status: 400,
        }
      );
    }

    const updated: StoredUser = {
      ...user,

      role,

      permissions:
        defaultPermissions(
          role
        ),

      updatedAt:
        Date.now(),
    };

    await saveUser(updated);

    return NextResponse.json({
      success:
        true,

      user:
        publicUser(
          updated
        ),
    });
  } catch (error) {
    console.error(
      "[SantionV Users PATCH]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Account role could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}