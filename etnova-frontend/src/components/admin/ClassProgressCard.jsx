function progressTone(value) {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export default function ClassProgressCard({ item }) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white shadow-md p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-800">{item.className}</h3>
        <span className="text-xs font-semibold text-gray-600">{item.completion}%</span>
      </div>

      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${progressTone(item.completion)}`} style={{ width: `${item.completion}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
          <p className="text-gray-500">Total Teams</p>
          <p className="font-semibold text-gray-800 mt-0.5">{item.totalTeams}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
          <p className="text-gray-500">Completed</p>
          <p className="font-semibold text-gray-800 mt-0.5">{item.completedTeams}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
          <p className="text-gray-500">Active</p>
          <p className="font-semibold text-gray-800 mt-0.5">{item.activeTeams}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
          <p className="text-gray-500">Pending</p>
          <p className="font-semibold text-gray-800 mt-0.5">{item.pendingTeams}</p>
        </div>
      </div>
    </article>
  );
}
