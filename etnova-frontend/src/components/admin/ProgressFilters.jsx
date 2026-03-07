export default function ProgressFilters({
  classes = [],
  classFilter,
  stageFilter,
  statusFilter,
  onClassChange,
  onStageChange,
  onStatusChange,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={classFilter}
        onChange={(event) => onClassChange(event.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        <option value="All Classes">All Classes</option>
        {classes.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>

      <select
        value={stageFilter}
        onChange={(event) => onStageChange(event.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        <option value="All Stages">All Stages</option>
        <option value="Abstract">Abstract</option>
        <option value="0th Review">0th Review</option>
        <option value="1st Review">1st Review</option>
        <option value="2nd Review">2nd Review</option>
        <option value="Final Review">Final Review</option>
      </select>

      <select
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        <option value="All">All</option>
        <option value="Completed">Completed</option>
        <option value="Active">Active</option>
        <option value="Pending">Pending</option>
      </select>
    </div>
  );
}
