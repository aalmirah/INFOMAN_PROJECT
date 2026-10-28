
"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function Home() {
  const [status, setStatus] = useState("Not tested");

  async function testConnection() {
    setStatus("Testing...");

    try {
      const { error } = await getSupabaseClient()
        .from("reports")
        .select("report_id")
        .limit(0);
      
      setStatus(
        error ? `Failed: ${error.message}` : "Connection successful!"
      );
    } catch {
      setStatus("Failed: Check your Supabase configuration.");
    }
  }

  return (
    <main>
      <h1>HOPE Inc. ERP</h1>
      <p>The application foundation is ready for development.</p>

      <hr />

      <h2>Supabase Connection Test</h2>
      <button onClick={testConnection}>
        Test Supabase Connection
      </button>
      <p>{status}</p>
    </main>
  );
}
