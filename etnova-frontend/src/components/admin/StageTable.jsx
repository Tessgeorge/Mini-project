function formatDeadline(deadline) {
  if (!deadline) return "-";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "-";
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
  loading,
  stages,
  selectedClass,
  onEditDeadline,
  onActivateStage,
  onCompleteStage,
  onLockStage,
  onUnlockStage,
  actionBusyId,
}) {
  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Stage Name</th>
              <th className="px-6 py-3 text-left font-semibold">{`Deadline (${selectedClass || "-"})`}</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Submissions</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">Loading review stages...</td>
              </tr>
            ) : stages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No review stages found.</td>
              </tr>
            ) : stages.map((stage) => {
              const isBusy = actionBusyId === stage.id;
              const isLocked = stage.status === "Locked";
              const isActive = stage.status === "Active";
              const isCompleted = stage.status === "Completed";
              const isInactive = stage.status === "Inactive";

              return (
                <tr key={stage.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{stage.name}</td>
                  <td className="px-6 py-4 text-gray-600">{formatDeadline(stage.deadline)}</td>
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
                        disabled={isBusy}
                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Edit Deadline
                      </button>
                      <button
                        type="button"
                        onClick={() => onActivateStage(stage.id)}
                        disabled={isBusy || !isInactive}
                        className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        onClick={() => onCompleteStage(stage.id)}
                        disabled={isBusy || !isActive || isCompleted}
                        className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-white text-xs font-semibold hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => onLockStage(stage.id)}
                        disabled={isBusy || isLocked || isCompleted}
                        className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-white text-xs font-semibold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Lock
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnlockStage(stage.id)}
                        disabled={isBusy || !isLocked}
                        className="px-3 py-2 rounded-lg border border-amber-200 text-amber-700 bg-white text-xs font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Unlock
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
