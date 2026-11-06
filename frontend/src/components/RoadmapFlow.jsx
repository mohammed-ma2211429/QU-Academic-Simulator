import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, RotateCcw, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { termLabel } from "../utils/term";

const SPEED_MS = { Slow: 1400, Normal: 800, Fast: 350, Instant: 0 };

function courseColorState(snapshot, capacity) {
  if (!snapshot) return "grey";
  const { students_enrolled_this_term } = snapshot;
  if (students_enrolled_this_term === 0) return "grey";
  // Congestion = seats filled vs. the course's own capacity, not the
  // reference cohort size -- the real population (500-2000+ students)
  // dwarfs the reference size, so comparing against it would show every
  // course as maxed out regardless of actual fullness.
  const congestion = students_enrolled_this_term / Math.max(1, capacity);
  if (congestion > 0.85) return "maroon";
  if (congestion > 0.6) return "amber";
  return "green";
}

const STATE_STYLES = {
  grey: { bg: "#F1F3F5", border: "#CBD0D5", text: "#626A73", bar: "#9AA2AB" },
  amber: { bg: "#FFF4E5", border: "#D9A55A", text: "#19161A", bar: "#955008" },
  maroon: { bg: "#F8E8ED", border: "#8A1538", text: "#430B24", bar: "#8A1538" },
  green: { bg: "#EAF6F0", border: "#0E6B46", text: "#19161A", bar: "#0E6B46" },
};

function effectiveCourseCapacity(course, code, capacitySchedule, term) {
  let sectionCapacity = course.section_capacity || 1;
  let sectionsOffered = course.sections_offered || 1;
  Object.keys(capacitySchedule || {})
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((scheduledTerm) => {
      if (scheduledTerm > term) return;
      const courseEdit = capacitySchedule[scheduledTerm]?.[code];
      if (!courseEdit) return;
      sectionCapacity = courseEdit.section_capacity ?? sectionCapacity;
      sectionsOffered = courseEdit.sections_offered ?? sectionsOffered;
    });
  return sectionCapacity * sectionsOffered;
}

export default function RoadmapFlow({
  program,
  result,
  onCourseClick,
  maxTerms,
  startingTerm,
  capacitySchedule,
  onApplySettings,
}) {
  const [term, setTerm] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("Normal");
  const [panelOpen, setPanelOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [capCourse, setCapCourse] = useState("");
  const [capCapacity, setCapCapacity] = useState("");
  const [capSections, setCapSections] = useState("");
  const [passRate, setPassRate] = useState("");
  const [failRate, setFailRate] = useState("");
  const [withdrawRate, setWithdrawRate] = useState("");
  const [actualCourse, setActualCourse] = useState("");
  const [actualCount, setActualCount] = useState("");
  const intervalRef = useRef(null);

  const columns = useMemo(() => Object.entries(program.roadmap || {}), [program]);
  const totalTerms = maxTerms || (result?.per_term_stats?.length ?? 8);

  useEffect(() => {
    if (!playing) {
      clearInterval(intervalRef.current);
      return;
    }
    const ms = SPEED_MS[speed] || 800;
    if (ms === 0) {
      setTerm(totalTerms);
      setPlaying(false);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTerm((t) => {
        if (t >= totalTerms) {
          setPlaying(false);
          return t;
        }
        return t + 1;
      });
    }, ms);
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, totalTerms]);

  const termStats = result?.per_term_stats?.[term - 1];
  const currentLabel = term === 1 ? "Today" : termLabel(startingTerm, term);

  // Re-runs the simulation with the new setting merged in (capacity/rate
  // changes apply from next term onward; actual-enrollment corrects the
  // term currently being viewed), then advances the term marker by one --
  // "commit this semester's change, move to the next."
  const applyAndAdvance = async (changes) => {
    if (!onApplySettings) return;
    setApplying(true);
    try {
      await onApplySettings(term, changes);
      setTerm((t) => Math.min(totalTerms, t + 1));
    } finally {
      setApplying(false);
    }
  };

  const submitCapacity = () => {
    if (!capCourse || (capCapacity === "" && capSections === "")) return;
    const edit = { code: capCourse };
    if (capCapacity !== "") edit.section_capacity = Number(capCapacity);
    if (capSections !== "") edit.sections_offered = Number(capSections);
    applyAndAdvance({ capacityEdit: edit }).then(() => {
      setCapCourse(""); setCapCapacity(""); setCapSections("");
    });
  };

  const submitRate = () => {
    const rates = {};
    if (passRate !== "") rates.pass_rate = Number(passRate) / 100;
    if (failRate !== "") rates.fail_rate = Number(failRate) / 100;
    if (withdrawRate !== "") rates.withdraw_rate = Number(withdrawRate) / 100;
    if (!Object.keys(rates).length) return;
    applyAndAdvance({ rateEdit: rates }).then(() => {
      setPassRate(""); setFailRate(""); setWithdrawRate("");
    });
  };

  const submitActual = () => {
    if (!actualCourse || actualCount === "") return;
    applyAndAdvance({ actualEdit: { code: actualCourse, count: Number(actualCount) } }).then(() => {
      setActualCourse(""); setActualCount("");
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-qu-maroon text-white px-3 py-1.5 rounded-md hover:bg-qu-maroon-mid"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => setTerm((t) => Math.min(totalTerms, t + 1))}
            className="flex items-center gap-1.5 text-xs font-medium border border-qu-border px-3 py-1.5 rounded-md hover:bg-qu-off-white"
          >
            <SkipForward size={13} /> Step
          </button>
          <button
            onClick={() => { setTerm(1); setPlaying(false); }}
            className="flex items-center gap-1.5 text-xs font-medium border border-qu-border px-3 py-1.5 rounded-md hover:bg-qu-off-white"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            className="text-xs border border-qu-border rounded-md px-2 py-1.5"
          >
            {Object.keys(SPEED_MS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="flex items-center text-xs font-bold text-qu-maroon bg-qu-off-white border border-qu-maroon/30 rounded-md px-3 py-1.5 ml-1">
            {currentLabel}{term > 1 ? ` (term ${term})` : ""}
          </span>
        </div>
        {termStats && (
          <div className="flex gap-3 text-xs">
            <Legend color="#1E6B3C" label={`${termStats.graduated} graduated`} />
            <Legend color="#8A1538" label={`${termStats.on_track + termStats.delayed} active`} />
            <Legend color="#B45309" label={`${termStats.delayed} delayed`} />
            <Legend color="#9B1C1C" label={`${termStats.withdrawn} withdrawn`} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-x-4 gap-y-1 mb-3 flex-wrap text-[11px]">
        <span className="font-semibold text-qu-text-muted">Course-card colour = seat utilization:</span>
        <Legend color="#9AA2AB" label="No enrollment" />
        <Legend color="#0E6B46" label="1–60%" />
        <Legend color="#955008" label="Over 60–85%" />
        <Legend color="#8A1538" label="Over 85%" />
        <span className="text-qu-text-muted">Bar = population completion</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {columns.map(([colName, codes]) => (
            <div key={colName} className="w-44 shrink-0">
              <div className="text-[11px] font-semibold text-qu-text-muted text-center mb-2 sticky top-0">
                {colName}
              </div>
              <div className="space-y-2">
                {codes.map((code) => {
                  const course = program.courses[code];
                  if (!course) return null;
                  const snapshot = result?.course_term_snapshots?.[code]?.[term - 1];
                  const capacity = effectiveCourseCapacity(course, code, capacitySchedule, term);
                  const state = courseColorState(snapshot, capacity);
                  const style = STATE_STYLES[state];
                  const pct = snapshot?.pct_cohort_passed ?? 0;
                  const enrolled = snapshot?.students_enrolled_this_term ?? 0;

                  return (
                    <motion.button
                      key={code}
                      onClick={() => onCourseClick?.(code)}
                      layout
                      className="w-full text-left rounded-lg border-2 p-2 cursor-pointer hover:shadow-md transition-shadow"
                      style={{ background: style.bg, borderColor: style.border }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold" style={{ color: style.text }}>{code}</span>
                        <span className="text-[9px] bg-white/70 rounded px-1 font-medium text-qu-text-muted">
                          {course.credits} CH
                        </span>
                      </div>
                      <div className="text-[10px] text-qu-text-muted leading-tight mt-0.5 line-clamp-2 h-6">
                        {course.name}
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] font-semibold mt-1" style={{ color: style.text }}>
                        <span>{enrolled} enrolled</span>
                        <span>{pct}% complete</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/10 rounded-full mt-1 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: style.bar }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={1}
          max={totalTerms}
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="w-full accent-qu-maroon"
        />
        <div className="flex justify-between text-[11px] text-qu-text-muted mt-1">
          <span>Today</span>
          <span className="font-semibold text-qu-maroon">
            {term === 1 ? "Viewing today's snapshot" : `Viewing term ${term} (${term - 1} term${term - 1 === 1 ? "" : "s"} from now)`}
          </span>
          <span>Term {totalTerms}</span>
        </div>
      </div>

      {onApplySettings && (
        <div className="mt-4 border-t border-qu-border pt-3">
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-qu-maroon"
          >
            {panelOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Settings2 size={13} /> Adjust from here ({currentLabel})
          </button>
          {panelOpen && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 bg-qu-off-white rounded-lg p-3">
              <div>
                <div className="text-[11px] font-semibold text-qu-text-muted mb-1.5">
                  Change a course's capacity <span className="font-normal">(from next term on)</span>
                </div>
                <select value={capCourse} onChange={(e) => setCapCourse(e.target.value)} className="w-full text-xs border border-qu-border rounded-md px-2 py-1 mb-1.5">
                  <option value="">Pick a course...</option>
                  {Object.keys(program.courses).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex gap-1.5 mb-1.5">
                  <input type="number" min={0} placeholder="Per section" value={capCapacity} onChange={(e) => setCapCapacity(e.target.value)} className="w-1/2 text-xs border border-qu-border rounded-md px-2 py-1" />
                  <input type="number" min={1} placeholder="# sections" value={capSections} onChange={(e) => setCapSections(e.target.value)} className="w-1/2 text-xs border border-qu-border rounded-md px-2 py-1" />
                </div>
                <button onClick={submitCapacity} disabled={applying || !capCourse} className="w-full text-xs font-semibold bg-qu-maroon text-white rounded-md py-1.5 hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow disabled:opacity-50">
                  {applying ? "Applying..." : "Apply & step forward"}
                </button>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-qu-text-muted mb-1.5">
                  Change fallback pass / fail / withdraw rates <span className="font-normal">(from next term on)</span>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <input type="number" min={0} max={100} placeholder="Fallback pass %" value={passRate} onChange={(e) => setPassRate(e.target.value)} className="w-1/3 text-xs border border-qu-border rounded-md px-2 py-1" />
                  <input type="number" min={0} max={100} placeholder="Fail %" value={failRate} onChange={(e) => setFailRate(e.target.value)} className="w-1/3 text-xs border border-qu-border rounded-md px-2 py-1" />
                  <input type="number" min={0} max={100} placeholder="Withdraw %" value={withdrawRate} onChange={(e) => setWithdrawRate(e.target.value)} className="w-1/3 text-xs border border-qu-border rounded-md px-2 py-1" />
                </div>
                <button onClick={submitRate} disabled={applying} className="w-full text-xs font-semibold bg-qu-maroon text-white rounded-md py-1.5 hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow disabled:opacity-50">
                  {applying ? "Applying..." : "Apply & step forward"}
                </button>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-qu-text-muted mb-1.5">
                  Enter real registration <span className="font-normal">({currentLabel} only)</span>
                </div>
                <select value={actualCourse} onChange={(e) => setActualCourse(e.target.value)} className="w-full text-xs border border-qu-border rounded-md px-2 py-1 mb-1.5">
                  <option value="">Pick a course...</option>
                  {Object.keys(program.courses).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" min={0} placeholder="Actual enrolled count" value={actualCount} onChange={(e) => setActualCount(e.target.value)} className="w-full text-xs border border-qu-border rounded-md px-2 py-1 mb-1.5" />
                <button onClick={submitActual} disabled={applying || !actualCourse || actualCount === ""} className="w-full text-xs font-semibold border border-qu-maroon text-qu-maroon rounded-md py-1.5 hover:bg-qu-off-white transition-all hover:-translate-y-0.5 disabled:opacity-50">
                  {applying ? "Applying..." : "Correct this semester & step forward"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1 text-qu-text-muted">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
