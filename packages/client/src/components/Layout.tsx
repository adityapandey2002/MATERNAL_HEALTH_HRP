import type { UserRole } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import {
  type NavItem,
  type NavSection,
  initialsFor,
  isFieldRole,
  isNavActive,
  mobileOverflowFor,
  mobileTabsFor,
  navFor,
  pageTitleFor,
} from "../lib/nav";
import { ROLE_LABEL } from "../lib/session";
import { isOnline, onOnlineChange } from "../utils/sw";
import { BrandLockup, BrandMark } from "./ui/BrandMark";
import { LogoutIcon, MoreHorizontalIcon } from "./ui/Icons";
import { Sheet } from "./ui/Sheet";

const SECTION_ORDER: NavSection[] = ["Field work", "Oversight", "Account"];

export default function Layout() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [online, setOnline] = useState(true);

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.facilities.list(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    setOnline(navigator.onLine);
    return onOnlineChange(setOnline);
  }, []);

  const role: UserRole = user?.role ?? "ANM";
  const nav = navFor(role);
  const tabs = mobileTabsFor(role);
  const overflow = mobileOverflowFor(role);
  const title = pageTitleFor(location.pathname, role);
  // A failed or malformed facilities response must not take down the shell.
  const facilityList = Array.isArray(facilities) ? facilities : [];
  const facilityName = facilityList.find((f) => f.id === user?.facilityId)?.name;
  const subtitle = facilityName ?? "Araria district · High-risk pregnancy tracking";

  const grouped = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        items: nav.filter((item) => item.section === section),
      })).filter((group) => group.items.length > 0),
    [nav]
  );

  const handleLogout = async () => {
    await api.auth.logout();
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-line bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60 lg:flex-col">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-4">
          <BrandLockup />
        </div>

        <div className="shrink-0 px-3 py-3">
          <div
            className={`flex items-center gap-2 rounded border px-3 py-2 ${
              online ? "border-line-soft bg-canvas" : "border-triage-amber-line bg-triage-amber-bg"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                online ? "bg-triage-green-solid" : "bg-triage-amber-solid"
              }`}
            />
            <p className="truncate text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
              {online ? "Field sync · normal" : "Offline · saved on device"}
            </p>
          </div>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
          {grouped.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={`${item.section}-${item.path}-${item.label}`}>
                    <SidebarLink item={item} pathname={location.pathname} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="mb-2 rounded border border-primary/15 bg-primary-light px-3 py-2">
            <p className="text-2xs font-semibold uppercase tracking-wide text-primary-dark">
              Assigned facility
            </p>
            <p className="truncate text-sm font-medium text-ink">
              {facilityName ?? "Araria district"}
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-1">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white"
            >
              {initialsFor(user?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                {user?.name ?? "Health worker"}
              </p>
              <p className="truncate text-2xs text-ink-subtle">{ROLE_LABEL[role]}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-ghost min-h-control min-w-touch px-2"
              aria-label="Sign out"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
            <span className="lg:hidden">
              <BrandMark size={28} variant="compact" title={null} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-ink sm:text-base">
                {title}
              </p>
              <p className="hidden truncate text-2xs leading-tight text-ink-subtle sm:block">
                {subtitle}
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-2xs font-semibold uppercase tracking-wide ${
                online
                  ? "border-triage-green-line bg-triage-green-bg text-triage-green"
                  : "border-triage-amber-line bg-triage-amber-bg text-triage-amber"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  online ? "bg-triage-green-solid" : "bg-triage-amber-solid"
                }`}
              />
              {online ? "Online" : "Offline"}
            </span>

            <Link
              to="/settings"
              aria-label={`Signed in as ${user?.name ?? "health worker"}. Open settings.`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white"
            >
              {initialsFor(user?.name)}
            </Link>
          </div>
        </header>

        {!online && (
          <output className="block bg-triage-amber-solid px-4 py-2 text-xs font-semibold text-white sm:px-6">
            Offline — records are saved on this device and sync when the connection returns.
          </output>
        )}

        <main id="main-content" className="flex-1 px-4 pb-tabbar pt-4 sm:px-6 sm:pt-6 lg:pb-10">
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {tabs.map((item) => (
            <li key={`${item.path}-${item.label}`}>
              <NavLink
                to={item.path}
                end={item.path === "/" || item.path === "/patients"}
                className={({ isActive }) =>
                  `flex min-h-touch flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-semibold ${
                    isActive ? "text-primary" : "text-ink-subtle"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`h-5 w-5 ${isActive ? "" : "opacity-70"}`} />
                    <span className="truncate">{item.shortLabel}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="flex min-h-touch w-full flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-semibold text-ink-subtle"
            >
              <MoreHorizontalIcon className="h-5 w-5 opacity-70" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        description={`${user?.name ?? "Health worker"} · ${ROLE_LABEL[role]}`}
      >
        <ul className="space-y-0.5">
          {overflow.map((item) => (
            <li key={`${item.path}-${item.label}`}>
              <NavLink
                to={item.path}
                end={item.path === "/" || item.path === "/patients"}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-touch items-center gap-3 rounded px-3 text-sm font-medium text-ink-muted hover:bg-canvas"
              >
                <item.icon className="h-5 w-5 text-ink-subtle" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="my-2 border-t border-line-soft" />
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-touch w-full items-center gap-3 rounded px-3 text-sm font-medium text-triage-red hover:bg-triage-red-bg"
        >
          <LogoutIcon className="h-5 w-5" />
          Sign out
        </button>
      </Sheet>
    </div>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item, pathname);
  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-control items-center gap-2.5 rounded px-2.5 text-sm font-medium transition-colors ${
        active ? "bg-primary text-white" : "text-ink-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      <item.icon className={`h-5 w-5 shrink-0 ${active ? "" : "text-ink-subtle"}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
