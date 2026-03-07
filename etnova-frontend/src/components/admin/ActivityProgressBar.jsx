function getTone(value) {
  if (value >= 100) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export default function ActivityProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Progress</span>
        <span className="font-semibold text-gray-700">{safeValue}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getTone(safeValue)}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
