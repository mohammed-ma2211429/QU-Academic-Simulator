# Qatar University Academic Simulator

A faculty-facing decision-support simulator for Qatar University's Computer
Science (CS) and Computer Engineering (CE) programs. It models how existing and
future students move through the curriculum, where limited seats create delays,
how uncertainty changes outcomes, and how enrollment growth affects future
course demand.

The simulator is explanatory, not prescriptive. It reports model evidence and
assumptions; it does not make planning recommendations.

## Live demo and links

| | |
|---|---|
| Live app | <https://qu-academic-simulator.onrender.com> |
| Source code | <https://github.com/mohammed-ma2211429/QU-Academic-Simulator> |
| Companion project: Schedule Planner (live) | <https://qu-schedule-planner.vercel.app> |
| Companion project: Schedule Planner (code) | <https://github.com/mohammed-ma2211429/QU-chatbot> |
| Author | Mohammed Mansib Shahriyar Alam, <https://github.com/mohammed-ma2211429> |
| Portfolio | <https://mansib.pages.dev> |

The live app runs on Render's free plan, so the first request after a period
of inactivity can take up to a minute while the service wakes up. The AI
Planning Assistant is off in the hosted copy unless a `GROQ_API_KEY` is set in
Render's environment; every simulation works without it.

Technical write-up: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start on Windows

1. Double-click `Start App.bat`.
2. Wait for the frontend build and server startup to finish.
3. Open <http://localhost:8001>.
4. Keep the terminal window open while using the simulator. Press `Ctrl+C` in
   that window to stop it.

The launcher deliberately rebuilds the frontend before starting the server, so
it cannot serve an older copy of the interface.

### First-time setup

Install Python 3.12+, Node.js, and npm, then run:

```powershell
python -m pip install -r backend\requirements.txt
cd frontend
npm install
```

The AI Planning Assistant also requires a Groq API key. All simulations work
without it:

```powershell
$env:GROQ_API_KEY = "your_key_here"
```

## Development

Run the backend from one terminal:

```powershell
cd backend
python -m uvicorn main:app --reload --port 8001
```

Run the frontend from another:

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the backend on port
8001.

## Verification

Run the same checks used to validate the repository:

```powershell
cd frontend
npm run lint
npm run build

cd ..\backend
python -m unittest discover -s tests -v
```

## Retained screens

| Route | Purpose |
|---|---|
| `/` | Simulator Home: an introduction to the tool, evidence, and workflow |
| `/cohort` | Term-by-term movement of existing and incoming students |
| `/bottleneck` | Paired simulations measuring the harm caused by a capacity cut |
| `/monte-carlo` | Repeated simulations showing the range of uncertain outcomes |
| `/enrollment-forecast` | Growth projections plus cohort-derived course-demand signals |
| `/data-override` | Replace assumed pass rates and capacities with department data |
| `/about-data` | Sources, assumptions, confidence, and model transparency |
| `/chat` | AI explanation of the current simulation and available evidence |

There is no saved simulation history or database. The latest successful
simulation is kept in browser memory so the AI Assistant can explain matching
results during the current session.

## Data and modeling

Degree requirements, prerequisites, credit hours, and study plans come from the
QU Undergraduate Catalog 2026-2027 and official program roadmaps in
`data/source_documents/`. The repository also records public program enrollment
and graduation data in `data/raw/`.

Per-course pass rates, section capacities, and section counts are not published
by QU. They are documented assumptions in `data/assumptions.json`. Faculty can
replace them in Data Override; runtime overrides are saved to
`data/overrides.json`, which is intentionally ignored by Git.

Important interpretation rules:

- A valid per-course pass rate is used first. The global Cohort Flow pass rate
  is only a fallback when a course has no valid individual value.
- Bottleneck Analysis compares the same synthetic students with and without a
  capacity reduction across multiple seeds.
- Enrollment Forecast derives required-course demand from Cohort Flow
  eligibility and registration results, not from a fixed enrollment fraction.
- Monte Carlo uses a scaled representative population so repeated uncertainty
  runs remain practical.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the implementation details
and known limitations.

## Repository structure

```text
QU-Academic-Simulator/
|-- backend/
|   |-- chatbot/             AI assistant integration
|   |-- simulation/          Models and simulation engines
|   `-- tests/               Backend regression/API tests
|-- data/
|   |-- programs/            Runtime CS and CE definitions
|   |-- raw/                 Extracted/public source data
|   `-- source_documents/    Catalog, roadmaps, and source logo
|-- docs/                    Technical documentation
|-- frontend/
|   |-- public/              Browser favicon
|   `-- src/                 React pages, components, context, and utilities
|-- Start App.bat            Windows build-and-run launcher
`-- render.yaml              Render deployment blueprint
```

## Production and deployment

Build the SPA and run FastAPI as one process:

```powershell
cd frontend
npm ci
npm run build
cd ..\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

`backend/main.py` serves `frontend/dist` and the API. `render.yaml` implements
the same architecture on Render. The hosted copy is at
<https://qu-academic-simulator.onrender.com>; to deploy your own, push the repo
to GitHub, then in Render choose New, then Blueprint, and select it.

Render's free-plan filesystem is ephemeral. A saved `data/overrides.json` can
be lost after redeploy or service replacement; committed program/source data is
unaffected.

## Regenerating program data

After intentionally changing source assumptions or extraction logic:

```powershell
python data\build_programs.py
python data\build_assumptions.py
```
