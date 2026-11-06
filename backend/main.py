"""FastAPI application entrypoint for the QU Academic Simulator backend.

Run in development:  uvicorn main:app --reload --port 8001
In production, this also serves the built frontend (frontend/dist) as
static files so the whole app can be launched with a single command.
"""
from __future__ import annotations

import json
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from simulation.models import (
    CohortSimRequest, BottleneckRequest, MonteCarloRequest,
    EnrollmentForecastRequest, DataOverrideRequest,
    load_program, save_overrides, clear_overrides, get_overrides, list_program_ids,
    resolve_population_params, resolve_default_intake_schedule,
)
from simulation.cohort import run_cohort_simulation
from simulation.bottleneck import run_bottleneck_analysis, single_course_what_if
from simulation.monte_carlo import run_monte_carlo, run_sensitivity_analysis
from simulation.enrollment_forecast import run_enrollment_forecast
from simulation.validation import validate_program
from chatbot.agent import ChatRequest, handle_chat_message

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))

app = FastAPI(title="QU Academic Simulator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(FileNotFoundError)
async def file_not_found_handler(_request: Request, exc: FileNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

@app.get("/api/programs")
def get_programs():
    return {"programs": [load_program(pid) for pid in list_program_ids()]}


@app.get("/api/programs/{program_id}")
def get_program(program_id: str):
    try:
        return load_program(program_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Unknown program: {program_id}")


# ---------------------------------------------------------------------------
# Simulations
# ---------------------------------------------------------------------------

@app.post("/api/simulate/cohort")
def simulate_cohort(req: CohortSimRequest):
    program = load_program(req.program)
    issues = validate_program(program)
    critical = [issue for issue in issues if issue["severity"] == "critical"]
    if critical:
        raise HTTPException(400, {"message": "Program failed validation", "issues": critical})
    existing_population, growth_rate = resolve_population_params(
        req.program, req.existing_population, req.growth_rate
    )
    result = run_cohort_simulation(
        program, cohort_size=req.cohort_size, pass_rate=req.pass_rate, fail_rate=req.fail_rate,
        withdraw_rate=req.withdraw_rate, max_terms=req.max_terms, seed=req.seed,
        registration_priority=req.registration_priority, per_course_params=req.per_course_params,
        capacity_overrides=req.capacity_overrides, existing_population=existing_population,
        new_entrants_per_intake=req.new_entrants_per_intake, growth_rate=growth_rate, roster=req.roster,
        intake_schedule=req.intake_schedule, capacity_schedule=req.capacity_schedule,
        rate_schedule=req.rate_schedule, actual_enrollment=req.actual_enrollment,
        starting_term=req.starting_term,
    )
    return result


@app.get("/api/simulate/cohort/default-intake-schedule")
def default_intake_schedule_endpoint(
    program: str = "cs",
    max_terms: int = 14,
    starting_term: str = "Fall 2024",
):
    """Pre-fill values for the per-semester new-intake override table: what
    the simulation would use for each term out of the box (real growth rate,
    Fall-only), so faculty edit specific semesters instead of starting blank."""
    if not 1 <= max_terms <= 40:
        raise HTTPException(422, "max_terms must be between 1 and 40")
    return {"schedule": resolve_default_intake_schedule(program, max_terms, starting_term)}


@app.post("/api/simulate/bottleneck")
def simulate_bottleneck(req: BottleneckRequest):
    program = load_program(req.program)
    result = run_bottleneck_analysis(
        program, capacity_reduction=req.capacity_reduction, specific_overrides=req.specific_overrides,
        cohort_size=req.cohort_size, seed=req.seed, n_seeds=req.n_seeds,
        max_terms=req.max_terms,
    )
    return result


@app.post("/api/simulate/bottleneck/what-if")
def bottleneck_what_if(
    program: str,
    course_code: str,
    new_capacity: int,
    cohort_size: int = 300,
    seed: int = 42,
    n_seeds: int = 3,
    max_terms: int = 14,
):
    if (
        new_capacity < 0
        or cohort_size < 1
        or not 1 <= n_seeds <= 10
        or not 8 <= max_terms <= 24
    ):
        raise HTTPException(
            422,
            "new_capacity must be non-negative, cohort_size positive, "
            "n_seeds 1-10, and max_terms 8-24",
        )
    prog = load_program(program)
    if course_code not in prog["courses"]:
        raise HTTPException(404, f"Unknown course: {course_code}")
    return single_course_what_if(
        prog,
        course_code,
        new_capacity,
        cohort_size=cohort_size,
        seed=seed,
        n_seeds=n_seeds,
        max_terms=max_terms,
    )


@app.post("/api/simulate/monte-carlo")
def simulate_monte_carlo(req: MonteCarloRequest):
    program = load_program(req.program)
    result = run_monte_carlo(
        program, cohort_size=req.cohort_size, n_runs=req.n_runs, distribution=req.distribution,
        beta_alpha=req.beta_alpha, beta_beta=req.beta_beta, normal_std=req.normal_std, seed=req.seed,
    )
    sensitivity = run_sensitivity_analysis(program, cohort_size=min(req.cohort_size, 40), seed=req.seed, n_runs_per_course=10)
    return {**result, "sensitivity_matrix": sensitivity}


@app.post("/api/simulate/enrollment-forecast")
def simulate_enrollment_forecast(req: EnrollmentForecastRequest):
    program = load_program(req.program)
    defaults_path = os.path.join(DATA_DIR, "simulation_defaults.json")
    with open(defaults_path, encoding="utf-8") as f:
        defaults = json.load(f)
    prog_defaults = defaults["enrollment_forecast"].get(req.program, {})

    current_enrollment = (
        req.current_enrollment
        if req.current_enrollment is not None
        else prog_defaults.get("current_enrollment", 500)
    )
    growth_rate = req.growth_rate if req.growth_rate is not None else prog_defaults.get("annual_growth_rate", 0.1)

    result = run_enrollment_forecast(program, current_enrollment, growth_rate, req.model, req.years)
    return result


# ---------------------------------------------------------------------------
# Data / overrides
# ---------------------------------------------------------------------------

@app.get("/api/data/assumptions")
def get_assumptions():
    with open(os.path.join(DATA_DIR, "assumptions.json"), encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/data/sources")
def get_sources():
    with open(os.path.join(DATA_DIR, "sources.json"), encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/data/overrides")
def get_data_overrides():
    return get_overrides()


@app.post("/api/data/override")
def post_data_override(req: DataOverrideRequest):
    save_overrides(req.overrides)
    return {"status": "saved"}


@app.delete("/api/data/override")
def delete_data_overrides():
    clear_overrides()
    return {"status": "cleared"}


@app.post("/api/chatbot/message")
def chatbot_message(req: ChatRequest):
    return handle_chat_message(req)


# ---------------------------------------------------------------------------
# Static frontend (production)
# ---------------------------------------------------------------------------

FRONTEND_DIST = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Unknown API endpoint")

        candidate = os.path.abspath(os.path.join(FRONTEND_DIST, full_path))
        inside_dist = (
            os.path.commonpath([FRONTEND_DIST, candidate]) == FRONTEND_DIST
        )
        if full_path and inside_dist and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(
            os.path.join(FRONTEND_DIST, "index.html"),
            headers={"Cache-Control": "no-store, max-age=0"},
        )
