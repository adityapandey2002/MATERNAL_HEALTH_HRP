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

const today: NavItem = {
  path: "/",
  label: "Today",
  shortLabel: "Today",
  icon: HomeIcon,
  section: "Field work",
};

const triage: NavItem = {
  path: "/",
  label: "Triage line list",
  shortLabel: "Triage",
  icon: ListChecksIcon,
  section: "Oversight",
};

const overview: NavItem = {
  path: "/",
  label: "District overview",
  shortLabel: "Overview",
  icon: ActivityIcon,
  section: "Oversight",
};

const patients: NavItem = {
  path: "/patients",
  label: "Patients",
  shortLabel: "Patients",
  icon: UsersIcon,
  section: "Field work",
};

const followUps: NavItem = {
  path: "/follow-ups",
  label: "Follow-ups",
  shortLabel: "Follow-ups",
  icon: CalendarIcon,
  section: "Field work",
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

const register: NavItem = {
  path: "/patients/new",
  label: "Register woman",
  shortLabel: "Register",
  icon: UserPlusIcon,
  section: "Field work",
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  // ANMs work a village list: today's visits first, then the full register.
  ANM: [today, patients, followUps, register, referrals, settings],
  // CHOs supervise the block line list and the ANMs who report into it, so the
  // register reads as oversight rather than as field work.
  CHO: [
    triage,
    { ...patients, section: "Oversight" },
    { ...followUps, section: "Oversight" },
    referrals,
    supervision,
    settings,
  ],
  // Block and district nodal officers read aggregate oversight, not field forms.
  BHM: [overview, { ...patients, section: "Oversight" }, supervision, referrals, settings],
  DHS: [overview, { ...patients, section: "Oversight" }, supervision, referrals, settings],
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

  if (pathname === "/patients/new") return "Register woman";
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
