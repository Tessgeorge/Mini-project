function formatDeadline(deadline) {
  if (!deadline) return "-";
  const date = new Date(deadline);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status) {
  if (status === "Active") return "bg-teal-100 text-teal-700 border-teal-200";
  if (status === "Completed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "Locked") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function StageTable({
  stages,
  onEditDeadline,
  onActivateStage,
  onCompleteStage,
  onUnlockStage,
  canActivate,
  deadlineView,
  selectedClass,
}) {
  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Stage Name</th>
              <th className="px-6 py-3 text-left font-semibold">
                {deadlineView === "class" ? `Deadline (${selectedClass})` : "Mentor Marks Deadline"}
              </th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Submissions</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stages.map((stage, index) => {
              const isLocked = stage.status === "Locked";
              const isActive = stage.status === "Active";
              const isCompleted = stage.status === "Completed";
              const isInactive = stage.status === "Inactive";
              const canActivateStage = canActivate(index);
              const canComplete = !isLocked && isActive;
              return (
                <tr key={stage.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{stage.name}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {deadlineView === "class"
                      ? formatDeadline(stage.classDeadlines?.[selectedClass])
                      : formatDeadline(stage.mentorMarksDeadline)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusTone(stage.status)}`}>
                      {stage.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{stage.submissions}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditDeadline(stage)}
                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                      >
                        Edit Deadline
                      </button>
                      <button
                        type="button"
                        onClick={() => onActivateStage(index)}
                        disabled={!canActivateStage || !isInactive}
                        className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Activate Stage
                      </button>
                      <button
                        type="button"
                        onClick={() => onCompleteStage(index)}
                        disabled={!canComplete || isCompleted}
                        className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-white text-xs font-semibold hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Complete Stage
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnlockStage(index)}
                        disabled={!isLocked}
                        className="px-3 py-2 rounded-lg border border-amber-200 text-amber-700 bg-white text-xs font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Unlock Stage
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
