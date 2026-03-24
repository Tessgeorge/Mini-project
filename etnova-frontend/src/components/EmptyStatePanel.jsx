export default function EmptyStatePanel({
  icon = "inbox",
  title,
  description,
  compact = false,
  action = null,
  className = "",
}) {
  return (
    <div className={`text-center rounded-2xl border border-slate-200 bg-slate-50/80 ${compact ? "px-4 py-8" : "px-6 py-10"} ${className}`.trim()}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-slate-200">
        <span className="material-symbols-outlined text-3xl text-slate-300">{icon}</span>
      </div>
      {title ? <p className="text-sm font-bold text-slate-800">{title}</p> : null}
      {description ? <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
