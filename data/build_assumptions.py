"""Generate data/assumptions.json by scanning the generated program JSON files
for any field whose *_source is 'assumed', documenting it with a reasoning
string. Run after build_programs.py.
"""
import json
import os

BASE = os.path.dirname(__file__)

REASONING = {
    "pass_rate": {
        1: "Freshman/gen-ed course; assumed high pass rate typical of introductory or non-technical courses.",
        2: "Core major course with moderate difficulty; assumed mid-range pass rate.",
        3: "Known historically difficult gatekeeper course (algorithms/OS/architecture-level); assumed below-average pass rate.",
        "elective": "Upper-level elective; assumed above-average pass rate since it is elected by students already through the core sequence.",
    },
    "section_capacity": "QU does not publish per-course seat capacities; assumed 35 for standard lecture sections, 20-25 for lab-heavy or capstone/practicum courses, 40 for large gen-ed lectures, based on typical QU classroom sizes.",
    "sections_offered": "QU does not publish sections-offered-per-term counts; assumed 2-4 for high-demand introductory courses (CMPS151, CMPS251, CMPS303) that all majors must pass through, 1-2 for mid-level required courses, and 1 for narrow upper-level electives.",
}

DIFFICULT_COURSES = {"CMPS303", "CMPS323", "CMPS405", "CMPE261", "CMPE363", "CMPE364", "ELEC351", "CMPE476", "MATH102", "MATH211", "GENG300"}
GENED_HIGH_PASS = {"HIST121", "DAWA111", "ARAB100", "ENGL202", "ENGL203", "MAGT101", "GENG107", "CMPS200", "CMPS307", "CHEM103", "PHYS192", "PHYS194", "CMPE370", "CMPE399", "CMPE471"}

def classify_pass_rate_reason(code, is_required):
    if code in DIFFICULT_COURSES:
        return REASONING["pass_rate"][3]
    if code in GENED_HIGH_PASS:
        return REASONING["pass_rate"][1]
    if not is_required:
        return REASONING["pass_rate"]["elective"]
    return REASONING["pass_rate"][2]

assumptions = {}

with open(os.path.join(BASE, "shared_courses.json"), encoding="utf-8") as f:
    shared_courses = json.load(f)

for prog_id in ["cs", "ce"]:
    with open(os.path.join(BASE, "programs", f"{prog_id}.json"), encoding="utf-8") as f:
        prog = json.load(f)
    for code, c in prog["courses"].items():
        # Shared CS/CE courses have one department-level operational record.
        # Emit that record only once in the override catalog.
        scope = "department" if code in shared_courses else prog_id
        key = f"{scope}.{code}"
        if key in assumptions:
            continue
        source_course = shared_courses.get(code, c)
        entry = {}
        if source_course.get("pass_rate_source") == "assumed":
            entry["pass_rate"] = {
                "value": source_course["pass_rate"],
                "source": "assumed",
                "reasoning": classify_pass_rate_reason(code, c["is_required"]),
                "confidence": "low" if code in DIFFICULT_COURSES else "medium",
            }
        entry["section_capacity"] = {
            "value": source_course["section_capacity"],
            "source": "assumed",
            "reasoning": REASONING["section_capacity"],
            "confidence": "medium",
        }
        entry["sections_offered"] = {
            "value": source_course["sections_offered"],
            "source": "assumed",
            "reasoning": REASONING["sections_offered"],
            "confidence": "medium",
        }
        if entry:
            assumptions[key] = entry

assumptions["_program_level"] = {
    "on_time_graduation_rate_baseline": {
        "value": {"cs": 0.64, "ce": 0.58},
        "source": "assumed",
        "reasoning": "QU publishes only a university-wide 150%-of-duration (6-year) graduation rate (57-74% for Fall 2012-2016 cohorts, data.gov.qa), not an 8-term on-time rate broken out by CS/CE. Values assumed below the university-wide 150% figures since on-time (100% of duration) rates are always lower than 150%-of-duration rates, and CE is assumed slightly lower than CS given its heavier per-term credit load (128 CH vs 120 CH).",
        "confidence": "low",
    },
    "enrollment_growth_rate": {
        "value": {"cs": 0.272, "ce": 0.137},
        "source": "real",
        "reasoning": "Computed CAGR from real QU enrollment data 2017/18-2021/22 (data/raw/enrollment_real_data.json). Not an assumption -- included here only as the default seed value for the Enrollment Forecasting page.",
        "confidence": "high",
    },
}

with open(os.path.join(BASE, "assumptions.json"), "w", encoding="utf-8") as f:
    json.dump(assumptions, f, indent=2, ensure_ascii=False)

print("Total assumption entries:", len(assumptions))
