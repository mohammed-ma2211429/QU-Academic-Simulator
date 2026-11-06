import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import TooltipHelp from "./TooltipHelp";
import { api } from "../utils/api";
import { termLabel } from "../utils/term";

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-qu-border pt-3 mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-qu-text mb-2"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "", help }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1 text-qu-text-muted">
          {label} {help && <TooltipHelp text={help} />}
        </span>
        <span className="font-semibold text-qu-maroon tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-qu-maroon"
      />
    </div>
  );
}

function IntakeScheduleEditor({ params, setParams }) {
  const [loading, setLoading] = useState(false);
  const previousProgram = useRef(params.program);
  const previousStartingTerm = useRef(params.starting_term);
  const schedule = params.intake_schedule || {};
  const terms = Array.from({ length: Math.max(0, params.max_terms - 1) }, (_, i) => i + 2);

  const loadDefaults = (mergeOnly) => {
    setLoading(true);
    const effectiveProgram = params.program === "both" ? "cs" : params.program;
    api.getDefaultIntakeSchedule(effectiveProgram, params.max_terms, params.starting_term)
      .then((r) => {
        const defaults = {};
        Object.entries(r.schedule).forEach(([t, v]) => { defaults[t] = v; });
        setParams((p) => ({
          ...p,
          intake_schedule: mergeOnly ? { ...defaults, ...(p.intake_schedule || {}) } : defaults,
        }));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const programChanged = previousProgram.current !== params.program;
    const startingTermChanged = previousStartingTerm.current !== params.starting_term;
    previousProgram.current = params.program;
    previousStartingTerm.current = params.starting_term;
    const missing = terms.some((t) => schedule[t] === undefined);
    if (programChanged || startingTermChanged) loadDefaults(false);
    else if (missing) loadDefaults(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.max_terms, params.program, params.starting_term]);

  const setTermValue = (term, val) => {
    setParams((p) => ({
      ...p,
      intake_schedule: { ...(p.intake_schedule || {}), [term]: val === "" ? 0 : Number(val) },
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1 text-qu-text-muted">
          New students entering, by semester
          <TooltipHelp text="How many new students start each individual semester. Pre-filled from QU's real growth rate (Fall intakes by default, Spring left at 0) -- edit any semester to test an intake change, e.g. a one-off Spring intake or a different admissions target." />
        </span>
        <button
          onClick={() => loadDefaults(false)}
          disabled={loading}
          className="text-[11px] font-medium text-qu-maroon hover:underline disabled:opacity-50 shrink-0"
        >
          Reset to defaults
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto border border-qu-border rounded-md divide-y divide-qu-border/60">
        {terms.map((term) => (
          <div key={term} className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-[11px] text-qu-text-muted">{termLabel(params.starting_term, term)}</span>
            <input
              type="number"
              min={0}
              value={schedule[term] ?? ""}
              onChange={(e) => setTermValue(term, e.target.value)}
              className="w-20 text-xs border border-qu-border rounded-md px-2 py-1 text-right"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SimulationControls({ params, setParams, onRun, running, extra }) {
  const update = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));

  return (
    <div className="qu-card p-4">
      <h3 className="text-sm font-bold mb-3">Simulation Parameters</h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-qu-text-muted block mb-1">Program</label>
          <div className="flex gap-2">
            {["cs", "ce"].map((p) => (
              <button
                key={p}
                onClick={() => setParams((prev) => ({ ...prev, program: p }))}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-md border ${
                  params.program === p
                    ? "bg-qu-maroon text-white border-qu-maroon"
                    : "border-qu-border text-qu-text-muted"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <Slider label="Reference Cohort Size" value={params.cohort_size} min={50} max={500} step={10}
          onChange={update("cohort_size")} help="Only used as a fallback intake size for programs with no real enrollment data on file (e.g. a brand-new draft program). CS and CE already use QU's real, currently-enrolled population by default -- see 'Existing Population & Growth' below." />

        <div>
          <label className="text-xs text-qu-text-muted block mb-1">Starting Term</label>
          <select
            value={params.starting_term}
            onChange={(e) => setParams((p) => ({ ...p, starting_term: e.target.value }))}
            className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5"
          >
            {["Fall 2024", "Spring 2025", "Fall 2025", "Spring 2026"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <Collapsible title="Existing Population & Growth" defaultOpen>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1 text-qu-text-muted">
            Currently enrolled students
            <TooltipHelp text="How many real students already exist at each year level today. Defaults to QU's real published enrollment; enter your own numbers if you have more current figures." />
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs mb-2">
          <input
            type="checkbox"
            checked={!params.use_real_population}
            onChange={(e) => setParams((p) => ({ ...p, use_real_population: !e.target.checked }))}
          />
          Override with my own numbers
        </label>
        {!params.use_real_population && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[1, 2, 3, 4].map((y) => (
              <div key={y}>
                <label className="text-[11px] text-qu-text-muted block mb-0.5">Year {y}</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={params.existing_population?.[y] ?? ""}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      existing_population: { ...p.existing_population, [y]: e.target.value },
                    }))
                  }
                  className="w-full text-xs border border-qu-border rounded-md px-2 py-1"
                />
              </div>
            ))}
          </div>
        )}

        <IntakeScheduleEditor params={params} setParams={setParams} />
      </Collapsible>

      <Collapsible title="Student Parameters">
        <Slider label="Fallback Pass Rate" value={Math.round(params.pass_rate * 100)} min={50} max={99}
          onChange={(v) => setParams((p) => ({ ...p, pass_rate: v / 100 }))} suffix="%"
          help="Used only when a course has no valid individual pass rate. Course rates from the program data or Data Override are otherwise used unchanged." />
        <Slider label="Fail Rate" value={Math.round(params.fail_rate * 100)} min={1} max={30}
          onChange={(v) => setParams((p) => ({ ...p, fail_rate: v / 100 }))} suffix="%"
          help="Share of the non-passing outcome attributed to failing (vs. withdrawing)." />
        <Slider label="Withdrawal Rate" value={Math.round(params.withdraw_rate * 100)} min={0} max={20}
          onChange={(v) => setParams((p) => ({ ...p, withdraw_rate: v / 100 }))} suffix="%"
          help="Share of the non-passing outcome attributed to withdrawing (vs. failing)." />
      </Collapsible>

      <Collapsible title="Simulation Settings">
        <Slider label="Max Terms to Simulate" value={params.max_terms} min={8} max={20}
          onChange={update("max_terms")} />
        <div>
          <label className="text-xs text-qu-text-muted block mb-1">Random Seed</label>
          <input
            type="number"
            min={0}
            max={4294967295}
            step={1}
            value={params.seed}
            onChange={(e) => setParams((p) => ({ ...p, seed: Number(e.target.value) }))}
            className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="text-xs text-qu-text-muted block mb-1">Registration Priority</label>
          <select
            value={params.registration_priority}
            onChange={(e) => setParams((p) => ({ ...p, registration_priority: e.target.value }))}
            className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5"
          >
            <option value="random">Random</option>
            <option value="gpa">GPA-based</option>
            <option value="credit-count">Credit-count-based</option>
          </select>
        </div>
      </Collapsible>

      {extra}

      <button
        onClick={onRun}
        disabled={running}
        className="w-full mt-4 bg-qu-maroon text-white text-sm font-semibold py-2.5 rounded-md hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow disabled:opacity-60"
      >
        {running ? "Running..." : "Run Simulation"}
      </button>
    </div>
  );
}
