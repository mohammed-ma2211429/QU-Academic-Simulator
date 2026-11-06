import { useCallback, useMemo, useState } from "react";
import { AppContext } from "./app-context";

const INITIAL_SIMULATION_PARAMETERS = {
  program: "cs",
  cohort_size: 100,
  starting_term: "Fall 2024",
  pass_rate: 0.75,
  fail_rate: 0.15,
  withdraw_rate: 0.10,
  max_terms: 14,
  seed: 42,
  registration_priority: "credit-count",
  use_real_population: true,
  existing_population: { 1: "", 2: "", 3: "", 4: "" },
  intake_schedule: null,
};

export default function AppProvider({ children }) {
  const [program, setProgram] = useState("cs");
  const [lastSimulation, setLastSimulation] = useState(null);
  const [simParams, setSimParams] = useState(INITIAL_SIMULATION_PARAMETERS);

  const recordSimulation = useCallback((type, snapshot) => {
    setLastSimulation({
      ...(snapshot || {}),
      type,
      timestamp: new Date().toISOString(),
      summary: snapshot?.summary ?? snapshot,
    });
  }, []);

  const value = useMemo(() => {
    const effectiveProgram = program === "both" ? "cs" : program;
    return {
      program,
      setProgram,
      effectiveProgram,
      lastSimulation,
      recordSimulation,
      simParams,
      setSimParams,
    };
  }, [program, lastSimulation, recordSimulation, simParams]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
