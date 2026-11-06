"""Core cohort-flow simulation engine (T3.1).

Models an ONGOING, steady-state university, not a single fresh entering
class in an empty pipeline. At "term 1" (today), the program already has
real students enrolled at every year level, each with a plausible amount of
completed coursework for how far along they are. From term 1 onward, new
students keep entering at the start of each academic year (real historical
growth rate by default, or a faculty-supplied fixed number), and every
generation -- continuing and newly-entered alike -- competes for the same
course seats in the same term, which is what actually creates realistic
capacity contention.

This module is the workhorse reused by Bottleneck Analysis and Monte Carlo.
Those simulations call run_cohort_simulation with a modified program dict
and/or modified rate parameters.
"""
from __future__ import annotations

import hashlib
import random
import statistics
from typing import Dict, List, Optional

MAX_CREDITS_PER_TERM = 18
MAX_WITHDRAWALS_BEFORE_DROPOUT = 3
MAX_FAILS_BEFORE_DROPOUT = 4

# Terms-of-coursework-already-completed assumed for a student snapshotted at
# each official year level, used to backdate their entry_term. Year 1 means
# "just entering" (0 terms done), Year 2 means "finished year 1" (2 terms), etc.
TERMS_DONE_BY_YEAR = {1: 0, 2: 2, 3: 4, 4: 6}

# Fallback defaults for programs with no real enrollment data on file. They
# are treated as having no existing students yet and modest generic growth.
FALLBACK_EXISTING_POPULATION = {1: 0, 2: 0, 3: 0, 4: 0}
FALLBACK_GROWTH_RATE = 0.10


class Student:
    __slots__ = (
        "id", "completed", "attempts", "failures", "withdrawals", "credits_earned",
        "status", "graduated_term", "term_history", "consecutive_stuck_terms",
        "entry_term", "entry_year_level",
    )

    def __init__(self, sid, entry_term: int = 1, entry_year_level: int = 1):
        self.id = sid
        self.completed: set = set()
        self.attempts: Dict[str, int] = {}
        self.failures: Dict[str, int] = {}
        self.withdrawals: Dict[str, int] = {}
        self.credits_earned = 0
        self.status = "active"  # active | graduated | withdrawn | still_enrolled (set at horizon end)
        self.graduated_term: Optional[int] = None
        self.term_history: List[dict] = []
        self.consecutive_stuck_terms = 0
        self.entry_term = entry_term
        self.entry_year_level = entry_year_level

    def performance_score(self) -> float:
        total_attempts = sum(self.attempts.values())
        if total_attempts == 0:
            return 0.5
        first_try_passes = sum(1 for c in self.completed if self.attempts.get(c, 1) == 1)
        return first_try_passes / max(1, len(self.completed) or 1)

    def duration_terms(self, end_term: int) -> int:
        """How many terms (including any assumed prior history) this student
        has been enrolled by end_term, correctly accounting for students who
        already existed before simulation term 1."""
        return end_term - self.entry_term + 1


def _is_eligible(course_code: str, course: dict, student: Student, registering_this_term: set) -> bool:
    if course_code in student.completed:
        return False
    for p in course["prerequisites"]:
        if p not in student.completed:
            return False
    for co in course.get("corequisites", []):
        if co not in student.completed and co not in registering_this_term:
            return False
    return True


def _elective_credits_completed(program: dict, student: Student) -> Dict[str, int]:
    out = {}
    for cat in program["elective_categories"]:
        credits = sum(
            program["courses"][c]["credits"]
            for c in cat["options"]
            if c in student.completed
        )
        out[cat["name"]] = credits
    return out


def _build_elective_category_map(program: dict) -> Dict[str, str]:
    """code -> category name, for every course listed as an elective option."""
    mapping = {}
    for cat in program["elective_categories"]:
        for code in cat["options"]:
            mapping[code] = cat["name"]
    return mapping


def _has_graduated(program: dict, student: Student) -> bool:
    if student.credits_earned < program["total_credits_required"]:
        return False
    for req in program["required_courses"]:
        if req not in student.completed:
            return False
    elective_done = _elective_credits_completed(program, student)
    for cat in program["elective_categories"]:
        if elective_done.get(cat["name"], 0) < cat["credits_required"]:
            return False
    return True


def _normalize_rates(pass_rate: float, fail_rate: float, withdraw_rate: float) -> tuple:
    pass_rate = max(0.0, min(1.0, pass_rate))
    remaining = 1.0 - pass_rate
    denom = fail_rate + withdraw_rate
    if denom <= 0:
        return pass_rate, remaining, 0.0
    fail_p = remaining * (fail_rate / denom)
    withdraw_p = remaining * (withdraw_rate / denom)
    return pass_rate, fail_p, withdraw_p


def _outcome_draw(seed: int, student_id: int, course_code: str, attempt: int) -> float:
    """Return a stable pseudo-random draw for one student's course attempt.

    The draw is keyed to the student, course, and attempt rather than to the
    order in which the simulation happens to consume random numbers. This
    provides common random numbers for capacity comparisons: changing seats
    can change *who gets a course and when*, but it cannot silently change a
    student's outcome for the same numbered attempt.
    """
    key = f"{seed}:{student_id}:{course_code}:{attempt}".encode("utf-8")
    value = int.from_bytes(hashlib.blake2b(key, digest_size=8).digest(), "big")
    return value / 2**64


# ---------------------------------------------------------------------------
# Population construction
# ---------------------------------------------------------------------------

def _assumed_completed_for_year(program: dict, terms_done: int, rng: random.Random) -> set:
    """A plausible completed-course set for a student who is `terms_done`
    terms into the program, reusing the same on-pace-with-some-dropout model
    used by the cohort engine: required courses nominally scheduled before
    that point, with ~40% of students missing 1-3 of them."""
    courses = program["courses"]
    on_pace = [
        code for code, c in courses.items()
        if c["is_required"] and c["semester_position"] <= terms_done
    ]
    if terms_done <= 0:
        return set()
    completed = list(on_pace)
    if rng.random() < 0.4 and len(completed) > 3:
        for _ in range(rng.randint(1, 3)):
            if completed:
                completed.pop(rng.randrange(len(completed)))
    return _prerequisite_closed_completion(program, set(completed))


def _prerequisite_closed_completion(program: dict, completed: set) -> set:
    """Remove downstream courses whose prerequisites are absent.

    Synthetic snapshots may intentionally omit a few courses to represent
    students who are behind. Keeping a downstream course after randomly
    removing its prerequisite would create an impossible transcript and
    overstate that student's progress.
    """
    completed = {code for code in completed if code in program["courses"]}
    changed = True
    while changed:
        changed = False
        for code in tuple(completed):
            prerequisites = program["courses"][code].get("prerequisites", [])
            if any(prereq not in completed for prereq in prerequisites):
                completed.remove(code)
                changed = True
    return completed


def build_initial_population(program: dict, year_level_counts: Dict[int, int], seed: int) -> List[Student]:
    """Build the 'students already enrolled today' snapshot: real (or
    faculty-overridden) headcounts per year level, each assigned a plausible
    completed-course history and backdated entry_term."""
    rng = random.Random(seed)
    students: List[Student] = []
    sid = 0
    for year, count in sorted(year_level_counts.items()):
        terms_done = TERMS_DONE_BY_YEAR.get(int(year), 0)
        entry_term = 1 - terms_done
        for _ in range(int(count)):
            s = Student(sid, entry_term=entry_term, entry_year_level=int(year))
            s.completed = _assumed_completed_for_year(program, terms_done, rng)
            s.credits_earned = sum(program["courses"][c]["credits"] for c in s.completed if c in program["courses"])
            students.append(s)
            sid += 1
    return students


def build_population_from_roster(program: dict, roster: List[dict]) -> List[Student]:
    """Build the initial population from a real, faculty-provided per-student
    roster instead of the synthetic year-level snapshot. Rows use the shape
    [{student_id, completed, current_term}].
    """
    students: List[Student] = []
    for i, row in enumerate(roster):
        current_term = int(row.get("current_term", 1))
        entry_term = 1 - (current_term - 1)
        s = Student(i, entry_term=entry_term, entry_year_level=max(1, min(4, (current_term - 1) // 2 + 1)))
        s.completed = {c for c in row.get("completed", []) if c in program["courses"]}
        s.credits_earned = sum(program["courses"][c]["credits"] for c in s.completed)
        students.append(s)
    return students


def _intake_size(base_year1_count: int, growth_rate: float, intake_index: int, fixed_override: Optional[int]) -> int:
    if fixed_override is not None:
        return int(fixed_override)
    if base_year1_count <= 0:
        return 0
    # Logistic (S-curve), matching the Enrollment Forecast page's model --
    # NOT raw exponential compounding, which explodes unrealistically over a
    # multi-year horizon (a real 27%/yr CAGR cannot compound forever; QU's
    # facilities and admissions targets bound it well before then). Caps at
    # 3x the current year-1 intake size, same ceiling assumption used there.
    from .enrollment_forecast import project_enrollment
    projections = project_enrollment(base_year1_count, growth_rate, "logistic", intake_index)
    return max(0, round(projections[intake_index]))


def default_intake_schedule(
    base_year1_count: int,
    growth_rate: float,
    max_terms: int,
    starting_term: str = "Fall 2024",
) -> Dict[int, int]:
    """The intake count the simulation would use for every term 2..max_terms
    if no explicit per-semester schedule is supplied -- real growth rate,
    Fall-only (odd terms), Spring terms get 0. Used to pre-fill the faculty
    per-semester override table with sensible, already-calibrated numbers
    instead of blanks or zeros."""
    schedule: Dict[int, int] = {}
    intake_index = 0
    for term in range(2, max_terms + 1):
        if _term_season(starting_term, term) == "Fall":
            intake_index += 1
            schedule[term] = _intake_size(base_year1_count, growth_rate, intake_index, None)
        else:
            schedule[term] = 0
    return schedule


def _resolve_at_term(schedule: Optional[Dict[int, dict]], term: int, base: Optional[dict] = None) -> dict:
    """Merge every schedule entry at or before `term`, in term order, so a
    later edit that only sets one field (e.g. just pass_rate) doesn't erase
    a field set by an earlier edit (e.g. fail_rate) -- each entry is applied
    on top of the running merge, not treated as a full replacement. Used for
    "this setting is now in effect from this semester onward" schedules
    (capacity, global rates), as opposed to intake_schedule's one-off,
    non-cumulative per-term values."""
    merged = dict(base or {})
    if not schedule:
        return merged
    for t in sorted(int(k) for k in schedule.keys()):
        if t <= term:
            merged.update(schedule[t] if t in schedule else schedule[str(t)])
    return merged


def _course_capacity_at_term(
    capacity_schedule: Optional[Dict[int, Dict[str, Dict[str, int]]]],
    code: str,
    term: int,
    default_cap: int,
    default_sections: int,
) -> tuple:
    """Same cumulative resolution as _resolve_at_term, scoped to one course
    -- capacity_schedule is term -> course_code -> {section_capacity,
    sections_offered}, only the entries mentioning this specific course
    matter for it."""
    if not capacity_schedule:
        return default_cap, default_sections
    cap, sections = default_cap, default_sections
    for t in sorted(int(k) for k in capacity_schedule.keys()):
        if t > term:
            continue
        term_entry = capacity_schedule[t] if t in capacity_schedule else capacity_schedule[str(t)]
        course_entry = term_entry.get(code)
        if course_entry:
            cap = course_entry.get("section_capacity", cap)
            sections = course_entry.get("sections_offered", sections)
    return cap, sections


def _term_season(starting_term: str, term: int) -> str:
    """Return Fall/Spring for a one-based simulation term."""
    first = "Spring" if str(starting_term).strip().lower().startswith("spring") else "Fall"
    if term % 2 == 1:
        return first
    return "Fall" if first == "Spring" else "Spring"


# ---------------------------------------------------------------------------
# Main simulation
# ---------------------------------------------------------------------------

def run_cohort_simulation(
    program: dict,
    cohort_size: int = 100,
    pass_rate: float = 0.75,
    fail_rate: float = 0.15,
    withdraw_rate: float = 0.10,
    max_terms: int = 14,
    seed: int = 42,
    registration_priority: str = "credit-count",
    per_course_params: Optional[Dict[str, Dict[str, float]]] = None,
    capacity_overrides: Optional[Dict[str, Dict[str, int]]] = None,
    existing_population: Optional[Dict[int, int]] = None,
    new_entrants_per_intake: Optional[int] = None,
    growth_rate: Optional[float] = None,
    roster: Optional[List[dict]] = None,
    intake_schedule: Optional[Dict[int, int]] = None,
    capacity_schedule: Optional[Dict[int, Dict[str, Dict[str, int]]]] = None,
    rate_schedule: Optional[Dict[int, Dict[str, float]]] = None,
    actual_enrollment: Optional[Dict[int, Dict[str, int]]] = None,
    starting_term: str = "Fall 2024",
    include_student_outcomes: bool = False,
) -> dict:
    """Run one deterministic, ongoing-university simulation and return full
    results.

    existing_population: real (or overridden) headcount per year level
        {1: 172, 2: 148, 3: 124, 4: 104}. Defaults to all-zero (no existing
        students -- e.g. for a brand-new draft program) if not supplied.
    new_entrants_per_intake: fixed number of new students admitted at each
        subsequent Fall intake. If None, sized from growth_rate instead.
        Ignored if intake_schedule is set.
    growth_rate: annual growth applied to the year-1 headcount to size each
        subsequent intake. Ignored if new_entrants_per_intake or
        intake_schedule is set.
    roster: real per-student data (see build_population_from_roster) --
        when provided, replaces the synthetic existing_population snapshot
        entirely with real students' real completed-course history.
    intake_schedule: explicit {term_number: new_student_count} for every
        semester a faculty member wants to control individually (e.g. a
        one-off Spring intake, or a specific admissions target per term).
        Takes full priority over new_entrants_per_intake/growth_rate --
        terms not present in the dict get 0 new entrants that term.
    capacity_schedule: {term_number: {course_code: {section_capacity,
        sections_offered}}} -- unlike intake_schedule this is CUMULATIVE:
        once a course's capacity changes at term T, it stays changed for
        every term >= T until a later entry changes it again. Lets a
        faculty member say "capacity is 40 through Fall 2025, then 60 from
        Spring 2026 on" while stepping through the live simulation.
    rate_schedule: {term_number: {pass_rate, fail_rate, withdraw_rate}} --
        same cumulative resolution as capacity_schedule, but for the global
        rates (per_course_params still wins for any course it names).
    actual_enrollment: {term_number: {course_code: real_headcount}} --
        ground-truth override for a single (term, course): forces exactly
        that many students to register that one term (clamped to however
        many are actually eligible), instead of the capacity-derived seat
        count. Does not persist to later terms like capacity_schedule does
        -- it's a one-time correction for a semester that already happened.
    cohort_size: used only as the year-1 intake size when neither
        existing_population nor a real year-1 headcount is available (i.e.
        legacy/simple callers, or a from-scratch program with no history).
    """
    rng = random.Random(seed)
    per_course_params = per_course_params or {}
    capacity_overrides = capacity_overrides or {}
    growth_rate = FALLBACK_GROWTH_RATE if growth_rate is None else growth_rate

    if cohort_size < 1:
        raise ValueError("cohort_size must be at least 1")
    if max_terms < 1:
        raise ValueError("max_terms must be at least 1")

    if roster is not None:
        students = build_population_from_roster(program, roster)
        base_year1_count = new_entrants_per_intake or cohort_size
    else:
        year_counts = existing_population or dict(FALLBACK_EXISTING_POPULATION)
        year_counts = {int(k): v for k, v in year_counts.items()}
        if not any(year_counts.values()) and not existing_population:
            # Nothing supplied at all and no real data available -- fall back
            # to the old single-fresh-intake behavior so simple callers (unit
            # tests, brand-new draft programs) still get a sensible result.
            year_counts = {1: cohort_size, 2: 0, 3: 0, 4: 0}
        students = build_initial_population(program, year_counts, seed)
        base_year1_count = year_counts.get(1, cohort_size) or cohort_size

    initial_population_count = len(students)
    courses = program["courses"]
    elective_category_of = _build_elective_category_map(program)
    category_requirement = {cat["name"]: cat["credits_required"] for cat in program["elective_categories"]}
    course_codes_sorted = sorted(
        courses.keys(),
        key=lambda c: (0 if courses[c]["is_required"] else 1, courses[c]["semester_position"], c),
    )

    per_term_stats = []
    course_term_snapshots: Dict[str, List[dict]] = {c: [] for c in courses}
    course_totals = {
        c: {"enrolled_total": 0, "passed_total": 0, "failed_total": 0, "withdrawn_total": 0, "waitlisted_total": 0}
        for c in courses
    }

    next_sid = len(students)
    intake_index = 0

    for term in range(1, max_terms + 1):
        season = _term_season(starting_term, term)
        # New intake arrives starting term 2 (term 1 is already represented
        # by the existing year-1 headcount). An explicit per-semester
        # schedule takes full priority and can put students in any term,
        # Fall or Spring; otherwise fall back to the Fall-only real-growth
        # (or fixed-number) default.
        if term > 1:
            if intake_schedule is not None:
                size = int(intake_schedule.get(term, intake_schedule.get(str(term), 0)) or 0)
            elif season == "Fall":
                intake_index += 1
                size = _intake_size(base_year1_count, growth_rate, intake_index, new_entrants_per_intake)
            else:
                size = 0
            for _ in range(max(0, size)):
                students.append(Student(next_sid, entry_term=term, entry_year_level=1))
                next_sid += 1

        active_students = [s for s in students if s.status == "active"]
        new_entrants_this_term = sum(1 for s in active_students if s.entry_term == term)
        if not active_students:
            break

        registering: Dict[int, set] = {s.id: set() for s in active_students}
        credit_budget: Dict[int, int] = {s.id: MAX_CREDITS_PER_TERM for s in active_students}
        term_enrolled_counts: Dict[str, int] = {}
        term_waitlisted_counts: Dict[str, int] = {}

        for code in course_codes_sorted:
            course = courses[code]
            if season not in course.get("offered_terms", ["Fall", "Spring"]):
                continue
            base_cap = capacity_overrides.get(code, {}).get("section_capacity", course["section_capacity"])
            base_sections = capacity_overrides.get(code, {}).get("sections_offered", course["sections_offered"])
            cap, sections = _course_capacity_at_term(capacity_schedule, code, term, base_cap, base_sections)
            seats = max(0, int(cap * sections))

            cat_name = elective_category_of.get(code)

            candidates = []
            for s in active_students:
                if credit_budget[s.id] < course["credits"]:
                    continue
                if cat_name is not None:
                    done = _elective_credits_completed(program, s).get(cat_name, 0)
                    if done >= category_requirement.get(cat_name, 0):
                        continue
                if _is_eligible(code, course, s, registering[s.id]):
                    candidates.append(s)

            if registration_priority == "gpa":
                candidates.sort(key=lambda s: (-s.performance_score(), s.id))
            elif registration_priority == "credit-count":
                candidates.sort(key=lambda s: (-s.credits_earned, s.id))
            else:  # random
                candidates.sort(key=lambda s: s.id)
                rng.shuffle(candidates)

            actual = (actual_enrollment or {}).get(term, {}).get(code)
            effective_seats = min(int(actual), len(candidates)) if actual is not None else seats
            admitted = candidates[:effective_seats]
            waitlisted = candidates[effective_seats:]
            term_enrolled_counts[code] = len(admitted)
            term_waitlisted_counts[code] = len(waitlisted)

            for s in admitted:
                registering[s.id].add(code)
                credit_budget[s.id] -= course["credits"]

            course_totals[code]["enrolled_total"] += len(admitted)
            course_totals[code]["waitlisted_total"] += len(waitlisted)

        scheduled_rates = _resolve_at_term(
            rate_schedule,
            term,
            {
                "pass_rate": pass_rate,
                "fail_rate": fail_rate,
                "withdraw_rate": withdraw_rate,
            },
        )

        term_passed = term_failed = term_withdrawn = 0
        for s in active_students:
            for code in sorted(registering[s.id]):
                course = courses[code]
                override = per_course_params.get(code, {})
                # An explicit simulation override is authoritative, followed
                # by the course's own data/override value. The global pass
                # rate is only a fallback for courses with no valid individual
                # pass rate; it never shifts a populated course rate.
                override_pass = override.get("pass_rate")
                course_pass = course.get("pass_rate")
                if isinstance(override_pass, (int, float)) and 0 <= override_pass <= 1:
                    base_pass = override_pass
                elif isinstance(course_pass, (int, float)) and 0 <= course_pass <= 1:
                    base_pass = course_pass
                else:
                    base_pass = scheduled_rates["pass_rate"]
                f_rate = override.get("fail_rate", scheduled_rates["fail_rate"])
                w_rate = override.get("withdraw_rate", scheduled_rates["withdraw_rate"])
                p, fp, wp = _normalize_rates(base_pass, f_rate, w_rate)

                s.attempts[code] = s.attempts.get(code, 0) + 1
                r = _outcome_draw(seed, s.id, code, s.attempts[code])
                if r < p:
                    s.completed.add(code)
                    s.credits_earned += course["credits"]
                    course_totals[code]["passed_total"] += 1
                    term_passed += 1
                elif r < p + fp:
                    s.failures[code] = s.failures.get(code, 0) + 1
                    course_totals[code]["failed_total"] += 1
                    term_failed += 1
                    if s.failures[code] >= MAX_FAILS_BEFORE_DROPOUT and course.get("is_required", True):
                        s.status = "withdrawn"
                else:
                    s.withdrawals[code] = s.withdrawals.get(code, 0) + 1
                    course_totals[code]["withdrawn_total"] += 1
                    term_withdrawn += 1
                    if s.withdrawals[code] >= MAX_WITHDRAWALS_BEFORE_DROPOUT and course.get("is_required", True):
                        s.status = "withdrawn"

            if not registering[s.id] and s.status == "active":
                s.consecutive_stuck_terms += 1
            else:
                s.consecutive_stuck_terms = 0

            if s.status == "active" and _has_graduated(program, s):
                s.status = "graduated"
                s.graduated_term = term

            s.term_history.append({
                "term": term,
                "registered": sorted(registering[s.id]),
                "credits_earned_total": s.credits_earned,
                "status": s.status,
            })

        for code in courses:
            passed_students = sum(1 for s in students if code in s.completed)
            denom = len(students) or 1
            course_term_snapshots[code].append({
                "term": term,
                "students_enrolled_this_term": len(
                    [1 for s in active_students if code in registering[s.id]]
                ),
                "students_waitlisted_this_term": term_waitlisted_counts.get(code, 0),
                "students_demanded_this_term": (
                    term_enrolled_counts.get(code, 0)
                    + term_waitlisted_counts.get(code, 0)
                ),
                "cumulative_passed": passed_students,
                "pct_cohort_passed": round(100 * passed_students / denom, 1),
            })

        on_track = sum(1 for s in students if s.status == "active" and s.consecutive_stuck_terms == 0)
        delayed = sum(1 for s in students if s.status == "active" and s.consecutive_stuck_terms > 0)
        graduated = sum(1 for s in students if s.status == "graduated")
        withdrawn = sum(1 for s in students if s.status == "withdrawn")
        per_term_stats.append({
            "term": term,
            "on_track": on_track,
            "delayed": delayed,
            "graduated": graduated,
            "withdrawn": withdrawn,
            "passed_this_term": term_passed,
            "failed_this_term": term_failed,
            "withdrawn_this_term": term_withdrawn,
            "total_enrolled": on_track + delayed,
            "new_entrants_this_term": new_entrants_this_term,
        })

    for s in students:
        if s.status == "active":
            s.status = "still_enrolled"

    # ---- Aggregate summary statistics ----
    # Only students who reached a terminal outcome (graduated/withdrawn)
    # during the simulated window count toward on-time/delay percentages --
    # students who entered near the end of the horizon simply haven't had
    # time to finish yet, and shouldn't be counted as failures.
    graduated_students = [s for s in students if s.status == "graduated"]
    withdrawn_students = [s for s in students if s.status == "withdrawn"]
    still_enrolled_students = [s for s in students if s.status == "still_enrolled"]
    terminal_count = len(graduated_students) + len(withdrawn_students)
    durations = [s.duration_terms(s.graduated_term) for s in graduated_students]

    on_time = sum(1 for t in durations if t <= 8)
    delay_1 = sum(1 for t in durations if t == 9)
    delay_2 = sum(1 for t in durations if t == 10)
    delay_3plus = sum(1 for t in durations if t >= 11)

    course_stats = {}
    most_retaken = None
    most_retaken_avg = 0
    most_abandoned = None
    most_abandoned_pct = 0
    for code, course in courses.items():
        attempts_list = [s.attempts.get(code, 0) for s in students if s.attempts.get(code, 0) > 0]
        passed_first = sum(1 for s in students if code in s.completed and s.attempts.get(code) == 1)
        retook_once = sum(1 for s in students if code in s.completed and s.attempts.get(code) == 2)
        retook_2plus = sum(1 for s in students if code in s.completed and (s.attempts.get(code) or 0) >= 3)
        currently_enrolled = course_term_snapshots[code][-1]["students_enrolled_this_term"] if course_term_snapshots[code] else 0
        waiting = sum(
            1 for s in students
            if s.status in ("active", "still_enrolled") and code not in s.completed
            and all(p in s.completed for p in course["prerequisites"])
        )
        avg_attempts = statistics.mean(attempts_list) if attempts_list else 0
        withdrawn_pct = round(100 * course_totals[code]["withdrawn_total"] / max(1, course_totals[code]["enrolled_total"]), 1)

        course_stats[code] = {
            "name": course["name"],
            "passed_first_attempt": passed_first,
            "retook_once": retook_once,
            "retook_2plus": retook_2plus,
            "unique_attempted": len(attempts_list),
            "currently_waiting": waiting,
            "currently_enrolled": currently_enrolled,
            "avg_attempts": round(avg_attempts, 2),
            "withdrawn_pct": withdrawn_pct,
            "total_enrolled": course_totals[code]["enrolled_total"],
            "total_waitlisted": course_totals[code]["waitlisted_total"],
        }
        if course["credits"] == 0:
            continue
        if avg_attempts > most_retaken_avg and attempts_list:
            most_retaken_avg = avg_attempts
            most_retaken = code
        if withdrawn_pct > most_abandoned_pct:
            most_abandoned_pct = withdrawn_pct
            most_abandoned = code

    def percentile(data, pct):
        if not data:
            return None
        s = sorted(data)
        k = (len(s) - 1) * pct / 100
        f, c = int(k), min(int(k) + 1, len(s) - 1)
        return s[f] + (s[c] - s[f]) * (k - f)

    total_ever = len(students)
    summary = {
        "on_time_pct": round(100 * on_time / max(1, terminal_count), 1),
        "on_time_population_pct": round(100 * on_time / max(1, total_ever), 1),
        "graduated_pct": round(100 * len(graduated_students) / max(1, total_ever), 1),
        "delay_1_pct": round(100 * delay_1 / max(1, terminal_count), 1),
        "delay_2_pct": round(100 * delay_2 / max(1, terminal_count), 1),
        "delay_3plus_pct": round(100 * delay_3plus / max(1, terminal_count), 1),
        "withdrawn_pct": round(100 * len(withdrawn_students) / max(1, terminal_count), 1),
        "still_active_pct": round(100 * len(still_enrolled_students) / max(1, total_ever), 1),
        "avg_graduation_term": round(statistics.mean(durations), 2) if durations else None,
        "median_graduation_term": statistics.median(durations) if durations else None,
        "p90_graduation_term": round(percentile(durations, 90), 2) if durations else None,
        "longest_path_terms": max(durations) if durations else None,
        "most_retaken_course": most_retaken,
        "most_retaken_avg_attempts": round(most_retaken_avg, 2),
        "most_abandoned_course": most_abandoned,
        "most_abandoned_pct": most_abandoned_pct,
        "graduated_count": len(graduated_students),
        "on_time_count": on_time,
        "withdrawn_count": len(withdrawn_students),
        "still_enrolled_count": len(still_enrolled_students),
        "cohort_size": total_ever,
        "current_total_enrolled": initial_population_count,
        "final_total_enrolled": per_term_stats[-1]["total_enrolled"] if per_term_stats else 0,
    }

    stuck_points = sorted(
        (
            {
                "code": code,
                "currently_waiting": v["currently_waiting"],
                "avg_attempts": v["avg_attempts"],
                "withdrawn_pct": v["withdrawn_pct"],
            }
            for code, v in course_stats.items()
        ),
        key=lambda x: (-x["currently_waiting"], -x["avg_attempts"]),
    )[:10]

    output = {
        "per_term_stats": per_term_stats,
        "graduation_distribution": durations,
        "stuck_points": stuck_points,
        "course_stats": course_stats,
        "course_term_snapshots": course_term_snapshots,
        "summary": summary,
    }
    if include_student_outcomes:
        output["student_outcomes"] = {
            str(s.id): {
                "status": s.status,
                "duration_terms": (
                    s.duration_terms(s.graduated_term)
                    if s.status == "graduated"
                    else None
                ),
                "entry_term": s.entry_term,
            }
            for s in students
        }
    return output
