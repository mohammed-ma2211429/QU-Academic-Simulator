"""Shared Pydantic request/response models and program-data loading utilities
used by every simulation module and by main.py.
"""
from __future__ import annotations

import copy
import json
import os
import re
from typing import Dict, List, Optional, Literal

from pydantic import BaseModel, Field, model_validator

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
PROGRAMS_DIR = os.path.join(DATA_DIR, "programs")
OVERRIDES_PATH = os.path.join(DATA_DIR, "overrides.json")
SHARED_COURSES_PATH = os.path.join(DATA_DIR, "shared_courses.json")
DEPARTMENT_SCOPE = "department"

# ---------------------------------------------------------------------------
# Program data access
# ---------------------------------------------------------------------------

_program_cache: Dict[str, dict] = {}
_PROGRAM_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
_OVERRIDE_FIELDS = {"pass_rate", "section_capacity", "sections_offered"}
_SHARED_COURSE_FIELDS = {
    "name",
    "credits",
    "pass_rate",
    "pass_rate_source",
    "section_capacity",
    "sections_offered",
    "offered_terms",
}


def _validate_program_id(program_id: str) -> str:
    """Keep program file access inside data/programs and produce stable IDs."""
    if not _PROGRAM_ID_RE.fullmatch(program_id or ""):
        raise ValueError(
            "program_id must start with a letter or number and contain only "
            "letters, numbers, underscores, or hyphens (maximum 80 characters)"
        )
    return program_id


def _load_overrides() -> dict:
    if os.path.exists(OVERRIDES_PATH):
        with open(OVERRIDES_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def get_shared_course_catalog() -> dict:
    """Return the canonical operational records shared by CS and CE."""
    if not os.path.exists(SHARED_COURSES_PATH):
        return {}
    with open(SHARED_COURSES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _canonicalize_overrides(overrides: dict, reject_conflicts: bool = False) -> dict:
    """Move legacy per-program shared-course overrides to department scope.

    Older exports stored e.g. cs.MATH101 and ce.MATH101 separately. Accept
    those files for backwards compatibility, but collapse them to the single
    canonical course record. Conflicting values in one import are rejected
    because there is no truthful way to choose between them.
    """
    shared = get_shared_course_catalog()
    canonical: dict = {}

    for scope, courses in (overrides or {}).items():
        for code, fields in courses.items():
            target_scope = (
                DEPARTMENT_SCOPE
                if code in shared and scope in shared[code].get("programs", [])
                else scope
            )
            target = canonical.setdefault(target_scope, {}).setdefault(code, {})
            for field, value in fields.items():
                if reject_conflicts and field in target and target[field] != value:
                    raise ValueError(
                        f"Conflicting values supplied for shared course {code}.{field}; "
                        f"use one {DEPARTMENT_SCOPE}.{code} override"
                    )
                target[field] = value

    return {
        scope: courses
        for scope, courses in canonical.items()
        if courses
    }


def get_overrides() -> dict:
    """Return saved overrides using one scope for every shared course."""
    return copy.deepcopy(_canonicalize_overrides(_load_overrides()))


def list_program_ids() -> List[str]:
    ids = []
    for fname in os.listdir(PROGRAMS_DIR):
        if fname.endswith(".json"):
            ids.append(fname[:-5])
    return sorted(ids)


def load_program(program_id: str, apply_overrides: bool = True) -> dict:
    """Load a program JSON file, applying any saved data overrides.

    Always returns a fresh deep copy so callers cannot mutate cached data.
    """
    program_id = _validate_program_id(program_id)
    cache_key = program_id
    if cache_key not in _program_cache:
        path = os.path.join(PROGRAMS_DIR, f"{program_id}.json")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Unknown program_id: {program_id}")
        with open(path, encoding="utf-8") as f:
            _program_cache[cache_key] = json.load(f)

    program = copy.deepcopy(_program_cache[cache_key])
    shared_catalog = get_shared_course_catalog()
    for code, canonical in shared_catalog.items():
        if code not in program["courses"]:
            continue
        for field in _SHARED_COURSE_FIELDS:
            if field in canonical:
                program["courses"][code][field] = copy.deepcopy(canonical[field])
        program["courses"][code]["shared_course"] = True
        program["courses"][code]["shared_programs"] = canonical["programs"]
        program["courses"][code]["is_shared_with"] = [
            pid for pid in canonical["programs"] if pid != program_id
        ]

    if apply_overrides:
        overrides = _canonicalize_overrides(_load_overrides())
        department_overrides = overrides.get(DEPARTMENT_SCOPE, {})
        program_overrides = overrides.get(program_id, {})
        for code, fields in department_overrides.items():
            if code in program["courses"]:
                program["courses"][code].update(fields)
        for code, fields in program_overrides.items():
            if code in program["courses"]:
                program["courses"][code].update(fields)

    return program


def save_overrides(overrides: dict) -> None:
    existing = _canonicalize_overrides(_load_overrides())
    incoming = _canonicalize_overrides(overrides, reject_conflicts=True)
    for program_id, fields in incoming.items():
        existing.setdefault(program_id, {})
        for code, values in fields.items():
            existing[program_id].setdefault(code, {})
            existing[program_id][code].update(values)
    with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)


def clear_overrides() -> None:
    """Fully wipe all saved data overrides (used by the 'Reset to Defaults'
    action) -- unlike save_overrides, this does not merge."""
    if os.path.exists(OVERRIDES_PATH):
        os.remove(OVERRIDES_PATH)


_simulation_defaults_cache: Optional[dict] = None


def _load_simulation_defaults() -> dict:
    global _simulation_defaults_cache
    if _simulation_defaults_cache is None:
        with open(os.path.join(DATA_DIR, "simulation_defaults.json"), encoding="utf-8") as f:
            _simulation_defaults_cache = json.load(f)
    return _simulation_defaults_cache


def get_existing_population_default(program_id: str) -> Optional[Dict[int, int]]:
    """Real QU per-year headcounts for cs/ce; None for any other program_id
    (draft/custom programs are assumed to have no existing students yet)."""
    entry = _load_simulation_defaults().get("existing_population", {}).get(program_id)
    if not entry:
        return None
    return {int(k): v for k, v in entry.items() if k in ("1", "2", "3", "4")}


def get_growth_rate_default(program_id: str) -> Optional[float]:
    entry = _load_simulation_defaults().get("enrollment_forecast", {}).get(program_id)
    if not entry:
        return None
    return entry.get("annual_growth_rate")


def resolve_population_params(
    program_id: str,
    existing_population: Optional[Dict[int, int]],
    growth_rate: Optional[float],
    target_scale: Optional[int] = None,
) -> tuple:
    """Fill in real QU defaults for whichever ongoing-population parameters
    the caller didn't explicitly supply. Used by every endpoint that runs the
    cohort engine so 'no configuration needed' means 'realistic by default'.

    target_scale: when the population comes from the REAL DEFAULT (i.e. the
    caller didn't explicitly override it), proportionally scale it to roughly
    this total headcount. Real defaults are QU's full population
    (500-600+ students) -- fine for a single on-screen simulation, but far
    too slow to re-run dozens or hundreds of times (bottleneck analysis and
    Monte Carlo both re-run the engine repeatedly). An
    explicit professor-supplied existing_population is never rescaled --
    that's real data they intentionally provided.
    """
    was_explicit = existing_population is not None
    if existing_population is None:
        existing_population = get_existing_population_default(program_id)
    if growth_rate is None:
        growth_rate = get_growth_rate_default(program_id)

    if not was_explicit and existing_population and target_scale:
        real_total = sum(existing_population.values()) or 1
        factor = target_scale / real_total
        existing_population = {y: max(1, round(n * factor)) for y, n in existing_population.items()}

    return existing_population, growth_rate


def resolve_default_intake_schedule(
    program_id: str,
    max_terms: int,
    starting_term: str = "Fall 2024",
) -> Dict[int, int]:
    """The per-semester new-intake numbers the simulation would use out of
    the box for this program (real growth rate, Fall-only) -- used to
    pre-fill the faculty's editable per-semester schedule table with
    sensible, already-calibrated defaults instead of blanks."""
    from .cohort import default_intake_schedule, FALLBACK_GROWTH_RATE

    existing_population, growth_rate = resolve_population_params(program_id, None, None)
    base_year1_count = (existing_population or {}).get(1, 0) or 100
    effective_growth = FALLBACK_GROWTH_RATE if growth_rate is None else growth_rate
    return default_intake_schedule(base_year1_count, effective_growth, max_terms, starting_term)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

MAX_RANDOM_SEED = 4_294_967_295


class CohortSimRequest(BaseModel):
    program: str = Field(default="cs", pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
    cohort_size: int = Field(default=100, ge=1, le=5000)
    starting_term: str = "Fall 2024"
    pass_rate: float = Field(default=0.75, ge=0, le=1)
    fail_rate: float = Field(default=0.15, ge=0, le=1)
    withdraw_rate: float = Field(default=0.10, ge=0, le=1)
    max_terms: int = Field(default=14, ge=1, le=40)
    seed: int = Field(default=42, ge=0, le=MAX_RANDOM_SEED)
    registration_priority: Literal["random", "gpa", "credit-count"] = "credit-count"
    per_course_params: Optional[Dict[str, Dict[str, float]]] = None
    capacity_overrides: Optional[Dict[str, Dict[str, int]]] = None
    # Ongoing/steady-state population controls. Any left as None fall back to
    # real QU data (see get_existing_population_default / get_growth_rate_default
    # below) so the simulation is realistic with zero configuration, while
    # still letting faculty plug in their own real numbers.
    existing_population: Optional[Dict[int, int]] = None
    new_entrants_per_intake: Optional[int] = None
    growth_rate: Optional[float] = None
    roster: Optional[List[dict]] = None
    # Explicit {term_number: new_student_count} per semester -- lets faculty
    # set (or zero out) intake for any individual Fall or Spring term
    # instead of only a single annual Fall figure. Takes priority over
    # new_entrants_per_intake/growth_rate when supplied.
    intake_schedule: Optional[Dict[int, int]] = None
    # Live/interactive stepping controls -- let faculty adjust capacity,
    # fallback pass/fail/withdraw rates, and real observed enrollment while
    # stepping through the Roadmap Flow term by term, without leaving the
    # page for the Data Override panel. See run_cohort_simulation's
    # docstring in cohort.py for exact semantics (capacity_schedule and
    # rate_schedule are cumulative from the term they're set; actual_enrollment
    # is a one-time correction for a single term).
    capacity_schedule: Optional[Dict[int, Dict[str, Dict[str, int]]]] = None
    rate_schedule: Optional[Dict[int, Dict[str, float]]] = None
    actual_enrollment: Optional[Dict[int, Dict[str, int]]] = None

    @model_validator(mode="after")
    def validate_nested_parameters(self):
        if self.existing_population and any(value < 0 for value in self.existing_population.values()):
            raise ValueError("existing_population values must be non-negative")
        if self.new_entrants_per_intake is not None and self.new_entrants_per_intake < 0:
            raise ValueError("new_entrants_per_intake must be non-negative")
        if self.growth_rate is not None and self.growth_rate < -1:
            raise ValueError("growth_rate cannot be less than -1")
        if self.intake_schedule and any(term < 1 or value < 0 for term, value in self.intake_schedule.items()):
            raise ValueError("intake_schedule terms must be >= 1 and values must be non-negative")
        if self.actual_enrollment:
            for term, course_values in self.actual_enrollment.items():
                if term < 1 or any(value < 0 for value in course_values.values()):
                    raise ValueError("actual_enrollment terms must be >= 1 and values must be non-negative")
        if self.capacity_schedule:
            for term, course_values in self.capacity_schedule.items():
                if term < 1:
                    raise ValueError("capacity_schedule terms must be >= 1")
                for fields in course_values.values():
                    if any(value < 0 for value in fields.values()):
                        raise ValueError("scheduled capacities and section counts must be non-negative")
        if self.rate_schedule:
            allowed = {"pass_rate", "fail_rate", "withdraw_rate"}
            for term, fields in self.rate_schedule.items():
                if term < 1 or any(key not in allowed for key in fields):
                    raise ValueError("rate_schedule contains an invalid term or field")
                if any(value < 0 or value > 1 for value in fields.values()):
                    raise ValueError("scheduled rates must be between 0 and 1")
        return self


class BottleneckRequest(BaseModel):
    program: str = Field(default="cs", pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
    capacity_reduction: float = Field(default=0.20, ge=0, le=1)
    specific_overrides: Optional[Dict[str, int]] = None
    cohort_size: int = Field(default=300, ge=1, le=1000)
    seed: int = Field(default=42, ge=0, le=MAX_RANDOM_SEED)
    n_seeds: int = Field(default=3, ge=1, le=10)
    max_terms: int = Field(default=14, ge=8, le=24)

    @model_validator(mode="after")
    def validate_capacities(self):
        if self.specific_overrides and any(value < 0 for value in self.specific_overrides.values()):
            raise ValueError("specific capacity overrides must be non-negative")
        return self


class MonteCarloRequest(BaseModel):
    program: str = Field(default="cs", pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
    cohort_size: int = Field(default=100, ge=1, le=1000)
    n_runs: int = Field(default=1000, ge=1, le=5000)
    distribution: Literal["normal", "beta", "uniform"] = "beta"
    beta_alpha: float = Field(default=5, gt=0, le=100)
    beta_beta: float = Field(default=2, gt=0, le=100)
    normal_std: float = Field(default=0.08, ge=0, le=1)
    seed: int = Field(default=42, ge=0, le=MAX_RANDOM_SEED)


class EnrollmentForecastRequest(BaseModel):
    program: str = Field(default="cs", pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
    current_enrollment: Optional[int] = Field(default=None, ge=1, le=1_000_000)
    growth_rate: Optional[float] = Field(default=None, ge=-1, le=5)
    model: Literal["linear", "exponential", "logistic"] = "logistic"
    years: int = Field(default=5, ge=1, le=10)


class DataOverrideRequest(BaseModel):
    overrides: Dict[str, Dict[str, Dict[str, float]]]

    @model_validator(mode="after")
    def validate_overrides(self):
        canonical = _canonicalize_overrides(self.overrides, reject_conflicts=True)
        shared = get_shared_course_catalog()
        for scope, courses in canonical.items():
            _validate_program_id(scope)
            program = None if scope == DEPARTMENT_SCOPE else load_program(scope, apply_overrides=False)
            for code, fields in courses.items():
                if scope == DEPARTMENT_SCOPE:
                    if code not in shared:
                        raise ValueError(f"Unknown shared course {code!r}")
                elif code not in program["courses"]:
                    raise ValueError(f"Unknown course {code!r} for program {scope!r}")
                if any(field not in _OVERRIDE_FIELDS for field in fields):
                    raise ValueError(
                        f"Only {sorted(_OVERRIDE_FIELDS)} may be overridden"
                    )
                for field, value in fields.items():
                    if field == "pass_rate" and not 0 <= value <= 1:
                        raise ValueError("pass_rate overrides must be between 0 and 1")
                    if field in {"section_capacity", "sections_offered"} and (
                        value < 0 or not float(value).is_integer()
                    ):
                        raise ValueError(f"{field} overrides must be non-negative integers")
        return self
