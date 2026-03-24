function StatusBadge({ guide }) {
  if (!guide) {
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Unassigned</span>;
  }
  return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Assigned</span>;
}

export default function TeamTable({
  teams,
  guides,
  selectedGuides,
  onGuideChange,
  onAssign,
  canAssignGuide,
  loading = false,
  noneGuideValue = "__none__",
}) {
  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">Team Allocation Table</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Team Name</th>
              <th className="px-6 py-3 text-left font-semibold">Class</th>
              <th className="px-6 py-3 text-left font-semibold">Current Mentor</th>
              <th className="px-6 py-3 text-left font-semibold">Allocation Status</th>
              <th className="px-6 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teams.map((team) => {
              const selectedGuide = selectedGuides[team.id] || "";
              const candidateGuideId = selectedGuide || team.guideId || "";
              const isAllowed = candidateGuideId ? canAssignGuide(team.id, candidateGuideId) : false;
              return (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{team.name}</td>
                  <td className="px-6 py-4 text-gray-600">{team.class}</td>
                  <td className="px-6 py-4 text-gray-700">{team.guide || "-"}</td>
                  <td className="px-6 py-4">
                    <StatusBadge guide={team.guide} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedGuide}
                        onChange={(event) => onGuideChange(team.id, event.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                      >
                        <option value="">Select mentor</option>
                        <option value={noneGuideValue}>None (Unassign)</option>
                        {guides.map((guide) => {
                          const optionAllowed = canAssignGuide(team.id, guide.id);
                          return (
                            <option key={guide.id} value={guide.id} disabled={!optionAllowed}>
                              {guide.name}
                              {!optionAllowed ? " (Full)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => onAssign(team.id)}
                        disabled={loading || !selectedGuide || !isAllowed}
                        className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {selectedGuide === noneGuideValue ? "Unassign" : team.guide ? "Reassign" : "Assign"}
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
