"""Monte Carlo simulation (T3.4): runs the cohort model many times with
per-course pass rates resampled from a distribution each run, then reports
the resulting graduation-time distribution, percentiles, and a per-course
sensitivity analysis (how much a 10% pass-rate drop in each course shifts
the mean graduation time).
"""
from __future__ import annotations

import statistics
from typing import Dict, List

import numpy as np

from .cohort import run_cohort_simulation
from .models import resolve_population_params

FALLBACK_PASS_RATE = 0.75


def _course_pass_rate(course: dict) -> float:
    rate = course.get("pass_rate")
    if isinstance(rate, (int, float)) and 0 <= rate <= 1:
        return float(rate)
    return FALLBACK_PASS_RATE


def _scaled_population(program: dict, target_total: int):
    """Scale the real existing-population snapshot down proportionally to
    keep Monte Carlo's hundreds of repeated runs fast, while preserving the
    same relative year-level mix (and therefore the same overlapping-
    generations contention dynamic) as the real thing."""
    existing_population, growth_rate = resolve_population_params(program.get("program_id", ""), None, None)
    if not existing_population:
        return None, growth_rate
    real_total = sum(existing_population.values()) or 1
    factor = target_total / real_total
    scaled = {y: max(1, round(n * factor)) for y, n in existing_population.items()}
    return scaled, growth_rate


def _sample_rates(program: dict, distribution: str, rng: np.random.RandomState,
                   beta_alpha: float, beta_beta: float, normal_std: float) -> Dict[str, float]:
    sampled = {}
    for code, c in program["courses"].items():
        base = _course_pass_rate(c)
        if distribution == "beta":
            # Scale a Beta(alpha, beta) sample to center near the course's
            # base pass rate while preserving natural variance.
            raw = rng.beta(beta_alpha, beta_beta)
            sampled[code] = float(np.clip(base * (raw / (beta_alpha / (beta_alpha + beta_beta))), 0.05, 0.99))
        elif distribution == "uniform":
            sampled[code] = float(np.clip(rng.uniform(base - 0.15, base + 0.15), 0.05, 0.99))
        else:  # normal
            sampled[code] = float(np.clip(rng.normal(base, normal_std), 0.05, 0.99))
    return sampled


def run_monte_carlo(
    program: dict,
    cohort_size: int = 100,
    n_runs: int = 1000,
    distribution: str = "beta",
    beta_alpha: float = 5,
    beta_beta: float = 2,
    normal_std: float = 0.08,
    seed: int = 42,
) -> dict:
    rng = np.random.RandomState(seed)
    all_grad_terms: List[int] = []
    per_run_avg: List[float] = []
    per_run_withdrawn_pct: List[float] = []

    # Monte Carlo over the full real population is expensive at n_runs=1000+;
    # each run uses a smaller representative population (same year-level mix,
    # proportionally scaled) for speed while still producing a statistically
    # meaningful graduation-term distribution across all runs combined.
    sub_cohort = max(20, min(cohort_size, 40))
    scaled_population, growth_rate = _scaled_population(program, sub_cohort)

    for i in range(n_runs):
        run_seed = seed + i
        sampled_rates = _sample_rates(program, distribution, rng, beta_alpha, beta_beta, normal_std)
        per_course_params = {code: {"pass_rate": rate} for code, rate in sampled_rates.items()}
        result = run_cohort_simulation(
            program, cohort_size=sub_cohort, seed=run_seed, per_course_params=per_course_params,
            existing_population=scaled_population, growth_rate=growth_rate,
        )
        grads = result["graduation_distribution"]
        all_grad_terms.extend(grads)
        per_run_withdrawn_pct.append(result["summary"]["withdrawn_pct"])
        if grads:
            per_run_avg.append(statistics.mean(grads))

    def percentile(data, pct):
        if not data:
            return None
        arr = np.array(data)
        return float(np.percentile(arr, pct))

    histogram: Dict[int, int] = {}
    for t in all_grad_terms:
        histogram[t] = histogram.get(t, 0) + 1

    mean_grad = statistics.mean(all_grad_terms) if all_grad_terms else None
    std_grad = statistics.pstdev(all_grad_terms) if len(all_grad_terms) > 1 else 0

    pct_on_time = 100 * sum(1 for t in all_grad_terms if t <= 8) / max(1, len(all_grad_terms))
    pct_9_10 = 100 * sum(1 for t in all_grad_terms if 9 <= t <= 10) / max(1, len(all_grad_terms))
    pct_11plus = 100 * sum(1 for t in all_grad_terms if t >= 11) / max(1, len(all_grad_terms))
    mean_withdrawn_pct = (
        statistics.mean(per_run_withdrawn_pct) if per_run_withdrawn_pct else 0
    )

    statistics_out = {
        "mean_graduation_term": round(mean_grad, 2) if mean_grad is not None else None,
        "median_graduation_term": statistics.median(all_grad_terms) if all_grad_terms else None,
        "std_dev": round(std_grad, 2),
        "p25": round(percentile(all_grad_terms, 25), 2) if all_grad_terms else None,
        "p50": round(percentile(all_grad_terms, 50), 2) if all_grad_terms else None,
        "p75": round(percentile(all_grad_terms, 75), 2) if all_grad_terms else None,
        "p90": round(percentile(all_grad_terms, 90), 2) if all_grad_terms else None,
        "pct_on_time": round(pct_on_time, 1),
        "pct_9_to_10": round(pct_9_10, 1),
        "pct_11_plus": round(pct_11plus, 1),
        "pct_withdrawn": round(mean_withdrawn_pct, 1),
        # Kept as a compatibility alias for older saved/exported reports.
        "pct_never_graduate": round(mean_withdrawn_pct, 1),
        "n_runs": n_runs,
        "sub_cohort_size": sub_cohort,
    }

    return {
        "graduation_distribution": histogram,
        "raw_graduation_terms": all_grad_terms,
        "statistics": statistics_out,
        "percentiles": {
            "p25": statistics_out["p25"], "p50": statistics_out["p50"],
            "p75": statistics_out["p75"], "p90": statistics_out["p90"],
        },
    }


def run_sensitivity_analysis(program: dict, cohort_size: int = 60, seed: int = 42,
                              n_runs_per_course: int = 30) -> dict:
    """For each course, reduce its pass rate by 10% and measure the resulting
    shift in mean graduation time relative to baseline -- the "sensitivity
    heatmap" data for the Monte Carlo page."""
    scaled_population, growth_rate = _scaled_population(program, cohort_size)
    baseline_terms = []
    for i in range(n_runs_per_course):
        result = run_cohort_simulation(
            program, cohort_size=cohort_size, seed=seed + i,
            existing_population=scaled_population, growth_rate=growth_rate,
        )
        baseline_terms.extend(result["graduation_distribution"])
    baseline_mean = statistics.mean(baseline_terms) if baseline_terms else 8.0

    sensitivity = {}
    for code, c in program["courses"].items():
        base_rate = _course_pass_rate(c)
        reduced_rate = max(0.05, base_rate * 0.9)
        terms = []
        for i in range(n_runs_per_course):
            result = run_cohort_simulation(
                program, cohort_size=cohort_size, seed=seed + i,
                per_course_params={code: {"pass_rate": reduced_rate}},
                existing_population=scaled_population, growth_rate=growth_rate,
            )
            terms.extend(result["graduation_distribution"])
        mean_reduced = statistics.mean(terms) if terms else baseline_mean
        delta = mean_reduced - baseline_mean
        sensitivity_score = max(0, delta / (base_rate * 0.1)) if base_rate > 0 else 0
        sensitivity[code] = round(sensitivity_score, 4)

    most_influential = max(sensitivity.items(), key=lambda kv: kv[1]) if sensitivity else (None, 0)

    return {
        "baseline_mean_graduation_term": round(baseline_mean, 2),
        "sensitivity": sensitivity,
        "most_influential_course": most_influential[0],
        "most_influential_score": most_influential[1],
    }
