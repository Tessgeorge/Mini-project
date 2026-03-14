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
  deadlineLabel = "Deadline",
  simplifiedActions = false,
  onEditDeadline,
  onActivateStage,
  onCompleteStage,
  onToggleLockStage,
  onRenameStage,
  onDeleteStage,
  actionBusyId,
}) {
  const editActionLabel = simplifiedActions ? "Set Mentor Evaluation Deadline" : `Edit ${deadlineLabel}`;

  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Stage Name</th>
              <th className="px-6 py-3 text-left font-semibold">{`${deadlineLabel} (${selectedClass || "-"})`}</th>
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
              const canToggleActive = isInactive || isActive;
              const canToggleComplete = simplifiedActions
                ? (!isLocked || isCompleted)
                : (isActive || isCompleted);

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
                        title={editActionLabel}
                        aria-label={editActionLabel}
                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🕒
                      </button>
                      {!simplifiedActions ? (
                        <button
                          type="button"
                          onClick={() => onActivateStage(stage.id)}
                          disabled={isBusy || !canToggleActive}
                          title={isActive ? "Deactivate Stage" : "Activate Stage"}
                          aria-label={isActive ? "Deactivate Stage" : "Activate Stage"}
                          className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isActive ? "Off" : "On"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onCompleteStage(stage.id)}
                        disabled={isBusy || !canToggleComplete}
                        title={isCompleted ? "Mark Incomplete" : "Complete Stage"}
                        aria-label={isCompleted ? "Mark Incomplete" : "Complete Stage"}
                        className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-white text-xs font-semibold hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCompleted ? "Undo" : (simplifiedActions ? "Complete" : "Done")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleLockStage(stage.id)}
                        disabled={isBusy || (!simplifiedActions && isCompleted)}
                        title={isLocked ? "Unlock Stage" : "Lock Stage"}
                        aria-label={isLocked ? "Unlock Stage" : "Lock Stage"}
                        className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-white text-xs font-semibold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLocked ? "Unlock" : "Lock"}
                      </button>
                      {!simplifiedActions ? (
                        <button
                          type="button"
                          onClick={() => onRenameStage(stage.id)}
                          disabled={isBusy}
                          title="Rename Stage"
                          aria-label="Rename Stage"
                          className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 bg-white text-xs font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✎
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDeleteStage(stage.id)}
                        disabled={isBusy}
                        title="Remove Stage"
                        aria-label="Remove Stage"
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🗑
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
