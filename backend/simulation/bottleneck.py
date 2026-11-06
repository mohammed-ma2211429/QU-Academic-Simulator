"""Capacity stress testing built on the cohort-flow simulation.

Each tested course is compared with an unchanged baseline using the same
student/course/attempt outcome draws. Results are reported as factual paired
changes, not as recommendations or opaque composite scores.
"""
from __future__ import annotations

import copy
import statistics
from typing import Dict, Iterable, Optional

import networkx as nx

from .cohort import run_cohort_simulation
from .models import resolve_population_params

DEFAULT_MAX_TERMS = 14
DEFAULT_N_SEEDS = 3


def build_prereq_graph(program: dict) -> nx.DiGraph:
    graph = nx.DiGraph()
    for code in program["courses"]:
        graph.add_node(code)
    for code, course in program["courses"].items():
        for prerequisite in course["prerequisites"]:
            if prerequisite in program["courses"]:
                graph.add_edge(prerequisite, code)
    return graph


def _rounded_mean(values: Iterable[float], digits: int = 2) -> float:
    values = list(values)
    return round(statistics.fmean(values), digits) if values else 0.0


def _aggregate_summary(results: list[dict]) -> dict:
    """Average numeric summary fields across seeds while preserving nulls."""
    keys = set().union(*(result["summary"].keys() for result in results))
    summary = {}
    for key in keys:
        values = [
            result["summary"].get(key)
            for result in results
            if isinstance(result["summary"].get(key), (int, float))
        ]
        if not values:
            summary[key] = None
            continue
        # Counts remain interpretable as expected counts, so they are rounded
        # to one decimal rather than forced back to an integer.
        summary[key] = _rounded_mean(values, 1)
    return summary


def _compare_runs(baseline: dict, tested: dict, course_code: str) -> dict:
    """Compare the same student IDs in two simulations."""
    baseline_students = baseline["student_outcomes"]
    tested_students = tested["student_outcomes"]
    student_ids = set(baseline_students) | set(tested_students)

    delayed = improved = newly_unfinished = newly_graduated = 0
    for student_id in student_ids:
        before = baseline_students.get(student_id, {})
        after = tested_students.get(student_id, {})
        before_graduated = before.get("status") == "graduated"
        after_graduated = after.get("status") == "graduated"

        if before_graduated and not after_graduated:
            newly_unfinished += 1
        elif not before_graduated and after_graduated:
            newly_graduated += 1
        elif before_graduated and after_graduated:
            before_duration = before.get("duration_terms")
            after_duration = after.get("duration_terms")
            if after_duration > before_duration:
                delayed += 1
            elif after_duration < before_duration:
                improved += 1

    baseline_summary = baseline["summary"]
    tested_summary = tested["summary"]
    baseline_course = baseline["course_stats"][course_code]
    tested_course = tested["course_stats"][course_code]
    baseline_average = baseline_summary.get("avg_graduation_term")
    tested_average = tested_summary.get("avg_graduation_term")

    return {
        "students_harmed": delayed + newly_unfinished,
        "students_delayed": delayed,
        "newly_unfinished": newly_unfinished,
        "students_improved": improved + newly_graduated,
        "graduated_newly": newly_graduated,
        "graduates_change": (
            tested_summary["graduated_count"] - baseline_summary["graduated_count"]
        ),
        "still_enrolled_change": (
            tested_summary["still_enrolled_count"] - baseline_summary["still_enrolled_count"]
        ),
        "withdrawn_change": (
            tested_summary["withdrawn_count"] - baseline_summary["withdrawn_count"]
        ),
        "on_time_population_pp_change": (
            tested_summary["on_time_population_pct"]
            - baseline_summary["on_time_population_pct"]
        ),
        "avg_graduation_term_change": (
            (tested_average - baseline_average)
            if tested_average is not None and baseline_average is not None
            else 0.0
        ),
        "tested_course_waitlist_change": (
            tested_course["total_waitlisted"] - baseline_course["total_waitlisted"]
        ),
    }


def _aggregate_comparisons(comparisons: list[dict]) -> dict:
    aggregated = {}
    for key in comparisons[0]:
        values = [comparison[key] for comparison in comparisons]
        aggregated[f"{key}_mean"] = _rounded_mean(values, 2)
        aggregated[f"{key}_min"] = round(min(values), 2)
        aggregated[f"{key}_max"] = round(max(values), 2)
    return aggregated


def _run(
    program: dict,
    *,
    cohort_size: int,
    seed: int,
    max_terms: int,
    existing_population: dict | None,
    growth_rate: float | None,
) -> dict:
    return run_cohort_simulation(
        program,
        cohort_size=cohort_size,
        seed=seed,
        max_terms=max_terms,
        existing_population=existing_population,
        growth_rate=growth_rate,
        include_student_outcomes=True,
    )


def run_bottleneck_analysis(
    program: dict,
    capacity_reduction: float = 0.20,
    specific_overrides: Optional[Dict[str, int]] = None,
    cohort_size: int = 300,
    seed: int = 42,
    max_terms: int = DEFAULT_MAX_TERMS,
    n_seeds: int = DEFAULT_N_SEEDS,
) -> dict:
    """Stress each course independently and rank the paired student impact."""
    existing_population, growth_rate = resolve_population_params(
        program.get("program_id", ""), None, None, target_scale=cohort_size
    )
    graph = build_prereq_graph(program)
    seeds = [seed + offset for offset in range(n_seeds)]
    baselines = [
        _run(
            program,
            cohort_size=cohort_size,
            seed=run_seed,
            max_terms=max_terms,
            existing_population=existing_population,
            growth_rate=growth_rate,
        )
        for run_seed in seeds
    ]

    candidate_codes = list(program["courses"])
    if specific_overrides:
        candidate_codes = list(specific_overrides)
        unknown = [code for code in candidate_codes if code not in program["courses"]]
        if unknown:
            raise ValueError(f"Unknown course override(s): {', '.join(unknown)}")

    course_impacts = {}
    for code in candidate_codes:
        course = program["courses"][code]
        tested_capacity = (
            specific_overrides[code]
            if specific_overrides and code in specific_overrides
            else max(0, round(course["section_capacity"] * (1 - capacity_reduction)))
        )
        tested_program = copy.deepcopy(program)
        tested_program["courses"][code]["section_capacity"] = tested_capacity

        comparisons = []
        for run_seed, baseline in zip(seeds, baselines):
            tested = _run(
                tested_program,
                cohort_size=cohort_size,
                seed=run_seed,
                max_terms=max_terms,
                existing_population=existing_population,
                growth_rate=growth_rate,
            )
            comparisons.append(_compare_runs(baseline, tested, code))

        impact = {
            "code": code,
            "name": course["name"],
            "downstream_count": len(nx.descendants(graph, code)),
            "original_capacity": course["section_capacity"],
            "tested_capacity": tested_capacity,
            "sections_offered": course["sections_offered"],
            **_aggregate_comparisons(comparisons),
        }
        course_impacts[code] = impact

    ranked = sorted(
        course_impacts.values(),
        key=lambda item: (
            -item["students_harmed_mean"],
            -item["newly_unfinished_mean"],
            -item["tested_course_waitlist_change_mean"],
            -item["downstream_count"],
            item["code"],
        ),
    )

    return {
        "baseline_summary": _aggregate_summary(baselines),
        "top_bottlenecks": ranked[:10],
        "course_impacts": course_impacts,
        "analysis_meta": {
            "capacity_reduction_tested": capacity_reduction,
            "cohort_size": cohort_size,
            "seed_start": seed,
            "n_seeds": n_seeds,
            "max_terms": max_terms,
            "comparison_method": "paired_student_outcomes",
        },
    }


def single_course_what_if(
    program: dict,
    course_code: str,
    new_capacity: int,
    cohort_size: int = 300,
    seed: int = 42,
    max_terms: int = DEFAULT_MAX_TERMS,
    n_seeds: int = DEFAULT_N_SEEDS,
) -> dict:
    """Compare one per-section capacity value with the unchanged baseline."""
    existing_population, growth_rate = resolve_population_params(
        program.get("program_id", ""), None, None, target_scale=cohort_size
    )
    original_capacity = program["courses"][course_code]["section_capacity"]
    sections_offered = program["courses"][course_code]["sections_offered"]
    tested_program = copy.deepcopy(program)
    tested_program["courses"][course_code]["section_capacity"] = new_capacity

    baseline_runs = []
    tested_runs = []
    comparisons = []
    for run_seed in (seed + offset for offset in range(n_seeds)):
        baseline = _run(
            program,
            cohort_size=cohort_size,
            seed=run_seed,
            max_terms=max_terms,
            existing_population=existing_population,
            growth_rate=growth_rate,
        )
        tested = _run(
            tested_program,
            cohort_size=cohort_size,
            seed=run_seed,
            max_terms=max_terms,
            existing_population=existing_population,
            growth_rate=growth_rate,
        )
        baseline_runs.append(baseline)
        tested_runs.append(tested)
        comparisons.append(_compare_runs(baseline, tested, course_code))

    return {
        "course_code": course_code,
        "original_capacity": original_capacity,
        "tested_capacity": new_capacity,
        "sections_offered": sections_offered,
        "baseline_summary": _aggregate_summary(baseline_runs),
        "tested_summary": _aggregate_summary(tested_runs),
        "changes": _aggregate_comparisons(comparisons),
        "analysis_meta": {
            "cohort_size": cohort_size,
            "seed_start": seed,
            "n_seeds": n_seeds,
            "max_terms": max_terms,
            "comparison_method": "paired_student_outcomes",
        },
    }
