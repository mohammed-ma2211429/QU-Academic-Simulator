import { createContext, useContext } from "react";

export const RouterContext = createContext(null);

export function useLocation() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useLocation must be used within RouterProvider");
  }
  return context.location;
}

export function useNavigate() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useNavigate must be used within RouterProvider");
  }
  return context.navigate;
}
