function SummaryCard({ label, value, borderClass }) {
  return (
    <article className={`bg-white rounded-xl shadow-md border border-gray-100 border-t-4 ${borderClass} p-4`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-800 mt-1">{value}</p>
    </article>
  );
}

export default function AllocationSummary({ stats }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <SummaryCard label="Total Teams" value={stats.totalTeams} borderClass="border-t-teal-500" />
      <SummaryCard label="Assigned Teams" value={stats.assignedTeams} borderClass="border-t-emerald-500" />
      <SummaryCard label="Unassigned Teams" value={stats.unassignedTeams} borderClass="border-t-rose-500" />
      <SummaryCard label="Total Guides" value={stats.totalGuides} borderClass="border-t-sky-500" />
      <SummaryCard label="Fully Occupied Guides" value={stats.fullyOccupiedGuides} borderClass="border-t-amber-500" />
    </section>
  );
}
