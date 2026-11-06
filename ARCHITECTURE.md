# Repository Architecture

This document describes the repository exactly as it exists in the working
tree on 2026-07-28. It covers implemented behavior only. Deleted files and
features that are not present in the current route table or backend imports are
not part of this architecture.

The following checks passed against this snapshot:

```text
frontend: npm run lint
frontend: npm run build
backend:  python -m unittest discover -s tests -v
          17 tests passed
```

There are no browser end-to-end tests. A screen marked **fully working** below
means that its implementation is complete, its imports compile in the
production build, and its relevant backend contract or core logic is covered
where the current test suite provides coverage. **Partially working** means the
screen is implemented but an important capability depends on external
configuration or browser support. No retained route is a stub.

## 1. Tech stack and execution model

### 1.1 Backend

The backend is a synchronous FastAPI application. Versions are pinned exactly
in `backend/requirements.txt`.

| Package | Exact version | Use |
|---|---:|---|
| Python | 3.12.4 in `render.yaml` | Render production runtime. The local launcher checks only that `python` exists; its message asks for Python 3.12 or newer but does not enforce the version. |
| FastAPI | 0.139.0 | HTTP API, request injection, exception handlers, OpenAPI, and static SPA fallback |
| Uvicorn with `standard` extras | 0.51.0 | ASGI server |
| Pydantic | 2.12.5 | Request validation |
| NumPy | 2.4.4 | Monte Carlo sampling and percentiles |
| NetworkX | 3.6.1 | Prerequisite graph construction and descendant counts in Bottleneck Analysis |
| HTTPX | 0.28.1 | Synchronous Groq chat-completions client |

There is no database, ORM, migration system, authentication library, task
queue, background worker, or server-side session store.

### 1.2 Frontend

The frontend is a React single-page application built by Vite. The versions
below are the exact installed versions recorded in `frontend/package-lock.json`,
not the semver ranges from `package.json`.

#### Runtime packages

| Package | Exact version | Use |
|---|---:|---|
| React | 19.2.7 | UI framework |
| React DOM | 19.2.7 | Browser rendering |
| Recharts | 3.9.2 | Cohort, Monte Carlo, and enrollment charts |
| Framer Motion | 12.42.2 | Route transitions, roadmap layout animation, and completion-bar animation |
| Lucide React | 1.24.0 | Icons |
| Papa Parse | 5.5.4 | Browser-side CSV generation |
| html2canvas | 1.4.1 | Rendering report areas to a bitmap for PDF export |
| jsPDF | 4.2.1 | Browser-side PDF construction |

#### Build and development packages

| Package | Exact version |
|---|---:|
| Vite | 8.1.4 |
| `@vitejs/plugin-react` | 6.0.3 |
| Tailwind CSS | 4.3.2 |
| `@tailwindcss/postcss` | 4.3.2 |
| PostCSS | 8.5.19 |
| Autoprefixer | 10.5.2 |
| Oxlint | 1.73.0 |
| `@types/react` | 19.2.17 |
| `@types/react-dom` | 19.2.3 |

The app does not use React Router. `RouterProvider.jsx` implements a small
fixed History API router with `pushState`, `replaceState`, and `popstate`.
Navigation state is matched by exact pathname.

The frontend package version is 1.0.0 and the FastAPI application version is
also 1.0.0. The frontend is JavaScript/JSX with ES modules, not TypeScript.
Neither a Node.js version nor an npm version is pinned in the repository.

### 1.3 Local execution

`Start App.bat` is the normal Windows launcher:

1. Change to the repository root.
2. Check that `python` and `npm` are on `PATH`.
3. Check that the six backend packages can be imported.
4. Check that `frontend/node_modules` exists.
5. Run `npm run build` in `frontend`.
6. Start `python -m uvicorn main:app --host 127.0.0.1 --port 8001`
   from `backend`.

The launcher deliberately rebuilds the SPA before starting the server. It does
not install missing dependencies.

For development, the backend and frontend are run separately:

```powershell
cd backend
python -m uvicorn main:app --reload --port 8001
```

```powershell
cd frontend
npm run dev
```

Vite listens on port 5173 and proxies `/api` to
`http://127.0.0.1:8001`.

### 1.4 Production serving and deployment

`render.yaml` defines one Render web service:

- runtime: Python
- plan: free
- region: Oregon
- Python version: 3.12.4
- build:
  `pip install -r backend/requirements.txt && cd frontend && npm ci && npm run build`
- start:
  `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- health check: `/api/programs`
- required secret: `GROQ_API_KEY`, entered outside version control

At import time, `backend/main.py` checks whether `frontend/dist` exists. If it
does, FastAPI mounts `/assets` and registers a catch-all GET route. Real files
inside `frontend/dist` are served directly; other non-API paths return
`index.html` with `Cache-Control: no-store, max-age=0`. The implementation
checks `os.path.commonpath` before serving a candidate file to prevent a path
from escaping the build directory. An unknown `/api/*` GET is explicitly
returned as JSON 404 instead of falling back to the SPA.

## 2. Repository structure

```text
simulator/
|-- backend/
|   |-- chatbot/
|   |   `-- agent.py
|   |-- simulation/
|   |   |-- bottleneck.py
|   |   |-- cohort.py
|   |   |-- enrollment_forecast.py
|   |   |-- models.py
|   |   |-- monte_carlo.py
|   |   `-- validation.py
|   |-- tests/
|   |   `-- test_simulator.py
|   |-- main.py
|   `-- requirements.txt
|-- data/
|   |-- programs/
|   |   |-- ce.json
|   |   `-- cs.json
|   |-- raw/
|   |   |-- catalog_fulltext.txt
|   |   |-- course_descriptions_cmps_cmpe_elec.txt
|   |   `-- enrollment_real_data.json
|   |-- source_documents/
|   |   |-- catalog.pdf
|   |   |-- ce_roadmap.png
|   |   |-- cs_roadmap.png
|   |   `-- qu_logo.png
|   |-- assumptions.json
|   |-- build_assumptions.py
|   |-- build_programs.py
|   |-- shared_courses.json
|   |-- simulation_defaults.json
|   `-- sources.json
|-- docs/
|   `-- ARCHITECTURE.md
|-- frontend/
|   |-- public/
|   |   `-- qu-favicon.png
|   |-- src/
|   |   |-- components/
|   |   |-- context/
|   |   |-- pages/
|   |   |-- utils/
|   |   |-- App.jsx
|   |   |-- index.css
|   |   `-- main.jsx
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- postcss.config.js
|   `-- vite.config.js
|-- .gitignore
|-- ARCHITECTURE.md
|-- README.md
|-- render.yaml
`-- Start App.bat
```

### 2.1 Backend modules

| Path | Current responsibility |
|---|---|
| `backend/main.py` | FastAPI application, CORS, exception translation, all public HTTP endpoints, and production SPA serving |
| `backend/simulation/models.py` | Program/default loading, process cache, shared-course canonicalization, runtime override persistence, and all simulation request models |
| `backend/simulation/cohort.py` | Student-level, term-by-term base simulation used directly and by the other engines |
| `backend/simulation/bottleneck.py` | Paired baseline/capacity-reduction experiments and structural prerequisite descendant counts |
| `backend/simulation/monte_carlo.py` | Pass-rate sampling, repeated cohort runs, aggregate uncertainty statistics, and pass-rate sensitivity |
| `backend/simulation/enrollment_forecast.py` | Linear, exponential, and logistic enrollment curves plus cohort-derived course-capacity signals |
| `backend/simulation/validation.py` | Structural validation for program JSON |
| `backend/chatbot/agent.py` | Groq API integration, system prompt, tool definitions, tool execution, and tool-call loop |
| `backend/tests/test_simulator.py` | Seventeen unit, regression, and API-contract tests |

### 2.2 Frontend modules

| Path | Current responsibility |
|---|---|
| `frontend/src/App.jsx` | Lazy-loaded fixed route table, animated route container, global API-error toast, and shared shell |
| `frontend/src/context/RouterProvider.jsx` | Local History API routing |
| `frontend/src/context/AppProvider.jsx` | Current program, Cohort Flow parameters, and the latest successful simulation snapshot |
| `frontend/src/components/Sidebar.jsx` | Desktop/mobile navigation and AI Assistant link |
| `frontend/src/components/TopNav.jsx` | Current page title and mobile menu button |
| `frontend/src/components/SimulationControls.jsx` | Cohort base inputs, population/intake editor, rates, horizon, seed, and registration priority |
| `frontend/src/components/RoadmapFlow.jsx` | Animated term selector, roadmap course cards, live schedules, and actual-registration correction |
| `frontend/src/components/ExportButton.jsx` | CSV/PDF export menu |
| `frontend/src/utils/api.js` | Fetch wrapper and all frontend API calls |
| `frontend/src/utils/dataExport.js` | CSV and JSON browser downloads |
| `frontend/src/utils/pdfExport.js` | Lazy-loaded screenshot-to-PDF export |
| `frontend/src/utils/term.js` | Simulation-term labels and current-semester label |
| `frontend/src/index.css` | Tailwind import, QU color tokens, global component styles, typography floor, responsive navigation, and reduced-motion rules |

`frontend/dist`, `frontend/node_modules`, Python caches, test caches, local
environment files, and runtime `data/overrides.json` are ignored by Git.

## 3. Frontend routes and screens

The only registered frontend paths are the eight entries in `App.jsx`. Any
other pathname renders `NotFound.jsx`.

| Route | Screen | Status | Current behavior |
|---|---|---|---|
| `/` | Simulator Home | **Fully working** | Static introduction to the four analyses, their questions/outputs, a three-step usage method, data links, and links to Cohort Flow and the AI Assistant. It makes no API call and calculates no metrics. |
| `/cohort` | Cohort Flow Simulator | **Fully working** | Automatically runs CS by default, provides population/intake/rate/seed/priority controls, and displays Roadmap Flow, Term Progression, and Summary Statistics. Supports live capacity/rate schedules and actual enrollment corrections. |
| `/bottleneck` | Bottleneck Analysis | **Fully working** | Automatically runs a three-seed, 14-term paired analysis, ranks the top ten courses by harmed students, shows prerequisite/downstream structure, and provides a debounced single-course capacity comparison. |
| `/monte-carlo` | Monte Carlo Simulator | **Fully working** | Automatically runs the selected program and a comparison program, shows a pooled graduation histogram, hand-drawn box plots, sensitivity bars, and summary statistics. |
| `/enrollment-forecast` | Enrollment Forecast | **Fully working** | Loads program-specific defaults automatically, plots a selected growth curve, and reports the first required-course demand/capacity excess per course. Changed controls hide stale results until rerun. |
| `/data-override` | Data Override Panel | **Fully working** | Loads documented course assumptions and saved overrides, filters/searches them, imports/exports JSON, validates on save through the backend, and clears the runtime override file after confirmation. |
| `/about-data` | About This Data | **Fully working** | Loads and displays source records, unresolved data gaps, the number of assumed course fields, and a link to Data Override. |
| `/chat` | AI Planning Assistant | **Partially working / configuration-dependent** | The chat UI, current-session context, suggested prompts, text input, and tool-capable backend are implemented. Real LLM responses require `GROQ_API_KEY`; without it the endpoint returns a fixed configuration message. Speech input/output additionally depends on browser Web Speech APIs. |
| any other path | Not Found | **Fully working** | Displays a local fallback screen and links back to `/`. |

### 3.1 Cohort Flow subviews

The three tabs share `/cohort`; the selected tab is component state and is not
encoded in the URL.

#### Roadmap Flow

- Displays the eight roadmap columns stored in the selected program JSON.
- Play speeds are Slow 1,400 ms, Normal 800 ms, Fast 350 ms, and Instant.
  Play, Pause, Step, Reset, a term slider, and a term label change only the
  viewed snapshot; they do not perform a new simulation.
- A course-card color has one meaning: current seat utilization.
  - grey: no students enrolled;
  - green: more than zero and at most 60% of effective seats;
  - amber: over 60% and at most 85%;
  - maroon: over 85%.
- The card progress bar has a separate, labeled meaning: the percentage of all
  students introduced by that term who have passed the course.
- Clicking a card opens a drawer with first-attempt passes, successful retake
  counts, eligible-but-unfinished count, final-term enrollment, average
  attempts, and withdrawal-event percentage.
- “Adjust from here” can:
  - change one course's per-section capacity or section count from the next
    term onward;
  - change global fallback pass/fail/withdraw inputs from the next term onward;
  - replace one course's modeled registrations in the currently viewed term
    with an actual count, limited to the number of eligible students.
- Applying a change reruns the complete simulation with accumulated schedules
  and advances the view one term.

#### Term Progression

The chart series and legend order are On-track, Graduated, Delayed, Withdrawn.
“On-track” and “Delayed” are current active-state classifications; Graduated
and Withdrawn are cumulative terminal counts. Their exact definitions are in
Section 5.1.

#### Summary Statistics

The table displays initial and final active enrollment, still-enrolled count,
terminal-outcome percentages, graduation-duration statistics, and the
most-retaken/most-abandoned course. CSV export contains all summary key/value
pairs. PDF export captures the currently rendered report area.

### 3.2 Bottleneck Analysis subviews

- Left controls select CS/CE, a 10%, 20%, 30%, or 50% per-section capacity
  reduction, and a stress-test population from 60 to 300.
- The main ranking bar encodes only `students_harmed_mean`.
- Selecting a course shows its direct prerequisites and the required courses
  reachable downstream. This structural path is calculated in the browser
  from catalog prerequisites and is not part of the harm score.
- Evidence cards show harmed students, newly unfinished students, graduate
  count change, on-time population percentage-point change, cumulative
  waitlist change, and downstream count.
- The single-course control accepts any course and any capacity from 0 to 200.
  It waits 450 ms after a slider change, discards stale responses by request
  sequence, and compares the selected capacity against a fresh baseline.

### 3.3 Monte Carlo subviews

- Controls: program, 100–2,000 runs in steps of 100, distribution, Beta alpha
  and beta when applicable, and seed.
- The selected program uses the requested run count. The other program is run
  concurrently for the box-plot comparison, capped at 150 runs.
- The histogram colors graduate durations as on-time (at most 8 terms),
  delayed (9–10), or significantly delayed (11+).
- The box plot is a custom SVG showing min, first quartile, median, third
  quartile, and max for CS and CE.
- Sensitivity displays the top 12 course scores from a 10% pass-rate drop.
- Summary statistics report the pooled graduates' mean, median, population
  standard deviation, P90, three duration bands, mean run-level withdrawal
  percentage, and the highest sensitivity score.

### 3.4 Enrollment Forecast subviews

- Controls: program, current enrollment, annual growth from -10% to 30%,
  linear/exponential/logistic model, and one- to ten-year horizon.
- Changing program immediately calls the API with no explicit numeric inputs,
  then populates the controls from `simulation_defaults.json`.
- Editing a control marks the displayed result stale and hides it until Run
  Forecast succeeds.
- The main chart is only the mathematical program enrollment projection; it
  does not plot historical enrollment observations.
- Capacity signals list the first simulated term in which eligible demand
  exceeds recorded seats for each affected required course.
- The evidence panel reports required courses tested, affected courses, terms
  simulated, earliest signal term, and zero-capacity data warnings.

### 3.5 Data and assistant screens

The Data Override screen displays one row per field in `assumptions.json`.
Importing a JSON file replaces the screen's current edit state but does not
persist it until Save is clicked. Save merges non-empty values into
`data/overrides.json`; clearing deletes that entire file.

The AI Assistant's “latest simulation” is the latest result recorded in
`AppProvider`, regardless of which simulation produced it. It exists only in
browser memory. Reloading the SPA clears both the chat and simulation context.

## 4. Backend API

FastAPI also exposes its generated OpenAPI endpoints at `/docs`, `/redoc`, and
`/openapi.json`. The application-specific endpoints are below.

### 4.1 Common validation and error behavior

- Invalid Pydantic request bodies return FastAPI 422 responses.
- `FileNotFoundError` is translated to JSON 404.
- uncaught `ValueError` is translated to JSON 400.
- Unknown program IDs are either 404 or 400 depending on where loading fails.
- A Cohort Flow program with critical structural validation findings returns
  HTTP 400 with `{message, issues}` nested under FastAPI's `detail`.
- No endpoint declares a Pydantic response model; outputs are plain dictionaries.
- All route functions are synchronous `def` functions.

### 4.2 Program endpoints

#### `GET /api/programs`

Inputs: none.

Output:

```json
{
  "programs": ["<complete CS program object>", "<complete CE program object>"]
}
```

Purpose: list every `*.json` filename in `data/programs`, load each complete
program, apply canonical shared-course values and runtime overrides, and return
the full objects. It does not return a reduced metadata list.

#### `GET /api/programs/{program_id}`

Inputs:

- `program_id`: path string matching a JSON file after loader validation.

Output: one complete program object.

Purpose: supply curriculum, roadmap, pass rates, and capacity data to a
frontend screen. Unknown programs return 404.

### 4.3 Cohort endpoints

#### `POST /api/simulate/cohort`

Body fields:

| Field | Type and bounds | Default / meaning |
|---|---|---|
| `program` | string; alphanumeric first character, then alphanumeric, `_`, or `-`; max 80 | `cs` |
| `cohort_size` | integer 1–5,000 | 100; fallback year-one size only when no real/explicit population exists |
| `starting_term` | string, not pattern-validated | `Fall 2024` |
| `pass_rate` | number 0–1 | 0.75; fallback only when a course has no valid individual rate |
| `fail_rate` | number 0–1 | 0.15; relative weight within non-pass outcomes |
| `withdraw_rate` | number 0–1 | 0.10; relative weight within non-pass outcomes |
| `max_terms` | integer 1–40 | 14 |
| `seed` | integer 0–4,294,967,295 | 42 |
| `registration_priority` | `random`, `gpa`, or `credit-count` | `credit-count` |
| `per_course_params` | map: course → rate fields | optional authoritative per-run rate overrides |
| `capacity_overrides` | map: course → `section_capacity` / `sections_offered` | optional baseline capacity overrides |
| `existing_population` | map: year integer → non-negative count | optional; otherwise use real program defaults |
| `new_entrants_per_intake` | non-negative integer | optional fixed Fall intake |
| `growth_rate` | number at least -1 | optional; otherwise use program default |
| `roster` | list of untyped objects | optional `{student_id, completed, current_term}` rows |
| `intake_schedule` | map: term at least 1 → non-negative count | optional explicit per-semester intake |
| `capacity_schedule` | map: term → course → non-negative capacity fields | optional cumulative changes |
| `rate_schedule` | map: term → valid rate fields 0–1 | optional cumulative global rate changes |
| `actual_enrollment` | map: term → course → non-negative count | optional single-term registration counts |

Output keys:

- `per_term_stats`: term, on-track, delayed, graduated, withdrawn, outcomes,
  active enrollment, and new entrants;
- `graduation_distribution`: one duration value for each graduate;
- `stuck_points`: top ten broad eligible-but-unfinished course counts;
- `course_stats`: attempts, retakes, unfinished, final enrollment, withdrawals,
  and cumulative enrollment/waitlist per course;
- `course_term_snapshots`: enrollment, waitlist, demand, cumulative passes, and
  completion percentage for every course and term;
- `summary`: counts, outcome percentages, duration statistics, and
  most-retaken/most-abandoned fields.

`student_outcomes` is available only to internal callers that pass
`include_student_outcomes=True`; it is not enabled by this HTTP endpoint.

Purpose: run the base ongoing-population simulation.

#### `GET /api/simulate/cohort/default-intake-schedule`

Query inputs:

- `program`: default `cs`;
- `max_terms`: 1–40, default 14;
- `starting_term`: default `Fall 2024`.

Output:

```json
{"schedule": {"2": 0, "3": 219, "...": 0}}
```

Purpose: produce the same Fall-only, logistic-growth intake schedule Cohort
Flow would use without an explicit schedule, so the frontend can prefill its
per-semester editor.

### 4.4 Bottleneck endpoints

#### `POST /api/simulate/bottleneck`

Body fields:

| Field | Bounds | Default |
|---|---:|---:|
| `program` | validated program string | `cs` |
| `capacity_reduction` | 0–1 | 0.20 |
| `specific_overrides` | course → non-negative per-section capacity | absent |
| `cohort_size` | 1–1,000 | 300 |
| `seed` | 0–4,294,967,295 | 42 |
| `n_seeds` | 1–10 | 3 |
| `max_terms` | 8–24 | 14 |

Output:

- `baseline_summary`: numeric cohort summary fields averaged across seeds;
- `top_bottlenecks`: first ten entries of the paired-impact ranking;
- `course_impacts`: the same evidence for every tested course;
- `analysis_meta`: reduction, population, seed range, horizon, and
  `paired_student_outcomes` method.

Purpose: reduce each tested course independently and compare matched student
outcomes against unchanged baselines.

If `specific_overrides` is absent, every course object is tested. If it is
present, only its keys are tested and each value is the exact tested
per-section capacity.

#### `POST /api/simulate/bottleneck/what-if`

All simulation inputs are query parameters; the frontend sends an empty JSON
body.

| Query field | Bounds | Default |
|---|---:|---:|
| `program` | required string | none |
| `course_code` | required existing code | none |
| `new_capacity` | non-negative integer | none |
| `cohort_size` | positive integer | 300 |
| `seed` | integer; no explicit query bound | 42 |
| `n_seeds` | 1–10 | 3 |
| `max_terms` | 8–24 | 14 |

Output:

- course code, original/tested per-section capacities, and sections offered;
- averaged `baseline_summary` and `tested_summary`;
- `changes` with mean/min/max for every paired comparison metric;
- analysis metadata.

Purpose: compare one exact per-section capacity against a fresh unchanged
baseline.

### 4.5 Monte Carlo endpoint

#### `POST /api/simulate/monte-carlo`

Body fields:

| Field | Bounds | Default |
|---|---:|---:|
| `program` | validated program string | `cs` |
| `cohort_size` | 1–1,000 | 100 |
| `n_runs` | 1–5,000 | 1,000 |
| `distribution` | `normal`, `beta`, or `uniform` | `beta` |
| `beta_alpha` | greater than 0 and at most 100 | 5 |
| `beta_beta` | greater than 0 and at most 100 | 2 |
| `normal_std` | 0–1 | 0.08 |
| `seed` | 0–4,294,967,295 | 42 |

Output:

- `graduation_distribution`: histogram of pooled graduate durations;
- `raw_graduation_terms`: every pooled graduate duration;
- `statistics`: mean, median, population standard deviation, percentiles,
  duration bands, withdrawal percentage, run count, and representative
  subcohort size;
- `percentiles`: P25, P50, P75, and P90;
- `sensitivity_matrix`: baseline mean, every course score, and maximum.

Purpose: sample all course pass rates and rerun the base simulation repeatedly.
The endpoint then performs a separate sensitivity analysis with ten baseline
runs and ten reduced-rate runs per course. Sensitivity always uses at most 40
students, regardless of a larger request population.

### 4.6 Enrollment endpoint

#### `POST /api/simulate/enrollment-forecast`

Body fields:

| Field | Bounds | Default |
|---|---:|---:|
| `program` | validated program string | `cs` |
| `current_enrollment` | 1–1,000,000 or null | program value from `simulation_defaults.json` |
| `growth_rate` | -1 to 5 or null | program value from `simulation_defaults.json` |
| `model` | `linear`, `exponential`, or `logistic` | `logistic` |
| `years` | 1–10 | 5 |

Output:

- `projections`: year index and projected enrollment;
- `capacity_signals`: first excess-demand term for each affected required course;
- `capacity_summary`: tested course count, affected count, earliest term,
  simulated terms, and demand-method label;
- `data_issues`: currently zero-capacity warnings;
- `params`: resolved inputs.

Purpose: calculate a program growth curve, turn it into Fall intakes, run
Cohort Flow, and extract required-course capacity pressure.

### 4.7 Data endpoints

#### `GET /api/data/assumptions`

Inputs: none.

Output: the complete contents of `data/assumptions.json`.

Purpose: populate the Data Override and About Data screens.

#### `GET /api/data/sources`

Inputs: none.

Output: the complete contents of `data/sources.json`.

Purpose: display source provenance and unavailable-data disclosures.

#### `GET /api/data/overrides`

Inputs: none.

Output: saved overrides after legacy shared-course entries are collapsed to
the `department` scope. Returns `{}` when `data/overrides.json` is absent.

#### `POST /api/data/override`

Body:

```json
{
  "overrides": {
    "department": {
      "MATH101": {
        "pass_rate": 0.85,
        "section_capacity": 45,
        "sections_offered": 4
      }
    },
    "cs": {
      "CMPS303": {"sections_offered": 3}
    }
  }
}
```

Only `pass_rate`, `section_capacity`, and `sections_offered` are allowed.
Pass rates must be 0–1; capacity and section counts must be non-negative
integers. A department course must exist in `shared_courses.json`; a
program-scoped course must exist in that program. Matching legacy CS and CE
overrides for one shared course collapse into a department override;
conflicting values are rejected.

Output: `{"status":"saved"}`.

Purpose: merge validated values into `data/overrides.json`.

#### `DELETE /api/data/override`

Inputs: none.

Output: `{"status":"cleared"}`.

Purpose: delete `data/overrides.json` completely.

### 4.8 Assistant endpoint

#### `POST /api/chatbot/message`

Body fields:

- `message`: 1–20,000 characters;
- `conversation_history`: zero to 100 items, each with role `user` or
  `assistant` and content 1–20,000 characters;
- `simulation_context`: optional untyped object.

Successful output:

```json
{
  "response": "text",
  "tool_calls_made": [
    {"tool": "tool_name", "arguments": {}}
  ],
  "sources": [
    "QU Academic Simulator internal simulation engine"
  ]
}
```

Without `GROQ_API_KEY`, the same 200 response shape contains a fixed
configuration message, no tools, and no sources. Groq HTTP failures are not
translated locally and normally become a FastAPI 500 response.

Purpose: run a Groq tool-call conversation against the current simulation
engines and optional client-provided snapshot.

## 5. Simulation algorithms

### 5.1 Cohort Flow

`backend/simulation/cohort.py` is the base engine. Bottleneck Analysis,
Monte Carlo, and Enrollment Forecast all call it.

#### A. Starting population

For CS and CE, an omitted population resolves to the real 2021–2022 year-level
headcounts:

| Program | Year 1 | Year 2 | Year 3 | Year 4 | Total |
|---|---:|---:|---:|---:|---:|
| CS | 172 | 148 | 124 | 104 | 548 |
| CE | 190 | 151 | 125 | 104 | 570 by year-level sum; the published program total stored elsewhere is 571 |

The one-student difference in CE is present in the repository's source data:
the four published year-level fields add to 570 while the stored published
`total` is 571. Cohort Flow uses the four year-level fields.

Synthetic existing students are created with:

```text
terms already completed by year = {1: 0, 2: 2, 3: 4, 4: 6}
entry_term = 1 - terms_already_completed
```

All required courses whose `semester_position` is no later than that progress
point are initially treated as complete. For each existing student, there is a
40% chance that one to three of those courses are randomly removed, provided
the initial set has more than three courses. An iterative closure then removes
any completed downstream course whose prerequisite is missing. This produces a
seeded synthetic transcript; it is not student-record data.

If a roster is supplied, each row's `completed` codes and `current_term` are
used instead. Unknown completed-course codes are discarded. The supplied
`student_id` is not used; IDs are reassigned from list order. Roster completion
sets are not checked for prerequisite closure.

If neither an existing population nor real default exists, the engine creates
`cohort_size` new year-one students at term 1.

#### B. New intakes

Term 1 represents the already existing population and does not add a separate
new intake. From term 2 onward:

1. If `intake_schedule` exists, its exact value is used for that term and a
   missing key means zero. It can add students in Fall or Spring.
2. Otherwise, Spring adds zero.
3. Otherwise, a fixed `new_entrants_per_intake` is used when supplied.
4. Otherwise, the year-one base count is projected with the same positive
   logistic curve as Enrollment Forecast:

```text
K = 3B
t0 = ln(K / B - 1) / g = ln(2) / g
intake(i) = round(K / (1 + exp(-g(i - t0))))
```

where `B` is the current year-one count, `g` is annual growth, and `i` is the
Fall-intake index. The 3× ceiling is a code-level modeling assumption; no
external source is cited for it. An absent growth rate falls back to 10% for
programs without stored defaults.

#### C. Course iteration and eligibility

Courses are sorted by:

1. required before elective;
2. `semester_position`;
3. course code.

For each offered course in the current Fall/Spring season, a student is a
candidate when:

- the course is not already completed;
- every prerequisite is completed;
- every corequisite is either completed or already added to that student's
  registrations in this same iteration;
- the student has enough of the 18-credit term budget remaining;
- if it is an elective, that elective category's required credits have not
  already been completed.

`MAX_CREDITS_PER_TERM = 18` is an internal constant. The repository does not
cite an external rule for it.

#### D. Capacity and registration

The base number of seats is:

```text
seats = max(0, int(section_capacity * sections_offered))
```

Baseline `capacity_overrides` replace course values. A
`capacity_schedule` is resolved cumulatively: the latest change at or before
the current term remains active until replaced.

Candidates are ordered by the selected priority:

- `credit-count`: descending earned credits, then student ID;
- `gpa`: descending `performance_score`, then student ID;
- `random`: student ID order followed by a seeded shuffle.

The so-called GPA score is not a GPA:

```text
performance_score =
  first-attempt passes / number of completed courses
```

It returns 0.5 before any attempts.

The first `seats` candidates register; all remaining eligible candidates are
counted as waitlisted. If an `actual_enrollment[term][course]` value exists,
effective seats become:

```text
effective_seats = min(actual_count, eligible_candidate_count)
```

That can be above or below modeled capacity. It controls the count, not the
identity, of registered students.

#### E. Pass, fail, and withdrawal outcomes

Pass-rate precedence is:

1. a valid `per_course_params[course].pass_rate`;
2. the loaded course's valid `pass_rate`, including a runtime data override;
3. the current scheduled/global fallback pass rate.

Therefore the global pass-rate control does not modify courses that already
have valid individual rates.

The pass probability is clamped to `[0, 1]`. Fail and withdrawal inputs are
weights for the remaining probability, not independent absolute
probabilities:

```text
p = clamp(pass_rate, 0, 1)
remaining = 1 - p

if fail_rate + withdraw_rate > 0:
    P(fail) = remaining * fail_rate / (fail_rate + withdraw_rate)
    P(withdraw event) =
        remaining * withdraw_rate / (fail_rate + withdraw_rate)
else:
    P(fail) = remaining
    P(withdraw event) = 0
```

Changing a cumulative `rate_schedule.pass_rate` still affects only courses
that lack an individual pass rate. Scheduled fail and withdrawal weights
affect courses unless that course has explicit per-run fail/withdraw fields.

Each attempt uses a deterministic common-random-number draw:

```text
key = "seed:student_id:course_code:attempt_number"
value = unsigned_integer(BLAKE2b(key, 8-byte digest)) / 2^64
```

This prevents unrelated iteration-order changes from changing the same
student/course/attempt outcome and allows paired scenario comparison.

#### F. Program withdrawal and graduation

A modeled student becomes withdrawn from the modeled program after either:

```text
4 failures in the same required course
3 withdrawal events in the same required course
```

These thresholds are explicit model assumptions. The repository does not cite
them as Qatar University policy. Failures and withdrawal events are tracked
separately; total attempts do not trigger the threshold.

A student graduates only when all three conditions hold:

1. earned credits are at least `total_credits_required`;
2. every code in `required_courses` is complete;
3. each elective category meets its `credits_required`.

#### G. Per-term classifications

After a term:

- **On-track** = status is active and the student registered for at least one
  course in that term.
- **Delayed** = status is active and the student registered for no course in
  that term.
- **Graduated** = cumulative count of students who have graduated by that term.
- **Withdrawn** = cumulative count removed by the model thresholds.

Graduates are not included in On-track after graduation. At each term these
four categories partition all students introduced so far. `total_enrolled`
equals On-track plus Delayed.

The `consecutive_stuck_terms` field is reset to zero whenever a student
registers and incremented otherwise, but only zero versus non-zero is used for
the displayed classification. It does not itself cause withdrawal.

#### H. Completion, duration, and output formulas

For each course and term:

```text
demand = registered + waitlisted
completion percentage =
  100 * students who have passed the course
      / all students introduced by that term
```

The completion denominator includes students for whom the course may be a
later requirement. It is a population-progress indicator, not the pass rate
and not the fraction of course takers who passed.

An existing student's graduation duration includes assumed prior history:

```text
duration = graduated_term - entry_term + 1
```

Graduation bands are:

```text
on time: duration <= 8
one term delayed: duration == 9
two terms delayed: duration == 10
three or more delayed: duration >= 11
```

`on_time_pct`, delay percentages, and `withdrawn_pct` use:

```text
denominator = graduates + withdrawn students
```

Students still active at the horizon are excluded from those percentages.
`on_time_population_pct`, `graduated_pct`, and `still_active_pct` instead use
all students ever introduced.

The cohort percentile implementation uses linear interpolation at index
`(n - 1) * percentile / 100`. Course `withdrawn_pct` means withdrawal events
divided by total course enrollments/attempts, not the percentage of distinct
students removed from the program.

`currently_waiting` in course detail counts horizon-active students who have
not completed the course and have completed its prerequisites. It does not
check current seasonal offering, corequisites, credit load, elective need, or
whether the student was actually waitlisted in the last term.

### 5.2 Bottleneck Analysis

The engine measures the effect of a capacity reduction; it does not infer a
bottleneck from enrollment alone.

#### A. Baseline design

The real year-level population mix is scaled approximately to the requested
stress-test population. Each year is kept at a minimum of one student after
rounding, so the exact sum can differ slightly from `cohort_size`.

For `n_seeds`, seeds are:

```text
seed, seed + 1, ..., seed + n_seeds - 1
```

One unchanged baseline Cohort Flow run is created per seed with student-level
outcomes enabled.

#### B. Course stress

By default, every course in `program["courses"]` is tested, including
electives and zero-credit package placeholders. For one course at a time:

```text
tested per-section capacity =
  max(0, round(original_capacity * (1 - capacity_reduction)))
```

`sections_offered` is unchanged. With `specific_overrides`, the provided
capacity is used exactly and only named courses are tested.

The tested program is a deep copy. It is rerun with the same scaled students,
seeds, and stable attempt-outcome draws as the baseline.

#### C. Paired comparison

Students are matched by internal ID.

```text
newly unfinished:
  graduated in baseline, not graduated in tested run

delayed:
  graduated in both, tested duration > baseline duration

improved:
  graduated in both, tested duration < baseline duration

newly graduated:
  not graduated in baseline, graduated in tested run

students harmed = delayed + newly unfinished
students improved = improved + newly graduated
```

Supporting changes are tested minus baseline for graduates, still enrolled,
withdrawn, on-time population percentage points, average graduate duration,
and that course's cumulative waitlist.

Each metric reports arithmetic mean, minimum, and maximum across seeds. Numeric
baseline summary fields are also averaged across seeds and rounded to one
decimal.

#### D. Structural graph and ranking

NetworkX builds a directed graph:

```text
prerequisite -> dependent course
```

Corequisites are not graph edges. `downstream_count` is the number of all
reachable descendants, required or elective, in the backend ranking evidence.
The frontend's focused-path display separately filters its shown downstream
courses to required courses.

Ranking is lexicographic:

1. descending `students_harmed_mean`;
2. descending `newly_unfinished_mean`;
3. descending tested-course cumulative waitlist change;
4. descending graph descendant count;
5. ascending course code.

The API returns the first ten as `top_bottlenecks` and retains every result in
`course_impacts`. There is no recommendation text and no composite score.

The single-course what-if uses the same comparison but recomputes both baseline
and tested runs for all requested seeds.

### 5.3 Monte Carlo

Monte Carlo changes pass-rate uncertainty while retaining the same Cohort Flow
rules.

#### A. Representative population

Each repeated run uses:

```text
sub_cohort_size = max(20, min(requested_cohort_size, 40))
```

The real year-level mix is proportionally scaled to that target, with at least
one student retained in each year. This is a performance decision in the code,
not a statistical sample-size calculation.

#### B. Per-course rate sampling

For each run, one NumPy `RandomState(seed)` is advanced sequentially through
all program courses. A valid course rate is the base; missing/invalid rates
fall back to 0.75. Every sample is clipped to `[0.05, 0.99]`.

Normal:

```text
sample = clip(Normal(base_rate, normal_std), 0.05, 0.99)
```

Uniform:

```text
sample = clip(Uniform(base_rate - 0.15, base_rate + 0.15), 0.05, 0.99)
```

Beta:

```text
raw ~ Beta(alpha, beta)
beta_mean = alpha / (alpha + beta)
sample = clip(base_rate * raw / beta_mean, 0.05, 0.99)
```

The default alpha 5, beta 2, normal standard deviation 0.08, uniform width
0.15, and clipping limits are model constants/defaults in code. No external
source is cited for them.

Run `i` uses cohort seed `seed + i` and its sampled rates as authoritative
per-course pass rates. The simulation horizon remains Cohort Flow's default
14 terms.

#### C. Aggregation

All graduation durations from every run are pooled into one list. Statistics
are calculated over graduates, not over runs and not over all introduced
students:

- mean;
- median;
- population standard deviation;
- NumPy P25/P50/P75/P90;
- percentage at most 8, 9–10, and at least 11 terms;
- a duration histogram.

`pct_withdrawn` is different: it is the arithmetic mean of Cohort Flow's
run-level `withdrawn_pct`, whose denominator is terminal outcomes. The
identical `pct_never_graduate` field is retained as a compatibility alias even
though it does not include still-enrolled students and therefore does not
literally mean every non-graduate.

`per_run_avg` is calculated inside the function but is not returned or used.

#### D. Sensitivity

The HTTP endpoint always uses ten runs per course and at most 40 students.
First, ten unchanged cohort runs are pooled to get `baseline_mean`. If there
are no graduates, the fallback is 8.0 terms.

For every course:

```text
reduced_rate = max(0.05, base_rate * 0.9)
delta = pooled_reduced_mean - baseline_mean
sensitivity_score =
  max(0, delta / (base_rate * 0.1))
```

If a reduced scenario has no graduates, its mean is set equal to the baseline
mean. Negative deltas are clipped to zero. The maximum score is labeled the
most influential course.

### 5.4 Enrollment Forecast

#### A. Annual projection formulas

For current enrollment `C`, annual rate `g`, and year `t`:

Linear:

```text
E(t) = max(0, C + C * g * t)
```

Exponential:

```text
E(t) = max(0, C * (1 + g)^t)
```

Positive logistic:

```text
K = 3C
t0 = ln(K / C - 1) / g = ln(2) / g
E(t) = K / (1 + exp(-g(t - t0)))
```

This construction passes through `E(0) = C`. The carrying capacity `3C` is an
internal assumption. For `g = 0`, the result is constant. For negative
logistic growth, the code uses bounded compound contraction
`max(0, C(1 + g)^t)` because a positive carrying-capacity curve is not used for
decline.

#### B. Converting annual growth to cohort intakes

The real year-level population is scaled approximately to
`current_enrollment`. The horizon is:

```text
max_terms = 2 * (years + 1)
```

Term 1 and term 2 are treated as the current academic year already represented
by the existing population. Later even terms receive zero Spring intake.
For later odd Fall terms:

```text
year_index = (term - 1) // 2
scale = projection[year_index] / current_enrollment
Fall intake = round(scaled_year_one_population * scale)
```

The resulting schedule is sent to Cohort Flow with fixed seed 42 and fixed
starting term `Fall 2024`.

#### C. Capacity signals

Only required courses are evaluated. For every course:

```text
seats = section_capacity * sections_offered
eligible demand =
  students registered in Cohort Flow
  + students eligible but denied a seat in Cohort Flow
```

The first term where `demand > seats` becomes that course's one signal.
Signals are sorted by earliest term, then descending gap, then course code.
The output identifies a current shortfall when the signal year is zero and
forecast pressure otherwise.

If seats are zero, any positive demand is flagged and a data issue is returned.
No recommendation is produced.

### 5.5 Structural validation

`validate_program` checks:

- prerequisite cycles with NetworkX;
- duplicated or missing required-course codes;
- negative credits, capacity, or section counts;
- invalid pass-rate types/ranges;
- missing prerequisite/corequisite course references;
- elective categories with no options;
- elective credit requirements greater than available option credits;
- exact equality between required-course credits plus required elective
  credits and the program total;
- required roadmap-term loads over 21 credits as a warning;
- prerequisites positioned in the same or a later roadmap term as a warning.

Only the Cohort Flow HTTP endpoint invokes this validator before simulation.
The official CS and CE data pass without critical findings. The validation
warning threshold of 21 credits is separate from the simulation's 18-credit
registration maximum.

## 6. Data model and provenance

There is no database. Committed JSON is loaded from disk, and one optional
ignored JSON file stores runtime overrides.

### 6.1 Program objects

`data/programs/cs.json` and `ce.json` are complete runtime definitions.

| Program | Required credits | Required courses | Elective categories | Elective options | Total course objects | Roadmap columns |
|---|---:|---:|---:|---:|---:|---:|
| CS | 120 | 37 | 1 | 17 | 54 | 8 |
| CE | 128 | 39 | 1 | 16 | 55 | 8 |

Top-level fields include:

- `program_id`, `program_name`, `college`;
- `total_credits_required`;
- `required_courses`;
- `elective_categories` with name, required credits, and options;
- `courses`;
- `roadmap`;
- `data_notes`.

Each course object contains:

- code and name;
- credits;
- prerequisite and corequisite code arrays;
- Fall/Spring offering array;
- per-section capacity and sections offered;
- year level and semester position;
- required/elective flag;
- description;
- pass rate and pass-rate source;
- shared-course metadata where applicable.

The runtime model contains four CS package placeholders and one CE package
placeholder for general-education categories. They are catalog anchor
representations rather than selections among every possible package course.

### 6.2 Shared courses

`data/shared_courses.json` contains 29 courses present in both program files.
At load time its operational fields overwrite the matching copies in each
program:

- name;
- credits;
- pass rate and source;
- section capacity;
- sections offered;
- offered terms.

The build script pools the two separately calibrated pass-rate estimates by
arithmetic mean. If the old CS and CE capacity estimates differ, it keeps the
copy with the larger total seat pool; it does not add both pools. Shared
courses are still simulated separately inside a CS-only or CE-only run. There
is no combined CS+CE seat competition.

### 6.3 Assumptions

`data/assumptions.json` contains:

- 80 course/scope records;
- 240 course-field records;
- two program-level records.

Course fields are pass rate, per-section capacity, and sections offered, with
value, source, reasoning, and confidence. Shared courses use one
`department.CODE` record. The two program-level records are:

- assumed on-time baselines: CS 0.64 and CE 0.58, low confidence;
- real derived enrollment CAGRs: CS 0.272 and CE 0.137, high confidence.

The on-time baseline values are not runtime inputs to the engines. They were
used to calibrate generated pass-rate assumptions.

### 6.4 Simulation defaults

`data/simulation_defaults.json` stores:

- nominal Cohort Flow defaults;
- Bottleneck reduction options;
- Monte Carlo defaults;
- enrollment current totals, annual rates, and models;
- real 2021–2022 existing year-level populations;
- the two reference baseline metrics.

Not every stored default controls every frontend. For example, the Monte Carlo
file says 1,000 runs while the current screen initially requests 300.

### 6.5 Raw and source files

| File | Current content/use |
|---|---|
| `data/source_documents/catalog.pdf` | 16.1 MB QU Undergraduate Catalog 2026–2027; source for program requirements, credits, descriptions, prerequisites, and study plans |
| `data/source_documents/cs_roadmap.png` | 2024 CS visual roadmap |
| `data/source_documents/ce_roadmap.png` | 2024 CE visual roadmap |
| `data/source_documents/qu_logo.png` | Source logo; the frontend uses a separate favicon copy |
| `data/raw/catalog_fulltext.txt` | 2.55 MB catalog text extraction |
| `data/raw/course_descriptions_cmps_cmpe_elec.txt` | 145 KB focused course-description extraction |
| `data/raw/enrollment_real_data.json` | CS/CE enrollment by year level, totals, degrees awarded for 2017–2018 through 2021–2022, derived CAGRs, and university-wide 150%-duration graduation rates |
| `data/sources.json` | Six source records, retrieval dates, extraction notes, web URLs, search notes, unavailable data, and a summary note |

The source manifest states that the PDF was converted with `pypdf`, but
`pypdf` is not a runtime dependency and the current application does not parse
the PDF at startup.

### 6.6 Data generation

`data/build_programs.py` hardcodes the extracted CS and CE course/program
records, writes the two program JSON files, and generates the shared-course
catalog. Its important transformations are:

1. Set course data such as credits, prerequisites, roadmap positions, and
   descriptions from the catalog/roadmap extraction.
2. Assign assumed initial capacities, sections, and pass rates.
3. Replace named pass rates from a hardcoded target table.
4. Add a flat empirical bump of 0.08 to CS target rates and 0.14 to CE target
   rates, capped at 0.98. The comments state these values were selected by
   simulation sweeps to approach the illustrative 0.64/0.58 on-time
   baselines and roughly 9.2 terms. The sweep is not reproducible from the
   current repository alone.
5. Normalize every required course against a reference cohort of 100:
   - most required courses target at least `int(100 * 1.3) = 130` total seats
     by increasing whole section counts;
   - seven courses target `int(100 * 1.08) = 108` seats, forced to three
     sections and per-section capacity `ceil(108 / 3) = 36`.
6. Leave elective capacity unnormalized.
7. Harmonize the 29 shared operational records.

The seven deliberately tighter courses are:

```text
CMPS303, CMPS323, CMPS405, CMPE355, CMPE261, CMPE363, CMPE364
```

This is a workaround for assumed small general-education/support capacities
dominating the first-term bottleneck results. It also intentionally makes the
named technical courses more likely to bind under the analysis sliders.
Consequently, the bottleneck ranking is partly shaped by generated capacity
assumptions rather than observed section data.

`data/build_assumptions.py` scans the generated program/shared files and writes
the override catalog. It classifies a hardcoded set as difficult and another
set as high-pass/general education to choose rationale and confidence text.

### 6.7 Runtime loading and overrides

Raw program JSON is cached once per process in `_program_cache`. Every caller
gets a deep copy, preventing one simulation from mutating the cache. Shared
course JSON and runtime overrides are read again on each program load.
`simulation_defaults.json` is cached after its first load.

`data/overrides.json` is absent in this snapshot. When created, it contains
only merged operational overrides. Department overrides are applied first and
program overrides second. The file is ignored by Git.

Writes use direct `json.dump` to the final path. There is no temporary-file
rename, lock, transaction, user identity, or conflict control between
processes.

## 7. LLM integration

### 7.1 Provider and model

- Provider: Groq
- API style: OpenAI-compatible chat completions
- Base URL: `https://api.groq.com/openai/v1`
- Endpoint: `/chat/completions`
- Model: `llama-3.3-70b-versatile`
- Credential: `GROQ_API_KEY`

The key is read into a module-level constant when `agent.py` is imported.
Changing the environment variable after the server has started does not update
the running process.

### 7.2 Prompt construction

The fixed system prompt instructs the model to:

- explain inputs, outputs, comparisons, and limitations;
- call a simulation tool for hypothetical questions;
- avoid fabricated numbers;
- separate observed inputs from simulated outputs;
- avoid policies, priorities, prescriptions, and recommendations;
- keep responses concise.

The outgoing message list is:

1. fixed system prompt;
2. every client-provided conversation-history item;
3. the current request message.

`simulation_context` is not inserted directly into the prompt. The model can
receive it only by calling `get_current_simulation_state`.

The current frontend builds `conversation_history` after appending the current
user message and also sends that same content as `message`. The backend then
appends `message` again. Therefore the current user message is duplicated in
the Groq prompt.

### 7.3 Available tools

| Tool | Returned information |
|---|---|
| `run_cohort_simulation` | Cohort summary using real population defaults |
| `find_bottlenecks` | Top bottlenecks and analysis metadata |
| `run_monte_carlo` | Monte Carlo statistics only; no sensitivity matrix |
| `run_enrollment_forecast` | First ten capacity signals, summary, and resolved parameters |
| `get_current_simulation_state` | The exact optional browser-provided simulation context |
| `get_program_data` | Program name, credits, course count, and required codes |
| `compare_programs` | Default CS and CE Cohort Flow summaries |

Tool schemas constrain the model at the provider level, but `_execute_tool`
does not instantiate the API's Pydantic request models. It reads fields with
defaults and catches all tool exceptions into `{"error":"..."}`.

### 7.4 Response and tool-call loop

HTTPX uses a synchronous client with a 60-second timeout. Up to four
assistant/tool rounds are allowed. A Groq response can contain multiple tool
calls; each is executed sequentially and appended as a `tool` message. Invalid
JSON tool arguments are replaced with `{}`.

When the model stops calling tools, the backend returns its content plus the
tool names/arguments. If any tool ran, `sources` contains only the generic
string `QU Academic Simulator internal simulation engine`; it does not cite a
specific file or source record. After four unfinished tool rounds, a fixed
failure message is returned.

There is:

- no application-level rate limiter;
- no retry or exponential backoff;
- no response cache;
- no streaming;
- no token-budget setting;
- no server-side chat persistence;
- no moderation layer;
- no explicit validation of the Groq response schema before indexing
  `choices[0]`.

The synchronous external request and any synchronous simulation tools occupy
the handling worker until completion.

## 8. Notable engineering details

### Deterministic paired randomness

The attempt-level BLAKE2b key is the central technical decision that makes
Bottleneck Analysis a paired experiment. A capacity change can alter who takes
a course and when, but it does not silently change an already matched
student's outcome for the same numbered attempt.

### Shared-course canonicalization

The loader overlays one operational record onto shared CS/CE curriculum
references, and the override model collapses matching legacy per-program
values. This prevents the same course from having different capacity/pass-rate
values merely because two degree JSON files reference it.

### Cache isolation

Program source JSON is cached for load performance, then deep-copied before
shared values, overrides, or simulation changes are applied. Bottleneck
scenarios also deep-copy a program before changing one course.

### Stale-response handling

Bottleneck and Enrollment Forecast assign increasing request IDs and ignore
responses from older requests. Their UIs also hide results after controls no
longer match the submitted configuration. The bottleneck capacity slider adds
a 450 ms debounce.

Cohort Flow does not use a request sequence; its buttons are disabled while a
run is active.

### Frontend loading and bundle control

Every route component is lazy-loaded. PDF dependencies are dynamically
imported only when PDF export is selected. Vite's chunk warning threshold is
raised to 650 KB because the lazy PDF chunk is approximately 600 KB in the
current build.

### Export behavior

CSV is generated entirely in the browser with Papa Parse. JSON override export
is a formatted browser download. PDF export renders the selected DOM subtree at
2× scale into one tall image, then places shifted copies of that image across
A4 pages. This preserves the screen appearance but can split a card or row at
an arbitrary page boundary.

### Validation and filesystem safety

Program IDs are restricted before a program filename is constructed. The SPA
file-serving route verifies that a requested file remains inside
`frontend/dist`. Critical prerequisite/data validation is run before direct
Cohort Flow API execution.

### Error handling

The frontend API wrapper extracts common FastAPI error shapes, dispatches a
global `qu:api-error` event, and throws. `App.jsx` displays the message for 6.5
seconds. An Error Boundary replaces a route after an uncaught render error.

The fetch error fallback first tries `res.json()` and then `res.text()` on the
same response. If JSON parsing consumes a non-JSON body before failing, the
text fallback may itself be empty or unavailable.

### Accessibility and responsive behavior

The shell includes a mobile drawer, keyboard focus outlines, a reduced-motion
media query, a 320 px minimum width, and a global typography floor that raises
utility sizes originally declared as 9–13 px. Tooltips currently open on mouse
hover only and have no focus/click behavior.

### Test coverage

The backend tests cover:

- official program structural validity;
- deterministic same-seed results and population conservation;
- per-course pass-rate precedence;
- seasonal course offerings and Spring-start Fall intakes;
- separate failure/withdrawal thresholds;
- request bounds;
- shared-course canonical values and overrides;
- legacy override collapsing/conflict rejection;
- bounded zero/negative logistic growth;
- zero-capacity bottleneck harm direction;
- cohort-derived enrollment signals;
- Monte Carlo withdrawal output;
- core API smoke behavior, validation errors, and API 404 behavior.

There are no frontend component tests, browser tests, LLM mocked-contract
tests, load tests, or concurrency tests.

## 9. Known limitations, hardcoded behavior, and unused code

### Data and model validity

- Per-course pass rates, capacities, and section counts are assumed, not
  observed QU operational data.
- Pass rates were empirically calibrated toward assumed program-level targets.
  Bottleneck capacities were also deliberately shaped by the data generator.
- Existing students have synthetic completed-course histories unless the
  caller uses the roster API field. The current frontend has no roster import.
- The withdrawal thresholds, 18-credit limit, 3× enrollment ceiling,
  Monte Carlo distributions, and sensitivity normalization have no cited
  institutional or statistical source in the repository.
- General-education packages are placeholder anchor course objects, not full
  student choice models.
- A shared course has one canonical record, but CS and CE students never
  compete for its seats in one combined run.

### Cohort Flow

- “On-track” means registered for at least one course this term, not on pace
  for eight-term completion. “Delayed” means active with no registration in
  the current term.
- The completion bar denominator is every student introduced so far, not
  eligible students or course takers.
- Outcome percentages use only terminal students, so a short horizon can make
  the percentages look favorable while many students remain active.
- `starting_term` is not schema-validated. Any value not beginning with
  “spring” is treated as a Fall start.
- Same-term corequisites depend on course iteration order. A corequisite that
  appears later in the sorted course list is not yet in
  `registering_this_term`, so one direction of a corequisite pair can be
  prevented even though both could theoretically be taken together.
- The roster structure is untyped beyond being a list. Supplied IDs are
  ignored and impossible prerequisite histories are accepted.
- An actual enrollment correction changes the number of eligible students
  admitted but cannot identify the real registered students.
- `consecutive_stuck_terms` retains its name but has no escalating effect.
- `stuck_points` remains in the API and AI context even though no dedicated
  stuck-points graph is rendered.
- The summary can contain `null` duration/course fields when no student
  graduates or no course has attempts; the frontend interpolates some of
  these directly into labels.

### Bottleneck Analysis

- Every course is tested, not just required courses. Electives and package
  placeholders can appear in evidence and ranking.
- The structural graph ignores corequisites.
- Rounding a small percentage reduction can leave a small original capacity
  unchanged.
- The result is conditional on the synthetic population, assumed capacity,
  pass rates, horizon, and only three frontend seeds.
- The frontend's path shows required downstream courses, while the backend
  `downstream_count` includes every descendant. The two displayed concepts can
  therefore differ.
- The single-course slider can increase capacity as well as reduce it, but the
  wording still presents the page primarily as a stress reduction.

### Monte Carlo

- A requested population above 40 changes neither the repeated-run population
  nor the sensitivity population; it is capped for performance.
- Graduation statistics pool individual graduates, giving runs with more
  graduates more weight.
- Students still enrolled at the horizon are absent from graduation-duration
  statistics.
- If a sensitivity reduction produces no graduates, its mean is set to the
  baseline mean, so a catastrophic no-graduate case can receive a zero score.
- Negative sensitivity deltas are clipped to zero.
- Beta sampling is scaled to the base mean before clipping; clipping changes
  the final mean and shape, especially near high base pass rates.
- `per_run_avg` is unused.
- `pct_never_graduate` is a misleading compatibility alias for withdrawal
  percentage.
- The frontend numeric Beta controls have no client-side min/max attributes;
  invalid values are rejected only by the API.

### Enrollment Forecast

- The chart is a formula applied to one current value and one rate; it is not
  fitted to the stored historical series.
- The positive logistic carrying capacity is hardcoded to 3× current
  enrollment.
- Course signals use one fixed seed (42), one Fall 2024 calendar start, assumed
  capacities, and a synthetic scaled population.
- Only required courses are tested.
- Only the first excess-demand term per course is returned; later recurrence
  and total unmet demand are not summarized.
- The projection affects Fall intake, not the already existing population,
  and Spring intake is always zero.

### State, persistence, and concurrency

- There is no saved simulation history and no simulation database.
- The latest simulation and chat conversation disappear on reload.
- Runtime overrides are global to the server, unauthenticated, and editable by
  any client with API access.
- Override writes are neither atomic nor locked. Concurrent writers can lose
  updates or read a partially written file.
- Render's free service filesystem does not make the ignored override file a
  durable data store across service replacement/redeploy.
- CPU-intensive simulation routes and the Groq call are synchronous. A single
  worker can be occupied for the full calculation/request duration.
- There is no cancellation of a backend calculation when the browser ignores
  a stale response.

### API and frontend behavior

- Only Cohort Flow invokes full program structural validation.
- No output response schemas are declared, so accidental response-shape
  changes are not validated by FastAPI.
- CORS allows only the two local Vite origins. Other separate frontend origins
  are rejected unless served same-origin from FastAPI.
- Static SPA routes are registered only if `frontend/dist` exists when
  `main.py` is imported.
- The home screen is an introduction, not a live dashboard and not a
  simulation summary.
- Data Override uses browser `alert`/`confirm`, not in-page status UI.
- Tooltips are hover-only.
- The PDF exporter can split content at arbitrary page boundaries.

### LLM

- The feature is unavailable without a valid Groq key and internet access.
- The current user message is duplicated in the prompt by the frontend/backend
  history construction.
- External failures have no retry, backoff, graceful provider-specific
  translation, or circuit breaker.
- There is no rate limiting, response cache, streaming, moderation, or
  server-side conversation state.
- Context is only visible to the model if it chooses the current-state tool.
- Tool errors are returned to the model as strings; they are not surfaced as a
  structured user-facing API error.
- The generic `sources` string does not identify which data file or source
  record supported an answer.
- Speech recognition is not supported in every browser. Speech synthesis has
  no cancellation or queue-management UI.

## 10. Recommended report screenshots

All URLs below assume the standard local launcher at
`http://localhost:8001`. Tab selections are not represented in the URL, so the
required click is stated where applicable.

| # | View | Exact route / URL | What it demonstrates |
|---:|---|---|---|
| 1 | Simulator Home | `http://localhost:8001/` | Retained scope, four simulation types, and the data/assumption workflow |
| 2 | Cohort Roadmap Flow | `http://localhost:8001/cohort` | Term controls, seat-utilization colors, completion bars, real-population intake editor, and roadmap structure |
| 3 | Cohort live adjustment panel | `http://localhost:8001/cohort` then open **Adjust from here** | Cumulative capacity/rate changes and one-term actual-registration correction |
| 4 | Cohort Term Progression | `http://localhost:8001/cohort` then select **Term Progression** | Mutually exclusive active/terminal status series over time |
| 5 | Cohort Summary Statistics | `http://localhost:8001/cohort` then select **Summary Statistics** | Terminal-denominator outcomes, duration measures, and course attempt summaries |
| 6 | Bottleneck ranked evidence | `http://localhost:8001/bottleneck` | Paired harm bars, seed range, selected-course evidence, and structural path |
| 7 | Bottleneck single-course comparison | `http://localhost:8001/bottleneck` with a course selected and the capacity slider changed | Baseline/tested metrics and causal what-if evidence |
| 8 | Monte Carlo | `http://localhost:8001/monte-carlo` | Graduation histogram, CS/CE box plot, sensitivity, and pooled summary statistics |
| 9 | Enrollment Forecast | `http://localhost:8001/enrollment-forecast` | Mathematical growth curve, cohort-derived capacity signals, and evidence counts |
| 10 | Data provenance or override | `http://localhost:8001/about-data` or `http://localhost:8001/data-override` | Published sources versus assumptions, confidence labels, and the supported override schema |
