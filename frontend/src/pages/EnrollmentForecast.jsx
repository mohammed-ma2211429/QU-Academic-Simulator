import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Activity, Database, Loader2, RefreshCw } from "lucide-react";
import { useApp } from "../context/app-context";
import { api } from "../utils/api";
import PageHeader from "../components/PageHeader";
import ExportButton from "../components/ExportButton";

function sameConfig(left, right) {
  return left
    && right
    && left.program === right.program
    && left.currentEnrollment === right.currentEnrollment
    && left.growthRate === right.growthRate
    && left.model === right.model
    && left.years === right.years;
}

export default function EnrollmentForecast() {
  const { effectiveProgram, recordSimulation } = useApp();
  const [program, setProgram] = useState(effectiveProgram);
  const [currentEnrollment, setCurrentEnrollment] = useState(548);
  const [growthRate, setGrowthRate] = useState(0.15);
  const [model, setModel] = useState("logistic");
  const [years, setYears] = useState(5);
  const [result, setResult] = useState(null);
  const [resultConfig, setResultConfig] = useState(null);
  const [publishedEnrollment, setPublishedEnrollment] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  const currentConfig = useMemo(
    () => ({ program, currentEnrollment, growthRate, model, years }),
    [program, currentEnrollment, growthRate, model, years],
  );
  const isStale = Boolean(result && !sameConfig(resultConfig, currentConfig));
  const visibleResult = result && !isStale ? result : null;

  const acceptResult = useCallback((targetProgram, response) => {
    const resolvedConfig = {
      program: targetProgram,
      currentEnrollment: response.params.current_enrollment,
      growthRate: response.params.growth_rate,
      model: response.params.model,
      years: response.params.years,
    };
    setResult(response);
    setResultConfig(resolvedConfig);
    const finalProjection = response.projections.at(-1);
    recordSimulation("enrollment_forecast", {
      program: targetProgram,
      parameters: response.params,
      summary: {
        current_enrollment: response.params.current_enrollment,
        final_enrollment: finalProjection?.enrollment ?? response.params.current_enrollment,
        first_capacity_signal: response.capacity_signals[0] || null,
        courses_exceeding_capacity: response.capacity_summary.courses_exceeding_capacity,
      },
      data: {
        projections: response.projections,
        capacity_signals: response.capacity_signals,
        capacity_summary: response.capacity_summary,
      },
    });
  }, [recordSimulation]);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setResult(null);
    api.simulateEnrollmentForecast({ program })
      .then((response) => {
        if (requestId !== requestSequence.current) return;
        setCurrentEnrollment(response.params.current_enrollment);
        setGrowthRate(response.params.growth_rate);
        setModel(response.params.model);
        setYears(response.params.years);
        setPublishedEnrollment(response.params.current_enrollment);
        acceptResult(program, response);
      })
      .finally(() => {
        if (requestId === requestSequence.current) setLoading(false);
      });
  }, [program, acceptResult]);

  const run = useCallback(() => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    api.simulateEnrollmentForecast({
      program,
      current_enrollment: currentEnrollment,
      growth_rate: growthRate,
      model,
      years,
    })
      .then((response) => {
        if (requestId === requestSequence.current) acceptResult(program, response);
      })
      .finally(() => {
        if (requestId === requestSequence.current) setLoading(false);
      });
  }, [program, currentEnrollment, growthRate, model, years, acceptResult]);

  const chartData = visibleResult?.projections.map((point) => ({
    year: point.year,
    enrollment: point.enrollment,
  })) || [];
  const firstSignal = visibleResult?.capacity_signals[0];
  const enrollmentIsPublished = currentEnrollment === publishedEnrollment;

  return (
    <div>
      <PageHeader
        title="Enrollment Forecast"
        subtitle="Project total enrollment and test term-by-term eligible course demand against recorded seats."
        actions={visibleResult && (
          <ExportButton
            csvData={visibleResult.capacity_signals}
            csvFilename="enrollment_capacity_signals.csv"
            pdfElementId="enrollment-forecast-export-area"
            pdfFilename="enrollment_forecast.pdf"
            pdfTitle="Enrollment Forecast and Capacity Signals"
          />
        )}
      />

      <div id="enrollment-forecast-export-area" className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[250px_minmax(0,1fr)_360px]">
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs text-qu-text-muted">Current enrollment</label>
              <span className={`text-[9px] font-bold uppercase tracking-[0.08em] ${enrollmentIsPublished ? "text-qu-success" : "text-qu-warning"}`}>
                {enrollmentIsPublished ? "published default" : "user input"}
              </span>
            </div>
            <input
              type="number"
              min={1}
              value={currentEnrollment}
              onChange={(event) => setCurrentEnrollment(Number(event.target.value))}
              className="w-full rounded-md border border-qu-border px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-qu-text-muted">
              Annual growth rate: {Math.round(growthRate * 1000) / 10}%
            </label>
            <input
              type="range"
              min={-10}
              max={30}
              step={0.1}
              value={growthRate * 100}
              onChange={(event) => setGrowthRate(Number(event.target.value) / 100)}
              className="w-full accent-qu-maroon"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-qu-text-muted">Growth model</label>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-md border border-qu-border px-2 py-1.5 text-sm"
            >
              <option value="linear">Linear</option>
              <option value="exponential">Exponential</option>
              <option value="logistic">S-curve (logistic)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-qu-text-muted">
              Forecast horizon: {years} years
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
              className="w-full accent-qu-maroon"
            />
          </div>

          {isStale && (
            <div className="flex gap-2 rounded-lg border border-qu-warning/30 bg-qu-warning/[0.07] p-3 text-[10px] leading-relaxed text-qu-text">
              <RefreshCw size={14} className="mt-0.5 shrink-0 text-qu-warning" />
              Inputs changed. The previous chart and capacity signals are hidden until you rerun.
            </div>
          )}

          <button
            onClick={run}
            disabled={loading || currentEnrollment < 1}
            className="qu-btn-shadow flex w-full items-center justify-center gap-2 rounded-md bg-qu-maroon py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-qu-maroon-mid disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Running forecast..." : "Run Forecast"}
          </button>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="qu-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-qu-text">Program enrollment curve</h3>
                <p className="mt-1 text-[11px] text-qu-text-muted">
                  This line shows the selected mathematical growth model, not historical observations.
                </p>
              </div>
              {visibleResult && (
                <span className="rounded-full bg-qu-maroon/[0.07] px-3 py-1 text-[10px] font-bold capitalize text-qu-maroon">
                  {model} · {years} years
                </span>
              )}
            </div>
            <div className="mt-4 min-h-[430px]">
              {loading && !visibleResult ? (
                <LoadingState text="Projecting enrollment and simulating eligible course demand..." />
              ) : visibleResult ? (
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={chartData} margin={{ top: 14, right: 20, bottom: 16, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFCE" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11 }}
                      label={{ value: "Forecast year", position: "insideBottom", offset: -8, fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={54}
                      label={{ value: "Students", angle: -90, position: "insideLeft", fontSize: 10 }}
                    />
                    <Tooltip formatter={(value) => [`${value} students`, "Projected enrollment"]} />
                    {firstSignal && (
                      <ReferenceLine
                        x={firstSignal.year}
                        stroke="#8A1538"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="enrollment"
                      stroke="#8A1538"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name="Projected enrollment"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState stale={isStale} />
              )}
            </div>
          </section>

          {visibleResult && (
            <section className="qu-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-qu-maroon/[0.07] text-qu-maroon">
                  <Activity size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-qu-text">How course demand is produced</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-qu-text-muted">
                    The projected growth curve scales future Fall intakes. Cohort Flow then advances the
                    existing year-level population term by term through prerequisites, individual pass rates,
                    registration, and waitlists. A capacity signal appears when eligible demand for a required
                    course exceeds its recorded seats in an offered term.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-5 lg:col-start-2 2xl:col-start-auto">
          <section className="qu-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-qu-text">Course capacity signals</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-qu-text-muted">
                  First simulated term in which eligible demand exceeds recorded seats.
                </p>
              </div>
              <Database size={17} className="text-qu-maroon" />
            </div>

            <div className="mt-4 max-h-[490px] overflow-y-auto">
              {visibleResult ? (
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-qu-border text-left text-qu-text-muted">
                      <th className="py-2 pr-2">Term</th>
                      <th className="pr-2">Course</th>
                      <th className="text-right">Demand / seats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleResult.capacity_signals.map((signal) => (
                      <tr key={signal.course} className="border-b border-qu-border/60 align-top">
                        <td className="py-2 pr-2 text-qu-text-muted">{signal.term_label}</td>
                        <td className="py-2 pr-2">
                          <span className="block font-bold text-qu-maroon">{signal.course}</span>
                          <span className="mt-0.5 block text-[9px] text-qu-text-muted">gap +{signal.gap}</span>
                        </td>
                        <td className="py-2 text-right font-semibold text-qu-text">
                          {signal.demand} / {signal.seats_available}
                        </td>
                      </tr>
                    ))}
                    {visibleResult.capacity_signals.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-qu-text-muted">
                          No required course exceeded recorded seats within this horizon.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-xs text-qu-text-muted">
                  {loading ? "Capacity signals are being calculated..." : "Run the current inputs to view signals."}
                </div>
              )}
            </div>
          </section>

          {visibleResult && (
            <section className="qu-card p-4">
              <h3 className="text-sm font-bold text-qu-text">Forecast evidence</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Fact label="Required courses tested" value={visibleResult.capacity_summary.required_courses_tested} />
                <Fact label="Courses with a signal" value={visibleResult.capacity_summary.courses_exceeding_capacity} />
                <Fact label="Terms simulated" value={visibleResult.capacity_summary.terms_simulated} />
                <Fact label="First signal term" value={visibleResult.capacity_summary.earliest_signal_term ?? "None"} />
              </div>
              {visibleResult.data_issues.length > 0 && (
                <div className="mt-3 rounded-lg border border-qu-warning/30 bg-qu-warning/[0.07] p-3 text-[10px] leading-relaxed text-qu-text-muted">
                  {visibleResult.data_issues.map((issue) => (
                    <div key={issue.course}><strong>{issue.course}:</strong> {issue.message}</div>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-lg border border-qu-border bg-qu-off-white p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.07em] text-qu-text-muted">{label}</div>
      <div className="mt-1 text-sm font-bold text-qu-text">{value}</div>
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <div className="flex min-h-[410px] items-center justify-center gap-2 text-xs text-qu-text-muted">
      <Loader2 size={16} className="animate-spin text-qu-maroon" />
      {text}
    </div>
  );
}

function EmptyState({ stale }) {
  return (
    <div className="flex min-h-[410px] items-center justify-center text-center">
      <div>
        <RefreshCw size={20} className="mx-auto text-qu-text-muted/45" />
        <div className="mt-3 text-sm font-bold text-qu-text">
          {stale ? "Results no longer match the inputs" : "No forecast result yet"}
        </div>
        <div className="mt-1 text-[11px] text-qu-text-muted">
          Run the forecast to calculate the current chart and capacity signals.
        </div>
      </div>
    </div>
  );
}
