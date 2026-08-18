import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type VehicleRecord = {
  id: string;

  name: string;
  model?: string;

  ownerUserId?: number | null;
  ownerUsername?: string | null;

  driverUserId?: number | null;
  driverUsername?: string | null;

  locked: boolean;
  engineOn: boolean;

  spawned: boolean;

  health?: number;
  fuel?: number;

  position?: {
    x: number;
    y: number;
    z: number;
  };

  createdAt: number;
  updatedAt: number;
};

type VehicleRequest = {
  action?:
    | "upsert"
    | "remove"
    | "lock"
    | "unlock"
    | "engine_on"
    | "engine_off";

  id?: string;

  name?: string;
  model?: string;

  ownerUserId?: number | null;
  ownerUsername?: string | null;

  driverUserId?: number | null;
  driverUsername?: string | null;

  spawned?: boolean;

  health?: number;
  fuel?: number;

  position?: {
    x?: number;
    y?: number;
    z?: number;
  };
};

function vehicleKey(id: string) {
  return `santionv:vehicle:${id}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const vehicle =
        await redis.get<VehicleRecord>(
          vehicleKey(id)
        );

      return Response.json({
        success: true,
        vehicle: vehicle ?? null,
      });
    }

    const ids =
      await redis.smembers(
        "santionv:vehicles"
      );

    const vehicles: VehicleRecord[] = [];

    for (const rawId of ids) {
      const vehicle =
        await redis.get<VehicleRecord>(
          vehicleKey(String(rawId))
        );

      if (!vehicle) {
        await redis.srem(
          "santionv:vehicles",
          String(rawId)
        );

        continue;
      }

      vehicles.push(vehicle);
    }

    vehicles.sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    return Response.json({
      success: true,
      vehicles,
    });
  } catch (error) {
    console.error(
      "[SantionV Vehicles GET]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Vehicle data could not be loaded",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as VehicleRequest;

    const action = body.action;
    const id = String(body.id ?? "").trim();

    if (!action || !id) {
      return Response.json(
        {
          success: false,
          message:
            "Vehicle action and id are required",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await redis.get<VehicleRecord>(
        vehicleKey(id)
      );

    if (action === "remove") {
      await redis.del(vehicleKey(id));

      await redis.srem(
        "santionv:vehicles",
        id
      );

      return Response.json({
        success: true,
        message: "Vehicle removed",
        id,
      });
    }

    if (!existing && action !== "upsert") {
      return Response.json(
        {
          success: false,
          message: "Vehicle not found",
        },
        {
          status: 404,
        }
      );
    }

    const now = Date.now();

    const vehicle: VehicleRecord = {
      id,

      name:
        typeof body.name === "string" &&
        body.name.trim()
          ? body.name.trim()
          : existing?.name ?? "Vehicle",

      model:
        typeof body.model === "string"
          ? body.model
          : existing?.model,

      ownerUserId:
        body.ownerUserId !== undefined
          ? body.ownerUserId
          : existing?.ownerUserId ?? null,

      ownerUsername:
        body.ownerUsername !== undefined
          ? body.ownerUsername
          : existing?.ownerUsername ?? null,

      driverUserId:
        body.driverUserId !== undefined
          ? body.driverUserId
          : existing?.driverUserId ?? null,

      driverUsername:
        body.driverUsername !== undefined
          ? body.driverUsername
          : existing?.driverUsername ?? null,

      locked:
        action === "lock"
          ? true
          : action === "unlock"
            ? false
            : existing?.locked ?? false,

      engineOn:
        action === "engine_on"
          ? true
          : action === "engine_off"
            ? false
            : existing?.engineOn ?? false,

      spawned:
        body.spawned !== undefined
          ? Boolean(body.spawned)
          : existing?.spawned ?? true,

      health:
        body.health !== undefined
          ? Number(body.health)
          : existing?.health,

      fuel:
        body.fuel !== undefined
          ? Number(body.fuel)
          : existing?.fuel,

      position:
        body.position
          ? {
              x: Number(body.position.x ?? 0),
              y: Number(body.position.y ?? 0),
              z: Number(body.position.z ?? 0),
            }
          : existing?.position,

      createdAt:
        existing?.createdAt ?? now,

      updatedAt: now,
    };

    await redis.set(
      vehicleKey(id),
      vehicle
    );

    await redis.sadd(
      "santionv:vehicles",
      id
    );

    return Response.json({
      success: true,
      message: "Vehicle updated",
      vehicle,
    });
  } catch (error) {
    console.error(
      "[SantionV Vehicles POST]",
      error
    );

    return Response.json(
      {
        success: false,
        message:
          "Vehicle operation failed",
      },
      {
        status: 500,
      }
    );
  }
}