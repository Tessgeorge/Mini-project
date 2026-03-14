import RoleBadge from "./RoleBadge";

function StatusCell({ status }) {
  const active = status === "Active";
  return (
    <div className="inline-flex items-center gap-2 text-sm text-gray-700">
      <span className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`} />
      <span>{status}</span>
    </div>
  );
}

export default function MentorTable({ mentors, onEditRoles, onDeleteMentor, onSelectMentor, selectedMentorId }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Mentor Name</th>
              <th className="px-6 py-3 text-left font-semibold">Email</th>
              <th className="px-6 py-3 text-left font-semibold">Roles</th>
              <th className="px-6 py-3 text-left font-semibold">Assigned Teams</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mentors.map((mentor) => {
              const visibleRoles = mentor.roles.filter((role) => role !== "Evaluator");
              const isSelected = selectedMentorId === mentor.id;
              return (
              <tr
                key={mentor.id}
                className={`hover:bg-gray-50 ${isSelected ? "bg-teal-50/60" : ""}`}
                onClick={() => onSelectMentor?.(mentor.id)}
              >
                <td className="px-6 py-4 font-medium text-gray-800">{mentor.name}</td>
                <td className="px-6 py-4 text-gray-600">{mentor.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {visibleRoles.length > 0 ? (
                      visibleRoles.map((role) => <RoleBadge key={`${mentor.id}-${role}`} role={role} />)
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700">{mentor.assignedTeams}</td>
                <td className="px-6 py-4"><StatusCell status={mentor.status} /></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditRoles(mentor)}
                      className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
                    >
                      Edit Roles
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMentor(mentor.id)}
                      className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-white text-sm font-semibold hover:bg-rose-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {mentors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  No mentors found for the selected filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
