import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { isOnline, onOnlineChange } from "../utils/sw";
import { BrandMark } from "./ui/BrandMark";
import {
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  CogIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  PlusIcon,
  XIcon,
} from "./ui/Icons";

const navigation = [
  { path: "/", label: "Add", icon: PlusIcon },
  { path: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { path: "/follow-ups", label: "Follow Ups", icon: CalendarIcon },
  { path: "/referrals", label: "Referrals", icon: ArrowRightIcon },
  { path: "/supervision", label: "Supervision", icon: BellIcon },
  { path: "/settings", label: "Settings", icon: CogIcon },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const cleanup = onOnlineChange(setOnline);
    api.auth
      .me()
      .then((u) => setUser({ name: u.name, role: u.role }))
      .catch(() => {});
    return cleanup;
  }, []);

  const handleLogout = async () => {
    await api.auth.logout();
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark size={32} variant="compact" title={null} />
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-gray-900">
                High-Risk Pregnancy Tracking of Araria
              </p>
              <p className="truncate text-xs leading-tight text-gray-500">
                Maternal Risk Monitoring
              </p>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name ?? "Health Worker"}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role?.toLowerCase() ?? "anm"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Logout"
            >
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 px-4 bg-white border-b border-gray-200 lg:px-6">
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <span className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          role="button"
          tabIndex={0}
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSidebarOpen(false);
          }}
        />
      )}
    </div>
  );
}
