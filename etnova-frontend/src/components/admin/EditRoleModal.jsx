const EDITABLE_ROLES = ["Guide", "Coordinator"];

export default function EditRoleModal({
  mentor,
  isOpen,
  selectedRoles,
  classes = [],
  selectedClassId = "",
  onClassChange,
  onToggleRole,
  onClose,
  onSave,
}) {
  if (!isOpen || !mentor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-100 p-6 animate-scaleIn">
        <h3 className="text-lg font-semibold text-gray-800">Edit Roles</h3>
        <p className="mt-1 text-sm text-gray-500">{mentor.name}</p>

        <div className="mt-5 space-y-3">
          {EDITABLE_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => onToggleRole(role)}
                className="size-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span>{role}</span>
            </label>
          ))}
        </div>

        {selectedRoles.includes("Coordinator") ? (
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1.5">Coordinator Class</label>
            <select
              value={selectedClassId}
              onChange={(event) => onClassChange?.(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              <option value="">Select Class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-gray-500">
          Evaluator assignment is handled by coordinators.
        </p>

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
            onClick={() => onSave(mentor.id, selectedRoles, selectedClassId)}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
