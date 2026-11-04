import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSafeNextPath(value: string | null): string {
  switch (value) {
    case "/set-password":
    case "/reset-password/confirm":
    case "/session":
    case "/register?oauth=google":
      return value;
    default:
      return "/session";
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tokenType = url.searchParams.get("type");
  const nextPath = getSafeNextPath(url.searchParams.get("next"));
  const isPasswordReset = nextPath === "/reset-password/confirm";

  if (
    !code &&
    !(
      (nextPath === "/set-password" || isPasswordReset) &&
      tokenHash &&
      tokenType === "recovery"
    )
  ) {
    const errorUrl = new URL(
      nextPath === "/set-password" || isPasswordReset
        ? "/login?error=recovery"
        : "/login?error=callback",
      request.url,
    );
    return NextResponse.redirect(errorUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return new NextResponse("Supabase is not configured.", { status: 503 });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  let error;
  let isRecoverySession = false;
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
    isRecoverySession =
      "redirectType" in result.data &&
      result.data.redirectType === "recovery";
  } else if (
    (nextPath === "/set-password" || isPasswordReset) &&
    tokenHash &&
    tokenType === "recovery"
  ) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    error = result.error;
    isRecoverySession = !error;
  } else {
    return NextResponse.redirect(
      new URL("/login?error=callback", request.url),
    );
  }
  if (error || (isPasswordReset && !isRecoverySession)) {
    const errorUrl = new URL(
      nextPath === "/set-password" || isPasswordReset
        ? "/login?error=recovery"
        : "/login?error=callback",
      request.url,
    );
    return NextResponse.redirect(errorUrl);
  }

  if (isPasswordReset) {
    response.cookies.set("hope_password_recovery", "verified", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/reset-password/confirm",
      maxAge: 15 * 60,
    });
  }

  return response;
}
