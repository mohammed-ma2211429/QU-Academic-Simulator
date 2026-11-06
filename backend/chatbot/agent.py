"""AI explanation assistant with tool access to the simulation engine."""
from __future__ import annotations

import json
import os
from typing import List, Optional, Literal

import httpx
from pydantic import BaseModel, Field

from simulation.models import DATA_DIR, load_program, resolve_population_params
from simulation.cohort import run_cohort_simulation
from simulation.bottleneck import run_bottleneck_analysis
from simulation.monte_carlo import run_monte_carlo
from simulation.enrollment_forecast import run_enrollment_forecast

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an academic simulation explanation assistant for Qatar University
faculty and administration. You explain model inputs, outputs, comparisons,
and limitations.

You have access to simulation tools. When a faculty member asks a
hypothetical question (what if, what happens if, what would), you MUST
call the appropriate simulation tool first, then answer using the real
results. Never fabricate numbers.

Be professional, direct, and specific. Cite the relevant numbers and clearly
separate observed inputs from simulated outputs. Do not recommend policies,
prioritize actions, prescribe interventions, or tell the user what they
should do. If asked for a recommendation, explain the modeled evidence and
trade-offs that a human decision-maker would need to evaluate instead.
State important limitations. Keep responses concise."""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    conversation_history: List[ChatMessage] = Field(default_factory=list, max_length=100)
    simulation_context: Optional[dict] = None


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_cohort_simulation",
            "description": "Run a cohort-flow simulation for a program and return graduation/delay statistics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "program": {"type": "string", "enum": ["cs", "ce"]},
                    "cohort_size": {"type": "integer", "default": 100},
                    "pass_rate": {
                        "type": "number",
                        "default": 0.75,
                        "description": "Fallback only for courses without an individual pass rate.",
                    },
                    "fail_rate": {"type": "number", "default": 0.15},
                    "withdraw_rate": {"type": "number", "default": 0.10},
                    "seed": {"type": "integer", "default": 42},
                },
                "required": ["program"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_bottlenecks",
            "description": "Run bottleneck analysis for a program under a given capacity reduction and return the top bottleneck courses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "program": {"type": "string", "enum": ["cs", "ce"]},
                    "capacity_reduction": {"type": "number", "default": 0.2},
                    "cohort_size": {"type": "integer", "default": 180},
                    "seed": {"type": "integer", "default": 1},
                    "n_seeds": {"type": "integer", "default": 3},
                },
                "required": ["program"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_monte_carlo",
            "description": "Run a Monte Carlo simulation across many randomized pass-rate draws for a program.",
            "parameters": {
                "type": "object",
                "properties": {
                    "program": {"type": "string", "enum": ["cs", "ce"]},
                    "n_runs": {"type": "integer", "default": 300},
                },
                "required": ["program"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_enrollment_forecast",
            "description": "Project enrollment growth for a program over a number of years and identify capacity breaking points.",
            "parameters": {
                "type": "object",
                "properties": {
                    "program": {"type": "string", "enum": ["cs", "ce"]},
                    "current_enrollment": {"type": "integer"},
                    "growth_rate": {"type": "number"},
                    "model": {
                        "type": "string",
                        "enum": ["linear", "exponential", "logistic"],
                        "default": "logistic",
                    },
                    "years": {"type": "integer", "default": 5},
                },
                "required": ["program"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_simulation_state",
            "description": "Get the faculty member's current simulation context (program, cohort, last results) as shown on their screen.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_program_data",
            "description": "Get raw program data (courses, credits, prerequisites, requirements) for a program.",
            "parameters": {
                "type": "object",
                "properties": {"program_id": {"type": "string", "enum": ["cs", "ce"]}},
                "required": ["program_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_programs",
            "description": "Compare CS vs CE baseline performance (default cohort simulation for each program).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _execute_tool(name: str, args: dict, simulation_context: Optional[dict]) -> dict:
    try:
        if name == "run_cohort_simulation":
            program_id = args.get("program", "cs")
            program = load_program(program_id)
            existing_population, growth_rate = resolve_population_params(program_id, None, None)
            result = run_cohort_simulation(
                program,
                cohort_size=args.get("cohort_size", 100),
                pass_rate=args.get("pass_rate", 0.75),
                fail_rate=args.get("fail_rate", 0.15),
                withdraw_rate=args.get("withdraw_rate", 0.10),
                seed=args.get("seed", 42),
                existing_population=existing_population,
                growth_rate=growth_rate,
            )
            return result["summary"]

        if name == "find_bottlenecks":
            program = load_program(args.get("program", "cs"))
            result = run_bottleneck_analysis(
                program,
                capacity_reduction=args.get("capacity_reduction", 0.2),
                cohort_size=args.get("cohort_size", 180),
                seed=args.get("seed", 1),
                n_seeds=args.get("n_seeds", 3),
            )
            return {
                "top_bottlenecks": result["top_bottlenecks"],
                "analysis_meta": result["analysis_meta"],
            }

        if name == "run_monte_carlo":
            program = load_program(args.get("program", "cs"))
            result = run_monte_carlo(program, n_runs=args.get("n_runs", 300))
            return result["statistics"]

        if name == "run_enrollment_forecast":
            program_id = args.get("program", "cs")
            program = load_program(program_id)
            with open(
                os.path.join(DATA_DIR, "simulation_defaults.json"),
                encoding="utf-8",
            ) as defaults_file:
                defaults = json.load(defaults_file)["enrollment_forecast"].get(program_id, {})
            result = run_enrollment_forecast(
                program,
                current_enrollment=args.get(
                    "current_enrollment",
                    defaults.get("current_enrollment", 500),
                ),
                growth_rate=args.get(
                    "growth_rate",
                    defaults.get("annual_growth_rate", 0.1),
                ),
                model=args.get("model", "logistic"),
                years=args.get("years", 5),
            )
            return {
                "capacity_signals": result["capacity_signals"][:10],
                "capacity_summary": result["capacity_summary"],
                "params": result["params"],
            }

        if name == "get_current_simulation_state":
            return simulation_context or {"message": "No active simulation context provided by the client."}

        if name == "get_program_data":
            program = load_program(args.get("program_id", "cs"))
            return {
                "program_name": program["program_name"],
                "total_credits_required": program["total_credits_required"],
                "num_courses": len(program["courses"]),
                "required_courses": program["required_courses"],
            }

        if name == "compare_programs":
            out = {}
            for pid in ["cs", "ce"]:
                program = load_program(pid)
                existing_population, growth_rate = resolve_population_params(pid, None, None)
                result = run_cohort_simulation(program, existing_population=existing_population, growth_rate=growth_rate)
                out[pid] = result["summary"]
            return out

        return {"error": f"Unknown tool: {name}"}
    except Exception as e:
        return {"error": str(e)}


def handle_chat_message(req: ChatRequest) -> dict:
    if not GROQ_API_KEY:
        return {
            "response": (
                "The AI Assistant is not configured. Set the GROQ_API_KEY environment variable to enable "
                "chat responses. In the meantime, use Cohort Flow, Bottleneck Analysis, Monte Carlo, "
                "and Enrollment Forecast directly to explore your question."
            ),
            "tool_calls_made": [],
            "sources": [],
        }

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in req.conversation_history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": req.message})

    tool_calls_made = []
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    with httpx.Client(timeout=60) as client:
        for _ in range(4):  # allow a few rounds of tool calling
            resp = client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers=headers,
                json={"model": MODEL, "messages": messages, "tools": TOOLS, "tool_choice": "auto"},
            )
            resp.raise_for_status()
            data = resp.json()
            choice = data["choices"][0]
            msg = choice["message"]
            messages.append(msg)

            calls = msg.get("tool_calls")
            if not calls:
                return {
                    "response": msg.get("content", ""),
                    "tool_calls_made": tool_calls_made,
                    "sources": ["QU Academic Simulator internal simulation engine"] if tool_calls_made else [],
                }

            for call in calls:
                fn_name = call["function"]["name"]
                try:
                    fn_args = json.loads(call["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    fn_args = {}
                tool_result = _execute_tool(fn_name, fn_args, req.simulation_context)
                tool_calls_made.append({"tool": fn_name, "arguments": fn_args})
                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(tool_result, default=str),
                })

    return {
        "response": "I ran into trouble completing that analysis after several tool calls. Please try a narrower question.",
        "tool_calls_made": tool_calls_made,
        "sources": [],
    }
