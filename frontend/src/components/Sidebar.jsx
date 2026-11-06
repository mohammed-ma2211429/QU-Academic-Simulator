import { useEffect } from "react";
import { NavLink } from "./AppLink";
import { useLocation } from "../context/router-context";
import {
  House, Users, AlertTriangle, Activity,
  TrendingUp, Database, Info, MessageCircle, X, Sparkles,
} from "lucide-react";

const NAV_GROUPS = [
  {
    title: "OVERVIEW",
    items: [
      { to: "/", label: "Simulator Home", icon: House },
    ],
  },
  {
    title: "SIMULATIONS",
    items: [
      { to: "/cohort", label: "Cohort Flow", icon: Users },
      { to: "/bottleneck", label: "Bottleneck Analysis", icon: AlertTriangle },
      { to: "/monte-carlo", label: "Monte Carlo", icon: Activity },
      { to: "/enrollment-forecast", label: "Enrollment Forecast", icon: TrendingUp },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { to: "/data-override", label: "Data Override", icon: Database },
      { to: "/about-data", label: "About This Data", icon: Info },
    ],
  },
];

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();

  useEffect(() => {
    onClose?.();
    // Closing the mobile drawer is tied to navigation, not to callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#180510]/55 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`sidebar-panel fixed inset-y-0 left-0 z-50 flex h-screen w-[282px] shrink-0 flex-col overflow-hidden text-qu-sidebar-text transition-transform duration-300 lg:sticky lg:top-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="sidebar-brand flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-white/30">
            <img src="/qu-favicon.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold tracking-[-0.01em] text-white">
              Qatar University
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#d7bea2]">
              Planning Intelligence
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-4 flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2.5 text-[11px] text-white/85">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
          </span>
          Department decision system
        </div>

        <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 px-3 text-[9px] font-bold tracking-[0.16em] text-white/60">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] transition-all ${
                      isActive
                        ? "border border-[#d8b995] bg-[#f8eee6] text-[#52102b] shadow-[0_8px_24px_rgba(20,4,12,.2)] font-bold"
                        : "text-white/82 hover:bg-white/[0.09] hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                          isActive
                            ? "bg-white text-[#70122f] shadow-sm ring-1 ring-[#dcc8ba]"
                            : "text-white/68 group-hover:text-white"
                        }`}
                      >
                        <item.icon size={15} strokeWidth={2} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `ai-nav-card relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 transition-all ${
                isActive
                  ? "border-[#d7bea2] bg-[#d7bea2] text-[#4d0e22]"
                  : "border-white/12 bg-white/[0.065] text-white hover:border-white/25 hover:bg-white/[0.1]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-white/50" : "bg-white/10"
                  }`}
                >
                  <MessageCircle size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold">AI Planning Assistant</span>
                  <span className={`block text-[10px] ${isActive ? "text-qu-maroon/80" : "text-white/72"}`}>
                    Ask about your simulations
                  </span>
                </span>
                <Sparkles size={14} className={isActive ? "text-qu-maroon/60" : "text-[#d7bea2]"} />
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
