"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch (signOutError) {
      console.error("Supabase sign-out failed.", signOutError);
      setError("Could not sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      {error && <span role="alert">{error}</span>}
      <button className="dashboard-sidebar-logout" type="button" onClick={signOut} disabled={busy}>
        {busy ? "Signing out..." : "Logout"}
      </button>
    </>
  );
}
