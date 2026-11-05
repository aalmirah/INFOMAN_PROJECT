import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Recovery completion request origin is not allowed." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("hope_password_recovery", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/reset-password/confirm",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
