"""Regression tests for the simulator's core decision logic.

Run from backend/ with:
    python -m unittest discover -s tests -v
"""
from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

import main
from simulation import models
from simulation.bottleneck import single_course_what_if
from simulation.cohort import default_intake_schedule, run_cohort_simulation
from simulation.enrollment_forecast import project_enrollment, run_enrollment_forecast
from simulation.models import (
    CohortSimRequest,
    DataOverrideRequest,
    get_shared_course_catalog,
    load_program,
)
from simulation.monte_carlo import run_monte_carlo
from simulation.validation import validate_program


def tiny_program(*, offered_terms=None, sections=1):
    return {
        "program_id": "tiny",
        "program_name": "Tiny Test Program",
        "total_credits_required": 3,
        "required_courses": ["A"],
        "elective_categories": [],
        "roadmap": {"Term 1": ["A"]},
        "courses": {
            "A": {
                "code": "A",
                "name": "Course A",
                "credits": 3,
                "prerequisites": [],
                "corequisites": [],
                "offered_terms": offered_terms or ["Fall", "Spring"],
                "section_capacity": 200,
                "sections_offered": sections,
                "year_level": 1,
                "semester_position": 1,
                "is_required": True,
                "pass_rate": 1.0,
            }
        },
    }


class CohortEngineTests(unittest.TestCase):
    def test_official_programs_are_structurally_valid(self):
        for program_id in ("cs", "ce"):
            with self.subTest(program=program_id):
                issues = validate_program(load_program(program_id, apply_overrides=False))
                self.assertFalse([issue for issue in issues if issue["severity"] == "critical"])

    def test_same_seed_is_deterministic_and_conserves_population(self):
        program = load_program("cs", apply_overrides=False)
        params = {
            "existing_population": {1: 12, 2: 8, 3: 6, 4: 4},
            "intake_schedule": {term: 0 for term in range(2, 11)},
            "max_terms": 10,
            "seed": 9,
        }
        first = run_cohort_simulation(program, **params)
        second = run_cohort_simulation(program, **params)
        self.assertEqual(first, second)

        summary = first["summary"]
        self.assertEqual(
            summary["graduated_count"]
            + summary["withdrawn_count"]
            + summary["still_enrolled_count"],
            summary["cohort_size"],
        )
        terminal_pct = sum(
            summary[key]
            for key in (
                "on_time_pct",
                "delay_1_pct",
                "delay_2_pct",
                "delay_3plus_pct",
                "withdrawn_pct",
            )
        )
        self.assertAlmostEqual(terminal_pct, 100, delta=0.2)
        for stats in first["course_stats"].values():
            self.assertLessEqual(stats["unique_attempted"], stats["total_enrolled"])

    def test_course_pass_rate_wins_and_global_rate_is_fallback(self):
        program = tiny_program()
        params = {
            "existing_population": {1: 100, 2: 0, 3: 0, 4: 0},
            "new_entrants_per_intake": 0,
            "max_terms": 1,
            "seed": 4,
        }
        low = run_cohort_simulation(program, pass_rate=0.10, **params)
        high = run_cohort_simulation(program, pass_rate=0.99, **params)
        self.assertEqual(low["summary"]["graduated_count"], high["summary"]["graduated_count"])

        program["courses"]["A"].pop("pass_rate")
        fallback_low = run_cohort_simulation(program, pass_rate=0.10, **params)
        fallback_high = run_cohort_simulation(program, pass_rate=0.99, **params)
        self.assertLess(
            fallback_low["summary"]["graduated_count"],
            fallback_high["summary"]["graduated_count"],
        )

    def test_course_offering_season_is_enforced(self):
        program = tiny_program(offered_terms=["Fall"])
        params = {
            "existing_population": {1: 1, 2: 0, 3: 0, 4: 0},
            "new_entrants_per_intake": 0,
            "starting_term": "Spring 2026",
            "seed": 1,
        }
        spring_only = run_cohort_simulation(program, max_terms=1, **params)
        through_fall = run_cohort_simulation(program, max_terms=2, **params)
        self.assertEqual(spring_only["summary"]["graduated_count"], 0)
        self.assertEqual(through_fall["summary"]["graduated_count"], 1)

    def test_fall_intakes_follow_a_spring_starting_term(self):
        schedule = default_intake_schedule(100, 0, 4, "Spring 2026")
        self.assertEqual(schedule, {2: 100, 3: 0, 4: 100})

        result = run_cohort_simulation(
            tiny_program(offered_terms=["Fall"]),
            existing_population={1: 1, 2: 0, 3: 0, 4: 0},
            new_entrants_per_intake=3,
            starting_term="Spring 2026",
            max_terms=2,
            seed=1,
        )
        self.assertEqual(result["per_term_stats"][1]["new_entrants_this_term"], 3)

    def test_program_withdrawal_counts_failures_not_all_attempts(self):
        program = tiny_program()
        program["courses"]["A"]["pass_rate"] = 0
        params = {
            "existing_population": {1: 1, 2: 0, 3: 0, 4: 0},
            "new_entrants_per_intake": 0,
            "rate_schedule": {
                1: {"fail_rate": 0, "withdraw_rate": 1},
                3: {"fail_rate": 1, "withdraw_rate": 0},
            },
            "seed": 1,
        }

        after_two_withdrawals_and_two_failures = run_cohort_simulation(
            program, max_terms=4, **params
        )
        self.assertEqual(after_two_withdrawals_and_two_failures["summary"]["withdrawn_count"], 0)

        after_two_withdrawals_and_four_failures = run_cohort_simulation(
            program, max_terms=6, **params
        )
        self.assertEqual(after_two_withdrawals_and_four_failures["summary"]["withdrawn_count"], 1)

    def test_request_models_reject_invalid_values(self):
        with self.assertRaises(ValidationError):
            CohortSimRequest(pass_rate=1.1)
        with self.assertRaises(ValidationError):
            CohortSimRequest(existing_population={1: -1})
        with self.assertRaises(ValidationError):
            CohortSimRequest(seed=-1)
        with self.assertRaises(ValidationError):
            CohortSimRequest(seed=4_294_967_296)


class SupportingEngineTests(unittest.TestCase):
    def test_shared_courses_have_one_canonical_operational_record(self):
        shared = get_shared_course_catalog()
        self.assertIn("MATH101", shared)
        self.assertEqual(set(shared["MATH101"]["programs"]), {"cs", "ce"})

        cs_math = load_program("cs", apply_overrides=False)["courses"]["MATH101"]
        ce_math = load_program("ce", apply_overrides=False)["courses"]["MATH101"]
        for field in ("pass_rate", "section_capacity", "sections_offered", "offered_terms"):
            self.assertEqual(cs_math[field], ce_math[field])
            self.assertEqual(cs_math[field], shared["MATH101"][field])

    def test_department_override_applies_to_both_program_references(self):
        override_path = str(Path(__file__).with_name(".test_overrides.json"))
        try:
            with patch.object(models, "OVERRIDES_PATH", override_path):
                models.save_overrides({
                    "department": {
                        "MATH101": {
                            "pass_rate": 0.87,
                            "section_capacity": 55,
                            "sections_offered": 3,
                        }
                    }
                })
                for program_id in ("cs", "ce"):
                    course = load_program(program_id)["courses"]["MATH101"]
                    self.assertEqual(course["pass_rate"], 0.87)
                    self.assertEqual(course["section_capacity"], 55)
                    self.assertEqual(course["sections_offered"], 3)

                with open(override_path, encoding="utf-8") as f:
                    saved = json.load(f)
                self.assertEqual(list(saved), ["department"])
        finally:
            if os.path.exists(override_path):
                os.remove(override_path)

    def test_legacy_shared_overrides_are_collapsed_and_conflicts_rejected(self):
        request = DataOverrideRequest(overrides={
            "cs": {"MATH101": {"section_capacity": 45}},
            "ce": {"MATH101": {"section_capacity": 45}},
        })
        self.assertIsNotNone(request)

        with self.assertRaises(ValidationError):
            DataOverrideRequest(overrides={
                "cs": {"MATH101": {"section_capacity": 45}},
                "ce": {"MATH101": {"section_capacity": 60}},
            })

    def test_logistic_zero_and_negative_growth_are_bounded(self):
        self.assertEqual(project_enrollment(500, 0, "logistic", 2), [500.0, 500.0, 500.0])
        declining = project_enrollment(500, -0.1, "logistic", 3)
        self.assertEqual(declining[0], 500)
        self.assertTrue(all(a >= b >= 0 for a, b in zip(declining, declining[1:])))

    def test_zero_capacity_is_not_reported_as_an_improvement(self):
        result = single_course_what_if(
            tiny_program(),
            "A",
            0,
            cohort_size=20,
            seed=1,
            n_seeds=2,
            max_terms=8,
        )
        changes = result["changes"]
        self.assertGreater(changes["students_harmed_mean"], 0)
        self.assertLess(changes["graduates_change_mean"], 0)
        self.assertEqual(changes["students_improved_mean"], 0)
        self.assertNotIn("narrative", result)

    def test_enrollment_forecast_uses_cohort_capacity_signals(self):
        program = tiny_program()
        program["courses"]["A"]["section_capacity"] = 5
        result = run_enrollment_forecast(
            program,
            current_enrollment=20,
            growth_rate=0,
            model="linear",
            years=1,
        )
        self.assertEqual(result["capacity_summary"]["demand_method"], "cohort_eligibility_and_registration")
        self.assertEqual(result["capacity_signals"][0]["course"], "A")
        self.assertEqual(result["capacity_signals"][0]["gap"], 15)
        self.assertNotIn("recommendations", result)

    def test_monte_carlo_reports_withdrawal_risk(self):
        result = run_monte_carlo(
            load_program("cs", apply_overrides=False),
            cohort_size=20,
            n_runs=3,
            seed=4,
        )
        stats = result["statistics"]
        self.assertIn("pct_withdrawn", stats)
        self.assertEqual(stats["pct_withdrawn"], stats["pct_never_graduate"])
        self.assertGreaterEqual(stats["pct_withdrawn"], 0)
        self.assertLessEqual(stats["pct_withdrawn"], 100)

class ApiContractTests(unittest.TestCase):
    client = TestClient(main.app)

    def test_core_api_smoke(self):
        programs_response = self.client.get("/api/programs")
        self.assertEqual(programs_response.status_code, 200)
        self.assertEqual(
            {program["program_id"] for program in programs_response.json()["programs"]},
            {"cs", "ce"},
        )
        self.assertEqual(self.client.get("/api/data/assumptions").status_code, 200)
        self.assertEqual(self.client.get("/api/data/overrides").status_code, 200)
        assumptions = self.client.get("/api/data/assumptions").json()
        self.assertIn("department.MATH101", assumptions)
        self.assertNotIn("cs.MATH101", assumptions)
        self.assertNotIn("ce.MATH101", assumptions)

        response = self.client.post(
            "/api/simulate/cohort",
            json={
                "program": "cs",
                "cohort_size": 10,
                "max_terms": 10,
                "existing_population": {"1": 6, "2": 4, "3": 3, "4": 2},
                "intake_schedule": {str(term): 0 for term in range(2, 11)},
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("summary", response.json())
        self.assertIn("course_stats", response.json())

    def test_invalid_api_inputs_return_validation_errors(self):
        response = self.client.post(
            "/api/simulate/cohort",
            json={"program": "cs", "pass_rate": 2},
        )
        self.assertEqual(response.status_code, 422)

    def test_unknown_api_route_never_falls_back_to_the_spa(self):
        response = self.client.get("/api/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.headers["content-type"], "application/json")


if __name__ == "__main__":
    unittest.main()
