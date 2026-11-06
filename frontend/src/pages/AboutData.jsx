import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { api } from "../utils/api";
import PageHeader from "../components/PageHeader";
import DataSourceBadge from "../components/DataSourceBadge";

export default function AboutData() {
  const [sources, setSources] = useState(null);
  const [assumptions, setAssumptions] = useState(null);

  useEffect(() => {
    api.getSources().then(setSources);
    api.getAssumptions().then(setAssumptions);
  }, []);

  const assumptionCount = assumptions
    ? Object.entries(assumptions).flatMap(([k, v]) => (k === "_program_level" ? [] : Object.values(v))).length
    : 0;

  return (
    <div>
      <PageHeader title="About This Data" subtitle="Every number in this simulator traces back to a real source or a documented assumption." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="qu-card p-5">
          <h3 className="text-sm font-bold mb-3">Real Data Sources</h3>
          <div className="space-y-3">
            {sources?.sources.map((s) => (
              <div key={s.id} className="border-b border-qu-border/60 pb-3 last:border-0">
                <div className="flex items-center gap-2">
                  <DataSourceBadge source="real" />
                  <span className="text-sm font-semibold">{s.title}</span>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-qu-maroon hover:underline flex items-center gap-1 mt-1">
                    {s.url} <ExternalLink size={11} />
                  </a>
                )}
                <p className="text-xs text-qu-text-muted mt-1">{Array.isArray(s.used_for) ? s.used_for.join("; ") : s.used_for}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="qu-card p-5">
          <h3 className="text-sm font-bold mb-3">What Remains Assumed</h3>
          <p className="text-xs text-qu-text-muted mb-3">
            {assumptionCount} course-level data points (pass rates, section capacities, sections offered) are not published by
            QU and are estimated. Visit the Data Override panel to replace any of these with your department's real figures.
          </p>
          <ul className="text-xs text-qu-text-muted space-y-1.5 list-disc list-inside">
            {sources?.data_still_not_available?.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
          <a href="/data-override" className="inline-block mt-4 text-xs font-semibold bg-qu-maroon text-white rounded-md px-3 py-2 hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow">
            Go to Data Override →
          </a>
        </div>
      </div>

      {sources?.note && (
        <div className="qu-card p-4 border-2 border-qu-beige text-xs text-qu-text-muted leading-relaxed">
          {sources.note}
        </div>
      )}
    </div>
  );
}
