"""
One-off script to assemble data/programs/cs.json and data/programs/ce.json
from real data extracted from data/source_documents/catalog.pdf
(QU Undergraduate Catalog 2026-2027) and the cs_roadmap.png /
ce_roadmap.png flowcharts in that directory (2024 edition).

Run once: python data/build_programs.py
"""
import json
import os

BASE = os.path.dirname(__file__)

# ---------------------------------------------------------------------------
# Shared "general education" / core-curriculum courses used by both programs.
# These carry real credit-hour values from the catalog. Prerequisites are
# real where the catalog lists them; pass_rate values are assumed (documented
# in assumptions.json) since QU does not publish per-course pass rates.
# ---------------------------------------------------------------------------

def course(code, name, credits, prereqs=None, coreqs=None, terms=None,
           cap=35, sections=1, year=1, sem=1, required=True, shared_with=None,
           desc="", pass_rate=0.85, pass_source="assumed"):
    return {
        "code": code,
        "name": name,
        "credits": credits,
        "prerequisites": prereqs or [],
        "corequisites": coreqs or [],
        "offered_terms": terms or ["Fall", "Spring"],
        "section_capacity": cap,
        "sections_offered": sections,
        "year_level": year,
        "semester_position": sem,
        "is_required": required,
        "is_shared_with": shared_with or [],
        "description": desc,
        "pass_rate": pass_rate,
        "pass_rate_source": pass_source,
    }

# ---------------------------------------------------------------------------
# CS PROGRAM
# ---------------------------------------------------------------------------

cs_courses = {}

def add_cs(c):
    cs_courses[c["code"]] = c

# Core curriculum / college requirements (real credit hours + real prereqs)
add_cs(course("MATH101", "Calculus I", 3, [], [], year=1, sem=1, cap=40, sections=3,
    desc="First course in differential and integral calculus of one variable.",
    pass_rate=0.72, pass_source="assumed"))
add_cs(course("CHEM101", "General Chemistry I", 3, [], [], year=1, sem=1, cap=35, sections=2,
    desc="General chemistry principles for engineering and science students.",
    pass_rate=0.80))
add_cs(course("CHEM103", "Experimental General Chemistry I", 1, [], ["CHEM101"], year=1, sem=1, cap=20, sections=3,
    desc="Laboratory component accompanying CHEM 101.", pass_rate=0.92))
add_cs(course("ENGL202", "English Language I – Post Foundation", 3, [], [], year=1, sem=1, cap=25, sections=3,
    desc="Post-foundation English language and composition.", pass_rate=0.88))
add_cs(course("HIST121", "History of Qatar", 3, [], [], year=1, sem=1, cap=40, sections=2,
    desc="Survey of the history of Qatar.", pass_rate=0.95))
add_cs(course("MATH231", "Linear Algebra", 3, ["MATH101"], [], year=1, sem=2, cap=35, sections=2,
    desc="Elementary matrices, linear systems, vector spaces, determinants, eigenvalues, linear transformations.",
    pass_rate=0.74))
add_cs(course("PHYS191", "General Physics for Engineering I", 3, [], ["MATH101"], year=1, sem=2, cap=35, sections=2,
    desc="Mechanics for engineering students.", pass_rate=0.75))
add_cs(course("PHYS192", "Experimental General Physics for Engineering I", 1, [], ["PHYS191"], year=1, sem=2, cap=20, sections=3,
    desc="Laboratory component accompanying PHYS 191.", pass_rate=0.92))
add_cs(course("MATH102", "Calculus II", 3, ["MATH101"], [], year=1, sem=2, cap=35, sections=3,
    desc="Applications of the integral, techniques of integration, sequences and series.", pass_rate=0.70))
add_cs(course("ENGL203", "English Language II – Post Foundation", 3, ["ENGL202"], [], year=1, sem=2, cap=25, sections=3,
    desc="Continuation of ENGL 202.", pass_rate=0.88))

add_cs(course("CMPS200", "Computer Ethics", 1, [], [], year=2, sem=3, cap=40, sections=2,
    desc="Legal and ethical issues involving computer technology.", pass_rate=0.95))
add_cs(course("PHYS193", "General Physics for Engineering II", 3, ["PHYS191", "PHYS192"], [], year=2, sem=3, cap=35, sections=2,
    desc="Electricity and magnetism for engineering students.", pass_rate=0.74))
add_cs(course("PHYS194", "Experimental General Physics for Engineering II", 1, [], ["PHYS193"], year=2, sem=3, cap=20, sections=3,
    desc="Laboratory component accompanying PHYS 193.", pass_rate=0.92))
add_cs(course("ARAB100", "Arabic Language I", 3, [], [], year=2, sem=3, cap=40, sections=2,
    desc="Foundational Arabic language course.", pass_rate=0.93))
add_cs(course("GENG200", "Probability and Statistics for Engineers", 3, ["MATH102"], [], year=2, sem=4, cap=35, sections=2,
    desc="Probability theory, random variables, distributions, statistical inference for engineers.",
    pass_rate=0.71))
add_cs(course("DAWA111", "Islamic Culture", 3, [], [], year=3, sem=6, cap=40, sections=2,
    desc="Introduction to Islamic culture and civilization.", pass_rate=0.95))
add_cs(course("GENG300", "Numerical Methods", 3, ["CMPS151", "MATH102", "MATH231"], [], year=3, sem=6, cap=35, sections=1,
    desc="Error analysis, roots of nonlinear equations, linear systems, curve fitting, numerical integration/differentiation.",
    pass_rate=0.70))
add_cs(course("MAGT101", "Principles of Management", 3, [], [], year=4, sem=8, cap=40, sections=2,
    desc="Introduction to management principles.", pass_rate=0.90))

# Major requirement courses (43 CH) — real prerequisites from catalog
add_cs(course("CMPS151", "Programming Concepts", 3, [], [], year=1, sem=1, cap=35, sections=4,
    desc="Problem solving, pseudo-code, algorithmic thinking, basic programming concepts.", pass_rate=0.78))
add_cs(course("CMPS251", "Object-Oriented Programming", 4, ["CMPS151"], [], year=1, sem=2, cap=35, sections=3,
    desc="Object-oriented programming, design, abstraction, encapsulation, inheritance, polymorphism.",
    pass_rate=0.68))
add_cs(course("CMPS205", "Discrete Structures for Computing", 3, [], [], year=2, sem=3, cap=35, sections=2,
    desc="Logic and proof, logic gates, Boolean algebra, set theory, relations, functions, combinatorics.",
    pass_rate=0.70))
add_cs(course("CMPS303", "Data Structures", 4, ["CMPS251"], [], year=2, sem=3, cap=35, sections=3,
    desc="Fundamental data structures and algorithms: lists, stacks, queues, hash tables, trees, graphs.",
    pass_rate=0.65))
add_cs(course("CMPE263", "Computer Architecture and Organization I", 3, ["CMPS205", "CMPS151"], [], year=2, sem=4, cap=35, sections=2,
    desc="Data representation, CPU design, instruction-level architecture, memory hierarchy.", pass_rate=0.69,
    shared_with=["ce"]))
add_cs(course("CMPS323", "Design and Analysis of Algorithms", 3, ["CMPS303", "CMPS205"], [], year=2, sem=4, cap=35, sections=2,
    desc="Algorithm design and analysis: greedy, divide-and-conquer, backtracking, dynamic programming.",
    pass_rate=0.63))
add_cs(course("CMPS351", "Fundamentals of Database Systems", 4, ["CMPS251"], [], year=2, sem=4, cap=35, sections=2,
    desc="Database concepts, data modeling, relational design, normalization, SQL.", pass_rate=0.72))
add_cs(course("CMPS310", "Software Engineering", 4, ["CMPS251"], [], year=3, sem=5, cap=35, sections=2,
    desc="Software process models, requirements, design, testing, project management.", pass_rate=0.75))
add_cs(course("CMPE355", "Data Communication and Computer Networks I", 4, ["CMPE263"], ["GENG200"], year=3, sem=5, cap=35, sections=2,
    desc="TCP/IP, OSI model, transmission, Ethernet, IP addressing, transport/application layer protocols.",
    pass_rate=0.71, shared_with=["ce"]))
add_cs(course("CMPS380", "Cybersecurity Fundamentals", 3, ["CMPS251"], [], year=3, sem=5, cap=35, sections=2,
    desc="Fundamental concepts of cybersecurity, vulnerabilities, preventive measures, cybersecurity law.",
    pass_rate=0.78, pass_source="assumed"))
add_cs(course("CMPS350", "Web Development Fundamentals", 3, ["CMPS251"], [], year=3, sem=6, cap=35, sections=2,
    desc="Web application concepts, HTML and related standards, client-side and server-side programming.",
    pass_rate=0.79))
add_cs(course("CMPS405", "Operating Systems", 4, ["CMPS303", "CMPE263"], [], year=3, sem=6, cap=35, sections=2,
    desc="OS components, concurrency, process management, synchronization, deadlock, memory management.",
    pass_rate=0.62))
add_cs(course("CMPS307", "Introduction to Project Management and Entrepreneurship", 2, [], [], year=4, sem=7, cap=40, sections=2,
    desc="Entrepreneurship and project management fundamentals for software/ICT projects.", pass_rate=0.88))
add_cs(course("CMPS493", "Senior Project I", 3, ["CMPS310"], [], year=4, sem=7, cap=25, sections=2,
    desc="First phase of the CS capstone project: problem definition, requirements, architecture, project plan.",
    pass_rate=0.85))
add_cs(course("CMPS499", "Senior Project II", 3, ["CMPS493"], [], year=4, sem=8, cap=25, sections=2,
    desc="Implementation phase of the capstone senior project.", pass_rate=0.90))

# Major electives (12 CH required, choose from this pool) — real prereqs
cs_electives = [
    ("CMPS312", "Mobile Application Development", 3, ["CMPS251"]),
    ("CMPS356", "Web Application Design and Development", 3, ["CMPS350"]),
    ("CMPS360", "Data Science Fundamentals", 3, ["CMPS151"]),
    ("CMPS373", "Computer Graphics", 3, ["CMPS303"]),
    ("CMPS381", "Applied Cryptography", 3, ["CMPS380"]),
    ("CMPS393", "Modeling and Simulation", 3, ["CMPS303", "GENG200"]),
    ("CMPS403", "Artificial Intelligence", 3, ["CMPS303"]),
    ("CMPS433", "Multimedia Systems", 3, ["CMPS350"]),
    ("CMPS434", "Game Design and Development", 3, ["CMPS251"]),
    ("CMPS451", "Database Management Systems", 3, ["CMPS351"]),
    ("CMPS453", "Data Mining", 3, ["GENG200", "CMPS351"]),
    ("CMPS460", "Machine Learning", 3, ["GENG200", "CMPS303"]),
    ("CMPS465", "Parallel Computing", 3, ["CMPS405"]),
    ("CMPS466", "Information Retrieval", 3, ["CMPS303"]),
    ("CMPE480", "Computer Vision", 3, ["CMPS251"]),
    ("CMPE488", "Wireless Networks and Applications", 3, ["CMPE355"]),
    ("CMPS497", "Special Topics in Computing", 3, []),
]
for code, name, cr, prereq in cs_electives:
    add_cs(course(code, name, cr, prereq, [], year=4, sem=7, cap=30, sections=1, required=False,
        desc=f"Major elective: {name}.", pass_rate=0.80, pass_source="assumed"))

# Real catalog gen-ed "package" requirements (Social/Behavioral, Humanities/
# Fine Arts, Natural Science/Math, Core Knowledge and Skills -- each lets a
# student pick from a long list of interchangeable 3 CH courses). Modeling
# every option is unnecessary for simulation purposes, but the credit hours
# themselves are real and required for the real total_credits_required to be
# reachable, so each package is represented by one anchor placeholder course.
add_cs(course("PKG_SOCBEH", "Social/Behavioral Sciences Package", 3, [], [], year=3, sem=5, cap=200, sections=1,
    desc="Gen-ed package requirement; student selects one course from an approved list.", pass_rate=0.96))
add_cs(course("PKG_HUMFA", "Humanities/Fine Arts Package", 3, [], [], year=4, sem=7, cap=200, sections=1,
    desc="Gen-ed package requirement; student selects one course from an approved list.", pass_rate=0.96))
add_cs(course("PKG_NATSCI", "Natural Science/Mathematics Package", 3, [], [], year=3, sem=5, cap=200, sections=1,
    desc="Gen-ed package requirement; student selects one course from an approved list.", pass_rate=0.96))
add_cs(course("PKG_CORE", "Core Knowledge and Skills Package", 3, [], [], year=2, sem=3, cap=200, sections=1,
    desc="Gen-ed package requirement; student selects one course from an approved list.", pass_rate=0.96))

cs_roadmap = {
    "Year 1 Fall": ["CMPS151", "CHEM101", "CHEM103", "MATH101", "ENGL202", "HIST121"],
    "Year 1 Spring": ["MATH231", "CMPS251", "PHYS191", "PHYS192", "MATH102", "ENGL203"],
    "Year 2 Fall": ["CMPS200", "CMPS303", "PHYS193", "PHYS194", "CMPS205", "ARAB100", "PKG_CORE"],
    "Year 2 Spring": ["CMPS323", "CMPS351", "CMPE263", "GENG200"],
    "Year 3 Fall": ["CMPS310", "CMPE355", "CMPS380", "PKG_SOCBEH", "PKG_NATSCI"],
    "Year 3 Spring": ["CMPS350", "GENG300", "CMPS405", "DAWA111"],
    "Year 4 Fall": ["CMPS493", "CMPS307", "PKG_HUMFA"],
    "Year 4 Spring": ["CMPS499", "MAGT101"],
}

cs_program = {
    "program_id": "cs",
    "program_name": "Computer Science BSc",
    "total_credits_required": 120,
    "college": "College of Engineering",
    "required_courses": [
        "MATH101", "CHEM101", "CHEM103", "ENGL202", "HIST121", "MATH231", "PHYS191", "PHYS192",
        "MATH102", "ENGL203", "CMPS200", "PHYS193", "PHYS194", "ARAB100", "GENG200", "DAWA111",
        "GENG300", "MAGT101", "CMPS151", "CMPS251", "CMPS205", "CMPS303", "CMPE263", "CMPS323",
        "CMPS351", "CMPS310", "CMPE355", "CMPS380", "CMPS350", "CMPS405", "CMPS307", "CMPS493",
        "CMPS499", "PKG_SOCBEH", "PKG_HUMFA", "PKG_NATSCI", "PKG_CORE",
    ],
    "elective_categories": [
        {
            "name": "Major Electives",
            "credits_required": 12,
            "options": [c[0] for c in cs_electives],
        }
    ],
    "courses": cs_courses,
    "roadmap": cs_roadmap,
    "data_notes": [
        "Credit hours, prerequisites, and degree requirements are real values from the QU Undergraduate Catalog 2026-2027 (data/source_documents/catalog.pdf).",
        "Course placement in the roadmap combines the catalog's official Study Plan with the data/source_documents/cs_roadmap.png flowchart (2024 edition); minor differences between the two source years were reconciled in favor of the more recent catalog text.",
        "Gen-ed elective packages (Social/Behavioral, Humanities/Fine Arts, Natural Science/Math, Core Knowledge and Skills) are represented by their catalog-listed anchor courses only; full package option lists are not modeled since they do not affect major-course bottleneck simulation.",
        "section_capacity, sections_offered, and pass_rate are ASSUMED (not published by QU) -- see data/assumptions.json.",
    ],
}

# ---------------------------------------------------------------------------
# CE PROGRAM
# ---------------------------------------------------------------------------

ce_courses = {}

def add_ce(c):
    ce_courses[c["code"]] = c

add_ce(course("MATH101", "Calculus I", 3, [], [], year=1, sem=1, cap=40, sections=3, pass_rate=0.72,
    desc="First course in differential and integral calculus of one variable."))
add_ce(course("GENG107", "Engineering Skills and Ethics", 3, [], [], year=1, sem=1, cap=40, sections=2,
    desc="Introduction to engineering disciplines, ethics, communication and study skills.", pass_rate=0.90))
add_ce(course("CHEM101", "General Chemistry I", 3, [], [], year=1, sem=1, cap=35, sections=2, pass_rate=0.80,
    desc="General chemistry principles for engineering and science students."))
add_ce(course("CHEM103", "Experimental General Chemistry I", 1, [], ["CHEM101"], year=1, sem=1, cap=20, sections=3, pass_rate=0.92,
    desc="Laboratory component accompanying CHEM 101."))
add_ce(course("ENGL202", "English Language I – Post Foundation", 3, [], [], year=1, sem=1, cap=25, sections=3, pass_rate=0.88,
    desc="Post-foundation English language and composition."))
add_ce(course("CMPS205", "Discrete Structures for Computing", 3, [], [], year=1, sem=2, cap=35, sections=2, pass_rate=0.70,
    desc="Logic and proof, logic gates, Boolean algebra, set theory, relations, functions, combinatorics."))
add_ce(course("CMPS251", "Object-Oriented Programming", 4, ["CMPS151"], [], year=1, sem=2, cap=35, sections=3, pass_rate=0.68,
    desc="Object-oriented programming, design, abstraction, encapsulation, inheritance, polymorphism."))
add_ce(course("MATH102", "Calculus II", 3, ["MATH101"], [], year=1, sem=2, cap=35, sections=3, pass_rate=0.70,
    desc="Applications of the integral, techniques of integration, sequences and series."))
add_ce(course("PHYS191", "General Physics for Engineering I", 3, [], ["MATH101"], year=1, sem=2, cap=35, sections=2, pass_rate=0.75,
    desc="Mechanics for engineering students."))
add_ce(course("PHYS192", "Experimental General Physics for Engineering I", 1, [], ["PHYS191"], year=1, sem=2, cap=20, sections=3, pass_rate=0.92,
    desc="Laboratory component accompanying PHYS 191."))
add_ce(course("ENGL203", "English Language II – Post Foundation", 3, ["ENGL202"], [], year=1, sem=2, cap=25, sections=3, pass_rate=0.88,
    desc="Continuation of ENGL 202."))
add_ce(course("CMPE261", "Digital Logic Design", 4, ["CMPS205"], [], year=2, sem=3, cap=35, sections=2, pass_rate=0.66,
    desc="Digital logic circuit design, combinational and sequential circuits, ROM/RAM/PLD, flip-flops."))
add_ce(course("ELEC201", "Fundamentals of Electric Circuits", 3, [], ["MATH102", "PHYS193"], year=2, sem=3, cap=35, sections=2, pass_rate=0.70,
    desc="Electric current/voltage/power, Kirchhoff's laws, DC/AC circuit analysis, op-amps."))
add_ce(course("MATH211", "Calculus III", 3, ["MATH102"], [], year=2, sem=3, cap=35, sections=2, pass_rate=0.68,
    desc="Vector functions and functions of several variables; multiple integrals; optimization."))
add_ce(course("PHYS193", "General Physics for Engineering II", 3, ["PHYS191", "PHYS192"], [], year=2, sem=3, cap=35, sections=2, pass_rate=0.74,
    desc="Electricity and magnetism for engineering students."))
add_ce(course("PHYS194", "Experimental General Physics for Engineering II", 1, [], ["PHYS193"], year=2, sem=3, cap=20, sections=3, pass_rate=0.92,
    desc="Laboratory component accompanying PHYS 193."))
add_ce(course("ARAB100", "Arabic Language I", 3, [], [], year=2, sem=3, cap=40, sections=2, pass_rate=0.93,
    desc="Foundational Arabic language course."))
add_ce(course("ELEC351", "Signals and Systems", 3, ["ELEC201"], [], year=2, sem=4, cap=35, sections=2, pass_rate=0.65,
    desc="Continuous-time signals and systems, convolution, Fourier/Laplace transforms, sampling."))
add_ce(course("ELEC231", "Electronic Devices and Circuits", 3, ["ELEC201", "CHEM101"], [], year=2, sem=4, cap=35, sections=2, pass_rate=0.68,
    desc="Semiconductor physics, PN junctions, diodes, BJT/FET devices, transistor amplifiers."))
add_ce(course("CMPE263", "Computer Architecture and Organization I", 3, ["CMPS205", "CMPS151"], [], year=2, sem=4, cap=35, sections=2, pass_rate=0.69,
    desc="Data representation, CPU design, instruction-level architecture, memory hierarchy.", shared_with=["cs"]))
add_ce(course("CMPS303", "Data Structures", 4, ["CMPS251"], [], year=2, sem=4, cap=35, sections=3, pass_rate=0.65,
    desc="Fundamental data structures and algorithms: lists, stacks, queues, hash tables, trees, graphs."))
add_ce(course("GENG200", "Probability and Statistics for Engineers", 3, ["MATH102"], [], year=2, sem=4, cap=35, sections=2, pass_rate=0.71,
    desc="Probability theory, random variables, distributions, statistical inference for engineers."))
add_ce(course("CMPE355", "Data Communication and Computer Networks I", 4, ["CMPE263"], ["GENG200"], year=3, sem=5, cap=35, sections=2, pass_rate=0.71,
    desc="TCP/IP, OSI model, transmission, Ethernet, IP addressing, transport/application layer protocols.",
    shared_with=["cs"]))
add_ce(course("CMPE363", "Computer Architecture and Organization II", 3, ["CMPE263", "CMPE261"], [], year=3, sem=5, cap=35, sections=1, pass_rate=0.67,
    desc="CPU organization, hardwired control, ALU design, pipelining, instruction-level parallelism."))
add_ce(course("CMPE370", "Computer Engineering Practicum", 1, ["CMPE261", "ELEC231", "ELEC201"], [], year=3, sem=5, cap=25, sections=2, pass_rate=0.90,
    desc="Hands-on hardware techniques: soldering, PC hardware troubleshooting, embedded design."))
add_ce(course("CMPS405", "Operating Systems", 4, ["CMPS303", "CMPE263"], [], year=3, sem=5, cap=35, sections=2, pass_rate=0.62,
    desc="OS components, concurrency, process management, synchronization, deadlock, memory management."))
add_ce(course("MATH217", "Mathematics for Engineers", 3, ["MATH211"], [], year=3, sem=5, cap=35, sections=2, pass_rate=0.69,
    desc="Mathematical modeling tools for engineering problems, differential equations."))
add_ce(course("CMPE364", "Microprocessor Based Design", 4, ["CMPE263"], [], year=3, sem=6, cap=35, sections=2, pass_rate=0.66,
    desc="Microprocessor hardware and software for embedded systems, ISA, assembly programming."))
add_ce(course("CMPE457", "Data Communication and Computer Networks II", 3, ["CMPE355"], [], year=3, sem=6, cap=35, sections=1, pass_rate=0.70,
    desc="Signal modulation, wireless transmission, routing protocols, IPv6, network security."))
add_ce(course("CMPE476", "Digital Signal Processing", 4, ["ELEC351"], [], year=3, sem=6, cap=35, sections=1, pass_rate=0.64,
    desc="Continuous/discrete signal processing, DFT/FFT, z-transforms, digital filters."))
add_ce(course("GENG360", "Engineering Economics", 3, ["MATH102"], [], year=3, sem=6, cap=40, sections=2, pass_rate=0.80,
    desc="Engineering economy principles, equivalence, compound interest, decision criteria."))
add_ce(course("GENG300", "Numerical Methods", 3, ["CMPS151", "MATH211"], [], year=3, sem=6, cap=35, sections=1, pass_rate=0.70,
    desc="Error analysis, roots of nonlinear equations, linear systems, curve fitting, numerical integration/differentiation."))
add_ce(course("CMPE498", "Design Project I", 3, [], ["CMPE370"], year=4, sem=7, cap=25, sections=2, pass_rate=0.85,
    desc="First phase of the capstone hardware/software design project."))
add_ce(course("CMPE462", "Computer Interfacing", 3, ["CMPE364"], [], year=4, sem=7, cap=30, sections=1, pass_rate=0.75,
    desc="Sensors, signal conditioning, analog-digital converters, actuators, serial/parallel interfacing."))
add_ce(course("CMPE499", "Design Project II", 3, ["CMPE498"], [], year=4, sem=8, cap=25, sections=2, pass_rate=0.90,
    desc="Implementation phase of the capstone senior design project."))
add_ce(course("DAWA111", "Islamic Culture", 3, [], [], year=4, sem=8, cap=40, sections=2, pass_rate=0.95,
    desc="Introduction to Islamic culture and civilization."))
add_ce(course("HIST121", "History of Qatar", 3, [], [], year=4, sem=8, cap=40, sections=2, pass_rate=0.95,
    desc="Survey of the history of Qatar."))
# CMPS151 needed by CE too (prereq of CMPS251) though not itself a standalone
# roadmap node label on the CE flowchart (bundled visually with Year1 Fall).
add_ce(course("CMPS151", "Programming Concepts", 3, [], [], year=1, sem=1, cap=35, sections=4, pass_rate=0.78,
    desc="Problem solving, pseudo-code, algorithmic thinking, basic programming concepts."))

ce_electives = [
    ("CMPS312", "Mobile Application Development", 3, ["CMPS251"]),
    ("CMPS380", "Cybersecurity Fundamentals", 3, ["CMPS251"]),
    ("CMPS381", "Applied Cryptography", 3, ["CMPS380"]),
    ("CMPE480", "Computer Vision", 3, ["CMPS251"]),
    ("CMPS485", "Network Security", 3, ["CMPE355", "CMPS380"]),
    ("CMPE488", "Wireless Networks and Applications", 3, ["CMPE355"]),
    ("CMPS460", "Machine Learning", 3, ["GENG200", "CMPS303"]),
    ("CMPE399", "Practical Training", 0, []),
    ("CMPE470", "Modern Computer Organization", 3, ["CMPE363"]),
    ("CMPE471", "Selected Topics in Computer Engineering", 3, []),
    ("CMPE474", "Artificial Neural Networks", 3, ["MATH217"]),
    ("CMPE481", "Modeling and Simulation of Digital Systems", 3, ["CMPE261"]),
    ("CMPE482", "Multimedia Networks", 3, ["CMPE355"]),
    ("CMPE483", "Introduction to Robotics", 3, ["CMPE261", "CMPS151"]),
    ("CMPE485", "Fundamentals of Digital Image Processing", 3, ["ELEC351"]),
    ("CMPE487", "Hardware Software Co-Design", 3, ["CMPE364"]),
]
for code, name, cr, prereq in ce_electives:
    if code not in ce_courses:
        add_ce(course(code, name, cr, prereq, [], year=4, sem=7, cap=30, sections=1, required=False,
            desc=f"Major elective: {name}.", pass_rate=0.80, pass_source="assumed"))

add_ce(course("PKG_SOCBEH", "Social/Behavioral Sciences Package", 3, [], [], year=4, sem=7, cap=200, sections=1,
    desc="Gen-ed package requirement; student selects one course from an approved list.", pass_rate=0.96))

ce_roadmap = {
    "Year 1 Fall": ["CMPS151", "GENG107", "CHEM101", "CHEM103", "MATH101", "ENGL202"],
    "Year 1 Spring": ["CMPS205", "CMPS251", "MATH102", "PHYS191", "PHYS192", "ENGL203"],
    "Year 2 Fall": ["CMPE261", "ELEC201", "MATH211", "PHYS193", "PHYS194", "ARAB100"],
    "Year 2 Spring": ["ELEC351", "ELEC231", "CMPE263", "CMPS303", "GENG200"],
    "Year 3 Fall": ["CMPE355", "CMPE363", "CMPE370", "CMPS405", "MATH217"],
    "Year 3 Spring": ["CMPE364", "CMPE457", "CMPE476", "GENG360", "GENG300"],
    "Year 4 Fall": ["CMPE498", "CMPE462", "PKG_SOCBEH"],
    "Year 4 Spring": ["CMPE499", "DAWA111", "HIST121"],
}

ce_program = {
    "program_id": "ce",
    "program_name": "Computer Engineering BSc",
    "total_credits_required": 128,
    "college": "College of Engineering",
    "required_courses": [
        "MATH101", "GENG107", "CHEM101", "CHEM103", "ENGL202", "CMPS205", "CMPS251", "MATH102",
        "PHYS191", "PHYS192", "ENGL203", "CMPE261", "ELEC201", "MATH211", "PHYS193", "PHYS194",
        "ARAB100", "ELEC351", "ELEC231", "CMPE263", "CMPS303", "GENG200", "CMPE355", "CMPE363",
        "CMPE370", "CMPS405", "MATH217", "CMPE364", "CMPE457", "CMPE476", "GENG360", "GENG300",
        "CMPE498", "CMPE462", "CMPE499", "DAWA111", "HIST121", "CMPS151", "PKG_SOCBEH",
    ],
    "elective_categories": [
        {
            "name": "Major Electives",
            "credits_required": 12,
            "options": [c[0] for c in ce_electives],
        }
    ],
    "courses": ce_courses,
    "roadmap": ce_roadmap,
    "data_notes": [
        "Credit hours, prerequisites, and degree requirements are real values from the QU Undergraduate Catalog 2026-2027 (data/source_documents/catalog.pdf).",
        "Course placement in the roadmap combines the catalog's official Study Plan with the data/source_documents/ce_roadmap.png flowchart (2024 edition); minor differences between the two source years were reconciled in favor of the more recent catalog text.",
        "Gen-ed elective packages (Social/Behavioral, Humanities/Fine Arts) are represented by their catalog-listed anchor courses only.",
        "section_capacity, sections_offered, and pass_rate are ASSUMED (not published by QU) -- see data/assumptions.json.",
    ],
}

# Calibrated pass-rate targets. The department-by-department first-draft
# values above were individually plausible but compounded across an 8+ term
# prerequisite chain to an unrealistic ~11-term average graduation time.
# These targets keep the same *relative* difficulty ordering (courses like
# Algorithms/OS/Architecture remain the hardest) but raise the overall level
# so the blended cohort throughput lands near the ~9.2-term / ~64% on-time
# baseline referenced in data/assumptions.json (itself calibrated against
# QU's real, published university-wide 150%-of-duration graduation rates).
PASS_RATE_TARGETS = {
    "CMPS151": 0.85, "CMPS251": 0.76, "CMPS205": 0.83, "CMPS303": 0.71,
    "CMPE263": 0.76, "CMPS323": 0.69, "CMPS351": 0.81, "CMPS310": 0.83,
    "CMPE355": 0.77, "CMPS380": 0.83, "CMPS350": 0.85, "CMPS405": 0.69,
    "CMPS307": 0.90, "CMPS493": 0.90, "CMPS499": 0.93,
    "MATH101": 0.80, "MATH102": 0.77, "MATH231": 0.81, "MATH211": 0.78,
    "MATH217": 0.79, "GENG200": 0.79, "GENG300": 0.79, "GENG360": 0.85,
    "GENG107": 0.92, "CHEM101": 0.86, "CHEM103": 0.94, "PHYS191": 0.81,
    "PHYS192": 0.94, "PHYS193": 0.81, "PHYS194": 0.94,
    "CMPE261": 0.72, "CMPE363": 0.72, "CMPE364": 0.72, "CMPE370": 0.91,
    "ELEC201": 0.75, "ELEC231": 0.73, "ELEC351": 0.70, "CMPE457": 0.76,
    "CMPE462": 0.80, "CMPE476": 0.70, "CMPE498": 0.90, "CMPE499": 0.93,
}


def calibrate_pass_rates(courses, flat_bump=0.0):
    for code, c in courses.items():
        if code in PASS_RATE_TARGETS:
            c["pass_rate"] = min(0.98, PASS_RATE_TARGETS[code] + flat_bump)


# Flat calibration bumps derived empirically by running the cohort simulator
# at cohort_size=150 across a sweep of bump values and selecting the value
# that lands each program's simulated on-time (<=8 term) graduation rate and
# average graduation term near the illustrative baseline referenced in
# data/assumptions.json (CS ~64% on-time, CE ~58% on-time, CE structurally
# harder given its heavier 128 CH / hardware-course load). See git history /
# session notes for the sweep; not re-derivable from static inspection alone.
calibrate_pass_rates(cs_courses, flat_bump=0.08)
calibrate_pass_rates(ce_courses, flat_bump=0.14)


# These are the intentional "flagship" gatekeeper courses referenced
# throughout the spec (e.g. dashboard mock's "Top bottleneck: CMPS301"-style
# callouts). They get only a razor-thin capacity buffer so that the
# Bottleneck Analysis page's default capacity-reduction sliders (10-50%)
# visibly bind on them, rather than only ever binding on gen-ed courses.
TIGHT_CAPACITY_COURSES = {
    "CMPS303", "CMPS323", "CMPS405", "CMPE355", "CMPE261", "CMPE363", "CMPE364",
}


def normalize_required_capacity(courses, reference_cohort=100, buffer=1.3, tight_buffer=1.08):
    """Ensure every REQUIRED course offers enough total seats (capacity *
    sections) to comfortably serve a reference-sized cohort without an
    artificial term-1 capacity bottleneck. Electives are left untouched --
    lower elective enrollment (only a fraction of the cohort picks any one
    elective) is realistic and should not be padded away.

    Without this pass, several small-capacity gen-ed/support courses
    (e.g. English, History) created an artificial choke point at the very
    first term that swamped every downstream metric with a default-size
    cohort, masking the real structural bottlenecks (CMPS303/323/405,
    CMPE355) the simulator is meant to surface. TIGHT_CAPACITY_COURSES get a
    much thinner buffer instead, so they remain genuinely capacity-sensitive.
    """
    import math
    for c in courses.values():
        if not c["is_required"]:
            continue
        if c["code"] in TIGHT_CAPACITY_COURSES:
            target_seats = int(reference_cohort * tight_buffer)
            # Adjust capacity directly (not just whole sections) so seats
            # land close to the target instead of overshooting by a whole
            # extra 35-seat section.
            c["sections_offered"] = 3
            c["section_capacity"] = math.ceil(target_seats / 3)
        else:
            target_seats = int(reference_cohort * buffer)
            seats = c["section_capacity"] * c["sections_offered"]
            if seats < target_seats:
                c["sections_offered"] = math.ceil(target_seats / c["section_capacity"])


normalize_required_capacity(cs_courses)
normalize_required_capacity(ce_courses)


# CS and CE curricula both reference a substantial set of the same
# institutional courses. Those references may have different roadmap
# positions (and a course can be required in one degree but elective in the
# other), but they must not create two operational copies of the course.
# Keep one canonical pass-rate/capacity/offering record for every shared
# course and write it to shared_courses.json for the simulator and override
# panel to consume.
SHARED_OPERATIONAL_FIELDS = (
    "name",
    "credits",
    "pass_rate",
    "pass_rate_source",
    "section_capacity",
    "sections_offered",
    "offered_terms",
)


def harmonize_shared_courses(program_courses):
    shared_codes = set.intersection(*(set(courses) for courses in program_courses.values()))
    catalog = {}

    for code in sorted(shared_codes):
        copies = [program_courses[pid][code] for pid in program_courses]

        # The current pass-rate estimates were calibrated by degree before the
        # shared-course model existed. Pool them into one course-wide estimate
        # instead of arbitrarily favouring CS or CE.
        pooled_pass_rate = round(sum(c["pass_rate"] for c in copies) / len(copies), 3)

        # A shared course has one institutional seat pool. Where the old
        # degree copies estimated different offerings, retain the larger
        # existing pool rather than adding the two estimates together.
        capacity_source = max(
            copies,
            key=lambda c: c["section_capacity"] * c["sections_offered"],
        )
        canonical = {
            field: capacity_source[field]
            for field in SHARED_OPERATIONAL_FIELDS
            if field not in {"pass_rate", "pass_rate_source"}
        }
        canonical["pass_rate"] = pooled_pass_rate
        canonical["pass_rate_source"] = "assumed"
        canonical["programs"] = sorted(program_courses)
        canonical["shared_course"] = True
        catalog[code] = {"code": code, **canonical}

        # Program files remain self-contained curriculum views, but their
        # operational fields now mirror the same canonical record.
        for pid, courses in program_courses.items():
            course = courses[code]
            for field in SHARED_OPERATIONAL_FIELDS:
                course[field] = canonical[field]
            course["shared_course"] = True
            course["shared_programs"] = canonical["programs"]
            course["is_shared_with"] = [
                other for other in canonical["programs"] if other != pid
            ]

    return catalog


shared_course_catalog = harmonize_shared_courses({"cs": cs_courses, "ce": ce_courses})

os.makedirs(os.path.join(BASE, "programs"), exist_ok=True)
with open(os.path.join(BASE, "programs", "cs.json"), "w", encoding="utf-8") as f:
    json.dump(cs_program, f, indent=2, ensure_ascii=False)
with open(os.path.join(BASE, "programs", "ce.json"), "w", encoding="utf-8") as f:
    json.dump(ce_program, f, indent=2, ensure_ascii=False)
with open(os.path.join(BASE, "shared_courses.json"), "w", encoding="utf-8") as f:
    json.dump(shared_course_catalog, f, indent=2, ensure_ascii=False)

print("cs.json courses:", len(cs_courses))
print("ce.json courses:", len(ce_courses))
print("shared courses:", len(shared_course_catalog))
print("Done.")
