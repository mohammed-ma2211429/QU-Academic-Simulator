import { ArrowLeft } from "lucide-react";
import { Link } from "../components/AppLink";

export default function NotFound() {
  return (
    <div className="qu-card mx-auto max-w-2xl p-8 text-center sm:p-12">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-qu-maroon">
        Page not found
      </div>
      <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-qu-text">
        This simulator page does not exist.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-qu-text-muted">
        The address may be outdated, or the feature may no longer be part of
        the supported simulator.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-qu-maroon px-4 py-2.5 text-xs font-bold text-white hover:bg-qu-maroon-mid"
      >
        <ArrowLeft size={15} />
        Return to Simulator Home
      </Link>
    </div>
  );
}
