import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { X } from "lucide-react";
import { useApp } from "../context/app-context";
import { api } from "../utils/api";
import PageHeader from "../components/PageHeader";
import SimulationControls from "../components/SimulationControls";
import RoadmapFlow from "../components/RoadmapFlow";
import ExportButton from "../components/ExportButton";

const TABS = ["Roadmap Flow", "Term Progression", "Summary Statistics"];
const PROGRESSION_ORDER = {
  "On-track": 0,
  Graduated: 1,
  Delayed: 2,
  Withdrawn: 3,
};

function progressionItemSorter(item) {
  return PROGRESSION_ORDER[item?.name ?? item?.value] ?? 99;
}

function buildCohortPayload(simParams, programOverride) {
  const { use_real_population, existing_population, intake_schedule, ...rest } = simParams;
  const payload = { ...rest, program: programOverride };
  if (!use_real_population) {
    const ep = {};
    [1, 2, 3, 4].forEach((y) => {
      const v = existing_population?.[y];
      if (v !== "" && v != null) ep[y] = Number(v);
    });
    if (Object.keys(ep).length) payload.existing_population = ep;
  }
  if (intake_schedule && Object.keys(intake_schedule).length) {
    payload.intake_schedule = Object.fromEntries(
      Object.entries(intake_schedule).map(([t, v]) => [Number(t), Number(v) || 0])
    );
  }
  return payload;
}

function publishCohortSnapshot(recordSimulation, program, payload, result) {
  recordSimulation("cohort", {
    program,
    parameters: {
      starting_term: payload.starting_term,
      max_terms: payload.max_terms,
      seed: payload.seed,
      registration_priority: payload.registration_priority,
      global_pass_rate_fallback: payload.pass_rate,
      scheduled_capacity_terms: Object.keys(payload.capacity_schedule || {}).length,
      scheduled_rate_terms: Object.keys(payload.rate_schedule || {}).length,
      actual_enrollment_terms: Object.keys(payload.actual_enrollment || {}).length,
    },
    summary: result.summary,
    data: {
      per_term_stats: result.per_term_stats,
      stuck_points: result.stuck_points.slice(0, 5),
    },
  });
}

export default function CohortSimulator() {
  const { simParams, setSimParams, recordSimulation } = useApp();
  const [program, setProgram] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("Roadmap Flow");
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Live-stepping overrides accumulated while stepping through the Roadmap
  // Flow -- separate from simParams since they're per-session adjustments,
  // not base configuration. Reset whenever the sidebar's "Run Simulation"
  // starts a fresh baseline.
  const [capacitySchedule, setCapacitySchedule] = useState({});
  const [rateSchedule, setRateSchedule] = useState({});
  const [actualEnrollment, setActualEnrollment] = useState({});

  const runFresh = useCallback(() => {
    setCapacitySchedule({});
    setRateSchedule({});
    setActualEnrollment({});
    setRunning(true);
    const effectiveProgram = simParams.program === "both" ? "cs" : simParams.program;
    const payload = buildCohortPayload(simParams, effectiveProgram);
    return Promise.all([api.getProgram(effectiveProgram), api.simulateCohort(payload)])
      .then(([prog, res]) => {
        setProgram(prog);
        setResult(res);
        publishCohortSnapshot(recordSimulation, effectiveProgram, payload, res);
      })
      .finally(() => setRunning(false));
  }, [simParams, recordSimulation]);

  const runWithSchedules = useCallback((nextCap, nextRate, nextActual) => {
    setRunning(true);
    const effectiveProgram = simParams.program === "both" ? "cs" : simParams.program;
    const payload = {
      ...buildCohortPayload(simParams, effectiveProgram),
      capacity_schedule: nextCap,
      rate_schedule: nextRate,
      actual_enrollment: nextActual,
    };
    return api.simulateCohort(payload)
      .then((res) => {
        setResult(res);
        publishCohortSnapshot(recordSimulation, effectiveProgram, payload, res);
      })
      .finally(() => setRunning(false));
  }, [simParams, recordSimulation]);

  // Passed to RoadmapFlow's "Adjust from here" panel: capacity/rate edits
  // apply from `term + 1` onward (cumulative), an actual-enrollment
  // correction applies only to `term` itself. Re-runs the full simulation
  // with the updated schedules and resolves once the new result is in.
  const handleApplySettings = useCallback((term, changes) => {
    const nextCap = { ...capacitySchedule };
    const nextRate = { ...rateSchedule };
    const nextActual = { ...actualEnrollment };

    if (changes.capacityEdit) {
      const targetTerm = term + 1;
      const { code, ...fields } = changes.capacityEdit;
      nextCap[targetTerm] = {
        ...(nextCap[targetTerm] || {}),
        [code]: { ...(nextCap[targetTerm]?.[code] || {}), ...fields },
      };
    }
    if (changes.rateEdit) {
      const targetTerm = term + 1;
      nextRate[targetTerm] = { ...(nextRate[targetTerm] || {}), ...changes.rateEdit };
    }
    if (changes.actualEdit) {
      const { code, count } = changes.actualEdit;
      nextActual[term] = { ...(nextActual[term] || {}), [code]: count };
    }

    setCapacitySchedule(nextCap);
    setRateSchedule(nextRate);
    setActualEnrollment(nextActual);
    return runWithSchedules(nextCap, nextRate, nextActual);
  }, [capacitySchedule, rateSchedule, actualEnrollment, runWithSchedules]);

  useEffect(() => { runFresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = selectedCourse && result ? result.course_stats[selectedCourse] : null;
  const detailCourse = selectedCourse && program ? program.courses[selectedCourse] : null;

  const termChartData = result?.per_term_stats.map((t) => ({
    term: t.term, on_track: t.on_track, delayed: t.delayed, graduated: t.graduated, withdrawn: t.withdrawn,
  })) || [];

  const summaryCsv = result ? Object.entries(result.summary).map(([k, v]) => ({ metric: k, value: v })) : [];

  return (
    <div>
      <PageHeader
        title="Cohort Flow Simulator"
        subtitle="Step through each semester live -- adjust capacity, pass rates, and real registration numbers as you go."
        actions={result && <ExportButton csvData={summaryCsv} csvFilename="cohort_summary.csv" pdfElementId="cohort-export-area" pdfFilename="cohort_report.pdf" pdfTitle="Cohort Flow Simulation Report" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <SimulationControls params={simParams} setParams={setSimParams} onRun={runFresh} running={running} />

        <div id="cohort-export-area" className="min-w-0">
          <div className="flex gap-1 mb-3 border-b border-qu-border">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-qu-maroon text-qu-maroon" : "border-transparent text-qu-text-muted hover:text-qu-text"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {!result || !program ? (
            <div className="qu-card p-8 text-center text-sm text-qu-text-muted">
              {running ? "Running simulation..." : "No results yet."}
            </div>
          ) : (
            <>
              {tab === "Roadmap Flow" && (
                <div className="qu-card p-4">
                  <RoadmapFlow
                    program={program}
                    result={result}
                    maxTerms={simParams.max_terms}
                    startingTerm={simParams.starting_term}
                    capacitySchedule={capacitySchedule}
                    onCourseClick={setSelectedCourse}
                    onApplySettings={handleApplySettings}
                  />
                </div>
              )}

              {tab === "Term Progression" && (
                <div className="qu-card p-4">
                  <ResponsiveContainer width="100%" height={380}>
                    <LineChart data={termChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8D2D5" />
                      <XAxis dataKey="term" tick={{ fontSize: 12 }} label={{ value: "Term", position: "insideBottom", offset: -5, fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip itemSorter={progressionItemSorter} />
                      <Legend itemSorter={progressionItemSorter} wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="on_track" stroke="#8A1538" strokeWidth={2} dot={false} name="On-track" />
                      <Line type="monotone" dataKey="graduated" stroke="#0E6B46" strokeWidth={2.5} dot={false} name="Graduated" />
                      <Line type="monotone" dataKey="delayed" stroke="#955008" strokeWidth={2.5} dot={false} name="Delayed" />
                      <Line type="monotone" dataKey="withdrawn" stroke="#A11D33" strokeWidth={2.5} dot={false} name="Withdrawn" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {tab === "Summary Statistics" && <SummaryStats summary={result.summary} />}
            </>
          )}
        </div>
      </div>

      {detail && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-qu-border p-5 z-30 overflow-y-auto">
          <button onClick={() => setSelectedCourse(null)} className="absolute top-4 right-4 text-qu-text-muted hover:text-qu-text">
            <X size={18} />
          </button>
          <h3 className="text-lg font-bold">{selectedCourse}</h3>
          <p className="text-sm text-qu-text-muted mb-4">{detailCourse?.name}</p>
          <dl className="space-y-2 text-sm">
            <Row label="Passed first attempt" value={`${detail.passed_first_attempt} (${Math.round(100 * detail.passed_first_attempt / Math.max(1, detail.unique_attempted))}%)`} />
            <Row label="Retook once" value={detail.retook_once} />
            <Row label="Retook 2+ times" value={detail.retook_2plus} />
            <Row label="Eligible but unfinished at horizon" value={detail.currently_waiting} />
            <Row label="Enrolled in final simulated term" value={detail.currently_enrolled} />
            <Row label="Avg attempts" value={detail.avg_attempts} />
            <Row label="Withdrawn %" value={`${detail.withdrawn_pct}%`} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-qu-border/60 pb-1.5">
      <dt className="text-qu-text-muted">{label}</dt>
      <dd className="font-semibold text-qu-maroon">{value}</dd>
    </div>
  );
}

function SummaryStats({ summary }) {
  const rows = [
    ["Currently enrolled (today)", summary.current_total_enrolled],
    ["Currently enrolled (end of horizon)", summary.final_total_enrolled],
    ["Still enrolled, not yet graduated", summary.still_enrolled_count],
    ["On-time graduation (≤8 terms)", `${summary.on_time_pct}%`],
    ["1 term delayed", `${summary.delay_1_pct}%`],
    ["2 terms delayed", `${summary.delay_2_pct}%`],
    ["3+ terms delayed", `${summary.delay_3plus_pct}%`],
    ["Withdrawn before graduation", `${summary.withdrawn_pct}%`],
    ["Average graduation term", summary.avg_graduation_term],
    ["Median graduation term", summary.median_graduation_term],
    ["90th percentile graduation term", summary.p90_graduation_term],
    ["Longest path", `${summary.longest_path_terms} terms`],
    ["Most-retaken course", `${summary.most_retaken_course} (avg ${summary.most_retaken_avg_attempts} attempts)`],
    ["Most-abandoned course", `${summary.most_abandoned_course} (${summary.most_abandoned_pct}% withdrew)`],
  ];
  return (
    <div className="qu-card p-4">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-qu-border/60">
              <td className="py-2.5 text-qu-text-muted">{label}</td>
              <td className="py-2.5 font-semibold text-qu-maroon text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
