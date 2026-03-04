function StatIcon({ type }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "size-5",
    "aria-hidden": "true",
  };

  switch (type) {
    case "total":
      return <svg {...props}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "active":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "completed":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
    case "upcoming":
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    default:
      return null;
  }
}

export default function StageStatCard({ title, value, icon, borderClass }) {
  return (
    <article className={`bg-white rounded-xl shadow-md border border-gray-100 border-t-4 ${borderClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800">{value}</p>
        </div>
        <div className="size-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
          <StatIcon type={icon} />
        </div>
      </div>
    </article>
  );
}
