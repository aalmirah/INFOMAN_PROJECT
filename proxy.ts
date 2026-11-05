import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthProfile } from "@/lib/auth/profile";

function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  error?: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (error) url.searchParams.set("error", error);

  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return new NextResponse(
      "Supabase is not configured. Set the required environment variables and restart the app.",
      { status: 503 },
    );
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGoogleRegistrationCallback =
    pathname === "/register" &&
    request.nextUrl.searchParams.get("oauth") === "google";
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/auth/callback";
  const isUserManagementRoute =
    pathname === "/user-management" ||
    pathname.startsWith("/user-management/");
  const isProtectedRoute =
    pathname === "/dashboard" ||
    pathname === "/session" ||
    pathname === "/set-password" ||
    isUserManagementRoute;

  if (!user) {
    if (isProtectedRoute) {
      return redirectTo(request, response, "/login");
    }
    return response;
  }

  if (isGoogleRegistrationCallback) {
    return response;
  }

  const { profile, error } = await getAuthProfile(supabase, user.id);
  if (error || !profile) {
    if (pathname === "/login" || pathname === "/register") {
      return response;
    }
    return redirectTo(request, response, "/login", "profile");
  }

  if (profile.isBlocked) {
    if (pathname === "/login") return response;
    return redirectTo(request, response, "/login", "blocked");
  }

  if (!profile.isActive) {
    if (pathname === "/login") return response;
    return redirectTo(request, response, "/login", "inactive");
  }

  if (profile.approvalStatus !== "approved") {
    if (pathname === "/login") return response;
    if (pathname === "/register") return response;
    return redirectTo(
      request,
      response,
      "/login",
      profile.approvalStatus === "rejected" ? "rejected" : "pending",
    );
  }

  if (profile.mustChangePassword) {
    if (pathname === "/set-password") return response;
    return redirectTo(request, response, "/set-password");
  }

  if (
    isUserManagementRoute &&
    profile.role !== "admin" &&
    profile.role !== "superadmin"
  ) {
    return redirectTo(request, response, "/session", "forbidden");
  }

  if (pathname === "/set-password") {
    return redirectTo(request, response, "/session");
  }

  if (pathname === "/" || isPublicRoute) {
    return redirectTo(request, response, "/session");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
