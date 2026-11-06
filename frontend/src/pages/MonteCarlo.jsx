import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { useApp } from "../context/app-context";
import { api } from "../utils/api";
import PageHeader from "../components/PageHeader";
import TooltipHelp from "../components/TooltipHelp";
import ExportButton from "../components/ExportButton";

export default function MonteCarlo() {
  const { effectiveProgram, recordSimulation } = useApp();
  const [program, setProgram] = useState(effectiveProgram);
  const [nRuns, setNRuns] = useState(300);
  const [distribution, setDistribution] = useState("beta");
  const [betaAlpha, setBetaAlpha] = useState(5);
  const [betaBeta, setBetaBeta] = useState(2);
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState(null);
  const [otherResult, setOtherResult] = useState(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(() => {
    setRunning(true);
    const otherProgram = program === "cs" ? "ce" : "cs";
    Promise.all([
      api.simulateMonteCarlo({ program, n_runs: nRuns, distribution, beta_alpha: betaAlpha, beta_beta: betaBeta, seed }),
      api.simulateMonteCarlo({ program: otherProgram, n_runs: Math.min(nRuns, 150), distribution, beta_alpha: betaAlpha, beta_beta: betaBeta, seed }),
    ]).then(([res, other]) => {
      setResult(res);
      setOtherResult(other);
      recordSimulation("monte_carlo", {
        program,
        parameters: {
          n_runs: nRuns,
          distribution,
          beta_alpha: betaAlpha,
          beta_beta: betaBeta,
          seed,
        },
        summary: {
          ...res.statistics,
          most_influential_course: res.sensitivity_matrix?.most_influential_course,
          most_influential_score: res.sensitivity_matrix?.most_influential_score,
        },
        data: {
          graduation_distribution: res.graduation_distribution,
          sensitivity: res.sensitivity_matrix?.sensitivity || {},
          comparison: {
            program: otherProgram,
            statistics: other.statistics,
          },
        },
      });
    }).finally(() => setRunning(false));
  }, [program, nRuns, distribution, betaAlpha, betaBeta, seed, recordSimulation]);

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const histogramData = useMemo(() => {
    if (!result) return [];
    const dist = result.graduation_distribution;
    const terms = Object.keys(dist).map(Number).sort((a, b) => a - b);
    return terms.map((t) => ({
      term: t >= 16 ? "16+" : String(t),
      count: dist[t],
      color: t <= 8 ? "#1E6B3C" : t <= 10 ? "#B45309" : "#9B1C1C",
    }));
  }, [result]);

  const boxPlotStats = (raw) => {
    if (!raw || !raw.length) return null;
    const sorted = [...raw].sort((a, b) => a - b);
    const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
    return { min: sorted[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: sorted[sorted.length - 1] };
  };

  const csBox = program === "cs" ? boxPlotStats(result?.raw_graduation_terms) : boxPlotStats(otherResult?.raw_graduation_terms);
  const ceBox = program === "ce" ? boxPlotStats(result?.raw_graduation_terms) : boxPlotStats(otherResult?.raw_graduation_terms);

  const sensitivityData = useMemo(() => {
    if (!result?.sensitivity_matrix) return [];
    return Object.entries(result.sensitivity_matrix.sensitivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, score]) => ({ code, score }));
  }, [result]);

  const maxSensitivity = Math.max(...sensitivityData.map((d) => d.score), 0.0001);

  return (
    <div>
      <PageHeader
        title="Monte Carlo Simulator"
        subtitle="Run many randomized simulations to see the range of possible outcomes."
        actions={result && (
          <ExportButton
            csvData={Object.entries(result.statistics).map(([metric, value]) => ({ metric, value }))}
            csvFilename="monte_carlo_statistics.csv"
            pdfElementId="monte-carlo-export-area" pdfFilename="monte_carlo_report.pdf" pdfTitle="Monte Carlo Simulation Report"
          />
        )}
      />

      <div id="monte-carlo-export-area" className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="qu-card p-4 space-y-4">
          <div>
            <label className="text-xs text-qu-text-muted block mb-1">Program</label>
            <div className="flex gap-2">
              {["cs", "ce"].map((p) => (
                <button key={p} onClick={() => setProgram(p)} className={`flex-1 text-xs font-semibold py-1.5 rounded-md border ${program === p ? "bg-qu-maroon text-white border-qu-maroon" : "border-qu-border text-qu-text-muted"}`}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-qu-text-muted flex items-center gap-1 mb-1">
              Number of Runs <TooltipHelp text="More runs give a smoother distribution but take longer to compute." />
            </label>
            <input type="range" min={100} max={2000} step={100} value={nRuns} onChange={(e) => setNRuns(Number(e.target.value))} className="w-full accent-qu-maroon" />
            <div className="text-xs text-right font-semibold text-qu-maroon">{nRuns}</div>
          </div>

          <div>
            <label className="text-xs text-qu-text-muted block mb-1">Distribution Shape</label>
            <select value={distribution} onChange={(e) => setDistribution(e.target.value)} className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5">
              <option value="beta">Beta</option>
              <option value="normal">Normal</option>
              <option value="uniform">Uniform</option>
            </select>
          </div>

          {distribution === "beta" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-qu-text-muted block mb-1">Alpha</label>
                <input type="number" value={betaAlpha} onChange={(e) => setBetaAlpha(Number(e.target.value))} className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label className="text-xs text-qu-text-muted block mb-1">Beta</label>
                <input type="number" value={betaBeta} onChange={(e) => setBetaBeta(Number(e.target.value))} className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-qu-text-muted block mb-1">Seed</label>
            <input type="number" min={0} max={4294967295} step={1} value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full text-xs border border-qu-border rounded-md px-2 py-1.5" />
          </div>

          <button onClick={run} disabled={running} className="w-full bg-qu-maroon text-white text-sm font-semibold py-2.5 rounded-md hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow disabled:opacity-60">
            {running ? "Running..." : "Run Monte Carlo"}
          </button>
        </div>

        {!result ? (
          <div className="qu-card p-8 text-center text-sm text-qu-text-muted">{running ? "Running..." : "No results yet."}</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="qu-card p-4">
              <h3 className="text-sm font-semibold mb-1">Graduation Term Histogram</h3>
              <div className="flex items-center gap-4 text-[11px] text-qu-text-muted mb-2">
                <LegendDot color="#1E6B3C" label="On-time (≤8 terms)" />
                <LegendDot color="#B45309" label="Delayed (9-10)" />
                <LegendDot color="#9B1C1C" label="Significantly delayed (11+)" />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFCE" />
                  <XAxis dataKey="term" tick={{ fontSize: 11 }} label={{ value: "Graduation term", position: "insideBottom", offset: -5, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Frequency", angle: -90, position: "insideLeft", fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine x={String(result.statistics.p50)} stroke="#8A1538" strokeDasharray="4 4" label={{ value: "P50", fontSize: 10 }} />
                  <Bar dataKey="count" name="Students">
                    {histogramData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="qu-card p-4">
              <h3 className="text-sm font-semibold mb-3">Box Plot: CS vs CE</h3>
              <BoxPlotSVG csBox={csBox} ceBox={ceBox} />
            </div>

            <div className="qu-card p-4">
              <h3 className="text-sm font-semibold mb-3">Sensitivity: Impact of 10% Pass-Rate Drop</h3>
              <p className="text-xs text-qu-text-muted mb-2">These are the courses that matter most to graduation speed.</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={sensitivityData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFCE" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="code" tick={{ fontSize: 10 }} width={65} />
                  <Tooltip />
                  <Bar dataKey="score" name="Sensitivity">
                    {sensitivityData.map((d, i) => (
                      <Cell key={i} fill={`rgb(${Math.round(155 + 100 * (d.score / maxSensitivity))}, ${Math.round(60 - 40 * (d.score / maxSensitivity))}, ${Math.round(60 - 40 * (d.score / maxSensitivity))})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="qu-card p-4">
              <h3 className="text-sm font-semibold mb-3">Summary Statistics</h3>
              <table className="w-full text-xs">
                <tbody>
                  <StatRow label="Mean graduation time" value={`${result.statistics.mean_graduation_term} terms`} />
                  <StatRow label="Median" value={`${result.statistics.median_graduation_term} terms`} />
                  <StatRow label="Std deviation" value={`${result.statistics.std_dev} terms`} />
                  <StatRow label="90th percentile" value={`${result.statistics.p90} terms`} />
                  <StatRow label="% graduating ≤8 terms" value={`${result.statistics.pct_on_time}%`} />
                  <StatRow label="% graduating 9-10 terms" value={`${result.statistics.pct_9_to_10}%`} />
                  <StatRow label="% graduating 11+ terms" value={`${result.statistics.pct_11_plus}%`} />
                  <StatRow label="% withdrawing before graduation" value={`${result.statistics.pct_withdrawn ?? result.statistics.pct_never_graduate}%`} />
                  <StatRow label="Most influential course" value={`${result.sensitivity_matrix?.most_influential_course} (${result.sensitivity_matrix?.most_influential_score})`} />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-full border" style={{ background: color + "22", borderColor: color }} />
      {label}
    </span>
  );
}

function StatRow({ label, value }) {
  return (
    <tr className="border-b border-qu-border/50">
      <td className="py-1.5 text-qu-text-muted">{label}</td>
      <td className="py-1.5 font-semibold text-qu-maroon text-right tabular-nums">{value}</td>
    </tr>
  );
}

function BoxPlotSVG({ csBox, ceBox }) {
  if (!csBox || !ceBox) return <div className="text-xs text-qu-text-muted">Loading...</div>;
  const allVals = [csBox, ceBox].flatMap((b) => [b.min, b.max]);
  const min = Math.min(...allVals) - 1;
  const max = Math.max(...allVals) + 1;
  const scale = (v) => 40 + ((v - min) / (max - min)) * 260;

  const Row = ({ label, box, y, color }) => (
    <g>
      <text x={5} y={y + 5} fontSize={11} fill="#1A1A1A" fontWeight="600">{label}</text>
      <line x1={scale(box.min)} x2={scale(box.q1)} y1={y} y2={y} stroke={color} strokeWidth={2} />
      <line x1={scale(box.q3)} x2={scale(box.max)} y1={y} y2={y} stroke={color} strokeWidth={2} />
      <rect x={scale(box.q1)} width={scale(box.q3) - scale(box.q1)} y={y - 12} height={24} fill={color + "33"} stroke={color} strokeWidth={2} rx={3} />
      <line x1={scale(box.median)} x2={scale(box.median)} y1={y - 12} y2={y + 12} stroke={color} strokeWidth={2} />
      <line x1={scale(box.min)} x2={scale(box.min)} y1={y - 6} y2={y + 6} stroke={color} strokeWidth={2} />
      <line x1={scale(box.max)} x2={scale(box.max)} y1={y - 6} y2={y + 6} stroke={color} strokeWidth={2} />
    </g>
  );

  return (
    <svg width="100%" height={200} viewBox="0 0 340 200">
      <Row label="CS" box={csBox} y={70} color="#8A1538" />
      <Row label="CE" box={ceBox} y={140} color="#BFA06C" />
      {[min, Math.round((min + max) / 2), max].map((v, i) => (
        <text key={i} x={scale(v)} y={190} fontSize={10} fill="#6B7280" textAnchor="middle">{Math.round(v)}</text>
      ))}
    </svg>
  );
}
