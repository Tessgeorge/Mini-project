import SectionCard from "./SectionCard";

export default function AllocationCard({ guides, onRunRandomAllocation }) {
  return (
    <SectionCard
      title="Mentor Allocation Overview"
      subtitle="Max 2 Teams Per Mentor Enforced"
      action={(
        <button
          type="button"
          onClick={onRunRandomAllocation}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
        >
          Run Random Allocation
        </button>
      )}
    >
      <div className="space-y-4">
        {guides.map((guide) => {
          const percent = Math.min(100, Math.round((guide.assigned / guide.max) * 100));
          return (
            <div key={guide.name}>
              <div className="flex justify-between items-center text-sm mb-2">
                <p className="font-medium text-gray-700">{guide.name}</p>
                <p className="text-gray-500">{guide.assigned}/{guide.max} teams</p>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${percent >= 100 ? "bg-amber-500" : "bg-teal-500"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
