import ActivityProgressBar from "./ActivityProgressBar";

function mentorStatusTone(pending) {
  return pending >= 3
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function mentorStatusLabel(pending) {
  return pending >= 3 ? "Delayed" : "On Track";
}

export default function MentorActivityCard({ activity, onViewEvaluationDetails }) {
  const pendingEvaluations = Math.max(0, activity.totalAssigned - activity.completed);
  const progress = activity.totalAssigned > 0 ? (activity.completed / activity.totalAssigned) * 100 : 0;

  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Mentor Evaluations</h3>
        <p className="text-xs text-gray-500 mt-1">Round-wise review completion</p>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-gray-500">Total Assigned Reviews</p>
          <p className="font-semibold text-gray-800">{activity.totalAssigned}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-gray-500">Completed Evaluations</p>
          <p className="font-semibold text-gray-800">{activity.completed}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-gray-500">Pending Evaluations</p>
          <p className="font-semibold text-gray-800">{pendingEvaluations}</p>
        </div>
      </div>

      <ActivityProgressBar value={progress} />

      <div className="space-y-2">
        {activity.mentors.map((mentor) => (
          <div key={mentor.name} className="rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-800">{mentor.name}</p>
              <p className="text-[11px] text-gray-500 mt-1">Pending: {mentor.pending}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${mentorStatusTone(mentor.pending)}`}>
              {mentorStatusLabel(mentor.pending)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Pending Evaluation Details</p>
        {activity.pendingDetails.map((item) => (
          <div key={`${item.mentor}-${item.team}`} className="rounded-lg border border-gray-100 px-3 py-2">
            <p className="text-xs font-medium text-gray-800">{item.team}</p>
            <p className="text-[11px] text-gray-500 mt-1">{item.class} • {item.mentor}</p>
            <p className="text-[11px] text-rose-600 mt-1">{item.reason}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onViewEvaluationDetails}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50"
      >
        View Evaluation Details
      </button>
    </section>
  );
}
