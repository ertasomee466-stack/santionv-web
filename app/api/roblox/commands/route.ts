import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type AdminCommand =
  | "heal"
  | "respawn"
  | "freeze"
  | "unfreeze"
  | "kick"
  | "bring"
  | "goto";

type CommandRequest = {
  command?: AdminCommand;
  userId?: number;
  targetUserId?: number;
  reason?: string;
};

type StoredCommand = {
  id: string;
  command: AdminCommand;

  userId: number;
  targetUserId: number | null;

  reason: string | null;

  createdAt: number;
};

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
| Web panel buraya admin komutu gönderir.
|
| Örnek:
|
| {
|   "command": "heal",
|   "userId": 123456
| }
|--------------------------------------------------------------------------
*/

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommandRequest;

    const allowedCommands: AdminCommand[] = [
      "heal",
      "respawn",
      "freeze",
      "unfreeze",
      "kick",
      "bring",
      "goto",
    ];

    if (
      !body.command ||
      !allowedCommands.includes(body.command)
    ) {
      return Response.json(
        {
          success: false,
          message: "Invalid command",
        },
        {
          status: 400,
        }
      );
    }

    const userId = Number(body.userId);

    if (!Number.isFinite(userId) || userId <= 0) {
      return Response.json(
        {
          success: false,
          message: "Invalid userId",
        },
        {
          status: 400,
        }
      );
    }

    const commandId = crypto.randomUUID();

    const command: StoredCommand = {
      id: commandId,

      command: body.command,

      userId,

      targetUserId:
        body.targetUserId !== undefined
          ? Number(body.targetUserId)
          : null,

      reason:
        typeof body.reason === "string"
          ? body.reason
          : null,

      createdAt: Date.now(),
    };

    /*
    |--------------------------------------------------------------------------
    | Redis Queue
    |--------------------------------------------------------------------------
    |
    | Roblox sunucusu birazdan bu listeyi okuyacak.
    |
    */

    await redis.rpush(
      "santionv:admin-command-queue",
      command
    );

    /*
    |--------------------------------------------------------------------------
    | Güvenlik için queue'yu sonsuza kadar tutmuyoruz.
    |--------------------------------------------------------------------------
    */

    await redis.expire(
      "santionv:admin-command-queue",
      300
    );

    return Response.json({
      success: true,
      message: "Command queued",

      command,
    });
  } catch (error) {
    console.error(
      "[SantionV Commands API POST]",
      error
    );

    return Response.json(
      {
        success: false,
        message: "Command could not be queued",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
| Roblox sunucusu bu endpoint'e istek atar.
| Kuyruktaki ilk komutu alır.
|--------------------------------------------------------------------------
*/

export async function GET() {
  try {
    const command =
      await redis.lpop<StoredCommand>(
        "santionv:admin-command-queue"
      );

    if (!command) {
      return Response.json({
        success: true,
        command: null,
      });
    }

    return Response.json({
      success: true,
      command,
    });
  } catch (error) {
    console.error(
      "[SantionV Commands API GET]",
      error
    );

    return Response.json(
      {
        success: false,
        command: null,
      },
      {
        status: 500,
      }
    );
  }
}