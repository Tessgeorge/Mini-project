function formatDeadline(deadline) {
  if (!deadline) return "-";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(status) {
  if (status === "Active") return "bg-teal-100 text-teal-700 border-teal-200";
  if (status === "Completed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "Locked") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function ReviewTimeline({
  stages,
  selectedClass,
  deadlineLabel = "Deadline",
}) {
  if (!stages.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
        No review stages are configured for {selectedClass || "the selected class"}.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-stretch gap-4 min-w-max">
        {stages.map((stage) => {
          const isActive = stage.status === "Active";
          return (
            <article
              key={stage.id}
              className={`rounded-xl border p-4 min-w-52 bg-white ${
                isActive ? "border-teal-500 ring-2 ring-teal-100" : "border-gray-200"
              }`}
            >
              <p className="text-sm font-semibold text-gray-800">{stage.name}</p>
              <p className="text-xs text-gray-500 mt-1">{deadlineLabel}: {formatDeadline(stage.deadline)}</p>
              <span className={`inline-flex mt-3 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusTone(stage.status)}`}>
                {stage.status}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
