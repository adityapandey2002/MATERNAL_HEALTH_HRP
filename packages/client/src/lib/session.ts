import type { UserRole } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Role of the signed-in user.
 *
 * Defaults to ANM — the least-privileged role — while the session is loading or
 * if the request fails. A slow or broken network must never unlock supervision
 * tools for a field worker.
 */
export function useUserRole(): UserRole {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data?.role ?? "ANM";
}

/**
 * Whether the signed-in user may create or edit clinical records.
 *
 * Mirrors `CLINICAL_WRITE_ROLES` on the server. The server remains the
 * authority; this only keeps write buttons off screens where they would fail
 * with a 403.
 */
export function useCanWriteClinical(): boolean {
  const role = useUserRole();
  return role === "ANM" || role === "CHO";
}
