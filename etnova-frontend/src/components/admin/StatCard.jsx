function StatIcon({ name }) {
  const common = "size-5";
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: common,
    "aria-hidden": "true",
  };

  switch (name) {
    case "teams":
      return <svg {...props}><path d="M2 20a5 5 0 0 1 10 0" /><path d="M15 20a4 4 0 0 1 7 0" /><circle cx="7" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /></svg>;
    case "guides":
      return <svg {...props}><path d="M4 5h10l3 3v11H4z" /><path d="M14 5v3h3M7 12h7M7 16h5" /></svg>;
    case "pending":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "stage":
      return <svg {...props}><path d="M4 19h16M6 16V9m6 7V5m6 11v-4" /></svg>;
    case "published":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
    default:
      return null;
  }
}

export default function StatCard({ title, value, hint, borderClass, icon }) {
  return (
    <article className={`rounded-2xl bg-white/90 border border-slate-200/70 border-t-4 ${borderClass} p-5 shadow-sm`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className="size-9 rounded-lg bg-teal-50/80 text-teal-600 flex items-center justify-center">
          <StatIcon name={icon} />
        </div>
      </div>
    </article>
  );
}
