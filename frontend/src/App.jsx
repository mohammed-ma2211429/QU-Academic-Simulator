import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppProvider from "./context/AppProvider";
import RouterProvider from "./context/RouterProvider";
import { useLocation } from "./context/router-context";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import ErrorBoundary from "./components/ErrorBoundary";

const SimulatorHome = lazy(() => import("./pages/SimulatorHome"));
const CohortSimulator = lazy(() => import("./pages/CohortSimulator"));
const BottleneckAnalysis = lazy(() => import("./pages/BottleneckAnalysis"));
const MonteCarlo = lazy(() => import("./pages/MonteCarlo"));
const EnrollmentForecast = lazy(() => import("./pages/EnrollmentForecast"));
const DataOverride = lazy(() => import("./pages/DataOverride"));
const AboutData = lazy(() => import("./pages/AboutData"));
const ChatAssistant = lazy(() => import("./pages/ChatAssistant"));
const NotFound = lazy(() => import("./pages/NotFound"));

const ROUTES = {
  "/": SimulatorHome,
  "/cohort": CohortSimulator,
  "/bottleneck": BottleneckAnalysis,
  "/monte-carlo": MonteCarlo,
  "/enrollment-forecast": EnrollmentForecast,
  "/data-override": DataOverride,
  "/about-data": AboutData,
  "/chat": ChatAssistant,
};

function AnimatedRoutes() {
  const location = useLocation();
  const Page = ROUTES[location.pathname] || NotFound;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="min-h-full"
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        <Suspense fallback={<PageLoading />}>
          <Page />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function PageLoading() {
  return (
    <div className="qu-card flex min-h-[320px] items-center justify-center text-sm text-qu-text-muted">
      Loading page…
    </div>
  );
}

function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    let timer;
    const showError = (event) => {
      setApiError(event.detail?.message || "The request could not be completed.");
      clearTimeout(timer);
      timer = setTimeout(() => setApiError(""), 6500);
    };
    window.addEventListener("qu:api-error", showError);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("qu:api-error", showError);
    };
  }, []);

  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onMenu={() => setMobileNavOpen(true)} />
        <main
          id="page-export-root"
          className="page-canvas mx-auto w-full max-w-[1680px] flex-1 px-4 py-5 sm:px-6 sm:py-7 xl:px-8"
        >
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </main>
      </div>
      {apiError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-[70] flex max-w-md items-start gap-3 rounded-xl border border-qu-danger/20 bg-white px-4 py-3 text-[12px] text-qu-text shadow-[0_18px_50px_-22px_rgba(80,15,35,.55)]"
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-qu-danger" />
          <span className="leading-relaxed">{apiError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setApiError("")}
            className="ml-2 text-lg leading-none text-qu-text-muted hover:text-qu-text"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RouterProvider>
        <AppShell />
      </RouterProvider>
    </AppProvider>
  );
}
