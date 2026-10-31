import type { UserRole } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { isBlockRole, isDistrictRole, isFieldRole, isNodalRole } from "./nav";

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
  return role === "ANM" || role === "CHO" || role === "HRP_HELPDESK_BLOCK" || role === "BHM";
}

/** True when the current role uses the field (mobile-first) app. */
export function useIsFieldRole(): boolean {
  return isFieldRole(useUserRole());
}

/** True when the current role uses the block/district oversight app. */
export function useIsNodalRole(): boolean {
  return isNodalRole(useUserRole());
}

/** True when the current role is scoped to a block (helpdesk or BHM). */
export function useIsBlockRole(): boolean {
  return isBlockRole(useUserRole());
}

/** True when the current role is scoped to the district (helpdesk or DHS). */
export function useIsDistrictRole(): boolean {
  return isDistrictRole(useUserRole());
}

export const ROLE_LABEL: Record<UserRole, string> = {
  ANM: "ANM · field worker",
  CHO: "CHO · facility",
  HRP_HELPDESK_BLOCK: "HRP Helpdesk · block",
  BHM: "BHM · block nodal officer",
  HRP_HELPDESK_DISTRICT: "HRP Helpdesk · district",
  DHS: "DHS · district officer",
};

/** Short tier label used in attribution text, e.g. "Done by ANM". */
export const ROLE_TIER_LABEL: Record<UserRole, string> = {
  ANM: "ANM",
  CHO: "CHO",
  HRP_HELPDESK_BLOCK: "HRP Helpdesk (block)",
  BHM: "BHM",
  HRP_HELPDESK_DISTRICT: "HRP Helpdesk (district)",
  DHS: "DHS",
};

export function tierLabel(role: string | null | undefined): string {
  if (!role) return "Field team";
  return ROLE_TIER_LABEL[role as UserRole] ?? "Field team";
}
