const ROLE_STYLES = {
  Guide: "bg-teal-100 text-teal-700 border-teal-200",
  Evaluator: "bg-blue-100 text-blue-700 border-blue-200",
  Coordinator: "bg-violet-100 text-violet-700 border-violet-200",
};

export default function RoleBadge({ role }) {
  const tone = ROLE_STYLES[role] || "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${tone}`}>
      {role}
    </span>
  );
}
