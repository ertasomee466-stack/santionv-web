export async function GET() {
  return Response.json({
    success: true,
    message: "SantionV Roblox API is online",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("ROBLOX HEARTBEAT:", body);

    return Response.json({
      success: true,
      message: "Heartbeat received",
      received: body,
    });
  } catch {
    return Response.json(
      {
        success: false,
        message: "Invalid request",
      },
      {
        status: 400,
      }
    );
  }
}