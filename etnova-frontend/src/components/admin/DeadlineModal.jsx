export default function DeadlineModal({
  stage,
  isOpen,
  deadlineDate,
  deadlineTime,
  title = "Edit Deadline",
  dateLabel = "Deadline Date",
  timeLabel = "Deadline Time",
  onDeadlineDateChange,
  onDeadlineTimeChange,
  onClose,
  onSave,
  saving = false,
}) {
  if (!isOpen || !stage) return null;

  const handleSave = () => {
    if (!deadlineDate || !deadlineTime) return;
    onSave(stage.id, `${deadlineDate}T${deadlineTime}:00`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-100 p-6 animate-scaleIn">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{stage.name}</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">{dateLabel}</label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(event) => onDeadlineDateChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">{timeLabel}</label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(event) => onDeadlineTimeChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!deadlineDate || !deadlineTime || saving}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
