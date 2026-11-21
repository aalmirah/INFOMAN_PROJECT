"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RefreshAccess() {
  const router = useRouter();
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") router.refresh();
    }
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [router]);
  return null;
}
