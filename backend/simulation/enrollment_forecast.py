"""Enrollment growth and course-capacity signal forecasting.

Program-level enrollment follows the selected growth curve. Course demand is
then derived from the cohort engine's term-by-term prerequisite eligibility,
registration, and waitlist results rather than assigning every course a fixed
one-eighth share of total enrollment.
"""
from __future__ import annotations

import math
from typing import List

from .cohort import run_cohort_simulation
from .models import resolve_population_params


def project_enrollment(current: int, growth_rate: float, model: str, years: int) -> List[float]:
    if current < 0:
        raise ValueError("current enrollment must be non-negative")
    if growth_rate < -1:
        raise ValueError("growth rate cannot be less than -100%")
    if years < 0:
        raise ValueError("forecast years must be non-negative")

    projections = []
    if model == "linear":
        annual_increment = current * growth_rate
        for t in range(years + 1):
            projections.append(max(0.0, current + annual_increment * t))
    elif model == "exponential":
        for t in range(years + 1):
            projections.append(max(0.0, current * (1 + growth_rate) ** t))
    elif model == "logistic":
        if current == 0:
            return [0.0] * (years + 1)
        if growth_rate == 0:
            return [float(current)] * (years + 1)
        if growth_rate < 0:
            # A carrying-capacity growth curve is not meaningful for decline;
            # use bounded compound contraction while retaining the user's
            # selected logistic model at non-negative growth.
            return [max(0.0, current * (1 + growth_rate) ** t) for t in range(years + 1)]

        # Logistic (S-curve) -- capacity ceiling assumed at 3x current enrollment.
        capacity = current * 3
        k = growth_rate
        # Solve for the curve midpoint t0 so the S-curve passes exactly
        # through (t=0, current) rather than an arbitrary offset.
        ratio = max(1e-6, capacity / current - 1)
        t0 = math.log(ratio) / k if k > 0 else 0
        for t in range(years + 1):
            projections.append(capacity / (1 + math.exp(-k * (t - t0))))
    else:
        raise ValueError(f"Unknown growth model: {model}")
    return projections


def run_enrollment_forecast(
    program: dict,
    current_enrollment: int,
    growth_rate: float,
    model: str = "logistic",
    years: int = 5,
) -> dict:
    projections = project_enrollment(current_enrollment, growth_rate, model, years)

    program_id = program.get("program_id", "")
    existing_population, _ = resolve_population_params(
        program_id,
        None,
        growth_rate,
        target_scale=current_enrollment,
    )
    existing_population = existing_population or {
        1: current_enrollment,
        2: 0,
        3: 0,
        4: 0,
    }

    # Term 1/2 represent the current academic year already captured by the
    # existing population. Each later Fall intake is scaled by the selected
    # total-enrollment curve; Spring intake remains zero.
    max_terms = 2 * (years + 1)
    base_year_one = existing_population.get(1, 0) or max(1, current_enrollment // 4)
    intake_schedule = {}
    for term in range(2, max_terms + 1):
        is_fall = term % 2 == 1
        if not is_fall:
            intake_schedule[term] = 0
            continue
        year_index = (term - 1) // 2
        scale = projections[year_index] / max(1, current_enrollment)
        intake_schedule[term] = max(0, round(base_year_one * scale))

    flow = run_cohort_simulation(
        program,
        cohort_size=max(1, base_year_one),
        max_terms=max_terms,
        seed=42,
        existing_population=existing_population,
        growth_rate=growth_rate,
        intake_schedule=intake_schedule,
        starting_term="Fall 2024",
    )

    capacity_signals = []
    data_issues = []
    for code, course in program["courses"].items():
        if not course["is_required"]:
            continue
        seats = int(course["section_capacity"] * course["sections_offered"])
        if seats <= 0:
            data_issues.append({
                "course": code,
                "message": "Recorded capacity is zero; every positive demand term is flagged.",
            })

        snapshots = flow["course_term_snapshots"][code]
        first_excess = next(
            (
                snapshot
                for snapshot in snapshots
                if snapshot["students_demanded_this_term"] > seats
            ),
            None,
        )
        if not first_excess:
            continue

        term = first_excess["term"]
        year = (term - 1) // 2
        season = "Fall" if term % 2 == 1 else "Spring"
        demand = first_excess["students_demanded_this_term"]
        capacity_signals.append({
            "term": term,
            "term_label": f"{'Current' if year == 0 else f'Year {year}'} {season}",
            "year": year,
            "course": code,
            "course_name": course["name"],
            "demand": demand,
            "seats_available": seats,
            "gap": demand - seats,
            "signal_type": "current_shortfall" if year == 0 else "forecast_pressure",
        })

    capacity_signals.sort(key=lambda item: (item["term"], -item["gap"], item["course"]))
    earliest_term = capacity_signals[0]["term"] if capacity_signals else None

    return {
        "projections": [
            {"year": i, "enrollment": round(v, 1)} for i, v in enumerate(projections)
        ],
        "capacity_signals": capacity_signals,
        "capacity_summary": {
            "required_courses_tested": sum(
                1 for course in program["courses"].values() if course["is_required"]
            ),
            "courses_exceeding_capacity": len(capacity_signals),
            "earliest_signal_term": earliest_term,
            "terms_simulated": max_terms,
            "demand_method": "cohort_eligibility_and_registration",
        },
        "data_issues": data_issues,
        "params": {
            "current_enrollment": current_enrollment,
            "growth_rate": growth_rate,
            "model": model,
            "years": years,
        },
    }
