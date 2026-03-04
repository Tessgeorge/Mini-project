function formatDeadline(deadline) {
  if (!deadline) return "-";
  const date = new Date(deadline);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(status) {
  if (status === "Active") return "bg-teal-100 text-teal-700 border-teal-200";
  if (status === "Completed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "Locked") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function ReviewTimeline({ stages, deadlineView, selectedClass }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-stretch gap-4 min-w-max">
        {stages.map((stage) => {
          const isActive = stage.status === "Active";
          return (
            <article
              key={stage.id}
              className={`rounded-xl border p-4 min-w-48 bg-white ${
                isActive ? "border-teal-500 ring-2 ring-teal-100" : "border-gray-200"
              }`}
            >
              <p className="text-sm font-semibold text-gray-800">{stage.name}</p>
              {deadlineView === "class" ? (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedClass}: {formatDeadline(stage.classDeadlines?.[selectedClass])}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Mentor Marks: {formatDeadline(stage.mentorMarksDeadline)}
                </p>
              )}
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
