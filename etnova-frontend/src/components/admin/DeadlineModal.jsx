export default function DeadlineModal({
  stage,
  isOpen,
  classADate,
  classATime,
  classBDate,
  classBTime,
  marksDate,
  marksTime,
  onClassADateChange,
  onClassATimeChange,
  onClassBDateChange,
  onClassBTimeChange,
  onMarksDateChange,
  onMarksTimeChange,
  onClose,
  onSave,
}) {
  if (!isOpen || !stage) return null;

  const handleSave = () => {
    if (!classADate || !classBDate || !marksDate) return;
    onSave(stage.id, {
      classDeadlines: {
        "S6 CSE A": `${classADate}T${classATime || "09:00"}:00`,
        "S6 CSE B": `${classBDate}T${classBTime || "09:00"}:00`,
      },
      mentorMarksDeadline: `${marksDate}T${marksTime || "17:00"}:00`,
    });
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
        <h3 className="text-lg font-semibold text-gray-800">Edit Deadline</h3>
        <p className="mt-1 text-sm text-gray-500">{stage.name}</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">S6 CSE A Date</label>
              <input
                type="date"
                value={classADate}
                onChange={(event) => onClassADateChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">S6 CSE A Time</label>
              <input
                type="time"
                value={classATime}
                onChange={(event) => onClassATimeChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">S6 CSE B Date</label>
              <input
                type="date"
                value={classBDate}
                onChange={(event) => onClassBDateChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">S6 CSE B Time</label>
              <input
                type="time"
                value={classBTime}
                onChange={(event) => onClassBTimeChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Mentor Marks Deadline Date</label>
              <input
                type="date"
                value={marksDate}
                onChange={(event) => onMarksDateChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Mentor Marks Deadline Time</label>
              <input
                type="time"
                value={marksTime}
                onChange={(event) => onMarksTimeChange(event.target.value)}
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
            className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
