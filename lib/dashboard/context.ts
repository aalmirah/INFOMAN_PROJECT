import "server-only";

import { redirect } from "next/navigation";
import { authorizeActor, getGrantedRights } from "@/lib/auth/rights-authorization";

export async function getDashboardContext() {
  const result = await authorizeActor();
  if (!result.allowed) {
    if (result.status === 401) redirect("/login");
    if (result.status === 403) redirect("/no-access");
    return { error: result.error } as const;
  }
  const granted = await getGrantedRights(result.actor);
  if (!granted.allowed) return { error: granted.error } as const;
  return { actor: result.actor, rights: granted.rights } as const;
}
