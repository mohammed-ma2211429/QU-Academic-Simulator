const BASE = "/api";

function errorMessage(detail, status) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail?.detail)) {
    return detail.detail.map((item) => item.msg).filter(Boolean).join("; ") || `Request failed (${status})`;
  }
  if (typeof detail?.detail === "string") return detail.detail;
  if (typeof detail?.detail?.message === "string") return detail.detail.message;
  if (typeof detail?.message === "string") return detail.message;
  return `Request failed (${status})`;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const message = errorMessage(detail, res.status);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qu:api-error", { detail: { message } }));
    }
    throw new Error(message);
  }
  return res.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  // Programs
  getProgram: (id) => get(`/programs/${id}`),

  // Simulations
  simulateCohort: (payload) => post("/simulate/cohort", payload),
  getDefaultIntakeSchedule: (program, maxTerms, startingTerm) =>
    get(`/simulate/cohort/default-intake-schedule?program=${program}&max_terms=${maxTerms}&starting_term=${encodeURIComponent(startingTerm)}`),
  simulateBottleneck: (payload) => post("/simulate/bottleneck", payload),
  bottleneckWhatIf: (params) =>
    post(`/simulate/bottleneck/what-if?${new URLSearchParams(params)}`, {}),
  simulateMonteCarlo: (payload) => post("/simulate/monte-carlo", payload),
  simulateEnrollmentForecast: (payload) => post("/simulate/enrollment-forecast", payload),

  // Data
  getAssumptions: () => get("/data/assumptions"),
  getSources: () => get("/data/sources"),
  getOverrides: () => get("/data/overrides"),
  postOverride: (overrides) => post("/data/override", { overrides }),
  clearOverrides: () => request("/data/override", { method: "DELETE" }),

  // Chatbot
  sendChatMessage: (payload) => post("/chatbot/message", payload),
};
