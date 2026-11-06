"""Structural validation for academic program definitions."""
from __future__ import annotations

from typing import Dict, List

import networkx as nx

from .bottleneck import build_prereq_graph


def validate_program(program: dict) -> List[dict]:
    """Return structural errors and warnings for a program definition."""
    issues = []
    graph = build_prereq_graph(program)

    try:
        cycle = nx.find_cycle(graph)
        issues.append({
            "severity": "critical",
            "message": f"Circular prerequisite dependency detected: {' -> '.join(a for a, b in cycle)} -> {cycle[0][0]}",
        })
    except nx.NetworkXNoCycle:
        pass

    course_codes = set(program["courses"])
    required_courses = program.get("required_courses", [])
    duplicate_required = sorted({code for code in required_courses if required_courses.count(code) > 1})
    if duplicate_required:
        issues.append({
            "severity": "critical",
            "message": f"Required-course list contains duplicates: {', '.join(duplicate_required)}.",
        })
    for code in required_courses:
        if code not in course_codes:
            issues.append({
                "severity": "critical",
                "message": f"Required course {code} does not exist in the course catalog.",
            })

    for code, course in program["courses"].items():
        if course.get("credits", 0) < 0:
            issues.append({"severity": "critical", "message": f"{code} has negative credit hours."})
        if course.get("section_capacity", 0) < 0 or course.get("sections_offered", 0) < 0:
            issues.append({"severity": "critical", "message": f"{code} has negative capacity or section count."})
        pass_rate = course.get("pass_rate")
        if pass_rate is not None and (
            not isinstance(pass_rate, (int, float)) or not 0 <= pass_rate <= 1
        ):
            issues.append({"severity": "critical", "message": f"{code} pass rate must be between 0 and 1."})
        for prerequisite in course.get("prerequisites", []):
            if prerequisite not in program["courses"]:
                issues.append({
                    "severity": "critical",
                    "message": f"{code} lists prerequisite {prerequisite}, which does not exist in this program.",
                })
        for corequisite in course.get("corequisites", []):
            if corequisite not in program["courses"]:
                issues.append({
                    "severity": "critical",
                    "message": f"{code} lists corequisite {corequisite}, which does not exist in this program.",
                })

    for category in program.get("elective_categories", []):
        missing_options = [code for code in category.get("options", []) if code not in course_codes]
        if missing_options:
            issues.append({
                "severity": "critical",
                "message": (
                    f"Elective category {category.get('name', 'Unnamed')} contains unknown course(s): "
                    f"{', '.join(missing_options)}."
                ),
            })
        available_credits = sum(
            program["courses"][code].get("credits", 0)
            for code in category.get("options", [])
            if code in course_codes
        )
        if category.get("credits_required", 0) > available_credits:
            issues.append({
                "severity": "critical",
                "message": (
                    f"Elective category {category.get('name', 'Unnamed')} requires "
                    f"{category.get('credits_required', 0)} CH but offers only {available_credits} CH."
                ),
            })

    required_credits = sum(
        program["courses"][code].get("credits", 0)
        for code in dict.fromkeys(required_courses)
        if code in course_codes
    )
    elective_credits = sum(
        category.get("credits_required", 0)
        for category in program.get("elective_categories", [])
    )
    curriculum_credits = required_credits + elective_credits
    stated_credits = program.get("total_credits_required", curriculum_credits)
    if curriculum_credits != stated_credits:
        issues.append({
            "severity": "critical",
            "message": (
                f"Degree requires {stated_credits} CH, but required courses plus elective "
                f"requirements account for {curriculum_credits} CH."
            ),
        })

    term_credits: Dict[int, int] = {}
    for course in program["courses"].values():
        if course["is_required"]:
            position = course["semester_position"]
            term_credits[position] = term_credits.get(position, 0) + course["credits"]
    for term, total in term_credits.items():
        if total > 21:
            issues.append({
                "severity": "warning",
                "message": f"Term {term} carries {total} required credit hours, exceeding the 21 CH overload threshold.",
            })

    for code, course in program["courses"].items():
        for prerequisite in course.get("prerequisites", []):
            if (
                prerequisite in program["courses"]
                and program["courses"][prerequisite]["semester_position"] >= course["semester_position"]
                and prerequisite != code
            ):
                issues.append({
                    "severity": "warning",
                    "message": (
                        f"{code} (term {course['semester_position']}) requires prerequisite "
                        f"{prerequisite}, which is scheduled at term "
                        f"{program['courses'][prerequisite]['semester_position']} -- not strictly earlier."
                    ),
                })

    return issues
