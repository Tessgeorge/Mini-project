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
  if (status === "Pending") return "bg-amber-100 text-amber-700 border-amber-200";
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
  onToggleLockStage,
  onRenameStage,
  onDeleteStage,
  onMoveStageUp,
  onMoveStageDown,
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
            ) : stages.map((stage, index) => {
              const isBusy = actionBusyId === stage.id;
              const isLocked = Boolean(stage.isLocked || stage.status === "Locked");
              const isFirst = index === 0;
              const isLast = index === stages.length - 1;
              const canEditDeadline = !isLocked;

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
                        disabled={isBusy || !canEditDeadline}
                        title={canEditDeadline ? editActionLabel : "Unlock stage to set deadline"}
                        aria-label={canEditDeadline ? editActionLabel : "Unlock stage to set deadline"}
                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Deadline
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleLockStage(stage.id)}
                        disabled={isBusy}
                        title={isLocked ? "Unlock Stage" : "Lock Stage"}
                        aria-label={isLocked ? "Unlock Stage" : "Lock Stage"}
                        className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-white text-xs font-semibold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLocked ? "Unlock" : "Lock"}
                      </button>
                      {!simplifiedActions ? (
                        <div className="inline-flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white">
                          <button
                            type="button"
                            onClick={() => onMoveStageUp(stage.id)}
                            disabled={isBusy || isFirst}
                            title="Move Up"
                            aria-label="Move Up"
                            className="w-8 h-7 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border-b border-slate-300"
                          >
                            <span className="material-symbols-outlined text-[18px] leading-none">keyboard_arrow_up</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveStageDown(stage.id)}
                            disabled={isBusy || isLast}
                            title="Move Down"
                            aria-label="Move Down"
                            className="w-8 h-7 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[18px] leading-none">keyboard_arrow_down</span>
                          </button>
                        </div>
                      ) : null}
                      {!simplifiedActions ? (
                        <button
                          type="button"
                          onClick={() => onRenameStage(stage.id)}
                          disabled={isBusy}
                          title="Edit Stage"
                          aria-label="Edit Stage"
                          className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 bg-white text-xs font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                      ) : null}
                      {!simplifiedActions ? (
                        <button
                          type="button"
                          onClick={() => onDeleteStage(stage.id)}
                          disabled={isBusy}
                          title="Delete Stage"
                          aria-label="Delete Stage"
                          className="size-8 rounded-lg border border-gray-300 text-gray-700 bg-white text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          🗑
                        </button>
                      ) : null}
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
