import { Menu } from "lucide-react";
import { useLocation } from "../context/router-context";

const PAGE_NAMES = {
  "/": "Simulator Home",
  "/cohort": "Cohort Flow",
  "/bottleneck": "Bottleneck Analysis",
  "/monte-carlo": "Monte Carlo",
  "/enrollment-forecast": "Enrollment Forecast",
  "/data-override": "Data Override",
  "/about-data": "Data Sources",
  "/chat": "AI Planning Assistant",
};

export default function TopNav({ onMenu }) {
  const location = useLocation();
  const currentPage = PAGE_NAMES[location.pathname] || "Academic Simulator";

  return (
    <header className="top-nav sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenu}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-qu-border bg-white text-qu-text-muted shadow-sm hover:text-qu-maroon lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <div className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-qu-text-muted">
            Academic Planning / Simulator
          </div>
          <h1 className="mt-0.5 truncate text-[15px] font-bold leading-tight text-qu-text sm:text-[16px]">
            {currentPage}
          </h1>
        </div>
      </div>

      <div className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-qu-text-muted sm:block">
        Qatar University
      </div>
    </header>
  );
}
