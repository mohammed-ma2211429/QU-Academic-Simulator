import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, GitBranch, Loader2, RefreshCw, Users,
} from "lucide-react";
import { useApp } from "../context/app-context";
import { api } from "../utils/api";
import PageHeader from "../components/PageHeader";
import TooltipHelp from "../components/TooltipHelp";
import ExportButton from "../components/ExportButton";

const REDUCTION_OPTIONS = [0.1, 0.2, 0.3, 0.5];
const N_SEEDS = 3;
const MAX_TERMS = 14;
const SEED_START = 1;

function signed(value, suffix = "") {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number}${suffix}`;
}

function sameConfig(left, right) {
  return left
    && right
    && left.program === right.program
    && left.reduction === right.reduction
    && left.cohortSize === right.cohortSize;
}

export default function BottleneckAnalysis() {
  const { effectiveProgram, recordSimulation } = useApp();
  const [program, setProgram] = useState(effectiveProgram);
  const [reduction, setReduction] = useState(0.2);
  const [cohortSize, setCohortSize] = useState(180);
  const [result, setResult] = useState(null);
  const [resultConfig, setResultConfig] = useState(null);
  const [programData, setProgramData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [whatIfCourse, setWhatIfCourse] = useState("");
  const [whatIfCapacity, setWhatIfCapacity] = useState(35);
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const mainRequest = useRef(0);
  const whatIfRequest = useRef(0);

  const currentConfig = useMemo(
    () => ({ program, reduction, cohortSize }),
    [program, reduction, cohortSize],
  );
  const isStale = Boolean(result && !sameConfig(resultConfig, currentConfig));
  const visibleResult = result && !isStale ? result : null;

  const run = useCallback(() => {
    const requestId = ++mainRequest.current;
    const submitted = { program, reduction, cohortSize };
    setLoading(true);
    setWhatIfResult(null);
    Promise.all([
      api.getProgram(program),
      api.simulateBottleneck({
        program,
        capacity_reduction: reduction,
        cohort_size: cohortSize,
        seed: SEED_START,
        n_seeds: N_SEEDS,
        max_terms: MAX_TERMS,
      }),
    ])
      .then(([programResponse, analysis]) => {
        if (requestId !== mainRequest.current) return;
        const first = analysis.top_bottlenecks[0]?.code
          || Object.keys(programResponse.courses)[0];
        setProgramData(programResponse);
        setResult(analysis);
        setResultConfig(submitted);
        setSelectedCourse(first);
        setWhatIfCourse(first);
        setWhatIfCapacity(programResponse.courses[first]?.section_capacity || 35);
        recordSimulation("bottleneck", {
          program,
          parameters: {
            capacity_reduction: reduction,
            cohort_size: cohortSize,
            seed: SEED_START,
            n_seeds: N_SEEDS,
            max_terms: MAX_TERMS,
          },
          summary: {
            ...analysis.baseline_summary,
            highest_paired_impact: analysis.top_bottlenecks[0] || null,
          },
          data: {
            top_bottlenecks: analysis.top_bottlenecks,
            analysis_meta: analysis.analysis_meta,
          },
        });
      })
      .finally(() => {
        if (requestId === mainRequest.current) setLoading(false);
      });
  }, [program, reduction, cohortSize, recordSimulation]);

  useEffect(() => {
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const requestId = ++whatIfRequest.current;
    if (!visibleResult || !whatIfCourse || !programData) {
      setWhatIfResult(null);
      setWhatIfLoading(false);
      return undefined;
    }

    setWhatIfResult(null);
    setWhatIfLoading(true);
    const timer = window.setTimeout(() => {
      api.bottleneckWhatIf({
        program,
        course_code: whatIfCourse,
        new_capacity: whatIfCapacity,
        cohort_size: cohortSize,
        seed: SEED_START,
        n_seeds: N_SEEDS,
        max_terms: MAX_TERMS,
      })
        .then((response) => {
          if (requestId === whatIfRequest.current) setWhatIfResult(response);
        })
        .finally(() => {
          if (requestId === whatIfRequest.current) setWhatIfLoading(false);
        });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    visibleResult, whatIfCourse, whatIfCapacity, programData, program,
    cohortSize,
  ]);

  const selectedImpact = visibleResult?.course_impacts[selectedCourse] || null;
  const path = useMemo(() => {
    if (!programData || !selectedCourse) {
      return { prerequisites: [], downstream: [] };
    }
    const prerequisites = programData.courses[selectedCourse]?.prerequisites || [];
    const downstream = new Set();
    const queue = [selectedCourse];
    while (queue.length) {
      const current = queue.shift();
      Object.entries(programData.courses).forEach(([code, course]) => {
        if (
          course.is_required
          && course.prerequisites.includes(current)
          && !downstream.has(code)
        ) {
          downstream.add(code);
          queue.push(code);
        }
      });
    }
    return { prerequisites, downstream: [...downstream] };
  }, [programData, selectedCourse]);

  const maxHarmed = Math.max(
    ...(visibleResult?.top_bottlenecks.map((item) => item.students_harmed_mean) || [0]),
    1,
  );

  return (
    <div>
      <PageHeader
        title="Bottleneck Analysis"
        subtitle="Stress one course at a time and compare the same students with an unchanged baseline."
        actions={visibleResult && (
          <ExportButton
            csvData={visibleResult.top_bottlenecks}
            csvFilename="bottleneck_evidence.csv"
            pdfElementId="bottleneck-export-area"
            pdfFilename="bottleneck_evidence.pdf"
            pdfTitle="Bottleneck Analysis Evidence"
          />
        )}
      />

      <div id="bottleneck-export-area" className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[250px_minmax(0,1fr)_340px]">
        <aside className="qu-card h-fit space-y-5 p-4">
          <div>
            <label className="mb-1 block text-xs text-qu-text-muted">Program</label>
            <div className="flex gap-2">
              {["cs", "ce"].map((option) => (
                <button
                  key={option}
                  onClick={() => setProgram(option)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-semibold ${
                    program === option
                      ? "border-qu-maroon bg-qu-maroon text-white"
                      : "border-qu-border text-qu-text-muted"
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1 text-xs text-qu-text-muted">
              Per-section capacity reduction
              <TooltipHelp text="Each course is tested independently. Its seats per section are reduced, then the same modeled students are compared with the unchanged baseline." />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REDUCTION_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setReduction(option)}
                  className={`rounded-md border px-2 py-2 text-xs font-semibold ${
                    reduction === option
                      ? "border-qu-maroon bg-qu-maroon/[0.07] text-qu-maroon"
                      : "border-qu-border text-qu-text-muted"
                  }`}
                >
                  {Math.round(option * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-qu-text-muted">
              Stress-test population
            </label>
            <input
              type="range"
              min={60}
              max={300}
              step={20}
              value={cohortSize}
              onChange={(event) => setCohortSize(Number(event.target.value))}
              className="w-full accent-qu-maroon"
            />
            <div className="mt-1 flex justify-between text-[10px] text-qu-text-muted">
              <span>60</span>
              <span className="font-bold text-qu-maroon">{cohortSize} students</span>
              <span>300</span>
            </div>
          </div>

          <div className="rounded-lg border border-qu-border bg-qu-off-white p-3 text-[10px] leading-relaxed text-qu-text-muted">
            <div className="font-bold text-qu-text">Comparison design</div>
            <div className="mt-1">3 seeds · 14 terms · paired student outcomes</div>
            <div className="mt-1">Every course is stressed independently.</div>
          </div>

          {isStale && (
            <div className="flex gap-2 rounded-lg border border-qu-warning/30 bg-qu-warning/[0.07] p-3 text-[10px] leading-relaxed text-qu-text">
              <RefreshCw size={14} className="mt-0.5 shrink-0 text-qu-warning" />
              Inputs changed. Run the analysis to replace the previous result.
            </div>
          )}

          <button
            onClick={run}
            disabled={loading}
            className="qu-btn-shadow flex w-full items-center justify-center gap-2 rounded-md bg-qu-maroon py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-qu-maroon-mid disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Comparing courses..." : "Run Bottleneck Analysis"}
          </button>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="qu-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-qu-text">Ranked paired impact</h3>
                <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-qu-text-muted">
                  Bar length represents one attribute only: the average number of
                  students delayed or left unfinished by the tested capacity reduction.
                </p>
              </div>
              {visibleResult && (
                <span className="rounded-full bg-qu-maroon/[0.07] px-3 py-1 text-[10px] font-bold text-qu-maroon">
                  {Math.round(reduction * 100)}% reduction
                </span>
              )}
            </div>

            <div className="mt-5 min-h-[410px]">
              {loading && !visibleResult ? (
                <LoadingState text="Running paired baseline and capacity comparisons..." />
              ) : !visibleResult ? (
                <EmptyState stale={isStale} />
              ) : (
                <div className="space-y-2">
                  {visibleResult.top_bottlenecks.map((item, index) => {
                    const selected = selectedCourse === item.code;
                    const width = Math.max(
                      item.students_harmed_mean > 0
                        ? (item.students_harmed_mean / maxHarmed) * 100
                        : 0,
                      0,
                    );
                    return (
                      <button
                        key={item.code}
                        onClick={() => {
                          setSelectedCourse(item.code);
                          setWhatIfCourse(item.code);
                          setWhatIfCapacity(programData.courses[item.code].section_capacity);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          selected
                            ? "border-qu-text bg-qu-off-white"
                            : "border-qu-border hover:bg-qu-off-white/70"
                        }`}
                      >
                        <div className="grid items-center gap-3 sm:grid-cols-[28px_minmax(130px,1fr)_minmax(150px,1.25fr)_96px]">
                          <span className="text-[11px] font-bold text-qu-text-muted/60">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-qu-maroon">{item.code}</span>
                            <span className="block truncate text-[10px] text-qu-text-muted">{item.name}</span>
                          </span>
                          <span className="h-2.5 overflow-hidden rounded-full bg-qu-maroon/[0.08]">
                            <span
                              className="block h-full rounded-full bg-qu-maroon"
                              style={{ width: `${width}%` }}
                            />
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-bold text-qu-text">{item.students_harmed_mean}</span>
                            <span className="block text-[9px] text-qu-text-muted">
                              range {item.students_harmed_min}–{item.students_harmed_max}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {visibleResult && selectedImpact && (
            <section className="qu-card p-5">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-qu-maroon" />
                <h3 className="text-sm font-bold text-qu-text">Focused course path</h3>
              </div>
              <p className="mt-1 text-[10px] text-qu-text-muted">
                This path is structural catalog data. It is separate from the impact bar above.
              </p>
              <div className="mt-4 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1.2fr]">
                <PathGroup title="Direct prerequisites" codes={path.prerequisites} />
                <ArrowRight className="m-auto hidden text-qu-text-muted/40 md:block" size={18} />
                <PathGroup title="Selected course" codes={[selectedCourse]} selected />
                <ArrowRight className="m-auto hidden text-qu-text-muted/40 md:block" size={18} />
                <PathGroup title="Required downstream" codes={path.downstream} />
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-5 lg:col-start-2 2xl:col-start-auto">
          {visibleResult && selectedImpact ? (
            <>
              <section className="qu-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-qu-maroon">Selected evidence</div>
                    <h3 className="mt-1 text-base font-bold text-qu-text">{selectedImpact.code}</h3>
                    <p className="mt-0.5 text-[10px] text-qu-text-muted">{selectedImpact.name}</p>
                  </div>
                  <span className="rounded-lg bg-qu-maroon/[0.07] p-2 text-qu-maroon">
                    <Users size={17} />
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Metric label="Students harmed" value={selectedImpact.students_harmed_mean} detail={`range ${selectedImpact.students_harmed_min}–${selectedImpact.students_harmed_max}`} />
                  <Metric label="Newly unfinished" value={selectedImpact.newly_unfinished_mean} detail="at term 14" />
                  <Metric label="Graduate count" value={signed(selectedImpact.graduates_change_mean)} detail="change vs baseline" />
                  <Metric label="On-time population" value={signed(selectedImpact.on_time_population_pp_change_mean, " pp")} detail="change vs baseline" />
                  <Metric label="Course waitlist" value={signed(selectedImpact.tested_course_waitlist_change_mean)} detail="cumulative change" />
                  <Metric label="Downstream courses" value={selectedImpact.downstream_count} detail="catalog structure" />
                </div>
                <div className="mt-3 rounded-lg bg-qu-off-white px-3 py-2 text-[10px] leading-relaxed text-qu-text-muted">
                  Tested {selectedImpact.original_capacity} → {selectedImpact.tested_capacity} seats
                  per section across {selectedImpact.sections_offered} section(s).
                </div>
              </section>

              <section className="qu-card p-4">
                <h3 className="text-sm font-bold text-qu-text">Single-course capacity comparison</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-qu-text-muted">
                  Values update after a short pause. Only the newest slider request is shown.
                </p>

                <label className="mb-1 mt-4 block text-[10px] font-semibold text-qu-text-muted">Course</label>
                <select
                  value={whatIfCourse}
                  onChange={(event) => {
                    const code = event.target.value;
                    setWhatIfCourse(code);
                    setSelectedCourse(code);
                    setWhatIfCapacity(programData.courses[code].section_capacity);
                  }}
                  className="w-full rounded-md border border-qu-border px-2 py-2 text-xs"
                >
                  {Object.keys(programData.courses).map((code) => (
                    <option key={code} value={code}>{code} — {programData.courses[code].name}</option>
                  ))}
                </select>

                <div className="mb-1 mt-3 flex justify-between text-[10px] font-semibold text-qu-text-muted">
                  <span>Seats per section</span>
                  <span className="text-qu-maroon">{whatIfCapacity}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={whatIfCapacity}
                  onChange={(event) => setWhatIfCapacity(Number(event.target.value))}
                  className="w-full accent-qu-maroon"
                />

                <div className="mt-4 min-h-[236px]">
                  {whatIfLoading ? (
                    <LoadingState compact text={`Comparing ${whatIfCourse} at ${whatIfCapacity} seats...`} />
                  ) : whatIfResult ? (
                    <WhatIfEvidence result={whatIfResult} />
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="qu-card p-5 text-center text-xs text-qu-text-muted">
              {loading ? "Evidence will appear when the analysis finishes." : "Run the current inputs to inspect course evidence."}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-qu-border bg-white p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-qu-text-muted">{label}</div>
      <div className="mt-1 text-sm font-bold text-qu-text">{value}</div>
      <div className="mt-0.5 text-[9px] text-qu-text-muted">{detail}</div>
    </div>
  );
}

function PathGroup({ title, codes, selected = false }) {
  const shown = codes.slice(0, 10);
  return (
    <div className={`rounded-xl border p-3 ${selected ? "border-qu-text bg-qu-off-white" : "border-qu-border"}`}>
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-qu-text-muted">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {shown.length ? shown.map((code) => (
          <span key={code} className={`rounded-md px-2 py-1 text-[10px] font-bold ${selected ? "bg-qu-text text-white" : "bg-qu-maroon/[0.07] text-qu-maroon"}`}>
            {code}
          </span>
        )) : <span className="text-[10px] text-qu-text-muted">None</span>}
        {codes.length > shown.length && (
          <span className="rounded-md bg-qu-off-white px-2 py-1 text-[10px] text-qu-text-muted">
            +{codes.length - shown.length} more
          </span>
        )}
      </div>
    </div>
  );
}

function WhatIfEvidence({ result }) {
  const changes = result.changes;
  const rows = [
    ["Graduated", result.baseline_summary.graduated_count, result.tested_summary.graduated_count],
    ["Still enrolled", result.baseline_summary.still_enrolled_count, result.tested_summary.still_enrolled_count],
    ["On-time / all students", `${result.baseline_summary.on_time_population_pct}%`, `${result.tested_summary.on_time_population_pct}%`],
    ["Avg terms / graduates", result.baseline_summary.avg_graduation_term ?? "—", result.tested_summary.avg_graduation_term ?? "—"],
  ];
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-qu-border">
        <div className="grid grid-cols-[1.2fr_.8fr_.8fr] bg-qu-off-white px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-qu-text-muted">
          <span>Metric</span><span>Baseline</span><span>Tested</span>
        </div>
        {rows.map(([label, baseline, tested]) => (
          <div key={label} className="grid grid-cols-[1.2fr_.8fr_.8fr] border-t border-qu-border px-2 py-1.5 text-[10px]">
            <span className="text-qu-text-muted">{label}</span>
            <span className="font-semibold text-qu-text">{baseline}</span>
            <span className="font-semibold text-qu-text">{tested}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="Students harmed" value={changes.students_harmed_mean} detail={`range ${changes.students_harmed_min}–${changes.students_harmed_max}`} />
        <Metric label="Students improved" value={changes.students_improved_mean} detail={`range ${changes.students_improved_min}–${changes.students_improved_max}`} />
        <Metric label="Graduate count" value={signed(changes.graduates_change_mean)} detail="paired change" />
        <Metric label="Course waitlist" value={signed(changes.tested_course_waitlist_change_mean)} detail="cumulative change" />
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-qu-text-muted">
        {result.course_code}: {result.original_capacity} → {result.tested_capacity} seats per section · {result.analysis_meta.n_seeds} seeds · {result.analysis_meta.max_terms} terms.
      </p>
    </div>
  );
}

function LoadingState({ text, compact = false }) {
  return (
    <div className={`flex h-full items-center justify-center gap-2 text-center text-xs text-qu-text-muted ${compact ? "min-h-[180px]" : "min-h-[380px]"}`}>
      <Loader2 size={16} className="animate-spin text-qu-maroon" />
      {text}
    </div>
  );
}

function EmptyState({ stale }) {
  return (
    <div className="flex min-h-[380px] items-center justify-center">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-qu-warning/[0.08] text-qu-warning">
          <AlertTriangle size={19} />
        </span>
        <h4 className="mt-3 text-sm font-bold text-qu-text">
          {stale ? "Results no longer match the controls" : "No analysis result yet"}
        </h4>
        <p className="mt-1 text-[11px] leading-relaxed text-qu-text-muted">
          {stale
            ? "Run Bottleneck Analysis to produce evidence for the current program, reduction, and population."
            : "Run the analysis to compare each course with an unchanged baseline."}
        </p>
      </div>
    </div>
  );
}
