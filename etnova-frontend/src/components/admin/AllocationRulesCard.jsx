const RULES = [
  "Each guide can handle maximum 2 teams",
  "Allocation is department restricted",
  "Random distribution is balanced",
  "Manual override allowed",
];

function RuleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}

export default function AllocationRulesCard() {
  return (
    <section className="bg-teal-50 border border-teal-100 rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-800">Allocation Rules</h2>
      <ul className="mt-4 space-y-2.5">
        {RULES.map((rule) => (
          <li key={rule} className="flex items-center gap-2.5 text-sm text-gray-700">
            <span className="size-6 rounded-full bg-white text-teal-600 border border-teal-100 flex items-center justify-center">
              <RuleIcon />
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
