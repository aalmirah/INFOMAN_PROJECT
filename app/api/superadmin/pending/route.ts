import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSuperadminActor } from "@/lib/auth/superadmin";

export async function GET(): Promise<Response> {
  const result = await getSuperadminActor();
  if (!result.actor) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id, first_name, last_name, email, created_at")
    .eq("approval_status", "pending")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Pending accounts lookup failed.", { code: error.code });
    return Response.json(
      { error: "Could not load pending accounts. Please try again." },
      { status: 502 },
    );
  }

  return Response.json(
    {
      pending: (data ?? []).map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        createdAt: row.created_at,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
