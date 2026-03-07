import ActivityProgressBar from "./ActivityProgressBar";

function statusTone(status) {
  return status === "Late"
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-amber-100 text-amber-700 border-amber-200";
}

export default function StudentActivityCard({ activity, onViewAllTeams }) {
  const pending = activity.total - activity.submitted;
  const progress = activity.total > 0 ? (activity.submitted / activity.total) * 100 : 0;

  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Student Submissions</h3>
        <p className="text-xs text-gray-500 mt-1">{activity.stage}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-gray-500">Submitted</p>
          <p className="font-semibold text-gray-800">{activity.submitted} / {activity.total}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-gray-500">Pending</p>
          <p className="font-semibold text-gray-800">{pending}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 col-span-2">
          <p className="text-gray-500">Late</p>
          <p className="font-semibold text-gray-800">{activity.late}</p>
        </div>
      </div>

      <ActivityProgressBar value={progress} />

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Top Pending Teams</p>
        {activity.teams.slice(0, 5).map((team) => (
          <div key={`${team.name}-${team.class}`} className="rounded-lg border border-gray-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-gray-800">{team.name}</p>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusTone(team.status)}`}>
                {team.status}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{team.class}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onViewAllTeams}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50"
      >
        View All Teams
      </button>
    </section>
  );
}
