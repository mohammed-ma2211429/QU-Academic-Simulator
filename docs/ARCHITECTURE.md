# Architecture

This document describes the current repository and separates implemented
behavior from model assumptions.

## 1. Runtime architecture

The application has two layers:

- A React 19 single-page application built by Vite, with a small local
  History API router for the fixed route table.
- A FastAPI application containing the simulation engines and JSON API.

During development, Vite runs on port 5173 and proxies `/api` to FastAPI on port
8001. In production, FastAPI serves both the API and the generated
`frontend/dist` files. Unknown frontend paths fall back to `index.html` and
React renders a Not Found screen; unknown `/api/*` paths return JSON 404s.

`Start App.bat` validates the local Python/Node setup, rebuilds the frontend,
and then launches FastAPI at `http://localhost:8001`.

## 2. Main dependencies

Backend versions are exactly pinned in `backend/requirements.txt`: FastAPI,
Uvicorn, Pydantic, NumPy, NetworkX, and HTTPX. No multipart upload package,
database, ORM, queue, or authentication framework is used.

Frontend versions are locked in `frontend/package-lock.json`. The main runtime
packages are React, Recharts, Framer Motion, Lucide, Papa Parse, html2canvas,
and jsPDF. PDF dependencies are dynamically imported only when a PDF export is
requested, and routed screens are lazy-loaded. The fixed route table does not
need an external routing dependency.

## 3. Source layout

| Path | Responsibility |
|---|---|
| `backend/main.py` | FastAPI routes, error handling, and production SPA serving |
| `backend/simulation/cohort.py` | Base student-level, term-by-term engine |
| `backend/simulation/bottleneck.py` | Paired capacity-cut experiments |
| `backend/simulation/monte_carlo.py` | Repeated uncertain pass-rate runs and sensitivity |
| `backend/simulation/enrollment_forecast.py` | Growth curves and course-demand signals |
| `backend/simulation/models.py` | Request validation, program/default loading, overrides |
| `backend/simulation/validation.py` | Program data structural validation |
| `backend/chatbot/agent.py` | Groq integration and local simulation tool dispatch |
| `backend/tests/` | Regression and API-contract tests |
| `frontend/src/pages/` | Eight retained route screens plus Not Found |
| `frontend/src/components/` | Shared navigation, controls, roadmap, export, and error UI |
| `frontend/src/context/` | Current program, parameters, and last simulation state |
| `frontend/src/utils/` | API, term labels, and browser-side exports |
| `data/programs/` | Runtime CS and CE program definitions |
| `data/raw/` | Extracted and public source data |
| `data/source_documents/` | Original catalog, roadmaps, and source logo |
| `data/assumptions.json` | Operational assumptions with rationale/confidence |
| `data/shared_courses.json` | Canonical values for courses shared by CS and CE |
| `data/simulation_defaults.json` | Population, growth, and simulator defaults |
| `data/sources.json` | Source provenance and unavailable-data disclosures |

Generated `frontend/dist`, `frontend/node_modules`, Python caches, test caches,
and runtime `data/overrides.json` are ignored and are not source code.

## 4. Frontend routes

| Route | Behavior |
|---|---|
| `/` | Static simulator introduction; no metrics or API call |
| `/cohort` | Cohort Flow controls, roadmap, progression, details, and summary |
| `/bottleneck` | Ranked paired impacts and single-course capacity what-if |
| `/monte-carlo` | Distribution, percentiles, outcome bands, and sensitivity |
| `/enrollment-forecast` | Enrollment projections and capacity-pressure evidence |
| `/data-override` | Validated editing/import/export of supported assumptions |
| `/about-data` | Read-only source and assumption transparency |
| `/chat` | AI Planning Assistant with current in-memory simulation context |

React context keeps only the latest successful simulation snapshot. It is not a
history store and resets when the browser reloads.

## 5. API surface

### Programs and data

- `GET /api/programs`
- `GET /api/programs/{program_id}`
- `GET /api/data/assumptions`
- `GET /api/data/sources`
- `GET /api/data/overrides`
- `POST /api/data/override`
- `DELETE /api/data/override`

### Simulations

- `POST /api/simulate/cohort`
- `GET /api/simulate/cohort/default-intake-schedule`
- `POST /api/simulate/bottleneck`
- `POST /api/simulate/bottleneck/what-if`
- `POST /api/simulate/monte-carlo`
- `POST /api/simulate/enrollment-forecast`

### Assistant

- `POST /api/chatbot/message`

Pydantic produces 422 responses for invalid request shapes. Missing program or
course resources produce 404s; invalid model values raised by the engines
produce 400s.

## 6. Cohort Flow

`cohort.py` is the base engine reused by the other analyses.

1. The simulation begins with the selected existing year-level population or
   an explicit roster. Synthetic transcripts place existing students at
   realistic points in the roadmap while retaining seeded variation.
2. New students enter according to the per-term schedule or Fall intake/growth
   settings.
3. Every term, the engine checks completed prerequisites, same-term
   corequisites, degree/elective requirements, seasonal offerings, an 18-credit
   load, and available seats.
4. Eligible students are ordered by the selected registration priority and
   registered until seats are exhausted. Remaining eligible demand becomes the
   waitlist.
5. A valid course pass rate is used first. The global pass rate is a fallback
   only when a course lacks a valid individual rate. The remaining probability
   is divided between failure and withdrawal according to the configured
   fail/withdraw ratio.
6. Attempt outcomes use stable seeded randomness. The same
   seed/student/course/attempt combination therefore stays comparable across
   related scenarios.
7. Four failures or three withdrawals in a required course remove the synthetic
   student from the modeled program. These are explicit behavioral assumptions,
   not cited QU academic rules.

The result contains term snapshots, course enrollment/waitlist/completion
statistics, graduation timing, delay bands, withdrawn counts, and still-active
counts. Course-card color represents seat utilization only; its progress bar
represents population completion.

## 7. Bottleneck Analysis

The analysis asks a causal what-if question: what changes when one course loses
the selected percentage of its seats?

For each required course and each configured seed:

1. Run a baseline Cohort Flow simulation.
2. Run the same students and outcome randomness with only that course's capacity
   reduced.
3. Match students by ID and measure who graduates later, no longer graduates in
   the horizon, or is otherwise delayed.

The page ranks courses by measured student harm, with graduation and
time-to-graduation changes as supporting evidence. Results are averages and
ranges across seeds. They are evidence, not recommendations or an opaque
composite score. The default analysis uses three seeds and a 14-term horizon.

## 8. Monte Carlo

Monte Carlo repeats Cohort Flow while sampling uncertain course pass rates from
the selected normal, beta, or uniform distribution. It aggregates all observed
graduation durations into a histogram, mean, standard deviation, percentiles,
graduation bands, and withdrawal risk.

Repeated runs use a representative population of 20-40 students, proportionally
preserving the real year-level mix, so hundreds of runs remain practical.
Sensitivity separately reduces each course's pass rate by 10% and measures how
the mean graduation duration changes. It indicates model sensitivity, not a
recommended intervention.

## 9. Enrollment Forecast

The selected linear, exponential, or logistic curve produces annual enrollment
projections. That curve scales future Fall intakes from the real existing
population mix. Cohort Flow then simulates the matching term horizon.

For each required course and offered term:

`eligible demand = registered students + eligible waitlisted students`

The first term where eligible demand exceeds
`section_capacity * sections_offered` becomes the course's capacity signal.
The API reports the term, demand, seats, and gap. It does not use a fixed
`enrollment / 8` shortcut and does not generate recommendations.

## 10. Data, caching, and overrides

Program JSON is cached in process, but callers receive deep copies. Shared
courses use one canonical operational record so CS and CE cannot silently
diverge. Overrides are read from disk on load and support only `pass_rate`,
`section_capacity`, and `sections_offered`.

There is no database, file locking, or atomic cross-process state. Concurrent
override writes can race, and a free Render filesystem does not provide durable
override persistence.

## 11. AI Assistant

The assistant uses Groq's OpenAI-compatible API and model
`llama-3.3-70b-versatile`. It can call the retained simulation/data functions
and receives the latest exact frontend simulation snapshot when available. Its
prompt requires factual explanations and limitations rather than planning
recommendations.

Without `GROQ_API_KEY`, the endpoint returns a configuration message and the
rest of the application continues to work. Calls are synchronous, non-streamed,
and have no application-level retry or rate limiter.

## 12. Known limitations

- The simulator uses synthetic students and assumed operational values where
  institution-specific data is unavailable.
- The `"gpa"` registration priority is a pass-performance proxy, not a true GPA.
- Withdrawal thresholds are modeling assumptions, not verified QU policy.
- Monte Carlo and repeated comparative analyses use scaled populations for
  runtime performance.
- Overrides have no authentication, database transactions, or multi-user
  conflict handling.
- Current simulation context is browser-memory only and disappears on reload.
- Groq errors are not retried and may surface as server errors.
- Model output should be interpreted as scenario evidence, not a prediction or
  institutional decision.
