import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSafeNextPath(value: string | null): string {
  switch (value) {
    case "/set-password":
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

  if (
    !code &&
    !(
      nextPath === "/set-password" &&
      tokenHash &&
      tokenType === "recovery"
    )
  ) {
    const errorUrl = new URL(
      nextPath === "/set-password"
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
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (
    nextPath === "/set-password" &&
    tokenHash &&
    tokenType === "recovery"
  ) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    }));
  } else {
    return NextResponse.redirect(
      new URL("/login?error=callback", request.url),
    );
  }
  if (error) {
    const errorUrl = new URL(
      nextPath === "/set-password"
        ? "/login?error=recovery"
        : "/login?error=callback",
      request.url,
    );
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
