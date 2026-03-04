function getGuideStatus(assigned) {
  if (assigned >= 2) return { label: "Full", tone: "bg-rose-100 text-rose-700", bar: "bg-rose-500" };
  if (assigned === 1) return { label: "Partially Occupied", tone: "bg-amber-100 text-amber-700", bar: "bg-amber-500" };
  return { label: "Available", tone: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" };
}

export default function GuideCard({ guide }) {
  const maxTeams = 2;
  const workloadPercent = Math.min(100, (guide.assigned / maxTeams) * 100);
  const status = getGuideStatus(guide.assigned);

  return (
    <article className="bg-white rounded-xl border border-gray-100 shadow-md p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-800 truncate">{guide.name}</h3>
          <p className="text-sm text-gray-500 truncate mt-1">{guide.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.tone}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="text-gray-600">Assigned Teams</p>
        <p className="font-semibold text-gray-800">{guide.assigned}/{maxTeams}</p>
      </div>

      <div className="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${workloadPercent}%` }} />
      </div>
    </article>
  );
}
