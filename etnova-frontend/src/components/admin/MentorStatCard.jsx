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
    case "mentors":
      return <svg {...props}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M14 20a4 4 0 0 1 7.5-1.8" /></svg>;
    case "guide":
      return <svg {...props}><path d="M4 5h10l3 3v11H4z" /><path d="M14 5v3h3M7 12h7M7 16h5" /></svg>;
    case "evaluator":
      return <svg {...props}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>;
    case "coordinator":
      return <svg {...props}><path d="M12 3v18M3 12h18" /><path d="m5 5 14 14M19 5 5 19" /></svg>;
    default:
      return null;
  }
}

export default function MentorStatCard({ title, value, icon, borderClass }) {
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
