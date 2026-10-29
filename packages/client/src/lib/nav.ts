import type { UserRole } from "@hrp/shared";
import type { ComponentType } from "react";
import {
  ActivityIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  CogIcon,
  HomeIcon,
  ListChecksIcon,
  UserPlusIcon,
  UsersIcon,
} from "../components/ui/Icons";

export type NavSection = "Field work" | "Oversight" | "Account";

export interface NavItem {
  path: string;
  label: string;
  /** Shorter label for the four-item mobile tab bar. */
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
  section: NavSection;
}

/** ANM and CHO work the field app: register, triage, follow up. */
export function isFieldRole(role: UserRole): boolean {
  return role === "ANM" || role === "CHO";
}

/** Block and district staff work the oversight app. */
export function isNodalRole(role: UserRole): boolean {
  return role === "BHM" || role === "DHS";
}

const addCase: NavItem = {
  path: "/",
  label: "Add case",
  shortLabel: "Add",
  icon: UserPlusIcon,
  section: "Field work",
};

const dashboard: NavItem = {
  path: "/dashboard",
  label: "Dashboard",
  shortLabel: "Home",
  icon: HomeIcon,
  section: "Field work",
};

const fieldFollowUps: NavItem = {
  path: "/follow-ups",
  label: "Follow-ups",
  shortLabel: "Follow-ups",
  icon: CalendarIcon,
  section: "Field work",
};

const patients: NavItem = {
  path: "/patients",
  label: "Patients",
  shortLabel: "Patients",
  icon: UsersIcon,
  section: "Field work",
};

const blockDashboard: NavItem = {
  path: "/",
  label: "Block dashboard",
  shortLabel: "Dashboard",
  icon: ActivityIcon,
  section: "Oversight",
};

const blockFollowUps: NavItem = {
  path: "/follow-ups",
  label: "Follow-up to be done",
  shortLabel: "Follow-ups",
  icon: ListChecksIcon,
  section: "Oversight",
};

const hrpIntake: NavItem = {
  path: "/patients/new",
  label: "Add HRP case",
  shortLabel: "Add",
  icon: UserPlusIcon,
  section: "Oversight",
};

const team: NavItem = {
  path: "/team",
  label: "Team & access",
  shortLabel: "Team",
  icon: UsersIcon,
  section: "Account",
};

const referrals: NavItem = {
  path: "/referrals",
  label: "Referrals",
  shortLabel: "Referrals",
  icon: ArrowRightIcon,
  section: "Oversight",
};

const supervision: NavItem = {
  path: "/supervision",
  label: "Supervision",
  shortLabel: "Supervision",
  icon: BellIcon,
  section: "Oversight",
};

const settings: NavItem = {
  path: "/settings",
  label: "Settings",
  shortLabel: "Settings",
  icon: CogIcon,
  section: "Account",
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  // Field app, in the order a field worker uses it: register first, then the
  // triage dashboard, then the assigned follow-up list.
  ANM: [addCase, dashboard, fieldFollowUps, patients, referrals, settings],
  CHO: [addCase, dashboard, fieldFollowUps, patients, referrals, supervision, settings],

  // Oversight app: block-wide surveillance, the shared line list, helpdesk
  // intake, and the screen that provisions helpdesk credentials.
  BHM: [
    blockDashboard,
    blockFollowUps,
    hrpIntake,
    team,
    { ...patients, section: "Oversight", label: "All people" },
    referrals,
    supervision,
    settings,
  ],
  DHS: [
    blockDashboard,
    blockFollowUps,
    hrpIntake,
    team,
    { ...patients, section: "Oversight", label: "All people" },
    referrals,
    supervision,
    settings,
  ],
  HELPDESK: [
    blockDashboard,
    blockFollowUps,
    hrpIntake,
    { ...patients, section: "Oversight", label: "All people" },
    settings,
  ],
};

export function navFor(role: UserRole): NavItem[] {
  return NAV_BY_ROLE[role];
}

/** The three destinations that fit in the mobile tab bar, plus "More". */
export function mobileTabsFor(role: UserRole): NavItem[] {
  return navFor(role).slice(0, 3);
}

/** Destinations that only appear in the mobile "More" sheet. */
export function mobileOverflowFor(role: UserRole): NavItem[] {
  return navFor(role).slice(3);
}

/** True when the nav item should be highlighted for the current path. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.path === "/") return pathname === "/";
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/** Title shown in the mobile app bar and used as the document title suffix. */
export function pageTitleFor(pathname: string, role: UserRole): string {
  const items = navFor(role);

  if (pathname === "/patients/new") return "Add HRP case";
  if (/^\/patients\/[^/]+\/visit$/.test(pathname)) return "Record ANC visit";
  if (/^\/patients\/[^/]+$/.test(pathname)) return "Patient record";

  const match = items.find((item) => isNavActive(item, pathname));
  return match?.label ?? "HRP Tracking";
}

/** Initials for the avatar chip. Falls back to a neutral glyph. */
export function initialsFor(name: string | undefined): string {
  if (!name) return "HW";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HW";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
