import { useState, useEffect, useMemo } from "react";
import { Upload, Download, RotateCcw, Save, HelpCircle, X } from "lucide-react";
import { api } from "../utils/api";
import { exportJSON } from "../utils/dataExport";
import PageHeader from "../components/PageHeader";
import TooltipHelp from "../components/TooltipHelp";
import DataSourceBadge from "../components/DataSourceBadge";

const FIELD_LABELS = {
  pass_rate: "Course Pass Rates",
  section_capacity: "Section Capacities",
  sections_offered: "Sections Offered",
};

const EXAMPLE_CONFIG = {
  department: {
    MATH101: { pass_rate: 0.85, section_capacity: 45 },
  },
  cs: {
    CMPS303: { sections_offered: 3 },
  },
  ce: {
    CMPE263: { pass_rate: 0.78 },
  },
};

function JsonFormatModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Expected Config Format</h3>
          <button onClick={onClose} className="text-qu-text-muted hover:text-qu-text"><X size={18} /></button>
        </div>
        <p className="text-xs text-qu-text-muted mb-3">
          This is a <span className="font-semibold">JSON</span> file, not CSV -- one previously saved via "Export Config"
          below, or hand-edited to this shape: scope → course code → only the field(s) you want to override.
          Use <span className="font-semibold">department</span> for a course shared by CS and CE.
        </p>
        <pre className="text-[10px] bg-qu-off-white rounded-md p-3 overflow-x-auto mb-4">
{JSON.stringify(EXAMPLE_CONFIG, null, 2)}
        </pre>
        <ul className="text-xs space-y-1.5 mb-4">
          <li><span className="font-semibold text-qu-maroon">pass_rate</span> — decimal between 0 and 1 (e.g. 0.85 = 85%)</li>
          <li><span className="font-semibold text-qu-maroon">section_capacity</span> — seats per section</li>
          <li><span className="font-semibold text-qu-maroon">sections_offered</span> — sections run per term</li>
        </ul>
        <button
          onClick={() => exportJSON(EXAMPLE_CONFIG, "override_config_example.json")}
          className="w-full text-xs font-semibold bg-qu-maroon text-white rounded-md py-2 hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow"
        >
          Download Example Config
        </button>
      </div>
    </div>
  );
}

export default function DataOverride() {
  const [assumptions, setAssumptions] = useState({});
  const [overrides, setOverrides] = useState({});
  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  useEffect(() => {
    Promise.all([api.getAssumptions(), api.getOverrides()]).then(([assumptionData, savedOverrides]) => {
      setAssumptions(assumptionData);
      setOverrides(savedOverrides);
    });
  }, []);

  const rows = useMemo(() => {
    const out = [];
    Object.entries(assumptions).forEach(([key, fields]) => {
      if (key === "_program_level") return;
      const [program, code] = key.split(".");
      Object.entries(fields).forEach(([field, info]) => {
        out.push({ key, program, code, field, ...info });
      });
    });
    return out.filter((r) =>
      (fieldFilter === "all" || r.field === fieldFilter) &&
      (search === "" || r.code.toLowerCase().includes(search.toLowerCase()))
    );
  }, [assumptions, search, fieldFilter]);

  const setOverrideValue = (program, code, field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [program]: { ...prev[program], [code]: { ...prev[program]?.[code], [field]: value } },
    }));
  };

  const getOverride = (program, code, field) => overrides[program]?.[code]?.[field];

  const saveOverrides = () => {
    setSaving(true);
    const cleaned = {};
    Object.entries(overrides).forEach(([program, courses]) => {
      Object.entries(courses).forEach(([code, fields]) => {
        const nonEmpty = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ""));
        if (Object.keys(nonEmpty).length) {
          cleaned[program] = cleaned[program] || {};
          cleaned[program][code] = nonEmpty;
        }
      });
    });
    api.postOverride(cleaned).then(() => alert("Overrides saved.")).finally(() => setSaving(false));
  };

  const resetDefaults = () => {
    if (confirm("Clear all overrides and revert to default assumed/real values?")) {
      api.clearOverrides().then(() => { setOverrides({}); alert("Overrides cleared."); });
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setOverrides(JSON.parse(reader.result));
      } catch {
        alert("Invalid config file.");
      }
    };
    reader.readAsText(file);
  };

  const changedCount = Object.values(overrides).reduce((a, c) => a + Object.values(c).reduce((b, f) => b + Object.values(f).filter((v) => v !== undefined && v !== "").length, 0), 0);

  return (
    <div>
      <PageHeader
        title="Data Override Panel"
        subtitle="Replace assumed values with your institution's real numbers to make the simulation genuinely predictive."
        actions={
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium border border-qu-border rounded-md px-3 py-1.5 hover:bg-qu-off-white cursor-pointer">
              <Upload size={13} /> Import Config
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button onClick={() => setShowFormatHelp(true)} className="flex items-center gap-1.5 text-xs font-medium border border-qu-border rounded-md px-3 py-1.5 hover:bg-qu-off-white">
              <HelpCircle size={13} /> Format Help
            </button>
            <button onClick={() => exportJSON(overrides, "qu_simulator_config.json")} className="flex items-center gap-1.5 text-xs font-medium border border-qu-border rounded-md px-3 py-1.5 hover:bg-qu-off-white">
              <Download size={13} /> Export Config
            </button>
            <button onClick={resetDefaults} className="flex items-center gap-1.5 text-xs font-medium border border-qu-border rounded-md px-3 py-1.5 hover:bg-qu-off-white">
              <RotateCcw size={13} /> Reset to Defaults
            </button>
            <button onClick={saveOverrides} disabled={saving || changedCount === 0} className="flex items-center gap-1.5 text-xs font-semibold bg-qu-maroon text-white rounded-md px-3 py-1.5 hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow disabled:opacity-50">
              <Save size={13} /> Save Overrides ({changedCount})
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-3">
        <input placeholder="Search course code..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm border border-qu-border rounded-md px-2 py-1.5" />
        <select value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)} className="text-sm border border-qu-border rounded-md px-2 py-1.5">
          <option value="all">All parameters</option>
          {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="qu-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-qu-text-muted border-b border-qu-border bg-qu-off-white">
              <th className="py-2 px-3">Scope</th>
              <th className="px-3">Parameter</th>
              <th className="px-3">Default Value</th>
              <th className="px-3">Source</th>
              <th className="px-3">Override Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overridden = getOverride(r.program, r.code, r.field) !== undefined && getOverride(r.program, r.code, r.field) !== "";
              return (
                <tr key={r.key + r.field} className={`border-b border-qu-border/50 ${overridden ? "bg-qu-beige/10" : ""}`}>
                  <td className="py-1.5 px-3 font-semibold">
                    {r.program === "department" ? (
                      <span className="inline-flex items-center rounded-full border border-qu-maroon/20 bg-qu-maroon/[0.08] px-2 py-1 text-[11px] font-bold text-qu-maroon">
                        Shared · CS + CE
                      </span>
                    ) : r.program.toUpperCase()}
                  </td>
                  <td className="px-3">
                    <span className="font-semibold text-qu-maroon">{r.code}</span> · {FIELD_LABELS[r.field]}
                    <TooltipHelp text={r.reasoning} />
                  </td>
                  <td className="px-3 tabular-nums">{r.value}</td>
                  <td className="px-3">
                    <DataSourceBadge
                      source={overridden ? "override" : r.source}
                      confidence={overridden ? undefined : r.confidence}
                    />
                  </td>
                  <td className="px-3">
                    <input
                      type="number"
                      step={r.field === "pass_rate" ? "0.01" : "1"}
                      min="0"
                      max={r.field === "pass_rate" ? "1" : undefined}
                      placeholder={String(r.value)}
                      value={getOverride(r.program, r.code, r.field) ?? ""}
                      onChange={(e) => setOverrideValue(r.program, r.code, r.field, e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-24 border border-qu-border rounded px-2 py-1"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showFormatHelp && <JsonFormatModal onClose={() => setShowFormatHelp(false)} />}
    </div>
  );
}
