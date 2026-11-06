export default function PageHeader({ title, subtitle, actions, eyebrow = "Decision workspace" }) {
  return (
    <div className="page-header mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6">
      <div className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-qu-maroon">
          <span className="h-px w-5 bg-qu-maroon/50" />
          {eyebrow}
        </div>
        <h2 className="text-[26px] font-bold leading-[1.12] tracking-[-0.035em] text-qu-text sm:text-[30px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-qu-text-muted sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}
